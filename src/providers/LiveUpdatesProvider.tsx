import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listNotifications, markNotificationRead } from "../api/notifications";
import { openRealtimeStream } from "../api/realtime";
import { colors, radius, shadow, spacing } from "../constants/theme";
import { useAuthStore } from "../store/auth-store";
import type {
  ChatAttachment,
  ChatChannel,
  ChatMediaResponse,
  ChatMessage,
  ChatMessagesResponse,
  ChatPresenceMember,
  ChatPresenceSummary,
  RealtimeEvent,
  UserNotification
} from "../types/api";

type LiveToastTone = "info" | "success" | "warning" | "danger";
type LiveToast = {
  id: string;
  title: string;
  body: string;
  tone: LiveToastTone;
};
type LiveUpdateContextValue = {
  pushToast: (toast: Omit<LiveToast, "id"> & { id?: string }) => void;
};

const LiveUpdateContext = createContext<LiveUpdateContextValue | null>(null);

export function useLiveUpdates() {
  const value = useContext(LiveUpdateContext);
  if (!value) throw new Error("useLiveUpdates must be used within LiveUpdatesProvider.");
  return value;
}

function textFromPayload(payload: Record<string, unknown> | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toastTone(type: string): LiveToastTone {
  if (type.includes("approved") || type.includes("completed") || type.includes("paid") || type.includes("registered") || type.includes("check")) return "success";
  if (type.includes("rejected") || type.includes("disputed") || type.includes("void") || type.includes("failed")) return "danger";
  if (type.includes("submitted") || type.includes("review") || type.includes("pending")) return "warning";
  return "info";
}

function titleForEvent(event: RealtimeEvent) {
  const payloadTitle = textFromPayload(event.payload, "title");
  if (payloadTitle) return payloadTitle;

  if (event.event_type.startsWith("match.funding")) return "Funding update";
  if (event.event_type.startsWith("match.result")) return "Result update";
  if (event.event_type.startsWith("wallet")) return "Wallet update";
  if (event.event_type.startsWith("tournament")) return "Tournament update";
  if (event.event_type.startsWith("chat")) return "New chat update";
  if (event.event_type.startsWith("community.livestream")) return "Stream update";
  if (event.event_type === "notification.created") return "New notification";
  return "Live update";
}

function bodyForEvent(event: RealtimeEvent) {
  const payloadBody = textFromPayload(event.payload, "body") ?? textFromPayload(event.payload, "description") ?? textFromPayload(event.payload, "message");
  if (payloadBody) return payloadBody;

  if (event.match_room_id) return "Refreshing the related room so the latest status appears.";
  if (event.tournament_id) return "Refreshing the related tournament so the latest status appears.";
  return "Refreshing Skillsroom data in the background.";
}

function notificationToToast(notification: UserNotification): LiveToast {
  return {
    id: `notification:${notification.id}`,
    title: notification.title || "New notification",
    body: notification.body || "A Skillsroom update is available.",
    tone: toastTone(notification.notification_type)
  };
}

function eventToToast(event: RealtimeEvent): LiveToast {
  return {
    id: `event:${event.id}`,
    title: titleForEvent(event),
    body: bodyForEvent(event),
    tone: toastTone(event.event_type)
  };
}

function shouldToastForEvent(event: RealtimeEvent) {
  const type = event.event_type;

  if (type === "notification.created" || type === "notification.read") return false;

  if (type.startsWith("chat.")) {
    return [
      "chat.message.mentioned",
      "chat.dm.request.created",
      "chat.dm.request.accepted",
      "chat.member.muted",
      "chat.message.hidden",
      "chat.message.deleted"
    ].includes(type);
  }

  if (type.includes("presence") || type.includes("typing") || type.includes("reaction") || type.endsWith(".read")) return false;

  return true;
}

function happenedBeforeSession(timestamp?: string | null, sessionStartedAt = Date.now()) {
  if (!timestamp) return false;
  const time = Date.parse(timestamp);
  if (Number.isNaN(time)) return false;
  return time < sessionStartedAt - 3_000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isChatMessage(value: unknown): value is ChatMessage {
  return isRecord(value) && typeof value.id === "string" && typeof value.channel_id === "string" && typeof value.body === "string";
}

function isChatAttachment(value: unknown): value is ChatAttachment {
  return isRecord(value) && typeof value.id === "string" && typeof value.channel_id === "string";
}

function mergeMessage(messages: ChatMessage[], message: ChatMessage) {
  const existingIndex = messages.findIndex((item) => item.id === message.id);
  const next = existingIndex >= 0
    ? messages.map((item) => item.id === message.id ? { ...item, ...message } : item)
    : [...messages, message];
  return next.sort((a, b) => {
    const time = String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
    return time !== 0 ? time : a.id.localeCompare(b.id);
  });
}

function replaceMessage(messages: ChatMessage[], message: ChatMessage) {
  return messages.map((item) => item.id === message.id ? { ...item, ...message } : item);
}

function upsertChannelMessageSummary(channel: ChatChannel, message: ChatMessage, currentUserId?: string | null) {
  const fromCurrentUser = Boolean(currentUserId && message.sender_user_id === currentUserId);
  return {
    ...channel,
    last_message_id: message.id,
    last_message_body: message.body,
    last_message_sender_label: message.sender_label ?? message.sender_display_name ?? message.sender_username ?? channel.last_message_sender_label,
    last_message_sender_user_id: message.sender_user_id ?? null,
    last_message_at: message.created_at ?? channel.last_message_at,
    unread_count: fromCurrentUser ? channel.unread_count ?? 0 : (channel.unread_count ?? 0) + 1
  };
}

function channelMatches(channel: ChatChannel | undefined, channelSlug?: string | null, channelId?: string | null) {
  if (!channel) return false;
  return Boolean((channelSlug && channel.slug === channelSlug) || (channelId && channel.id === channelId));
}

function patchMessageQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  channelSlug: string | null,
  channelId: string | null,
  updater: (response: ChatMessagesResponse) => ChatMessagesResponse
) {
  let patched = false;
  queryClient.setQueriesData<ChatMessagesResponse>({ queryKey: ["chat", "messages"] }, (current) => {
    if (!current || !channelMatches(current.channel, channelSlug, channelId)) return current;
    patched = true;
    return updater(current);
  });
  return patched;
}

function patchThreadQueries(queryClient: ReturnType<typeof useQueryClient>, message: ChatMessage) {
  queryClient.setQueriesData<Record<string, unknown>>({ queryKey: ["chat", "thread"] }, (current) => {
    if (!current) return current;
    const rootMessage = isChatMessage(current.root_message) && current.root_message.id === message.id ? message : current.root_message;
    const messages = Array.isArray(current.messages) ? current.messages.map((item) => isChatMessage(item) && item.id === message.id ? message : item) : current.messages;
    const replies = Array.isArray(current.replies) ? current.replies.map((item) => isChatMessage(item) && item.id === message.id ? message : item) : current.replies;
    return { ...current, root_message: rootMessage, messages, replies };
  });
}

function patchChannels(
  queryClient: ReturnType<typeof useQueryClient>,
  channelSlug: string | null,
  channelId: string | null,
  updater: (channel: ChatChannel) => ChatChannel
) {
  queryClient.setQueriesData<ChatChannel[]>({ queryKey: ["chat", "channels"] }, (current) =>
    current?.map((channel) => channelMatches(channel, channelSlug, channelId) ? updater(channel) : channel) ?? current
  );
  queryClient.setQueriesData<ChatChannel[]>({ queryKey: ["home", "channels"] }, (current) =>
    current?.map((channel) => channelMatches(channel, channelSlug, channelId) ? updater(channel) : channel) ?? current
  );
}

function patchPresence(
  queryClient: ReturnType<typeof useQueryClient>,
  channelSlug: string | null,
  channelId: string | null,
  updater: (presence: ChatPresenceSummary) => ChatPresenceSummary
) {
  if (channelSlug) {
    queryClient.setQueryData<ChatPresenceSummary>(["chat", "presence", channelSlug], (current) => current ? updater(current) : current);
  }
  patchMessageQueries(queryClient, channelSlug, channelId, (current) => ({
    ...current,
    presence: updater(current.presence ?? {})
  }));
}

function patchAttachmentInMessages(messages: ChatMessage[], attachment: ChatAttachment) {
  return messages.map((message) => {
    const attachments = message.attachments;
    if (!attachments?.some((item) => item.id === attachment.id)) return message;
    return { ...message, attachments: attachments.map((item) => item.id === attachment.id ? { ...item, ...attachment } : item) };
  });
}

function applyChatRealtimeEvent(queryClient: ReturnType<typeof useQueryClient>, event: RealtimeEvent, currentUserId?: string | null) {
  const type = event.event_type;
  const payload = event.payload ?? {};
  const channelSlug = textFromPayload(payload, "channel_slug");
  const channelId = textFromPayload(payload, "channel_id");

  if (type === "chat.message.created" || type === "chat.system_message.created") {
    const message = payload.message;
    if (!channelSlug || !isChatMessage(message)) return false;

    const patchedMessages = patchMessageQueries(queryClient, channelSlug, channelId, (current) => ({
      ...current,
      messages: mergeMessage(current.messages, message)
    }));
    patchThreadQueries(queryClient, message);
    patchChannels(queryClient, channelSlug, channelId, (channel) => upsertChannelMessageSummary(channel, message, currentUserId));
    if (!patchedMessages) {
      void queryClient.invalidateQueries({ queryKey: ["chat", "messages", channelSlug] });
    }
    return true;
  }

  if (type === "chat.message.reaction.changed" || type === "chat.message.updated" || type === "chat.poll.updated" || type === "chat.message.deleted" || type === "chat.message.hidden") {
    const message = payload.message;
    if (!channelSlug || !isChatMessage(message)) return false;

    patchMessageQueries(queryClient, channelSlug, channelId, (current) => ({
      ...current,
      messages: replaceMessage(current.messages, message),
      pinned_messages: Array.isArray(payload.pinned_messages) ? payload.pinned_messages as Array<Record<string, unknown>> : current.pinned_messages
    }));
    patchThreadQueries(queryClient, message);
    if (type === "chat.message.updated") {
      patchChannels(queryClient, channelSlug, channelId, (channel) => channel.last_message_id === message.id ? {
        ...channel,
        last_message_body: message.body,
        last_message_sender_label: message.sender_label ?? channel.last_message_sender_label
      } : channel);
    }
    if (type === "chat.message.deleted" || type === "chat.message.hidden") {
      patchChannels(queryClient, channelSlug, channelId, (channel) => channel.last_message_id === message.id ? {
        ...channel,
        last_message_body: message.body,
        last_message_sender_label: message.sender_label ?? channel.last_message_sender_label
      } : channel);
    }
    return true;
  }

  if (type === "chat.message.pinned" || type === "chat.message.unpinned") {
    const pinnedMessages = payload.pinned_messages;
    if (!channelSlug || !Array.isArray(pinnedMessages)) return false;
    patchMessageQueries(queryClient, channelSlug, channelId, (current) => ({
      ...current,
      pinned_messages: pinnedMessages as Array<Record<string, unknown>>
    }));
    return true;
  }

  if (type === "chat.attachment.updated") {
    const attachment = payload.attachment;
    if (!channelSlug || !isChatAttachment(attachment)) return false;
    patchMessageQueries(queryClient, channelSlug, channelId, (current) => ({
      ...current,
      messages: patchAttachmentInMessages(current.messages, attachment)
    }));
    queryClient.setQueriesData<ChatMediaResponse>({ queryKey: ["chat", "media"] }, (current) => {
      if (!current || !channelMatches(current.channel as ChatChannel | undefined, channelSlug, channelId)) return current;
      const media = current.media?.map((item) => item.id === attachment.id ? { ...item, ...attachment } : item);
      const attachments = current.attachments?.map((item) => item.id === attachment.id ? { ...item, ...attachment } : item);
      return { ...current, media, attachments };
    });
    return true;
  }

  if (type === "chat.typing.changed") {
    if (!channelSlug) return false;
    const typing = Array.isArray(payload.typing)
      ? payload.typing.filter((item): item is ChatPresenceMember => isRecord(item) && typeof item.user_id === "string")
      : [];
    const onlineCount = typeof payload.online_count === "number" ? payload.online_count : undefined;
    patchPresence(queryClient, channelSlug, channelId, (presence) => ({
      ...presence,
      typing,
      online_count: onlineCount ?? presence.online_count
    }));
    if (typeof onlineCount === "number") {
      patchChannels(queryClient, channelSlug, channelId, (channel) => ({ ...channel, online_count: onlineCount }));
    }
    return true;
  }

  if (type === "chat.presence.changed") {
    if (!channelSlug || typeof payload.online_count !== "number") return false;
    patchPresence(queryClient, channelSlug, channelId, (presence) => ({
      ...presence,
      online_count: payload.online_count as number
    }));
    patchChannels(queryClient, channelSlug, channelId, (channel) => ({ ...channel, online_count: payload.online_count as number }));
    return true;
  }

  if (type === "chat.channel.read") {
    if (!channelSlug) return false;
    const lastReadAt = textFromPayload(payload, "last_read_at");
    patchChannels(queryClient, channelSlug, channelId, (channel) => ({
      ...channel,
      unread_count: 0,
      membership_last_read_at: lastReadAt ?? channel.membership_last_read_at
    }));
    patchMessageQueries(queryClient, channelSlug, channelId, (current) => ({
      ...current,
      read_boundary: lastReadAt ?? current.read_boundary
    }));
    return true;
  }

  if (type === "chat.channel.controls.updated") {
    if (!channelSlug) return false;
    const controls = {
      slow_mode_seconds: typeof payload.slow_mode_seconds === "number" ? payload.slow_mode_seconds : undefined,
      lockdown_until: typeof payload.lockdown_until === "string" ? payload.lockdown_until : null,
      lockdown_reason: typeof payload.lockdown_reason === "string" ? payload.lockdown_reason : null
    };
    patchChannels(queryClient, channelSlug, channelId, (channel) => ({ ...channel, ...controls }));
    queryClient.setQueriesData<Record<string, unknown>>({ queryKey: ["chat", "controls"] }, (current) => current ? { ...current, ...controls } : current);
    return true;
  }

  return false;
}

function chatEventMayChangeNotifications(type: string) {
  return [
    "chat.message.mentioned",
    "chat.dm.request.created",
    "chat.dm.request.accepted",
    "chat.member.muted"
  ].includes(type);
}

function invalidateForEvent(queryClient: ReturnType<typeof useQueryClient>, event: RealtimeEvent, currentUserId?: string | null) {
  const type = event.event_type;
  const payloadRoomId = textFromPayload(event.payload, "match_room_id") ?? textFromPayload(event.payload, "matchRoomId") ?? event.match_room_id;
  const payloadTournamentId = textFromPayload(event.payload, "tournament_id") ?? textFromPayload(event.payload, "tournamentId") ?? event.tournament_id;

  if (type.startsWith("match.") || payloadRoomId) {
    void queryClient.invalidateQueries({ queryKey: ["rooms"] });
    if (payloadRoomId) void queryClient.invalidateQueries({ queryKey: ["room", payloadRoomId] });
  }

  if (type.startsWith("wallet") || type.includes("funding") || type.includes("payout") || type.includes("refund") || type.includes("topup")) {
    void queryClient.invalidateQueries({ queryKey: ["wallet"] });
  }

  if (type.startsWith("tournament") || payloadTournamentId) {
    void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    if (payloadTournamentId) void queryClient.invalidateQueries({ queryKey: ["tournaments", "detail", payloadTournamentId] });
  }

  if (type.startsWith("chat.")) {
    const handled = applyChatRealtimeEvent(queryClient, event, currentUserId);
    if (handled) {
      if (chatEventMayChangeNotifications(type)) {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        void queryClient.invalidateQueries({ queryKey: ["home"] });
      }
      return;
    }
    if (type === "chat.presence.changed" || type === "chat.typing.changed") {
      void queryClient.invalidateQueries({ queryKey: ["chat", "presence"] });
    } else if (type === "chat.message.reaction.changed") {
      void queryClient.invalidateQueries({ queryKey: ["chat", "messages"] });
    } else if (type === "chat.channel.read") {
      void queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
    } else {
      void queryClient.invalidateQueries({ queryKey: ["chat", "messages"] });
      void queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
      void queryClient.invalidateQueries({ queryKey: ["chat", "media"] });
    }
  }

  if (type.startsWith("community.livestream")) {
    void queryClient.invalidateQueries({ queryKey: ["room"] });
    void queryClient.invalidateQueries({ queryKey: ["tournaments", "streams"] });
  }

  void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  void queryClient.invalidateQueries({ queryKey: ["home"] });
}

function invalidateForNotification(queryClient: ReturnType<typeof useQueryClient>, notification: UserNotification) {
  const metadataRoomId = typeof notification.metadata?.match_room_id === "string" ? notification.metadata.match_room_id : null;
  const metadataTournamentId = typeof notification.metadata?.tournament_id === "string" ? notification.metadata.tournament_id : null;
  const roomId = notification.match_room_id ?? metadataRoomId;
  const tournamentId = metadataTournamentId;

  if (roomId || notification.notification_type.includes("match")) {
    void queryClient.invalidateQueries({ queryKey: ["rooms"] });
    if (roomId) void queryClient.invalidateQueries({ queryKey: ["room", roomId] });
  }
  if (tournamentId || notification.notification_type.includes("tournament")) {
    void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    if (tournamentId) void queryClient.invalidateQueries({ queryKey: ["tournaments", "detail", tournamentId] });
  }
  if (notification.notification_type.includes("wallet") || notification.notification_type.includes("topup") || notification.notification_type.includes("payout")) {
    void queryClient.invalidateQueries({ queryKey: ["wallet"] });
  }
  void queryClient.invalidateQueries({ queryKey: ["home"] });
}

export function LiveUpdatesProvider({ children }: { children: ReactNode }) {
  const isSignedIn = useAuthStore((state) => state.isSignedIn);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<LiveToast[]>([]);
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const seenEventIds = useRef<Set<string>>(new Set());
  const notificationBaselineReady = useRef(false);
  const sessionStartedAt = useRef(Date.now());

  const pushToast = useCallback((toast: Omit<LiveToast, "id"> & { id?: string }) => {
    const id = toast.id ?? `toast:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [{ id, title: toast.title, body: toast.body, tone: toast.tone }, ...current.filter((item) => item.id !== id)].slice(0, 1));
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const notificationsQuery = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => listNotifications("unread"),
    enabled: isSignedIn,
    refetchInterval: 12_000
  });

  useEffect(() => {
    if (isSignedIn) {
      sessionStartedAt.current = Date.now();
      return;
    }

    notificationBaselineReady.current = false;
    seenNotificationIds.current.clear();
    seenEventIds.current.clear();
    setToasts([]);
  }, [isSignedIn]);

  useEffect(() => {
    if (!notificationsQuery.data) return;

    if (!notificationBaselineReady.current) {
      notificationsQuery.data.forEach((notification) => {
        seenNotificationIds.current.add(notification.id);
      });
      notificationBaselineReady.current = true;
      return;
    }

    notificationsQuery.data.forEach((notification) => {
      if (seenNotificationIds.current.has(notification.id)) return;
      seenNotificationIds.current.add(notification.id);
      invalidateForNotification(queryClient, notification);
      if (!happenedBeforeSession(notification.created_at, sessionStartedAt.current)) {
        pushToast(notificationToToast(notification));
      }
    });
  }, [notificationsQuery.data, pushToast, queryClient]);

  useEffect(() => {
    if (!isSignedIn) return;

    let cleanup: (() => void) | null = null;
    let cancelled = false;

    void openRealtimeStream({
      onReady: () => {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        void queryClient.invalidateQueries({ queryKey: ["home"] });
      },
      onEvent: (rawEvent) => {
        const event = rawEvent as RealtimeEvent;
        if (!event.id || !event.event_type || seenEventIds.current.has(event.id)) return;
        seenEventIds.current.add(event.id);
        invalidateForEvent(queryClient, event, currentUserId);
        if (shouldToastForEvent(event) && !happenedBeforeSession(event.created_at, sessionStartedAt.current)) {
          pushToast(eventToToast(event));
        }
      },
      onError: (error) => {
        if (error.status === 401 || error.status === 403) {
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void queryClient.invalidateQueries({ queryKey: ["home"] });
        }
      }
    }).then((stream) => {
      if (cancelled) {
        stream?.close();
        return;
      }
      cleanup = stream?.close ?? null;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [currentUserId, isSignedIn, pushToast, queryClient]);

  useEffect(() => {
    if (!toasts.length) return;
    const timeout = setTimeout(() => setToasts((current) => current.slice(0, Math.max(0, current.length - 1))), 6500);
    return () => clearTimeout(timeout);
  }, [toasts]);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <LiveUpdateContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.toastWrap, { top: insets.top + spacing.sm }]}>
        {toasts.map((toast) => (
          <Pressable key={toast.id} onPress={() => dismissToast(toast.id)} style={[styles.toast, styles[toast.tone]]}>
            <Text style={styles.toastTitle}>{toast.title}</Text>
            <Text style={styles.toastBody}>{toast.body}</Text>
          </Pressable>
        ))}
      </View>
    </LiveUpdateContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: "absolute",
    top: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    gap: spacing.sm,
    zIndex: 1000,
    elevation: 1000
  },
  toast: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadow.card
  },
  info: {
    backgroundColor: colors.cyanSoft,
    borderColor: "#aeefff"
  },
  success: {
    backgroundColor: colors.greenSoft,
    borderColor: "#b6f4db"
  },
  warning: {
    backgroundColor: colors.amberSoft,
    borderColor: "#ffdf9d"
  },
  danger: {
    backgroundColor: colors.redSoft,
    borderColor: "#ffc6d0"
  },
  toastTitle: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 14
  },
  toastBody: {
    color: colors.muted,
    lineHeight: 18,
    marginTop: 3
  }
});
