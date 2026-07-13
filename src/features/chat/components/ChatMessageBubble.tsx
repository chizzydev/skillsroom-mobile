import { memo, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Bookmark, Check, FileText, Flag, Image as ImageIcon, ListChecks, MessageCircle, Pin, Reply, Trash2 } from "lucide-react-native";
import { absoluteChatMediaUrl, getChatAttachmentAccess } from "../../../api/chat";
import { plainApiError } from "../../../api/errors";
import { colors, radius, spacing } from "../../../constants/theme";
import type { ChatAttachment, ChatMessage, ChatPoll } from "../../../types/api";

const chatPanel = "#1c2b3a";
const chatPanelSoft = "#233446";
const chatLine = "#31465a";
const chatMuted = "#a9b6c4";
const chatCyan = "#47c7ef";

const reactionOptions = [
  { value: "like", label: "\u{1F44D}" },
  { value: "gg", label: "GG" },
  { value: "fire", label: "\u{1F525}" },
  { value: "clap", label: "\u{1F44F}" },
  { value: "trophy", label: "\u{1F3C6}" },
  { value: "heart", label: "\u2764\uFE0F" },
  { value: "laugh", label: "\u{1F602}" },
  { value: "wow", label: "\u{1F62E}" },
  { value: "sad", label: "\u{1F622}" },
  { value: "angry", label: "\u{1F621}" },
  { value: "hundred", label: "\u{1F4AF}" },
  { value: "game", label: "\u{1F3AE}" }
];
const primaryReactionOptions = reactionOptions.slice(0, 6);

export type MessageAction = "bookmark" | "pin" | "report" | "delete";
export type ChatAttachmentPreview = { url: string; title: string; image: boolean };

export type ChatMessageBubbleProps = {
  channelId: string;
  message: ChatMessage;
  isMine: boolean;
  reacting: boolean;
  onReact: (messageId: string, reaction: string) => void;
  onReply: (message: ChatMessage) => void;
  onThread: (message: ChatMessage) => void;
  onMessageAction: (action: MessageAction, message: ChatMessage) => void;
  onVotePoll: (messageId: string, optionIds: string[]) => void;
  votingPoll: boolean;
  onPreview: (preview: ChatAttachmentPreview) => void;
};

