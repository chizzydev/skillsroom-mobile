import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Info,
  Megaphone,
  Search,
  X
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { ListRenderItemInfo, ViewToken } from "react-native";
import {
  absoluteChatMediaUrl,
  bookmarkChatMessage,
  cancelScheduledChatAnnouncement,
  createChatPoll,
  deleteChatMessage,
  getChatAttachmentAccess,
  getChatChannelControls,
  getChatMessageDetail,
  getChatThread,
  listChannels,
  listChatMedia,
  listChatMessages,
  listChatPresence,
  listDmRequests,
  listScheduledChatAnnouncements,
  markChatRead,
  pinChatMessage,
  reactChatMessage,
  reportChatMessage,
  searchChatMessages,
  sendChatHeartbeat,
  sendChatMessage,
  setChatTyping,
  scheduleChatAnnouncement,
  updateChatChannelModerationControls,
  updateChatNotificationControls,
  voteChatPoll,
  uploadChatAttachment
} from "../../../api/chat";
import { plainApiError } from "../../../api/errors";
import { AppScreen } from "../../../components/screen/AppScreen";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { colors, radius, spacing } from "../../../constants/theme";
import { useAuthStore } from "../../../store/auth-store";
import type { ChatAttachment, ChatChannel, ChatDmRequest, ChatMessage, ChatMessagesResponse, ChatNotificationLevel, ChatPresenceMember } from "../../../types/api";
import { ChatComposer } from "../components/ChatComposer";
import type { PendingAttachment } from "../components/ChatComposer";
import { ChatMessageBubble } from "../components/ChatMessageBubble";
import type { MessageAction } from "../components/ChatMessageBubble";

const chatBg = "#111f2c";
const chatPanel = "#1c2b3a";
const chatPanelSoft = "#233446";
const chatLine = "#31465a";
const chatMuted = "#a9b6c4";
const chatCyan = "#47c7ef";
const chatGreen = "#19c58b";

const reactionOptions = [
  { value: "like", label: "ðŸ‘" },
  { value: "gg", label: "GG" },
  { value: "fire", label: "ðŸ”¥" },
  { value: "clap", label: "ðŸ‘" },
  { value: "trophy", label: "ðŸ†" },
  { value: "heart", label: "â¤ï¸" },
  { value: "laugh", label: "ðŸ˜‚" },
  { value: "wow", label: "ðŸ˜®" },
  { value: "sad", label: "ðŸ˜¢" },
  { value: "angry", label: "ðŸ˜¡" },
  { value: "hundred", label: "ðŸ’¯" },
  { value: "game", label: "ðŸŽ®" }
];

const slowModeOptions = [0, 10, 30, 60, 300, 900, 3600];
const lockdownOptions = [30, 60, 240, 1440];

const supportedDocumentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain"
];


type InfoTab = "members" | "dms" | "channels" | "media" | "pins" | "settings";

function mimeFromName(name?: string | null) {
  const extension = name?.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "pdf") return "application/pdf";
  if (extension === "doc") return "application/msword";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "odt") return "application/vnd.oasis.opendocument.text";
  if (extension === "txt") return "text/plain";
  return null;
}

function titleFor(channel?: ChatChannel) {
  if (!channel) return "Chat";
  if (channel.channel_type === "dm") return channel.dm_peer_label ?? channel.dm_peer_display_name ?? channel.title;
  if (channel.slug === "global_lobby") return "Global Chat";
  return channel.title ?? channel.slug;
}

function initialsFor(value?: string | null) {
  const text = value?.trim() || "SR";
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return text.slice(0, 3).toUpperCase();
}

function channelTarget(channel: ChatChannel) {
  return channel.slug || channel.id;
}

function channelMatchesTarget(channel: ChatChannel, target: string) {
  return channel.id === target || channel.slug === target || channelTarget(channel) === target;
}

function channelKind(channel: ChatChannel) {
  if (channel.channel_type === "dm") return "DM";
  if (channel.slug === "global_lobby") return "Chat";
  return channel.channel_type.replaceAll("_", " ");
}

function channelPreview(channel: ChatChannel) {
  if (channel.last_message_body) {
    return `${channelKind(channel)} / ${channel.online_count ?? 0} online / ${channel.last_message_sender_label ? `${channel.last_message_sender_label}: ` : ""}${channel.last_message_body}`;
  }
  if (channel.description) return `${channelKind(channel)} / ${channel.online_count ?? 0} online / ${channel.description}`;
  return `${channelKind(channel)} / ${channel.online_count ?? 0} online`;
}

function requestPeer(request: ChatDmRequest) {
  return request.peer_label ?? request.requester_label ?? request.recipient_label ?? request.peer_username ?? "Player";
}

function byteLabel(bytes?: number) {
  if (!bytes) return "Unknown size";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Later";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isImageAttachment(attachment: ChatAttachment) {
  return attachment.attachment_type === "image" || String(attachment.mime_type ?? "").startsWith("image/");
}

function memberLabel(member: Record<string, unknown>) {
  return String(member.display_name ?? member.username ?? member.label ?? member.user_label ?? "Player");
}

function memberHandle(member: Record<string, unknown>) {
  const username = member.username ?? member.user_username;
  return username ? `@${String(username)}` : "@skillsroom";
}

function memberStatus(member: Record<string, unknown>) {
  const online = Boolean(member.online ?? member.is_online);
  const status = String(member.status ?? (online ? "online" : "recent"));
  return online || status === "online" ? "online" : "recent";
}

function presenceMembers(summary?: { active?: ChatPresenceMember[]; members?: ChatPresenceMember[] }) {
  return summary?.active ?? summary?.members ?? [];
}

function typingLabels(summary: { typing?: ChatPresenceMember[] } | undefined, currentUserId?: string) {
  return (summary?.typing ?? [])
    .filter((member) => member.user_id !== currentUserId)
    .map((member) => member.label ?? member.display_name ?? member.username ?? "Player")
    .filter(Boolean)
    .slice(0, 3)
    .map(String);
}

function sortMessages(messages: ChatMessage[]) {
  return [...messages].sort((a, b) => {
    const byTime = String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
  });
}

function mergeMessagePages(messages: ChatMessage[]) {
  const byId = new Map<string, ChatMessage>();
  messages.forEach((message) => {
    const existing = byId.get(message.id);
    byId.set(message.id, existing ? { ...existing, ...message } : message);
  });
  return sortMessages(Array.from(byId.values()));
}

function mergeCachedMessage(messages: ChatMessage[], message: ChatMessage) {
  const existing = messages.find((item) => item.id === message.id || (message.client_message_id && item.client_message_id === message.client_message_id));
  if (!existing) return sortMessages([...messages, message]);
  return sortMessages(messages.map((item) => item.id === existing.id ? { ...item, ...message } : item));
}

function replaceCachedMessage(messages: ChatMessage[], message: ChatMessage) {
  return messages.map((item) => item.id === message.id ? { ...item, ...message } : item);
}

function needsMessageDetailHydration(message: ChatMessage) {
  if (message.view !== "list") return false;
  if ((message.attachments?.length ?? 0) > 0 || message.poll) return false;
  return Boolean(message.has_attachments || message.has_poll);
}

