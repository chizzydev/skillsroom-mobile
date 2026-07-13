import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, BadgeCheck, ClipboardCheck, ExternalLink, LockKeyhole, Radio, ShieldAlert, Trophy } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  adminLanesFor,
  canAccessAdmin,
  canUseAdminSection,
  confirmAdminStepUp,
  getPlayerTrustSummary,
  listAdminResultClaims,
  reviewAdminResultClaim,
  roleLabel,
  type PlayerTrustSummary,
  type ResultClaimStatus,
  type ResultReviewDecision
} from "../../../api/admin";
import { ApiError } from "../../../api/client";
import { plainApiError } from "../../../api/errors";
import { getRoomResults, getRoomTimeline } from "../../../api/rooms";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { CopyButton } from "../../../components/ui/CopyButton";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, spacing } from "../../../constants/theme";
import { useAuthStore } from "../../../store/auth-store";
import type { MatchParticipant, MatchResultClaim, MatchResultEvidence, MatchRoom } from "../../../types/api";

type Notice = { tone: "error" | "success" | "info"; message: string } | null;
type Tone = "cyan" | "green" | "amber" | "red";

type ResultQueueCard = {
  claim: MatchResultClaim;
  room: MatchRoom | null;
  participants: MatchParticipant[];
  evidence: MatchResultEvidence[];
  trustByUserId: Record<string, PlayerTrustSummary | null>;
  loadError?: string | null;
};

const queueStatuses: Array<{
  status: ResultClaimStatus;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}> = [
  {
    status: "submitted",
    title: "Submitted result claims",
    description: "Fresh claims waiting for opponent response or team review.",
    emptyTitle: "Submitted queue is clear",
    emptyDescription: "No newly submitted result claims are waiting right now."
  },
  {
    status: "opponent_agreed",
    title: "Opponent-agreed claims",
    description: "Claims where the opponent agreed and the team can move toward approval or dispute handling.",
    emptyTitle: "Agreed queue is clear",
    emptyDescription: "No opponent-agreed result claims are waiting right now."
  },
  {
    status: "opponent_disputed",
    title: "Disputed claims",
    description: "Claims that need team review because the opponent disputed the result or proof.",
    emptyTitle: "Dispute queue is clear",
    emptyDescription: "No disputed result claims are waiting right now."
  }
];

const decisions: Array<{ value: ResultReviewDecision; label: string; tone: "primary" | "secondary" | "danger" }> = [
  { value: "approve_claim", label: "Approve claim", tone: "primary" },
  { value: "mark_disputed", label: "Mark disputed", tone: "secondary" },
  { value: "reject_claim", label: "Reject claim", tone: "danger" },
  { value: "void_match", label: "Void match", tone: "danger" }
];

const resultSuccessMessages: Record<ResultReviewDecision, string> = {
  approve_claim: "Result claim approved.",
  reject_claim: "Result claim rejected.",
  mark_disputed: "Result claim moved to dispute review.",
  void_match: "Match was voided."
};

