import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { CheckCircle2, Clock3, Filter, Gamepad2, MapPin, Plus, ShieldCheck, Swords, Trophy, Users } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { plainApiError } from "../../../api/errors";
import { profileOverview } from "../../../api/profile";
import { acceptMatchChallenge, createMatchChallenge, getGames, listMatchChallenges } from "../../../api/rooms";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, shadow, spacing } from "../../../constants/theme";
import { useActionFeedback } from "../../../providers/ActionFeedbackProvider";
import { useAuthStore } from "../../../store/auth-store";
import type { MatchChallengeListRow, MatchChallengeSkillLevel, MatchChallengeVisibility } from "../../../types/api";
import { PlayerTrustBadgeStrip, trustBadgesForChallenge, trustLabel } from "../../trust/components/PlayerTrustBadgeStrip";

type Notice = { tone: "error" | "success" | "info"; message: string } | null;
type ChallengeMode = "browse" | "create";

const skillLevels: Array<{ value: MatchChallengeSkillLevel; label: string }> = [
  { value: "any", label: "Any skill" },
  { value: "beginner", label: "Beginner" },
  { value: "casual", label: "Casual" },
  { value: "competitive", label: "Competitive" },
  { value: "expert", label: "Expert" }
];

const visibilityOptions: Array<{ value: MatchChallengeVisibility; label: string }> = [
  { value: "public", label: "Public" },
  { value: "private", label: "Private" }
];

const defaultPlatforms = ["Mobile", "PlayStation", "Xbox", "PC", "Cross-play"];
const defaultRegions = ["Nigeria", "West Africa", "Africa", "Europe", "North America", "Any region"];

function money(minor?: number, currency = "NGN") {
  return `${currency} ${Math.round((minor ?? 0) / 100).toLocaleString()}`;
}

