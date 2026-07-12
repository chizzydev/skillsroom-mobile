import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Bell, ChevronRight, ExternalLink, MessageCircle, Plus, ShieldCheck, Swords, Trophy, Wallet } from "lucide-react-native";
import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { listChannels, listDmRequests } from "../../../api/chat";
import { listNotifications } from "../../../api/notifications";
import { profileOverview } from "../../../api/profile";
import { listRooms } from "../../../api/rooms";
import { listTournaments } from "../../../api/tournaments";
import { walletOverview } from "../../../api/wallet";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { env } from "../../../config/env";
import { colors, radius, shadow, spacing } from "../../../constants/theme";
import { useAuthStore } from "../../../store/auth-store";
import type { MatchRoom } from "../../../types/api";
import { openNativeCommunity, openNativeGuide, openPublicWeb } from "../../public/navigation";

type Tone = "cyan" | "green" | "amber" | "red";

const liveRoomStatuses = ["funded", "active", "awaiting_results", "under_review", "disputed", "settlement_pending"];
const roomSteps = [
  ["Open", "Find an opponent or share the room code."],
  ["Confirm", "Both players confirm entry before play starts."],
  ["Play", "Run the match under the room rules."],
  ["Resolve", "Submit the result and screenshots so the winner is paid correctly."]
] as const;
const communityArtwork = require("../../../../assets/marketing/skillsroom-premium/community-premium.png");

function money(minor?: number, currency = "NGN") {
  return `${currency} ${Math.round((minor ?? 0) / 100).toLocaleString()}`;
}

function roomRank(room: MatchRoom) {
  const rank: Record<string, number> = {
    open: 1,
    awaiting_funding: 2,
    funding_review: 3,
    funded: 4,
    active: 5,
    awaiting_results: 6,
    under_review: 7,
    disputed: 8,
    settlement_pending: 9,
    completed: 10
  };
  return rank[String(room.status ?? "open")] ?? 20;
}

function firstName(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "player";
  return trimmed.split(/\s+/)[0];
}

