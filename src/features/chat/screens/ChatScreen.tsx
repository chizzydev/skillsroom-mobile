import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Hash, MessageCircle, Search, ShieldCheck, UserPlus, Users } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { listChannels, listDmRequests } from "../../../api/chat";
import { AppScreen } from "../../../components/screen/AppScreen";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { colors, radius, spacing } from "../../../constants/theme";
import { useAuthStore } from "../../../store/auth-store";
import type { ChatChannel, ChatDmRequest } from "../../../types/api";

type ChatView = "channels" | "dms";

const chatBg = "#111f2c";
const chatPanel = "#1c2b3a";
const chatPanelSoft = "#233446";
const chatLine = "#31465a";
const chatMuted = "#a9b6c4";
const chatCyan = "#47c7ef";
const chatGreen = "#19c58b";

function channelTarget(channel: ChatChannel) {
  return channel.slug || channel.id;
}

function channelTitle(channel: ChatChannel) {
  if (channel.channel_type === "dm") return channel.dm_peer_label ?? channel.dm_peer_display_name ?? channel.title;
  if (channel.slug === "global_lobby") return "Global Chat";
  return channel.title ?? channel.slug ?? "Chat";
}

function channelKind(channel: ChatChannel) {
  if (channel.channel_type === "dm") return "DM";
  if (channel.slug === "global_lobby") return "GC";
  return channel.channel_type === "game" ? "Game" : channel.channel_type.replaceAll("_", " ");
}

function channelSubtitle(channel: ChatChannel) {
  const prefix = channel.channel_type === "dm" ? "Direct message" : `${channelKind(channel)} / ${channel.online_count ?? 0} online`;
  if (channel.last_message_body) {
    return `${prefix} / ${channel.last_message_sender_label ? `${channel.last_message_sender_label}: ` : ""}${channel.last_message_body}`;
  }
  if (channel.description) return `${prefix} / ${channel.description}`;
  return prefix;
}

function initialsFor(value?: string | null) {
  const text = value?.trim() || "SR";
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return text.slice(0, 3).toUpperCase();
}

function requestPeer(request: ChatDmRequest) {
  return request.peer_label ?? request.requester_label ?? request.recipient_label ?? request.peer_username ?? "Player";
}

