import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { CheckCircle2, Gamepad2, ReceiptText, ShieldCheck, Users } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { plainApiError } from "../../../api/errors";
import { profileOverview } from "../../../api/profile";
import { createRoom, getGames } from "../../../api/rooms";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, shadow, spacing } from "../../../constants/theme";
import { useActionFeedback } from "../../../providers/ActionFeedbackProvider";
import { fallbackRoomIssueRules } from "../roomIssueRules";

type Notice = { tone: "error" | "success" | "info"; message: string } | null;

function missingText(key: string) {
  if (key === "username") return "Choose a username in Profile.";
  if (key === "age_confirmation") return "Confirm your age in Profile.";
  if (key === "primary_game_account") return "Add your main in-game handle in Profile.";
  return key.replaceAll("_", " ");
}

function moneyFromInput(value: string) {
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function moneyPreview(value: string) {
  const amount = Math.round(moneyFromInput(value) / 100);
  return `NGN ${amount.toLocaleString()}`;
}

export function CreateRoomScreen() {
  const queryClient = useQueryClient();
  const { pushFeedback } = useActionFeedback();
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: profileOverview });
  const gamesQuery = useQuery({ queryKey: ["games"], queryFn: getGames });

  const games = gamesQuery.data?.games ?? [];
  const rulesets = gamesQuery.data?.rulesets ?? [];
  const defaultGameSlug = games[0]?.slug ?? "";
  const [selectedGameSlug, setSelectedGameSlug] = useState(defaultGameSlug);
  const selectedGame = games.find((game) => game.slug === selectedGameSlug) ?? games[0];
  const selectedRulesets = useMemo(() => {
    return rulesets.filter((ruleset) => {
      const gameId = typeof ruleset.game_id === "string" ? ruleset.game_id : undefined;
      return ruleset.game_slug === selectedGame?.slug || gameId === selectedGame?.id;
    });
  }, [rulesets, selectedGame?.id, selectedGame?.slug]);

  const [selectedRulesetSlug, setSelectedRulesetSlug] = useState("");
  const [title, setTitle] = useState("");
  const [entryAmount, setEntryAmount] = useState("2000");
  const [notice, setNotice] = useState<Notice>(null);

  const missing = profileQuery.data?.completion?.missing ?? [];
  const profileReady = Boolean(profileQuery.data?.completion?.complete);
  const selectedRuleset = selectedRulesets.find((ruleset) => ruleset.slug === selectedRulesetSlug) ?? selectedRulesets[0];

  const notify = (nextNotice: NonNullable<Notice>) => {
    setNotice(nextNotice);
    pushFeedback({
      tone: nextNotice.tone,
      title: nextNotice.tone === "error" ? "Room could not be created" : "Room created",
      message: nextNotice.message
    });
  };

  useEffect(() => {
    if (defaultGameSlug && !selectedGameSlug) setSelectedGameSlug(defaultGameSlug);
  }, [defaultGameSlug, selectedGameSlug]);

  useEffect(() => {
    setSelectedRulesetSlug(selectedRulesets[0]?.slug ?? "");
  }, [selectedGameSlug, selectedRulesets]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (!profileReady) throw new Error("Finish your Profile setup before creating rooms with entry fees.");
      if (!selectedGame?.slug || !selectedRuleset?.slug) throw new Error("Choose a game and rules before creating the room.");
      const entryAmountMinor = moneyFromInput(entryAmount);
      if (entryAmountMinor < 10_000) throw new Error("Entry amount must be at least NGN 100.");

      return createRoom({
        game_slug: selectedGame.slug,
        ruleset_slug: selectedRuleset.slug,
        entry_amount_minor: entryAmountMinor,
        commission_bps: 1000,
        title: title.trim() || undefined,
        open_on_create: true
      });
    },
    onSuccess: async (room) => {
      notify({ tone: "success", message: `Room created. Share code ${room.room_code ?? "from the room detail"} with your opponent.` });
      setTitle("");
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      if (room.id) router.push(`/(app)/rooms/${room.id}`);
    },
    onError: (error) => notify({ tone: "error", message: plainApiError(error, "Could not create room.") })
  });

  return (
    <AppScreen>
      <SurfaceCard dark>
        <Badge tone="dark">Create room</Badge>
        <Text style={styles.heroTitle}>Set up a fair match room.</Text>
        <Text style={styles.heroCopy}>Choose the game, rules, and entry amount. Skillsroom gives you a room code and keeps funding, match proof, and decisions in one place.</Text>
        <View style={styles.heroStats}>
          <MiniStep icon={Gamepad2} label="Game" value={selectedGame?.name ?? "Choose"} />
          <MiniStep icon={ReceiptText} label="Entry" value={moneyPreview(entryAmount)} />
          <MiniStep icon={ShieldCheck} label="Fee" value="10%" />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.rowBetween}>
          <View style={styles.fill}>
            <Badge tone={profileReady ? "green" : "amber"}>{profileReady ? "Ready" : "Setup needed"}</Badge>
            <Text style={styles.sectionTitle}>Player setup</Text>
            <Text style={styles.copy}>Rooms need your username, age confirmation, and main game account so opponents know who they are playing.</Text>
          </View>
          <CheckCircle2 size={36} color={profileReady ? colors.greenDark : colors.amber} />
        </View>
        {profileQuery.isLoading ? <Text style={styles.copy}>Checking your profile...</Text> : null}
        {profileQuery.isError ? <FeedbackState tone="error" title="Profile check failed" body="We could not confirm your player setup." actionLabel="Retry" onAction={() => void profileQuery.refetch()} /> : null}
        {!profileQuery.isLoading && !profileReady ? (
          <>
            <FormNotice tone="info" message={missing.length ? missing.map(missingText).join(" ") : "Finish your Profile setup before creating rooms with entry fees."} />
            <AppButton variant="secondary" onPress={() => router.push("/(app)/(tabs)/profile")}>Open Profile</AppButton>
          </>
        ) : null}
      </SurfaceCard>

      <SurfaceCard>
        <Badge tone="green">Room details</Badge>
        <Text style={styles.sectionTitle}>Game and rules</Text>
        {gamesQuery.isError ? <FeedbackState tone="error" title="Games unavailable" body="We could not load games and rule options." actionLabel="Retry" onAction={() => void gamesQuery.refetch()} /> : null}
        <Text style={styles.label}>Game</Text>
        <OptionGroup values={games.map((game) => game.slug)} selected={selectedGameSlug} labelFor={(slug) => games.find((game) => game.slug === slug)?.name ?? slug} onSelect={setSelectedGameSlug} />
        <Text style={styles.label}>Rules</Text>
        <OptionGroup values={selectedRulesets.map((ruleset) => ruleset.slug)} selected={selectedRulesetSlug} labelFor={(slug) => selectedRulesets.find((ruleset) => ruleset.slug === slug)?.name ?? slug} onSelect={setSelectedRulesetSlug} />
        <View style={styles.formGrid}>
          <TextInput value={entryAmount} onChangeText={setEntryAmount} keyboardType="number-pad" placeholder="Entry amount in NGN" placeholderTextColor={colors.faint} style={styles.input} />
          <TextInput value={title} onChangeText={setTitle} placeholder="Room title, optional" placeholderTextColor={colors.faint} style={styles.input} />
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Room preview</Text>
          <Text style={styles.copy}>{selectedGame?.name ?? "Game"} / {selectedRuleset?.name ?? "Rules"} / {moneyPreview(entryAmount)} entry</Text>
          <Text style={styles.copy}>The room opens right away. Share the code, wait for your opponent to join, then both entries are confirmed before play starts.</Text>
        </View>
        <View style={styles.rulesBox}>
          <Text style={styles.label}>Fair play rules</Text>
          <Text style={styles.copy}>Every room includes clear rules for late opponents, no-shows, disconnects, action timeouts, and proof that cannot be verified.</Text>
          <View style={styles.ruleChips}>
            {fallbackRoomIssueRules.map((rule) => <Text key={rule.key} style={styles.ruleChip}>{rule.title}</Text>)}
          </View>
        </View>
        {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
        <AppButton loading={createMutation.isPending} disabled={!profileReady || gamesQuery.isLoading} onPress={() => createMutation.mutate()}>Create room</AppButton>
        <AppButton variant="secondary" onPress={() => router.back()}>Back to rooms</AppButton>
      </SurfaceCard>

      <SurfaceCard>
        <Badge>Lifecycle</Badge>
        <Text style={styles.sectionTitle}>What happens next</Text>
        <LifecycleRow index="1" title="Create" detail="Get a room code your opponent can use." />
        <LifecycleRow index="2" title="Share" detail="Opponent joins using the private code." />
        <LifecycleRow index="3" title="Confirm entry" detail="Both players complete their entry before the match begins." />
        <LifecycleRow index="4" title="Play" detail="Start only after the room says play is ready." />
      </SurfaceCard>
    </AppScreen>
  );
}

