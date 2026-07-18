import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Bell, CheckCircle2, MessageCircle, ShieldCheck, Star, Trophy } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Image, Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import {
  communityAnnouncements,
  communityClans,
  communityHighlights,
  communityLeaderboard,
  communitySocialProof,
  type CommunityAnnouncement,
  type CommunityClan,
  type CommunityHighlight,
  type CommunityLeaderboardRow
} from "../../../api/community";
import { AppScreen } from "../../../components/screen/AppScreen";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { env } from "../../../config/env";
import { colors, radius, shadow, spacing } from "../../../constants/theme";

type CommunityTab = "hub" | "proof" | "highlights" | "updates" | "clans" | "rankings";
type Tone = "cyan" | "green" | "amber" | "red";

const communityArtwork = require("../../../../assets/marketing/skillsroom-premium/community-premium.png");
const tabs: Array<{ key: CommunityTab; label: string }> = [
  { key: "hub", label: "Hub" },
  { key: "proof", label: "Proof" },
  { key: "highlights", label: "Highlights" },
  { key: "updates", label: "Updates" },
  { key: "clans", label: "Clans" },
  { key: "rankings", label: "Rankings" }
];

function cleanTab(value: unknown): CommunityTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return tabs.some((tab) => tab.key === raw) ? (raw as CommunityTab) : "hub";
}

function compactNumber(value?: number) {
  const safe = value ?? 0;
  if (safe >= 1_000_000) return `${(safe / 1_000_000).toFixed(1)}M`;
  if (safe >= 1_000) return `${(safe / 1_000).toFixed(1)}K`;
  return safe.toLocaleString();
}

