import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, CheckCircle2, Gamepad2, MapPin, Medal, Target, Trophy } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { playerEngagement, type PlayerLadderRow, type PlayerMission } from "../../../api/player";
import { getGames } from "../../../api/rooms";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, shadow, spacing } from "../../../constants/theme";

type LadderPeriod = "daily" | "weekly";

const routeMap: Record<string, string> = {
  "/profile": "/profile",
  "/challenges": "/challenges",
  "/tournaments": "/tournaments",
  "/tournaments?filter=registration_open": "/tournaments",
  "/matches": "/rooms"
};

function playerName(row: PlayerLadderRow) {
  return row.display_name ?? row.username ?? "Skillsroom player";
}

function progressPercent(mission: PlayerMission) {
  if (mission.target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((mission.progress / mission.target) * 100)));
}

function missionRoute(actionHref: string) {
  return (routeMap[actionHref] ?? "/home") as unknown as Parameters<typeof router.push>[0];
}

export function PlayerEngagementScreen() {
  const [period, setPeriod] = useState<LadderPeriod>("daily");
  const [selectedGameSlug, setSelectedGameSlug] = useState("");
  const [cityDraft, setCityDraft] = useState("");
  const [city, setCity] = useState("");

  const gamesQuery = useQuery({ queryKey: ["games"], queryFn: getGames });
  const engagementQuery = useQuery({
    queryKey: ["player", "engagement", selectedGameSlug, city],
    queryFn: () => playerEngagement({ game_slug: selectedGameSlug || undefined, city: city || undefined })
  });

  const games = gamesQuery.data?.games ?? [];
  const ladders = period === "daily" ? engagementQuery.data?.daily_ladders ?? [] : engagementQuery.data?.weekly_ladders ?? [];
  const missions = engagementQuery.data?.missions ?? [];
  const completedMissions = missions.filter((mission) => mission.completed).length;
  const topPlayer = ladders[0];
  const filterLabel = useMemo(() => {
    const game = games.find((item) => item.slug === selectedGameSlug)?.name;
    return [game, city].filter(Boolean).join(" in ") || "All games and cities";
  }, [city, games, selectedGameSlug]);

  function retryAll() {
    void gamesQuery.refetch();
    void engagementQuery.refetch();
  }

  return (
    <AppScreen>
      <SurfaceCard dark style={styles.hero}>
        <View style={styles.heroTop}>
          <Pressable accessibilityLabel="Go back" style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.7} />
          </Pressable>
          <Badge tone="cyan">Ladders</Badge>
        </View>
        <Text style={styles.heroTitle}>Daily wins. Weekly progress.</Text>
        <Text style={styles.heroCopy}>Track player ladders by game and city, then use missions to build a steady match habit.</Text>
        <View style={styles.heroStats}>
          <MiniStat icon={Trophy} label="Top player" value={topPlayer ? playerName(topPlayer) : "Waiting"} />
          <MiniStat icon={Target} label="Missions" value={`${completedMissions}/${missions.length || 5}`} />
          <MiniStat icon={MapPin} label="Filter" value={filterLabel} />
        </View>
      </SurfaceCard>

      {(gamesQuery.isError || engagementQuery.isError) ? (
        <FeedbackState
          tone="error"
          title="Ladders could not load"
          body="Check the connection and retry. Missions and ladders will appear once Skillsroom is reachable."
          actionLabel="Retry"
          onAction={retryAll}
        />
      ) : null}

      <SurfaceCard>
        <View style={styles.sectionHeader}>
          <View style={styles.main}>
            <Badge>Filters</Badge>
            <Text style={styles.sectionTitle}>Choose game and city</Text>
          </View>
          <Gamepad2 color={colors.cyan} size={24} />
        </View>
        <View style={styles.chips}>
          <FilterChip label="All games" selected={!selectedGameSlug} onPress={() => setSelectedGameSlug("")} />
          {games.slice(0, 8).map((game) => (
            <FilterChip key={game.slug} label={game.name} selected={selectedGameSlug === game.slug} onPress={() => setSelectedGameSlug(game.slug)} />
          ))}
        </View>
        <View style={styles.cityRow}>
          <TextInput
            value={cityDraft}
            onChangeText={setCityDraft}
            placeholder="City, optional"
            placeholderTextColor={colors.faint}
            style={styles.input}
          />
          <Pressable style={styles.cityButton} onPress={() => setCity(cityDraft.trim())}>
            <Text style={styles.cityButtonText}>Apply</Text>
          </Pressable>
        </View>
        {city ? (
          <Pressable style={styles.clearButton} onPress={() => {
            setCity("");
            setCityDraft("");
          }}>
            <Text style={styles.clearText}>Clear city filter</Text>
          </Pressable>
        ) : null}
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.periodRow}>
          <PeriodButton active={period === "daily"} label="Daily" onPress={() => setPeriod("daily")} />
          <PeriodButton active={period === "weekly"} label="Weekly" onPress={() => setPeriod("weekly")} />
        </View>
        <View style={styles.sectionHeader}>
          <View style={styles.main}>
            <Text style={styles.eyebrow}>{period === "daily" ? "Today" : "This week"}</Text>
            <Text style={styles.sectionTitle}>{period === "daily" ? "Daily ladder" : "Weekly ladder"}</Text>
          </View>
          <Medal color={colors.amber} size={28} />
        </View>
        {engagementQuery.isLoading ? <Text style={styles.copy}>Loading ladder...</Text> : null}
        {!engagementQuery.isLoading && !ladders.length ? <EmptyPanel title="No ladder activity yet" body="Finish matches and wins will start moving the ladder." /> : null}
        {ladders.map((row) => <LadderCard key={`${period}-${row.user_id}-${row.rank}`} row={row} />)}
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.sectionHeader}>
          <View style={styles.main}>
            <Badge tone="green">Missions</Badge>
            <Text style={styles.sectionTitle}>Small actions that build momentum</Text>
          </View>
          <CheckCircle2 color={colors.greenDark} size={28} />
        </View>
        {engagementQuery.isLoading ? <Text style={styles.copy}>Loading missions...</Text> : null}
        {!engagementQuery.isLoading && !missions.length ? <EmptyPanel title="No missions yet" body="Missions will appear here as your player profile becomes ready." /> : null}
        {missions.map((mission) => <MissionCard key={mission.key} mission={mission} />)}
      </SurfaceCard>
    </AppScreen>
  );
}

