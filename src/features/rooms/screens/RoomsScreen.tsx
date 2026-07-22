import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Clock3, DoorOpen, FileCheck2, Play, Plus, Search, ShieldCheck, Trophy, Users } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { listRooms } from "../../../api/rooms";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, shadow, spacing } from "../../../constants/theme";
import type { MatchRoom } from "../../../types/api";

type RoomQueue = "open" | "funding" | "ready" | "live" | "result" | "review" | "disputed" | "payout" | "done" | "expired";
type IconComponent = typeof DoorOpen;

const queues: RoomQueue[] = ["open", "funding", "ready", "live", "result", "review", "disputed", "payout", "done", "expired"];
const roomArtwork = require("../../../../assets/marketing/skillsroom-premium/tournaments-premium.png");

function money(minor?: number, currency = "NGN") {
  return `${currency} ${Math.round((minor ?? 0) / 100).toLocaleString()}`;
}

function queueLabel(queue: RoomQueue) {
  if (queue === "funding") return "Funding";
  if (queue === "ready") return "Ready";
  if (queue === "live") return "Live";
  if (queue === "result") return "Result";
  if (queue === "review") return "Review";
  if (queue === "disputed") return "Disputed";
  if (queue === "payout") return "Payout";
  if (queue === "done") return "Done";
  if (queue === "expired") return "Expired";
  return "Open";
}

function queueFullLabel(queue: RoomQueue) {
  if (queue === "open") return "Open rooms";
  if (queue === "funding") return "Funding rooms";
  if (queue === "ready") return "Ready rooms";
  if (queue === "live") return "Live rooms";
  if (queue === "result") return "Result rooms";
  if (queue === "review") return "Review rooms";
  if (queue === "disputed") return "Disputed rooms";
  if (queue === "payout") return "Payout rooms";
  if (queue === "expired") return "Expired challenges";
  return "Done rooms";
}

function queueDescription(queue: RoomQueue) {
  if (queue === "funding") return "Rooms waiting for entry payment or funding approval.";
  if (queue === "ready") return "Rooms funded by both players and waiting for match start.";
  if (queue === "live") return "Rooms currently in play.";
  if (queue === "result") return "Rooms waiting for a player to submit the match result.";
  if (queue === "review") return "Rooms with result evidence waiting for review.";
  if (queue === "disputed") return "Rooms where players disagree and Skillsroom must review.";
  if (queue === "payout") return "Approved results waiting for payout or refund completion.";
  if (queue === "done") return "Completed, refunded, voided, or cancelled rooms.";
  if (queue === "expired") return "H2H challenge rooms whose join window ended before another player accepted.";
  return "Open rooms that can still be joined.";
}

