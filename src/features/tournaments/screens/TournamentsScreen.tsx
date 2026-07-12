import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { listTournaments } from "../../../api/tournaments";
import { AppScreen } from "../../../components/screen/AppScreen";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, shadow, spacing } from "../../../constants/theme";
import type { Tournament } from "../../../types/api";

type TournamentFilter = "all" | "registration_open" | "in_motion" | "completed";

const tournamentArtwork = require("../../../../assets/marketing/skillsroom-premium/tournaments-premium.png");

const filters: Array<{ key: TournamentFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "registration_open", label: "Open" },
  { key: "in_motion", label: "Live" },
  { key: "completed", label: "Done" }
];

const formatGroups = [
  { label: "Brackets", detail: "Single Elimination, Double Elimination" },
  { label: "Groups", detail: "Round Robin, Group Stage Playoffs" },
  { label: "Swiss", detail: "Swiss" },
  { label: "Leagues", detail: "League, Season" },
  { label: "Scores", detail: "Free For All, Leaderboard, Race, Time Trial, Grand Prix" }
];

function money(minor?: number, currency = "NGN") {
  return `${currency} ${Math.round((minor ?? 0) / 100).toLocaleString()}`;
}

function label(value?: string | null) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Event";
}

function statusTone(status?: string): "cyan" | "green" | "amber" | "red" | "dark" {
  if (status === "registration_open" || status === "completed" || status === "refunded") return "green";
  if (status === "cancelled" || status === "voided" || status === "disputed" || status === "under_review") return "red";
  if (["in_progress", "registration_locked", "seeding", "awaiting_results", "settlement_pending", "published"].includes(status ?? "")) return "amber";
  return "cyan";
}

function feeTone(feeMode?: string): "cyan" | "green" | "amber" | "red" | "dark" {
  if (feeMode === "free") return "green";
  if (feeMode === "sponsored") return "cyan";
  if (feeMode === "hybrid") return "amber";
  if (feeMode === "paid") return "red";
  return "dark";
}

function isInMotion(status?: string) {
  return ["seeding", "in_progress", "awaiting_results", "under_review", "disputed", "settlement_pending", "registration_locked"].includes(status ?? "");
}

function projectedPrize(tournament: Tournament) {
  return Math.max(
    Number(tournament.approved_prize_contribution_minor ?? 0),
    Number(tournament.sponsored_prize_pool_minor ?? 0) + Number(tournament.guaranteed_prize_pool_minor ?? 0)
  );
}