function LadderCard({ row }: { row: PlayerLadderRow }) {
  return (
    <View style={styles.ladderRow}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{row.rank}</Text>
      </View>
      <View style={styles.main}>
        <Text style={styles.itemTitle}>{playerName(row)}</Text>
        <Text style={styles.copy}>{row.game_name} - {row.city ?? row.region ?? "Online"} - {row.wins} wins</Text>
      </View>
      <View style={styles.scorePill}>
        <Text style={styles.scoreText}>{row.score}</Text>
      </View>
    </View>
  );
}

function MissionCard({ mission }: { mission: PlayerMission }) {
  const percent = progressPercent(mission);
  return (
    <View style={styles.missionCard}>
      <View style={styles.itemTop}>
        <Badge tone={mission.completed ? "green" : "cyan"}>{mission.completed ? "Done" : "Open"}</Badge>
        <Text style={styles.progressText}>{mission.progress}/{mission.target}</Text>
      </View>
      <Text style={styles.itemTitle}>{mission.title}</Text>
      <Text style={styles.copy}>{mission.detail}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
      <AppButton variant={mission.completed ? "secondary" : "primary"} onPress={() => router.push(missionRoute(mission.action_href))}>
        {mission.completed ? "View" : mission.action_label}
      </AppButton>
    </View>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Icon color={colors.cyan} size={18} />
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function PeriodButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.periodButton, active && styles.periodButtonOn]} onPress={onPress}>
      <Text style={[styles.periodText, active && styles.periodTextOn]}>{label}</Text>
    </Pressable>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.filterChip, selected && styles.filterChipOn]} onPress={onPress}>
      <Text style={[styles.filterText, selected && styles.filterTextOn]}>{label}</Text>
    </Pressable>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyPanel}>
      <Target color={colors.cyan} size={22} />
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
  heroTitle: { color: colors.white, fontSize: 35, lineHeight: 41, fontWeight: "900" },
  heroCopy: { color: "#c8d4df", fontSize: 16, lineHeight: 24 },
  heroStats: { flexDirection: "row", gap: spacing.sm },
  miniStat: { flex: 1, borderWidth: 1, borderColor: "#22344b", borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.navySoft, gap: 4 },
  miniLabel: { color: "#9dafc1", fontSize: 11, fontWeight: "900" },
  miniValue: { color: colors.white, fontSize: 13, fontWeight: "900" },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  main: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.cyan, textTransform: "uppercase", letterSpacing: 2, fontWeight: "900", fontSize: 11 },
  sectionTitle: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  itemTitle: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  filterChip: { minHeight: 42, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  filterChipOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  filterText: { color: colors.muted, fontWeight: "900" },
  filterTextOn: { color: colors.greenDark },
  cityRow: { flexDirection: "row", gap: spacing.sm },
  input: { flex: 1, minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink, backgroundColor: colors.surfaceAlt },
  cityButton: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.navy, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
  cityButtonText: { color: colors.white, fontWeight: "900" },
  clearButton: { alignSelf: "flex-start" },
  clearText: { color: colors.cyan, fontWeight: "900" },
  periodRow: { flexDirection: "row", gap: spacing.sm },
  periodButton: { flex: 1, minHeight: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  periodButtonOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  periodText: { color: colors.muted, fontWeight: "900" },
  periodTextOn: { color: colors.white },
  ladderRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  rankBadge: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  rankText: { color: colors.white, fontSize: 17, fontWeight: "900" },
  scorePill: { minWidth: 50, minHeight: 34, borderRadius: radius.pill, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm },
  scoreText: { color: colors.amber, fontWeight: "900" },
  missionCard: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.md, gap: spacing.sm, ...shadow.card },
  itemTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  progressText: { color: colors.faint, fontSize: 12, fontWeight: "900" },
  progressTrack: { height: 10, borderRadius: radius.pill, backgroundColor: colors.white, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  progressFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.green },
  emptyPanel: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, borderWidth: 1, borderColor: colors.line, borderStyle: "dashed", borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" }
});
