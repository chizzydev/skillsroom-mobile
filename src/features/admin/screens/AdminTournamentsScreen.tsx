import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, BadgeCheck, CalendarClock, ClipboardCheck, Flag, GitBranch, LockKeyhole, Radio, ShieldCheck, Trophy, UsersRound } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  adminLanesFor,
  applyAdminTournamentCumulativeScores,
  canAccessAdmin,
  canUseAdminSection,
  confirmAdminStepUp,
  createAdminTournament,
  generateAdminTournamentStructure,
  getAdminTournamentDetail,
  grantAdminTournamentHost,
  linkAdminTournamentMatchRooms,
  listAdminGameCatalog,
  listAdminTournamentContributions,
  listAdminTournaments,
  reserveAdminTournamentRefunds,
  reserveAdminTournamentSettlement,
  reviewAdminTournamentContribution,
  reviewAdminTournamentMatchResult,
  roleLabel,
  seedAdminTournament,
  updateAdminTournamentHostEvent,
  type TournamentCumulativeScoreResultInput,
  type TournamentEntryType,
  type TournamentFeeMode,
  type TournamentHostRole,
  type TournamentPrizeDistributionMode,
  type TournamentResultReviewDecision,
  type TournamentScoringMode,
  type TournamentSeedMode
} from "../../../api/admin";
import { plainApiError } from "../../../api/errors";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, spacing } from "../../../constants/theme";
import { useAuthStore } from "../../../store/auth-store";
import type { Tournament, TournamentDetail, TournamentFormat, TournamentPrizeContribution, TournamentStateEvent } from "../../../types/api";

type Notice = { tone: "error" | "success" | "info"; message: string } | null;
type Tone = "cyan" | "green" | "amber" | "red";

const formatOptions: Array<{ value: TournamentFormat; label: string; detail: string }> = [
  { value: "single_elimination", label: "Single elim.", detail: "Knockout bracket" },
  { value: "double_elimination", label: "Double elim.", detail: "Losers bracket" },
  { value: "round_robin", label: "Round robin", detail: "Everyone plays" },
  { value: "swiss", label: "Swiss", detail: "Record pairings" },
  { value: "group_stage_playoffs", label: "Groups", detail: "Groups to finals" },
  { value: "league", label: "League", detail: "Scheduled table" },
  { value: "season", label: "Season", detail: "Long campaign" },
  { value: "free_for_all", label: "FFA", detail: "Many players" },
  { value: "leaderboard", label: "Leaderboard", detail: "Ranked score" },
  { value: "race", label: "Race", detail: "Placement" },
  { value: "time_trial", label: "Time trial", detail: "Best time" },
  { value: "grand_prix", label: "Grand prix", detail: "Multi-race" }
];

const feeModes: TournamentFeeMode[] = ["free", "paid", "sponsored", "hybrid"];
const entryTypes: TournamentEntryType[] = ["solo", "team"];
const scoringModes: TournamentScoringMode[] = ["match_win_loss", "cumulative_score", "points", "placement"];
const prizeModes: TournamentPrizeDistributionMode[] = ["winner_take_all", "top_2_split", "top_3_split", "custom_fixed", "custom_percentage"];
const seedModes: TournamentSeedMode[] = ["registration_order", "random", "reputation", "manual"];
const reviewDecisions: TournamentResultReviewDecision[] = ["confirm_score", "mark_disputed", "void_match", "forfeit_entry", "no_show_entry", "disqualify_entry"];
const hostRoles: TournamentHostRole[] = ["creator", "co_host", "sponsor"];

type TournamentForm = {
  title: string;
  description: string;
  gameSlug: string;
  rulesetSlug: string;
  format: TournamentFormat;
  entryType: TournamentEntryType;
  feeMode: TournamentFeeMode;
  scoringMode: TournamentScoringMode;
  prizeMode: TournamentPrizeDistributionMode;
  currency: string;
  entryFee: string;
  sponsoredPool: string;
  guaranteedPool: string;
  commissionBps: string;
  minEntries: string;
  maxEntries: string;
  teamMin: string;
  teamMax: string;
  registrationOpens: string;
  registrationCloses: string;
  startsAt: string;
  endsAt: string;
  matchCheckIn: boolean;
  evidenceRequired: boolean;
  allowWaitlist: boolean;
  tiebreakers: string;
};

const blankTournamentForm: TournamentForm = {
  title: "",
  description: "",
  gameSlug: "",
  rulesetSlug: "",
  format: "single_elimination",
  entryType: "solo",
  feeMode: "free",
  scoringMode: "match_win_loss",
  prizeMode: "winner_take_all",
  currency: "NGN",
  entryFee: "0",
  sponsoredPool: "0",
  guaranteedPool: "0",
  commissionBps: "0",
  minEntries: "2",
  maxEntries: "16",
  teamMin: "1",
  teamMax: "1",
  registrationOpens: "",
  registrationCloses: "",
  startsAt: "",
  endsAt: "",
  matchCheckIn: true,
  evidenceRequired: true,
  allowWaitlist: false,
  tiebreakers: ""
};

function money(currency = "NGN", minor = 0) {
  return `${currency} ${Math.round(minor / 100).toLocaleString()}`;
}