function roomExpired(room: MatchRoom) {
  const expiresAt = room.expires_at;
  if (typeof expiresAt !== "string" && typeof expiresAt !== "number" && !(expiresAt instanceof Date)) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

function roomStatusLabel(status?: string) {
  if (status === "awaiting_funding") return "Entry needed";
  if (status === "funding_review") return "Entry review";
  if (status === "funded") return "Funded";
  if (status === "active") return "Live";
  if (status === "awaiting_results") return "Awaiting results";
  if (status === "under_review") return "Result review";
  if (status === "disputed") return "Disputed";
  if (status === "settlement_pending") return "Payout pending";
  if (status === "completed") return "Done";
  if (status === "draft") return "Draft";
  if (status === "cancelled") return "Cancelled";
  if (status === "voided") return "Voided";
  return "Open";
}

function statusTone(status?: string, expired = false): "cyan" | "green" | "amber" | "red" | "dark" {
  if (expired) return "dark";
  if (status === "open" || status === "funded" || status === "active") return "green";
  if (status === "funding_review" || status === "awaiting_funding" || status === "settlement_pending") return "amber";
  if (status === "disputed" || status === "cancelled" || status === "voided") return "red";
  if (status === "completed" || status === "refunded") return "dark";
  return "cyan";
}

function roomQueue(room: MatchRoom): RoomQueue | "other" {
  if (room.status === "open" && roomExpired(room)) return "expired";
  if (room.status === "draft") return "other";
  if (room.status === "open") return "open";
  if (room.status === "awaiting_funding" || room.status === "funding_review") return "funding";
  if (room.status === "funded") return "ready";
  if (room.status === "active") return "live";
  if (room.status === "awaiting_results") return "result";
  if (room.status === "under_review") return "review";
  if (room.status === "disputed") return "disputed";
  if (room.status === "settlement_pending") return "payout";
  if (["completed", "refunded", "voided", "cancelled"].includes(String(room.status))) return "done";
  return "other";
}

function playerCount(room: MatchRoom) {
  return `${room.participant_count ?? 0}/${room.max_participants ?? 2}`;
}

function nextStep(room: MatchRoom) {
  if (room.status === "open" && roomExpired(room)) return "Expired";
  if (room.status === "open") return (room.participant_count ?? 0) < (room.max_participants ?? 2) ? "Share code" : "Entry next";
  if (room.status === "awaiting_funding") return "Complete entry";
  if (room.status === "funding_review") return "Entry check";
  if (room.status === "funded") return "Start play";
  if (room.status === "active" || room.status === "awaiting_results") return "Submit result";
  if (room.status === "under_review" || room.status === "disputed") return "Review";
  if (room.status === "settlement_pending") return "Payout next";
  if (room.status === "completed") return "Archived";
  return "Open details";
}

export function RoomsScreen() {
  const [selectedQueue, setSelectedQueue] = useState<RoomQueue>("open");
  const [queueGridWidth, setQueueGridWidth] = useState(0);
  const roomsQuery = useQuery({ queryKey: ["rooms"], queryFn: () => listRooms(), refetchInterval: 15000 });

  const rooms = roomsQuery.data ?? [];
  const visibleRooms = useMemo(() => rooms.filter((room) => roomQueue(room) !== "other"), [rooms]);
  const counts = useMemo(() => {
    return queues.reduce<Record<RoomQueue, number>>((acc, queue) => {
      acc[queue] = visibleRooms.filter((room) => roomQueue(room) === queue).length;
      return acc;
    }, { open: 0, funding: 0, ready: 0, live: 0, result: 0, review: 0, disputed: 0, payout: 0, done: 0, expired: 0 });
  }, [visibleRooms]);
  const selectedRooms = useMemo(() => visibleRooms.filter((room) => roomQueue(room) === selectedQueue), [visibleRooms, selectedQueue]);
  const totalTracked = visibleRooms.length;
  const queueColumns = queueGridWidth < 220 ? 2 : queueGridWidth < 340 ? 3 : queueGridWidth < 460 ? 4 : 5;
  const queueGap = 6;
  const queueGridPadding = 10;
  const queueButtonWidth =
    queueGridWidth > 0 ? Math.floor((queueGridWidth - queueGridPadding - queueGap * (queueColumns - 1)) / queueColumns) : undefined;

  return (
    <AppScreen>
      <ImageBackground source={roomArtwork} imageStyle={styles.heroImage} style={styles.hero}>
        <View style={styles.heroShade}>
          <Badge tone="cyan">Match rooms</Badge>
          <Text style={styles.heroTitle}>Create, join, and track rooms.</Text>
          <Text style={styles.heroCopy}>See every room from invite to entry confirmation, live play, result review, and final payout.</Text>
          <View style={styles.heroActions}>
            <AppButton style={styles.heroButton} onPress={() => router.push("/(app)/rooms/new")}>Create room</AppButton>
            <AppButton style={styles.heroButton} variant="secondary" onPress={() => router.push("/(app)/rooms/join")}>Join code</AppButton>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.statsGrid}>
        <StatCard icon={DoorOpen} label="Open" value={counts.open} detail="Can be joined" tone="cyan" />
        <StatCard icon={ShieldCheck} label="Funding" value={counts.funding} detail="Entry check" tone="amber" />
        <StatCard icon={Play} label="Live" value={counts.live} detail="Play or review" tone="green" />
        <StatCard icon={Trophy} label="Tracked" value={totalTracked} detail="All rooms" tone="cyan" />
      </View>

      <SurfaceCard>
        <Badge tone="green">Room flow</Badge>
        <Text style={styles.sectionTitle}>How every room moves</Text>
        <Text style={styles.copy}>Each room shows what needs to happen next, so players are not guessing.</Text>
        <View style={styles.flowList}>
          <FlowStep index="1" title="Open" detail="Create a room or join by code." />
          <FlowStep index="2" title="Confirm entry" detail="Both players complete their entry before play opens." />
          <FlowStep index="3" title="Play" detail="Start the match only when the room says it is ready." />
          <FlowStep index="4" title="Review" detail="Submit the winner, proof, and any response needed." />
          <FlowStep index="5" title="Payout" detail="Approved results move to wallet payout or refund." />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.sectionHead}>
          <View style={styles.fill}>
            <Badge tone="amber">Rooms</Badge>
            <Text style={styles.sectionTitle}>Room activity</Text>
            <Text style={styles.copy}>Switch between every room stage, from open and funding through disputes, payout, done, and expired H2H challenges.</Text>
          </View>
          <Pressable style={styles.searchButton} onPress={() => router.push("/(app)/rooms/join")}>
            <Search size={22} color={colors.ink} />
          </Pressable>
        </View>
        <View style={styles.queueGrid} onLayout={(event) => setQueueGridWidth(event.nativeEvent.layout.width)}>
          {queues.map((queue) => (
            <Pressable
              key={queue}
              onPress={() => setSelectedQueue(queue)}
              style={[styles.queueButton, queueButtonWidth ? { width: queueButtonWidth } : null, selectedQueue === queue && styles.queueButtonOn]}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.queueText, selectedQueue === queue && styles.queueTextOn]}>
                {queueLabel(queue)}
              </Text>
              {counts[queue] ? <Text style={[styles.queueCount, selectedQueue === queue && styles.queueTextOn]}>{counts[queue]}</Text> : null}
            </Pressable>
          ))}
        </View>

        {roomsQuery.isLoading ? <Text style={styles.copy}>Loading rooms...</Text> : null}
        {roomsQuery.isError ? <FeedbackState tone="error" title="Unable to load rooms" body="Check your connection and try again." actionLabel="Retry" onAction={() => void roomsQuery.refetch()} /> : null}
        {!roomsQuery.isLoading && !roomsQuery.isError && selectedRooms.length === 0 ? (
          <FeedbackState title={`No ${queueFullLabel(selectedQueue).toLowerCase()}`} body={queueDescription(selectedQueue)} />
        ) : null}

        <View style={styles.roomList}>
          {selectedRooms.map((room) => <RoomCard key={room.id} room={room} />)}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Badge>Join code</Badge>
        <Text style={styles.sectionTitle}>Have a private code?</Text>
        <Text style={styles.copy}>Paste a private code to join an open room. Your profile and game identity are confirmed before entry.</Text>
        <AppButton variant="secondary" onPress={() => router.push("/(app)/rooms/join")}>Open join screen</AppButton>
      </SurfaceCard>
    </AppScreen>
  );
}