export function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const roomsQuery = useQuery({ queryKey: ["home", "rooms"], queryFn: () => listRooms() });
  const profileQuery = useQuery({ queryKey: ["home", "profile"], queryFn: profileOverview });
  const walletQuery = useQuery({ queryKey: ["home", "wallet"], queryFn: walletOverview });
  const tournamentsQuery = useQuery({ queryKey: ["home", "tournaments"], queryFn: () => listTournaments({ limit: 6 }) });
  const channelsQuery = useQuery({ queryKey: ["home", "channels"], queryFn: listChannels });
  const dmRequestsQuery = useQuery({ queryKey: ["home", "dm-requests"], queryFn: listDmRequests });
  const notificationsQuery = useQuery({ queryKey: ["notifications", "unread"], queryFn: () => listNotifications("unread") });

  const rooms = roomsQuery.data ?? [];
  const openRooms = rooms.filter((room) => room.status === "open");
  const fundingRooms = rooms.filter((room) => room.status === "awaiting_funding" || room.status === "funding_review");
  const liveRooms = rooms.filter((room) => liveRoomStatuses.includes(String(room.status)));
  const priorityRooms = useMemo(() => [...rooms].sort((left, right) => roomRank(left) - roomRank(right)).slice(0, 3), [rooms]);
  const unreadChannels = (channelsQuery.data ?? []).reduce((sum, channel) => sum + (channel.unread_count ?? 0), 0);
  const dmRequests = (dmRequestsQuery.data ?? []).filter((request) => request.status === "pending").length;
  const unreadNotifications = notificationsQuery.data?.length ?? 0;
  const availableBalance = walletQuery.data?.balance?.available_minor ?? walletQuery.data?.account?.available_balance_minor ?? 0;
  const currency = walletQuery.data?.balance?.currency ?? walletQuery.data?.account?.currency ?? "NGN";
  const profile = profileQuery.data;
  const missingProfileItems = profile?.completion?.missing?.length ?? 0;
  const readinessCopy = missingProfileItems === 0 ? "Ready for rooms, prizes, and tournaments." : `${missingProfileItems} setup item${missingProfileItems === 1 ? "" : "s"} left.`;
  const tournaments = tournamentsQuery.data ?? [];

  return (
    <AppScreen>
      <SurfaceCard dark style={styles.hero}>
        <View style={styles.heroTop}>
          <Badge tone="cyan">Skillsroom</Badge>
          <Pressable style={styles.inboxButton} onPress={() => router.push("/(app)/notifications")}>
            <Bell color={colors.white} size={19} strokeWidth={2.5} />
            {unreadNotifications + dmRequests > 0 ? <Text style={styles.inboxCount}>{unreadNotifications + dmRequests}</Text> : null}
          </Pressable>
        </View>
        <Text style={styles.heroTitle}>Welcome back, {firstName(user?.display_name ?? user?.username)}.</Text>
        <Text style={styles.heroCopy}>Find a fair room, confirm entry once, play under clear rules, and keep every result easy to prove.</Text>
        <View style={styles.heroActions}>
          <AppButton style={styles.heroAction} onPress={() => router.push("/(app)/rooms/new")}>Create room</AppButton>
          <AppButton style={styles.heroAction} variant="secondary" onPress={() => router.push("/(app)/rooms/join")}>Join code</AppButton>
        </View>
      </SurfaceCard>

      <View style={styles.statsGrid}>
        <MetricCard label="Open" value={openRooms.length} detail="Can be joined" tone="cyan" icon={<Swords color={colors.cyan} size={20} />} />
        <MetricCard label="Entries" value={fundingRooms.length} detail="Needs confirmation" tone="amber" icon={<ShieldCheck color={colors.amber} size={20} />} />
        <MetricCard label="Live" value={liveRooms.length} detail="Play or finish" tone="green" icon={<Trophy color={colors.greenDark} size={20} />} />
        <MetricCard label="Unread" value={unreadChannels} detail="Chat signals" tone="red" icon={<MessageCircle color={colors.red} size={20} />} />
      </View>

      {roomsQuery.isError || walletQuery.isError || profileQuery.isError ? (
        <FeedbackState tone="error" title="Some dashboard data could not load" body="The app is still usable. Open a section directly or retry when the connection settles." actionLabel="Retry" onAction={() => {
          void roomsQuery.refetch();
          void walletQuery.refetch();
          void profileQuery.refetch();
        }} />
      ) : null}

      <View style={styles.quickGrid}>
        <ActionTile title="Balance" value={money(availableBalance, currency)} detail="Available for entry" icon={<Wallet color={colors.greenDark} size={20} />} onPress={() => router.push("/(app)/(tabs)/wallet")} />
        <ActionTile title="Readiness" value={missingProfileItems === 0 ? "Ready" : "Setup"} detail={readinessCopy} icon={<ShieldCheck color={colors.cyan} size={20} />} onPress={() => router.push("/(app)/(tabs)/profile")} />
      </View>

      <SurfaceCard>
        <SectionHeader eyebrow="Lobby" title="Rooms needing action" action="View all" onPress={() => router.push("/(app)/(tabs)/rooms")} />
        {roomsQuery.isLoading ? <Text style={styles.copy}>Loading room activity...</Text> : null}
        {!roomsQuery.isLoading && priorityRooms.length === 0 ? (
          <EmptyPanel title="No active rooms yet" body="Create a room for your game or join with a code from your community." action="Create room" onPress={() => router.push("/(app)/rooms/new")} />
        ) : null}
        {priorityRooms.map((room) => (
          <Pressable key={room.id} style={styles.roomRow} onPress={() => router.push(`/(app)/rooms/${room.id}`)}>
            <View style={styles.roomMain}>
              <Text style={styles.roomTitle}>{room.title ?? "Private match room"}</Text>
              <Text style={styles.roomMeta}>{room.room_code ?? "No code"} - {money(room.entry_amount_minor, room.currency)} - {room.participant_count ?? 0}/{room.max_participants ?? 2} players</Text>
            </View>
            <ChevronRight color={colors.faint} size={21} />
          </Pressable>
        ))}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader eyebrow="Events" title="Tournament board" action="Open" onPress={() => router.push("/(app)/(tabs)/tournaments")} />
        {tournamentsQuery.isLoading ? <Text style={styles.copy}>Loading tournaments...</Text> : null}
        {!tournamentsQuery.isLoading && tournaments.length === 0 ? <Text style={styles.copy}>No published tournaments are available yet.</Text> : null}
        {tournaments.slice(0, 2).map((tournament) => (
          <Pressable key={tournament.id} style={styles.eventRow} onPress={() => router.push(`/(app)/tournaments/${tournament.id}`)}>
            <View style={styles.eventText}>
              <Text style={styles.roomTitle}>{tournament.title}</Text>
              <Text style={styles.roomMeta}>{tournament.game_name ?? tournament.game_slug ?? "Tournament"} - {tournament.registered_entry_count ?? 0}/{tournament.max_entries} entries</Text>
            </View>
            <Badge tone={tournament.status === "in_progress" ? "amber" : "cyan"}>{String(tournament.status).replaceAll("_", " ")}</Badge>
          </Pressable>
        ))}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader eyebrow="Community" title="Chat and DMs" action={dmRequests > 0 ? `${dmRequests} request${dmRequests === 1 ? "" : "s"}` : "Open"} onPress={() => router.push("/(app)/(tabs)/chat")} />
        <View style={styles.communityRow}>
          <MessageCircle color={colors.cyan} size={24} />
          <View style={styles.roomMain}>
            <Text style={styles.roomTitle}>{unreadChannels > 0 ? `${unreadChannels} unread message${unreadChannels === 1 ? "" : "s"}` : "No unread messages"}</Text>
            <Text style={styles.roomMeta}>Global chat, game channels, room chats, and DMs stay in one place.</Text>
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.eyebrow}>Room flow</Text>
        <Text style={styles.sectionTitle}>How every room moves</Text>
        <View style={styles.steps}>
          {roomSteps.map(([label, detail], index) => (
            <View key={label} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.roomMain}>
                <Text style={styles.stepTitle}>{label}</Text>
                <Text style={styles.copy}>{detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.communityHub}>
        <Text style={styles.eyebrow}>Community hub</Text>
        <Text style={styles.sectionTitle}>See what is happening around Skillsroom</Text>
        <Text style={styles.copy}>Find platform news, tournament updates, clans, player highlights, and winner posts without digging through menus.</Text>
        <Image source={communityArtwork} style={styles.communityImage} resizeMode="cover" />
        <View style={styles.linkGrid}>
          <LinkButton title="Open Community hub" onPress={() => openNativeCommunity("hub")} />
          <LinkButton title="View highlights" variant="secondary" onPress={() => openNativeCommunity("highlights")} />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.eyebrow}>Trust</Text>
        <Text style={styles.sectionTitle}>Before you play</Text>
        <TrustNote text="Room entries are checked before play. Results need clear screenshots before prizes are released." />
        <TrustNote text="Keep your game handle and screenshots clear so reviews can move quickly." />
      </SurfaceCard>

      <View style={styles.footer}>
        <View style={styles.footerBrand}>
          <Text style={styles.footerMark}>SR</Text>
          <Text style={styles.footerTitle}>Skillsroom</Text>
        </View>
        <Text style={styles.footerCopy}>Private competitive rooms with clear rules, entry checks, result records, and support when something goes wrong.</Text>
        <View style={styles.footerLinks}>
          {([
            ["Guide", () => openNativeGuide("how-it-works")],
            ["Rules", () => openNativeGuide("rules")],
            ["Trust", () => openNativeGuide("trust")],
            ["Support", () => openNativeGuide("support")],
            ["Prizes", () => openPublicWeb("/prizes")],
            ["Disputes", () => openPublicWeb("/disputes")]
          ] satisfies Array<[string, () => void]>).map(([label, onPress]) => (
            <Pressable key={label} style={styles.footerLink} onPress={onPress}>
              <Text style={styles.footerLinkText}>{label}</Text>
              <ExternalLink color={colors.faint} size={12} />
            </Pressable>
          ))}
        </View>
      </View>
    </AppScreen>
  );
}