function money(minor?: number, currency = "NGN") {
  return `${currency} ${Math.round((minor ?? 0) / 100).toLocaleString()}`;
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

function readable(value?: string | null) {
  return value ? value.replaceAll("_", " ") : "Community";
}

function winnerName(item: CommunityHighlight) {
  return item.champion_display_name ?? item.champion_username ?? item.champion_entry_name ?? "Winner pending";
}

function runnerUpName(item: CommunityHighlight) {
  return item.runner_up_display_name ?? item.runner_up_username ?? item.runner_up_entry_name ?? "Runner-up pending";
}

function publicTournamentUrl(item: CommunityHighlight) {
  return `${env.webAppUrl}/tournaments/${encodeURIComponent(item.tournament_slug || item.tournament_id)}`;
}

function highlightShareText(item: CommunityHighlight) {
  return `${winnerName(item)} won ${item.title} on Skillsroom. Prize: ${money(item.projected_prize_minor, item.currency)}. ${publicTournamentUrl(item)}`;
}

async function shareHighlight(item: CommunityHighlight) {
  const message = highlightShareText(item);
  try {
    await Share.share({ message, title: `${item.title} result` });
  } catch {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    void Linking.openURL(url);
  }
}

function openWhatsAppShare(item: CommunityHighlight) {
  const url = `https://wa.me/?text=${encodeURIComponent(highlightShareText(item))}`;
  void Linking.openURL(url);
}

export function CommunityHubScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<CommunityTab>(() => cleanTab(params.tab));
  const proofQuery = useQuery({ queryKey: ["community", "social-proof"], queryFn: communitySocialProof });
  const announcementsQuery = useQuery({ queryKey: ["community", "announcements"], queryFn: () => communityAnnouncements(6) });
  const highlightsQuery = useQuery({ queryKey: ["community", "highlights"], queryFn: () => communityHighlights(8) });
  const clansQuery = useQuery({ queryKey: ["community", "clans"], queryFn: () => communityClans(5) });
  const leaderboardQuery = useQuery({ queryKey: ["community", "leaderboard"], queryFn: () => communityLeaderboard(10) });

  const metrics = proofQuery.data;
  const announcements = announcementsQuery.data ?? [];
  const highlights = highlightsQuery.data ?? [];
  const clans = clansQuery.data ?? [];
  const leaderboard = leaderboardQuery.data?.leaderboard ?? [];
  const loading = proofQuery.isLoading || announcementsQuery.isLoading || highlightsQuery.isLoading || clansQuery.isLoading || leaderboardQuery.isLoading;
  const hasError = proofQuery.isError || announcementsQuery.isError || highlightsQuery.isError || clansQuery.isError || leaderboardQuery.isError;
  const heroStats = useMemo(
    () => [
      { label: "Players", value: compactNumber(metrics?.players_registered), tone: "cyan" as Tone },
      { label: "Matches", value: compactNumber(metrics?.matches_completed), tone: "green" as Tone },
      { label: "Winners", value: compactNumber(metrics?.winners_crowned), tone: "amber" as Tone }
    ],
    [metrics]
  );

  function retryAll() {
    void proofQuery.refetch();
    void announcementsQuery.refetch();
    void highlightsQuery.refetch();
    void clansQuery.refetch();
    void leaderboardQuery.refetch();
  }

  return (
    <AppScreen>
      <SurfaceCard dark style={styles.hero}>
        <View style={styles.heroTop}>
          <Pressable accessibilityLabel="Go back" style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.7} />
          </Pressable>
          <Badge tone="cyan">Community</Badge>
          <Pressable accessibilityLabel="Notifications" style={styles.iconButton} onPress={() => router.push("/(app)/notifications")}>
            <Bell color={colors.white} size={19} strokeWidth={2.5} />
          </Pressable>
        </View>
        <Text style={styles.heroTitle}>See who is winning and what is happening.</Text>
        <Text style={styles.heroCopy}>Follow platform updates, winner moments, active clans, and player rankings without leaving the app.</Text>
        <View style={styles.heroStats}>
          {heroStats.map((item) => (
            <View key={item.label} style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{item.value}</Text>
              <Text style={styles.heroStatLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </SurfaceCard>

      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable key={item.key} style={[styles.tab, tab === item.key && styles.tabActive]} onPress={() => setTab(item.key)}>
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {hasError ? (
        <FeedbackState
          tone="error"
          title="Community data could not load"
          body="Check the connection and retry. Community updates will appear here once the app can reach Skillsroom."
          actionLabel="Retry"
          onAction={retryAll}
        />
      ) : null}
      {loading && !hasError ? <Text style={styles.loadingText}>Loading community activity...</Text> : null}

      {tab === "hub" ? (
        <>
          <SurfaceCard style={styles.artCard}>
            <Image source={communityArtwork} resizeMode="cover" style={styles.artwork} />
            <View style={styles.artOverlay}>
              <Text style={styles.overlayEyebrow}>Live platform proof</Text>
              <Text style={styles.overlayText}>Completed rooms, tournaments, winners, and updates stay easy to find.</Text>
            </View>
          </SurfaceCard>
          <View style={styles.metricGrid}>
            <MetricTile label="Tournaments" value={compactNumber(metrics?.tournaments_hosted)} detail="Hosted events" tone="cyan" />
            <MetricTile label="Clans" value={compactNumber(metrics?.clans_created)} detail="Community groups" tone="green" />
            <MetricTile label="Prize reserves" value={money(metrics?.prize_reservations_minor)} detail="Visible commitment" tone="amber" />
            <MetricTile label="Payout queue" value={compactNumber(metrics?.payout_queue_count)} detail="Waiting review" tone="red" />
          </View>
          <SurfaceCard>
            <SectionTitle eyebrow="Updates" title="Recent platform announcements" action="View all" onPress={() => setTab("updates")} />
            {announcements.slice(0, 2).map((item) => <AnnouncementCard key={item.id} item={item} compact />)}
            {!announcements.length && !loading ? <EmptyPanel title="No announcements yet" body="Platform updates and official news will appear here." /> : null}
          </SurfaceCard>
          <SurfaceCard>
            <SectionTitle eyebrow="Highlights" title="Winners and completed events" action="View all" onPress={() => setTab("highlights")} />
            {highlights.slice(0, 2).map((item) => <HighlightCard key={item.tournament_id} item={item} compact />)}
            {!highlights.length && !loading ? <EmptyPanel title="No winner highlights yet" body="Completed tournaments and winner moments will appear here." /> : null}
          </SurfaceCard>
        </>
      ) : null}

      {tab === "proof" ? (
        <>
          <SurfaceCard>
            <SectionTitle eyebrow="Proof" title="Public proof board" />
            <View style={styles.metricGrid}>
              <MetricTile label="Completed rooms" value={compactNumber(metrics?.matches_completed)} detail="Finished matches" tone="green" />
              <MetricTile label="Verified winners" value={compactNumber(metrics?.winners_crowned)} detail="Approved results" tone="amber" />
              <MetricTile label="Reviews closed" value={compactNumber(metrics?.disputes_resolved)} detail="Resolved fairly" tone="cyan" />
              <MetricTile label="Active clans" value={compactNumber(metrics?.clans_created)} detail="Groups to follow" tone="red" />
            </View>
            <ProofNote />
          </SurfaceCard>
          <SurfaceCard>
            <SectionTitle eyebrow="Result cards" title="Shareable winner cards" />
            {highlights.map((item) => <PublicResultCard key={item.tournament_id} item={item} />)}
            {!highlights.length && !loading ? <EmptyPanel title="No public result cards yet" body="Approved completed events will create shareable proof cards." /> : null}
          </SurfaceCard>
          <SurfaceCard>
            <SectionTitle eyebrow="Tournament history" title="Completed event trail" />
            {highlights.map((item) => <TournamentHistoryRow key={`${item.tournament_id}:history`} item={item} />)}
            {!highlights.length && !loading ? <EmptyPanel title="No completed event history yet" body="Finished tournaments will appear here once results are approved." /> : null}
          </SurfaceCard>
        </>
      ) : null}

      {tab === "highlights" ? (
        <SurfaceCard>
          <SectionTitle eyebrow="Highlights" title="Winner moments" />
          {highlights.map((item) => <HighlightCard key={item.tournament_id} item={item} />)}
          {!highlights.length && !loading ? <EmptyPanel title="No highlights yet" body="When tournaments finish, the best moments will live here." /> : null}
        </SurfaceCard>
      ) : null}

      {tab === "updates" ? (
        <SurfaceCard>
          <SectionTitle eyebrow="Updates" title="Platform announcements" />
          {announcements.map((item) => <AnnouncementCard key={item.id} item={item} />)}
          {!announcements.length && !loading ? <EmptyPanel title="No updates yet" body="Maintenance notes, tournament updates, and community news will appear here." /> : null}
        </SurfaceCard>
      ) : null}

      {tab === "clans" ? (
        <SurfaceCard>
          <SectionTitle eyebrow="Clans" title="Featured community groups" />
          {clans.map((item) => <ClanCard key={item.id} item={item} />)}
          {!clans.length && !loading ? <EmptyPanel title="No featured clans yet" body="Clans will appear here as community groups become active." /> : null}
        </SurfaceCard>
      ) : null}

      {tab === "rankings" ? (
        <>
          <SurfaceCard>
            <SectionTitle eyebrow="Rankings" title="Community leaderboard" />
            <View style={styles.summaryGrid}>
              <MiniSummary label="Ranked players" value={compactNumber(leaderboardQuery.data?.summary.ranked_players)} />
              <MiniSummary label="Active games" value={compactNumber(leaderboardQuery.data?.summary.active_games)} />
              <MiniSummary label="Cities" value={compactNumber(leaderboardQuery.data?.summary.active_cities)} />
            </View>
            {leaderboard.map((item) => <LeaderboardItem key={item.user_id} item={item} />)}
            {!leaderboard.length && !loading ? <EmptyPanel title="No ranking data yet" body="Players appear here after completed competitive activity." /> : null}
          </SurfaceCard>
        </>
      ) : null}
    </AppScreen>
  );
}

function SectionTitle({ eyebrow, title, action, onPress }: { eyebrow: string; title: string; action?: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.main}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action && onPress ? (
        <Pressable style={styles.sectionAction} onPress={onPress}>
          <Text style={styles.sectionActionText}>{action}</Text>
        </Pressable>
      ) : null}
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

function AnnouncementCard({ item, compact }: { item: CommunityAnnouncement; compact?: boolean }) {
  return (
    <Pressable style={styles.itemCard} onPress={() => router.push(`/community/announcements/${encodeURIComponent(item.id)}` as never)}>
      <View style={styles.itemTop}>
        <Badge tone={item.priority === "critical" || item.priority === "high" ? "red" : "cyan"}>{readable(item.category)}</Badge>
        <Text style={styles.dateText}>{formatDate(item.published_at ?? item.created_at)}</Text>
      </View>
      <Text style={styles.itemTitle}>{item.title}</Text>
      <Text style={styles.copy} numberOfLines={compact ? 2 : 4}>{item.summary || item.body}</Text>
      {item.tournament_title || item.game_name ? <Text style={styles.contextText}>{item.tournament_title ?? item.game_name}</Text> : null}
    </Pressable>
  );
}

function HighlightCard({ item, compact }: { item: CommunityHighlight; compact?: boolean }) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTop}>
        <Badge tone="green">Winner</Badge>
        <Text style={styles.dateText}>{formatDate(item.ends_at ?? item.starts_at)}</Text>
      </View>
      <Text style={styles.itemTitle}>{item.title}</Text>
      <Text style={styles.copy} numberOfLines={compact ? 2 : undefined}>{item.game_name} - {readable(item.format)}</Text>
      <View style={styles.resultRow}>
        <View style={styles.resultIcon}>
          <Trophy color={colors.amber} size={18} strokeWidth={2.5} />
        </View>
        <View style={styles.main}>
          <Text style={styles.resultLabel}>Champion</Text>
          <Text style={styles.resultValue}>{winnerName(item)}</Text>
        </View>
      </View>
      <View style={styles.detailGrid}>
        <MiniSummary label="Prize" value={money(item.projected_prize_minor, item.currency)} />
        <MiniSummary label="Entries" value={String(item.registered_entry_count)} />
        <MiniSummary label="Matches" value={String(item.completed_match_count)} />
      </View>
      <View style={styles.shareActions}>
        <Pressable style={styles.shareButton} onPress={() => void shareHighlight(item)}>
          <MessageCircle color={colors.ink} size={16} />
          <Text style={styles.shareButtonText}>Share result</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PublicResultCard({ item }: { item: CommunityHighlight }) {
  return (
    <SurfaceCard dark style={styles.resultCard}>
      <View style={styles.itemTop}>
        <Badge tone="green">Verified winner</Badge>
        <Text style={styles.darkDate}>{formatDate(item.ends_at ?? item.starts_at)}</Text>
      </View>
      <Text style={styles.resultCardTitle}>{winnerName(item)}</Text>
      <Text style={styles.resultCardCopy}>won {item.title} on Skillsroom</Text>
      <View style={styles.resultCardStats}>
        <DarkStat label="Prize" value={money(item.projected_prize_minor, item.currency)} />
        <DarkStat label="Entries" value={String(item.registered_entry_count)} />
        <DarkStat label="Matches" value={String(item.completed_match_count)} />
      </View>
      <View style={styles.resultCardFooter}>
        <Text style={styles.resultCardMeta}>{item.game_name} - {readable(item.format)}</Text>
        <Pressable style={styles.whatsappButton} onPress={() => openWhatsAppShare(item)}>
          <MessageCircle color={colors.navy} size={16} />
          <Text style={styles.whatsappButtonText}>WhatsApp</Text>
        </Pressable>
      </View>
    </SurfaceCard>
  );
}

function TournamentHistoryRow({ item }: { item: CommunityHighlight }) {
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyIcon}>
        <CheckCircle2 color={colors.greenDark} size={18} />
      </View>
      <View style={styles.main}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.copy}>{winnerName(item)} beat the field. Runner-up: {runnerUpName(item)}.</Text>
        <View style={styles.detailGrid}>
          <MiniSummary label="Game" value={item.game_name} />
          <MiniSummary label="Prize" value={money(item.projected_prize_minor, item.currency)} />
          <MiniSummary label="Finished" value={formatDate(item.ends_at ?? item.starts_at)} />
        </View>
      </View>
    </View>
  );
}