function initialsFor(value?: string | null) {
  const text = value?.trim() || "SR";
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return text.slice(0, 3).toUpperCase();
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

function pollFromMessage(message: ChatMessage): ChatPoll | null {
  if (message.poll && typeof message.poll === "object") return message.poll;
  const metadata = message.metadata as Record<string, unknown> | undefined;
  const metadataPoll = metadata?.poll;
  return metadataPoll && typeof metadataPoll === "object" ? metadataPoll as ChatPoll : null;
}

function messageRenderVersion(message: ChatMessage) {
  return [
    message.id,
    message.updated_at ?? "",
    message.edited_at ?? "",
    message.deleted_at ?? "",
    message.hidden_at ?? "",
    message.status ?? "",
    message.body,
    message.reply_to_message_id ?? "",
    message.reply_to_body ?? "",
    message.attachments?.map((attachment) => `${attachment.id}:${attachment.status}:${attachment.updated_at ?? ""}`).join(",") ?? "",
    message.reactions?.map((reaction) => `${reaction.reaction}:${reaction.count}:${reaction.reacted_by_me ? "1" : "0"}`).join(",") ?? "",
    pollFromMessage(message)?.updated_at ?? ""
  ].join("|");
}

function pollRenderVersion(poll: ChatPoll) {
  return [
    poll.id,
    poll.updated_at ?? "",
    poll.status ?? "",
    poll.total_votes ?? "",
    poll.question,
    poll.allow_multiple ? "1" : "0",
    poll.closes_at ?? "",
    poll.options?.map((option) => `${option.id}:${option.label}:${option.vote_count ?? 0}:${option.voted_by_me ? "1" : "0"}`).join(",") ?? ""
  ].join("|");
}

function attachmentRenderVersion(attachment: ChatAttachment) {
  return [
    attachment.id,
    attachment.status,
    attachment.updated_at ?? "",
    attachment.message_id ?? "",
    attachment.original_name ?? "",
    attachment.attachment_type,
    attachment.mime_type ?? "",
    attachment.byte_size ?? "",
    attachment.width ?? "",
    attachment.height ?? ""
  ].join("|");
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  channelId,
  message,
  isMine,
  reacting,
  onReact,
  onReply,
  onThread,
  onMessageAction,
  onVotePoll,
  votingPoll,
  onPreview
}: ChatMessageBubbleProps) {
  const attachments = message.attachments ?? [];
  const deleted = message.status === "deleted" || Boolean(message.deleted_at);
  const poll = pollFromMessage(message);

  return (
    <View style={[styles.messageCard, isMine && styles.mineCard, deleted && styles.deletedCard]}>
      <View style={styles.messageHeader}>
        <View style={styles.senderAvatar}>
          <Text style={styles.senderAvatarText}>{initialsFor(isMine ? "You" : message.sender_label)}</Text>
        </View>
        <View style={styles.messageMeta}>
          <Text style={styles.sender}>{isMine ? "You" : message.sender_label ?? "Skillsroom"}</Text>
          <Text style={styles.senderSub} numberOfLines={1} adjustsFontSizeToFit>{message.sender_username ? `@${message.sender_username}` : "@skillsroom"} {formatTime(message.created_at)}</Text>
        </View>
      </View>

      {message.reply_to_body ? (
        <View style={styles.replyBox}>
          <Text style={styles.replyText} numberOfLines={2}>{message.reply_to_sender_label}: {message.reply_to_body}</Text>
        </View>
      ) : null}

      {deleted ? (
        <Text style={styles.deletedText}>This message was deleted.</Text>
      ) : message.body ? (
        <Text style={styles.body}>{message.body}</Text>
      ) : null}

      {!deleted && poll ? <PollCard messageId={message.id} poll={poll} loading={votingPoll} onVote={onVotePoll} /> : null}

      {attachments.map((attachment) => (
        <AttachmentCard key={attachment.id} channelId={channelId} attachment={attachment} onPreview={onPreview} />
      ))}

      {!deleted ? (
        <View style={styles.messageActions}>
          <ActionChip label="Reply" icon={<Reply size={14} color={chatCyan} />} onPress={() => onReply(message)} />
          <ActionChip label="Thread" icon={<MessageCircle size={14} color={chatCyan} />} onPress={() => onThread(message)} />
          <ActionChip label="Pin" icon={<Pin size={14} color={chatCyan} />} onPress={() => onMessageAction("pin", message)} />
          <ActionChip label="Save" icon={<Bookmark size={14} color={chatCyan} />} onPress={() => onMessageAction("bookmark", message)} />
          {!isMine ? <ActionChip label="Report" icon={<Flag size={14} color="#ff9aad" />} onPress={() => onMessageAction("report", message)} /> : null}
          {isMine ? <ActionChip label="Delete" icon={<Trash2 size={14} color="#ff9aad" />} onPress={() => onMessageAction("delete", message)} /> : null}
        </View>
      ) : null}

      <View style={styles.reactions}>
        {(message.reactions ?? []).map((reaction) => (
          <View key={reaction.reaction} style={[styles.reactionPill, reaction.reacted_by_me && styles.reactionPillOn]}>
            <Text style={styles.reactionText}>{reactionLabel(reaction.reaction)} {reaction.count}</Text>
          </View>
        ))}
      </View>

      {!deleted ? (
        <View style={styles.quickReactions}>
          {primaryReactionOptions.map((reaction) => (
            <Pressable key={reaction.value} disabled={reacting} onPress={() => onReact(message.id, reaction.value)} style={styles.quickReaction}>
              <Text style={styles.quickReactionText}>{reaction.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}, areMessageBubblePropsEqual);

function areMessageBubblePropsEqual(previous: ChatMessageBubbleProps, next: ChatMessageBubbleProps) {
  return previous.channelId === next.channelId
    && previous.message.id === next.message.id
    && previous.isMine === next.isMine
    && previous.reacting === next.reacting
    && previous.votingPoll === next.votingPoll
    && previous.onReact === next.onReact
    && previous.onReply === next.onReply
    && previous.onThread === next.onThread
    && previous.onMessageAction === next.onMessageAction
    && previous.onVotePoll === next.onVotePoll
    && previous.onPreview === next.onPreview
    && messageRenderVersion(previous.message) === messageRenderVersion(next.message);
}

type PollCardProps = {
  messageId: string;
  poll: ChatPoll;
  loading: boolean;
  onVote: (messageId: string, optionIds: string[]) => void;
};

const PollCard = memo(function PollCard({ messageId, poll, loading, onVote }: PollCardProps) {
  const [selected, setSelected] = useState<string[]>(() => (poll.options ?? []).filter((option) => option.voted_by_me).map((option) => option.id));
  const pollVersion = pollRenderVersion(poll);
  const options = poll.options ?? [];
  const totalVotes = Math.max(Number(poll.total_votes ?? options.reduce((sum, option) => sum + Number(option.vote_count ?? 0), 0)), 0);
  const closed = poll.status && poll.status !== "open";
  const allowMultiple = Boolean(poll.allow_multiple);

  useEffect(() => {
    setSelected(options.filter((option) => option.voted_by_me).map((option) => option.id));
  }, [pollVersion]);

  function toggle(optionId: string) {
    if (closed || loading) return;
    if (!allowMultiple) {
      setSelected([optionId]);
      onVote(messageId, [optionId]);
      return;
    }
    setSelected((current) => current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]);
  }

  return (
    <View style={styles.pollCard}>
      <View style={styles.pollHeader}>
        <View style={styles.pollIcon}>
          <ListChecks size={18} color={chatCyan} />
        </View>
        <View style={styles.pollHeaderText}>
          <Text style={styles.pollQuestion}>{poll.question}</Text>
          <Text style={styles.pollMeta}>
            {allowMultiple ? "Multiple choice" : "Single choice"} / {totalVotes} vote{totalVotes === 1 ? "" : "s"}{poll.closes_at ? ` / closes ${formatDateTime(poll.closes_at)}` : ""}
          </Text>
        </View>
      </View>
      <View style={styles.pollOptions}>
        {options.map((option) => {
          const votes = Number(option.vote_count ?? 0);
          const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const active = selected.includes(option.id) || Boolean(option.voted_by_me);
          return (
            <Pressable key={option.id} disabled={Boolean(closed) || loading} onPress={() => toggle(option.id)} style={[styles.pollOption, active && styles.pollOptionOn]}>
              <View style={[styles.pollFill, { width: `${percent}%` }]} />
              <View style={styles.pollOptionContent}>
                <View style={[styles.pollCheck, active && styles.pollCheckOn]}>
                  {active ? <Check size={14} color={colors.navy} strokeWidth={3} /> : null}
                </View>
                <Text style={styles.pollLabel} numberOfLines={2}>{option.label}</Text>
                <Text style={styles.pollPercent}>{percent}%</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {allowMultiple && !closed ? (
        <Pressable disabled={loading || selected.length === 0} onPress={() => onVote(messageId, selected)} style={[styles.pollSubmit, (loading || selected.length === 0) && styles.sendButtonOff]}>
          <Text style={styles.pollSubmitText}>{loading ? "Saving..." : "Submit vote"}</Text>
        </Pressable>
      ) : null}
      {closed ? <Text style={styles.pollClosed}>Poll is {poll.status}.</Text> : null}
    </View>
  );
}, arePollCardPropsEqual);

function arePollCardPropsEqual(previous: PollCardProps, next: PollCardProps) {
  return previous.messageId === next.messageId
    && previous.loading === next.loading
    && previous.onVote === next.onVote
    && pollRenderVersion(previous.poll) === pollRenderVersion(next.poll);
}

function HydrationPlaceholder({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.hydrationPlaceholder}>
      {icon}
      <Text style={styles.hydrationPlaceholderText}>{text}</Text>
    </View>
  );
}
function ActionChip({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.actionChip}>
      {icon}
      <Text style={styles.actionChipText}>{label}</Text>
    </Pressable>
  );
}

function reactionLabel(value: string) {
  return reactionOptions.find((reaction) => reaction.value === value)?.label ?? value;
}

type AttachmentCardProps = {
  channelId: string;
  attachment: ChatAttachment;
  onPreview: (preview: ChatAttachmentPreview) => void;
};

const AttachmentCard = memo(function AttachmentCard({ channelId, attachment, onPreview }: AttachmentCardProps) {
  const [accessUrl, setAccessUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const image = isImageAttachment(attachment);

  const loadAttachment = useCallback(async (open = false) => {
    try {
      setLoading(true);
      setError(null);
      const access = await getChatAttachmentAccess(channelId, attachment.id);
      const url = absoluteChatMediaUrl(typeof access.url === "string" ? access.url : null);
      setAccessUrl(url);
      if (open && url) onPreview({ url, title: attachment.original_name ?? `${attachment.attachment_type} attachment`, image });
    } catch (loadError) {
      setError(plainApiError(loadError, "Attachment could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [attachment.attachment_type, attachment.id, attachment.original_name, channelId, image, onPreview]);

  return (
    <View style={styles.attachmentCard}>
      <View style={styles.attachmentTop}>
        <View style={styles.attachmentIcon}>{image ? <ImageIcon size={18} color={chatCyan} /> : <FileText size={18} color={chatCyan} />}</View>
        <View style={styles.attachmentText}>
          <Text style={styles.attachmentTitle} numberOfLines={2}>{attachment.original_name ?? `${attachment.attachment_type} attachment`}</Text>
          <Text style={styles.attachmentMeta}>{attachment.status} / {byteLabel(attachment.byte_size)}</Text>
        </View>
      </View>
      {image && accessUrl ? (
        <Pressable onPress={() => onPreview({ url: accessUrl, title: attachment.original_name ?? "Image", image: true })}>
          <Image source={{ uri: accessUrl }} style={styles.inlineImage} resizeMode="cover" />
        </Pressable>
      ) : null}
      <View style={styles.attachmentActions}>
        {image && !accessUrl ? (
          <Pressable onPress={() => void loadAttachment(false)} disabled={loading} style={styles.attachmentButton}>
            <Text style={styles.attachmentButtonText}>{loading ? "Loading..." : "Load image"}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => void loadAttachment(true)} disabled={loading} style={styles.attachmentButton}>
          <Text style={styles.attachmentButtonText}>{loading ? "Loading..." : image ? "Preview" : "Open"}</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}, areAttachmentCardPropsEqual);

function areAttachmentCardPropsEqual(previous: AttachmentCardProps, next: AttachmentCardProps) {
  return previous.channelId === next.channelId
    && previous.onPreview === next.onPreview
    && attachmentRenderVersion(previous.attachment) === attachmentRenderVersion(next.attachment);
}

const styles = StyleSheet.create({
  messageCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: chatLine,
    backgroundColor: chatPanel,
    padding: spacing.md,
    gap: spacing.sm
  },
  mineCard: {
    borderColor: "#2e5f6d"
  },
  deletedCard: {
    borderStyle: "dashed",
    opacity: 0.78
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  senderAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy
  },
  senderAvatarText: {
    color: chatCyan,
    fontWeight: "900"
  },
  messageMeta: {
    flex: 1,
    minWidth: 0
  },
  sender: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 15
  },
  senderSub: {
    color: chatMuted,
    fontWeight: "700",
    marginTop: 2
  },
  replyBox: {
    borderLeftWidth: 3,
    borderLeftColor: chatCyan,
    borderRadius: radius.sm,
    backgroundColor: chatPanelSoft,
    padding: spacing.sm
  },
  replyText: {
    color: "#d8e7f2",
    lineHeight: 18
  },
  body: {
    color: colors.white,
    fontSize: 18,
    lineHeight: 27
  },
  deletedText: {
    color: chatMuted,
    fontSize: 17,
    fontStyle: "italic",
    lineHeight: 25
  },
  pollCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#2e5f6d",
    backgroundColor: "#162536",
    padding: spacing.sm,
    gap: spacing.sm
  },
  pollHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  pollIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#203a4d"
  },
  pollHeaderText: {
    flex: 1,
    minWidth: 0
  },
  pollQuestion: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 21
  },
  pollMeta: {
    color: chatMuted,
    marginTop: 3,
    fontWeight: "800",
    fontSize: 12
  },
  pollOptions: {
    gap: spacing.xs
  },
  pollOption: {
    minHeight: 46,
    overflow: "hidden",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: chatLine,
    backgroundColor: chatPanel,
    justifyContent: "center"
  },
  pollOptionOn: {
    borderColor: chatCyan
  },
  pollFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(71,199,239,0.18)"
  },
  pollOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  pollCheck: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: chatLine,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#172638"
  },
  pollCheckOn: {
    borderColor: chatCyan,
    backgroundColor: chatCyan
  },
  pollLabel: {
    flex: 1,
    color: colors.white,
    fontWeight: "900",
    lineHeight: 19
  },
  pollPercent: {
    color: chatCyan,
    fontWeight: "900"
  },
  pollSubmit: {
    minHeight: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: chatCyan
  },
  pollSubmitText: {
    color: colors.navy,
    fontWeight: "900"
  },
  pollClosed: {
    color: chatMuted,
    fontWeight: "800"
  },
  hydrationPlaceholder: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: chatLine,
    backgroundColor: "#172838",
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm
  },
  hydrationPlaceholderText: {
    color: chatMuted,
    fontWeight: "800"
  },  reactions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  reactionPill: {
    borderRadius: radius.pill,
    backgroundColor: chatPanelSoft,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  reactionPillOn: {
    backgroundColor: "#244e5d"
  },
  reactionText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 12
  },
  quickReactions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingTop: 2
  },
  quickReaction: {
    minWidth: 42,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: chatPanelSoft
  },
  quickReactionText: {
    color: colors.white,
    fontWeight: "900"
  },
  messageActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingVertical: 2
  },
  actionChip: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.pill,
    backgroundColor: "#172638",
    paddingHorizontal: 10
  },
  actionChipText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 12
  },
  attachmentCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: chatLine,
    backgroundColor: "#172638",
    padding: spacing.sm,
    gap: spacing.sm
  },
  attachmentTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  attachmentIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#24384d"
  },
  attachmentText: {
    flex: 1,
    minWidth: 0
  },
  attachmentTitle: {
    color: colors.white,
    fontWeight: "900",
    lineHeight: 20
  },
  attachmentMeta: {
    color: chatMuted,
    fontSize: 12,
    marginTop: 2
  },
  inlineImage: {
    width: "100%",
    height: 210,
    borderRadius: radius.sm,
    backgroundColor: colors.navy
  },
  attachmentActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  attachmentButton: {
    borderRadius: radius.pill,
    backgroundColor: "#244e5d",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  attachmentButtonText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 12
  },
  errorText: {
    color: "#ff8da0",
    fontWeight: "800",
    fontSize: 12
  },
  sendButtonOff: {
    opacity: 0.45
  }
});

