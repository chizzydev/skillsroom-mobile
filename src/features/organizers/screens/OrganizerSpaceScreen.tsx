import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Bell, CalendarDays, ExternalLink, Megaphone, Radio, ShieldCheck, Trophy, Users } from "lucide-react-native";
import React from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import {
  organizerSpace,
  type OrganizerAnnouncement,
  type OrganizerEvent,
  type OrganizerHighlight,
  type OrganizerLivestream,
  type OrganizerMember
} from "../../../api/community";
import { AppScreen } from "../../../components/screen/AppScreen";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, shadow, spacing } from "../../../constants/theme";

type OrganizerTab = "events" | "members" | "streams" | "updates" | "highlights";
type Tone = "cyan" | "green" | "amber" | "red";

const tabs: Array<{ key: OrganizerTab; label: string }> = [
  { key: "events", label: "Events" },
  { key: "members", label: "Members" },
  { key: "streams", label: "Streams" },
  { key: "updates", label: "Updates" },
  { key: "highlights", label: "Highlights" }
];

const statusLabels: Record<string, string> = {
  published: "Published",
  registration_open: "Taking entries",
  registration_locked: "Entries locked",
  seeding: "Seeding",
  in_progress: "Live",
  awaiting_results: "Results due",
  under_review: "Review",
  disputed: "Dispute review",
  settlement_pending: "Prize review",
  completed: "Completed"
};

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusLabel(status: string) {
  return statusLabels[status] ?? status.replaceAll("_", " ");
}

function statusTone(status: string): Tone {
  if (status === "in_progress") return "green";
  if (status === "registration_open") return "cyan";
  if (status === "completed") return "green";
  if (status === "disputed" || status === "under_review") return "red";
  return "amber";
}