function ProofNote() {
  return (
    <View style={styles.proofNote}>
      <ShieldCheck color={colors.greenDark} size={20} />
      <View style={styles.main}>
        <Text style={styles.proofNoteTitle}>Only approved activity becomes public proof.</Text>
        <Text style={styles.copy}>Unfinished matches, open disputes, private proof files, and admin notes stay out of public result cards.</Text>
      </View>
    </View>
  );
}

function DarkStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.darkStat}>
      <Text style={styles.darkStatLabel}>{label}</Text>
      <Text style={styles.darkStatValue}>{value}</Text>
    </View>
  );
}

function ClanCard({ item }: { item: CommunityClan }) {
  const record = item.match_record;
  return (
    <Pressable style={styles.itemCard} onPress={() => router.push({
      pathname: "/community/organizers/[organizerIdOrSlug]",
      params: { organizerIdOrSlug: item.slug }
    } as never)}>
      <View style={styles.itemTop}>
        <Badge tone="cyan">{item.tag ?? "Clan"}</Badge>
        <Text style={styles.dateText}>{item.region}{item.city ? `, ${item.city}` : ""}</Text>
      </View>
      <Text style={styles.itemTitle}>{item.name}</Text>
      <Text style={styles.copy} numberOfLines={3}>{item.description ?? "Competitive community group with visible performance history."}</Text>
      <View style={styles.detailGrid}>
        <MiniSummary label="Members" value={String(item.member_count)} />
        <MiniSummary label="Record" value={`${record.wins}-${record.losses}-${record.draws}`} />
        <MiniSummary label="Wins" value={String(item.tournament_wins)} />
      </View>
      <Text style={styles.contextText}>Open organizer space</Text>
    </Pressable>
  );
}