function MiniStep({ icon: Icon, label, value }: { icon: typeof Gamepad2; label: string; value: string }) {
  return (
    <View style={styles.miniStep}>
      <Icon size={19} color={colors.cyan} />
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function LifecycleRow({ index, title, detail }: { index: string; title: string; detail: string }) {
  return (
    <View style={styles.lifecycleRow}>
      <Text style={styles.lifecycleIndex}>{index}</Text>
      <View style={styles.fill}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.copy}>{detail}</Text>
      </View>
    </View>
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
    <View style={styles.optionWrap}>
      {values.map((value) => (
        <Pressable key={value} onPress={() => onSelect(value)} style={[styles.option, selected === value && styles.optionOn]}>
          <Text style={[styles.optionText, selected === value && styles.optionTextOn]}>{labelFor(value)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heroTitle: { color: colors.white, fontSize: 38, lineHeight: 44, fontWeight: "900" },
  heroCopy: { color: "#c8d4e1", fontSize: 16, lineHeight: 24 },
  sectionTitle: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  itemTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  fill: { flex: 1 },
  rowBetween: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  heroStats: { flexDirection: "row", gap: spacing.sm },
  miniStep: { flex: 1, borderWidth: 1, borderColor: "#22344b", borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.navySoft, gap: 4 },
  miniLabel: { color: "#9dafc1", fontSize: 11, fontWeight: "900" },
  miniValue: { color: colors.white, fontSize: 14, fontWeight: "900" },
  label: { color: colors.faint, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontWeight: "900" },
  formGrid: { gap: spacing.sm },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surfaceAlt
  },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  option: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  optionOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  optionText: { color: colors.muted, fontWeight: "900" },
  optionTextOn: { color: colors.greenDark },
  summaryCard: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceAlt, ...shadow.card },
  summaryTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  rulesBox: { borderWidth: 1, borderColor: colors.cyan, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.cyanSoft, gap: spacing.sm },
  ruleChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  ruleChip: { borderWidth: 1, borderColor: "#bae6fd", borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 6, color: colors.cyan, backgroundColor: colors.white, fontSize: 12, fontWeight: "900" },
  lifecycleRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceAlt },
  lifecycleIndex: { width: 38, height: 38, borderRadius: 14, textAlign: "center", textAlignVertical: "center", color: colors.cyan, backgroundColor: colors.cyanSoft, fontSize: 18, fontWeight: "900" }
});
