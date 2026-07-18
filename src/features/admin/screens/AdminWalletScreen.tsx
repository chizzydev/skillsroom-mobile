import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  ClipboardCheck,
  ExternalLink,
  Link2,
  LockKeyhole,
  Radio,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  WalletCards
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  adminLanesFor,
  canAccessAdmin,
  canUseAdminSection,
  confirmAdminStepUp,
  getAdminWalletDashboard,
  listAdminWalletPayoutRequests,
  listAdminWalletTopups,
  reviewAdminWalletPayoutRequest,
  reviewAdminWalletTopup,
  roleLabel,
  type AdminWalletDashboard,
  type SuspiciousWalletTopupGroup,
  type WalletFinancialTimelineItem,
  type WalletHold
} from "../../../api/admin";
import { ApiError } from "../../../api/client";
import { plainApiError } from "../../../api/errors";
import { evidenceApiUrl } from "../../../config/evidence-links";
import { openEvidenceInApp } from "../../evidence/openEvidence";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { CopyButton } from "../../../components/ui/CopyButton";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, spacing } from "../../../constants/theme";
import { useActionFeedback } from "../../../providers/ActionFeedbackProvider";
import { isAdminStepUpActive, useAdminStepUpStore } from "../../../store/admin-step-up-store";
import { useAuthStore } from "../../../store/auth-store";
import type { WalletLedgerEntry, WalletPayoutRequest, WalletTopup } from "../../../types/api";

type Notice = { tone: "error" | "success" | "info"; message: string } | null;
type NoticeTarget = "topups" | "payouts" | "security" | "topupDecision" | "payoutDecision";
type Tone = "cyan" | "green" | "amber" | "red";