function formatDate(value?: string | null) {
  if (!value) return "Date to be announced";
  return new Date(value).toLocaleString("en-NG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function money(minor?: number, currency = "NGN") {
  return `${currency} ${Math.round((minor ?? 0) / 100).toLocaleString()}`;
}

function organizerKindLabel(kind?: string) {
  return kind === "clan" ? "Clan space" : "Host space";
}

export function OrganizerSpaceScreen() {
  const params = useLocalSearchParams<{ organizerIdOrSlug?: string }>();
  const organizerIdOrSlug = stringParam(params.organizerIdOrSlug) ?? "";
  const [tab, setTab] = React.useState<OrganizerTab>("events");
  const query = useQuery({
    queryKey: ["community", "organizer", organizerIdOrSlug],
    queryFn: () => organizerSpace(organizerIdOrSlug),
    enabled: Boolean(organizerIdOrSlug)
  });

  if (query.isError) {
    return (
      <AppScreen>
        <FeedbackState
          tone="error"
          title="Organizer space could not load"
          body="This organizer page may be unavailable right now. Try again from Community."
          actionLabel="Retry"
          onAction={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  const space = query.data;
  const organizer = space?.organizer;
  const location = [organizer?.city, organizer?.campus].filter(Boolean).join(" / ") || organizer?.region || "Online";
  const leader = organizer?.captain_display_name || organizer?.captain_username || "Visible organizer";

  return (
    <AppScreen>
      <SurfaceCard dark style={styles.hero}>
        <View style={styles.heroTop}>
          <Pressable accessibilityLabel="Go back" style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.7} />
          </Pressable>
          <Badge tone="cyan">{organizerKindLabel(organizer?.kind)}</Badge>
          <Pressable accessibilityLabel="Notifications" style={styles.iconButton} onPress={() => router.push("/(app)/notifications")}>
            <Bell color={colors.white} size={19} strokeWidth={2.5} />
          </Pressable>
        </View>
        {organizer?.banner_url ? <Image source={{ uri: organizer.banner_url }} resizeMode="cover" style={styles.banner} /> : null}
        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            {organizer?.avatar_url ? <Image source={{ uri: organizer.avatar_url }} resizeMode="cover" style={styles.avatarImage} /> : <Text style={styles.avatarText}>{organizer?.name?.slice(0, 2).toUpperCase() ?? "SR"}</Text>}
          </View>
          <View style={styles.main}>
            <Text style={styles.heroTitle}>{organizer?.name ?? "Organizer space"}</Text>
            <Text style={styles.heroCopy}>{organizer?.description ?? "Public events, members, streams, updates, and highlights from this organizer."}</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{location}</Text>
          <Text style={styles.metaText}>Led by {leader}</Text>
        </View>
        <View style={styles.focusRow}>
          {(organizer?.game_focus?.length ? organizer.game_focus : ["All games"]).map((game) => <Badge key={game} tone="dark">{game}</Badge>)}
        </View>
      </SurfaceCard>

      {query.isLoading ? <Text style={styles.loadingText}>Loading organizer space...</Text> : null}

      {space ? (
        <>
          <View style={styles.metricGrid}>
            <MetricTile label="Events" value={String(space.record.events_hosted)} detail="Public events" tone="cyan" />
            <MetricTile label="Completed" value={String(space.record.completed_events)} detail="Finished events" tone="green" />
            <MetricTile label="Wins" value={String(space.record.tournament_wins)} detail="First-place finishes" tone="amber" />
            <MetricTile label="Record" value={`${space.record.match_wins}-${space.record.match_losses}-${space.record.match_draws}`} detail="Match results" tone="green" />
          </View>

          <View style={styles.tabs}>
            {tabs.map((item) => (
              <Pressable key={item.key} style={[styles.tab, tab === item.key && styles.tabActive]} onPress={() => setTab(item.key)}>
                <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          {tab === "events" ? (
            <SurfaceCard>
              <SectionTitle icon={<CalendarDays color={colors.cyan} size={24} />} eyebrow="Events" title="Public events" />
              {space.events.map((event) => <EventCard event={event} key={event.tournament_id} />)}
              {!space.events.length ? <EmptyPanel title="No public events yet" body="Events will appear here when this organizer hosts or joins public tournaments." /> : null}
            </SurfaceCard>
          ) : null}

          {tab === "members" ? (
            <SurfaceCard>
              <SectionTitle icon={<Users color={colors.greenDark} size={24} />} eyebrow="Members" title={organizer?.kind === "clan" ? "Clan members" : "Event hosts"} />
              {space.members.map((member) => <MemberCard key={member.user_id} member={member} />)}
              {!space.members.length ? <EmptyPanel title="No public members yet" body="Members and co-hosts appear here when their public profiles are visible." /> : null}
            </SurfaceCard>
          ) : null}

          {tab === "streams" ? (
            <SurfaceCard>
              <SectionTitle icon={<Radio color={colors.red} size={24} />} eyebrow="Streams" title="Livestreams" />
              {space.livestreams.map((stream) => <StreamCard key={stream.id} stream={stream} />)}
              {!space.livestreams.length ? <EmptyPanel title="No streams yet" body="Public livestream links will appear here when events add them." /> : null}
            </SurfaceCard>
          ) : null}

          {tab === "updates" ? (
            <SurfaceCard>
              <SectionTitle icon={<Megaphone color={colors.amber} size={24} />} eyebrow="Updates" title="Announcements" />
              {space.announcements.map((announcement) => <AnnouncementCard announcement={announcement} key={announcement.id} />)}
              {!space.announcements.length ? <EmptyPanel title="No announcements yet" body="Published event updates from this organizer will appear here." /> : null}
            </SurfaceCard>
          ) : null}

          {tab === "highlights" ? (
            <SurfaceCard>
              <SectionTitle icon={<Trophy color={colors.amber} size={24} />} eyebrow="Highlights" title="Completed moments" />
              {space.highlights.map((highlight) => <HighlightCard highlight={highlight} key={highlight.tournament_id} />)}
              {!space.highlights.length ? <EmptyPanel title="No highlights yet" body="Winner moments and completed events will appear here." /> : null}
            </SurfaceCard>
          ) : null}
        </>
      ) : null}
    </AppScreen>
  );
}

function SectionTitle({ eyebrow, icon, title }: { eyebrow: string; icon: React.ReactNode; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.main}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {icon}
    </View>
  );
}

function MetricTile({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: Tone }) {
  return (
    <SurfaceCard style={[styles.metricTile, styles[`${tone}Edge`]]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, styles[`${tone}Text`]]}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </SurfaceCard>
  );
}

function EventCard({ event }: { event: OrganizerEvent }) {
  return (
    <Pressable style={styles.itemCard} onPress={() => router.push(`/(app)/tournaments/${event.tournament_id}`)}>
      <View style={styles.itemTop}>
        <Badge tone={statusTone(event.status)}>{statusLabel(event.status)}</Badge>
        <Text style={styles.dateText}>{formatDate(event.starts_at)}</Text>
      </View>
      <Text style={styles.itemTitle}>{event.title}</Text>
      <Text style={styles.copy}>{event.game_name} - {event.format.replaceAll("_", " ")}</Text>
      <View style={styles.detailGrid}>
        <MiniSummary label="Entries" value={String(event.registered_entry_count)} />
        <MiniSummary label="Prize" value={money(event.prize_pool_minor, event.currency)} />
        <MiniSummary label="Role" value={event.role_label} />
      </View>
    </Pressable>
  );
}

function MemberCard({ member }: { member: OrganizerMember }) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTop}>
        <Badge tone={member.role === "captain" || member.role === "creator" ? "cyan" : "green"}>{member.role}</Badge>
        <Text style={styles.dateText}>{member.reputation_score ? `${member.reputation_score} trust` : "Public player"}</Text>
      </View>
      <Text style={styles.itemTitle}>{member.display_name || member.username || "Player"}</Text>
      <Text style={styles.copy}>{[member.city, member.campus].filter(Boolean).join(" / ") || "Visible member"}</Text>
    </View>
  );
}

function StreamCard({ stream }: { stream: OrganizerLivestream }) {
  return (
    <Pressable style={styles.itemCard} onPress={() => void Linking.openURL(stream.stream_url)}>
      <View style={styles.itemTop}>
        <Badge tone={stream.is_featured ? "green" : "cyan"}>{stream.provider}</Badge>
        <ExternalLink color={colors.faint} size={16} />
      </View>
      <Text style={styles.itemTitle}>{stream.title}</Text>
      <Text style={styles.copy}>{stream.tournament_title ?? "Organizer stream"} - {formatDate(stream.created_at)}</Text>
    </Pressable>
  );
}

function AnnouncementCard({ announcement }: { announcement: OrganizerAnnouncement }) {
  return (
    <Pressable style={styles.itemCard} onPress={() => router.push(`/community/announcements/${encodeURIComponent(announcement.id)}` as never)}>
      <View style={styles.itemTop}>
        <Badge tone={announcement.priority === "critical" || announcement.priority === "high" ? "red" : "cyan"}>{announcement.category.replaceAll("_", " ")}</Badge>
        <Text style={styles.dateText}>{formatDate(announcement.published_at)}</Text>
      </View>
      <Text style={styles.itemTitle}>{announcement.title}</Text>
      <Text style={styles.copy}>{announcement.summary}</Text>
      {announcement.tournament_title ? <Text style={styles.contextText}>{announcement.tournament_title}</Text> : null}
    </Pressable>
  );
}

function HighlightCard({ highlight }: { highlight: OrganizerHighlight }) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTop}>
        <Badge tone="green">Highlight</Badge>
        <Text style={styles.dateText}>{formatDate(highlight.ends_at)}</Text>
      </View>
      <Text style={styles.itemTitle}>{highlight.title}</Text>
      <Text style={styles.copy}>{highlight.game_name} - {highlight.completed_match_count} completed matches</Text>
      <View style={styles.detailGrid}>
        <MiniSummary label="Winner" value={highlight.champion_entry_name ?? "Winner pending"} />
        <MiniSummary label="Prize" value={money(highlight.projected_prize_minor)} />
      </View>
    </View>
  );
}

