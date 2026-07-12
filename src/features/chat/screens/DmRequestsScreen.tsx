import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { createDmRequest, listDmRequests, respondDmRequest } from "../../../api/chat";
import { plainApiError } from "../../../api/errors";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, spacing } from "../../../constants/theme";
import type { ChatDmRequest } from "../../../types/api";

function peerName(request: ChatDmRequest) {
  return request.peer_label ?? request.requester_label ?? request.recipient_label ?? request.peer_username ?? "Player";
}

export function DmRequestsScreen() {
  const queryClient = useQueryClient();
  const [recipient, setRecipient] = useState("");
  const [intro, setIntro] = useState("");
  const [notice, setNotice] = useState<{ tone: "error" | "success" | "info"; message: string } | null>(null);

  const requestsQuery = useQuery({ queryKey: ["chat", "dm-requests"], queryFn: listDmRequests, refetchInterval: 30000 });
  const requests = requestsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: () => {
      const username = recipient.trim().replace(/^@/, "");
      if (!username) throw new Error("Enter a Skillsroom username.");
      return createDmRequest({ recipient_username: username, intro_message: intro.trim() || undefined });
    },
    onSuccess: async () => {
      setNotice({ tone: "success", message: "DM request sent." });
      setRecipient("");
      setIntro("");
      await queryClient.invalidateQueries({ queryKey: ["chat", "dm-requests"] });
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Could not send DM request.") })
  });

  const respondMutation = useMutation({
    mutationFn: ({ requestId, response }: { requestId: string; response: "accepted" | "declined" }) => respondDmRequest(requestId, response),
    onSuccess: async (result) => {
      setNotice({ tone: "success", message: result.channel ? "DM accepted. Thread is ready." : "DM request updated." });
      await queryClient.invalidateQueries({ queryKey: ["chat", "dm-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Could not update DM request.") })
  });

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>DM Requests</Text>
      </View>

      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

      <SurfaceCard>
        <Badge tone="green">Start DM</Badge>
        <Text style={styles.sectionTitle}>Request a player chat</Text>
        <TextInput value={recipient} onChangeText={setRecipient} autoCapitalize="none" placeholder="Username" placeholderTextColor={colors.faint} style={styles.input} />
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

      {requests.map((request) => (
        <SurfaceCard key={request.id}>
          <Badge tone={request.status === "accepted" ? "green" : request.status === "declined" ? "red" : "amber"}>{request.status}</Badge>
          <Text style={styles.requestName}>{peerName(request)}</Text>
          {request.intro_message ? <Text style={styles.requestCopy}>{request.intro_message}</Text> : null}
          {request.channel_slug ? (
            <AppButton variant="secondary" onPress={() => router.push(`/(app)/chat/${encodeURIComponent(String(request.channel_slug))}`)}>
              Open thread
            </AppButton>
          ) : request.status === "pending" ? (
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
      ))}

      {!requestsQuery.isLoading && requests.length === 0 ? <FeedbackState title="No requests" body="Incoming and sent DM requests will appear here." /> : null}
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
  textarea: {
    minHeight: 92,
    paddingTop: spacing.md,
    textAlignVertical: "top"
  },
  requestName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: spacing.sm
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
  }
});
