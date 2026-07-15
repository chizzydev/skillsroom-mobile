import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, BadgeCheck, Banknote, ClipboardCheck, LockKeyhole, Radio, ReceiptText, RotateCcw, Trophy, WalletCards } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  adminLanesFor,
  canAccessAdmin,
  canUseAdminSection,
  completeMatchPayout,
  completeMatchRefund,
  completeTournamentPayout,
  completeTournamentRefund,
  confirmAdminStepUp,
  listMatchPayouts,
  listMatchRefunds,
  listMatchSettlements,
  listTournamentPayouts,
  listTournamentRefunds,
  listTournamentSettlements,
  reserveMatchRefunds,
  reserveMatchSettlement,
  roleLabel,
  updateMatchPayoutInstructions,
  updateMatchRefundInstructions,
  updateTournamentPayoutInstructions,
  updateTournamentRefundInstructions,
  type MatchPayout,
  type MatchRefund,
  type MatchSettlement,
  type TournamentPayout,
  type TournamentRefund,
  type TournamentSettlement,
  type UpdatePaymentInstructionsInput
} from "../../../api/admin";
import { ApiError } from "../../../api/client";
import { plainApiError } from "../../../api/errors";
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
import { EvidenceUploadField } from "../../uploads/components/EvidenceUploadField";

type Notice = { tone: "error" | "success" | "info"; message: string } | null;
type Tone = "cyan" | "green" | "amber" | "red";
type PaymentMode = "match_payout" | "match_refund" | "tournament_payout" | "tournament_refund";

type CompletionForm = {
  matchRoomId: string;
  tournamentId: string;
  rowId: string;
  proofUrl: string;
  reference: string;
};

type RepairForm = {
  rowId: string;
  recipient: string;
  bank: string;
  account: string;
  bankCode: string;
  note: string;
};

const paymentModes: Array<{ key: PaymentMode; label: string; detail: string }> = [
  { key: "match_payout", label: "Match payout", detail: "Winner bank transfer" },
  { key: "match_refund", label: "Match refund", detail: "Return room entry" },
  { key: "tournament_payout", label: "Tournament payout", detail: "Prize transfer" },
  { key: "tournament_refund", label: "Tournament refund", detail: "Return event entry" }
];

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

function playerLabel(row: {
  display_name?: string | null;
  username?: string | null;
  primary_game_handle?: string | null;
  primary_game_external_uid?: string | null;
  user_id?: string | null;
}) {
  return row.display_name || row.username || row.primary_game_handle || row.primary_game_external_uid || shortId(row.user_id);
}

function winnerLabel(row: MatchSettlement) {
  return row.winner_display_name || row.winner_username || row.winner_primary_game_handle || row.winner_primary_game_external_uid || shortId(row.winner_user_id);
}

function tournamentTitle(row: TournamentSettlement | TournamentPayout | TournamentRefund) {
  if ("tournament_title" in row && row.tournament_title) return row.tournament_title;
  const metadataTitle = row.metadata?.tournament_title;
  return typeof metadataTitle === "string" && metadataTitle.trim() ? metadataTitle : "Tournament";
}