function SectionHeader({ eyebrow, title, action, onPress }: { eyebrow: string; title: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.roomMain}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Pressable style={styles.sectionAction} onPress={onPress}>
        <Text style={styles.sectionActionText}>{action}</Text>
      </Pressable>
    </View>
  );
}

function MetricCard({ label, value, detail, tone, icon }: { label: string; value: number; detail: string; tone: Tone; icon: React.ReactNode }) {
  return (
    <SurfaceCard style={styles.metric}>
      <View style={[styles.metricIcon, styles[`${tone}Soft`]]}>{icon}</View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </SurfaceCard>
  );
}

function ActionTile({ title, value, detail, icon, onPress }: { title: string; value: string; detail: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable style={styles.actionTile} onPress={onPress}>
      <View style={styles.tileIcon}>{icon}</View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileDetail}>{detail}</Text>
    </Pressable>
  );
}

function EmptyPanel({ title, body, action, onPress }: { title: string; body: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.emptyPanel}>
      <Text style={styles.roomTitle}>{title}</Text>
      <Text style={styles.copy}>{body}</Text>
      <Pressable style={styles.emptyAction} onPress={onPress}>
        <Plus color={colors.navy} size={18} strokeWidth={2.5} />
        <Text style={styles.emptyActionText}>{action}</Text>
      </Pressable>
    </View>
  );
}

function LinkButton({ title, variant, onPress }: { title: string; variant?: "secondary"; onPress: () => void }) {
  return (
    <Pressable style={[styles.linkButton, variant === "secondary" && styles.linkButtonSecondary]} onPress={onPress}>
      <Text style={[styles.linkButtonText, variant === "secondary" && styles.linkButtonTextSecondary]}>{title}</Text>
    </Pressable>
  );
}