function displayLabel(value?: string | null) {
  if (!value) return "Unknown";
  return value
    .split("_")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function dateLabel(value?: string | null) {
  if (!value) return "Date not supplied";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;
  return new Date(value).toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function scoreSummaryLabel(value?: string | null) {
  return value?.trim() ? value : "No score line supplied";
}

function shortId(value?: string | null) {
  if (!value) return "Not supplied";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-5)}`;
}

function claimValue(claim: MatchResultClaim, key: string) {
  const value = claim[key];
  return typeof value === "string" ? value : undefined;
}

function playerDisplay(participant: MatchParticipant | undefined, trust?: PlayerTrustSummary | null) {
  const fallback = participant?.user_id ?? "Unknown player";
  const displayName = trust?.display_name || trust?.username || shortId(fallback);
  const handle = trust?.primary_game_handle;
  const external = trust?.primary_game_external_uid;
  if (handle && external) return `${displayName} (${handle} / ${external})`;
  if (handle) return `${displayName} (${handle})`;
  return displayName;
}

function countStatus(rows: MatchResultClaim[], status: string) {
  return rows.filter((row) => row.status === status).length;
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
  if (section === "results") return;
  if (section === "settlements") {
    router.push({ pathname: "/admin/payments" } as never);
    return;
  }
  if (section === "tournaments") {
    router.push({ pathname: "/admin/tournaments" } as never);
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
  router.replace({ pathname: "/admin" } as never);
}

async function hydrateClaim(claim: MatchResultClaim): Promise<ResultQueueCard> {
  try {
    const [timeline, results] = await Promise.all([getRoomTimeline(claim.match_room_id), getRoomResults(claim.match_room_id)]);
    const claimantParticipantId = claimValue(claim, "claimant_participant_id") ?? claim.submitted_by_participant_id;
    const winnerParticipantId = claimValue(claim, "claimed_winner_participant_id") ?? claim.claimed_winner_participant_id;
    const relevantParticipants = results.participants.filter((participant) => participant.id === claimantParticipantId || participant.id === winnerParticipantId);
    const trustEntries = await Promise.all(
      relevantParticipants.map(async (participant) => {
        try {
          return [participant.user_id, await getPlayerTrustSummary(participant.user_id)] as const;
        } catch {
          return [participant.user_id, null] as const;
        }
      })
    );

    return {
      claim,
      room: timeline.room,
      participants: results.participants,
      evidence: (results.evidence_items ?? []).filter((item) => item.result_claim_id === claim.id),
      trustByUserId: Object.fromEntries(trustEntries),
      loadError: null
    };
  } catch {
    return {
      claim,
      room: null,
      participants: [],
      evidence: [],
      trustByUserId: {},
      loadError: "Room details unavailable for this claim."
    };
  }
}

export function AdminResultsScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice>(null);
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [password, setPassword] = useState("");
  const [stepUpToken, setStepUpToken] = useState<string | null>(null);
  const [stepUpExpiresAt, setStepUpExpiresAt] = useState<string | null>(null);
  const canAdmin = canAccessAdmin(user);
  const canResults = canUseAdminSection(user, "results");
  const lanes = useMemo(() => adminLanesFor(user), [user]);

  const resultsQuery = useQuery({
    queryKey: ["admin", "results", "queue"],
    queryFn: async () => {
      const groups = await Promise.all(queueStatuses.map(async ({ status }) => listAdminResultClaims(status)));
      const claims = groups.flat();
      const cards = await Promise.all(claims.map(hydrateClaim));
      return { claims, cards };
    },
    enabled: canResults
  });

  const claims = resultsQuery.data?.claims ?? [];
  const cards = resultsQuery.data?.cards ?? [];
  const selectedCard = cards.find((card) => card.claim.id === selectedClaimId);
  const canReview = Boolean(selectedClaimId.trim() && stepUpToken);

  const stepUpMutation = useMutation({
    mutationFn: () => {
      if (!password.trim()) throw new Error("Enter your current Skillsroom password.");
      return confirmAdminStepUp(password);
    },
    onSuccess: (result) => {
      setStepUpToken(result.step_up_token);
      setStepUpExpiresAt(result.expires_at ?? null);
      setPassword("");
      setNotice({ tone: "success", message: "Sensitive result actions are unlocked for this session." });
    },
    onError: (error) => {
      setStepUpToken(null);
      setStepUpExpiresAt(null);
      setNotice({ tone: "error", message: plainApiError(error, "Sensitive actions could not be unlocked.") });
    }
  });

  const reviewMutation = useMutation({
    mutationFn: (decision: ResultReviewDecision) => {
      if (!stepUpToken) throw new Error("Unlock sensitive actions before reviewing results.");
      if (!selectedClaimId.trim()) throw new Error("Select or paste a claim ID first.");
      return reviewAdminResultClaim(selectedClaimId.trim(), {
        decision,
        note: reviewNote.trim() || undefined,
        stepUpToken
      });
    },
    onSuccess: async (_, decision) => {
      setNotice({ tone: "success", message: resultSuccessMessages[decision] ?? "Result review completed." });
      setSelectedClaimId("");
      setReviewNote("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "results"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (error) => {
      if (error instanceof ApiError && (error.code === "ADMIN_STEP_UP_EXPIRED" || error.code === "ADMIN_STEP_UP_INVALID")) {
        setStepUpToken(null);
        setStepUpExpiresAt(null);
      }
      setNotice({ tone: "error", message: plainApiError(error, "The result review could not be completed.") });
    }
  });

  if (!canAdmin) {
    return (
      <AppScreen>
        <SurfaceCard dark style={styles.permissionHero}>
          <Badge tone="dark">Team workspace</Badge>
          <Text style={styles.darkHeroTitle}>Admin access is not enabled for this account.</Text>
          <Text style={styles.darkCopy}>Only Support, Community Manager, Admin, and Owner roles can open the Skillsroom admin workspace.</Text>
        </SurfaceCard>
        <AppButton onPress={() => router.replace("/(app)/(tabs)/home")}>Back to player app</AppButton>
      </AppScreen>
    );
  }

  if (!canResults) {
    return (
      <AppScreen>
        <SurfaceCard style={styles.hero}>
          <Badge tone="cyan">Results</Badge>
          <Text style={styles.heroTitle}>Result review is restricted.</Text>
          <Text style={styles.copy}>Your {roleLabel(user?.role)} role can use other admin areas, but result review requires Community Manager, Admin, or Owner access.</Text>
        </SurfaceCard>
        <AppButton onPress={() => router.replace({ pathname: "/admin" } as never)}>Back to admin overview</AppButton>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <SurfaceCard dark style={styles.shell}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="Back to admin overview" onPress={() => router.replace({ pathname: "/admin" } as never)} style={styles.iconButton}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.6} />
          </Pressable>
          <View style={styles.brandMark}>
            <Text style={styles.brandText}>SR</Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.shellTitle} numberOfLines={1}>Results</Text>
            <Text style={styles.shellMeta}>{roleLabel(user?.role)} workspace</Text>
          </View>
          <Pressable style={styles.playerButton} onPress={() => router.replace("/(app)/(tabs)/home")}>
            <Text style={styles.playerButtonText}>Player app</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.laneTabs}>
          {lanes.map((lane) => (
            <Pressable key={lane.key} onPress={() => openAdminLane(lane.key)} style={[styles.laneTab, lane.key === "results" && styles.laneTabActive]}>
              <Text style={[styles.laneTabText, lane.key === "results" && styles.laneTabTextActive]}>{lane.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SurfaceCard>

      <SurfaceCard style={styles.hero}>
        <Badge tone="cyan">Results</Badge>
        <Text style={styles.heroTitle}>Evidence and Result Review</Text>
        <Text style={styles.copy}>Review score claims, evidence links, opponent responses, and route the room to settlement, dispute, or void.</Text>
      </SurfaceCard>

      <View style={styles.livePill}>
        <View style={styles.liveIcon}>
          <Radio color={colors.greenDark} size={18} />
        </View>
        <View style={styles.fill}>
          <Text style={styles.liveTitle}>Result updates</Text>
          <Text style={styles.liveMeta}>{resultsQuery.isFetching ? "Refreshing review queues" : "Listening for claim changes"}</Text>
        </View>
        <Badge tone="green">On</Badge>
      </View>

      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
      {resultsQuery.isError ? (
        <FeedbackState
          tone="error"
          title="Result review unavailable"
          body="We could not load submitted, agreed, or disputed result claims right now."
          actionLabel="Retry"
          onAction={() => void resultsQuery.refetch()}
        />
      ) : null}

      <View style={styles.metricGrid}>
        <MetricCard tone="amber" label="Submitted" value={countStatus(claims, "submitted").toString()} detail="Needs review" />
        <MetricCard tone="green" label="Agreed" value={countStatus(claims, "opponent_agreed").toString()} detail="Opponent agrees" />
        <MetricCard tone="red" label="Disputed" value={countStatus(claims, "opponent_disputed").toString()} detail="Needs dispute review" />
        <MetricCard tone="cyan" label="Queue total" value={claims.length.toString()} detail="Active reviews" />
      </View>

      <SurfaceCard>
        <SectionHeader eyebrow="Queue" title="Result review queue" detail="Review room evidence and player context first, then tap a claim to copy its ID into the decision panel when you are ready to rule." />
        {resultsQuery.isLoading ? <Text style={styles.copy}>Loading result reviews...</Text> : null}
        {!resultsQuery.isLoading && !claims.length ? (
          <EmptyState title="Result review queue is clear" body="No result claims are waiting in submitted, agreed, or disputed review." />
        ) : null}

        {queueStatuses.map((lane) => {
          const laneCards = cards.filter((card) => card.claim.status === lane.status);
          return (
            <View key={lane.status} style={styles.laneBlock}>
              <View style={styles.laneHeader}>
                <View style={styles.fill}>
                  <Text style={styles.eyebrow}>{displayLabel(lane.status)}</Text>
                  <Text style={styles.sectionTitle}>{lane.title}</Text>
                  <Text style={styles.copy}>{lane.description}</Text>
                  <Badge tone={lane.status === "opponent_disputed" ? "red" : lane.status === "opponent_agreed" ? "green" : "amber"}>{laneCards.length.toString()}</Badge>
                </View>
              </View>
              {laneCards.length ? (
                laneCards.map((card) => (
                  <ResultClaimCard
                    key={card.claim.id}
                    card={card}
                    selected={card.claim.id === selectedClaimId}
                    onSelect={() => setSelectedClaimId(card.claim.id)}
                    onOpenEvidence={(url) => void Linking.openURL(url).catch(() => setNotice({ tone: "error", message: "The evidence link could not be opened." }))}
                  />
                ))
              ) : (
                <EmptyState title={lane.emptyTitle} body={lane.emptyDescription} />
              )}
            </View>
          );
        })}
      </SurfaceCard>

      <SensitiveActionsPanel
        password={password}
        setPassword={setPassword}
        stepUpToken={stepUpToken}
        stepUpExpiresAt={stepUpExpiresAt}
        loading={stepUpMutation.isPending}
        onUnlock={() => stepUpMutation.mutate()}
        onLock={() => {
          setStepUpToken(null);
          setStepUpExpiresAt(null);
          setNotice({ tone: "info", message: "Sensitive result actions are locked again." });
        }}
      />

      <SurfaceCard>
        <SectionHeader eyebrow="Decision" title="Review result claim" detail="Unlock first, then move a room toward settlement, dispute resolution, rejection, or void." />
        {selectedCard ? (
          <View style={styles.selectedPanel}>
            <Badge tone="cyan">Selected claim</Badge>
            <Text style={styles.selectedTitle}>{scoreSummaryLabel(selectedCard.claim.score_summary)}</Text>
            <Text style={styles.rowMeta}>{selectedCard.room?.title ?? "Room"} - {shortId(selectedCard.claim.match_room_id)}</Text>
          </View>
        ) : (
          <FormNotice tone="info" message="Tap a result claim above, or paste the claim ID manually after reviewing evidence." />
        )}

        <View style={styles.formStack}>
          <LabeledInput label="Claim ID" value={selectedClaimId} onChangeText={setSelectedClaimId} placeholder="claim id" mono />
          <LabeledInput label="Review note" optional value={reviewNote} onChangeText={setReviewNote} placeholder="Summarize the evidence and decision reason." multiline minHeight={112} />
          <View style={styles.actionGrid}>
            {decisions.map((decision) => (
              <AppButton
                key={decision.value}
                variant={decision.tone === "primary" ? "primary" : decision.tone}
                disabled={!canReview}
                loading={reviewMutation.isPending}
                onPress={() => reviewMutation.mutate(decision.value)}
              >
                {decision.label}
              </AppButton>
            ))}
          </View>
        </View>
      </SurfaceCard>
    </AppScreen>
  );
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

function MetricCard({ tone, label, value, detail }: { tone: Tone; label: string; value: string; detail: string }) {
  return (
    <SurfaceCard style={[styles.metricCard, styles[`${tone}Top`]]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, styles[`${tone}Text`]]}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </SurfaceCard>
  );
}

function ResultClaimCard({ card, selected, onSelect, onOpenEvidence }: { card: ResultQueueCard; selected: boolean; onSelect: () => void; onOpenEvidence: (url: string) => void }) {
  const claim = card.claim;
  const claimantParticipantId = claimValue(claim, "claimant_participant_id") ?? claim.submitted_by_participant_id;
  const winnerParticipantId = claimValue(claim, "claimed_winner_participant_id") ?? claim.claimed_winner_participant_id;
  const claimant = card.participants.find((participant) => participant.id === claimantParticipantId);
  const winner = card.participants.find((participant) => participant.id === winnerParticipantId);
  const claimantUserId = claimValue(claim, "claimant_user_id") ?? claim.submitted_by_user_id;
  const winnerUserId = claimValue(claim, "claimed_winner_user_id");
  const statusTone = claim.status === "opponent_disputed" ? "red" : claim.status === "opponent_agreed" ? "green" : "amber";

  return (
    <Pressable onPress={onSelect} style={[styles.claimCard, selected && styles.claimCardActive]}>
      <View style={styles.claimTop}>
        <View style={styles.fill}>
          <View style={styles.badgeRow}>
            <Badge tone={selected ? "green" : statusTone}>{selected ? "Selected" : displayLabel(claim.status)}</Badge>
            <Text style={styles.dateText}>{dateLabel(claimValue(claim, "submitted_at") ?? claim.created_at)}</Text>
          </View>
          <Text style={styles.claimTitle}>{scoreSummaryLabel(claim.score_summary)}</Text>
          <Text style={styles.rowMeta}>{card.room?.title ?? "Untitled room"} {card.room?.room_code ? `(${card.room.room_code})` : ""}</Text>
          <Text style={styles.mutedMono}>Room ID {claim.match_room_id}</Text>
        </View>
        <View style={styles.trophyIcon}>
          <Trophy color={colors.cyan} size={24} />
        </View>
      </View>

      <View style={styles.detailGrid}>
        <DetailCell label="Claim ID" value={claim.id} mono />
        <DetailCell label="Claimant" value={`${playerDisplay(claimant, claimant ? card.trustByUserId[claimant.user_id] : null)} / ${shortId(claimantUserId)}`} />
        <DetailCell label="Claimed winner" value={`${playerDisplay(winner, winner ? card.trustByUserId[winner.user_id] : null)} / ${shortId(winnerUserId)}`} />
        <DetailCell label="Note" value={claim.note ?? "No note"} />
      </View>

      {card.evidence.length ? (
        <View style={styles.evidenceGrid}>
          {card.evidence.map((item) => (
            <Pressable key={item.id ?? `${item.title}:${item.uri}`} style={styles.evidenceCard} onPress={() => item.uri && onOpenEvidence(item.uri)}>
              <Text style={styles.evidenceType}>{displayLabel(item.evidence_type)}</Text>
              <Text style={styles.evidenceTitle}>{item.title ?? "Evidence"}</Text>
              {item.notes ? <Text style={styles.rowMeta}>{item.notes}</Text> : null}
              {item.uri ? (
                <View style={styles.evidenceLink}>
                  <ExternalLink color={colors.cyan} size={16} />
                  <Text style={styles.evidenceLinkText}>Open evidence</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.noEvidence}>
          <ShieldAlert color={colors.amber} size={18} />
          <Text style={styles.rowMeta}>No evidence link loaded for this claim yet.</Text>
        </View>
      )}

      {card.loadError ? <Text style={styles.errorText}>{card.loadError}</Text> : null}
      <View style={styles.selectHint}>
        <ClipboardCheck color={selected ? colors.greenDark : colors.cyan} size={18} />
        <Text style={[styles.selectHintText, selected && styles.selectHintTextActive]}>{selected ? "Ready for decision" : "Tap to review"}</Text>
      </View>
      <CopyButton value={claim.id} label="Copy claim ID" copiedLabel="Claim ID copied" compact />
    </Pressable>
  );
}

function SensitiveActionsPanel({
  password,
  setPassword,
  stepUpToken,
  stepUpExpiresAt,
  loading,
  onUnlock,
  onLock
}: {
  password: string;
  setPassword: (value: string) => void;
  stepUpToken: string | null;
  stepUpExpiresAt: string | null;
  loading: boolean;
  onUnlock: () => void;
  onLock: () => void;
}) {
  return (
    <SurfaceCard style={styles.securityCard}>
      <View style={styles.securityHeader}>
        <View style={styles.securityIcon}>
          {stepUpToken ? <BadgeCheck color={colors.greenDark} size={22} /> : <LockKeyhole color={colors.amber} size={22} />}
        </View>
        <View style={styles.fill}>
          <Text style={styles.sectionTitle}>Unlock sensitive actions</Text>
          <Text style={styles.copy}>
            {stepUpToken
              ? `Unlocked${stepUpExpiresAt ? ` until ${dateLabel(stepUpExpiresAt)}` : " for this session"}.`
              : "Confirm your Skillsroom password before approving, rejecting, disputing, or voiding results."}
          </Text>
        </View>
      </View>
      {stepUpToken ? (
        <AppButton variant="secondary" onPress={onLock}>Lock sensitive actions</AppButton>
      ) : (
        <View style={styles.formStack}>
          <LabeledInput label="Current password" value={password} onChangeText={setPassword} placeholder="Confirm password" secureTextEntry />
          <AppButton loading={loading} onPress={onUnlock}>Unlock result review</AppButton>
        </View>
      )}
    </SurfaceCard>
  );
}

function DetailCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailCell}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.monoText]}>{value}</Text>
    </View>
  );
}

function LabeledInput({
  label,
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
      <Text style={styles.inputLabel}>{label}</Text>
      {optional ? <Text style={styles.optionalLabel}>(optional)</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        textAlignVertical={multiline ? "top" : "center"}
        autoCapitalize="none"
        style={[styles.input, multiline && styles.multilineInput, mono && styles.inputMono, minHeight ? { minHeight } : null]}
      />
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
  shell: { padding: 0, overflow: "hidden" },
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: "#17263a" },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.navySoft },
  brandMark: { width: 48, height: 48, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.green },
  brandText: { color: colors.navy, fontWeight: "900", fontSize: 16 },
  brandCopy: { flex: 1, minWidth: 0 },
  shellTitle: { color: colors.white, fontSize: 20, fontWeight: "900" },
  shellMeta: { marginTop: 2, color: "#a7b5c7", fontSize: 12, fontWeight: "800" },
  playerButton: { minHeight: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: "#22344b", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  playerButtonText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  laneTabs: { gap: spacing.sm, padding: spacing.md },
  laneTab: { minHeight: 44, borderRadius: radius.sm, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.navySoft },
  laneTabActive: { backgroundColor: colors.white },
  laneTabText: { color: "#b7c4d4", fontWeight: "900" },
  laneTabTextActive: { color: colors.navy },
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
  metricLabel: { color: colors.faint, fontSize: 12, fontWeight: "900", letterSpacing: 3, textTransform: "uppercase" },
  metricValue: { fontSize: 34, fontWeight: "900" },
  cyanText: { color: colors.cyan },
  greenText: { color: colors.greenDark },
  amberText: { color: colors.amber },
  redText: { color: colors.red },
  metricDetail: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  eyebrow: { color: "#0898b8", fontSize: 12, fontWeight: "900", letterSpacing: 4, textTransform: "uppercase" },
  sectionTitle: { marginTop: spacing.xs, color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  laneBlock: { gap: spacing.sm },
  laneHeader: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md, flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  claimCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md, gap: spacing.md },
  claimCardActive: { borderColor: colors.green, backgroundColor: "#f1fff8" },
  claimTop: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  dateText: { color: colors.faint, fontSize: 11, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  claimTitle: { marginTop: spacing.sm, color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "900", flexShrink: 1 },
  trophyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.cyanSoft, alignItems: "center", justifyContent: "center" },
  mutedMono: { color: colors.faint, fontFamily: "monospace", fontSize: 12, lineHeight: 18, fontWeight: "800", flexShrink: 1 },
  detailGrid: { gap: spacing.sm },
  detailCell: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: spacing.md },
  detailLabel: { color: colors.faint, fontSize: 11, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  detailValue: { marginTop: spacing.xs, color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: "800", flexShrink: 1 },
  monoText: { fontFamily: "monospace" },
  evidenceGrid: { gap: spacing.sm },
  evidenceCard: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: spacing.md, gap: spacing.xs },
  evidenceType: { color: colors.cyan, fontSize: 11, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  evidenceTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  evidenceLink: { marginTop: spacing.xs, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  evidenceLinkText: { color: colors.cyan, fontSize: 13, fontWeight: "900" },
  noEvidence: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: spacing.md, flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  errorText: { color: colors.red, fontSize: 12, fontWeight: "900" },
  selectHint: { alignSelf: "flex-start", minHeight: 42, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  selectHintText: { color: colors.muted, fontSize: 13, fontWeight: "900" },
  selectHintTextActive: { color: colors.greenDark },
  securityCard: { borderColor: "#ffdf9d" },
  securityHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  securityIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" },
  selectedPanel: { borderRadius: radius.md, borderWidth: 1, borderColor: "#b6f4db", backgroundColor: colors.greenSoft, padding: spacing.md, gap: spacing.xs },
  selectedTitle: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  formStack: { gap: spacing.sm },
  field: { gap: spacing.xs },
  inputLabel: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  optionalLabel: { marginTop: -4, color: colors.muted, fontSize: 13, fontWeight: "800" },
  input: { minHeight: 56, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, color: colors.ink, fontSize: 16, fontWeight: "700" },
  inputMono: { fontFamily: "monospace" },
  multilineInput: { paddingTop: spacing.md, paddingBottom: spacing.md, lineHeight: 23 },
  actionGrid: { gap: spacing.sm },
  rowTitle: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: "900", flexShrink: 1 },
  rowMeta: { color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: "700", flexShrink: 1 },
  emptyState: { borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, padding: spacing.lg, alignItems: "center", gap: spacing.xs }
});