function MiniSummary({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniSummary}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyPanel}>
      <ShieldCheck color={colors.cyan} size={22} />
      <View style={styles.main}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.copy}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.lg, overflow: "hidden" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#1d3147",
    backgroundColor: colors.navySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  banner: { width: "100%", height: 150, borderRadius: radius.lg, backgroundColor: colors.navySoft },
  identityRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 74, height: 74, borderRadius: radius.lg, borderWidth: 1, borderColor: "#25364b", backgroundColor: colors.navySoft, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { color: colors.green, fontSize: 20, fontWeight: "900" },
  heroTitle: { color: colors.white, fontSize: 30, lineHeight: 36, fontWeight: "900" },
  heroCopy: { color: "#c8d4df", fontSize: 15, lineHeight: 22 },
  metaRow: { gap: spacing.xs },
  metaText: { color: "#d7e3ee", fontSize: 13, fontWeight: "800" },
  focusRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  loadingText: { color: colors.muted, fontWeight: "900", textAlign: "center" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metricTile: { flexBasis: "47%", flexGrow: 1, borderTopWidth: 4 },
  cyanEdge: { borderTopColor: colors.cyan },
  greenEdge: { borderTopColor: colors.greenDark },
  amberEdge: { borderTopColor: colors.amber },
  redEdge: { borderTopColor: colors.red },
  metricLabel: { color: colors.faint, textTransform: "uppercase", letterSpacing: 2, fontWeight: "900", fontSize: 10 },
  metricValue: { fontSize: 27, lineHeight: 33, fontWeight: "900" },
  metricDetail: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "800" },
  cyanText: { color: colors.cyan },
  greenText: { color: colors.greenDark },
  amberText: { color: colors.amber },
  redText: { color: colors.red },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tab: { flexGrow: 1, minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  tabActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  tabText: { color: colors.muted, fontWeight: "900", fontSize: 13 },
  tabTextActive: { color: colors.white },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  main: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.cyan, textTransform: "uppercase", letterSpacing: 2, fontWeight: "900", fontSize: 11 },
  sectionTitle: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  itemCard: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.md, gap: spacing.sm, ...shadow.card },
  itemTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  itemTitle: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  dateText: { color: colors.faint, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  contextText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  miniSummary: { flexGrow: 1, flexBasis: "30%", borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.white, padding: spacing.sm },
  miniLabel: { color: colors.faint, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  miniValue: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 4 },
  emptyPanel: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, borderWidth: 1, borderColor: colors.line, borderStyle: "dashed", borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" }
});
