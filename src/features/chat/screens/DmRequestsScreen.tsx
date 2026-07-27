import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { createDmRequest, listDmRequests, respondDmRequest } from "../../../api/chat";
import { plainApiError } from "../../../api/errors";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, spacing } from "../../../constants/theme";
import { useActionFeedback } from "../../../providers/ActionFeedbackProvider";
import { useAuthStore } from "../../../store/auth-store";
import type { ChatDmRequest } from "../../../types/api";

function peerName(request: ChatDmRequest) {
  return request.peer_label ?? request.requester_label ?? request.recipient_label ?? request.peer_username ?? "Player";
}

function requesterName(request: ChatDmRequest) {
  return request.requester_label ?? request.requester_display_name ?? request.requester_username ?? "Player";
}

function recipientName(request: ChatDmRequest) {
  return request.recipient_label ?? request.recipient_display_name ?? request.recipient_username ?? "Player";
}

function requesterHandle(request: ChatDmRequest) {
  return request.requester_username ? `@${request.requester_username}` : null;
}

function recipientHandle(request: ChatDmRequest) {
  return request.recipient_username ? `@${request.recipient_username}` : null;
}

type RequestDirection = "incoming" | "outgoing" | "unknown";
type RequestTab = "requests" | "sent" | "threads";

function requestDirection(request: ChatDmRequest, currentUserId?: string): RequestDirection {
  if (currentUserId && request.recipient_user_id === currentUserId) return "incoming";
  if (currentUserId && request.requester_user_id === currentUserId) return "outgoing";
  return "unknown";
}

function requestPrimaryLabel(request: ChatDmRequest, direction: RequestDirection) {
  if (direction === "incoming") return { prefix: "From", name: requesterName(request), handle: requesterHandle(request) };
  if (direction === "outgoing") return { prefix: "To", name: recipientName(request), handle: recipientHandle(request) };
  return { prefix: "With", name: peerName(request), handle: request.peer_username ? `@${request.peer_username}` : requesterHandle(request) ?? recipientHandle(request) };
}