function TrustNote({ text }: { text: string }) {
  return (
    <View style={styles.trustNote}>
      <ShieldCheck color={colors.greenDark} size={19} style={styles.trustIcon} />
      <Text style={[styles.copy, styles.trustCopy]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.lg },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  inboxButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#1d3147",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navySoft
  },
  inboxCount: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: colors.red,
    color: colors.white,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "900"
  },
  heroTitle: { color: colors.white, fontSize: 34, lineHeight: 39, fontWeight: "900" },
  heroCopy: { color: "#c8d4df", fontSize: 16, lineHeight: 24 },
  heroActions: { flexDirection: "row", gap: spacing.md },
  heroAction: { flex: 1 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metric: { flexBasis: "47%", flexGrow: 1, padding: spacing.md, gap: spacing.sm },
  metricIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  cyanSoft: { backgroundColor: colors.cyanSoft },
  greenSoft: { backgroundColor: colors.greenSoft },
  amberSoft: { backgroundColor: colors.amberSoft },
  redSoft: { backgroundColor: colors.redSoft },
  metricLabel: { color: colors.faint, textTransform: "uppercase", letterSpacing: 2, fontWeight: "900", fontSize: 10 },
  metricValue: { color: colors.ink, fontSize: 32, fontWeight: "900" },
  metricDetail: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  quickGrid: { flexDirection: "row", gap: spacing.md },
  actionTile: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card
  },
  tileIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  tileTitle: { color: colors.faint, textTransform: "uppercase", letterSpacing: 1.6, fontWeight: "900", fontSize: 10 },
  tileValue: { color: colors.ink, fontSize: 21, fontWeight: "900" },
  tileDetail: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  sectionAction: { minHeight: 36, borderRadius: radius.pill, backgroundColor: colors.cyanSoft, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
  sectionActionText: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  eyebrow: { color: colors.cyan, textTransform: "uppercase", letterSpacing: 2, fontWeight: "900", fontSize: 11 },
  sectionTitle: { color: colors.ink, fontSize: 24, lineHeight: 29, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  roomRow: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    backgroundColor: colors.surfaceAlt
  },
  roomMain: { flex: 1, minWidth: 0 },
  roomTitle: { color: colors.ink, fontSize: 16, lineHeight: 21, fontWeight: "900" },
  roomMeta: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  eventRow: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, gap: spacing.md, backgroundColor: colors.surfaceAlt },
  eventText: { gap: spacing.xs },
  communityRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceAlt },
  emptyPanel: { borderWidth: 1, borderColor: colors.line, borderStyle: "dashed", borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.lg, gap: spacing.sm },
  emptyAction: { alignSelf: "flex-start", minHeight: 38, borderRadius: radius.pill, backgroundColor: colors.green, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md },
  emptyActionText: { color: colors.navy, fontWeight: "900" },
  steps: { gap: spacing.lg },
  stepRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  stepNumber: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.cyanSoft, alignItems: "center", justifyContent: "center" },
  stepNumberText: { color: colors.cyan, fontWeight: "900", fontSize: 16 },
  stepTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: 4 },
  communityHub: { overflow: "hidden" },
  communityImage: { width: "100%", height: 178, borderRadius: radius.md, backgroundColor: colors.navy },
  linkGrid: { gap: spacing.sm },
  linkButton: { minHeight: 46, borderRadius: radius.sm, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  linkButtonSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  linkButtonText: { color: colors.navy, fontWeight: "900" },
  linkButtonTextSecondary: { color: colors.ink },
  trustNote: { flexDirection: "row", gap: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceAlt, alignItems: "flex-start" },
  trustIcon: { marginTop: 2 },
  trustCopy: { flex: 1, minWidth: 0 },
  footer: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, marginBottom: spacing.md },
  footerBrand: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  footerMark: { width: 34, height: 34, borderRadius: radius.sm, overflow: "hidden", textAlign: "center", textAlignVertical: "center", backgroundColor: colors.navySoft, color: colors.green, fontWeight: "900" },
  footerTitle: { color: colors.white, fontWeight: "900", fontSize: 16 },
  footerCopy: { color: "#c8d4df", fontSize: 13, lineHeight: 19 },
  footerLinks: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  footerLink: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#1d3147", borderRadius: radius.pill, paddingHorizontal: spacing.sm, minHeight: 34 },
  footerLinkText: { color: "#dbe7f0", fontSize: 12, fontWeight: "900" }
});