function moneyFromInput(value: string) {
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function displayLabel(value?: string | null) {
  if (!value) return "Any";
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function creatorName(challenge: MatchChallengeListRow) {
  return challenge.creator_display_name || challenge.creator_username || "Skillsroom player";
}

function rulesetName(challenge: MatchChallengeListRow) {
  return challenge.ruleset_title || "Standard rules";
}

function timeLeft(value?: string | null) {
  if (!value) return "Open until accepted";
  const msLeft = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(msLeft) || msLeft <= 0) return "Expired";
  const hours = Math.ceil(msLeft / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h left`;
  return `${Math.ceil(hours / 24)}d left`;
}

function expiryDate(hours: string) {
  const parsed = Number(hours);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return new Date(Date.now() + Math.min(parsed, 168) * 60 * 60 * 1000).toISOString();
}

function missingText(key: string) {
  if (key === "username") return "Choose a username in Profile.";
  if (key === "age_confirmation") return "Confirm your age in Profile.";
  if (key === "primary_game_account") return "Add your main game handle in Profile.";
  return displayLabel(key);
}

export function ChallengesScreen() {
  const queryClient = useQueryClient();
  const { pushFeedback } = useActionFeedback();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [mode, setMode] = useState<ChallengeMode>("browse");
  const [selectedGameSlug, setSelectedGameSlug] = useState("");
  const [selectedRulesetSlug, setSelectedRulesetSlug] = useState("");
  const [visibility, setVisibility] = useState<MatchChallengeVisibility>("public");
  const [skillLevel, setSkillLevel] = useState<MatchChallengeSkillLevel>("any");
  const [platform, setPlatform] = useState("Mobile");
  const [region, setRegion] = useState("Nigeria");
  const [title, setTitle] = useState("");
  const [entryAmount, setEntryAmount] = useState("2000");
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [notice, setNotice] = useState<Notice>(null);

  const challengesQuery = useQuery({ queryKey: ["challenges", "open"], queryFn: () => listMatchChallenges({ limit: 40 }) });
  const gamesQuery = useQuery({ queryKey: ["games"], queryFn: getGames });
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: profileOverview });

  const games = gamesQuery.data?.games ?? [];
  const rulesets = gamesQuery.data?.rulesets ?? [];
  const selectedGame = games.find((game) => game.slug === selectedGameSlug) ?? games[0];
  const selectedRulesets = useMemo(() => {
    return rulesets.filter((ruleset) => {
      const gameId = typeof ruleset.game_id === "string" ? ruleset.game_id : undefined;
      return ruleset.game_slug === selectedGame?.slug || gameId === selectedGame?.id;
    });
  }, [rulesets, selectedGame?.id, selectedGame?.slug]);
  const selectedRuleset = selectedRulesets.find((ruleset) => ruleset.slug === selectedRulesetSlug) ?? selectedRulesets[0];
  const profileReady = Boolean(profileQuery.data?.completion?.complete);
  const missing = profileQuery.data?.completion?.missing ?? [];
  const challenges = challengesQuery.data ?? [];
  const recommended = challenges
    .filter((challenge) => challenge.visibility === "public")
    .sort((left, right) => (right.creator_trust_score ?? 0) - (left.creator_trust_score ?? 0))
    .slice(0, 3);

  useEffect(() => {
    if (!selectedGameSlug && games[0]?.slug) setSelectedGameSlug(games[0].slug);
  }, [games, selectedGameSlug]);

  useEffect(() => {
    setSelectedRulesetSlug(selectedRulesets[0]?.slug ?? "");
  }, [selectedGameSlug, selectedRulesets]);

  const notify = (nextNotice: NonNullable<Notice>) => {
    setNotice(nextNotice);
    pushFeedback({
      tone: nextNotice.tone,
      title: nextNotice.tone === "error" ? "Challenge needs attention" : "Challenge updated",
      message: nextNotice.message
    });
  };

  const createMutation = useMutation({
    mutationFn: () => {
      if (!profileReady) throw new Error("Finish your Profile setup before posting a challenge.");
      if (!selectedGame?.slug || !selectedRuleset?.slug) throw new Error("Choose a game and rules before posting a challenge.");
      const entryAmountMinor = moneyFromInput(entryAmount);
      if (entryAmountMinor < 10_000) throw new Error("Entry amount must be at least NGN 100.");

      return createMatchChallenge({
        game_slug: selectedGame.slug,
        ruleset_slug: selectedRuleset.slug,
        entry_amount_minor: entryAmountMinor,
        commission_bps: 1000,
        title: title.trim() || undefined,
        visibility,
        platform: platform.trim() || "Mobile",
        region: region.trim() || "Nigeria",
        skill_level: skillLevel,
        expires_at: expiryDate(expiresInHours)
      });
    },
    onSuccess: async ({ room }) => {
      notify({ tone: "success", message: "Challenge posted. Players can accept it while it is open." });
      setTitle("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["challenges"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
        queryClient.invalidateQueries({ queryKey: ["rooms"] })
      ]);
      if (room.id) router.push(`/(app)/rooms/${room.id}`);
    },
    onError: (error) => notify({ tone: "error", message: plainApiError(error, "Could not post challenge.") })
  });

  const acceptMutation = useMutation({
    mutationFn: acceptMatchChallenge,
    onSuccess: async ({ room }) => {
      notify({ tone: "success", message: "Challenge accepted. Open the room to confirm entry and play." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["challenges"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
        queryClient.invalidateQueries({ queryKey: ["rooms"] })
      ]);
      if (room.id) router.push(`/(app)/rooms/${room.id}`);
    },
    onError: (error) => notify({ tone: "error", message: plainApiError(error, "Could not accept challenge.") })
  });

  return (
    <AppScreen>
      <SurfaceCard dark style={styles.hero}>
        <Badge tone="dark">Challenges</Badge>
        <Text style={styles.heroTitle}>Find a challenge to play now.</Text>
        <Text style={styles.heroCopy}>Browse H2H challenges by game, entry, platform, region, skill level, and player trust. Post one for everyone or keep it private.</Text>
        <View style={styles.heroStats}>
          <MiniStat icon={Swords} label="Open" value={String(challenges.length)} />
          <MiniStat icon={ShieldCheck} label="Profile" value={profileReady ? "Ready" : "Setup"} />
          <MiniStat icon={Trophy} label="Top trust" value={recommended[0]?.creator_trust_score ? String(recommended[0].creator_trust_score) : "New"} />
        </View>
      </SurfaceCard>

      <View style={styles.modeRow}>
        <ModeButton active={mode === "browse"} label="Browse" onPress={() => setMode("browse")} />
        <ModeButton active={mode === "create"} label="Post challenge" onPress={() => setMode("create")} />
      </View>

      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

      {profileQuery.isLoading ? <Text style={styles.copy}>Checking your player setup...</Text> : null}
      {!profileQuery.isLoading && !profileReady ? (
        <SurfaceCard>
          <View style={styles.rowBetween}>
            <View style={styles.fill}>
              <Badge tone="amber">Setup needed</Badge>
              <Text style={styles.sectionTitle}>Finish your Profile first</Text>
              <Text style={styles.copy}>{missing.length ? missing.map(missingText).join(" ") : "Challenge play needs your username, age confirmation, and game handle."}</Text>
            </View>
            <CheckCircle2 color={colors.amber} size={34} />
          </View>
          <AppButton variant="secondary" onPress={() => router.push("/(app)/(tabs)/profile")}>Open Profile</AppButton>
        </SurfaceCard>
      ) : null}

      {mode === "create" ? (
        <SurfaceCard>
          <View style={styles.sectionHeader}>
            <View style={styles.fill}>
              <Badge tone="green">Post challenge</Badge>
              <Text style={styles.sectionTitle}>Set the game, entry, and player level.</Text>
            </View>
            <Plus color={colors.greenDark} size={28} />
          </View>
          {gamesQuery.isError ? <FeedbackState tone="error" title="Games unavailable" body="We could not load games and rules." actionLabel="Retry" onAction={() => void gamesQuery.refetch()} /> : null}
          <Text style={styles.label}>Game</Text>
          <OptionGroup values={games.map((game) => game.slug)} selected={selectedGameSlug} labelFor={(slug) => games.find((game) => game.slug === slug)?.name ?? slug} onSelect={setSelectedGameSlug} />
          <Text style={styles.label}>Rules</Text>
          <OptionGroup values={selectedRulesets.map((ruleset) => ruleset.slug)} selected={selectedRulesetSlug} labelFor={(slug) => selectedRulesets.find((ruleset) => ruleset.slug === slug)?.name ?? slug} onSelect={setSelectedRulesetSlug} />
          <Text style={styles.label}>Visibility</Text>
          <OptionGroup values={visibilityOptions.map((item) => item.value)} selected={visibility} labelFor={(value) => visibilityOptions.find((item) => item.value === value)?.label ?? value} onSelect={setVisibility} />
          <Text style={styles.label}>Skill level</Text>
          <OptionGroup values={skillLevels.map((item) => item.value)} selected={skillLevel} labelFor={(value) => skillLevels.find((item) => item.value === value)?.label ?? value} onSelect={setSkillLevel} />
          <View style={styles.formGrid}>
            <TextInput value={entryAmount} onChangeText={setEntryAmount} keyboardType="number-pad" placeholder="Entry amount in NGN" placeholderTextColor={colors.faint} style={styles.input} />
            <TextInput value={title} onChangeText={setTitle} placeholder="Challenge title, optional" placeholderTextColor={colors.faint} style={styles.input} />
            <TextInput value={platform} onChangeText={setPlatform} placeholder="Platform" placeholderTextColor={colors.faint} style={styles.input} />
            <TextInput value={region} onChangeText={setRegion} placeholder="Region" placeholderTextColor={colors.faint} style={styles.input} />
            <TextInput value={expiresInHours} onChangeText={setExpiresInHours} keyboardType="number-pad" placeholder="Expires in hours" placeholderTextColor={colors.faint} style={styles.input} />
          </View>
          <View style={styles.pickRow}>
            {defaultPlatforms.map((item) => <Chip key={item} label={item} selected={platform === item} onPress={() => setPlatform(item)} />)}
          </View>
          <View style={styles.pickRow}>
            {defaultRegions.map((item) => <Chip key={item} label={item} selected={region === item} onPress={() => setRegion(item)} />)}
          </View>
          <View style={styles.preview}>
            <Text style={styles.itemTitle}>{selectedGame?.name ?? "Game"} challenge</Text>
            <Text style={styles.copy}>{rulesetName({ ruleset_title: selectedRuleset?.name ?? null } as MatchChallengeListRow)} - {money(moneyFromInput(entryAmount))} entry - {displayLabel(skillLevel)}</Text>
          </View>
          <AppButton loading={createMutation.isPending} disabled={!profileReady || gamesQuery.isLoading} onPress={() => createMutation.mutate()}>Post challenge</AppButton>
        </SurfaceCard>
      ) : (
        <>
          <SurfaceCard>
            <View style={styles.sectionHeader}>
              <View style={styles.fill}>
                <Badge>Recommended</Badge>
                <Text style={styles.sectionTitle}>Best open matches</Text>
              </View>
              <Filter color={colors.cyan} size={24} />
            </View>
            {challengesQuery.isLoading ? <Text style={styles.copy}>Loading challenges...</Text> : null}
            {challengesQuery.isError ? <FeedbackState tone="error" title="Challenges unavailable" body="We could not load open challenges." actionLabel="Retry" onAction={() => void challengesQuery.refetch()} /> : null}
            {!challengesQuery.isLoading && challenges.length === 0 ? (
              <EmptyChallenge onPress={() => setMode("create")} />
            ) : null}
            {recommended.map((challenge) => (
              <ChallengeCard
                challenge={challenge}
                currentUserId={currentUserId}
                key={challenge.id}
                profileReady={profileReady}
                accepting={acceptMutation.isPending}
                onAccept={() => acceptMutation.mutate(challenge.id)}
              />
            ))}
          </SurfaceCard>

          <SurfaceCard>
            <View style={styles.sectionHeader}>
              <View style={styles.fill}>
                <Badge tone="cyan">Marketplace</Badge>
                <Text style={styles.sectionTitle}>Open H2H challenges</Text>
              </View>
              <Users color={colors.cyan} size={24} />
            </View>
            {challenges.slice(0, 20).map((challenge) => (
              <ChallengeCard
                challenge={challenge}
                compact
                currentUserId={currentUserId}
                key={challenge.id}
                profileReady={profileReady}
                accepting={acceptMutation.isPending}
                onAccept={() => acceptMutation.mutate(challenge.id)}
              />
            ))}
          </SurfaceCard>
        </>
      )}
    </AppScreen>
  );
}

function ChallengeCard({
  challenge,
  compact = false,
  currentUserId,
  profileReady,
  accepting,
  onAccept
}: {
  challenge: MatchChallengeListRow;
  compact?: boolean;
  currentUserId?: string;
  profileReady: boolean;
  accepting: boolean;
  onAccept: () => void;
}) {
  const isMine = currentUserId ? challenge.creator_user_id === currentUserId : false;
  const creatorRecord = `${challenge.creator_wins ?? 0}W - ${challenge.creator_losses ?? 0}L`;
  const badges = trustBadgesForChallenge(challenge);

  return (
    <View style={styles.challengeCard}>
      <View style={styles.challengeTop}>
        <View style={styles.badgeRow}>
          <Badge tone={isMine ? "amber" : "cyan"}>{isMine ? "Your challenge" : "Open challenge"}</Badge>
          {challenge.visibility === "private" ? <Badge tone="dark">Private</Badge> : null}
        </View>
        <Text style={styles.timeText}>{timeLeft(challenge.expires_at)}</Text>
      </View>
      <Text style={styles.challengeTitle}>{challenge.title || `${challenge.game_name ?? "Game"} challenge`}</Text>
      <Text style={styles.copy}>{challenge.game_name ?? "Game"} - {rulesetName(challenge)} - {challenge.platform} - {challenge.region}</Text>
      <View style={styles.infoGrid}>
        <InfoPill icon={Trophy} label="Entry" value={money(challenge.entry_amount_minor, challenge.currency)} />
        <InfoPill icon={Gamepad2} label="Skill" value={displayLabel(challenge.skill_level)} />
        <InfoPill icon={ShieldCheck} label="Trust" value={`${trustLabel(challenge.creator_trust_score)} (${challenge.creator_trust_score ?? 0})`} />
        <InfoPill icon={MapPin} label="Record" value={creatorRecord} />
      </View>
      {!compact ? <PlayerTrustBadgeStrip badges={badges} /> : <PlayerTrustBadgeStrip badges={badges.slice(0, 4)} compact />}
      <Text style={styles.creatorText}>Created by {creatorName(challenge)}.</Text>
      <View style={styles.cardActions}>
        {isMine ? (
          <AppButton style={styles.cardAction} variant="secondary" onPress={() => router.push(`/(app)/rooms/${challenge.match_room_id}`)}>Open room</AppButton>
        ) : (
          <AppButton style={styles.cardAction} loading={accepting} disabled={!profileReady} onPress={onAccept}>{profileReady ? "Accept challenge" : "Finish Profile first"}</AppButton>
        )}
        <AppButton style={styles.cardAction} variant="secondary" onPress={() => router.push(`/(app)/rooms/${challenge.match_room_id}`)}>View details</AppButton>
      </View>
    </View>
  );
}

function InfoPill({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <View style={styles.infoPill}>
      <Icon color={colors.cyan} size={16} strokeWidth={2.4} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Swords; label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Icon color={colors.cyan} size={19} />
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.modeButton, active && styles.modeButtonOn]} onPress={onPress}>
      <Text style={[styles.modeText, active && styles.modeTextOn]}>{label}</Text>
    </Pressable>
  );
}

function OptionGroup<T extends string>({
  values,
  selected,
  labelFor,
  onSelect
}: {
  values: T[];
  selected: T;
  labelFor: (value: T) => string;
  onSelect: (value: T) => void;
}) {
  if (values.length === 0) return <FormNotice tone="error" message="No option is available right now." />;

  return (
    <View style={styles.pickRow}>
      {values.map((value) => (
        <Chip key={value} label={labelFor(value)} selected={selected === value} onPress={() => onSelect(value)} />
      ))}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function EmptyChallenge({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.empty}>
      <Clock3 color={colors.cyan} size={28} />
      <Text style={styles.itemTitle}>No open challenge found</Text>
      <Text style={styles.copy}>Post a challenge with your preferred game, platform, region, and entry.</Text>
      <AppButton onPress={onPress}>Post challenge</AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.lg },
  heroTitle: { color: colors.white, fontSize: 36, lineHeight: 42, fontWeight: "900" },
  heroCopy: { color: "#c8d4df", fontSize: 16, lineHeight: 24 },
  heroStats: { flexDirection: "row", gap: spacing.sm },
  miniStat: { flex: 1, borderWidth: 1, borderColor: "#22344b", borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.navySoft, gap: 4 },
  miniLabel: { color: "#9dafc1", fontSize: 11, fontWeight: "900" },
  miniValue: { color: colors.white, fontSize: 14, fontWeight: "900" },
  modeRow: { flexDirection: "row", gap: spacing.sm },
  modeButton: { flex: 1, minHeight: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  modeButtonOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  modeText: { color: colors.muted, fontWeight: "900" },
  modeTextOn: { color: colors.white },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 25, lineHeight: 31, fontWeight: "900" },
  itemTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  fill: { flex: 1, minWidth: 0 },
  rowBetween: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  label: { color: colors.faint, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontWeight: "900" },
  formGrid: { gap: spacing.sm },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surfaceAlt
  },
  pickRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  chipOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  chipText: { color: colors.muted, fontWeight: "900" },
  chipTextOn: { color: colors.greenDark },
  preview: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceAlt, ...shadow.card },
  challengeCard: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.white, gap: spacing.md, ...shadow.card },
  challengeTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  badgeRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  timeText: { color: colors.faint, fontSize: 12, fontWeight: "900" },
  challengeTitle: { color: colors.ink, fontSize: 21, lineHeight: 26, fontWeight: "900" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  infoPill: { width: "48%", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.sm, gap: 3 },
  infoLabel: { color: colors.faint, fontSize: 10, textTransform: "uppercase", fontWeight: "900" },
  infoValue: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  creatorText: { color: colors.faint, fontSize: 12, fontWeight: "800" },
  cardActions: { gap: spacing.sm },
  cardAction: { width: "100%" },
  empty: { borderWidth: 1, borderColor: colors.line, borderStyle: "dashed", borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.lg, gap: spacing.sm }
});