function money(currency = "NGN", minor = 0) {
  return `${currency} ${Math.round(minor / 100).toLocaleString()}`;
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

function shortId(value?: string | null) {
  if (!value) return "Not supplied";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-5)}`;
}

function countStatus<T extends { status?: string }>(rows: T[], status: string) {
  return rows.filter((row) => row.status === status).length;
}

function totalAmount(rows: Array<{ amount_minor?: number }>) {
  return rows.reduce((sum, row) => sum + (typeof row.amount_minor === "number" ? row.amount_minor : 0), 0);
}

function duplicateLabel(row: SuspiciousWalletTopupGroup) {
  return row.duplicate_type === "proof_url" ? "Same proof file" : "Same transfer reference";
}

function sourceLabel(value?: string | null) {
  if (!value) return "Payment record";
  if (value.includes("topup")) return "Wallet top-up";
  if (value.includes("payout")) return "Payout";
  if (value.includes("refund")) return "Refund";
  if (value.includes("hold")) return "Room hold";
  if (value.includes("settlement")) return "Prize queue";
  if (value.includes("tournament")) return "Tournament payment";
  if (value.includes("match")) return "Room payment";
  return value.replaceAll("_", " ");
}

function paymentRecordLabel(value?: string | null) {
  if (!value) return "Payment record";
  if (value.includes("topup")) return "Top-up record";
  if (value.includes("payout")) return "Payout record";
  if (value.includes("refund")) return "Refund record";
  if (value.includes("hold")) return "Reserved balance";
  if (value.includes("entry")) return "Entry payment";
  if (value.includes("settlement")) return "Prize review";
  return value.replaceAll("_", " ");
}

function statusLabel(value?: string | null) {
  if (!value) return "Recorded";
  const labels: Record<string, string> = {
    submitted: "Waiting for review",
    approved: "Approved",
    rejected: "Rejected",
    requested: "Requested",
    paid: "Paid",
    completed: "Completed",
    queued: "Queued",
    active: "Active",
    released: "Released",
    payout_pending: "Payout queued"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function timelineRows(dashboard?: AdminWalletDashboard) {
  if (!dashboard) return [];
  return [...(dashboard.room_financial_timeline ?? []), ...(dashboard.tournament_financial_timeline ?? [])];
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
  if (section === "wallet") return;
  if (section === "results") {
    router.push({ pathname: "/admin/results" } as never);
    return;
  }
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

export function AdminWalletScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { pushFeedback } = useActionFeedback();
  const [notice, setNotice] = useState<Notice>(null);
  const [targetNotice, setTargetNotice] = useState<{ target: NoticeTarget; notice: NonNullable<Notice> } | null>(null);
  const [selectedTopupId, setSelectedTopupId] = useState("");
  const [selectedPayoutId, setSelectedPayoutId] = useState("");
  const [topupNote, setTopupNote] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [password, setPassword] = useState("");
  const savedStepUpToken = useAdminStepUpStore((state) => state.token);
  const savedStepUpExpiresAt = useAdminStepUpStore((state) => state.expiresAt);
  const savedStepUpUserId = useAdminStepUpStore((state) => state.userId);
  const setAdminStepUp = useAdminStepUpStore((state) => state.setStepUp);
  const clearAdminStepUp = useAdminStepUpStore((state) => state.clearStepUp);
  const [historyUserId, setHistoryUserId] = useState("");
  const [historyRoomId, setHistoryRoomId] = useState("");
  const [historyTournamentId, setHistoryTournamentId] = useState("");
  const [historyFilters, setHistoryFilters] = useState({ userId: "", matchRoomId: "", tournamentId: "" });
  const canAdmin = canAccessAdmin(user);
  const canWallet = canUseAdminSection(user, "wallet");
  const lanes = useMemo(() => adminLanesFor(user), [user]);

  const topupsQuery = useQuery({
    queryKey: ["admin", "wallet", "topups", "submitted"],
    queryFn: () => listAdminWalletTopups("submitted"),
    enabled: canWallet
  });

  const payoutsQuery = useQuery({
    queryKey: ["admin", "wallet", "payouts", "requested"],
    queryFn: () => listAdminWalletPayoutRequests("requested"),
    enabled: canWallet
  });

  const dashboardQuery = useQuery({
    queryKey: ["admin", "wallet", "dashboard", historyFilters],
    queryFn: () =>
      getAdminWalletDashboard({
        userId: historyFilters.userId || undefined,
        matchRoomId: historyFilters.matchRoomId || undefined,
        tournamentId: historyFilters.tournamentId || undefined,
        limit: 100
      }),
    enabled: canWallet
  });

  const topups = topupsQuery.data ?? [];
  const payouts = payoutsQuery.data ?? [];
  const dashboard = dashboardQuery.data;
  const activeHolds = dashboard?.active_holds ?? [];
  const suspiciousDuplicates = dashboard?.suspicious_duplicates ?? [];
  const ledgerEntries = dashboard?.recent_ledger_entries ?? [];
  const financeTimeline = timelineRows(dashboard);
  const selectedTopup = topups.find((row) => row.id === selectedTopupId);
  const selectedPayout = payouts.find((row) => row.id === selectedPayoutId);
  const stepUpActive = isAdminStepUpActive({ token: savedStepUpToken, expiresAt: savedStepUpExpiresAt, userId: savedStepUpUserId }, user?.id);
  const stepUpToken = stepUpActive ? savedStepUpToken : null;
  const stepUpExpiresAt = stepUpActive ? savedStepUpExpiresAt : null;
  const canReviewTopup = Boolean(selectedTopupId.trim() && stepUpToken);
  const canReviewPayout = Boolean(selectedPayoutId.trim() && stepUpToken);
  const isLoading = topupsQuery.isLoading || payoutsQuery.isLoading || dashboardQuery.isLoading;
  const hasError = topupsQuery.isError || payoutsQuery.isError || dashboardQuery.isError;
  const notify = (target: NoticeTarget, nextNotice: NonNullable<Notice>) => {
    setNotice(nextNotice);
    setTargetNotice({ target, notice: nextNotice });
    pushFeedback({
      tone: nextNotice.tone,
      title: nextNotice.tone === "error" ? "Wallet action failed" : target === "security" ? "Wallet access updated" : target.includes("payout") ? "Payout review updated" : "Top-up review updated",
      message: nextNotice.message
    });
  };
  const noticeFor = (target: NoticeTarget) => targetNotice?.target === target ? targetNotice.notice : null;

  const stepUpMutation = useMutation({
    mutationFn: () => {
      if (!password.trim()) throw new Error("Enter your current Skillsroom password.");
      return confirmAdminStepUp(password);
    },
    onSuccess: (result) => {
      setAdminStepUp(result.step_up_token, result.expires_at ?? null, user?.id ?? null);
      setPassword("");
      notify("security", { tone: "success", message: "Sensitive wallet actions are unlocked for this session." });
    },
    onError: (error) => {
      clearAdminStepUp();
      notify("security", { tone: "error", message: plainApiError(error, "Sensitive actions could not be unlocked.") });
    }
  });

  const topupReviewMutation = useMutation({
    mutationFn: (decision: "approve" | "reject") => {
      if (!stepUpToken) throw new Error("Unlock sensitive actions before reviewing wallet top-ups.");
      if (!selectedTopupId.trim()) throw new Error("Select or paste a top-up ID first.");
      return reviewAdminWalletTopup(selectedTopupId.trim(), {
        decision,
        note: topupNote.trim() || undefined,
        stepUpToken
      });
    },
    onSuccess: (_, decision) => {
      notify("topupDecision", { tone: "success", message: decision === "approve" ? "Wallet top-up approved and credited." : "Wallet top-up rejected." });
      setSelectedTopupId("");
      setTopupNote("");
      void invalidateWalletQueries(queryClient);
    },
    onError: (error) => handleSensitiveError(error, clearAdminStepUp, (value) => value && notify("topupDecision", value), "The wallet top-up review could not be completed.")
  });

  const payoutReviewMutation = useMutation({
    mutationFn: (decision: "mark_paid" | "reject") => {
      if (!stepUpToken) throw new Error("Unlock sensitive actions before reviewing wallet payouts.");
      if (!selectedPayoutId.trim()) throw new Error("Select or paste a payout request ID first.");
      if (decision === "mark_paid" && !paymentReference.trim()) throw new Error("Enter the bank transfer reference before marking a payout paid.");
      return reviewAdminWalletPayoutRequest(selectedPayoutId.trim(), {
        decision,
        payment_reference: paymentReference.trim() || undefined,
        note: payoutNote.trim() || undefined,
        stepUpToken
      });
    },
    onSuccess: (_, decision) => {
      notify("payoutDecision", { tone: "success", message: decision === "mark_paid" ? "Payout marked as paid." : "Payout rejected and returned to winnings." });
      setSelectedPayoutId("");
      setPayoutNote("");
      setPaymentReference("");
      void invalidateWalletQueries(queryClient);
    },
    onError: (error) => handleSensitiveError(error, clearAdminStepUp, (value) => value && notify("payoutDecision", value), "The wallet payout review could not be completed.")
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

  if (!canWallet) {
    return (
      <AppScreen>
        <SurfaceCard style={styles.hero}>
          <Badge tone="cyan">Wallet</Badge>
          <Text style={styles.heroTitle}>Wallet review is restricted.</Text>
          <Text style={styles.copy}>Your {roleLabel(user?.role)} role can use other admin areas, but wallet money decisions require Admin or Owner access.</Text>
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
            <Text style={styles.shellTitle} numberOfLines={1}>Wallet</Text>
            <Text style={styles.shellMeta}>{roleLabel(user?.role)} workspace</Text>
          </View>
          <Pressable style={styles.playerButton} onPress={() => router.replace("/(app)/(tabs)/home")}>
            <Text style={styles.playerButtonText}>Player app</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.laneTabs}>
          {lanes.map((lane) => (
            <Pressable key={lane.key} onPress={() => openAdminLane(lane.key)} style={[styles.laneTab, lane.key === "wallet" && styles.laneTabActive]}>
              <Text style={[styles.laneTabText, lane.key === "wallet" && styles.laneTabTextActive]}>{lane.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SurfaceCard>

      <SurfaceCard style={styles.hero}>
        <Badge tone="cyan">Wallet</Badge>
        <Text style={styles.heroTitle}>Wallet review</Text>
        <Text style={styles.copy}>Approve only after matching the bank alert, sender details, amount, and proof. Approval credits the user's spendable balance.</Text>
      </SurfaceCard>

      <View style={styles.livePill}>
        <View style={styles.liveIcon}>
          <Radio color={colors.greenDark} size={18} />
        </View>
        <View style={styles.fill}>
          <Text style={styles.liveTitle}>Wallet queues</Text>
          <Text style={styles.liveMeta}>{topupsQuery.isFetching || payoutsQuery.isFetching ? "Refreshing money queues" : "Top-ups and cash-outs are live"}</Text>
        </View>
        <Badge tone="green">On</Badge>
      </View>

      {notice && !targetNotice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
      {hasError ? (
        <FeedbackState
          tone="error"
          title="Wallet queues unavailable"
          body="We could not load wallet review data right now."
          actionLabel="Retry"
          onAction={() => {
            void topupsQuery.refetch();
            void payoutsQuery.refetch();
            void dashboardQuery.refetch();
          }}
        />
      ) : null}

      <View style={styles.metricGrid}>
        <MetricCard tone="amber" label="Submitted" value={countStatus(topups, "submitted").toString()} detail="Needs bank check" />
        <MetricCard tone="cyan" label="Queue total" value={money("NGN", totalAmount(topups))} detail="Visible in this queue" />
        <MetricCard tone="red" label="Cash-outs" value={money("NGN", totalAmount(payouts))} detail="Manual bank payout" />
        <MetricCard tone="green" label="Locked funds" value={money("NGN", totalAmount(activeHolds))} detail={`${activeHolds.length} active locks`} />
      </View>

      <ProviderReadinessPanel
        topups={topups}
        payouts={payouts}
        duplicateCount={suspiciousDuplicates.length}
        paymentHistoryCount={financeTimeline.length + ledgerEntries.length}
        guardrails={dashboard?.guardrails ?? []}
      />

      <SurfaceCard>
        <SectionHeader eyebrow="Search" title="Find wallet history" detail="Read-only lookup for user, room, or tournament payment history. It helps you see what happened without changing money." />
        <View style={styles.formStack}>
          <LabeledInput label="User ID" optional value={historyUserId} onChangeText={setHistoryUserId} placeholder="User ID for wallet history" mono />
          <LabeledInput label="Match room ID" optional value={historyRoomId} onChangeText={setHistoryRoomId} placeholder="Match room ID" mono />
          <LabeledInput label="Tournament ID" optional value={historyTournamentId} onChangeText={setHistoryTournamentId} placeholder="Tournament ID" mono />
          <AppButton
            variant="dark"
            onPress={() =>
              setHistoryFilters({
                userId: historyUserId.trim(),
                matchRoomId: historyRoomId.trim(),
                tournamentId: historyTournamentId.trim()
              })
            }
          >
            Load history
          </AppButton>
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.warningPanel}>
        <SectionHeader eyebrow="Warnings" title="Suspicious duplicates" detail="Same proof files or transfer references across active top-ups should be checked before approval." />
        {isLoading ? <Text style={styles.copy}>Loading wallet review data...</Text> : null}
        {suspiciousDuplicates.length ? (
          suspiciousDuplicates.map((row) => <DuplicateWarning key={`${row.duplicate_type}:${row.group_key}`} row={row} />)
        ) : (
          <EmptyState title="No duplicate warning" body="No repeated active proof files or transfer references were found." />
        )}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader eyebrow="Review" title="Submitted wallet top-ups" detail="Check payment records and proof first, then tap a top-up to copy its ID into the decision panel." />
        {noticeFor("topups") ? <FormNotice tone={noticeFor("topups")!.tone} message={noticeFor("topups")!.message} /> : null}
        {!isLoading && !topups.length ? <EmptyState title="Top-up queue is clear" body="No wallet top-ups are waiting for approval." /> : null}
        {topups.map((topup) => (
          <TopupCard
            key={topup.id}
            topup={topup}
            selected={topup.id === selectedTopupId}
            onSelect={() => setSelectedTopupId(topup.id)}
            onOpenProof={(url) => {
              if (!openEvidenceInApp(url, "Wallet top-up proof")) notify("topups", { tone: "error", message: "The proof link could not be opened." });
            }}
          />
        ))}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader eyebrow="Cash-out" title="Requested wallet payouts" detail="Pay the bank account manually, then tap a request and mark it paid with the transfer reference." />
        {noticeFor("payouts") ? <FormNotice tone={noticeFor("payouts")!.tone} message={noticeFor("payouts")!.message} /> : null}
        {!isLoading && !payouts.length ? <EmptyState title="Payout queue is clear" body="No wallet cash-outs are waiting for payment." /> : null}
        {payouts.map((payout) => (
          <PayoutCard key={payout.id} payout={payout} selected={payout.id === selectedPayoutId} onSelect={() => setSelectedPayoutId(payout.id)} />
        ))}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader eyebrow="Locks" title="Active locked funds" detail="Balance-funded entries currently reserved for rooms or tournaments." />
        {activeHolds.length ? activeHolds.map((hold) => <HoldRow key={hold.id} hold={hold} />) : <EmptyState title="No active locks" body="No active balance locks match this view." />}
      </SurfaceCard>

      <SensitiveActionsPanel
        password={password}
        setPassword={setPassword}
        stepUpToken={stepUpToken}
        stepUpExpiresAt={stepUpExpiresAt}
        loading={stepUpMutation.isPending}
        onUnlock={() => stepUpMutation.mutate()}
        onLock={() => {
          clearAdminStepUp();
          notify("security", { tone: "info", message: "Sensitive wallet actions are locked again." });
        }}
        notice={noticeFor("security")}
      />

      <SurfaceCard>
        <SectionHeader eyebrow="Decision" title="Approve or reject top-up" detail="Approval creates wallet payment records. Rejection leaves the player balance unchanged." />
        {noticeFor("topupDecision") ? <FormNotice tone={noticeFor("topupDecision")!.tone} message={noticeFor("topupDecision")!.message} /> : null}
        {selectedTopup ? (
          <SelectedMoneyPanel label="Selected top-up" amount={money(selectedTopup.currency, selectedTopup.amount_minor)} detail={`Player ${shortId(selectedTopup.user_id as string | undefined)} - ${shortId(selectedTopup.transfer_reference)}`} />
        ) : (
          <FormNotice tone="info" message="Tap a submitted top-up above, or paste the top-up ID manually." />
        )}
        <View style={styles.formStack}>
          <LabeledInput label="Top-up ID" value={selectedTopupId} onChangeText={setSelectedTopupId} placeholder="top-up id" mono />
          <LabeledInput label="Review note" optional value={topupNote} onChangeText={setTopupNote} placeholder="Required for rejection. Helpful for approvals too." multiline minHeight={112} />
          <View style={styles.actionGrid}>
            <AppButton disabled={!canReviewTopup} loading={topupReviewMutation.isPending} onPress={() => topupReviewMutation.mutate("approve")}>Approve and credit wallet</AppButton>
            <AppButton variant="danger" disabled={!canReviewTopup} loading={topupReviewMutation.isPending} onPress={() => topupReviewMutation.mutate("reject")}>Reject top-up</AppButton>
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader eyebrow="Payout" title="Mark payout paid" detail="This does not credit the user again. It only confirms the manual bank payment is done." />
        {noticeFor("payoutDecision") ? <FormNotice tone={noticeFor("payoutDecision")!.tone} message={noticeFor("payoutDecision")!.message} /> : null}
        {selectedPayout ? (
          <SelectedMoneyPanel label="Selected payout" amount={money(selectedPayout.currency, selectedPayout.amount_minor)} detail={`${selectedPayout.payout_bank_name ?? "Bank"} - ${selectedPayout.payout_account_number_masked ?? "Account"}`} />
        ) : (
          <FormNotice tone="info" message="Tap a payout request above, or paste the payout request ID manually." />
        )}
        <View style={styles.formStack}>
          <LabeledInput label="Payout request ID" value={selectedPayoutId} onChangeText={setSelectedPayoutId} placeholder="payout request id" mono />
          <LabeledInput label="Bank transfer reference" value={paymentReference} onChangeText={setPaymentReference} placeholder="Required when marking paid" />
          <LabeledInput label="Review note" optional value={payoutNote} onChangeText={setPayoutNote} placeholder="Required for rejection. Optional for paid payout." multiline minHeight={100} />
          <View style={styles.actionGrid}>
            <AppButton disabled={!canReviewPayout} loading={payoutReviewMutation.isPending} onPress={() => payoutReviewMutation.mutate("mark_paid")}>Mark payout paid</AppButton>
            <AppButton variant="danger" disabled={!canReviewPayout} loading={payoutReviewMutation.isPending} onPress={() => payoutReviewMutation.mutate("reject")}>Reject and return winnings</AppButton>
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader eyebrow="History" title="User wallet history" detail={historyFilters.userId ? "Showing recent wallet changes for the selected user." : "Add a user ID above to narrow this to one player."} />
        {ledgerEntries.length ? ledgerEntries.map((entry) => <LedgerRow key={entry.id} entry={entry} />) : <EmptyState title="No wallet history" body="No wallet history matches this view yet." />}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader eyebrow="History" title="Room or tournament payment history" detail="Load a room or tournament ID above to see funding, locked money, refunds, and payouts in order." />
        {financeTimeline.length ? financeTimeline.map((row) => <TimelineRow key={`${row.source_table}:${row.id}`} row={row} />) : <EmptyState title="Load payment history" body="No room or tournament payment history is loaded." />}
      </SurfaceCard>
    </AppScreen>
  );
}

async function invalidateWalletQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: ["admin", "wallet"] });
  await queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
}

function handleSensitiveError(
  error: unknown,
  clearStepUp: () => void,
  setNotice: (value: Notice) => void,
  fallback: string
) {
  if (error instanceof ApiError && (error.code === "ADMIN_STEP_UP_EXPIRED" || error.code === "ADMIN_STEP_UP_INVALID")) {
    clearStepUp();
  }
  setNotice({ tone: "error", message: plainApiError(error, fallback) });
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

function ProviderReadinessPanel({
  topups,
  payouts,
  duplicateCount,
  paymentHistoryCount,
  guardrails
}: {
  topups: WalletTopup[];
  payouts: WalletPayoutRequest[];
  duplicateCount: number;
  paymentHistoryCount: number;
  guardrails: string[];
}) {
  const matchedReferenceCount = topups.filter((row) => Boolean(row.transfer_reference?.trim())).length;
  const payoutReferenceNeeded = payouts.filter((row) => row.status === "requested").length;
  return (
    <SurfaceCard style={styles.providerPanel}>
      <SectionHeader
        eyebrow="Automation ready"
        title="Provider boundary"
        detail="Kora, Monnify, or another approved provider can plug into this same review flow later. Until then, admins still match bank alerts, proof, references, and payouts clearly."
      />
      <View style={styles.readinessGrid}>
        <ReadinessItem icon={<ShieldCheck color={colors.greenDark} size={19} />} title="Payment status" detail={`${topups.length} top-up(s), ${payouts.length} payout request(s)`} tone="green" />
        <ReadinessItem icon={<SearchCheck color={colors.cyan} size={19} />} title="Matching queue" detail={`${paymentHistoryCount} payment record(s) visible`} tone="cyan" />
        <ReadinessItem icon={<ShieldAlert color={colors.red} size={19} />} title="Duplicate checks" detail={duplicateCount ? `${duplicateCount} warning(s) to review` : "No active duplicate warning"} tone={duplicateCount ? "red" : "green"} />
        <ReadinessItem icon={<Link2 color={colors.amber} size={19} />} title="Bank reference matching" detail={`${matchedReferenceCount} submitted reference(s), ${payoutReferenceNeeded} payout reference(s) needed`} tone="amber" />
      </View>
      <View style={styles.operatorAuditPanel}>
        <Text style={styles.rowTitle}>Operator review trail</Text>
        <Text style={styles.rowMeta}>Every approval, rejection, payout, refund, and payment proof check stays tied to a player, room, tournament, note, and time.</Text>
        {guardrails.length ? (
          guardrails.slice(0, 3).map((item) => <Text key={item} style={styles.guardrailText}>{item}</Text>)
        ) : (
          <Text style={styles.guardrailText}>Provider automation is not live yet. Manual review remains the approved path.</Text>
        )}
      </View>
    </SurfaceCard>
  );
}

function ReadinessItem({ icon, title, detail, tone }: { icon: React.ReactNode; title: string; detail: string; tone: Tone }) {
  return (
    <View style={[styles.readinessItem, styles[`${tone}SoftBorder`]]}>
      <View style={styles.readinessIcon}>{icon}</View>
      <View style={styles.fill}>
        <Text style={styles.readinessTitle}>{title}</Text>
        <Text style={styles.rowMeta}>{detail}</Text>
      </View>
    </View>
  );
}

function DuplicateWarning({ row }: { row: SuspiciousWalletTopupGroup }) {
  return (
    <View style={styles.duplicateCard}>
      <View style={styles.cardHeader}>
        <View style={styles.fill}>
          <Badge tone="red">{duplicateLabel(row)}</Badge>
          <Text style={styles.rowTitle}>{row.group_key}</Text>
          <Text style={styles.rowMeta}>{row.user_count} user(s), {money("NGN", row.amount_minor_total)} total.</Text>
        </View>
        <Text style={styles.redStrong}>{row.occurrence_count} hits</Text>
      </View>
      <Text style={styles.mutedMono}>Samples: {(row.sample_topup_ids ?? []).slice(0, 4).join(", ") || "Not supplied"}</Text>
    </View>
  );
}

function TopupCard({ topup, selected, onSelect, onOpenProof }: { topup: WalletTopup; selected: boolean; onSelect: () => void; onOpenProof: (url: string) => void }) {
  const url = evidenceApiUrl(topup.proof_url);
  return (
    <Pressable onPress={onSelect} style={[styles.moneyCard, selected && styles.moneyCardActive]}>
      <MoneyCardTop selected={selected} badge={topup.status} amount={money(topup.currency, topup.amount_minor)} meta={`Player ${shortId(topup.user_id as string | undefined)}`} date={topup.submitted_at} />
      <View style={styles.detailGrid}>
        <DetailCell label="Top-up ID" value={topup.id} mono />
        <DetailCell label="Reference" value={topup.transfer_reference ?? "Not provided"} />
        <DetailCell label="Sender" value={topup.sender_account_name ?? "Not provided"} />
        <DetailCell label="Bank" value={topup.sender_bank_name ?? "Not provided"} />
        <DetailCell label="Official account" value={`${topup.collection_bank_name ?? "Bank"} ${topup.collection_account_number ?? ""}`.trim()} />
        <DetailCell label="Proof note" value={topup.proof_note ?? "No note"} />
      </View>
      <View style={styles.submissionActions}>
        <SelectHint selected={selected} label={selected ? "Ready for decision" : "Tap to review"} />
        <CopyButton value={topup.id} label="Copy ID" copiedLabel="Top-up ID copied" compact />
        {url ? (
          <Pressable style={styles.proofButton} onPress={() => onOpenProof(url)}>
            <ExternalLink color={colors.cyan} size={18} />
            <Text style={styles.proofButtonText}>Open proof</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function PayoutCard({ payout, selected, onSelect }: { payout: WalletPayoutRequest; selected: boolean; onSelect: () => void }) {
  return (
    <Pressable onPress={onSelect} style={[styles.moneyCard, selected && styles.moneyCardActive]}>
      <MoneyCardTop selected={selected} badge={payout.status} amount={money(payout.currency, payout.amount_minor)} meta={`Player ${shortId(payout.user_id as string | undefined)}`} date={payout.requested_at} danger />
      <View style={styles.detailGrid}>
        <DetailCell label="Payout ID" value={payout.id} mono />
        <DetailCell label="Account name" value={payout.payout_recipient_name ?? "Not provided"} />
        <DetailCell label="Bank" value={payout.payout_bank_name ?? "Not provided"} />
        <DetailCell label="Account" value={payout.payout_account_number_masked ?? "Not provided"} />
        <DetailCell label="Bank code" value={payout.payout_bank_code ?? "Not provided"} />
        <DetailCell label="Note" value={payout.payout_note ?? "No note"} />
      </View>
      <View style={styles.submissionActions}>
        <SelectHint selected={selected} label={selected ? "Ready for payout decision" : "Tap to review"} />
        <CopyButton value={payout.id} label="Copy ID" copiedLabel="Payout ID copied" compact />
      </View>
    </Pressable>
  );
}

function MoneyCardTop({ selected, badge, amount, meta, date, danger }: { selected: boolean; badge?: string; amount: string; meta: string; date?: string; danger?: boolean }) {
  return (
    <View style={styles.moneyCardTop}>
      <View style={styles.fill}>
        <View style={styles.badgeRow}>
          <Badge tone={selected ? "green" : danger ? "red" : "amber"}>{selected ? "Selected" : badge ?? "Submitted"}</Badge>
          <Text style={styles.dateText}>{dateLabel(date)}</Text>
        </View>
        <Text style={styles.amount}>{amount}</Text>
        <Text style={styles.rowMeta}>{meta}</Text>
      </View>
      <View style={[styles.moneyIcon, danger && styles.moneyIconDanger]}>
        {danger ? <WalletCards color={colors.red} size={24} /> : <Banknote color={colors.greenDark} size={24} />}
      </View>
    </View>
  );
}

function SelectHint({ selected, label }: { selected: boolean; label: string }) {
  return (
    <View style={styles.selectHint}>
      <ClipboardCheck color={selected ? colors.greenDark : colors.cyan} size={18} />
      <Text style={[styles.selectHintText, selected && styles.selectHintTextActive]}>{label}</Text>
    </View>
  );
}

function HoldRow({ hold }: { hold: WalletHold }) {
  return (
    <View style={styles.simpleRow}>
      <View style={styles.cardHeader}>
        <View style={styles.fill}>
          <Badge tone="green">{hold.status ?? "active"}</Badge>
          <Text style={styles.rowTitle}>{money(hold.currency, hold.amount_minor)}</Text>
          <Text style={styles.rowMeta}>{sourceLabel(hold.source_type)}: {shortId(hold.source_id)}</Text>
        </View>
        <Text style={styles.dateText}>{dateLabel(hold.created_at)}</Text>
      </View>
      <Text style={styles.rowMeta}>{hold.reason ?? "Reserved wallet balance."}</Text>
    </View>
  );
}

function SensitiveActionsPanel({
  password,
  setPassword,
  stepUpToken,
  stepUpExpiresAt,
  loading,
  onUnlock,
  onLock,
  notice
}: {
  password: string;
  setPassword: (value: string) => void;
  stepUpToken: string | null;
  stepUpExpiresAt: string | null;
  loading: boolean;
  onUnlock: () => void;
  onLock: () => void;
  notice?: Notice;
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
              : "Confirm your Skillsroom password before crediting wallets or marking payouts paid."}
          </Text>
        </View>
      </View>
      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
      {stepUpToken ? (
        <AppButton variant="secondary" onPress={onLock}>Lock sensitive actions</AppButton>
      ) : (
        <View style={styles.formStack}>
          <LabeledInput label="Current password" value={password} onChangeText={setPassword} placeholder="Confirm password" secureTextEntry />
          <AppButton loading={loading} onPress={onUnlock}>Unlock wallet review</AppButton>
        </View>
      )}
    </SurfaceCard>
  );
}

function SelectedMoneyPanel({ label, amount, detail }: { label: string; amount: string; detail: string }) {
  return (
    <View style={styles.selectedPanel}>
      <Badge tone="cyan">{label}</Badge>
      <Text style={styles.selectedAmount}>{amount}</Text>
      <Text style={styles.rowMeta}>{detail}</Text>
    </View>
  );
}

function LedgerRow({ entry }: { entry: WalletLedgerEntry }) {
  return (
    <View style={styles.simpleRow}>
      <View style={styles.cardHeader}>
        <View style={styles.fill}>
          <Badge tone={entry.direction === "credit" ? "green" : "amber"}>{entry.direction === "credit" ? "Credit" : entry.direction === "debit" ? "Debit" : "Record"}</Badge>
          <Text style={styles.rowTitle}>{money(entry.currency, entry.amount_minor)}</Text>
          <Text style={styles.rowMeta}>{paymentRecordLabel(entry.entry_type)} / Wallet</Text>
        </View>
        <Text style={styles.dateText}>{dateLabel(entry.created_at)}</Text>
      </View>
      <Text style={styles.mutedMono}>{sourceLabel(entry.source_type)}: {entry.source_id ?? "none"}</Text>
    </View>
  );
}

function TimelineRow({ row }: { row: WalletFinancialTimelineItem }) {
  return (
    <View style={styles.simpleRow}>
      <View style={styles.cardHeader}>
        <View style={styles.fill}>
          <Badge tone="cyan">{sourceLabel(row.source_table)}</Badge>
          <Text style={styles.rowTitle}>{paymentRecordLabel(row.event_type)}</Text>
          <Text style={styles.rowMeta}>{statusLabel(row.status)}{row.detail ? ` - ${row.detail}` : ""}</Text>
        </View>
        <Text style={styles.rowStrong}>{row.currency ? money(row.currency, row.amount_minor ?? 0) : "No amount"}</Text>
      </View>
      <Text style={styles.mutedMono}>{row.user_id ?? "platform"} / {dateLabel(row.created_at)}</Text>
    </View>
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#17263a"
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navySoft
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green
  },
  brandText: { color: colors.navy, fontWeight: "900", fontSize: 16 },
  brandCopy: { flex: 1, minWidth: 0 },
  shellTitle: { color: colors.white, fontSize: 18, fontWeight: "900" },
  shellMeta: { marginTop: 2, color: "#a7b5c7", fontSize: 12, fontWeight: "800" },
  playerButton: {
    minHeight: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "#22344b",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  playerButtonText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  laneTabs: { gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  laneTab: {
    minHeight: 34,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navySoft
  },
  laneTabActive: { backgroundColor: colors.white },
  laneTabText: { color: "#b7c4d4", fontWeight: "900" },
  laneTabTextActive: { color: colors.navy },
  hero: { backgroundColor: "#fbfefe" },
  heroTitle: { color: colors.ink, fontSize: 32, lineHeight: 38, fontWeight: "900" },
  darkHeroTitle: { color: colors.white, fontSize: 32, lineHeight: 38, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 25, fontWeight: "600" },
  darkCopy: { color: "#cbd6e5", fontSize: 16, lineHeight: 25, fontWeight: "600" },
  livePill: {
    minHeight: 78,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#b6f4db",
    backgroundColor: colors.greenSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md
  },
  liveIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  },
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
  metricValue: { fontSize: 30, fontWeight: "900" },
  cyanText: { color: colors.cyan },
  greenText: { color: colors.greenDark },
  amberText: { color: colors.amber },
  redText: { color: colors.red },
  metricDetail: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  eyebrow: { color: "#0898b8", fontSize: 12, fontWeight: "900", letterSpacing: 4, textTransform: "uppercase" },
  sectionTitle: { marginTop: spacing.xs, color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  formStack: { gap: spacing.sm },
  warningPanel: { borderColor: "#ffc6d0" },
  providerPanel: { borderColor: "#b6f4db" },
  readinessGrid: { gap: spacing.sm },
  readinessItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  readinessIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  readinessTitle: { color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: "900" },
  cyanSoftBorder: { borderColor: "#b9eef8" },
  greenSoftBorder: { borderColor: "#b6f4db" },
  amberSoftBorder: { borderColor: "#ffdf9d" },
  redSoftBorder: { borderColor: "#ffc6d0" },
  operatorAuditPanel: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, padding: spacing.md, gap: spacing.xs },
  guardrailText: { color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: "800" },
  duplicateCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: "#ffc6d0", backgroundColor: colors.redSoft, padding: spacing.md, gap: spacing.sm },
  rowBetween: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  redStrong: { color: colors.red, fontSize: 18, fontWeight: "900" },
  mutedMono: { color: colors.faint, fontFamily: "monospace", fontSize: 12, lineHeight: 18, fontWeight: "800" },
  moneyCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md, gap: spacing.md },
  moneyCardActive: { borderColor: colors.green, backgroundColor: "#f1fff8" },
  moneyCardTop: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  dateText: { color: colors.faint, fontSize: 11, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  amount: { marginTop: spacing.sm, color: colors.ink, fontSize: 26, fontWeight: "900" },
  moneyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  moneyIconDanger: { backgroundColor: colors.redSoft },
  detailGrid: { gap: spacing.sm },
  detailCell: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: spacing.md },
  detailLabel: { color: colors.faint, fontSize: 11, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  detailValue: { marginTop: spacing.xs, color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: "800", flexShrink: 1 },
  monoText: { fontFamily: "monospace" },
  submissionActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center", justifyContent: "space-between" },
  selectHint: {
    minHeight: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  selectHintText: { color: colors.muted, fontSize: 13, fontWeight: "900" },
  selectHintTextActive: { color: colors.greenDark },
  proofButton: { minHeight: 42, borderRadius: radius.pill, backgroundColor: colors.navy, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  proofButtonText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  simpleRow: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md, gap: spacing.sm },
  securityCard: { borderColor: "#ffdf9d" },
  securityHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  securityIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" },
  selectedPanel: { borderRadius: radius.md, borderWidth: 1, borderColor: "#b6f4db", backgroundColor: colors.greenSoft, padding: spacing.md, gap: spacing.xs },
  selectedAmount: { color: colors.ink, fontSize: 26, fontWeight: "900" },
  field: { gap: spacing.xs },
  inputLabel: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  optionalLabel: { marginTop: -4, color: colors.muted, fontSize: 13, fontWeight: "800" },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700"
  },
  inputMono: { fontFamily: "monospace" },
  multilineInput: { paddingTop: spacing.md, paddingBottom: spacing.md, lineHeight: 23 },
  actionGrid: { gap: spacing.sm },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  rowTitle: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: "900", flexShrink: 1 },
  rowStrong: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: "900", flexShrink: 1, textAlign: "right" },
  rowMeta: { color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: "700", flexShrink: 1 },
  emptyState: { borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, padding: spacing.lg, alignItems: "center", gap: spacing.xs }
});