function numberValue(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nairaMinor(value: string) {
  return Math.max(0, Math.round(numberValue(value) * 100));
}

function optionalIso(value: string) {
  const text = value.trim();
  if (!text) return undefined;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function label(value?: string | null) {
  if (!value) return "Unknown";
  return value.split("_").map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ");
}

function slugLabel(value?: string | null) {
  if (!value) return "";
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function shortId(value?: string | null) {
  if (!value) return "Not supplied";
  return value.length <= 14 ? value : `${value.slice(0, 8)}...${value.slice(-5)}`;
}

function dateLabel(value?: string | null) {
  if (!value) return "Not scheduled";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;
  return new Date(value).toLocaleString("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusTone(status?: string): Tone {
  if (status === "completed" || status === "registration_open") return "green";
  if (status === "cancelled" || status === "voided" || status === "disputed") return "red";
  if (status === "in_progress" || status === "seeding" || status === "under_review") return "cyan";
  return "amber";
}

function prizePool(tournament: Tournament) {
  return Math.max(
    tournament.approved_prize_contribution_minor ?? 0,
    (tournament.sponsored_prize_pool_minor ?? 0) + (tournament.guaranteed_prize_pool_minor ?? 0)
  );
}

function activeTournaments(tournaments: Tournament[]) {
  const statuses = new Set(["registration_open", "registration_locked", "seeding", "in_progress", "awaiting_results", "under_review", "disputed", "settlement_pending"]);
  return tournaments.filter((tournament) => statuses.has(tournament.status));
}

function entryName(detail: TournamentDetail, entryId?: string | null) {
  if (!entryId) return "TBD";
  const entry = detail.entries.find((item) => item.id === entryId);
  return entry?.team_name || entry?.display_name || shortId(entryId);
}

function matchEntrants(detail: TournamentDetail, matchId: string) {
  const sides = detail.match_sides.filter((side) => side.tournament_match_id === matchId).sort((a, b) => a.side_index - b.side_index);
  return sides.length ? sides.map((side) => entryName(detail, side.entry_id)).join(" vs ") : "No entrants assigned";
}

function parseScoreRows(raw: string): TournamentCumulativeScoreResultInput[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [entry_id, placement, score, kills, time_ms, bonus_points, penalty_points] = line.split(/[,\t]/).map((part) => part.trim());
      return {
        entry_id,
        placement: placement ? Number(placement) : undefined,
        score: score ? Number(score) : undefined,
        kills: kills ? Number(kills) : undefined,
        time_ms: time_ms ? Number(time_ms) : undefined,
        bonus_points: bonus_points ? Number(bonus_points) : undefined,
        penalty_points: penalty_points ? Number(penalty_points) : undefined
      };
    })
    .filter((row) => row.entry_id);
}

function openAdminLane(section: string) {
  if (section === "overview") {
    router.replace({ pathname: "/admin" } as never);
    return;
  }
  if (section === "funding") {
    router.push({ pathname: "/admin/funding" } as never);
    return;
  }
  if (section === "wallet") {
    router.push({ pathname: "/admin/wallet" } as never);
    return;
  }
  if (section === "results") {
    router.push({ pathname: "/admin/results" } as never);
    return;
  }
  if (section === "settlements") {
    router.push({ pathname: "/admin/payments" } as never);
    return;
  }
  if (section === "players") {
    router.push({ pathname: "/admin/players" } as never);
    return;
  }
  if (section === "risk") {
    router.push({ pathname: "/admin/safety" } as never);
    return;
  }
  if (section === "team") {
    router.push({ pathname: "/admin/team" } as never);
    return;
  }
}

export function AdminTournamentsScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice>(null);
  const [password, setPassword] = useState("");
  const [stepUpToken, setStepUpToken] = useState<string | null>(null);
  const [stepUpExpiresAt, setStepUpExpiresAt] = useState<string | null>(null);
  const [form, setForm] = useState<TournamentForm>(blankTournamentForm);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [selectedContributionId, setSelectedContributionId] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [seedMode, setSeedMode] = useState<TournamentSeedMode>("registration_order");
  const [manualSeedIds, setManualSeedIds] = useState("");
  const [operationReason, setOperationReason] = useState("");
  const [forceStructure, setForceStructure] = useState(false);
  const [roundId, setRoundId] = useState("");
  const [matchId, setMatchId] = useState("");
  const [scoreRows, setScoreRows] = useState("");
  const [reviewDecision, setReviewDecision] = useState<TournamentResultReviewDecision>("confirm_score");
  const [winningEntryId, setWinningEntryId] = useState("");
  const [penalizedEntryId, setPenalizedEntryId] = useState("");
  const [resultClaimId, setResultClaimId] = useState("");
  const [scoreSummary, setScoreSummary] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [hostTarget, setHostTarget] = useState("");
  const [hostRole, setHostRole] = useState<TournamentHostRole>("co_host");
  const [hostNotes, setHostNotes] = useState("");
  const [hostPermissions, setHostPermissions] = useState({ manage_event: true, manage_sponsors: false, view_finances: false });
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventFeatured, setEventFeatured] = useState(false);
  const [eventSponsorLabel, setEventSponsorLabel] = useState("");
  const [eventSponsorUrl, setEventSponsorUrl] = useState("");
  const canAdmin = canAccessAdmin(user);
  const canTournaments = canUseAdminSection(user, "tournaments");
  const lanes = useMemo(() => adminLanesFor(user), [user]);

  const tournamentsQuery = useQuery({
    queryKey: ["admin", "tournaments"],
    queryFn: async () => {
      const [catalog, tournaments, contributions] = await Promise.all([
        listAdminGameCatalog(),
        listAdminTournaments({ limit: 40 }),
        listAdminTournamentContributions("submitted")
      ]);
      const detailResults = await Promise.all(
        activeTournaments(tournaments).slice(0, 4).map(async (tournament) => {
          try {
            return await getAdminTournamentDetail(tournament.id);
          } catch {
            return null;
          }
        })
      );
      return { catalog, tournaments, contributions, details: detailResults.filter(Boolean) as Array<{ tournament: TournamentDetail; events: TournamentStateEvent[] }> };
    },
    enabled: canTournaments
  });

  const tournaments = tournamentsQuery.data?.tournaments ?? [];
  const contributions = tournamentsQuery.data?.contributions ?? [];
  const details = tournamentsQuery.data?.details ?? [];
  const selectedTournament = tournaments.find((item) => item.id === selectedTournamentId);
  const openCount = tournaments.filter((item) => item.status === "registration_open").length;
  const draftCount = tournaments.filter((item) => item.status === "draft").length;
  const activeCount = activeTournaments(tournaments).length;
  const exposureMinor = tournaments.reduce((sum, item) => sum + prizePool(item), 0);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "tournaments"] });
  };

  const stepUpMutation = useMutation({
    mutationFn: async () => {
      if (!password.trim()) throw new Error("Enter your password to unlock tournament money and decision actions.");
      return confirmAdminStepUp(password);
    },
    onSuccess: (result) => {
      setStepUpToken(result.step_up_token ?? null);
      setStepUpExpiresAt(result.expires_at ?? null);
      setPassword("");
      setNotice({ tone: "success", message: "Tournament sensitive actions are unlocked for this session." });
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Tournament actions could not be unlocked.") })
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Enter the tournament title.");
      if (!form.gameSlug.trim()) throw new Error("Choose or enter a game slug.");
      if (form.feeMode === "free" && nairaMinor(form.entryFee) > 0) throw new Error("Free events must keep entry fee at zero.");
      if ((form.feeMode === "paid" || form.feeMode === "hybrid") && nairaMinor(form.entryFee) <= 0) throw new Error("Paid or hybrid events need an entry fee.");
      if (form.entryType === "solo" && (numberValue(form.teamMin, 1) !== 1 || numberValue(form.teamMax, 1) !== 1)) {
        throw new Error("Solo events must use team size 1-1.");
      }
      return createAdminTournament({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        game_slug: form.gameSlug.trim(),
        ruleset_slug: form.rulesetSlug.trim() || undefined,
        format: form.format,
        entry_type: form.entryType,
        fee_mode: form.feeMode,
        scoring_mode: form.scoringMode,
        prize_distribution_mode: form.prizeMode,
        currency: form.currency.trim() || "NGN",
        entry_fee_amount_minor: nairaMinor(form.entryFee),
        sponsored_prize_pool_minor: nairaMinor(form.sponsoredPool),
        guaranteed_prize_pool_minor: nairaMinor(form.guaranteedPool),
        commission_bps: Math.max(0, Math.round(numberValue(form.commissionBps))),
        min_entries: Math.max(2, Math.round(numberValue(form.minEntries, 2))),
        max_entries: Math.max(2, Math.round(numberValue(form.maxEntries, 16))),
        team_size_min: Math.max(1, Math.round(numberValue(form.teamMin, 1))),
        team_size_max: Math.max(1, Math.round(numberValue(form.teamMax, 1))),
        registration_opens_at: optionalIso(form.registrationOpens),
        registration_closes_at: optionalIso(form.registrationCloses),
        starts_at: optionalIso(form.startsAt),
        ends_at: optionalIso(form.endsAt),
        settings: {
          match_check_in_required: form.matchCheckIn,
          evidence_required: form.evidenceRequired,
          allow_waitlist: form.allowWaitlist,
          tiebreakers: form.tiebreakers.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
        }
      });
    },
    onSuccess: async (tournament) => {
      setNotice({ tone: "success", message: "Tournament created. Review it before publishing or generating structure." });
      setSelectedTournamentId(tournament.id);
      setForm(blankTournamentForm);
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Tournament could not be created.") })
  });

  const guardedMutation = useMutation({
    mutationFn: async (action: string) => {
      if (!selectedTournamentId.trim()) throw new Error("Select or paste a tournament ID first.");
      if (["contribution_approve", "contribution_reject", "link", "scores", "result", "settlement", "refunds", "host", "event"].includes(action) && !stepUpToken) {
        throw new Error("Unlock sensitive tournament actions first.");
      }
      if (action === "contribution_approve" || action === "contribution_reject") {
        if (!selectedContributionId.trim()) throw new Error("Select a contribution row first.");
        return reviewAdminTournamentContribution(selectedContributionId.trim(), {
          decision: action === "contribution_approve" ? "approve" : "reject",
          note: reviewNote,
          stepUpToken: stepUpToken as string
        });
      }
      if (action === "seed") {
        return seedAdminTournament(selectedTournamentId.trim(), {
          mode: seedMode,
          entry_ids: seedMode === "manual" ? manualSeedIds.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean) : undefined,
          reason: operationReason
        });
      }
      if (action === "structure") {
        return generateAdminTournamentStructure(selectedTournamentId.trim(), { force: forceStructure, reason: operationReason });
      }
      if (action === "link") {
        return linkAdminTournamentMatchRooms(selectedTournamentId.trim(), { round_id: roundId, match_id: matchId, reason: operationReason, stepUpToken: stepUpToken as string });
      }
      if (action === "scores") {
        if (!matchId.trim()) throw new Error("Enter the tournament match ID.");
        const results = parseScoreRows(scoreRows);
        if (!results.length) throw new Error("Paste at least one score row: entryId, placement, score, kills, timeMs, bonus, penalty.");
        return applyAdminTournamentCumulativeScores(selectedTournamentId.trim(), { match_id: matchId, results, reason: operationReason, stepUpToken: stepUpToken as string });
      }
      if (action === "result") {
        if (!matchId.trim()) throw new Error("Enter the match ID to review.");
        return reviewAdminTournamentMatchResult(selectedTournamentId.trim(), matchId.trim(), {
          decision: reviewDecision,
          winning_entry_id: winningEntryId,
          penalized_entry_id: penalizedEntryId,
          result_claim_id: resultClaimId,
          score_summary: scoreSummary,
          note: operationReason,
          stepUpToken: stepUpToken as string
        });
      }
      if (action === "settlement") return reserveAdminTournamentSettlement(selectedTournamentId.trim(), { notes: operationReason, stepUpToken: stepUpToken as string });
      if (action === "refunds") {
        if (!refundReason.trim()) throw new Error("Enter the refund reason.");
        return reserveAdminTournamentRefunds(selectedTournamentId.trim(), { reason: refundReason, stepUpToken: stepUpToken as string });
      }
      if (action === "host") {
        if (!hostTarget.trim()) throw new Error("Enter a username or user ID for the host.");
        return grantAdminTournamentHost(selectedTournamentId.trim(), {
          target: hostTarget,
          role: hostRole,
          permissions: hostPermissions,
          notes: hostNotes,
          stepUpToken: stepUpToken as string
        });
      }
      return updateAdminTournamentHostEvent(selectedTournamentId.trim(), {
        title: eventTitle,
        description: eventDescription,
        settings: {
          featured: eventFeatured,
          sponsor_label: eventSponsorLabel.trim() || undefined,
          sponsor_url: eventSponsorUrl.trim() || undefined
        },
        stepUpToken: stepUpToken as string
      });
    },
    onSuccess: async (_, action) => {
      setNotice({ tone: "success", message: actionSuccess(action) });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Tournament operation failed.") })
  });

  if (!canAdmin) {
    return (
      <AppScreen>
        <SurfaceCard dark style={styles.permissionHero}>
          <Badge tone="dark">Team workspace</Badge>
          <Text style={styles.darkHeroTitle}>Admin access is not enabled for this account.</Text>
          <Text style={styles.darkCopy}>Only Support, Community Manager, Admin, and Owner roles can open tournament operations.</Text>
        </SurfaceCard>
        <AppButton onPress={() => router.replace("/(app)/(tabs)/home")}>Back to player app</AppButton>
      </AppScreen>
    );
  }

  if (!canTournaments) {
    return (
      <AppScreen>
        <SurfaceCard dark style={styles.permissionHero}>
          <Badge tone="dark">{roleLabel(user?.role)}</Badge>
          <Text style={styles.darkHeroTitle}>Tournament admin is outside this role.</Text>
          <Text style={styles.darkCopy}>Ask an owner to grant Admin or Community Manager access if tournament operations belong in your queue.</Text>
        </SurfaceCard>
        <AppButton onPress={() => router.replace("/admin")}>Back to overview</AppButton>
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false}>
      <View style={styles.shell}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.replace("/admin")} style={styles.iconButton}>
            <ArrowLeft color={colors.white} size={22} />
          </Pressable>
          <View style={styles.brandMark}><Text style={styles.brandText}>SR</Text></View>
          <View style={styles.brandCopy}>
            <Text style={styles.shellTitle} numberOfLines={1}>Tournament admin</Text>
            <Text style={styles.shellMeta}>{roleLabel(user?.role)} workspace</Text>
          </View>
          <Pressable onPress={() => router.replace("/(app)/(tabs)/home")} style={styles.playerButton}>
            <Text style={styles.playerButtonText}>Player{"\n"}app</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.laneTabs}>
          {lanes.map((lane) => (
            <Pressable key={lane.key} onPress={() => openAdminLane(lane.key)} style={[styles.laneTab, lane.key === "tournaments" && styles.laneTabActive]}>
              <Text style={[styles.laneTabText, lane.key === "tournaments" && styles.laneTabTextActive]}>{lane.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
        {tournamentsQuery.isError ? <FormNotice tone="error" message={plainApiError(tournamentsQuery.error, "Tournament admin data could not be loaded.")} /> : null}

        <SurfaceCard style={styles.hero}>
          <Badge tone="cyan">Tournaments</Badge>
          <Text style={styles.heroTitle}>Tournament command center.</Text>
          <Text style={styles.copy}>Create events, review entry money, seed brackets, link match rooms, record results, and prepare payouts from one workspace.</Text>
        </SurfaceCard>

        <View style={styles.livePill}>
          <View style={styles.liveIcon}><Radio color={colors.greenDark} size={22} /></View>
          <View style={styles.fill}>
            <Text style={styles.liveTitle}>Tournament updates</Text>
            <Text style={styles.liveMeta}>Listening for event, queue, result, and payout changes.</Text>
          </View>
          <Badge tone="green">On</Badge>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard tone="green" label="Open" value={String(openCount)} detail="Registration open" />
          <MetricCard tone="amber" label="Drafts" value={String(draftCount)} detail="Needs publishing" />
          <MetricCard tone="cyan" label="Active" value={String(activeCount)} detail="Setup, live, review" />
          <MetricCard tone="red" label="Prize exposure" value={money("NGN", exposureMinor)} detail="Approved/projected" />
        </View>

        <SurfaceCard style={styles.securityCard}>
          <View style={styles.securityHeader}>
            <View style={styles.securityIcon}><LockKeyhole color={colors.amber} size={24} /></View>
            <View style={styles.fill}>
              <Text style={styles.rowTitle}>Unlock sensitive tournament actions</Text>
              <Text style={styles.rowMeta}>Required before contribution approval, match room linking, result decisions, settlement reserves, refunds, host grants, or event updates.</Text>
            </View>
          </View>
          <LabeledInput label="Current password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Confirm before sensitive action" />
          <AppButton variant="dark" loading={stepUpMutation.isPending} onPress={() => stepUpMutation.mutate()}>Unlock actions</AppButton>
          {stepUpToken ? <Text style={styles.helpText}>Unlocked{stepUpExpiresAt ? ` until ${dateLabel(stepUpExpiresAt)}` : " for this session"}.</Text> : null}
        </SurfaceCard>

        <SectionHeader eyebrow="Active events" title="Tournament dashboard" detail="Live events appear first with entrant health, match oversight, standings, prize rows, and recent activity." />
        {tournamentsQuery.isLoading ? (
          <FeedbackState title="Loading tournaments" body="Checking active events, prize queues, and match oversight." />
        ) : details.length ? (
          details.map((item) => <TournamentCommandCard key={item.tournament.id} detail={item.tournament} events={item.events} onSelect={(id, match) => {
            setSelectedTournamentId(id);
            if (match) setMatchId(match);
          }} />)
        ) : (
          <EmptyState title="No active tournament command rows" body="Drafts and completed events still appear in the board below." />
        )}

        <SectionHeader eyebrow="Events" title="Tournament board" detail="Tap any tournament to prepare the review and update tools below." />
        <View style={styles.queueBlock}>
          {tournaments.length ? tournaments.map((tournament) => (
            <TournamentRow key={tournament.id} tournament={tournament} selected={selectedTournamentId === tournament.id} onPress={() => setSelectedTournamentId(tournament.id)} />
          )) : <EmptyState title="No tournaments found" body="Create the first event below when the game, ruleset, schedule, and money model are ready." />}
        </View>

        <SectionHeader eyebrow="Contribution review" title="Prize and entry money queue" detail="Approve only after checking bank records, proof, sender identity, amount, and tournament context." />
        <View style={styles.queueBlock}>
          {contributions.length ? contributions.map((row) => (
            <ContributionRow key={row.id} row={row} selected={selectedContributionId === row.id} onPress={() => {
              setSelectedContributionId(row.id);
              setSelectedTournamentId(row.tournament_id);
            }} />
          )) : <EmptyState title="Contribution queue is clear" body="Submitted sponsor and participant tournament money will appear here." />}
          <LabeledInput label="Selected contribution ID" value={selectedContributionId} onChangeText={setSelectedContributionId} mono />
          <LabeledInput label="Review note" value={reviewNote} onChangeText={setReviewNote} placeholder="Bank alert matched / reference mismatch / proof unclear" multiline minHeight={86} />
          <View style={styles.actionRow}>
            <AppButton style={styles.actionButton} loading={guardedMutation.isPending} onPress={() => guardedMutation.mutate("contribution_approve")}>Approve</AppButton>
            <AppButton style={styles.actionButton} variant="danger" loading={guardedMutation.isPending} onPress={() => guardedMutation.mutate("contribution_reject")}>Reject</AppButton>
          </View>
        </View>

        <SectionHeader eyebrow="Create" title="Create tournament" detail="Start with the event details players will see. Publishing, seeding, bracket setup, and money actions stay separate." />
        <SurfaceCard style={styles.formStack}>
          <LabeledInput label="Title" value={form.title} onChangeText={(title) => setForm({ ...form, title })} placeholder="T26 Visual QA Bracket" />
          <LabeledInput label="Description" value={form.description} onChangeText={(description) => setForm({ ...form, description })} multiline minHeight={96} placeholder="What players should know before entering" />
          <Selector label="Game" value={form.gameSlug ? slugLabel(form.gameSlug) : "Choose game"} selected={form.gameSlug} options={(tournamentsQuery.data?.catalog.games ?? []).map((game) => ({ value: game.slug, label: game.name, detail: "Tournament game" }))} onSelect={(gameSlug) => setForm({ ...form, gameSlug })} />
          <Selector label="Ruleset" value={form.rulesetSlug ? slugLabel(form.rulesetSlug) : "Optional"} selected={form.rulesetSlug} options={(tournamentsQuery.data?.catalog.rulesets ?? []).filter((ruleset) => !form.gameSlug || ruleset.game_slug === form.gameSlug).map((ruleset) => ({ value: ruleset.slug, label: ruleset.name || slugLabel(ruleset.slug), detail: slugLabel(ruleset.game_slug) }))} onSelect={(rulesetSlug) => setForm({ ...form, rulesetSlug })} />
          <Selector label="Format" value={label(form.format)} selected={form.format} options={formatOptions.map((item) => ({ value: item.value, label: item.label, detail: item.detail }))} onSelect={(format) => setForm({ ...form, format: format as TournamentFormat })} />
          <ChipRow label="Entry type" values={entryTypes} selected={form.entryType} onSelect={(entryType) => setForm({ ...form, entryType: entryType as TournamentEntryType, teamMin: entryType === "solo" ? "1" : form.teamMin, teamMax: entryType === "solo" ? "1" : form.teamMax })} />
          <ChipRow label="Fee mode" values={feeModes} selected={form.feeMode} onSelect={(feeMode) => setForm({ ...form, feeMode: feeMode as TournamentFeeMode })} />
          <ChipRow label="Scoring" values={scoringModes} selected={form.scoringMode} onSelect={(scoringMode) => setForm({ ...form, scoringMode: scoringMode as TournamentScoringMode })} />
          <ChipRow label="Prize split" values={prizeModes} selected={form.prizeMode} onSelect={(prizeMode) => setForm({ ...form, prizeMode: prizeMode as TournamentPrizeDistributionMode })} />
          <View style={styles.twoCol}>
            <LabeledInput label="Entry fee (NGN)" value={form.entryFee} onChangeText={(entryFee) => setForm({ ...form, entryFee })} />
            <LabeledInput label="Commission bps" value={form.commissionBps} onChangeText={(commissionBps) => setForm({ ...form, commissionBps })} />
          </View>
          <View style={styles.twoCol}>
            <LabeledInput label="Sponsor pool" value={form.sponsoredPool} onChangeText={(sponsoredPool) => setForm({ ...form, sponsoredPool })} />
            <LabeledInput label="Guaranteed pool" value={form.guaranteedPool} onChangeText={(guaranteedPool) => setForm({ ...form, guaranteedPool })} />
          </View>
          <View style={styles.twoCol}>
            <LabeledInput label="Min entries" value={form.minEntries} onChangeText={(minEntries) => setForm({ ...form, minEntries })} />
            <LabeledInput label="Max entries" value={form.maxEntries} onChangeText={(maxEntries) => setForm({ ...form, maxEntries })} />
          </View>
          <View style={styles.twoCol}>
            <LabeledInput label="Team min" value={form.teamMin} onChangeText={(teamMin) => setForm({ ...form, teamMin })} />
            <LabeledInput label="Team max" value={form.teamMax} onChangeText={(teamMax) => setForm({ ...form, teamMax })} />
          </View>
          <LabeledInput label="Registration opens" optional value={form.registrationOpens} onChangeText={(registrationOpens) => setForm({ ...form, registrationOpens })} placeholder="2026-08-01 18:00" />
          <LabeledInput label="Registration closes" optional value={form.registrationCloses} onChangeText={(registrationCloses) => setForm({ ...form, registrationCloses })} placeholder="2026-08-04 18:00" />
          <LabeledInput label="Starts" optional value={form.startsAt} onChangeText={(startsAt) => setForm({ ...form, startsAt })} placeholder="2026-08-05 20:00" />
          <LabeledInput label="Ends" optional value={form.endsAt} onChangeText={(endsAt) => setForm({ ...form, endsAt })} placeholder="2026-08-05 23:00" />
          <ToggleRow label="Match check-in required" detail="Players must check in before event matches count." value={form.matchCheckIn} onPress={() => setForm({ ...form, matchCheckIn: !form.matchCheckIn })} />
          <ToggleRow label="Evidence required" detail="Results require evidence before settlement." value={form.evidenceRequired} onPress={() => setForm({ ...form, evidenceRequired: !form.evidenceRequired })} />
          <ToggleRow label="Allow waitlist" detail="Players can queue when capacity is full." value={form.allowWaitlist} onPress={() => setForm({ ...form, allowWaitlist: !form.allowWaitlist })} />
          <LabeledInput label="Tiebreakers" optional value={form.tiebreakers} onChangeText={(tiebreakers) => setForm({ ...form, tiebreakers })} multiline minHeight={90} placeholder="One tiebreaker per line" />
          <AppButton loading={createMutation.isPending} onPress={() => createMutation.mutate()}>Create tournament</AppButton>
        </SurfaceCard>

        <SectionHeader eyebrow="Operations" title="Run event operations" detail="Paste or tap a tournament ID, then run the exact operational task. Sensitive actions require the unlock above." />
        <SurfaceCard style={styles.formStack}>
          <LabeledInput label="Selected tournament ID" value={selectedTournamentId} onChangeText={setSelectedTournamentId} mono />
          {selectedTournament ? <FormNotice tone="info" message={`Selected: ${selectedTournament.title} / ${label(selectedTournament.status)} / ${money(selectedTournament.currency, prizePool(selectedTournament))}`} /> : null}
          <ChipRow label="Seed mode" values={seedModes} selected={seedMode} onSelect={(value) => setSeedMode(value as TournamentSeedMode)} />
          <LabeledInput label="Manual entry IDs" optional value={manualSeedIds} onChangeText={setManualSeedIds} placeholder="Only needed for manual seeding" multiline minHeight={78} mono />
          <LabeledInput label="Operation reason / note" optional value={operationReason} onChangeText={setOperationReason} multiline minHeight={86} />
          <View style={styles.actionGrid}>
            <AppButton variant="dark" loading={guardedMutation.isPending} onPress={() => guardedMutation.mutate("seed")}>Seed entries</AppButton>
            <ToggleRow label="Regenerate bracket structure" detail="Use only after confirming the current bracket can be replaced safely." value={forceStructure} onPress={() => setForceStructure(!forceStructure)} />
            <AppButton variant="secondary" loading={guardedMutation.isPending} onPress={() => guardedMutation.mutate("structure")}>Generate structure</AppButton>
          </View>
          <View style={styles.divider} />
          <LabeledInput label="Round ID" optional value={roundId} onChangeText={setRoundId} mono />
          <LabeledInput label="Match ID" optional value={matchId} onChangeText={setMatchId} mono />
          <AppButton variant="secondary" loading={guardedMutation.isPending} onPress={() => guardedMutation.mutate("link")}>Link match rooms</AppButton>
          <View style={styles.divider} />
          <LabeledInput label="Cumulative score rows" value={scoreRows} onChangeText={setScoreRows} placeholder="entryId, placement, score, kills, timeMs, bonus, penalty" multiline minHeight={112} mono />
          <AppButton variant="secondary" loading={guardedMutation.isPending} onPress={() => guardedMutation.mutate("scores")}>Apply scores</AppButton>
          <View style={styles.divider} />
          <ChipRow label="Result decision" values={reviewDecisions} selected={reviewDecision} onSelect={(value) => setReviewDecision(value as TournamentResultReviewDecision)} />
          <LabeledInput label="Winning entry ID" optional value={winningEntryId} onChangeText={setWinningEntryId} mono />
          <LabeledInput label="Penalized entry ID" optional value={penalizedEntryId} onChangeText={setPenalizedEntryId} mono />
          <LabeledInput label="Result claim ID" optional value={resultClaimId} onChangeText={setResultClaimId} mono />
          <LabeledInput label="Score summary" optional value={scoreSummary} onChangeText={setScoreSummary} />
          <AppButton variant="dark" loading={guardedMutation.isPending} onPress={() => guardedMutation.mutate("result")}>Apply result decision</AppButton>
          <View style={styles.divider} />
          <AppButton variant="secondary" loading={guardedMutation.isPending} onPress={() => guardedMutation.mutate("settlement")}>Reserve settlement</AppButton>
          <LabeledInput label="Refund reason" value={refundReason} onChangeText={setRefundReason} placeholder="Why entries should be refunded" multiline minHeight={78} />
          <AppButton variant="danger" loading={guardedMutation.isPending} onPress={() => guardedMutation.mutate("refunds")}>Reserve refunds</AppButton>
        </SurfaceCard>

        <SectionHeader eyebrow="Hosts" title="Host and sponsor controls" detail="Grant trusted people narrow access and update public event details without changing the tournament structure." />
        <SurfaceCard style={styles.formStack}>
          <LabeledInput label="Host username or user ID" value={hostTarget} onChangeText={setHostTarget} placeholder="username or user_id" />
          <ChipRow label="Host role" values={hostRoles} selected={hostRole} onSelect={(value) => setHostRole(value as TournamentHostRole)} />
          <ToggleRow label="Manage event" value={hostPermissions.manage_event} onPress={() => setHostPermissions({ ...hostPermissions, manage_event: !hostPermissions.manage_event })} />
          <ToggleRow label="Manage sponsors" value={hostPermissions.manage_sponsors} onPress={() => setHostPermissions({ ...hostPermissions, manage_sponsors: !hostPermissions.manage_sponsors })} />
          <ToggleRow label="View finances" value={hostPermissions.view_finances} onPress={() => setHostPermissions({ ...hostPermissions, view_finances: !hostPermissions.view_finances })} />
          <LabeledInput label="Host note" optional value={hostNotes} onChangeText={setHostNotes} multiline minHeight={78} />
          <AppButton variant="dark" loading={guardedMutation.isPending} onPress={() => guardedMutation.mutate("host")}>Grant host role</AppButton>
          <View style={styles.divider} />
          <LabeledInput label="Event title override" optional value={eventTitle} onChangeText={setEventTitle} />
          <LabeledInput label="Event description override" optional value={eventDescription} onChangeText={setEventDescription} multiline minHeight={86} />
          <LabeledInput label="Sponsor label" optional value={eventSponsorLabel} onChangeText={setEventSponsorLabel} />
          <LabeledInput label="Sponsor URL" optional value={eventSponsorUrl} onChangeText={setEventSponsorUrl} />
          <ToggleRow label="Feature event" value={eventFeatured} onPress={() => setEventFeatured(!eventFeatured)} />
          <AppButton variant="secondary" loading={guardedMutation.isPending} onPress={() => guardedMutation.mutate("event")}>Update event details</AppButton>
        </SurfaceCard>
      </ScrollView>
    </AppScreen>
  );
}

function actionSuccess(action: string) {
  const copy: Record<string, string> = {
    contribution_approve: "Tournament contribution approved.",
    contribution_reject: "Tournament contribution rejected.",
    seed: "Tournament entries seeded.",
    structure: "Tournament structure generated.",
    link: "Tournament match rooms linked.",
    scores: "Cumulative scores applied.",
    result: "Tournament match result decision applied.",
    settlement: "Tournament settlement reserved.",
    refunds: "Tournament refunds reserved.",
    host: "Tournament host role saved.",
    event: "Tournament event details updated."
  };
  return copy[action] ?? "Tournament operation completed.";
}

function SectionHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.copy}>{detail}</Text>
    </View>
  );
}