function LeaderboardItem({ item }: { item: CommunityLeaderboardRow }) {
  const name = item.display_name ?? item.username;
  return (
    <View style={styles.rankRow}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankBadgeText}>{item.rank}</Text>
      </View>
      <View style={styles.main}>
        <Text style={styles.itemTitle}>{name}</Text>
        <Text style={styles.copy}>{item.primary_game_name ?? "Multi-game"} - {item.wins} wins - {item.completed_matches} matches</Text>
      </View>
      <View style={styles.scorePill}>
        <Star color={colors.cyan} size={14} fill={colors.cyan} />
        <Text style={styles.scoreText}>{compactNumber(item.leaderboard_score)}</Text>
      </View>
    </View>
  );
}

function MiniSummary({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniSummary}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyPanel}>
      <ShieldCheck color={colors.cyan} size={20} />
      <View style={styles.main}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.copy}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.lg },
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
  heroTitle: { color: colors.white, fontSize: 33, lineHeight: 38, fontWeight: "900" },
  heroCopy: { color: "#c8d4df", fontSize: 16, lineHeight: 24 },
  heroStats: { flexDirection: "row", gap: spacing.sm },
  heroStat: { flex: 1, borderWidth: 1, borderColor: "#1d3147", borderRadius: radius.md, backgroundColor: colors.navySoft, padding: spacing.md },
  heroStatValue: { color: colors.white, fontSize: 22, fontWeight: "900" },
  heroStatLabel: { color: "#a9b8c8", fontSize: 12, fontWeight: "900", marginTop: 2 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tab: { flexGrow: 1, minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  tabActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  tabText: { color: colors.muted, fontWeight: "900", fontSize: 13 },
  tabTextActive: { color: colors.white },
  loadingText: { color: colors.muted, fontWeight: "900", textAlign: "center" },
  artCard: { padding: 0, overflow: "hidden", backgroundColor: colors.navy },
  artwork: { width: "100%", height: 220 },
  artOverlay: { padding: spacing.lg, gap: spacing.xs },
  overlayEyebrow: { color: colors.cyan, textTransform: "uppercase", letterSpacing: 2, fontWeight: "900", fontSize: 11 },
  overlayText: { color: colors.white, fontSize: 17, lineHeight: 24, fontWeight: "800" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metricTile: { flexBasis: "47%", flexGrow: 1, borderTopWidth: 4 },
  cyanEdge: { borderTopColor: colors.cyan },
  greenEdge: { borderTopColor: colors.greenDark },
  amberEdge: { borderTopColor: colors.amber },
  redEdge: { borderTopColor: colors.red },
  metricLabel: { color: colors.faint, textTransform: "uppercase", letterSpacing: 2, fontWeight: "900", fontSize: 10 },
  metricValue: { fontSize: 28, lineHeight: 34, fontWeight: "900" },
  metricDetail: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "800" },
  cyanText: { color: colors.cyan },
  greenText: { color: colors.greenDark },
  amberText: { color: colors.amber },
  redText: { color: colors.red },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  main: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.cyan, textTransform: "uppercase", letterSpacing: 2, fontWeight: "900", fontSize: 11 },
  sectionTitle: { color: colors.ink, fontSize: 24, lineHeight: 29, fontWeight: "900" },
  sectionAction: { minHeight: 36, borderRadius: radius.pill, backgroundColor: colors.cyanSoft, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
  sectionActionText: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  itemCard: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.md, gap: spacing.sm },
  itemTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  itemTitle: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  dateText: { color: colors.faint, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  contextText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, padding: spacing.md },
  resultIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" },
  resultLabel: { color: colors.faint, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 },
  resultValue: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  miniSummary: { flexGrow: 1, flexBasis: "30%", borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.white, padding: spacing.sm },
  miniLabel: { color: colors.faint, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  miniValue: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 4 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  rankRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  rankBadge: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  rankBadgeText: { color: colors.white, fontWeight: "900", fontSize: 16 },
  scorePill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, backgroundColor: colors.cyanSoft, paddingHorizontal: spacing.sm, minHeight: 32 },
  scoreText: { color: colors.ink, fontWeight: "900", fontSize: 12 },
  emptyPanel: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, borderWidth: 1, borderColor: colors.line, borderStyle: "dashed", borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  shareActions: { flexDirection: "row", justifyContent: "flex-start" },
  shareButton: { minHeight: 42, borderRadius: radius.pill, backgroundColor: colors.cyanSoft, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  shareButtonText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  resultCard: { gap: spacing.md, overflow: "hidden" },
  darkDate: { color: "#9fb0c2", fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  resultCardTitle: { color: colors.white, fontSize: 30, lineHeight: 35, fontWeight: "900" },
  resultCardCopy: { color: "#d7e2ed", fontSize: 16, lineHeight: 23, fontWeight: "800" },
  resultCardStats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  darkStat: { flexGrow: 1, flexBasis: "30%", borderWidth: 1, borderColor: "#1d3147", borderRadius: radius.md, backgroundColor: colors.navySoft, padding: spacing.md },
  darkStatLabel: { color: "#9fb0c2", fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  darkStatValue: { color: colors.white, fontSize: 15, lineHeight: 20, fontWeight: "900", marginTop: 4 },
  resultCardFooter: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center", justifyContent: "space-between" },
  resultCardMeta: { color: "#b8c6d6", fontSize: 13, lineHeight: 19, fontWeight: "800", flexShrink: 1 },
  whatsappButton: { minHeight: 42, borderRadius: radius.pill, backgroundColor: colors.green, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  whatsappButtonText: { color: colors.navy, fontSize: 13, fontWeight: "900" },
  historyRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  historyIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  proofNote: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, borderWidth: 1, borderColor: "#b6f4db", borderRadius: radius.md, backgroundColor: colors.greenSoft, padding: spacing.md },
  proofNoteTitle: { color: colors.ink, fontSize: 16, lineHeight: 21, fontWeight: "900" }
});