function instructionLine(row: { recipient_name?: string | null; bank_name?: string | null; account_number?: string | null; account_number_masked?: string | null }) {
  const account = row.account_number || row.account_number_masked || "No account number";
  return `${row.recipient_name || "Instructions missing"} - ${row.bank_name || "Bank not set"} - ${account}`;
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
  if (section === "settlements") return;
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

const blankCompletion: CompletionForm = { matchRoomId: "", tournamentId: "", rowId: "", proofUrl: "", reference: "" };
const blankRepair: RepairForm = { rowId: "", recipient: "", bank: "", account: "", bankCode: "", note: "" };

export function AdminPaymentsScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { pushFeedback } = useActionFeedback();
  const [notice, setNotice] = useState<Notice>(null);
  const [mode, setMode] = useState<PaymentMode>("match_payout");
  const [password, setPassword] = useState("");
  const savedStepUpToken = useAdminStepUpStore((state) => state.token);
  const savedStepUpExpiresAt = useAdminStepUpStore((state) => state.expiresAt);
  const savedStepUpUserId = useAdminStepUpStore((state) => state.userId);
  const setAdminStepUp = useAdminStepUpStore((state) => state.setStepUp);
  const clearAdminStepUp = useAdminStepUpStore((state) => state.clearStepUp);
  const [completion, setCompletion] = useState<CompletionForm>(blankCompletion);
  const [repair, setRepair] = useState<RepairForm>(blankRepair);
  const [reserveRoomId, setReserveRoomId] = useState("");
  const [reserveNotes, setReserveNotes] = useState("");
  const [refundRoomId, setRefundRoomId] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [completionUploadResetSignal, setCompletionUploadResetSignal] = useState(0);
  const canAdmin = canAccessAdmin(user);
  const canPayments = canUseAdminSection(user, "settlements");
  const lanes = useMemo(() => adminLanesFor(user), [user]);
  const stepUpActive = isAdminStepUpActive({ token: savedStepUpToken, expiresAt: savedStepUpExpiresAt, userId: savedStepUpUserId }, user?.id);
  const stepUpToken = stepUpActive ? savedStepUpToken : null;
  const stepUpExpiresAt = stepUpActive ? savedStepUpExpiresAt : null;

  const paymentsQuery = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: async () => {
      const [settlements, payouts, refunds, tournamentSettlements, tournamentPayouts, tournamentRefunds] = await Promise.all([
        listMatchSettlements(),
        listMatchPayouts(),
        listMatchRefunds(),
        listTournamentSettlements(),
        listTournamentPayouts(),
        listTournamentRefunds()
      ]);
      return { settlements, payouts, refunds, tournamentSettlements, tournamentPayouts, tournamentRefunds };
    },
    enabled: canPayments
  });

  const data = paymentsQuery.data;
  const queuedSettlements = (data?.settlements ?? []).filter((row) => row.status === "payout_pending");
  const queuedPayouts = (data?.payouts ?? []).filter((row) => row.status === "queued");
  const queuedRefunds = (data?.refunds ?? []).filter((row) => row.status === "queued");
  const queuedTournamentSettlements = (data?.tournamentSettlements ?? []).filter((row) => row.status === "payout_pending");
  const queuedTournamentPayouts = (data?.tournamentPayouts ?? []).filter((row) => row.status === "queued");
  const queuedTournamentRefunds = (data?.tournamentRefunds ?? []).filter((row) => row.status === "queued");
  const completedPayouts = (data?.payouts ?? []).filter((row) => row.status === "completed");
  const completedRefunds = (data?.refunds ?? []).filter((row) => row.status === "completed");
  const completedTournamentPayouts = (data?.tournamentPayouts ?? []).filter((row) => row.status === "completed");
  const completedTournamentRefunds = (data?.tournamentRefunds ?? []).filter((row) => row.status === "completed");

  const notify = (nextNotice: NonNullable<Notice>) => {
    setNotice(nextNotice);
    pushFeedback({
      tone: nextNotice.tone,
      title: nextNotice.tone === "error" ? "Payment action failed" : nextNotice.tone === "info" ? "Payment access updated" : "Payment action updated",
      message: nextNotice.message
    });
  };

  const stepUpMutation = useMutation({
    mutationFn: async () => {
      if (!password.trim()) throw new Error("Enter your password to unlock money actions.");
      return confirmAdminStepUp(password);
    },
    onSuccess: (result) => {
      setAdminStepUp(result.step_up_token, result.expires_at ?? null, user?.id ?? null);
      setPassword("");
      notify({ tone: "success", message: "Money actions unlocked for this session." });
    },
    onError: (error) => {
      clearAdminStepUp();
      notify({ tone: "error", message: plainApiError(error, "Sensitive actions could not be unlocked.") });
    }
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!stepUpToken) throw new Error("Unlock money actions before completing a payment.");
      if (!completion.rowId.trim()) throw new Error(mode.includes("payout") ? "Enter the payout ID." : "Enter the refund ID.");
      if (!completion.proofUrl.trim()) throw new Error("Upload proof or paste a hosted proof link before completing.");
      if (mode === "match_payout") {
        if (!completion.matchRoomId.trim()) throw new Error("Enter the match room ID shown on the payout row.");
        return completeMatchPayout(completion.rowId.trim(), {
          payout_reference: completion.reference,
          completion_proof_url: completion.proofUrl,
          stepUpToken
        });
      }
      if (mode === "match_refund") {
        if (!completion.matchRoomId.trim()) throw new Error("Enter the match room ID shown on the refund row.");
        return completeMatchRefund(completion.rowId.trim(), {
          refund_reference: completion.reference,
          completion_proof_url: completion.proofUrl,
          stepUpToken
        });
      }
      if (mode === "tournament_payout") {
        if (!completion.tournamentId.trim()) throw new Error("Enter the tournament ID shown on the payout row.");
        return completeTournamentPayout(completion.rowId.trim(), {
          payout_reference: completion.reference,
          completion_proof_url: completion.proofUrl,
          stepUpToken
        });
      }
      if (!completion.tournamentId.trim()) throw new Error("Enter the tournament ID shown on the refund row.");
      return completeTournamentRefund(completion.rowId.trim(), {
        refund_reference: completion.reference,
        completion_proof_url: completion.proofUrl,
        stepUpToken
      });
    },
    onSuccess: async () => {
      notify({ tone: "success", message: mode.includes("refund") ? "Refund marked as completed." : "Payout marked as completed." });
      setCompletion(blankCompletion);
      setCompletionUploadResetSignal((value) => value + 1);
      void queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (error) => notify({ tone: "error", message: plainApiError(error, "The payment action could not be completed.") })
  });

  const repairMutation = useMutation({
    mutationFn: async (useFallback: boolean) => {
      if (!stepUpToken) throw new Error("Unlock money actions before repairing instructions.");
      if (!repair.rowId.trim()) throw new Error(mode.includes("payout") ? "Enter the payout ID." : "Enter the refund ID.");
      const input: UpdatePaymentInstructionsInput = {
        recipient_name: repair.recipient,
        bank_name: repair.bank,
        account_number: repair.account,
        bank_code: repair.bankCode,
        payout_note: repair.note,
        use_fallback: useFallback,
        stepUpToken
      };
      if (mode === "match_payout") return updateMatchPayoutInstructions(repair.rowId.trim(), input);
      if (mode === "match_refund") return updateMatchRefundInstructions(repair.rowId.trim(), input);
      if (mode === "tournament_payout") return updateTournamentPayoutInstructions(repair.rowId.trim(), input);
      return updateTournamentRefundInstructions(repair.rowId.trim(), input);
    },
    onSuccess: async () => {
      notify({ tone: "success", message: "Payment instructions saved." });
      setRepair(blankRepair);
      void queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
    onError: (error) => notify({ tone: "error", message: plainApiError(error, "Instructions could not be saved.") })
  });

  const reserveSettlementMutation = useMutation({
    mutationFn: () => {
      if (!stepUpToken) throw new Error("Unlock money actions before reserving settlement.");
      if (!reserveRoomId.trim()) throw new Error("Enter the match room ID.");
      return reserveMatchSettlement({ match_room_id: reserveRoomId.trim(), notes: reserveNotes, stepUpToken });
    },
    onSuccess: async () => {
      notify({ tone: "success", message: "Settlement reserved and payout queue created." });
      setReserveRoomId("");
      setReserveNotes("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
    onError: (error) => notify({ tone: "error", message: plainApiError(error, "Settlement could not be reserved.") })
  });

  const reserveRefundMutation = useMutation({
    mutationFn: () => {
      if (!stepUpToken) throw new Error("Unlock money actions before reserving refunds.");
      if (!refundRoomId.trim()) throw new Error("Enter the match room ID.");
      if (!refundReason.trim()) throw new Error("Enter the refund reason.");
      return reserveMatchRefunds({ match_room_id: refundRoomId.trim(), reason: refundReason, stepUpToken });
    },
    onSuccess: async () => {
      notify({ tone: "success", message: "Refund queue created." });
      setRefundRoomId("");
      setRefundReason("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
    onError: (error) => notify({ tone: "error", message: plainApiError(error, "Refunds could not be reserved.") })
  });

  const proofContextType = mode.startsWith("tournament") ? "tournament" : "match_room";
  const proofContextId = proofContextType === "tournament" ? completion.tournamentId.trim() : completion.matchRoomId.trim();

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

  if (!canPayments) {
    return (
      <AppScreen>
        <SurfaceCard dark style={styles.permissionHero}>
          <Badge tone="dark">{`${roleLabel(user?.role)} role`}</Badge>
          <Text style={styles.darkHeroTitle}>Payments are restricted for this role.</Text>
          <Text style={styles.darkCopy}>Funding, refunds, winner payouts, and settlement reserves require Admin or Owner access.</Text>
        </SurfaceCard>
        <AppButton onPress={() => router.replace("/admin")}>Back to admin overview</AppButton>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <SurfaceCard dark style={styles.shell}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="Back to admin overview" onPress={() => router.replace("/admin")} style={styles.iconButton}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.6} />
          </Pressable>
          <View style={styles.brandMark}><Text style={styles.brandText}>SR</Text></View>
          <View style={styles.brandCopy}>
            <Text numberOfLines={1} style={styles.shellTitle}>Skillsroom Admin</Text>
            <Text style={styles.shellMeta}>{roleLabel(user?.role)} money workspace</Text>
          </View>
          <Pressable onPress={() => router.replace("/(app)/(tabs)/home")} style={styles.playerButton}>
            <Text style={styles.playerButtonText}>Player app</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.laneTabs}>
          {lanes.map((lane) => (
            <Pressable key={lane.key} onPress={() => openAdminLane(lane.key)} style={[styles.laneTab, lane.key === "settlements" && styles.laneTabActive]}>
              <Text style={[styles.laneTabText, lane.key === "settlements" && styles.laneTabTextActive]}>{lane.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SurfaceCard>

      <SurfaceCard style={styles.hero}>
        <Badge tone="green">Payments</Badge>
        <Text style={styles.heroTitle}>Payouts and refunds</Text>
        <Text style={styles.copy}>Reserve commissions, queue winner payouts, complete manual bank transfers, and refund voided or disputed rooms.</Text>
      </SurfaceCard>

      <View style={styles.livePill}>
        <View style={styles.liveIcon}><Radio color={colors.greenDark} size={22} /></View>
        <View style={styles.fill}>
          <Text style={styles.liveTitle}>Payment updates</Text>
          <Text style={styles.liveMeta}>{paymentsQuery.isFetching ? "Refreshing payment queues" : "Listening for payout and refund changes"}</Text>
        </View>
        <Badge tone="green">On</Badge>
      </View>

      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
      {paymentsQuery.isError ? (
        <FeedbackState
          title="Payment queues could not load"
          body={plainApiError(paymentsQuery.error, "Try again when the API is reachable.")}
          actionLabel="Retry"
          onAction={() => void paymentsQuery.refetch()}
        />
      ) : null}

      <View style={styles.metricGrid}>
        <MetricCard tone="green" label="Settlements" value={String(queuedSettlements.length + queuedTournamentSettlements.length)} detail="Match + tournament" />
        <MetricCard tone="amber" label="Payout queue" value={String(queuedPayouts.length + queuedTournamentPayouts.length)} detail="Manual transfer" />
        <MetricCard tone="red" label="Refund queue" value={String(queuedRefunds.length + queuedTournamentRefunds.length)} detail="Manual return" />
        <MetricCard tone="cyan" label="Money actions" value={String(queuedPayouts.length + queuedRefunds.length + queuedTournamentPayouts.length + queuedTournamentRefunds.length)} detail="Step-up required" />
      </View>

      <SensitiveActionsPanel
        password={password}
        setPassword={setPassword}
        stepUpToken={stepUpToken}
        stepUpExpiresAt={stepUpExpiresAt}
        loading={stepUpMutation.isPending}
        onUnlock={() => stepUpMutation.mutate()}
        onLock={() => {
          clearAdminStepUp();
          notify({ tone: "info", message: "Money actions locked." });
        }}
      />

      <SurfaceCard>
        <SectionHeader eyebrow="Queues" title="Money movement board" detail="Tap a row to copy the correct payout or refund ID into the completion panel. Complete only after the bank transfer or return has actually happened." />
        {paymentsQuery.isLoading ? <Text style={styles.copy}>Loading payment queues...</Text> : null}
        <QueueBlock title="Queued winner payouts" detail="Complete these after the winner transfer is sent." emptyTitle="Payout queue is clear" rows={queuedPayouts} render={(row) => (
          <PaymentRow
            key={row.id}
            icon={<Trophy color={colors.greenDark} size={22} />}
            title={playerLabel(row)}
            amount={money(row.currency, row.amount_minor)}
            meta={`${row.room_title || "Match room"} - ${row.room_code || "No code"}`}
            detail={instructionLine(row)}
            status={row.instruction_status === "ready" ? "Ready" : "Needs instructions"}
            statusTone={row.instruction_status === "ready" ? "amber" : "red"}
            identifiers={[["Payout ID", row.id], ["Match room ID", row.match_room_id]]}
            onPress={() => {
              setMode("match_payout");
              setCompletion((current) => ({ ...current, rowId: row.id, matchRoomId: row.match_room_id }));
              setRepair((current) => ({ ...current, rowId: row.id }));
            }}
          />
        )} />
        <QueueBlock title="Queued refunds" detail="Return approved room entries that should not settle to a winner." emptyTitle="Refund queue is clear" rows={queuedRefunds} render={(row) => (
          <PaymentRow
            key={row.id}
            icon={<RotateCcw color={colors.red} size={22} />}
            title={playerLabel(row)}
            amount={money(row.currency, row.amount_minor)}
            meta={`${row.room_title || "Match room"} - ${row.reason || "Refund"}`}
            detail={instructionLine(row)}
            status={row.instruction_status === "ready" ? "Ready" : "Needs instructions"}
            statusTone={row.instruction_status === "ready" ? "amber" : "red"}
            identifiers={[["Refund ID", row.id], ["Match room ID", row.match_room_id]]}
            onPress={() => {
              setMode("match_refund");
              setCompletion((current) => ({ ...current, rowId: row.id, matchRoomId: row.match_room_id }));
              setRepair((current) => ({ ...current, rowId: row.id }));
            }}
          />
        )} />
        <QueueBlock title="Queued tournament payouts" detail="Tournament prize rows use the same settlement discipline as rooms." emptyTitle="Tournament payout queue is clear" rows={queuedTournamentPayouts} render={(row) => (
          <PaymentRow
            key={row.id}
            icon={<Trophy color={colors.greenDark} size={22} />}
            title={playerLabel(row)}
            amount={money(row.currency, row.amount_minor)}
            meta={tournamentTitle(row)}
            detail={instructionLine(row)}
            status={row.instruction_status === "ready" ? "Ready" : "Needs instructions"}
            statusTone={row.instruction_status === "ready" ? "amber" : "red"}
            identifiers={[["Payout ID", row.id], ["Tournament ID", row.tournament_id], ["Entry ID", row.entry_id ?? "Not supplied"]]}
            onPress={() => {
              setMode("tournament_payout");
              setCompletion((current) => ({ ...current, rowId: row.id, tournamentId: row.tournament_id }));
              setRepair((current) => ({ ...current, rowId: row.id }));
            }}
          />
        )} />
        <QueueBlock title="Queued tournament refunds" detail="Refund tournament entries with clear proof and review history." emptyTitle="Tournament refund queue is clear" rows={queuedTournamentRefunds} render={(row) => (
          <PaymentRow
            key={row.id}
            icon={<RotateCcw color={colors.red} size={22} />}
            title={playerLabel(row)}
            amount={money(row.currency, row.amount_minor)}
            meta={tournamentTitle(row)}
            detail={instructionLine(row)}
            status={row.instruction_status === "ready" ? "Ready" : "Needs instructions"}
            statusTone={row.instruction_status === "ready" ? "amber" : "red"}
            identifiers={[["Refund ID", row.id], ["Tournament ID", row.tournament_id], ["Entry ID", row.entry_id ?? "Not supplied"]]}
            onPress={() => {
              setMode("tournament_refund");
              setCompletion((current) => ({ ...current, rowId: row.id, tournamentId: row.tournament_id }));
              setRepair((current) => ({ ...current, rowId: row.id }));
            }}
          />
        )} />
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader eyebrow="Complete" title="Manual bank confirmation" detail="Use the exact ID from the selected row. Upload the slip screenshot/video or paste a hardened proof link, then complete the transfer record." />
        <ModePicker mode={mode} onMode={setMode} />
        {mode.startsWith("match") ? (
          <LabeledInput label="Match room ID" value={completion.matchRoomId} onChangeText={(value) => setCompletion((current) => ({ ...current, matchRoomId: value }))} placeholder="Room UUID from the row" mono />
        ) : (
          <LabeledInput label="Tournament ID" value={completion.tournamentId} onChangeText={(value) => setCompletion((current) => ({ ...current, tournamentId: value }))} placeholder="Tournament UUID from the row" mono />
        )}
        <LabeledInput label={mode.includes("payout") ? "Payout ID" : "Refund ID"} value={completion.rowId} onChangeText={(value) => setCompletion((current) => ({ ...current, rowId: value }))} placeholder="Paste the queue row ID" mono />
        <EvidenceUploadField
          contextType={proofContextType}
          contextId={proofContextId || "pending"}
          label="Transfer proof upload"
          disabled={!proofContextId || completeMutation.isPending}
          resetSignal={completionUploadResetSignal}
          onUploaded={(evidence) => setCompletion((current) => ({ ...current, proofUrl: evidence.url }))}
        />
        {!proofContextId ? <Text style={styles.helpText}>Enter the room or tournament ID before uploading proof so the file is stored against the right record.</Text> : null}
        <LabeledInput label="Transfer proof link" value={completion.proofUrl} onChangeText={(value) => setCompletion((current) => ({ ...current, proofUrl: value }))} placeholder="Uploaded proof URL" />
        <LabeledInput label={mode.includes("payout") ? "Bank payout reference" : "Bank refund reference"} optional value={completion.reference} onChangeText={(value) => setCompletion((current) => ({ ...current, reference: value }))} placeholder="Optional bank reference" />
        <AppButton loading={completeMutation.isPending} disabled={!stepUpToken} onPress={() => completeMutation.mutate()}>
          {mode.includes("refund") ? "Complete refund" : "Complete payout"}
        </AppButton>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader eyebrow="Repair" title="Fix payout or refund instructions" detail="Use fallback to copy the latest approved funding/profile instructions, or save corrected bank details directly onto the queued row." />
        <ModePicker mode={mode} onMode={setMode} />
        <LabeledInput label={mode.includes("payout") ? "Payout ID" : "Refund ID"} value={repair.rowId} onChangeText={(value) => setRepair((current) => ({ ...current, rowId: value }))} placeholder="Paste row ID" mono />
        <LabeledInput label="Recipient name" value={repair.recipient} onChangeText={(value) => setRepair((current) => ({ ...current, recipient: value }))} placeholder="Correct account name" />
        <LabeledInput label="Bank name" value={repair.bank} onChangeText={(value) => setRepair((current) => ({ ...current, bank: value }))} placeholder="Bank" />
        <LabeledInput label="Account number" value={repair.account} onChangeText={(value) => setRepair((current) => ({ ...current, account: value }))} placeholder="Account number" mono />
        <LabeledInput label="Bank code" optional value={repair.bankCode} onChangeText={(value) => setRepair((current) => ({ ...current, bankCode: value }))} placeholder="Optional bank code" />
        <LabeledInput label="Team note" optional multiline minHeight={92} value={repair.note} onChangeText={(value) => setRepair((current) => ({ ...current, note: value }))} placeholder="Why this instruction was repaired" />
        <View style={styles.actionGrid}>
          <AppButton variant="secondary" disabled={!stepUpToken} loading={repairMutation.isPending} onPress={() => repairMutation.mutate(true)}>Apply fallback</AppButton>
          <AppButton disabled={!stepUpToken} loading={repairMutation.isPending} onPress={() => repairMutation.mutate(false)}>Save instructions</AppButton>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader eyebrow="Reserve" title="Create payout or refund queues" detail="Approved results now auto-queue payouts. Use manual reserve only for recovery, migration, or backfill cases." />
        <LabeledInput label="Match room ID for settlement" value={reserveRoomId} onChangeText={setReserveRoomId} placeholder="Match room UUID" mono />
        <LabeledInput label="Notes" optional multiline minHeight={88} value={reserveNotes} onChangeText={setReserveNotes} placeholder="Why this reserve is being done manually" />
        <AppButton disabled={!stepUpToken} loading={reserveSettlementMutation.isPending} onPress={() => reserveSettlementMutation.mutate()}>Reserve settlement</AppButton>
        <View style={styles.divider} />
        <LabeledInput label="Match room ID for refunds" value={refundRoomId} onChangeText={setRefundRoomId} placeholder="Match room UUID" mono />
        <LabeledInput label="Refund reason" multiline minHeight={88} value={refundReason} onChangeText={setRefundReason} placeholder="Why entries should be returned" />
        <AppButton variant="danger" disabled={!stepUpToken} loading={reserveRefundMutation.isPending} onPress={() => reserveRefundMutation.mutate()}>Reserve refunds</AppButton>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader eyebrow="History" title="Recent payment records" detail="Completed and pending payment rows stay visible for review." />
        <View style={styles.historyGrid}>
          <MiniStat label="Completed payouts" value={String(completedPayouts.length + completedTournamentPayouts.length)} />
          <MiniStat label="Completed refunds" value={String(completedRefunds.length + completedTournamentRefunds.length)} />
        </View>
        <QueueBlock title="Settlement history" detail="Approved results that have reserved payout workflow." emptyTitle="No settlement records yet" rows={[...queuedSettlements, ...(data?.settlements ?? []).filter((row) => row.status === "completed").slice(0, 6)]} render={(row) => (
          <PaymentRow
            key={row.id}
            icon={<ReceiptText color={colors.greenDark} size={22} />}
            title={winnerLabel(row)}
            amount={money(row.currency, row.payout_minor)}
            meta={`${row.room_title || "Match room"} - ${row.room_code || "No code"}`}
            detail={`Reserved ${dateLabel(row.reserved_at)}`}
            status={row.status}
            statusTone={row.status === "completed" ? "green" : "amber"}
            identifiers={[["Settlement ID", row.id], ["Match room ID", row.match_room_id]]}
          />
        )} />
        <QueueBlock title="Tournament settlement history" detail="Tournament prize pools that have moved into payout workflow." emptyTitle="No tournament settlements yet" rows={[...queuedTournamentSettlements, ...(data?.tournamentSettlements ?? []).filter((row) => row.status === "completed").slice(0, 6)]} render={(row) => (
          <PaymentRow
            key={row.id}
            icon={<ReceiptText color={colors.greenDark} size={22} />}
            title={tournamentTitle(row)}
            amount={money(row.currency, row.payout_pool_minor)}
            meta={`Commission ${money(row.currency, row.commission_minor ?? 0)}`}
            detail={`Reserved ${dateLabel(row.reserved_at)}`}
            status={row.status}
            statusTone={row.status === "completed" ? "green" : "amber"}
            identifiers={[["Settlement ID", row.id], ["Tournament ID", row.tournament_id]]}
          />
        )} />
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
          <Text style={styles.sectionTitle}>Unlock money actions</Text>
          <Text style={styles.copy}>
            {stepUpToken
              ? `Unlocked${stepUpExpiresAt ? ` until ${dateLabel(stepUpExpiresAt)}` : " for this session"}.`
              : "Confirm your Skillsroom password before reserving, repairing, completing payouts, or completing refunds."}
          </Text>
        </View>
      </View>
      {stepUpToken ? (
        <AppButton variant="secondary" onPress={onLock}>Lock money actions</AppButton>
      ) : (
        <View style={styles.formStack}>
          <LabeledInput label="Current password" value={password} onChangeText={setPassword} placeholder="Confirm password" secureTextEntry />
          <AppButton loading={loading} onPress={onUnlock}>Unlock payments</AppButton>
        </View>
      )}
    </SurfaceCard>
  );
}

function ModePicker({ mode, onMode }: { mode: PaymentMode; onMode: (mode: PaymentMode) => void }) {
  return (
    <View style={styles.modeTabs}>
      {paymentModes.map((item) => (
        <Pressable key={item.key} onPress={() => onMode(item.key)} style={[styles.modeTab, item.key === mode && styles.modeTabActive]}>
          <Text style={[styles.modeTabTitle, item.key === mode && styles.modeTabTitleActive]}>{item.label}</Text>
          <Text style={[styles.modeTabDetail, item.key === mode && styles.modeTabDetailActive]}>{item.detail}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function QueueBlock<T>({ title, detail, emptyTitle, rows, render }: { title: string; detail: string; emptyTitle: string; rows: T[]; render: (row: T) => React.ReactNode }) {
  return (
    <View style={styles.queueBlock}>
      <View style={styles.queueHeader}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowMeta}>{detail}</Text>
      </View>
      {rows.length ? rows.map(render) : <EmptyState title={emptyTitle} body="Nothing is waiting in this queue right now." />}
    </View>
  );
}

function PaymentRow({
  icon,
  title,
  amount,
  meta,
  detail,
  status,
  statusTone,
  identifiers,
  onPress
}: {
  icon: React.ReactNode;
  title: string;
  amount: string;
  meta: string;
  detail: string;
  status: string;
  statusTone: Tone;
  identifiers: Array<[string, string]>;
  onPress?: () => void;
}) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={styles.paymentRow}>
      <View style={styles.paymentTop}>
        <View style={styles.paymentIcon}>{icon}</View>
        <View style={styles.fill}>
          <Text style={styles.paymentTitle}>{title}</Text>
          <Text style={styles.rowMeta}>{meta}</Text>
        </View>
        <Badge tone={statusTone === "red" ? "red" : statusTone === "green" ? "green" : statusTone === "cyan" ? "cyan" : "amber"}>{status}</Badge>
      </View>
      <Text style={styles.amountText}>{amount}</Text>
      <Text style={styles.rowMeta}>{detail}</Text>
      <View style={styles.identifierGrid}>
        {identifiers.map(([label, value]) => (
          <View key={`${label}:${value}`} style={styles.identifierCell}>
            <DetailCell label={label} value={shortId(value)} mono />
            <CopyButton value={value} label="Copy" copiedLabel="Copied" compact />
          </View>
        ))}
      </View>
      {onPress ? (
        <View style={styles.selectHint}>
          <ClipboardCheck color={colors.cyan} size={18} />
          <Text style={styles.selectHintText}>Tap to use this row</Text>
        </View>
      ) : null}
    </Pressable>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
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
  securityCard: { borderColor: "#ffdf9d" },
  securityHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  securityIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" },
  formStack: { gap: spacing.sm },
  modeTabs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingVertical: spacing.xs },
  modeTab: { flexGrow: 1, flexBasis: "47%", minWidth: 132, minHeight: 96, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md, gap: spacing.xs, justifyContent: "center" },
  modeTabActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  modeTabTitle: { color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: "900", flexShrink: 1 },
  modeTabTitleActive: { color: colors.white },
  modeTabDetail: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "800", flexShrink: 1 },
  modeTabDetailActive: { color: "#b7c4d4" },
  queueBlock: { gap: spacing.sm, paddingTop: spacing.md },
  queueHeader: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md, gap: spacing.xs },
  paymentRow: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md, gap: spacing.md },
  paymentTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  paymentIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  paymentTitle: { color: colors.ink, fontSize: 18, lineHeight: 24, fontWeight: "900" },
  amountText: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  identifierGrid: { gap: spacing.sm },
  identifierCell: { gap: spacing.xs },
  detailCell: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: spacing.md },
  detailLabel: { color: colors.faint, fontSize: 11, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  detailValue: { marginTop: spacing.xs, color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: "800", flexShrink: 1 },
  monoText: { fontFamily: "monospace" },
  selectHint: { alignSelf: "flex-start", minHeight: 42, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  selectHintText: { color: colors.muted, fontSize: 13, fontWeight: "900" },
  field: { gap: spacing.xs },
  inputLabel: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  optionalLabel: { marginTop: -4, color: colors.muted, fontSize: 13, fontWeight: "800" },
  input: { minHeight: 56, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, color: colors.ink, fontSize: 16, fontWeight: "700" },
  inputMono: { fontFamily: "monospace" },
  multilineInput: { paddingTop: spacing.md, paddingBottom: spacing.md, lineHeight: 23 },
  helpText: { color: colors.amber, fontSize: 13, lineHeight: 20, fontWeight: "800" },
  actionGrid: { gap: spacing.sm },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.sm },
  historyGrid: { flexDirection: "row", gap: spacing.md },
  miniStat: { flex: 1, minWidth: 118, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  miniStatValue: { marginTop: spacing.sm, color: colors.ink, fontSize: 28, fontWeight: "900" },
  rowTitle: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: "900", flexShrink: 1 },
  rowMeta: { color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: "700", flexShrink: 1 },
  emptyState: { borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, padding: spacing.lg, alignItems: "center", gap: spacing.xs }
});