function startsText(tournament: Tournament) {
  if (!tournament.starts_at) return "Not scheduled";
  return new Date(tournament.starts_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function filterTournament(tournament: Tournament, filter: TournamentFilter) {
  if (filter === "all") return true;
  if (filter === "in_motion") return isInMotion(tournament.status);
  return tournament.status === filter;
}

function sortTournaments(tournaments: Tournament[]) {
  const rank: Record<string, number> = {
    registration_open: 1,
    published: 2,
    registration_locked: 3,
    seeding: 4,
    in_progress: 5,
    awaiting_results: 6,
    under_review: 7,
    disputed: 8,
    settlement_pending: 9,
    refunded: 10,
    completed: 11,
    draft: 12,
    cancelled: 13,
    voided: 14
  };

  return [...tournaments].sort((left, right) => {
    const statusRank = (rank[String(left.status)] ?? 99) - (rank[String(right.status)] ?? 99);
    if (statusRank !== 0) return statusRank;
    return Date.parse(String(left.starts_at ?? left.created_at ?? 0)) - Date.parse(String(right.starts_at ?? right.created_at ?? 0));
  });
}

export function TournamentsScreen() {
  const [activeFilter, setActiveFilter] = useState<TournamentFilter>("all");
  const tournamentsQuery = useQuery({
    queryKey: ["tournaments", "list"],
    queryFn: () => listTournaments({ limit: 100 }),
    refetchInterval: 15000
  });
  const tournaments = useMemo(() => sortTournaments(tournamentsQuery.data ?? []), [tournamentsQuery.data]);
  const visibleTournaments = useMemo(() => tournaments.filter((tournament) => filterTournament(tournament, activeFilter)), [activeFilter, tournaments]);
  const featuredTournament = visibleTournaments[0] ?? tournaments[0];
  const openCount = tournaments.filter((tournament) => tournament.status === "registration_open").length;
  const motionCount = tournaments.filter((tournament) => isInMotion(tournament.status)).length;
  const completedCount = tournaments.filter((tournament) => tournament.status === "completed").length;
  const totalPrize = tournaments.reduce((sum, tournament) => sum + projectedPrize(tournament), 0);

  return (
    <AppScreen>
      <SurfaceCard dark style={styles.hero}>
        <Badge>Tournaments</Badge>
        <Text style={styles.heroTitle}>Find serious Skillsroom events.</Text>
        <Text style={styles.heroCopy}>Browse brackets, groups, Swiss events, leagues, and score-based formats across supported games.</Text>
        <View style={styles.heroNotes}>
          <HeroNote title="Easy to follow" body="Quickly see whether an event is open, live, being checked, or finished." />
          <HeroNote title="Different event types" body="Brackets, leagues, Swiss events, and score-based competitions all live here." />
          <HeroNote title="Finished events stay visible" body="Completed events remain available so players can look back at winners and final results." />
        </View>
      </SurfaceCard>

      <ImageBackground source={tournamentArtwork} resizeMode="cover" imageStyle={styles.artImage} style={styles.artCard}>
        <View style={styles.artShade}>
          <View style={styles.artInfo}>
            <Text style={styles.artEyebrow}>For players</Text>
            <Text style={styles.artCopy}>See open events, finished highlights, and the format each tournament is using.</Text>
          </View>
          <View style={styles.artInfo}>
            <Text style={styles.artEyebrow}>Behind the scenes</Text>
            <Text style={styles.artCopy}>Entry checks, disputes, winner decisions, and prize payments stay tied to the same event.</Text>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.metricGrid}>
        <MetricCard label="Open" value={String(openCount)} detail="Can accept entrants" accent="cyan" />
        <MetricCard label="In motion" value={String(motionCount)} detail="Seeding, live, final checks" accent="amber" />
        <MetricCard label="Completed" value={String(completedCount)} detail="Finished events" accent="green" />
        <MetricCard label="Prize pools" value={money(totalPrize)} detail="Projected/approved" accent="green" wide />
      </View>

      <SurfaceCard style={styles.boardCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Badge>Events</Badge>
            <Text style={styles.sectionTitle}>Tournament board</Text>
            <Text style={styles.copy}>Browse open, live, and completed events that are ready for players to see.</Text>
          </View>
          <Text style={styles.count}>{visibleTournaments.length}</Text>
        </View>

        <View style={styles.filterTabs}>
          {filters.map((filter) => (
            <Pressable key={filter.key} onPress={() => setActiveFilter(filter.key)} style={[styles.filterButton, activeFilter === filter.key && styles.filterButtonOn]}>
              <Text style={[styles.filterText, activeFilter === filter.key && styles.filterTextOn]}>{filter.label}</Text>
            </Pressable>
          ))}
        </View>

        {tournamentsQuery.isLoading ? <Text style={styles.copy}>Loading tournaments...</Text> : null}
        {tournamentsQuery.isError ? (
          <FeedbackState tone="error" title="Unable to load tournaments" body="Please try again shortly." actionLabel="Retry" onAction={() => void tournamentsQuery.refetch()} />
        ) : null}
        {!tournamentsQuery.isLoading && !tournamentsQuery.isError && visibleTournaments.length === 0 ? (
          <FeedbackState title="No tournaments here yet" body="Events will appear here as soon as they match this filter." />
        ) : null}
      </SurfaceCard>

      {visibleTournaments.map((tournament) => (
        <TournamentCard key={tournament.id} tournament={tournament} />
      ))}

      {featuredTournament ? (
        <SurfaceCard>
          <Badge>Compare</Badge>
          <Text style={styles.sectionTitle}>Tournament table</Text>
          <Text style={styles.copy}>Compare schedule, capacity, status, and prize pool at a glance.</Text>
          <View style={styles.factPanel}>
            <Fact label="Tournament" value={String(featuredTournament.title ?? "Skillsroom tournament")} />
            <Fact label="Status" value={label(String(featuredTournament.status))} />
            <Fact label="Format" value={label(String(featuredTournament.format))} />
            <Fact label="Entries" value={`${featuredTournament.registered_entry_count ?? 0}/${featuredTournament.max_entries}`} />
            <Fact label="Starts" value={startsText(featuredTournament)} />
            <Fact label="Prize" value={money(projectedPrize(featuredTournament), featuredTournament.currency)} />
          </View>
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <Badge>Formats</Badge>
        <Text style={styles.sectionTitle}>Tournament formats</Text>
        <View style={styles.laneList}>
          {formatGroups.map((group) => (
            <View key={group.label} style={styles.laneCard}>
              <Text style={styles.laneTitle}>{group.label}</Text>
              <Text style={styles.laneDetail}>{group.detail}</Text>
            </View>
          ))}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Badge>Money</Badge>
        <Text style={styles.sectionTitle}>Prize models</Text>
        <InfoBox>Events can be free, paid entry, sponsored, or hybrid, depending on how the organizer sets them up.</InfoBox>
        <InfoBox>Prize pools can come from entry fees, sponsors, platform bonuses, or approved organizer contributions.</InfoBox>
      </SurfaceCard>

      <SurfaceCard>
        <Badge>Finished events</Badge>
        <Text style={styles.sectionTitle}>Completed tournaments</Text>
        <Text style={styles.copy}>Finished tournaments will stay here so players can look back at winners and final results.</Text>
        {completedCount > 0 ? (
          tournaments.filter((tournament) => tournament.status === "completed").slice(0, 4).map((tournament) => (
            <Pressable key={tournament.id} onPress={() => router.push(`/(app)/tournaments/${encodeURIComponent(tournament.id)}`)} style={styles.completedRow}>
              <View style={styles.completedDot} />
              <View style={styles.completedMain}>
                <Text style={styles.rowTitle}>{String(tournament.title ?? "Completed tournament")}</Text>
                <Text style={styles.copy}>{label(String(tournament.game_name ?? tournament.game_slug ?? tournament.format))}</Text>
              </View>
            </Pressable>
          ))
        ) : (
          <FeedbackState title="No completed tournaments yet" body="Completed tournaments will appear here once winners and final results are confirmed." />
        )}
      </SurfaceCard>
    </AppScreen>
  );
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const prize = projectedPrize(tournament);
  const entryFee = tournament.entry_fee_amount_minor > 0 ? money(tournament.entry_fee_amount_minor, tournament.currency) : "NGN 0";

  return (
    <Pressable onPress={() => router.push(`/(app)/tournaments/${encodeURIComponent(tournament.id)}`)}>
      <SurfaceCard>
        <View style={styles.chips}>
          <Badge tone={statusTone(tournament.status)}>{label(tournament.status)}</Badge>
          <Badge tone={feeTone(tournament.fee_mode)}>{label(tournament.fee_mode)}</Badge>
        </View>
        <View style={styles.formatChip}>
          <Text style={styles.formatText}>{label(String(tournament.format))}</Text>
        </View>
        <Text style={styles.eventTitle}>{String(tournament.title ?? "Skillsroom tournament")}</Text>
        {tournament.description ? <Text style={styles.copy} numberOfLines={3}>{String(tournament.description)}</Text> : null}
        <Text style={styles.strongLine}>{String(tournament.game_name ?? tournament.game_slug ?? "Skillsroom event")}</Text>
        <Text style={styles.strongLine}>{label(String(tournament.scoring_mode ?? "match_win_loss"))} scoring</Text>
        <View style={styles.eventFacts}>
          <Text style={styles.eventFactText}>{tournament.registered_entry_count ?? 0}/{tournament.max_entries} entries</Text>
          <Text style={styles.eventFactText}>{startsText(tournament)}</Text>
        </View>
        <View style={styles.prizeBox}>
          <Text style={styles.statLabel}>Prize pool</Text>
          <Text style={styles.prizeValue}>{money(prize, tournament.currency)}</Text>
          <View style={styles.prizeMeta}>
            <Text style={styles.metaText}>Entry: {entryFee}</Text>
            <Text style={styles.metaText}>Split: {label(String(tournament.prize_distribution_mode ?? "top_2_split"))}</Text>
            <Text style={styles.metaText}>Type: {label(String(tournament.entry_type ?? "solo"))}</Text>
            <Text style={styles.metaText}>Team: {tournament.team_size_min ?? 1}-{tournament.team_size_max ?? 1}</Text>
          </View>
        </View>
      </SurfaceCard>
    </Pressable>
  );
}

function HeroNote({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.heroNote}>
      <Text style={styles.heroNoteTitle}>{title}</Text>
      <Text style={styles.heroNoteBody}>{body}</Text>
    </View>
  );
}

function MetricCard({ label: metricLabel, value, detail, accent, wide = false }: { label: string; value: string; detail: string; accent: "cyan" | "amber" | "green"; wide?: boolean }) {
  return (
    <View style={[styles.metricCard, styles[`${accent}Top`], wide && styles.metricWide]}>
      <Text style={styles.statLabel}>{metricLabel}</Text>
      <Text style={[styles.metricValue, accent === "amber" && styles.metricAmber, accent === "green" && styles.metricGreen]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

function Fact({ label: factLabel, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{factLabel}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function InfoBox({ children }: { children: string }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.copy}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: "hidden"
  },
  heroTitle: {
    color: colors.white,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    marginTop: spacing.sm
  },
  heroCopy: {
    color: "#d7e3ef",
    fontSize: 16,
    lineHeight: 25
  },
  heroNotes: {
    gap: spacing.sm
  },
  heroNote: {
    borderWidth: 1,
    borderColor: "#22384f",
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: spacing.md
  },
  heroNoteTitle: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase"
  },
  heroNoteBody: {
    color: "#d7e3ef",
    fontSize: 14,
    lineHeight: 22,
    marginTop: spacing.xs
  },
  artCard: {
    minHeight: 390,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#15384c",
    backgroundColor: colors.navy,
    ...shadow.card
  },
  artImage: {
    borderRadius: radius.lg
  },
  artShade: {
    flex: 1,
    justifyContent: "flex-end",
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: "rgba(3,12,22,0.28)"
  },
  artInfo: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.md,
    backgroundColor: "rgba(6,19,35,0.74)",
    padding: spacing.md
  },
  artEyebrow: {
    color: "#d7e3ef",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase"
  },
  artCopy: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 23,
    marginTop: spacing.xs
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: "46%",
    minHeight: 128,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderTopWidth: 4,
    ...shadow.card
  },
  metricWide: {
    flexBasis: "100%"
  },
  cyanTop: { borderTopColor: colors.cyan },
  amberTop: { borderTopColor: colors.amber },
  greenTop: { borderTopColor: colors.greenDark },
  metricValue: {
    color: colors.cyan,
    fontSize: 34,
    fontWeight: "900",
    marginTop: spacing.xs
  },
  metricAmber: {
    color: colors.amber
  },
  metricGreen: {
    color: colors.greenDark
  },
  metricDetail: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    marginTop: spacing.xs
  },
  boardCard: {
    gap: spacing.lg
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  sectionHeaderText: {
    flex: 1
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
    marginTop: spacing.xs
  },
  count: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: "900"
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23
  },
  filterTabs: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: "#eaf1f7",
    padding: 4
  },
  filterButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center"
  },
  filterButtonOn: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line
  },
  filterText: {
    color: colors.muted,
    fontWeight: "900",
    fontSize: 13
  },
  filterTextOn: {
    color: colors.ink
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  formatChip: {
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    backgroundColor: "#eef2f6",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  formatText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  eventTitle: {
    color: colors.ink,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900"
  },
  strongLine: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "900"
  },
  eventFacts: {
    gap: spacing.xs
  },
  eventFactText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "900"
  },
  prizeBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md
  },
  statLabel: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase"
  },
  prizeValue: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "900",
    marginTop: spacing.xs
  },
  prizeMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  metaText: {
    width: "47%",
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "900"
  },
  factPanel: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.sm
  },
  factRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  factLabel: {
    width: 112,
    color: colors.faint,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase"
  },
  factValue: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    textAlign: "right"
  },
  laneList: {
    gap: spacing.sm
  },
  laneCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md
  },
  laneTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  laneDetail: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800",
    marginTop: spacing.xs
  },
  infoBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md
  },
  completedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md
  },
  completedDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.green
  },
  completedMain: {
    flex: 1
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  }
});