function MetricCard({ tone, label: labelText, value, detail }: { tone: Tone; label: string; value: string; detail: string }) {
  return (
    <SurfaceCard style={[styles.metricCard, styles[`${tone}Top`]]}>
      <Text style={styles.metricLabel}>{labelText}</Text>
      <Text style={[styles.metricValue, styles[`${tone}Text`]]}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </SurfaceCard>
  );
}

function TournamentCommandCard({ detail, events, onSelect }: { detail: TournamentDetail; events: TournamentStateEvent[]; onSelect: (tournamentId: string, matchId?: string) => void }) {
  const seeded = detail.entries.filter((entry) => typeof entry.seed === "number").length;
  const checkedIn = detail.entries.filter((entry) => entry.checked_in_at || ["checked_in", "seeded", "active", "eliminated"].includes(entry.status)).length;
  const linked = detail.matches.filter((match) => match.match_room_id).length;
  const openRounds = detail.rounds.filter((round) => ["ready", "in_progress"].includes(round.status)).length;
  const reviewMatches = detail.matches.filter((match) => ["awaiting_results", "under_review", "disputed"].includes(match.status));
  const standings = [...detail.standings].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999)).slice(0, 5);
  const oversight = [...detail.matches].sort((a, b) => Date.parse(b.updated_at ?? b.created_at ?? "") - Date.parse(a.updated_at ?? a.created_at ?? "")).slice(0, 5);

  return (
    <SurfaceCard style={styles.commandCard}>
      <Pressable onPress={() => onSelect(detail.id)} style={styles.commandTop}>
        <View style={styles.trophyIcon}><Trophy color={colors.cyan} size={24} /></View>
        <View style={styles.fill}>
          <Text style={styles.rowTitle}>{detail.title}</Text>
          <Text style={styles.rowMeta}>{detail.game_name || detail.game_slug || "Game"} / {label(detail.format)}</Text>
          <Text style={styles.monoHint}>{shortId(detail.id)}</Text>
          <Badge tone={statusTone(detail.status)}>{label(detail.status)}</Badge>
        </View>
      </Pressable>
      <View style={styles.miniGrid}>
        <MiniStat label="Entrants" value={`${detail.entries.length}/${detail.max_entries}`} />
        <MiniStat label="Seeded" value={String(seeded)} />
        <MiniStat label="Checked in" value={String(checkedIn)} />
        <MiniStat label="Rooms" value={String(linked)} />
        <MiniStat label="Open rounds" value={String(openRounds)} />
        <MiniStat label="Review queue" value={String(reviewMatches.length)} />
      </View>
      <Text style={styles.subhead}>Top standings</Text>
      {standings.length ? standings.map((standing) => (
        <View key={standing.id} style={styles.compactRow}>
          <Text style={styles.compactTitle}>#{standing.rank ?? "-"} {entryName(detail, standing.entry_id)}</Text>
          <Text style={styles.compactMeta}>{standing.points} pts / {standing.wins}-{standing.losses}-{standing.draws}</Text>
        </View>
      )) : <Text style={styles.rowMeta}>Standings are not generated yet.</Text>}
      <Text style={styles.subhead}>Match oversight</Text>
      {oversight.length ? oversight.map((match) => (
        <Pressable key={match.id} onPress={() => onSelect(detail.id, match.id)} style={styles.matchRow}>
          <View style={styles.fill}>
            <Text style={styles.compactTitle}>Match {match.match_number}: {matchEntrants(detail, match.id)}</Text>
            <Text style={styles.compactMeta}>{label(match.status)} / Room {shortId(match.match_room_id)}</Text>
          </View>
          <Badge tone={statusTone(match.status)}>{label(match.status)}</Badge>
        </Pressable>
      )) : <Text style={styles.rowMeta}>No generated matches yet.</Text>}
      <Text style={styles.subhead}>Recent updates</Text>
      {events.slice(0, 4).map((event) => (
        <Text key={event.id} style={styles.auditLine}>{label(event.from_status)} {"->"} {label(event.to_status)} / {dateLabel(event.created_at)}</Text>
      ))}
    </SurfaceCard>
  );
}