export function ChatScreen() {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [view, setView] = useState<ChatView>("channels");
  const channelsQuery = useQuery({ queryKey: ["chat", "channels"], queryFn: listChannels, refetchInterval: 30000 });
  const dmRequestsQuery = useQuery({ queryKey: ["chat", "dm-requests"], queryFn: listDmRequests, refetchInterval: 30000 });

  const channels = channelsQuery.data ?? [];
  const dmRequests = dmRequestsQuery.data ?? [];
  const globalChannel = channels.find((channel) => channel.slug === "global_lobby" || channel.channel_type === "lobby");
  const publicChannels = channels.filter((channel) => channel.channel_type !== "dm" && channel.id !== globalChannel?.id);
  const dmChannels = channels.filter((channel) => channel.channel_type === "dm");
  const pendingRequests = useMemo(() => dmRequests.filter((request) => request.status === "pending"), [dmRequests]);
  const incomingPendingRequests = useMemo(
    () => pendingRequests.filter((request) => currentUserId && request.recipient_user_id === currentUserId),
    [currentUserId, pendingRequests]
  );
  const acceptedRequests = useMemo(() => dmRequests.filter((request) => request.status === "accepted"), [dmRequests]);
  const unreadCount = channels.reduce((sum, channel) => sum + Number(channel.unread_count ?? 0), 0);
  const onlineCount = channels.reduce((sum, channel) => sum + Number(channel.online_count ?? 0), 0);
  const loadingChannels = channelsQuery.isLoading && channels.length === 0;

  const openChannel = (channel: ChatChannel) => {
    const target = channelTarget(channel);
    if (target) router.push(`/(app)/chat/${encodeURIComponent(target)}`);
  };

  return (
    <AppScreen>
      <View style={styles.shell}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <MessageCircle size={16} color={chatCyan} />
              <Text style={styles.heroBadgeText}>Chat</Text>
            </View>
            <Pressable onPress={() => globalChannel ? openChannel(globalChannel) : undefined} style={styles.heroIcon}>
              <Search size={20} color={colors.white} strokeWidth={2.7} />
            </Pressable>
          </View>
          <Text style={styles.heroTitle}>Global, rooms, and DMs.</Text>
          <View style={styles.heroStats}>
            <StatPill label="Online" value={loadingChannels ? null : onlineCount} />
            <StatPill label="Unread" value={loadingChannels ? null : unreadCount} alert={unreadCount > 0} />
            <StatPill label="DM requests" value={dmRequestsQuery.isLoading && !dmRequests.length ? null : incomingPendingRequests.length} alert={incomingPendingRequests.length > 0} />
          </View>
        </View>

        {channelsQuery.isError ? (
          <FeedbackState tone="error" title="Chat unavailable" body="We could not load your chat list right now." actionLabel="Retry" onAction={() => void channelsQuery.refetch()} />
        ) : null}

        <View style={styles.nav}>
          <Pressable onPress={() => setView("channels")} style={[styles.navButton, view === "channels" && styles.navButtonOn]}>
            <Hash size={18} color={view === "channels" ? colors.navy : chatMuted} strokeWidth={2.7} />
            <Text style={[styles.navText, view === "channels" && styles.navTextOn]}>Channels</Text>
          </Pressable>
          <Pressable onPress={() => setView("dms")} style={[styles.navButton, view === "dms" && styles.navButtonOn]}>
            <Users size={18} color={view === "dms" ? colors.navy : chatMuted} strokeWidth={2.7} />
            <Text style={[styles.navText, view === "dms" && styles.navTextOn]}>DMs</Text>
          </Pressable>
        </View>

        {view === "channels" ? (
          <View style={styles.section}>
            {globalChannel ? <ChannelRow channel={globalChannel} featured onPress={() => openChannel(globalChannel)} /> : null}
            <Text style={styles.sectionLabel}>Your accessible channels</Text>
            {loadingChannels ? <LoadingChannelList /> : null}
            {publicChannels.map((channel) => (
              <ChannelRow key={channel.id} channel={channel} onPress={() => openChannel(channel)} />
            ))}
            {!channelsQuery.isLoading && !globalChannel && publicChannels.length === 0 ? (
              <FeedbackState title="No channels yet" body="Your community channels will appear here when the server adds you to them." />
            ) : null}
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.dmManager}>
              <View style={styles.dmManagerIcon}>
                <UserPlus size={22} color={chatCyan} />
              </View>
              <View style={styles.dmManagerText}>
                <Text style={styles.dmManagerTitle}>Direct messages</Text>
                <Text style={styles.dmManagerCopy}>{incomingPendingRequests.length} incoming request{incomingPendingRequests.length === 1 ? "" : "s"}</Text>
              </View>
              <Pressable onPress={() => router.push("/(app)/chat/dm-requests")} style={styles.manageButton}>
                <Text style={styles.manageButtonText}>Manage</Text>
              </Pressable>
            </View>

            {dmChannels.map((channel) => (
              <ChannelRow key={channel.id} channel={channel} onPress={() => openChannel(channel)} />
            ))}
            {acceptedRequests
              .filter((request) => request.channel_slug && !dmChannels.some((channel) => channel.slug === request.channel_slug))
              .map((request) => (
                <Pressable key={request.id} onPress={() => request.channel_slug && router.push(`/(app)/chat/${encodeURIComponent(request.channel_slug)}`)} style={styles.channelRow}>
                  <View style={styles.channelAvatar}>
                    <Text style={styles.channelAvatarText}>{initialsFor(requestPeer(request))}</Text>
                  </View>
                  <View style={styles.channelText}>
                    <Text style={styles.channelTitle}>{requestPeer(request)}</Text>
                    <Text style={styles.channelCopy}>Accepted DM request / open thread</Text>
                  </View>
                </Pressable>
              ))}
            {!dmRequestsQuery.isLoading && dmChannels.length === 0 && acceptedRequests.length === 0 ? (
              <FeedbackState title="No DMs yet" body="Start a request from the DM manager or accept an incoming request." />
            ) : null}
          </View>
        )}
      </View>
    </AppScreen>
  );
}

function StatPill({ label, value, alert }: { label: string; value: number | null; alert?: boolean }) {
  return (
    <View style={[styles.statPill, alert && styles.statPillAlert]}>
      <Text style={styles.statValue}>{value ?? "..."}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LoadingChannelList() {
  return (
    <View style={styles.loadingList}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.loadingRow}>
          <View style={styles.loadingAvatar} />
          <View style={styles.loadingText}>
            <View style={styles.loadingTitle} />
            <View style={styles.loadingLine} />
          </View>
        </View>
      ))}
    </View>
  );
}