function StatCard({ icon: Icon, label, value, detail, tone }: { icon: IconComponent; label: string; value: number; detail: string; tone: "cyan" | "green" | "amber" }) {
  return (
    <SurfaceCard style={styles.stat}>
      <View style={[styles.statIcon, tone === "green" ? styles.greenIcon : tone === "amber" ? styles.amberIcon : styles.cyanIcon]}>
        <Icon size={22} color={tone === "green" ? colors.greenDark : tone === "amber" ? colors.amber : colors.cyan} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statCopy}>{detail}</Text>
    </SurfaceCard>
  );
}

function FlowStep({ index, title, detail }: { index: string; title: string; detail: string }) {
  return (
    <View style={styles.flowStep}>
      <Text style={styles.flowIndex}>{index}</Text>
      <View style={styles.fill}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.copy}>{detail}</Text>
      </View>
    </View>
  );
}

function RoomCard({ room }: { room: MatchRoom }) {
  const expired = room.status === "open" && roomExpired(room);
  return (
    <Pressable style={styles.roomCard} onPress={() => router.push(`/(app)/rooms/${room.id}`)}>
      <View style={styles.roomTop}>
        <Badge tone={statusTone(room.status, expired)}>{expired ? "Expired" : roomStatusLabel(room.status)}</Badge>
        <Text style={styles.roomPlayers}>{playerCount(room)}</Text>
      </View>
      <Text style={styles.roomTitle}>{room.title ?? "Skillsroom match"}</Text>
      <Text style={styles.roomMeta}>{room.room_code ?? "No code"} / {money(room.entry_amount_minor, room.currency)}</Text>
      <View style={styles.roomFacts}>
        <View style={styles.factPill}><Users size={16} color={colors.cyan} /><Text style={styles.factText}>Players {playerCount(room)}</Text></View>
        <View style={styles.factPill}><Clock3 size={16} color={colors.cyan} /><Text style={styles.factText}>{nextStep(room)}</Text></View>
      </View>
      {expired ? <FormNotice tone="info" message="This challenge window ended before another player accepted. Open it for history, or post a fresh challenge." /> : null}
      <View style={styles.roomFooter}>
        <Text style={styles.openText}>Open room</Text>
        <ChevronLike />
      </View>
    </Pressable>
  );
}