export function DmRequestsScreen() {
  const queryClient = useQueryClient();
  const { pushFeedback } = useActionFeedback();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [recipient, setRecipient] = useState("");
  const [intro, setIntro] = useState("");
  const [activeTab, setActiveTab] = useState<RequestTab>("requests");

  const requestsQuery = useQuery({ queryKey: ["chat", "dm-requests"], queryFn: listDmRequests, refetchInterval: 30000 });
  const requests = requestsQuery.data ?? [];
  const groupedRequests = useMemo(() => {
    const incoming: ChatDmRequest[] = [];
    const sent: ChatDmRequest[] = [];
    const threads: ChatDmRequest[] = [];

    for (const request of requests) {
      const direction = requestDirection(request, currentUserId);
      if (request.status === "accepted") {
        threads.push(request);
      } else if (direction === "outgoing") {
        sent.push(request);
      } else if (request.status === "pending") {
        incoming.push(request);
      }
    }

    return { incoming, sent, threads };
  }, [currentUserId, requests]);
  const visibleRequests =
    activeTab === "requests" ? groupedRequests.incoming : activeTab === "sent" ? groupedRequests.sent : groupedRequests.threads;
  const tabItems: Array<{ key: RequestTab; label: string; count: number }> = [
    { key: "requests", label: "Requests", count: groupedRequests.incoming.length },
    { key: "sent", label: "Sent", count: groupedRequests.sent.length },
    { key: "threads", label: "Threads", count: groupedRequests.threads.length }
  ];

  const createMutation = useMutation({
    mutationFn: () => {
      const username = recipient.trim().replace(/^@/, "");
      if (!username) throw new Error("Enter a Skillsroom username.");
      return createDmRequest({ recipient_username: username, intro_message: intro.trim() || undefined });
    },
    onSuccess: async () => {
      pushFeedback({ tone: "success", title: "DM request sent." });
      setRecipient("");
      setIntro("");
      await queryClient.invalidateQueries({ queryKey: ["chat", "dm-requests"] });
    },
    onError: (error) => pushFeedback({
      tone: "error",
      title: "DM request needs attention",
      message: plainApiError(error, "Could not send DM request.")
    })
  });

  const respondMutation = useMutation({
    mutationFn: ({ requestId, response }: { requestId: string; response: "accepted" | "declined" }) => respondDmRequest(requestId, response),
    onSuccess: async (result) => {
      pushFeedback({ tone: "success", title: result.channel ? "DM accepted. Thread is ready." : "DM request updated." });
      await queryClient.invalidateQueries({ queryKey: ["chat", "dm-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
    },
    onError: (error) => pushFeedback({
      tone: "error",
      title: "DM request needs attention",
      message: plainApiError(error, "Could not update DM request.")
    })
  });

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>DM Requests</Text>
      </View>

      <SurfaceCard>
        <Badge tone="green">Start DM</Badge>
        <Text style={styles.sectionTitle}>Request a player chat</Text>
        <TextInput value={recipient} onChangeText={setRecipient} autoCapitalize="none" placeholder="Recipient username" placeholderTextColor={colors.faint} style={styles.input} />
        <Text style={styles.fieldHint}>Use the recipient's exact Skillsroom username, not only their display name.</Text>
        <TextInput
          value={intro}
          onChangeText={setIntro}
          multiline
          maxLength={500}
          placeholder="Intro message, optional"
          placeholderTextColor={colors.faint}
          style={[styles.input, styles.textarea]}
        />
        <AppButton loading={createMutation.isPending} onPress={() => createMutation.mutate()}>
          Send request
        </AppButton>
      </SurfaceCard>

      {requestsQuery.isError ? (
        <FeedbackState tone="error" title="Requests unavailable" body="Could not load DM requests." actionLabel="Retry" onAction={() => void requestsQuery.refetch()} />
      ) : null}

      <View style={styles.tabs}>
        {tabItems.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tab, selected && styles.tabActive]}>
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>{tab.label}</Text>
              <View style={[styles.tabCount, selected && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, selected && styles.tabCountTextActive]}>{tab.count}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {visibleRequests.map((request) => {
        const direction = requestDirection(request, currentUserId);
        const incoming = direction === "incoming";
        const outgoing = direction === "outgoing";
        const pending = request.status === "pending";
        const canRespond = pending && incoming;
        const label = requestPrimaryLabel(request, direction);
        const isThread = activeTab === "threads";
        return (
          <SurfaceCard key={request.id} style={isThread ? styles.compactRequestCard : undefined}>
            <View style={styles.requestTop}>
              <Badge tone={request.status === "accepted" ? "green" : request.status === "declined" || request.status === "blocked" ? "red" : "amber"}>
                {pending ? incoming ? "incoming" : outgoing ? "sent" : "pending" : request.status === "accepted" ? "thread ready" : request.status}
              </Badge>
              {request.created_at ? <Text style={styles.requestDate}>{new Date(request.created_at).toLocaleDateString("en-NG")}</Text> : null}
            </View>
            <View style={isThread ? styles.compactRequestBody : undefined}>
              <View style={styles.requestMain}>
                <Text style={styles.requestLabel}>{label.prefix}</Text>
                <Text style={styles.requestName}>{label.name}</Text>
                {label.handle ? <Text style={styles.requestHandle}>{label.handle}</Text> : null}
              </View>
              {request.channel_slug ? (
                <AppButton variant="secondary" onPress={() => router.push(`/(app)/chat/${encodeURIComponent(String(request.channel_slug))}`)} style={isThread ? styles.compactAction : undefined}>
                  Open thread
                </AppButton>
              ) : null}
            </View>
            {!isThread && pending && outgoing ? <Text style={styles.requestCopy}>Waiting for {label.name} to respond.</Text> : null}
            {!isThread && pending && incoming ? <Text style={styles.requestCopy}>{label.name} wants to start a direct message with you.</Text> : null}
            {!isThread && request.intro_message ? <Text style={styles.requestCopy}>{request.intro_message}</Text> : null}
            {!request.channel_slug && canRespond ? (
              <View style={styles.requestActions}>
                <AppButton loading={respondMutation.isPending} onPress={() => respondMutation.mutate({ requestId: request.id, response: "accepted" })} style={styles.actionGrow}>
                  Accept
                </AppButton>
                <AppButton variant="secondary" loading={respondMutation.isPending} onPress={() => respondMutation.mutate({ requestId: request.id, response: "declined" })} style={styles.actionGrow}>
                  Decline
                </AppButton>
              </View>
            ) : null}
          </SurfaceCard>
        );
      })}

      {!requestsQuery.isLoading && visibleRequests.length === 0 ? (
        <FeedbackState
          title={activeTab === "requests" ? "No requests waiting" : activeTab === "sent" ? "No sent requests" : "No accepted threads here"}
          body={
            activeTab === "requests"
              ? "Incoming DM requests will appear here when a player wants to chat."
              : activeTab === "sent"
                ? "Requests you send to other players will appear here until they respond."
                : "Accepted DM requests with open threads will appear here."
          }
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  backButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: "center"
  },
  backText: {
    color: colors.ink,
    fontWeight: "900"
  },
  title: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 24
  },
  sectionTitle: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 18,
    marginTop: spacing.sm
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    fontSize: 16,
    marginTop: spacing.sm
  },
  fieldHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 6
  },
  textarea: {
    minHeight: 92,
    paddingTop: spacing.md,
    textAlignVertical: "top"
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.sm
  },
  tab: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  tabActive: {
    borderColor: colors.navy,
    backgroundColor: colors.navy
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  tabTextActive: {
    color: colors.white
  },
  tabCount: {
    minWidth: 24,
    minHeight: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  tabCountActive: {
    backgroundColor: colors.green
  },
  tabCountText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900"
  },
  tabCountTextActive: {
    color: colors.navy
  },
  compactRequestCard: {
    gap: spacing.sm
  },
  compactRequestBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  requestTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  requestMain: {
    flex: 1,
    minWidth: 0
  },
  requestDate: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "900"
  },
  requestLabel: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: spacing.sm,
    textTransform: "uppercase"
  },
  requestName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3
  },
  requestHandle: {
    color: colors.faint,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2
  },
  requestCopy: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: 4
  },
  requestActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  actionGrow: {
    flex: 1
  },
  compactAction: {
    minWidth: 118
  }
});
