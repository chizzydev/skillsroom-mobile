import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  FileText,
  Image as ImageIcon,
  ListChecks,
  Lock,
  Paperclip,
  Send,
  Settings,
  SmilePlus,
  X
} from "lucide-react-native";
import { useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { listChatMentionUsers } from "../../../api/chat";
import { colors, radius, spacing } from "../../../constants/theme";
import type { ChatAttachment, ChatChannel, ChatMessage } from "../../../types/api";

const chatPanel = "#1c2b3a";
const chatLine = "#31465a";
const chatMuted = "#a9b6c4";
const chatCyan = "#47c7ef";

const emojiOptions = [
  "\u{1F44D}",
  "GG",
  "\u{1F525}",
  "\u{1F44F}",
  "\u{1F3C6}",
  "\u{2764}\u{FE0F}",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{1F621}",
  "\u{1F4AF}",
  "\u{1F3AE}",
  "\u{2705}",
  "\u{1F440}",
  "\u{1F64C}",
  "\u{1F64F}"
];

type ComposerPanel = "attach" | "emoji" | "poll" | "schedule" | null;

export type PendingAttachment = {
  localId: string;
  name: string;
  state: "uploading" | "ready" | "failed";
  attachment?: ChatAttachment;
  error?: string;
};

type ChatComposerProps = {
  body: string;
  setBody: (value: string) => void;
  target: string;
  channel?: ChatChannel;
  pendingAttachments: PendingAttachment[];
  setPendingAttachments: Dispatch<SetStateAction<PendingAttachment[]>>;
  pickPhoto: () => void;
  pickDocument: () => void;
  sendDisabled: boolean;
  sending: boolean;
  uploading: boolean;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  typingLabels: string[];
  canSchedule: boolean;
  pollLoading: boolean;
  scheduleLoading: boolean;
  onCreatePoll: (input: { question: string; options: string[]; allow_multiple?: boolean; closes_at?: string }) => void;
  onSchedule: (input: { body: string; scheduled_for: string }) => void;
  onSend: () => void;
};

export function ChatComposer({
  body,
  setBody,
  channel,
  pendingAttachments,
  setPendingAttachments,
  pickPhoto,
  pickDocument,
  sendDisabled,
  sending,
  uploading,
  replyTo,
  onCancelReply,
  typingLabels,
  canSchedule,
  pollLoading,
  scheduleLoading,
  onCreatePoll,
  onSchedule,
  onSend
}: ChatComposerProps) {
  const insets = useSafeAreaInsets();
  const [activePanel, setActivePanel] = useState<ComposerPanel>(null);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [scheduleBody, setScheduleBody] = useState("");
  const [scheduleMinutes, setScheduleMinutes] = useState("30");
  const mentionToken = useMemo(() => {
    const match = body.match(/(?:^|\s)@([A-Za-z0-9_]{1,24})$/);
    return match?.[1] ?? "";
  }, [body]);
  const mentionQuery = useQuery({
    queryKey: ["chat", "mention-users", mentionToken],
    queryFn: () => listChatMentionUsers(mentionToken),
    enabled: mentionToken.length >= 1
  });
  const locked = Boolean(channel?.lockdown_until && Date.parse(channel.lockdown_until) > Date.now());
  const slowModeSeconds = Number(channel?.slow_mode_seconds ?? 0);

  function insertMention(user: Record<string, unknown>) {
    const username = String(user.username ?? user.user_username ?? user.display_name ?? "").replace(/^@/, "");
    if (!username) return;
    setBody(body.replace(/(?:^|\s)@([A-Za-z0-9_]{1,24})$/, (match) => `${match.startsWith(" ") ? " " : ""}@${username} `));
  }

  function submitPoll() {
    const options = pollOptions.map((option) => option.trim()).filter(Boolean);
    if (pollQuestion.trim().length < 3 || options.length < 2) return;
    onCreatePoll({ question: pollQuestion.trim(), options, allow_multiple: pollAllowMultiple });
    setPollQuestion("");
    setPollOptions(["", ""]);
    setPollAllowMultiple(false);
    setActivePanel(null);
  }

  function submitSchedule() {
    const minutes = Math.max(2, Number(scheduleMinutes) || 30);
    if (scheduleBody.trim().length < 1) return;
    onSchedule({ body: scheduleBody.trim(), scheduled_for: new Date(Date.now() + minutes * 60_000).toISOString() });
    setScheduleBody("");
    setScheduleMinutes("30");
    setActivePanel(null);
  }

  const bottomInset = Platform.OS === "android"
    ? (insets.bottom > 0 ? Math.max(insets.bottom, spacing.xs) : spacing.xs)
    : Math.max(insets.bottom, spacing.sm);

  return (
    <View style={[styles.composerWrap, { paddingBottom: bottomInset }]}>
      {locked ? (
        <View style={styles.controlNotice}>
          <Lock size={16} color="#ffcf70" />
          <Text style={styles.controlNoticeText}>Posting is paused{channel?.lockdown_reason ? `: ${channel.lockdown_reason}` : "."}</Text>
        </View>
      ) : slowModeSeconds > 0 ? (
        <View style={styles.controlNotice}>
          <Settings size={16} color={chatCyan} />
          <Text style={styles.controlNoticeText}>Slow mode is on: {slowModeSeconds}s between messages.</Text>
        </View>
      ) : null}

      {replyTo ? (
        <View style={styles.replyComposer}>
          <View style={styles.replyComposerText}>
            <Text style={styles.replyComposerTitle}>Replying to {replyTo.sender_label ?? "Skillsroom"}</Text>
            <Text style={styles.replyComposerBody} numberOfLines={2}>{replyTo.body || "Attachment"}</Text>
          </View>
          <Pressable onPress={onCancelReply} style={styles.removeButton}>
            <X size={16} color={colors.white} />
          </Pressable>
        </View>
      ) : null}

      {typingLabels.length ? (
        <View style={styles.typingBar}>
          <View style={styles.typingDots}>
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
          </View>
          <Text style={styles.typingText} numberOfLines={1}>
            {typingLabels.length === 1 ? `${typingLabels[0]} is typing` : `${typingLabels.join(", ")} are typing`}
          </Text>
        </View>
      ) : null}

      {mentionQuery.data?.users?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mentionList}>
          {mentionQuery.data.users.map((user, index) => (
            <Pressable key={`${String(user.id ?? user.username ?? index)}`} onPress={() => insertMention(user)} style={styles.mentionChip}>
              <Text style={styles.mentionName}>{String(user.display_name ?? user.username ?? "Player")}</Text>
              <Text style={styles.mentionHandle}>@{String(user.username ?? user.user_username ?? "player")}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {pendingAttachments.length ? (
        <View style={styles.pendingList}>
          {pendingAttachments.map((attachment) => (
            <View key={attachment.localId} style={styles.pendingAttachment}>
              <View style={styles.pendingIcon}><Paperclip size={16} color={chatCyan} /></View>
              <View style={styles.pendingMain}>
                <Text style={styles.pendingTitle} numberOfLines={1}>{attachment.name}</Text>
                <Text style={[styles.pendingMeta, attachment.state === "failed" && styles.errorText]}>
                  {attachment.state === "uploading" ? "Uploading..." : attachment.state === "ready" ? "Ready to send" : attachment.error ?? "Upload failed"}
                </Text>
              </View>
              <Pressable onPress={() => setPendingAttachments((current) => current.filter((item) => item.localId !== attachment.localId))} style={styles.removeButton}>
                <X size={16} color={colors.white} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {activePanel === "attach" ? (
        <View style={styles.attachMenu}>
          <View style={styles.attachHandle} />
          <View style={styles.attachGrid}>
            <AttachAction disabled={uploading || pendingAttachments.length >= 4} icon={<ImageIcon size={23} color="#8ee9ff" />} label="Photo" onPress={pickPhoto} />
            <AttachAction disabled={uploading || pendingAttachments.length >= 4} icon={<FileText size={23} color="#b7a8ff" />} label="File" onPress={pickDocument} />
            <AttachAction icon={<ListChecks size={23} color="#ffcf70" />} label="Poll" onPress={() => setActivePanel("poll")} />
            {canSchedule ? <AttachAction icon={<CalendarClock size={23} color="#ff7cab" />} label="Schedule" onPress={() => setActivePanel("schedule")} /> : null}
          </View>
          {uploading || pendingAttachments.length >= 4 ? <Text style={styles.attachHint}>Up to 4 attachments can be prepared per message.</Text> : null}
        </View>
      ) : null}

      {activePanel === "emoji" ? (
        <View style={styles.emojiTray}>
          {emojiOptions.map((emoji) => (
            <Pressable key={emoji} onPress={() => setBody(`${body}${body.endsWith(" ") || !body ? "" : " "}${emoji} `)} style={styles.emojiButton}>
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {activePanel === "poll" ? (
        <View style={styles.formPanel}>
          <Text style={styles.formPanelTitle}>Create poll</Text>
          <TextInput value={pollQuestion} onChangeText={setPollQuestion} placeholder="Question" placeholderTextColor={chatMuted} style={styles.formInput} />
          {pollOptions.map((option, index) => (
            <TextInput
              key={index}
              value={option}
              onChangeText={(value) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))}
              placeholder={`Option ${index + 1}`}
              placeholderTextColor={chatMuted}
              style={styles.formInput}
            />
          ))}
          <View style={styles.formActions}>
            <Pressable disabled={pollOptions.length >= 6} onPress={() => setPollOptions((current) => [...current, ""])} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>Add option</Text></Pressable>
            <Pressable onPress={() => setPollAllowMultiple((value) => !value)} style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>{pollAllowMultiple ? "Multiple on" : "Single choice"}</Text>
            </Pressable>
            <Pressable disabled={pollLoading} onPress={submitPoll} style={styles.primaryAction}><Text style={styles.primaryActionText}>{pollLoading ? "Posting..." : "Post poll"}</Text></Pressable>
          </View>
        </View>
      ) : null}

      {activePanel === "schedule" ? (
        <View style={styles.formPanel}>
          <Text style={styles.formPanelTitle}>Schedule announcement</Text>
          <TextInput value={scheduleBody} onChangeText={setScheduleBody} placeholder="Announcement body" placeholderTextColor={chatMuted} multiline style={[styles.formInput, styles.tallFormInput]} />
          <TextInput value={scheduleMinutes} onChangeText={setScheduleMinutes} placeholder="Minutes from now" placeholderTextColor={chatMuted} keyboardType="number-pad" style={styles.formInput} />
          <View style={styles.formActions}>
            <Pressable disabled={scheduleLoading} onPress={submitSchedule} style={styles.primaryAction}><Text style={styles.primaryActionText}>{scheduleLoading ? "Scheduling..." : "Schedule"}</Text></Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.composerRow}>
        <Pressable onPress={() => setActivePanel((value) => value === "attach" ? null : "attach")} style={styles.roundAction}>
          <Paperclip size={22} color={colors.white} strokeWidth={2.7} />
        </Pressable>
        <Pressable onPress={() => setActivePanel((value) => value === "emoji" ? null : "emoji")} style={styles.roundAction}>
          <SmilePlus size={22} color={colors.white} strokeWidth={2.7} />
        </Pressable>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Message"
          placeholderTextColor={chatMuted}
          multiline
          maxLength={5000}
          style={styles.input}
        />
        <Pressable disabled={locked || sendDisabled || sending} onPress={onSend} style={[styles.sendButton, (locked || sendDisabled || sending) && styles.sendButtonOff]}>
          <Send size={22} color={colors.white} fill={colors.white} strokeWidth={2.7} />
        </Pressable>
      </View>
    </View>
  );
}

function AttachAction({
  disabled,
  icon,
  label,
  onPress
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.attachChoice, disabled && styles.attachChoiceDisabled]}>
      <View style={styles.attachIcon}>{icon}</View>
      <Text style={styles.attachChoiceText} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  composerWrap: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: chatLine,
    borderBottomColor: "#263d53",
    backgroundColor: "#18283a",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.sm
  },
  controlNotice: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: chatLine,
    backgroundColor: "#162536",
    paddingHorizontal: spacing.sm
  },
  controlNoticeText: {
    flex: 1,
    color: "#d7e5f2",
    fontWeight: "800",
    lineHeight: 18
  },
  replyComposer: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: chatCyan,
    borderRadius: radius.md,
    backgroundColor: chatPanel,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  replyComposerText: {
    flex: 1
  },
  replyComposerTitle: {
    color: colors.white,
    fontWeight: "900"
  },
  replyComposerBody: {
    color: chatMuted,
    marginTop: 2,
    lineHeight: 18
  },
  typingBar: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: "#132231",
    paddingHorizontal: spacing.sm
  },
  typingDots: {
    flexDirection: "row",
    gap: 3
  },
  typingDot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: chatCyan
  },
  typingText: {
    flex: 1,
    color: chatMuted,
    fontWeight: "800"
  },
  pendingList: {
    gap: spacing.xs
  },
  mentionList: {
    gap: spacing.xs
  },
  mentionChip: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: chatPanel,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: "center"
  },
  mentionName: {
    color: colors.white,
    fontWeight: "900"
  },
  mentionHandle: {
    color: chatCyan,
    fontWeight: "800",
    fontSize: 12,
    marginTop: 2
  },
  pendingAttachment: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: chatPanel,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  pendingIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#24384d"
  },
  pendingMain: {
    flex: 1
  },
  pendingTitle: {
    color: colors.white,
    fontWeight: "900"
  },
  pendingMeta: {
    color: chatMuted,
    fontSize: 12,
    marginTop: 2
  },
  errorText: {
    color: "#ff8da0",
    fontWeight: "800",
    fontSize: 12
  },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3d2633"
  },
  attachMenu: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: chatLine,
    backgroundColor: "#121d29",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm
  },
  attachHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: "#6f8397",
    opacity: 0.75
  },
  attachGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  attachChoice: {
    width: "22.5%",
    minWidth: 70,
    minHeight: 82,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  attachChoiceDisabled: {
    opacity: 0.45
  },
  attachIcon: {
    width: 56,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#2d4358",
    backgroundColor: "#182838",
    alignItems: "center",
    justifyContent: "center"
  },
  attachChoiceText: {
    color: "#d8e4ef",
    fontWeight: "900",
    fontSize: 13,
    textAlign: "center"
  },
  attachHint: {
    color: chatMuted,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  emojiTray: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: "#162536",
    padding: spacing.sm
  },
  emojiButton: {
    minWidth: 42,
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: chatPanel
  },
  emojiText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 17
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
  primaryAction: {
    minHeight: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: chatCyan,
    paddingHorizontal: spacing.md
  },
  primaryActionText: {
    color: colors.navy,
    fontWeight: "900"
  },
  secondaryAction: {
    minHeight: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: chatPanel,
    paddingHorizontal: spacing.md
  },
  secondaryActionText: {
    color: colors.white,
    fontWeight: "900"
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    minHeight: 58
  },
  roundAction: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: chatPanel
  },
  input: {
    flex: 1,
    minHeight: 50,
    maxHeight: 124,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#34506a",
    color: colors.white,
    backgroundColor: chatPanel,
    fontSize: 16,
    lineHeight: 21,
    paddingHorizontal: spacing.md,
    paddingTop: 13,
    paddingBottom: 11,
    textAlignVertical: "center"
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#5f7892"
  },
  sendButtonOff: {
    opacity: 0.45
  }
});