function TournamentRow({ tournament, selected, onPress }: { tournament: Tournament; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tournamentRow, selected && styles.selectedRow]}>
      <View style={styles.rowTop}>
        <View style={styles.trophyIcon}><GitBranch color={colors.cyan} size={22} /></View>
        <View style={styles.fill}>
          <Text style={styles.rowTitle}>{tournament.title}</Text>
          <Text style={styles.rowMeta}>{tournament.game_name || tournament.game_slug || "Game"} / {label(tournament.format)}</Text>
          <Badge tone={statusTone(tournament.status)}>{label(tournament.status)}</Badge>
        </View>
      </View>
      <View style={styles.detailGrid}>
        <DetailCell label="Entries" value={`${tournament.registered_entry_count ?? 0}/${tournament.max_entries}`} />
        <DetailCell label="Prize" value={money(tournament.currency, prizePool(tournament))} />
        <DetailCell label="Starts" value={dateLabel(tournament.starts_at)} />
        <DetailCell label="ID" value={shortId(tournament.id)} mono />
      </View>
    </Pressable>
  );
}

function ContributionRow({ row, selected, onPress }: { row: TournamentPrizeContribution; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tournamentRow, selected && styles.selectedRow]}>
      <View style={styles.rowTop}>
        <View style={styles.trophyIcon}><ShieldCheck color={colors.greenDark} size={22} /></View>
        <View style={styles.fill}>
          <Text style={styles.rowTitle}>{row.tournament_title || "Tournament contribution"}</Text>
          <Text style={styles.rowMeta}>{label(row.source)} / {row.entry_display_name || shortId(row.tournament_entry_id)}</Text>
          <Badge tone={statusTone(row.status)}>{label(row.status)}</Badge>
        </View>
      </View>
      <Text style={styles.amountText}>{money(row.currency, row.amount_minor)}</Text>
      <View style={styles.detailGrid}>
        <DetailCell label="Reference" value={row.external_reference || "No reference"} />
        <DetailCell label="Proof" value={row.proof_url ? "Proof supplied" : "Missing proof"} />
        <DetailCell label="Contribution ID" value={shortId(row.id)} mono />
      </View>
    </Pressable>
  );
}

