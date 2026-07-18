import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, BadgeCheck, Banknote, ClipboardCheck, ExternalLink, LockKeyhole, Radio, ShieldAlert } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  adminLanesFor,
  canAccessAdmin,
  canUseAdminSection,
  confirmAdminStepUp,
  listAdminFundingSubmissions,
  reviewAdminFundingSubmission,
  roleLabel
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
import type { ManualFundingSubmission } from "../../../types/api";

type Notice = { tone: "error" | "success" | "info"; message: string } | null;
type NoticeTarget = "queue" | "security" | "decision";
type Tone = "cyan" | "green" | "amber" | "red";

function money(currency = "NGN", minor = 0) {
  return `${currency} ${Math.round(minor / 100).toLocaleString()}`;
}

function dateLabel(value?: string) {
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

function countStatus(rows: ManualFundingSubmission[], status: string) {
  return rows.filter((row) => row.status === status).length;
}

export function AdminFundingScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { pushFeedback } = useActionFeedback();
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [password, setPassword] = useState("");
  const savedStepUpToken = useAdminStepUpStore((state) => state.token);
  const savedStepUpExpiresAt = useAdminStepUpStore((state) => state.expiresAt);
  const savedStepUpUserId = useAdminStepUpStore((state) => state.userId);
  const setAdminStepUp = useAdminStepUpStore((state) => state.setStepUp);
  const clearAdminStepUp = useAdminStepUpStore((state) => state.clearStepUp);
  const [notice, setNotice] = useState<Notice>(null);
  const [targetNotice, setTargetNotice] = useState<{ target: NoticeTarget; notice: NonNullable<Notice> } | null>(null);
  const canAdmin = canAccessAdmin(user);
  const canFunding = canUseAdminSection(user, "funding");
  const lanes = useMemo(() => adminLanesFor(user), [user]);

  const fundingQuery = useQuery({
    queryKey: ["admin", "funding", "submitted"],
    queryFn: () => listAdminFundingSubmissions("submitted"),
    enabled: canFunding
  });

  const submissions = fundingQuery.data ?? [];
  const selectedSubmission = submissions.find((row) => row.id === selectedId);
  const totalMinor = submissions.reduce((total, row) => total + (typeof row.amount_minor === "number" ? row.amount_minor : 0), 0);
  const hasSubmissionId = Boolean(selectedId.trim());
  const stepUpActive = isAdminStepUpActive({ token: savedStepUpToken, expiresAt: savedStepUpExpiresAt, userId: savedStepUpUserId }, user?.id);
  const stepUpToken = stepUpActive ? savedStepUpToken : null;
  const stepUpExpiresAt = stepUpActive ? savedStepUpExpiresAt : null;
  const hasFundingUnlock = Boolean(stepUpToken);
  const canReview = hasSubmissionId && hasFundingUnlock;
  const notify = (target: NoticeTarget, nextNotice: NonNullable<Notice>) => {
    setNotice(nextNotice);
    setTargetNotice({ target, notice: nextNotice });
    pushFeedback({
      tone: nextNotice.tone,
      title: nextNotice.tone === "error" ? "Funding action failed" : target === "security" ? "Funding access updated" : "Funding review updated",
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
      notify("security", { tone: "success", message: "Sensitive funding actions are unlocked for this session." });
    },
    onError: (error) => {
      clearAdminStepUp();
      notify("security", { tone: "error", message: plainApiError(error, "Sensitive actions could not be unlocked.") });
    }
  });

  const reviewMutation = useMutation({
    mutationFn: (decision: "approve" | "reject") => {
      if (!stepUpToken) throw new Error("Unlock sensitive actions before reviewing funding.");
      if (!selectedId.trim()) throw new Error("Select or paste a submission ID first.");
      return reviewAdminFundingSubmission(selectedId.trim(), {
        decision,
        note: note.trim() || undefined,
        stepUpToken
      });
    },
    onSuccess: async (_, decision) => {
      notify("decision", { tone: "success", message: decision === "approve" ? "Funding submission approved." : "Funding submission rejected." });
      setSelectedId("");
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "funding"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (error) => {
      if (error instanceof ApiError && (error.code === "ADMIN_STEP_UP_EXPIRED" || error.code === "ADMIN_STEP_UP_INVALID")) {
        clearAdminStepUp();
      }
      notify("decision", { tone: "error", message: plainApiError(error, "The funding review could not be completed.") });
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

  if (!canFunding) {
    return (
      <AppScreen>
        <SurfaceCard style={styles.hero}>
          <Badge tone="amber">Funding</Badge>
          <Text style={styles.heroTitle}>Funding review is restricted.</Text>
          <Text style={styles.copy}>Your {roleLabel(user?.role)} role can use other admin areas, but manual funding decisions require Admin or Owner access.</Text>
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
            <Text style={styles.shellTitle} numberOfLines={1}>Funding</Text>
            <Text style={styles.shellMeta}>{roleLabel(user?.role)} workspace</Text>
          </View>
          <Pressable style={styles.playerButton} onPress={() => router.replace("/(app)/(tabs)/home")}>
            <Text style={styles.playerButtonText}>Player app</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.laneTabs}>
          {lanes.map((lane) => (
            <Pressable key={lane.key} onPress={() => openAdminLane(lane.key)} style={[styles.laneTab, lane.key === "funding" && styles.laneTabActive]}>
              <Text style={[styles.laneTabText, lane.key === "funding" && styles.laneTabTextActive]}>{lane.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SurfaceCard>

      <SurfaceCard style={styles.hero}>
        <Badge tone="amber">Funding</Badge>
        <Text style={styles.heroTitle}>Manual Funding Queue</Text>
        <Text style={styles.copy}>Confirm exact transfer amount, sender identity, room, and reference before approval creates payment records.</Text>
      </SurfaceCard>

      <View style={styles.livePill}>
        <View style={styles.liveIcon}>
          <Radio color={colors.greenDark} size={18} />
        </View>
        <View style={styles.fill}>
          <Text style={styles.liveTitle}>Funding updates</Text>
          <Text style={styles.liveMeta}>{fundingQuery.isFetching ? "Refreshing submitted transfers" : "Listening for submitted transfers"}</Text>
        </View>
        <Badge tone="green">On</Badge>
      </View>

      {notice && !targetNotice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

      {fundingQuery.isError ? (
        <FeedbackState
          tone="error"
          title="Funding queue unavailable"
          body="We could not load submitted manual transfers right now."
          actionLabel="Retry"
          onAction={() => void fundingQuery.refetch()}
        />
      ) : null}

      <View style={styles.metricGrid}>
        <MetricCard tone="amber" label="Submitted" value={countStatus(submissions, "submitted").toString()} detail="Needs review" />
        <MetricCard tone="green" label="Approved" value={countStatus(submissions, "approved").toString()} detail="Current filter" />
        <MetricCard tone="red" label="Rejected" value={countStatus(submissions, "rejected").toString()} detail="Current filter" />
        <MetricCard tone="cyan" label="Queue total" value={submissions.length.toString()} detail={money("NGN", totalMinor)} />
      </View>

      <SurfaceCard>
        <SectionHeader
          eyebrow="Queue"
          title="Submitted transfers"
          detail="Check the bank record and proof first, then tap a transfer to copy its submission ID into the review panel for approval or rejection."
        />
        {noticeFor("queue") ? <FormNotice tone={noticeFor("queue")!.tone} message={noticeFor("queue")!.message} /> : null}
        {fundingQuery.isLoading ? <Text style={styles.copy}>Loading funding queue...</Text> : null}
        {!fundingQuery.isLoading && !submissions.length ? (
          <EmptyState title="Funding queue is clear" body="No manual funding submissions are waiting for approval." />
        ) : null}
        {submissions.map((submission) => (
          <FundingSubmissionCard
            key={submission.id}
            selected={submission.id === selectedId}
            submission={submission}
            onSelect={() => setSelectedId(submission.id)}
            onOpenProof={(url) => {
              if (!openEvidenceInApp(url, "Funding proof")) notify("queue", { tone: "error", message: "The proof link could not be opened." });
            }}
          />
        ))}
      </SurfaceCard>

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
                : "Confirm your Skillsroom password before approving or rejecting transfers."}
            </Text>
          </View>
        </View>
        {noticeFor("security") ? <FormNotice tone={noticeFor("security")!.tone} message={noticeFor("security")!.message} /> : null}
        {stepUpToken ? (
          <AppButton
            variant="secondary"
            onPress={() => {
              clearAdminStepUp();
              notify("security", { tone: "info", message: "Sensitive funding actions are locked again." });
            }}
          >
            Lock sensitive actions
          </AppButton>
        ) : (
          <View style={styles.formStack}>
            <LabeledInput
              label="Current password"
              value={password}
              onChangeText={setPassword}
              placeholder="Confirm password"
              secureTextEntry
            />
            <AppButton loading={stepUpMutation.isPending} onPress={() => stepUpMutation.mutate()}>
              Unlock funding review
            </AppButton>
          </View>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader eyebrow="Decision" title="Approve or reject funding" detail="Approvals create balanced payment records for platform cash and room prize handling." />
        {noticeFor("decision") ? <FormNotice tone={noticeFor("decision")!.tone} message={noticeFor("decision")!.message} /> : null}
        {selectedSubmission ? (
          <View style={styles.selectedPanel}>
            <Badge tone="amber">Selected</Badge>
            <Text style={styles.selectedAmount}>{money(selectedSubmission.currency, selectedSubmission.amount_minor)}</Text>
            <Text style={styles.rowMeta}>Room {shortId(selectedSubmission.match_room_id)} - {shortId(selectedSubmission.transfer_reference)}</Text>
          </View>
        ) : (
          <FormNotice tone="info" message="Tap a submitted transfer above, or paste the submission ID manually." />
        )}

        <View style={styles.formStack}>
          <LabeledInput label="Submission ID" value={selectedId} onChangeText={setSelectedId} placeholder="submission id" mono />
          <LabeledInput label="Review note" optional value={note} onChangeText={setNote} placeholder="Bank alert matched, sender verified..." multiline minHeight={112} />
          {!hasSubmissionId ? (
            <FormNotice tone="info" message="Select a submitted transfer above or paste its submission ID before making a decision." />
          ) : !hasFundingUnlock ? (
            <FormNotice tone="warning" message="Unlock funding review first. Approval and rejection stay locked until your password step-up is active." />
          ) : (
            <FormNotice tone="success" message="Funding review is unlocked. Confirm the bank alert and proof before approving or rejecting." />
          )}
          <View style={styles.actionGrid}>
            <AppButton
              disabled={!canReview}
              loading={reviewMutation.isPending}
              onPress={() => reviewMutation.mutate("approve")}
              style={styles.actionButton}
            >
              Approve funding
            </AppButton>
            <AppButton
              variant="danger"
              disabled={!canReview}
              loading={reviewMutation.isPending}
              onPress={() => reviewMutation.mutate("reject")}
              style={styles.actionButton}
            >
              Reject funding
            </AppButton>
          </View>
        </View>
      </SurfaceCard>
    </AppScreen>
  );
}

function openAdminLane(section: string) {
  if (section === "overview") {
    router.replace({ pathname: "/admin" } as never);
    return;
  }
  if (section === "funding") return;
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

function FundingSubmissionCard({
  submission,
  selected,
  onSelect,
  onOpenProof
}: {
  submission: ManualFundingSubmission;
  selected: boolean;
  onSelect: () => void;
  onOpenProof: (url: string) => void;
}) {
  const url = evidenceApiUrl(submission.proof_url);
  return (
    <Pressable onPress={onSelect} style={[styles.submissionCard, selected && styles.submissionCardActive]}>
      <View style={styles.submissionTop}>
        <View style={styles.fill}>
          <View style={styles.badgeRow}>
            <Badge tone={selected ? "green" : "amber"}>{selected ? "Selected" : submission.status ?? "Submitted"}</Badge>
            <Text style={styles.dateText}>{dateLabel(submission.submitted_at ?? submission.created_at)}</Text>
          </View>
          <Text style={styles.amount}>{money(submission.currency, submission.amount_minor)}</Text>
          <Text style={styles.rowMeta}>Room {shortId(submission.match_room_id)}</Text>
        </View>
        <View style={styles.moneyIcon}>
          <Banknote color={colors.greenDark} size={24} />
        </View>
      </View>

      <View style={styles.detailGrid}>
        <DetailCell label="Submission ID" value={submission.id} mono />
        <DetailCell label="Player" value={submission.user_id ?? "Not supplied"} />
        <DetailCell label="Reference" value={submission.transfer_reference ?? "Not supplied"} />
        <DetailCell label="Bank" value={submission.sender_bank_name ?? "Not provided"} />
        <DetailCell label="Sender" value={submission.sender_account_name ?? "Not provided"} />
        <DetailCell label="Proof note" value={submission.proof_note ?? "No note"} />
      </View>

      <View style={styles.submissionActions}>
        <View style={styles.selectHint}>
          <ClipboardCheck color={selected ? colors.greenDark : colors.cyan} size={18} />
          <Text style={[styles.selectHintText, selected && styles.selectHintTextActive]}>{selected ? "Ready for decision" : "Tap to review"}</Text>
        </View>
        <CopyButton value={submission.id} label="Copy ID" copiedLabel="ID copied" compact />
        {url ? (
          <Pressable style={styles.proofButton} onPress={() => onOpenProof(url)}>
            <ExternalLink color={colors.cyan} size={18} />
            <Text style={styles.proofButtonText}>Open proof</Text>
          </Pressable>
        ) : (
          <View style={styles.noProofPill}>
            <ShieldAlert color={colors.amber} size={16} />
            <Text style={styles.noProofText}>No proof link</Text>
          </View>
        )}
      </View>
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowMeta}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionHero: {
    minHeight: 260,
    justifyContent: "center"
  },
  shell: {
    padding: 0,
    overflow: "hidden"
  },
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
  brandText: {
    color: colors.navy,
    fontWeight: "900",
    fontSize: 16
  },
  brandCopy: {
    flex: 1,
    minWidth: 0
  },
  shellTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "900"
  },
  shellMeta: {
    marginTop: 2,
    color: "#a7b5c7",
    fontSize: 12,
    fontWeight: "800"
  },
  playerButton: {
    minHeight: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "#22344b",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  playerButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "900"
  },
  laneTabs: {
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm
  },
  laneTab: {
    minHeight: 34,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navySoft
  },
  laneTabActive: {
    backgroundColor: colors.white
  },
  laneTabText: {
    color: "#b7c4d4",
    fontWeight: "900"
  },
  laneTabTextActive: {
    color: colors.navy
  },
  hero: {
    backgroundColor: "#fbfefe"
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900"
  },
  darkHeroTitle: {
    color: colors.white,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900"
  },
  copy: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 25,
    fontWeight: "600"
  },
  darkCopy: {
    color: "#cbd6e5",
    fontSize: 16,
    lineHeight: 25,
    fontWeight: "600"
  },
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
  liveTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  liveMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  fill: {
    flex: 1,
    minWidth: 0
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  metricCard: {
    width: "47%",
    minHeight: 142,
    justifyContent: "space-between",
    padding: spacing.md
  },
  cyanTop: { borderTopWidth: 4, borderTopColor: colors.cyan },
  greenTop: { borderTopWidth: 4, borderTopColor: colors.greenDark },
  amberTop: { borderTopWidth: 4, borderTopColor: colors.amber },
  redTop: { borderTopWidth: 4, borderTopColor: colors.red },
  metricLabel: {
    color: colors.faint,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase"
  },
  metricValue: {
    fontSize: 34,
    fontWeight: "900"
  },
  cyanText: { color: colors.cyan },
  greenText: { color: colors.greenDark },
  amberText: { color: colors.amber },
  redText: { color: colors.red },
  metricDetail: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  eyebrow: {
    color: "#0898b8",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 4,
    textTransform: "uppercase"
  },
  sectionTitle: {
    marginTop: spacing.xs,
    color: colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900"
  },
  submissionCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.md
  },
  submissionCardActive: {
    borderColor: colors.green,
    backgroundColor: "#f1fff8"
  },
  submissionTop: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start"
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm
  },
  dateText: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  amount: {
    marginTop: spacing.sm,
    color: colors.ink,
    fontSize: 26,
    fontWeight: "900"
  },
  moneyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  detailGrid: {
    gap: spacing.sm
  },
  detailCell: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: spacing.md
  },
  detailLabel: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase"
  },
  detailValue: {
    marginTop: spacing.xs,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    flexShrink: 1
  },
  monoText: {
    fontFamily: "monospace"
  },
  submissionActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignItems: "center",
    justifyContent: "space-between"
  },
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
  selectHintText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900"
  },
  selectHintTextActive: {
    color: colors.greenDark
  },
  proofButton: {
    minHeight: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  proofButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900"
  },
  noProofPill: {
    minHeight: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: "#ffdf9d",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  noProofText: {
    color: colors.amber,
    fontSize: 13,
    fontWeight: "900"
  },
  securityCard: {
    borderColor: "#ffdf9d"
  },
  securityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  securityIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.amberSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  selectedPanel: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#b6f4db",
    backgroundColor: colors.greenSoft,
    padding: spacing.md,
    gap: spacing.xs
  },
  selectedAmount: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "900"
  },
  formStack: {
    gap: spacing.sm
  },
  field: {
    gap: spacing.xs
  },
  inputLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  optionalLabel: {
    marginTop: -4,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
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
  inputMono: {
    fontFamily: "monospace"
  },
  multilineInput: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    lineHeight: 23
  },
  actionGrid: {
    gap: spacing.sm
  },
  actionButton: {
    minHeight: 58
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    flexShrink: 1
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    flexShrink: 1
  },
  emptyState: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs
  }
});