function ChevronLike() {
  return <Text style={styles.chevron}>›</Text>;
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 430,
    overflow: "hidden",
    borderRadius: radius.lg,
    backgroundColor: colors.navy,
    ...shadow.card
  },
  heroImage: { borderRadius: radius.lg },
  heroShade: {
    minHeight: 430,
    padding: spacing.lg,
    justifyContent: "space-between",
    backgroundColor: "rgba(4,12,24,0.72)"
  },
  heroTitle: { color: colors.white, fontSize: 42, lineHeight: 48, fontWeight: "900" },
  heroCopy: { color: "#d4deea", fontSize: 17, lineHeight: 26 },
  heroActions: { flexDirection: "row", gap: spacing.md },
  heroButton: { flex: 1 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  stat: { flexBasis: "47%", flexGrow: 1, padding: spacing.md },
  statIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  cyanIcon: { backgroundColor: colors.cyanSoft },
  greenIcon: { backgroundColor: colors.greenSoft },
  amberIcon: { backgroundColor: colors.amberSoft },
  statLabel: { color: colors.faint, textTransform: "uppercase", letterSpacing: 2, fontWeight: "900", fontSize: 11 },
  statValue: { color: colors.ink, fontSize: 34, fontWeight: "900" },
  statCopy: { color: colors.muted, fontWeight: "700" },
  sectionTitle: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: "900" },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  itemTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  fill: { flex: 1 },
  searchButton: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  flowList: { gap: spacing.sm },
  flowStep: { flexDirection: "row", gap: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceAlt },
  flowIndex: { width: 38, height: 38, borderRadius: 14, textAlign: "center", textAlignVertical: "center", color: colors.cyan, backgroundColor: colors.cyanSoft, fontSize: 18, fontWeight: "900" },
  queueGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: 4
  },
  queueButton: {
    minHeight: 44,
    flexShrink: 0,
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: 4,
    paddingVertical: spacing.xs
  },
  queueButtonOn: { backgroundColor: colors.white, ...shadow.card },
  queueText: { color: colors.muted, fontWeight: "900", fontSize: 11, textAlign: "center", minWidth: 0 },
  queueTextOn: { color: colors.ink },
  queueCount: { color: colors.faint, fontWeight: "900", fontSize: 11 },
  roomList: { gap: spacing.md },
  roomCard: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.white, gap: spacing.sm, ...shadow.card },
  roomTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  roomPlayers: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  roomTitle: { color: colors.ink, fontSize: 23, lineHeight: 29, fontWeight: "900" },
  roomMeta: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  roomFacts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  factPill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: spacing.sm, minHeight: 36, backgroundColor: colors.surfaceAlt },
  factText: { color: colors.muted, fontWeight: "900" },
  roomFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  openText: { color: colors.ink, fontWeight: "900" },
  chevron: { color: colors.cyan, fontSize: 30, fontWeight: "900" }
});