export function ChatThreadScreen() {
  const { channelId } = useLocalSearchParams<{ channelId?: string }>();
  const target = typeof channelId === "string" ? decodeURIComponent(channelId) : "";
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id;
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 35, minimumViewTime: 120 });
  const hydratedMessageIdsRef = useRef(new Set<string>());
  const hydratingMessageIdsRef = useRef(new Set<string>());
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState<{ tone: "error" | "success" | "info"; message: string } | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [threadMessage, setThreadMessage] = useState<ChatMessage | null>(null);
  const [reportMessageTarget, setReportMessageTarget] = useState<ChatMessage | null>(null);
  const [deleteMessageTarget, setDeleteMessageTarget] = useState<ChatMessage | null>(null);
  const [preview, setPreview] = useState<{ url: string; title: string; image: boolean } | null>(null);
  const [olderMessages, setOlderMessages] = useState<ChatMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);

  const messagesQuery = useQuery({
    queryKey: ["chat", "messages", target],
    queryFn: () => listChatMessages(target, { limit: 80, view: "list" }),
    enabled: Boolean(target),
    refetchInterval: 30000
  });

  const channelsQuery = useQuery({
    queryKey: ["chat", "channels"],
    queryFn: listChannels,
    enabled: showInfo,
    refetchInterval: 30000
  });

  const dmRequestsQuery = useQuery({
    queryKey: ["chat", "dm-requests"],
    queryFn: listDmRequests,
    enabled: showInfo,
    refetchInterval: 15000
  });

  const presenceQuery = useQuery({
    queryKey: ["chat", "presence", target],
    queryFn: () => listChatPresence(target),
    enabled: Boolean(target),
    refetchInterval: 15000
  });

  const mediaQuery = useQuery({
    queryKey: ["chat", "media", target],
    queryFn: () => listChatMedia(target, { limit: 24 }),
    enabled: Boolean(target) && showInfo,
    refetchInterval: 20000
  });

  const scheduledQuery = useQuery({
    queryKey: ["chat", "scheduled-announcements", target],
    queryFn: () => listScheduledChatAnnouncements(target),
    enabled: Boolean(target && ["admin", "owner"].includes(String(currentUser?.role ?? "")) && showInfo),
    refetchInterval: 30000
  });

  const controlsQuery = useQuery({
    queryKey: ["chat", "controls", target],
    queryFn: () => getChatChannelControls(target),
    enabled: Boolean(target) && showInfo,
    refetchInterval: 20000
  });

  const threadQuery = useQuery({
    queryKey: ["chat", "thread", target, threadMessage?.id],
    queryFn: () => getChatThread(target, threadMessage!.id),
    enabled: Boolean(target && threadMessage?.id)
  });

  const channel = messagesQuery.data?.channel;
  const title = titleFor(channel);
  const newestMessages = useMemo(() => sortMessages(messagesQuery.data?.messages ?? []), [messagesQuery.data?.messages]);
  const messages = useMemo(() => mergeMessagePages([...olderMessages, ...newestMessages]), [newestMessages, olderMessages]);
  const listMessages = useMemo(() => [...messages].reverse(), [messages]);
  const pinnedMessages = useMemo(() => {
    const fromResponse = messagesQuery.data?.pinned_messages ?? [];
    return fromResponse.filter(Boolean) as ChatMessage[];
  }, [messagesQuery.data?.pinned_messages]);
  const lastMessageId = messages[messages.length - 1]?.id;
  const onlineCount = presenceQuery.data?.online_count ?? messagesQuery.data?.presence?.online_count ?? channel?.online_count ?? 0;
  const livePresence = presenceQuery.data ?? messagesQuery.data?.presence;
  const liveTypingLabels = typingLabels(livePresence, currentUserId);
  const summary = channel?.channel_type === "dm"
    ? "Direct message"
    : `${onlineCount} online / ${channelsQuery.data?.length ?? "?"} channels`;

  useEffect(() => {
    setOlderMessages([]);
    setOlderCursor(null);
    setHasOlderMessages(false);
    setOlderLoading(false);
    setOlderError(null);
  }, [target]);

  useEffect(() => {
    if (olderMessages.length > 0 || olderLoading) return;
    const pageInfo = messagesQuery.data?.page_info;
    setOlderCursor(pageInfo?.older_cursor ?? null);
    setHasOlderMessages(Boolean(pageInfo?.has_older && pageInfo.older_cursor));
  }, [messagesQuery.data?.page_info, olderLoading, olderMessages.length]);

  useEffect(() => {
    if (!target || !lastMessageId) return;
    void markChatRead(target, lastMessageId).then(() => {
      queryClient.setQueriesData<ChatChannel[]>({ queryKey: ["chat", "channels"] }, (current) =>
        current?.map((item) => channelMatchesTarget(item, target) ? { ...item, unread_count: 0 } : item) ?? current
      );
    }).catch(() => undefined);
  }, [lastMessageId, queryClient, target]);

  useEffect(() => {
    if (!target) return;
    void sendChatHeartbeat(target).catch(() => undefined);
    const handle = setInterval(() => {
      void sendChatHeartbeat(target).catch(() => undefined);
    }, 45000);
    return () => clearInterval(handle);
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const text = body.trim();
    if (!text) {
      void setChatTyping(target, false).catch(() => undefined);
      return;
    }
    const handle = setTimeout(() => {
      void setChatTyping(target, true).catch(() => undefined);
    }, 350);
    return () => clearTimeout(handle);
  }, [body, target]);

  const sendMutation = useMutation({
    mutationFn: () => {
      const text = body.trim();
      const attachmentIds = pendingAttachments.filter((attachment) => attachment.state === "ready" && attachment.attachment).map((attachment) => attachment.attachment!.id);
      if (!text && attachmentIds.length === 0) throw new Error("Write a message or add an attachment before sending.");
      if (pendingAttachments.some((attachment) => attachment.state === "uploading")) throw new Error("Wait for attachments to finish uploading.");
      return sendChatMessage(target, { body: text, client_message_id: `mobile:${Date.now()}`, reply_to_message_id: replyTo?.id, attachment_ids: attachmentIds });
    },
    onSuccess: (data) => {
      setBody("");
      setReplyTo(null);
      setPendingAttachments([]);
      setNotice(null);
      void setChatTyping(target, false).catch(() => undefined);
      queryClient.setQueryData<ChatMessagesResponse>(["chat", "messages", target], (current) =>
        current ? { ...current, messages: mergeCachedMessage(current.messages, data.message) } : current
      );
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Could not send message.") })
  });

  const uploadMutation = useMutation({
    mutationFn: (input: { uri: string; name: string; mimeType: string; localId: string }) =>
      uploadChatAttachment(target, { uri: input.uri, name: input.name, mimeType: input.mimeType }).then((attachment) => ({ attachment, localId: input.localId })),
    onSuccess: ({ attachment, localId }) => {
      setPendingAttachments((current) => current.map((item) => item.localId === localId ? { ...item, attachment, state: "ready", error: undefined } : item));
      setNotice(null);
    },
    onError: (error, variables) => {
      setPendingAttachments((current) => current.map((item) => item.localId === variables.localId ? { ...item, state: "failed", error: plainApiError(error, "Attachment upload failed.") } : item));
    }
  });

  const reactMutation = useMutation({
    mutationFn: ({ messageId, reaction }: { messageId: string; reaction: string }) => reactChatMessage(target, messageId, reaction),
    onSuccess: (data) => {
      queryClient.setQueryData<ChatMessagesResponse>(["chat", "messages", target], (current) =>
        current ? { ...current, messages: replaceCachedMessage(current.messages, data.message) } : current
      );
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Reaction could not be saved.") })
  });
  const reactMessage = reactMutation.mutate;
  const reactingMessageId = reactMutation.isPending ? reactMutation.variables?.messageId ?? null : null;

  const messageActionMutation = useMutation({
    mutationFn: async (input: { action: MessageAction; message: ChatMessage; reason?: string }) => {
      if (input.action === "bookmark") return bookmarkChatMessage(target, input.message.id);
      if (input.action === "pin") return pinChatMessage(target, input.message.id, 168);
      if (input.action === "report") return reportChatMessage(target, input.message.id, input.reason ?? "Reported from mobile app.");
      return deleteChatMessage(target, input.message.id, input.reason);
    },
    onSuccess: (data, variables) => {
      const label = variables.action === "bookmark" ? "Bookmark updated." : variables.action === "pin" ? "Message pinned." : variables.action === "report" ? "Report submitted." : "Message deleted.";
      setNotice({ tone: "success", message: label });
      setReportMessageTarget(null);
      setDeleteMessageTarget(null);
      const maybeMessage = data && typeof data === "object" && "message" in data ? data.message : undefined;
      if (maybeMessage) {
        queryClient.setQueryData<ChatMessagesResponse>(["chat", "messages", target], (current) =>
          current ? { ...current, messages: replaceCachedMessage(current.messages, maybeMessage as ChatMessage) } : current
        );
      }
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Message action could not be completed.") })
  });
  const runMessageAction = messageActionMutation.mutate;

  const pollMutation = useMutation({
    mutationFn: (input: { question: string; options: string[]; allow_multiple?: boolean; closes_at?: string }) => createChatPoll(target, input),
    onSuccess: (data) => {
      setNotice({ tone: "success", message: "Poll posted." });
      queryClient.setQueryData<ChatMessagesResponse>(["chat", "messages", target], (current) =>
        current ? { ...current, messages: mergeCachedMessage(current.messages, data.message) } : current
      );
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Poll could not be posted.") })
  });

  const pollVoteMutation = useMutation({
    mutationFn: (input: { messageId: string; optionIds: string[] }) => voteChatPoll(target, input.messageId, input.optionIds),
    onSuccess: (data) => {
      setNotice(null);
      queryClient.setQueryData<ChatMessagesResponse>(["chat", "messages", target], (current) =>
        current ? { ...current, messages: replaceCachedMessage(current.messages, data.message) } : current
      );
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Poll vote could not be saved.") })
  });
  const votePoll = pollVoteMutation.mutate;
  const pollVoteMessageId = pollVoteMutation.isPending ? pollVoteMutation.variables?.messageId ?? null : null;

  const scheduleMutation = useMutation({
    mutationFn: (input: { body: string; scheduled_for: string }) => scheduleChatAnnouncement(target, input),
    onSuccess: async () => {
      setNotice({ tone: "success", message: "Announcement scheduled." });
      await queryClient.invalidateQueries({ queryKey: ["chat", "scheduled-announcements", target] });
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Announcement could not be scheduled.") })
  });

  function addUploadingAttachment(input: { uri: string; name: string; mimeType: string }) {
    if (pendingAttachments.length >= 4) {
      setNotice({ tone: "error", message: "You can add up to 4 attachments to one message." });
      return;
    }

    const localId = `mobile-attachment:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    setPendingAttachments((current) => [...current, { localId, name: input.name, state: "uploading" }]);
    uploadMutation.mutate({ ...input, localId });
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNotice({ tone: "error", message: "Allow photo access to choose an image." });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.88,
      allowsMultipleSelection: false
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? mimeFromName(asset.fileName ?? asset.uri);
    if (!mimeType) {
      setNotice({ tone: "error", message: "Choose a JPG, PNG, or WEBP image." });
      return;
    }
    addUploadingAttachment({ uri: asset.uri, name: asset.fileName ?? "chat-image", mimeType });
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: supportedDocumentTypes,
      copyToCacheDirectory: true,
      multiple: false
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? mimeFromName(asset.name);
    if (!mimeType) {
      setNotice({ tone: "error", message: "Choose a supported image, PDF, DOC, DOCX, ODT, or TXT file." });
      return;
    }
    addUploadingAttachment({ uri: asset.uri, name: asset.name, mimeType });
  }

  const loadOlderMessages = useCallback(async () => {
    if (!target || !hasOlderMessages || !olderCursor || olderLoading || messagesQuery.isLoading) return;
    try {
      setOlderLoading(true);
      setOlderError(null);
      const page = await listChatMessages(target, { cursor: olderCursor, limit: 80, view: "list" });
      setOlderMessages((current) => mergeMessagePages([...page.messages, ...current]));
      setOlderCursor(page.page_info?.older_cursor ?? null);
      setHasOlderMessages(Boolean(page.page_info?.has_older && page.page_info.older_cursor));
    } catch (error) {
      setOlderError(plainApiError(error, "Could not load older messages."));
    } finally {
      setOlderLoading(false);
    }
  }, [hasOlderMessages, messagesQuery.isLoading, olderCursor, olderLoading, target]);

  const hydrateMessageDetail = useCallback(async (message: ChatMessage) => {
    if (!target || !needsMessageDetailHydration(message)) return;
    if (hydratedMessageIdsRef.current.has(message.id) || hydratingMessageIdsRef.current.has(message.id)) return;

    hydratingMessageIdsRef.current.add(message.id);
    try {
      const detail = await getChatMessageDetail(target, message.id, { include: ["attachments", "poll", "thread"] });
      hydratedMessageIdsRef.current.add(message.id);
      queryClient.setQueryData<ChatMessagesResponse>(["chat", "messages", target], (current) =>
        current ? { ...current, messages: replaceCachedMessage(current.messages, detail.message) } : current
      );
      setOlderMessages((current) => replaceCachedMessage(current, detail.message));
      setThreadMessage((current) => current?.id === detail.message.id ? { ...current, ...detail.message } : current);
    } catch {
      hydratedMessageIdsRef.current.delete(message.id);
    } finally {
      hydratingMessageIdsRef.current.delete(message.id);
    }
  }, [queryClient, target]);

  const handleViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<ChatMessage>[] }) => {
    viewableItems.forEach((entry) => {
      if (entry.item) void hydrateMessageDetail(entry.item);
    });
  }, [hydrateMessageDetail]);
  const handleReactMessage = useCallback((messageId: string, reaction: string) => {
    reactMessage({ messageId, reaction });
  }, [reactMessage]);

  const handleReplyMessage = useCallback((message: ChatMessage) => {
    setReplyTo(message);
  }, []);

  const handleThreadMessage = useCallback((message: ChatMessage) => {
    setThreadMessage(message);
  }, []);

  const handleMessageAction = useCallback((action: MessageAction, message: ChatMessage) => {
    if (action === "report") {
      setReportMessageTarget(message);
      return;
    }
    if (action === "delete") {
      setDeleteMessageTarget(message);
      return;
    }
    runMessageAction({ action, message });
  }, [runMessageAction]);

  const handleVotePoll = useCallback((messageId: string, optionIds: string[]) => {
    votePoll({ messageId, optionIds });
  }, [votePoll]);

  const renderMessage = useCallback(({ item: message }: ListRenderItemInfo<ChatMessage>) => (
    <ChatMessageBubble
      channelId={target}
      message={message}
      isMine={Boolean(currentUserId && message.sender_user_id === currentUserId)}
      reacting={reactingMessageId === message.id}
      onReact={handleReactMessage}
      onReply={handleReplyMessage}
      onThread={handleThreadMessage}
      onMessageAction={handleMessageAction}
      onVotePoll={handleVotePoll}
      votingPoll={pollVoteMessageId === message.id}
      onPreview={setPreview}
    />
  ), [currentUserId, handleMessageAction, handleReactMessage, handleReplyMessage, handleThreadMessage, handleVotePoll, pollVoteMessageId, reactingMessageId, target]);

  return (
    <AppScreen scroll={false}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <IconButton label="Back" onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2.7} />
          </IconButton>
          <Pressable accessibilityLabel="Open channel details" onPress={() => setShowInfo(true)} style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsFor(title)}</Text>
          </Pressable>
          <Pressable accessibilityLabel="Open channel details" onPress={() => setShowInfo(true)} style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{summary}</Text>
          </Pressable>
          <IconButton label="Search" onPress={() => setShowSearch(true)}>
            <Search size={20} color={colors.white} strokeWidth={2.7} />
          </IconButton>
          <IconButton label="Info" onPress={() => setShowInfo(true)}>
            <Info size={20} color={colors.white} strokeWidth={2.7} />
          </IconButton>
        </View>

        {messagesQuery.isError ? (
          <View style={styles.errorWrap}>
            <FeedbackState tone="error" title="Messages unavailable" body="This chat could not be loaded right now." actionLabel="Retry" onAction={() => void messagesQuery.refetch()} />
          </View>
        ) : null}
        {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

        <FlatList
          ref={listRef}
          style={styles.messages}
          contentContainerStyle={[styles.messageContent, !listMessages.length && styles.emptyMessageContent]}
          data={listMessages}
          renderItem={renderMessage}
          keyExtractor={(message) => message.id}
          extraData={`${currentUserId ?? ""}:${reactingMessageId ?? ""}:${pollVoteMessageId ?? ""}`}
          inverted
          ItemSeparatorComponent={MessageSeparator}
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          initialNumToRender={14}
          windowSize={9}
          removeClippedSubviews
          onEndReached={() => void loadOlderMessages()}
          onEndReachedThreshold={0.35}
          ListFooterComponent={messages.length ? (
            <OlderMessagesFooter
              loading={olderLoading}
              error={olderError}
              hasOlder={hasOlderMessages}
              onRetry={() => void loadOlderMessages()}
            />
          ) : null}
          ListEmptyComponent={!messagesQuery.isLoading ? (
            <View style={styles.emptyChat}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyCopy}>Start the conversation from the composer below.</Text>
            </View>
          ) : null}
        />

        <ChatComposer
          body={body}
          setBody={setBody}
          target={target}
          channel={channel}
          pendingAttachments={pendingAttachments}
          setPendingAttachments={setPendingAttachments}
          pickPhoto={pickPhoto}
          pickDocument={pickDocument}
          sendDisabled={!body.trim() && !pendingAttachments.some((attachment) => attachment.state === "ready")}
          sending={sendMutation.isPending}
          uploading={uploadMutation.isPending}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          typingLabels={liveTypingLabels}
          canSchedule={["admin", "owner"].includes(String(currentUser?.role ?? ""))}
          pollLoading={pollMutation.isPending}
          scheduleLoading={scheduleMutation.isPending}
          onCreatePoll={(input) => pollMutation.mutate(input)}
          onSchedule={(input) => scheduleMutation.mutate(input)}
          onSend={() => sendMutation.mutate()}
        />
      </View>

      <SearchPanel
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        target={target}
        onOpenThread={(message) => {
          setShowSearch(false);
          setThreadMessage(message);
        }}
      />

      <ThreadPanel
        visible={Boolean(threadMessage)}
        onClose={() => setThreadMessage(null)}
        rootMessage={threadMessage}
        loading={threadQuery.isLoading}
        messages={((threadQuery.data?.messages ?? threadQuery.data?.replies ?? []) as ChatMessage[])}
      />

      <ReasonModal
        visible={Boolean(reportMessageTarget)}
        title="Report message"
        actionLabel="Submit report"
        placeholder="What is wrong with this message?"
        required
        loading={messageActionMutation.isPending}
        onClose={() => setReportMessageTarget(null)}
        onSubmit={(reason) => reportMessageTarget && messageActionMutation.mutate({ action: "report", message: reportMessageTarget, reason })}
      />

      <ReasonModal
        visible={Boolean(deleteMessageTarget)}
        title="Delete message"
        actionLabel="Delete"
        placeholder="Optional reason"
        destructive
        loading={messageActionMutation.isPending}
        onClose={() => setDeleteMessageTarget(null)}
        onSubmit={(reason) => deleteMessageTarget && messageActionMutation.mutate({ action: "delete", message: deleteMessageTarget, reason: reason || undefined })}
      />

      <MediaPreview visible={Boolean(preview)} preview={preview} onClose={() => setPreview(null)} />

      <ChatInfoPanel
        visible={showInfo}
        onClose={() => setShowInfo(false)}
        target={target}
        channel={channel}
        channels={channelsQuery.data ?? []}
        dmRequests={dmRequestsQuery.data ?? []}
        members={presenceMembers(livePresence) as Array<Record<string, unknown>>}
        media={mediaQuery.data?.media ?? mediaQuery.data?.attachments ?? []}
        pinnedMessages={pinnedMessages}
        controls={controlsQuery.data}
        controlsLoading={controlsQuery.isLoading}
        scheduledAnnouncements={scheduledQuery.data?.announcements ?? []}
        scheduledLoading={scheduledQuery.isLoading}
        onRefreshControls={() => void controlsQuery.refetch()}
        onRefreshScheduled={() => void scheduledQuery.refetch()}
        onPreview={setPreview}
      />
    </AppScreen>
  );
}

function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={styles.iconButton}>
      {children}
    </Pressable>
  );
}

function MessageSeparator() {
  return <View style={styles.messageSeparator} />;
}

function OlderMessagesFooter({
  loading,
  error,
  hasOlder,
  onRetry
}: {
  loading: boolean;
  error: string | null;
  hasOlder: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.olderFooter}>
        <Text style={styles.olderFooterText}>Loading older messages...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <Pressable onPress={onRetry} style={[styles.olderFooter, styles.olderFooterError]}>
        <Text style={styles.olderFooterTitle}>History did not load</Text>
        <Text style={styles.olderFooterText}>{error}</Text>
        <Text style={styles.olderFooterAction}>Tap to retry</Text>
      </Pressable>
    );
  }

  if (hasOlder) return null;

  return (
    <View style={styles.olderFooter}>
      <Text style={styles.olderFooterText}>Start of this channel</Text>
    </View>
  );
}

function SearchPanel({
  visible,
  onClose,
  target,
  onOpenThread
}: {
  visible: boolean;
  onClose: () => void;
  target: string;
  onOpenThread: (message: ChatMessage) => void;
}) {
  const [query, setQuery] = useState("");
  const searchMutation = useMutation({
    mutationFn: () => searchChatMessages(target, { q: query.trim(), limit: 30 })
  });
  const results = searchMutation.data?.messages ?? [];

  useEffect(() => {
    if (!visible) {
      setQuery("");
      searchMutation.reset();
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.searchPanel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Search messages</Text>
            <Pressable onPress={onClose} style={styles.closeButton}><X size={22} color={colors.white} /></Pressable>
          </View>
          <View style={styles.searchRow}>
            <Search size={20} color={chatMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search this channel"
              placeholderTextColor={chatMuted}
              autoCapitalize="none"
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={() => query.trim() ? searchMutation.mutate() : undefined}
            />
            <Pressable disabled={!query.trim() || searchMutation.isPending} onPress={() => searchMutation.mutate()} style={styles.searchButton}>
              <Text style={styles.searchButtonText}>{searchMutation.isPending ? "..." : "Go"}</Text>
            </Pressable>
          </View>
          {searchMutation.isError ? <Text style={styles.errorText}>{plainApiError(searchMutation.error, "Search failed.")}</Text> : null}
          <ScrollView contentContainerStyle={styles.panelContent}>
            {results.map((message) => (
              <Pressable key={message.id} onPress={() => onOpenThread(message)} style={styles.searchResult}>
                <Text style={styles.infoRowTitle}>{message.sender_label ?? "Skillsroom"}</Text>
                <Text style={styles.infoRowCopy} numberOfLines={3}>{message.body || "Attachment"}</Text>
                <Text style={styles.resultMeta}>{formatTime(message.created_at)}</Text>
              </Pressable>
            ))}
            {searchMutation.isSuccess && results.length === 0 ? <EmptyInfo text="No matching messages found." /> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ThreadPanel({
  visible,
  onClose,
  rootMessage,
  loading,
  messages
}: {
  visible: boolean;
  onClose: () => void;
  rootMessage: ChatMessage | null;
  loading: boolean;
  messages: ChatMessage[];
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.searchPanel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Thread</Text>
            <Pressable onPress={onClose} style={styles.closeButton}><X size={22} color={colors.white} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.panelContent}>
            {rootMessage ? (
              <View style={styles.threadRoot}>
                <Text style={styles.infoRowTitle}>{rootMessage.sender_label ?? "Skillsroom"}</Text>
                <Text style={styles.infoRowCopy}>{rootMessage.body || "Attachment"}</Text>
              </View>
            ) : null}
            <Text style={styles.infoSectionTitle}>{loading ? "Loading replies" : "Replies"}</Text>
            {messages.map((message) => (
              <View key={message.id} style={styles.threadReply}>
                <Text style={styles.infoRowTitle}>{message.sender_label ?? "Skillsroom"}</Text>
                <Text style={styles.infoRowCopy}>{message.body || "Attachment"}</Text>
              </View>
            ))}
            {!loading && messages.length === 0 ? <EmptyInfo text="No thread replies yet. Use Reply to start one." /> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ReasonModal({
  visible,
  title,
  actionLabel,
  placeholder,
  required = false,
  destructive = false,
  loading,
  onClose,
  onSubmit
}: {
  visible: boolean;
  title: string;
  actionLabel: string;
  placeholder: string;
  required?: boolean;
  destructive?: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!visible) setReason("");
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.centerBackdrop}>
        <View style={styles.reasonCard}>
          <Text style={styles.panelTitle}>{title}</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={placeholder}
            placeholderTextColor={chatMuted}
            multiline
            maxLength={500}
            style={styles.reasonInput}
          />
          <View style={styles.reasonActions}>
            <Pressable onPress={onClose} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>Cancel</Text></Pressable>
            <Pressable
              disabled={loading || (required && reason.trim().length < 3)}
              onPress={() => onSubmit(reason.trim())}
              style={[styles.primaryAction, destructive && styles.dangerAction, (loading || (required && reason.trim().length < 3)) && styles.sendButtonOff]}
            >
              <Text style={styles.primaryActionText}>{loading ? "Working..." : actionLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MediaPreview({ visible, preview, onClose }: { visible: boolean; preview: { url: string; title: string; image: boolean } | null; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.previewBackdrop}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle} numberOfLines={1}>{preview?.title ?? "Attachment"}</Text>
          <Pressable onPress={onClose} style={styles.closeButton}><X size={22} color={colors.white} /></Pressable>
        </View>
        {preview?.image ? (
          <Image source={{ uri: preview.url }} style={styles.previewImage} resizeMode="contain" />
        ) : (
          <View style={styles.filePreview}>
            <FileText size={46} color={chatCyan} />
            <Text style={styles.infoRowTitle}>{preview?.title ?? "File"}</Text>
            <Pressable onPress={() => preview?.url ? Linking.openURL(preview.url) : undefined} style={styles.openExternalButton}>
              <ExternalLink size={18} color={colors.navy} />
              <Text style={styles.openExternalText}>Open file</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

function ChatInfoPanel({
  visible,
  onClose,
  target,
  channel,
  channels,
  dmRequests,
  members,
  media,
  pinnedMessages,
  controls,
  controlsLoading,
  scheduledAnnouncements,
  scheduledLoading,
  onRefreshControls,
  onRefreshScheduled,
  onPreview
}: {
  visible: boolean;
  onClose: () => void;
  target: string;
  channel?: ChatChannel;
  channels: ChatChannel[];
  dmRequests: ChatDmRequest[];
  members: Array<Record<string, unknown>>;
  media: ChatAttachment[];
  pinnedMessages: ChatMessage[];
  controls?: Record<string, unknown>;
  controlsLoading: boolean;
  scheduledAnnouncements: Array<Record<string, unknown>>;
  scheduledLoading: boolean;
  onRefreshControls: () => void;
  onRefreshScheduled: () => void;
  onPreview: (preview: { url: string; title: string; image: boolean }) => void;
}) {
  const [tab, setTab] = useState<InfoTab>("members");
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [slowMode, setSlowMode] = useState(String(channelControlsValue(controls, channel, "slow_mode_seconds") ?? 0));
  const [lockdownMinutes, setLockdownMinutes] = useState("30");
  const [lockdownReason, setLockdownReason] = useState("");
  const selectedLevel = notificationLevelFromControls(controls, channel);
  const pushEnabled = pushEnabledFromControls(controls, channel);
  const canManageChannel = Boolean(channelControlsValue(controls, channel, "can_manage_channel") ?? channelControlsValue(controls, channel, "can_moderate"));
  const updateNotificationsMutation = useMutation({
    mutationFn: (input: { level: ChatNotificationLevel; pushEnabled?: boolean }) =>
      updateChatNotificationControls(target, {
        notification_level: input.level,
        dm_notification_level: channel?.channel_type === "dm" ? input.level : undefined,
        push_enabled: input.pushEnabled ?? pushEnabled
      }),
    onSuccess: () => {
      setLocalNotice("Notification settings saved.");
      onRefreshControls();
    },
    onError: (error) => setLocalNotice(plainApiError(error, "Could not save notification settings."))
  });
  const updateModerationMutation = useMutation({
    mutationFn: (input: { slow_mode_seconds: number; lockdown_minutes?: number; lockdown_reason?: string; unlock?: boolean }) =>
      updateChatChannelModerationControls(target, input),
    onSuccess: () => {
      setLocalNotice("Channel controls saved.");
      onRefreshControls();
    },
    onError: (error) => setLocalNotice(plainApiError(error, "Could not save channel controls."))
  });
  const cancelScheduleMutation = useMutation({
    mutationFn: (announcementId: string) => cancelScheduledChatAnnouncement(target, announcementId),
    onSuccess: () => {
      setLocalNotice("Scheduled announcement cancelled.");
      onRefreshScheduled();
    },
    onError: (error) => setLocalNotice(plainApiError(error, "Could not cancel announcement."))
  });

  const dmChannels = channels.filter((item) => item.channel_type === "dm");
  const activeRequests = dmRequests.filter((request) => request.status === "accepted" || request.status === "pending");
  const orderedChannels = channels.filter((item) => item.channel_type !== "dm");

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.infoPanel}>
          <View style={styles.infoHeader}>
            <Pressable onPress={onClose} style={styles.closeButton}><X size={22} color={colors.white} /></Pressable>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsFor(titleFor(channel))}</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.infoTitle} numberOfLines={1}>{titleFor(channel)}</Text>
              <Text style={styles.infoSubtitle} numberOfLines={1}>{channel?.channel_type === "dm" ? "Direct message" : `${channel?.online_count ?? 0} online / ${orderedChannels.length} channels`}</Text>
            </View>
          </View>

          <View style={styles.infoTabsWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.infoTabsScroller} contentContainerStyle={styles.infoTabs}>
            <InfoTabButton tab="members" current={tab} label="Members" onPress={setTab} />
            <InfoTabButton tab="dms" current={tab} label={`DMs ${dmChannels.length || activeRequests.length || ""}`.trim()} onPress={setTab} />
            <InfoTabButton tab="channels" current={tab} label="Channels" onPress={setTab} />
            <InfoTabButton tab="media" current={tab} label="Media" onPress={setTab} />
            <InfoTabButton tab="pins" current={tab} label="Pins" onPress={setTab} />
            <InfoTabButton tab="settings" current={tab} label="Settings" onPress={setTab} />
            </ScrollView>
          </View>

          <ScrollView style={styles.infoBody} contentContainerStyle={styles.infoContent}>
            {tab === "members" ? (
              <InfoSection title="Active and recent members">
                {members.length ? members.map((member, index) => <MemberRow key={`${memberLabel(member)}-${index}`} member={member} />) : <EmptyInfo text="No member activity is visible yet." />}
              </InfoSection>
            ) : null}

            {tab === "dms" ? (
              <InfoSection title="Direct messages">
                {dmChannels.map((item) => <ChannelInfoRow key={item.id} channel={item} onClose={onClose} />)}
                {activeRequests.filter((request) => request.channel_slug && !dmChannels.some((item) => item.slug === request.channel_slug)).map((request) => (
                  <Pressable key={request.id} onPress={() => {
                    onClose();
                    if (request.channel_slug) router.push(`/(app)/chat/${encodeURIComponent(request.channel_slug)}`);
                  }} style={styles.infoRow}>
                    <View style={styles.infoAvatar}><Text style={styles.infoAvatarText}>{initialsFor(requestPeer(request))}</Text></View>
                    <View style={styles.infoRowText}>
                      <Text style={styles.infoRowTitle}>{requestPeer(request)}</Text>
                      <Text style={styles.infoRowCopy}>{request.status === "pending" ? "Pending DM request" : "Open DM thread"}</Text>
                    </View>
                  </Pressable>
                ))}
                {!dmChannels.length && !activeRequests.length ? <EmptyInfo text="No direct messages yet." /> : null}
              </InfoSection>
            ) : null}

            {tab === "channels" ? (
              <InfoSection title="Your accessible channels">
                {orderedChannels.map((item) => <ChannelInfoRow key={item.id} channel={item} onClose={onClose} />)}
                {!orderedChannels.length ? <EmptyInfo text="No channels are available yet." /> : null}
              </InfoSection>
            ) : null}

            {tab === "media" ? (
              <InfoSection title={`Shared media and files${media.length ? ` (${media.length})` : ""}`}>
                {media.length ? (
                  <View style={styles.mediaGrid}>
                    {media.map((item) => <MediaTile key={item.id} channelId={target} attachment={item} onPreview={onPreview} />)}
                  </View>
                ) : <EmptyInfo text="No shared files are available in this channel yet." />}
              </InfoSection>
            ) : null}

            {tab === "pins" ? (
              <InfoSection title="Pinned messages">
                {pinnedMessages.length ? pinnedMessages.map((message) => (
                  <View key={message.id} style={styles.pinCard}>
                    <Text style={styles.infoRowTitle}>{message.sender_label ?? "Skillsroom"}</Text>
                    <Text style={styles.infoRowCopy} numberOfLines={4}>{message.body || "Pinned attachment"}</Text>
                  </View>
                )) : <EmptyInfo text="No messages are pinned in this channel yet." />}
              </InfoSection>
            ) : null}

            {tab === "settings" ? (
              <InfoSection title="Notifications">
                {localNotice ? <Text style={styles.localNotice}>{localNotice}</Text> : null}
                <View style={styles.segment}>
                  {(["all", "mentions", "none"] as ChatNotificationLevel[]).map((level) => (
                    <Pressable
                      key={level}
                      disabled={updateNotificationsMutation.isPending || controlsLoading}
                      onPress={() => updateNotificationsMutation.mutate({ level })}
                      style={[styles.segmentButton, selectedLevel === level && styles.segmentButtonOn]}
                    >
                      <Text style={[styles.segmentText, selectedLevel === level && styles.segmentTextOn]}>{level === "all" ? "Everything" : level === "mentions" ? "Mentions" : "Nothing"}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  disabled={updateNotificationsMutation.isPending || controlsLoading}
                  onPress={() => updateNotificationsMutation.mutate({ level: selectedLevel, pushEnabled: !pushEnabled })}
                  style={styles.pushRow}
                >
                  <Bell size={20} color={colors.white} />
                  <Text style={styles.pushText}>Mobile push</Text>
                  <View style={[styles.checkBox, pushEnabled && styles.checkBoxOn]} />
                </Pressable>
                <View style={styles.settingsDivider} />
                <Text style={styles.settingsLabel}>Channel controls</Text>
                <Text style={styles.settingsCopy}>Slow mode: {Number(channelControlsValue(controls, channel, "slow_mode_seconds") ?? 0) > 0 ? `${channelControlsValue(controls, channel, "slow_mode_seconds")}s` : "Off"}</Text>
                <Text style={styles.settingsCopy}>Lockdown: {channelControlsValue(controls, channel, "lockdown_until") ? `Until ${String(channelControlsValue(controls, channel, "lockdown_until"))}` : "Off"}</Text>
                {channelControlsValue(controls, channel, "lockdown_reason") ? <Text style={styles.settingsCopy}>Reason: {String(channelControlsValue(controls, channel, "lockdown_reason"))}</Text> : null}
                {canManageChannel ? (
                  <View style={styles.moderatorPanel}>
                    <Text style={styles.formPanelTitle}>Moderator controls</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                      {slowModeOptions.map((value) => (
                        <Pressable key={value} onPress={() => setSlowMode(String(value))} style={[styles.optionPill, slowMode === String(value) && styles.optionPillOn]}>
                          <Text style={[styles.optionPillText, slowMode === String(value) && styles.optionPillTextOn]}>{value === 0 ? "Off" : `${value}s`}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <Pressable
                      disabled={updateModerationMutation.isPending}
                      onPress={() => updateModerationMutation.mutate({ slow_mode_seconds: Number(slowMode) || 0 })}
                      style={styles.primaryAction}
                    >
                      <Text style={styles.primaryActionText}>{updateModerationMutation.isPending ? "Saving..." : "Save slow mode"}</Text>
                    </Pressable>
                    <View style={styles.lockdownGrid}>
                      <TextInput value={lockdownReason} onChangeText={setLockdownReason} placeholder="Why is posting paused?" placeholderTextColor={chatMuted} style={styles.formInput} />
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                        {lockdownOptions.map((value) => (
                          <Pressable key={value} onPress={() => setLockdownMinutes(String(value))} style={[styles.optionPill, lockdownMinutes === String(value) && styles.optionPillOn]}>
                            <Text style={[styles.optionPillText, lockdownMinutes === String(value) && styles.optionPillTextOn]}>{value < 60 ? `${value} min` : `${value / 60} hr`}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                      <View style={styles.formActions}>
                        <Pressable
                          disabled={updateModerationMutation.isPending || lockdownReason.trim().length < 3}
                          onPress={() => updateModerationMutation.mutate({ slow_mode_seconds: Number(slowMode) || 0, lockdown_minutes: Number(lockdownMinutes) || 30, lockdown_reason: lockdownReason.trim() })}
                          style={[styles.primaryAction, updateModerationMutation.isPending || lockdownReason.trim().length < 3 ? styles.sendButtonOff : null]}
                        >
                          <Text style={styles.primaryActionText}>Lock channel</Text>
                        </Pressable>
                        <Pressable
                          disabled={updateModerationMutation.isPending}
                          onPress={() => updateModerationMutation.mutate({ slow_mode_seconds: Number(slowMode) || 0, unlock: true })}
                          style={styles.secondaryAction}
                        >
                          <Text style={styles.secondaryActionText}>Unlock</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ) : null}
                {canManageChannel ? (
                  <>
                    <View style={styles.settingsDivider} />
                    <View style={styles.scheduleHeader}>
                      <View>
                        <Text style={styles.settingsLabel}>Scheduled announcements</Text>
                        <Text style={styles.settingsCopy}>{scheduledAnnouncements.length} queued item{scheduledAnnouncements.length === 1 ? "" : "s"}</Text>
                      </View>
                      <Pressable onPress={onRefreshScheduled} style={styles.scheduleRefresh}>
                        <CalendarClock size={16} color={chatCyan} />
                      </Pressable>
                    </View>
                    {scheduledLoading ? <Text style={styles.settingsCopy}>Loading scheduled announcements...</Text> : null}
                    {scheduledAnnouncements.map((announcement) => (
                      <View key={String(announcement.id)} style={styles.scheduledCard}>
                        <View style={styles.scheduledTop}>
                          <View style={styles.scheduledBadge}>
                            <Megaphone size={15} color={chatCyan} />
                            <Text style={styles.scheduledBadgeText}>{String(announcement.status ?? "scheduled")}</Text>
                          </View>
                          <Text style={styles.scheduledTime}>{formatDateTime(String(announcement.scheduled_for ?? announcement.scheduled_at ?? ""))}</Text>
                        </View>
                        <Text style={styles.infoRowTitle} numberOfLines={3}>{String(announcement.body ?? "Announcement")}</Text>
                        <Pressable
                          disabled={cancelScheduleMutation.isPending}
                          onPress={() => cancelScheduleMutation.mutate(String(announcement.id))}
                          style={[styles.secondaryAction, styles.scheduleCancel]}
                        >
                          <Text style={styles.secondaryActionText}>Cancel</Text>
                        </Pressable>
                      </View>
                    ))}
                    {!scheduledLoading && !scheduledAnnouncements.length ? <EmptyInfo text="No announcements are scheduled for this channel." /> : null}
                  </>
                ) : null}
              </InfoSection>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function notificationLevelFromControls(controls?: Record<string, unknown>, channel?: ChatChannel): ChatNotificationLevel {
  const membership = controls?.membership as Record<string, unknown> | undefined;
  const innerControls = controls?.controls as Record<string, unknown> | undefined;
  const value = controls?.notification_level ?? innerControls?.notification_level ?? membership?.notification_level ?? channel?.membership_notification_level ?? "all";
  return value === "mentions" || value === "none" ? value : "all";
}

function pushEnabledFromControls(controls?: Record<string, unknown>, channel?: ChatChannel) {
  const membership = controls?.membership as Record<string, unknown> | undefined;
  const innerControls = controls?.controls as Record<string, unknown> | undefined;
  const value = controls?.push_enabled ?? innerControls?.push_enabled ?? membership?.push_enabled ?? channel?.membership_push_enabled;
  return value !== false;
}

function channelControlsValue(controls: Record<string, unknown> | undefined, channel: ChatChannel | undefined, key: string) {
  const innerControls = controls?.controls as Record<string, unknown> | undefined;
  const innerChannel = controls?.channel as Record<string, unknown> | undefined;
  return controls?.[key] ?? innerControls?.[key] ?? innerChannel?.[key] ?? channel?.[key];
}

function InfoTabButton({ tab, current, label, onPress }: { tab: InfoTab; current: InfoTab; label: string; onPress: (tab: InfoTab) => void }) {
  const active = tab === current;
  return (
    <Pressable onPress={() => onPress(tab)} style={[styles.infoTab, active && styles.infoTabOn]}>
      <Text style={[styles.infoTabText, active && styles.infoTabTextOn]}>{label}</Text>
    </Pressable>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.infoSection}>
      <Text style={styles.infoSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function EmptyInfo({ text }: { text: string }) {
  return (
    <View style={styles.emptyInfo}>
      <Text style={styles.emptyInfoText}>{text}</Text>
    </View>
  );
}

function MemberRow({ member }: { member: Record<string, unknown> }) {
  const status = memberStatus(member);
  const label = memberLabel(member);
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoAvatar}>
        <Text style={styles.infoAvatarText}>{initialsFor(label)}</Text>
        {status === "online" ? <View style={styles.onlineDot} /> : null}
      </View>
      <View style={styles.infoRowText}>
        <Text style={styles.infoRowTitle}>{label}</Text>
        <Text style={styles.infoRowCopy}>{memberHandle(member)} / {status}</Text>
      </View>
    </View>
  );
}

function ChannelInfoRow({ channel, onClose }: { channel: ChatChannel; onClose: () => void }) {
  const unread = channel.unread_count ?? 0;
  return (
    <Pressable onPress={() => {
      onClose();
      router.push(`/(app)/chat/${encodeURIComponent(channelTarget(channel))}`);
    }} style={styles.infoRow}>
      <View style={styles.infoAvatar}><Text style={styles.infoAvatarText}>{initialsFor(titleFor(channel))}</Text></View>
      <View style={styles.infoRowText}>
        <Text style={styles.infoRowTitle}>{titleFor(channel)}</Text>
        <Text style={styles.infoRowCopy} numberOfLines={1}>{channelPreview(channel)}</Text>
      </View>
      {unread > 0 ? <Text style={styles.infoUnread}>{unread}</Text> : null}
    </Pressable>
  );
}

function MediaTile({ channelId, attachment, onPreview }: { channelId: string; attachment: ChatAttachment; onPreview: (preview: { url: string; title: string; image: boolean }) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const image = isImageAttachment(attachment);

  const open = async () => {
    const access = await getChatAttachmentAccess(channelId, attachment.id);
    const signedUrl = absoluteChatMediaUrl(typeof access.url === "string" ? access.url : null);
    if (signedUrl) {
      setUrl(signedUrl);
      onPreview({ url: signedUrl, title: attachment.original_name ?? (image ? "Image" : "File"), image });
    }
  };

  return (
    <Pressable onPress={() => void open()} style={styles.mediaTile}>
      {image && url ? <Image source={{ uri: url }} style={styles.mediaImage} resizeMode="cover" /> : (
        <View style={styles.mediaPlaceholder}>
          {image ? <ImageIcon size={22} color={chatCyan} /> : <FileText size={22} color={chatCyan} />}
        </View>
      )}
      <Text style={styles.mediaTitle} numberOfLines={2}>{attachment.original_name ?? (image ? "Image" : "File")}</Text>
      <Text style={styles.mediaMeta}>{byteLabel(attachment.byte_size)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    marginHorizontal: -spacing.md,
    marginVertical: -spacing.md,
    backgroundColor: chatBg
  },
  header: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: chatLine,
    backgroundColor: "#142333"
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#203347"
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy
  },
  avatarText: {
    color: chatGreen,
    fontWeight: "900",
    letterSpacing: 1
  },
  headerText: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900"
  },
  subtitle: {
    color: chatMuted,
    marginTop: 3,
    fontWeight: "700"
  },
  errorWrap: {
    padding: spacing.md
  },
  messages: {
    flex: 1,
    backgroundColor: chatBg
  },
  messageContent: {
    padding: spacing.md
  },
  emptyMessageContent: {
    flexGrow: 1,
    justifyContent: "center"
  },
  messageSeparator: {
    height: spacing.md
  },
  olderFooter: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: chatLine,
    borderRadius: radius.pill,
    backgroundColor: "#172838",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm
  },
  olderFooterError: {
    borderColor: "#ff9aad",
    borderRadius: radius.md,
    alignItems: "flex-start"
  },
  olderFooterTitle: {
    color: colors.white,
    fontWeight: "900",
    marginBottom: 2
  },
  olderFooterText: {
    color: chatMuted,
    fontWeight: "800",
    textAlign: "center"
  },
  olderFooterAction: {
    color: chatCyan,
    fontWeight: "900",
    marginTop: spacing.xs
  },
  emptyChat: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: chatLine,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center"
  },
  emptyTitle: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 18
  },
  emptyCopy: {
    color: chatMuted,
    marginTop: 5,
    textAlign: "center"
  },
  errorText: {
    color: "#ff8da0",
    fontWeight: "800",
    fontSize: 12
  },
  formPanel: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: chatLine,
    backgroundColor: "#162536",
    padding: spacing.sm,
    gap: spacing.sm
  },
  formPanelTitle: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 16
  },
  formInput: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: chatLine,
    backgroundColor: chatPanel,
    color: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 15
  },
  tallFormInput: {
    minHeight: 96,
    textAlignVertical: "top"
  },
  formActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs
  },
  sendButtonOff: {
    opacity: 0.45
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)"
  },
  infoPanel: {
    height: "88%",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: chatBg
  },
  searchPanel: {
    height: "82%",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: chatBg
  },
  panelHeader: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: chatLine,
    backgroundColor: "#142333"
  },
  panelTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900"
  },
  searchRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    margin: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: chatLine,
    backgroundColor: chatPanel,
    paddingHorizontal: spacing.sm
  },
  searchInput: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    paddingVertical: spacing.sm
  },
  searchButton: {
    minWidth: 50,
    minHeight: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: chatCyan
  },
  searchButtonText: {
    color: colors.navy,
    fontWeight: "900"
  },
  panelContent: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl
  },
  searchResult: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: chatLine,
    backgroundColor: chatPanel,
    padding: spacing.md,
    gap: spacing.xs
  },
  resultMeta: {
    color: chatCyan,
    fontWeight: "800",
    fontSize: 12
  },
  threadRoot: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#2e5f6d",
    backgroundColor: chatPanel,
    padding: spacing.md,
    gap: spacing.xs
  },
  threadReply: {
    borderRadius: radius.md,
    backgroundColor: "#172638",
    padding: spacing.md,
    gap: spacing.xs
  },
  centerBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.58)",
    padding: spacing.md
  },
  reasonCard: {
    width: "100%",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: chatLine,
    backgroundColor: chatBg,
    padding: spacing.md,
    gap: spacing.md
  },
  reasonInput: {
    minHeight: 108,
    maxHeight: 180,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: chatLine,
    backgroundColor: chatPanel,
    color: colors.white,
    textAlignVertical: "top",
    padding: spacing.md,
    fontSize: 16
  },
  reasonActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm
  },
  secondaryAction: {
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    backgroundColor: chatPanel
  },
  secondaryActionText: {
    color: colors.white,
    fontWeight: "900"
  },
  primaryAction: {
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    backgroundColor: chatCyan
  },
  dangerAction: {
    backgroundColor: colors.red
  },
  primaryActionText: {
    color: colors.navy,
    fontWeight: "900"
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,8,16,0.96)",
    padding: spacing.md
  },
  previewHeader: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  previewTitle: {
    flex: 1,
    color: colors.white,
    fontWeight: "900",
    fontSize: 18
  },
  previewImage: {
    flex: 1,
    width: "100%"
  },
  filePreview: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md
  },
  openExternalButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: chatCyan,
    paddingHorizontal: spacing.md
  },
  openExternalText: {
    color: colors.navy,
    fontWeight: "900"
  },
  infoHeader: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: chatLine,
    backgroundColor: "#142333"
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#203347"
  },
  infoTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900"
  },
  infoSubtitle: {
    color: chatMuted,
    marginTop: 3,
    fontWeight: "700"
  },
  infoTabsWrap: {
    height: 66,
    borderBottomWidth: 1,
    borderBottomColor: chatLine,
    backgroundColor: chatBg
  },
  infoTabsScroller: {
    flexGrow: 0,
    flexShrink: 0
  },
  infoTabs: {
    minHeight: 66,
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  infoTab: {
    height: 42,
    minWidth: 92,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: "#1a2a3b",
    borderWidth: 1,
    borderColor: "#22364a"
  },
  infoTabOn: {
    backgroundColor: "#244e5d",
    borderColor: "#3fc9e8"
  },
  infoTabText: {
    color: chatMuted,
    fontWeight: "900",
    fontSize: 13
  },
  infoTabTextOn: {
    color: chatCyan
  },
  infoBody: {
    flex: 1
  },
  infoContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  infoSection: {
    gap: spacing.sm
  },
  infoSectionTitle: {
    color: "#c5cfda",
    textTransform: "uppercase",
    letterSpacing: 4,
    fontWeight: "900",
    fontSize: 12
  },
  infoRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: chatPanel,
    padding: spacing.sm
  },
  infoAvatar: {
    width: 54,
    height: 54,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2a3b4e"
  },
  infoAvatarText: {
    color: chatCyan,
    fontWeight: "900"
  },
  onlineDot: {
    position: "absolute",
    right: 5,
    bottom: 5,
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: chatGreen,
    borderWidth: 2,
    borderColor: chatPanel
  },
  infoRowText: {
    flex: 1,
    minWidth: 0
  },
  infoRowTitle: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 16
  },
  infoRowCopy: {
    color: chatMuted,
    marginTop: 4,
    lineHeight: 19
  },
  infoUnread: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: "#18a9df",
    color: colors.white,
    textAlign: "center",
    fontWeight: "900"
  },
  emptyInfo: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: chatLine,
    padding: spacing.lg,
    alignItems: "center"
  },
  emptyInfoText: {
    color: chatMuted,
    textAlign: "center",
    fontWeight: "800"
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  mediaTile: {
    width: "31%",
    minHeight: 132,
    borderRadius: radius.md,
    backgroundColor: chatPanel,
    padding: spacing.xs,
    gap: 4
  },
  mediaPlaceholder: {
    height: 72,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#24384d"
  },
  mediaImage: {
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.navy
  },
  mediaTitle: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 12
  },
  mediaMeta: {
    color: chatMuted,
    fontSize: 11
  },
  pinCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: chatLine,
    backgroundColor: chatPanel,
    padding: spacing.md,
    gap: spacing.xs
  },
  localNotice: {
    color: chatCyan,
    fontWeight: "800"
  },
  segment: {
    flexDirection: "row",
    borderRadius: radius.md,
    backgroundColor: chatPanel,
    padding: 4
  },
  segmentButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentButtonOn: {
    backgroundColor: chatCyan
  },
  segmentText: {
    color: chatMuted,
    fontWeight: "900"
  },
  segmentTextOn: {
    color: colors.navy
  },
  pushRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: chatLine,
    backgroundColor: chatPanel,
    paddingHorizontal: spacing.md
  },
  pushText: {
    flex: 1,
    color: colors.white,
    fontWeight: "900",
    fontSize: 16
  },
  checkBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.white
  },
  checkBoxOn: {
    backgroundColor: chatGreen,
    borderColor: chatGreen
  },
  settingsDivider: {
    height: 1,
    backgroundColor: chatLine,
    marginVertical: spacing.sm
  },
  settingsLabel: {
    color: "#c5cfda",
    textTransform: "uppercase",
    letterSpacing: 4,
    fontWeight: "900",
    fontSize: 12
  },
  settingsCopy: {
    color: chatMuted,
    fontSize: 15,
    lineHeight: 22
  },
  scheduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  scheduleRefresh: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: chatPanel
  },
  moderatorPanel: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: chatLine,
    backgroundColor: "#162536",
    padding: spacing.sm,
    gap: spacing.sm
  },
  optionRow: {
    gap: spacing.xs
  },
  optionPill: {
    minHeight: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: chatPanel,
    paddingHorizontal: spacing.sm
  },
  optionPillOn: {
    backgroundColor: chatCyan
  },
  optionPillText: {
    color: colors.white,
    fontWeight: "900"
  },
  optionPillTextOn: {
    color: colors.navy
  },
  lockdownGrid: {
    gap: spacing.sm
  },
  scheduledCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: chatLine,
    backgroundColor: chatPanel,
    padding: spacing.sm,
    gap: spacing.sm
  },
  scheduledTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  scheduledBadge: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.pill,
    backgroundColor: "#17364a",
    paddingHorizontal: spacing.sm
  },
  scheduledBadgeText: {
    color: chatCyan,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 11
  },
  scheduledTime: {
    flexShrink: 1,
    color: chatMuted,
    fontWeight: "800",
    textAlign: "right",
    fontSize: 12
  },
  scheduleCancel: {
    alignSelf: "flex-start",
    backgroundColor: "#3d2633"
  }
});