function ChannelRow({ channel, featured, onPress }: { channel: ChatChannel; featured?: boolean; onPress: () => void }) {
  const unread = Number(channel.unread_count ?? 0);
  const locked = channel.status === "locked" || Boolean(channel.lockdown_until);

  return (
    <Pressable onPress={onPress} style={[styles.channelRow, featured && styles.featuredRow]}>
      <View style={[styles.channelAvatar, featured && styles.featuredAvatar]}>
        <Text style={styles.channelAvatarText}>{initialsFor(channelTitle(channel))}</Text>
        {Number(channel.online_count ?? 0) > 0 ? <View style={styles.onlineDot} /> : null}
      </View>
      <View style={styles.channelText}>
        <View style={styles.channelTitleRow}>
          <Text style={styles.channelTitle} numberOfLines={1}>{channelTitle(channel)}</Text>
          {locked ? <ShieldCheck size={15} color="#ffcf70" /> : null}
        </View>
        <Text style={styles.channelCopy} numberOfLines={2}>{channelSubtitle(channel)}</Text>
      </View>
      {unread > 0 ? <Text style={styles.unread}>{unread}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: spacing.md
  },
  hero: {
    borderRadius: radius.lg,
    backgroundColor: colors.navy,
    padding: spacing.lg,
    gap: spacing.md
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  heroBadge: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#294056",
    backgroundColor: "#132233",
    paddingHorizontal: spacing.sm
  },
  heroBadgeText: {
    color: colors.white,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#203347"
  },
  heroTitle: {
    color: colors.white,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "900"
  },
  heroStats: {
    flexDirection: "row",
    gap: spacing.xs
  },
  statPill: {
    flex: 1,
    minHeight: 62,
    borderRadius: radius.md,
    backgroundColor: "#162638",
    padding: spacing.sm
  },
  statPillAlert: {
    borderWidth: 1,
    borderColor: chatCyan
  },
  statValue: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 20
  },
  statLabel: {
    color: chatMuted,
    fontWeight: "800",
    fontSize: 11,
    marginTop: 2
  },
  nav: {
    flexDirection: "row",
    backgroundColor: chatPanel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: chatLine,
    padding: 4
  },
  navButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.sm
  },
  navButtonOn: {
    backgroundColor: chatCyan
  },
  navText: {
    color: chatMuted,
    fontWeight: "900"
  },
  navTextOn: {
    color: colors.navy
  },
  section: {
    gap: spacing.sm
  },
  loadingList: {
    gap: spacing.sm
  },
  loadingRow: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: chatPanel,
    opacity: 0.7,
    padding: spacing.sm
  },
  loadingAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: chatPanelSoft
  },
  loadingText: {
    flex: 1,
    gap: spacing.xs
  },
  loadingTitle: {
    width: "52%",
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: chatPanelSoft
  },
  loadingLine: {
    width: "82%",
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: chatPanelSoft
  },
  sectionLabel: {
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 3,
    fontWeight: "900",
    fontSize: 12,
    marginTop: spacing.xs
  },
  channelRow: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: chatPanel,
    borderWidth: 1,
    borderColor: "transparent",
    padding: spacing.sm
  },
  featuredRow: {
    borderColor: "#2e5f6d",
    backgroundColor: "#182d40"
  },
  channelAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: chatPanelSoft
  },
  featuredAvatar: {
    backgroundColor: colors.navy
  },
  channelAvatarText: {
    color: chatCyan,
    fontWeight: "900"
  },
  onlineDot: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: chatGreen,
    borderWidth: 2,
    borderColor: chatPanel
  },
  channelText: {
    flex: 1,
    minWidth: 0
  },
  channelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  channelTitle: {
    flexShrink: 1,
    color: colors.white,
    fontWeight: "900",
    fontSize: 18
  },
  channelCopy: {
    color: chatMuted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4
  },
  unread: {
    minWidth: 30,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: "#18a9df",
    color: colors.white,
    textAlign: "center",
    fontWeight: "900"
  },
  dmManager: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: chatLine,
    backgroundColor: chatBg,
    padding: spacing.sm
  },
  dmManagerIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#17364a"
  },
  dmManagerText: {
    flex: 1,
    minWidth: 0
  },
  dmManagerTitle: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 18
  },
  dmManagerCopy: {
    color: chatMuted,
    fontWeight: "800",
    marginTop: 3
  },
  manageButton: {
    minHeight: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: chatCyan,
    paddingHorizontal: spacing.md
  },
  manageButtonText: {
    color: colors.navy,
    fontWeight: "900"
  }
});