function Selector({ label: labelText, value, selected, options, onSelect }: { label: string; value: string; selected?: string; options: Array<{ value: string; label: string; detail?: string }>; onSelect: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{labelText}</Text>
      <Text style={styles.selectValue}>{value}</Text>
      <View style={styles.optionGrid}>
        {options.length ? options.map((option) => (
          <Pressable key={option.value} onPress={() => onSelect(option.value)} style={[styles.modeTab, selected === option.value && styles.modeTabSelected]}>
            <Text style={[styles.modeTabTitle, selected === option.value && styles.modeTabTitleSelected]}>{option.label}</Text>
            {option.detail ? <Text style={[styles.modeTabDetail, selected === option.value && styles.modeTabDetailSelected]}>{option.detail}</Text> : null}
          </Pressable>
        )) : <Text style={styles.rowMeta}>No options loaded yet.</Text>}
      </View>
    </View>
  );
}

function ChipRow({ label: labelText, values, selected, onSelect }: { label: string; values: string[]; selected: string; onSelect: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{labelText}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {values.map((value) => (
          <Pressable key={value} onPress={() => onSelect(value)} style={[styles.chip, selected === value && styles.chipActive]}>
            <Text style={[styles.chipText, selected === value && styles.chipTextActive]}>{label(value)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ToggleRow({ label: labelText, detail, value, onPress }: { label: string; detail?: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.toggleRow}>
      <View style={styles.fill}>
        <Text style={styles.rowTitle}>{labelText}</Text>
        {detail ? <Text style={styles.rowMeta}>{detail}</Text> : null}
      </View>
      <Badge tone={value ? "green" : "dark"}>{value ? "On" : "Off"}</Badge>
    </Pressable>
  );
}

function LabeledInput({
  label: labelText,
  optional,
  value,
  onChangeText,
  placeholder,
  multiline,
  minHeight,
  secureTextEntry,
  mono
}: {
  label: string;
  optional?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  minHeight?: number;
  secureTextEntry?: boolean;
  mono?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{labelText}</Text>
      {optional ? <Text style={styles.optionalLabel}>(optional)</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.multilineInput, mono && styles.inputMono, minHeight ? { minHeight } : null]}
      />
    </View>
  );
}

function DetailCell({ label: labelText, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailCell}>
      <Text style={styles.detailLabel}>{labelText}</Text>
      <Text style={[styles.detailValue, mono && styles.monoText]}>{value}</Text>
    </View>
  );
}

function MiniStat({ label: labelText, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.metricLabel}>{labelText}</Text>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowMeta}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionHero: { minHeight: 260, justifyContent: "center" },
  shell: { backgroundColor: colors.navy, padding: 0, overflow: "hidden" },
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: "#17263a" },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.navySoft },
  brandMark: { width: 48, height: 48, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.green },
  brandText: { color: colors.navy, fontWeight: "900", fontSize: 16 },
  brandCopy: { flex: 1, minWidth: 0 },
  shellTitle: { color: colors.white, fontSize: 20, fontWeight: "900" },
  shellMeta: { marginTop: 2, color: "#a7b5c7", fontSize: 12, fontWeight: "800" },
  playerButton: { minHeight: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: "#22344b", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  playerButtonText: { color: colors.white, fontSize: 12, fontWeight: "900", textAlign: "center" },
  laneTabs: { gap: spacing.sm, padding: spacing.md },
  laneTab: { minHeight: 44, borderRadius: radius.sm, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.navySoft },
  laneTabActive: { backgroundColor: colors.white },
  laneTabText: { color: "#b7c4d4", fontWeight: "900" },
  laneTabTextActive: { color: colors.navy },
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  hero: { backgroundColor: "#fbfefe" },
  heroTitle: { color: colors.ink, fontSize: 32, lineHeight: 38, fontWeight: "900" },
  darkHeroTitle: { color: colors.white, fontSize: 32, lineHeight: 38, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 25, fontWeight: "600" },
  darkCopy: { color: "#cbd6e5", fontSize: 16, lineHeight: 25, fontWeight: "600" },
  livePill: { minHeight: 78, borderRadius: radius.lg, borderWidth: 1, borderColor: "#b6f4db", backgroundColor: colors.greenSoft, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  liveIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  liveTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  liveMeta: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  fill: { flex: 1, minWidth: 0 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metricCard: { width: "47%", minHeight: 142, justifyContent: "space-between", padding: spacing.md },
  cyanTop: { borderTopWidth: 4, borderTopColor: colors.cyan },
  greenTop: { borderTopWidth: 4, borderTopColor: colors.greenDark },
  amberTop: { borderTopWidth: 4, borderTopColor: colors.amber },
  redTop: { borderTopWidth: 4, borderTopColor: colors.red },
  metricLabel: { color: colors.faint, fontSize: 11, lineHeight: 15, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  metricValue: { fontSize: 30, fontWeight: "900" },
  cyanText: { color: colors.cyan },
  greenText: { color: colors.greenDark },
  amberText: { color: colors.amber },
  redText: { color: colors.red },
  metricDetail: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  eyebrow: { color: "#0898b8", fontSize: 12, fontWeight: "900", letterSpacing: 4, textTransform: "uppercase" },
  sectionTitle: { marginTop: spacing.xs, color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  securityCard: { borderColor: "#ffdf9d", gap: spacing.md },
  securityHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  securityIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: "900", flexShrink: 1 },
  rowMeta: { color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: "700", flexShrink: 1 },
  formStack: { gap: spacing.sm },
  queueBlock: { gap: spacing.sm },
  commandCard: { gap: spacing.md },
  commandTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  trophyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.cyanSoft, alignItems: "center", justifyContent: "center" },
  miniGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  miniStat: { flexGrow: 1, flexBasis: "47%", minWidth: 118, minHeight: 82, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.sm },
  miniValue: { marginTop: spacing.xs, color: colors.ink, fontSize: 22, fontWeight: "900" },
  subhead: { color: colors.ink, fontSize: 16, fontWeight: "900", marginTop: spacing.xs },
  compactRow: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  compactTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  compactMeta: { marginTop: 3, color: colors.muted, fontSize: 13, fontWeight: "700" },
  matchRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  auditLine: { color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: "800" },
  tournamentRow: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: spacing.md, gap: spacing.md },
  selectedRow: { borderColor: colors.cyan, backgroundColor: "#f2fdff" },
  detailGrid: { gap: spacing.sm },
  detailCell: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  detailLabel: { color: colors.faint, fontSize: 11, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  detailValue: { marginTop: spacing.xs, color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: "800", flexShrink: 1 },
  amountText: { color: colors.ink, fontSize: 28, fontWeight: "900" },
  monoHint: { marginTop: 4, color: colors.faint, fontFamily: "monospace", fontSize: 12, fontWeight: "800" },
  monoText: { fontFamily: "monospace" },
  field: { gap: spacing.xs },
  inputLabel: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  optionalLabel: { marginTop: -4, color: colors.muted, fontSize: 13, fontWeight: "800" },
  input: { minHeight: 56, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, color: colors.ink, fontSize: 16, fontWeight: "700" },
  inputMono: { fontFamily: "monospace" },
  multilineInput: { paddingTop: spacing.md, paddingBottom: spacing.md, lineHeight: 23 },
  selectValue: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingVertical: spacing.xs },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { minHeight: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  chipTextActive: { color: colors.white },
  modeTab: { flexGrow: 1, flexBasis: "47%", minWidth: 132, minHeight: 96, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md, gap: spacing.xs, justifyContent: "center" },
  modeTabSelected: { borderColor: colors.cyan, backgroundColor: "#f2fdff" },
  modeTabTitle: { color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: "900", flexShrink: 1 },
  modeTabTitleSelected: { color: colors.navy },
  modeTabDetail: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "800", flexShrink: 1 },
  modeTabDetailSelected: { color: colors.cyan },
  toggleRow: { minHeight: 70, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  twoCol: { flexDirection: "row", gap: spacing.sm },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  actionButton: { flex: 1 },
  actionGrid: { gap: spacing.sm },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.sm },
  helpText: { color: colors.amber, fontSize: 13, lineHeight: 20, fontWeight: "800" },
  emptyState: { borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, padding: spacing.lg, alignItems: "center", gap: spacing.xs }
});
