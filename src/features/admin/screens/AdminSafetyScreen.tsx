import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ArrowLeft,
  Ban,
  EyeOff,
  Flag,
  KeyRound,
  LockKeyhole,
  MessageSquareWarning,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Siren,
  UserX
} from "lucide-react-native";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  adminLanesFor,
  canAccessAdmin,
  canUseAdminSection,
  confirmAdminStepUp,
  createAdminModerationAction,
  createAdminRiskFlag,
  createAdminRoomHold,
  deleteAdminChatMessage,
  getAdminDmAbuseQueue,
  getAdminRiskDashboard,
  hideAdminChatMessage,
  listAdminChatModerationQueue,
  listAdminEvidenceAccessEvents,
  listAdminModerationActions,
  listAdminRiskFlags,
  listAdminRoomHolds,
  muteAdminChatMember,
  releaseAdminRoomHold,
  roleLabel,
  updateAdminRiskFlagStatus,
  type AdminModerationAction,
  type AdminRiskFlag,
  type AdminRoomHold,
  type ChatDmRequest,
  type ChatModerationEvent,
  type ChatUserBlock,
  type EvidenceAccessEvent
} from "../../../api/admin";
import { plainApiError } from "../../../api/errors";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, spacing } from "../../../constants/theme";
import { isAdminStepUpActive, useAdminStepUpStore } from "../../../store/admin-step-up-store";
import { useAuthStore } from "../../../store/auth-store";

type Notice = { tone: "error" | "success" | "info"; message: string } | null;
type NoticeTarget = "reports" | "holds" | "chat" | "account";
type Tone = "cyan" | "green" | "amber" | "red";
type Severity = "low" | "medium" | "high" | "critical";
type RiskStatus = "open" | "reviewing" | "resolved" | "dismissed";
type ActionType = "note" | "warn" | "restrict" | "suspend" | "ban" | "release_hold" | "room_hold";

const severities: Severity[] = ["low", "medium", "high", "critical"];
const riskStatuses: RiskStatus[] = ["open", "reviewing", "resolved", "dismissed"];
const actionTypes: ActionType[] = ["note", "warn", "restrict", "suspend", "ban", "room_hold"];

function shortId(value?: string | null) {
  if (!value) return "Not supplied";
  return value.length <= 14 ? value : `${value.slice(0, 8)}...${value.slice(-5)}`;
}

function label(value?: string | null) {
  if (!value) return "Unknown";
  return value.split(/[_.]+/).map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ");
}

const evidenceEventLabels: Record<string, string> = {
  "evidence.access.allowed": "Evidence access approved",
  "evidence.access.denied": "Evidence access denied",
  "evidence.access.invalid_request": "Invalid evidence request",
  "evidence.access.metadata_mismatch": "Evidence metadata mismatch",
  "evidence.access.not_found": "Evidence file not found",
  "evidence.access.retention_expired": "Evidence retention expired",
  "evidence.access.legal_hold_applied": "Legal hold applied",
  "evidence.access.legal_hold_released": "Legal hold released",
  "evidence.access.exported": "Evidence exported",
  "evidence.access.chain_reviewed": "Chain of custody reviewed",
  "evidence.access.quarantined": "Evidence quarantined",
  "evidence.access.restored": "Evidence restored",
  "evidence.access.deletion_requested": "Evidence deletion requested",
  "evidence.access.deletion_approved": "Evidence deletion approved",
  "evidence.access.deletion_rejected": "Evidence deletion rejected",
  "evidence.access.deleted": "Evidence deleted"
};

function evidenceEventLabel(value?: string | null) {
  if (!value) return "Evidence event";
  return evidenceEventLabels[value] ?? label(value);
}

function dateLabel(value?: string | null) {
  if (!value) return "Not recorded";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;
  return new Date(value).toLocaleString("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function severityTone(value?: string | null): Tone {
  if (value === "critical" || value === "high") return "red";
  if (value === "medium") return "amber";
  return "cyan";
}

function statusTone(value?: string | null): Tone {
  if (value === "resolved" || value === "dismissed" || value === "released" || value === "expired") return "green";
  if (value === "active" || value === "reviewing" || value === "pending") return "amber";
  if (value === "open") return "red";
  return "cyan";
}

function actorName(event: ChatModerationEvent) {
  return event.sender_display_name || event.sender_username || event.actor_display_name || event.actor_username || shortId(event.target_user_id);
}

function requestName(request: ChatDmRequest) {
  return request.requester_label || request.requester_display_name || request.requester_username || shortId(request.requester_user_id);
}

function blockName(block: ChatUserBlock) {
  return `${block.blocker_label || block.blocker_username || shortId(block.blocker_user_id)} blocked ${block.blocked_label || block.blocked_username || shortId(block.blocked_user_id)}`;
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
  if (section === "tournaments") {
    router.push({ pathname: "/admin/tournaments" } as never);
    return;
  }
  if (section === "players") {
    router.push({ pathname: "/admin/players" } as never);
    return;
  }
  if (section === "team") {
    router.push({ pathname: "/admin/team" } as never);
  }
}

export function AdminSafetyScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice>(null);
  const [targetNotice, setTargetNotice] = useState<{ target: NoticeTarget; notice: NonNullable<Notice> } | null>(null);
  const [riskUserId, setRiskUserId] = useState("");
  const [riskType, setRiskType] = useState("player_report");
  const [riskSeverity, setRiskSeverity] = useState<Severity>("medium");
  const [riskSummary, setRiskSummary] = useState("");
  const [selectedFlagId, setSelectedFlagId] = useState("");
  const [flagStatus, setFlagStatus] = useState<RiskStatus>("reviewing");
  const [roomId, setRoomId] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [holdSeverity, setHoldSeverity] = useState<Severity>("high");
  const [releaseHoldId, setReleaseHoldId] = useState("");
  const [releaseNote, setReleaseNote] = useState("");
  const [chatChannel, setChatChannel] = useState("");
  const [chatMessageId, setChatMessageId] = useState("");
  const [chatTargetUserId, setChatTargetUserId] = useState("");
  const [chatReason, setChatReason] = useState("");
  const [muteMinutes, setMuteMinutes] = useState("30");
  const [actionType, setActionType] = useState<ActionType>("warn");
  const [actionSeverity, setActionSeverity] = useState<Severity>("medium");
  const [actionTargetUserId, setActionTargetUserId] = useState("");
  const [actionRoomId, setActionRoomId] = useState("");
  const [actionSummary, setActionSummary] = useState("");
  const [password, setPassword] = useState("");
  const savedStepUpToken = useAdminStepUpStore((state) => state.token);
  const savedStepUpExpiresAt = useAdminStepUpStore((state) => state.expiresAt);
  const savedStepUpUserId = useAdminStepUpStore((state) => state.userId);
  const setAdminStepUp = useAdminStepUpStore((state) => state.setStepUp);
  const clearAdminStepUp = useAdminStepUpStore((state) => state.clearStepUp);
  const canAdmin = canAccessAdmin(user);
  const canSafety = canUseAdminSection(user, "risk");
  const canModerate = user?.role === "moderator" || user?.role === "admin" || user?.role === "owner";
  const lanes = useMemo(() => adminLanesFor(user), [user]);
  const stepUpActive = isAdminStepUpActive({ token: savedStepUpToken, expiresAt: savedStepUpExpiresAt, userId: savedStepUpUserId }, user?.id);
  const stepUpToken = stepUpActive ? savedStepUpToken : null;
  const stepUpExpiresAt = stepUpActive ? savedStepUpExpiresAt : null;

  const safetyQuery = useQuery({
    queryKey: ["admin", "safety"],
    queryFn: async () => {
      const [dashboard, flags, holds, actions, chatEvents, dmAbuse, evidenceEvents] = await Promise.all([
        getAdminRiskDashboard(),
        listAdminRiskFlags("open"),
        listAdminRoomHolds("active"),
        listAdminModerationActions(),
        listAdminChatModerationQueue(),
        getAdminDmAbuseQueue(),
        listAdminEvidenceAccessEvents(30)
      ]);
      return { dashboard, flags, holds, actions, chatEvents, dmAbuse, evidenceEvents };
    },
    enabled: canSafety
  });

  const flags = safetyQuery.data?.flags ?? [];
  const holds = safetyQuery.data?.holds ?? [];
  const actions = safetyQuery.data?.actions ?? [];
  const chatEvents = safetyQuery.data?.chatEvents ?? [];
  const dmRequests = safetyQuery.data?.dmAbuse.requests ?? [];
  const dmBlocks = safetyQuery.data?.dmAbuse.blocks ?? [];
  const evidenceEvents = safetyQuery.data?.evidenceEvents ?? [];
  const criticalFlags = flags.filter((flag) => flag.severity === "critical" || flag.severity === "high").length;
  const reportedMessages = chatEvents.filter((event) => event.event_type === "message_reported").length;

  const invalidateSafety = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "safety"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] })
    ]);
  };

  const notify = (target: NoticeTarget, nextNotice: NonNullable<Notice>) => {
    setNotice(nextNotice);
    setTargetNotice({ target, notice: nextNotice });
  };

  const noticeFor = (target: NoticeTarget) => {
    if (targetNotice?.target !== target) return null;
    return <FormNotice tone={targetNotice.notice.tone} message={targetNotice.notice.message} />;
  };

  const stepUpMutation = useMutation({
    mutationFn: () => confirmAdminStepUp(password),
    onSuccess: (result) => {
      setAdminStepUp(result.step_up_token, result.expires_at ?? null, user?.id ?? null);
      setPassword("");
      notify("account", { tone: "success", message: "Account moderation unlock is active for this session." });
    },
    onError: (error) => {
      clearAdminStepUp();
      notify("account", { tone: "error", message: plainApiError(error, "Step-up confirmation failed.") });
    }
  });

  const createFlagMutation = useMutation({
    mutationFn: () => {
      if (!canModerate) throw new Error("This role can review Safety queues, but cannot create flags.");
      if (!riskUserId.trim() || !riskSummary.trim()) throw new Error("Add the player ID and a clear summary.");
      return createAdminRiskFlag({ user_id: riskUserId, flag_type: riskType, severity: riskSeverity, summary: riskSummary });
    },
    onSuccess: async () => {
      notify("reports", { tone: "success", message: "Safety flag created." });
      setRiskUserId("");
      setRiskSummary("");
      await invalidateSafety();
    },
    onError: (error) => notify("reports", { tone: "error", message: plainApiError(error, "Safety flag could not be created.") })
  });

  const updateFlagMutation = useMutation({
    mutationFn: () => {
      if (!canModerate) throw new Error("This role can review Safety queues, but cannot change flag status.");
      if (!selectedFlagId.trim()) throw new Error("Select or paste a flag ID.");
      return updateAdminRiskFlagStatus(selectedFlagId.trim(), flagStatus);
    },
    onSuccess: async () => {
      notify("reports", { tone: "success", message: `Safety flag moved to ${label(flagStatus)}.` });
      await invalidateSafety();
    },
    onError: (error) => notify("reports", { tone: "error", message: plainApiError(error, "Flag status could not be updated.") })
  });

  const createHoldMutation = useMutation({
    mutationFn: () => {
      if (!canModerate) throw new Error("This role can review room holds, but cannot place one.");
      if (!roomId.trim() || !holdReason.trim()) throw new Error("Add the room ID and reason before placing a hold.");
      return createAdminRoomHold({ match_room_id: roomId, reason: holdReason, severity: holdSeverity });
    },
    onSuccess: async () => {
      notify("holds", { tone: "success", message: "Room hold placed. The room should stay paused until review is complete." });
      setRoomId("");
      setHoldReason("");
      await invalidateSafety();
    },
    onError: (error) => notify("holds", { tone: "error", message: plainApiError(error, "Room hold could not be placed.") })
  });

  const releaseHoldMutation = useMutation({
    mutationFn: () => {
      if (!canModerate) throw new Error("This role can review room holds, but cannot release one.");
      if (!releaseHoldId.trim()) throw new Error("Select or paste a hold ID.");
      return releaseAdminRoomHold(releaseHoldId.trim(), releaseNote);
    },
    onSuccess: async () => {
      notify("holds", { tone: "success", message: "Room hold released." });
      setReleaseHoldId("");
      setReleaseNote("");
      await invalidateSafety();
    },
    onError: (error) => notify("holds", { tone: "error", message: plainApiError(error, "Room hold could not be released.") })
  });

  const hideMessageMutation = useMutation({
    mutationFn: () => {
      if (!canModerate) throw new Error("This role can inspect chat safety, but cannot hide messages.");
      if (!chatChannel.trim() || !chatMessageId.trim() || !chatReason.trim()) throw new Error("Add channel, message ID, and reason.");
      return hideAdminChatMessage(chatChannel.trim(), chatMessageId.trim(), chatReason);
    },
    onSuccess: async () => {
      notify("chat", { tone: "success", message: "Message hidden and logged." });
      await invalidateSafety();
    },
    onError: (error) => notify("chat", { tone: "error", message: plainApiError(error, "Message could not be hidden.") })
  });

  const deleteMessageMutation = useMutation({
    mutationFn: () => {
      if (!canModerate) throw new Error("This role can inspect chat safety, but cannot delete messages.");
      if (!chatChannel.trim() || !chatMessageId.trim()) throw new Error("Add channel and message ID.");
      return deleteAdminChatMessage(chatChannel.trim(), chatMessageId.trim(), chatReason);
    },
    onSuccess: async () => {
      notify("chat", { tone: "success", message: "Message deleted and logged." });
      await invalidateSafety();
    },
    onError: (error) => notify("chat", { tone: "error", message: plainApiError(error, "Message could not be deleted.") })
  });

  const muteMemberMutation = useMutation({
    mutationFn: () => {
      if (!canModerate) throw new Error("This role can inspect chat safety, but cannot mute members.");
      const duration = Math.max(5, Math.min(10080, Number(muteMinutes) || 30));
      if (!chatChannel.trim() || !chatTargetUserId.trim() || !chatReason.trim()) throw new Error("Add channel, player ID, and reason.");
      return muteAdminChatMember(chatChannel.trim(), { user_id: chatTargetUserId, duration_minutes: duration, reason: chatReason });
    },
    onSuccess: async () => {
      notify("chat", { tone: "success", message: "Member mute saved and logged." });
      await invalidateSafety();
    },
    onError: (error) => notify("chat", { tone: "error", message: plainApiError(error, "Member could not be muted.") })
  });

  const actionMutation = useMutation({
    mutationFn: () => {
      if (!canModerate) throw new Error("This role can review Safety queues, but cannot apply account actions.");
      if (!stepUpToken) throw new Error("Confirm your password before applying account moderation.");
      if (!actionSummary.trim()) throw new Error("Add a clear reason before saving this action.");
      if (!actionTargetUserId.trim() && !actionRoomId.trim()) throw new Error("Add a target player ID or room ID.");
      return createAdminModerationAction({
        action_type: actionType,
        severity: actionSeverity,
        summary: actionSummary,
        target_user_id: actionTargetUserId,
        match_room_id: actionRoomId,
        stepUpToken
      });
    },
    onSuccess: async () => {
      notify("account", { tone: "success", message: "Moderation action saved." });
      setActionTargetUserId("");
      setActionRoomId("");
      setActionSummary("");
      await invalidateSafety();
    },
    onError: (error) => notify("account", { tone: "error", message: plainApiError(error, "Moderation action could not be saved.") })
  });

  if (!canAdmin) {
    return (
      <AppScreen>
        <SurfaceCard dark style={styles.permissionHero}>
          <Badge tone="dark">Safety workspace</Badge>
          <Text style={styles.darkHeroTitle}>Admin access is not enabled for this account.</Text>
          <Text style={styles.darkCopy}>Only Support, Community Manager, Admin, and Owner roles can open Skillsroom Safety.</Text>
        </SurfaceCard>
        <AppButton onPress={() => router.replace("/(app)/(tabs)/home")}>Back to player app</AppButton>
      </AppScreen>
    );
  }

  if (!canSafety) {
    return (
      <AppScreen>
        <SurfaceCard dark style={styles.permissionHero}>
          <Badge tone="dark">{roleLabel(user?.role)}</Badge>
          <Text style={styles.darkHeroTitle}>Safety is outside this role.</Text>
          <Text style={styles.darkCopy}>Ask an owner to grant Support, Community Manager, or Owner access for reports and moderation controls.</Text>
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
            <Text style={styles.shellTitle} numberOfLines={1}>Safety</Text>
            <Text style={styles.shellMeta}>{roleLabel(user?.role)} workspace</Text>
          </View>
          <Pressable onPress={() => router.replace("/(app)/(tabs)/home")} style={styles.playerButton}>
            <Text style={styles.playerButtonText}>Player app</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.laneTabs}>
          {lanes.map((lane) => (
            <Pressable key={lane.key} onPress={() => openAdminLane(lane.key)} style={[styles.laneTab, lane.key === "risk" && styles.laneTabActive]}>
              <Text style={[styles.laneTabText, lane.key === "risk" && styles.laneTabTextActive]}>{lane.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {notice && !targetNotice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
        {safetyQuery.isError ? <FormNotice tone="error" message={plainApiError(safetyQuery.error, "Unable to load Safety queues right now.")} /> : null}

        <SurfaceCard style={styles.hero}>
          <Badge tone="cyan">Safety</Badge>
          <Text style={styles.heroTitle}>Player safety and moderation.</Text>
          <Text style={styles.copy}>Review reports, unsafe chat, room holds, DM abuse signals, and evidence access without exposing private player details casually.</Text>
        </SurfaceCard>

        <View style={styles.livePill}>
          <View style={styles.liveIcon}><Radio color={colors.greenDark} size={22} /></View>
          <View style={styles.fill}>
            <Text style={styles.liveTitle}>Safety updates</Text>
            <Text style={styles.liveMeta}>Reports, room holds, and chat moderation queues stay fresh while you review.</Text>
          </View>
          <Badge tone="green">On</Badge>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard tone={flags.length ? "red" : "green"} label="Open reports" value={String(flags.length)} detail={`${criticalFlags} high priority`} />
          <MetricCard tone={holds.length ? "amber" : "green"} label="Room holds" value={String(holds.length)} detail="Active match pauses" />
          <MetricCard tone={reportedMessages ? "amber" : "cyan"} label="Chat queue" value={String(chatEvents.length)} detail={`${reportedMessages} reports`} />
          <MetricCard tone={dmBlocks.length ? "amber" : "green"} label="DM signals" value={String(dmRequests.length + dmBlocks.length)} detail="Requests and blocks" />
        </View>

        {safetyQuery.isLoading ? (
          <FeedbackState title="Loading Safety queues" body="Checking reports, room holds, chat moderation, DM abuse signals, and evidence custody events." />
        ) : null}

        <SectionHeader eyebrow="Reports" title="Player reports and safety flags" detail="Create a flag when a player needs review. Move flags through reviewing, resolved, or dismissed only after checking the context." />
        <View style={styles.queueBlock}>
          {flags.length ? flags.slice(0, 10).map((flag) => (
            <RiskFlagCard key={flag.id} flag={flag} selected={selectedFlagId === flag.id} onPress={() => {
              setSelectedFlagId(flag.id);
              setRiskUserId(flag.user_id ?? "");
            }} />
          )) : <EmptyState title="No open safety flags" body="Player reports and internal safety flags appear here when they need action." />}
        </View>

        <SurfaceCard style={styles.formStack}>
          {noticeFor("reports")}
          <View style={styles.formHeader}>
            <View style={styles.formIcon}><Flag color={colors.cyan} size={23} /></View>
            <View style={styles.fill}>
              <Text style={styles.rowTitle}>Create or update a flag</Text>
              <Text style={styles.rowMeta}>{canModerate ? "Keep the wording factual so the next reviewer can understand what happened." : "Support can inspect flags, but cannot create or change them."}</Text>
            </View>
          </View>
          <LabeledInput label="Player user ID" value={riskUserId} onChangeText={setRiskUserId} mono />
          <LabeledInput label="Flag type" value={riskType} onChangeText={setRiskType} placeholder="player_report / abuse / fraud_signal" />
          <ChipRow label="Severity" values={severities} selected={riskSeverity} onSelect={(value) => setRiskSeverity(value as Severity)} />
          <LabeledInput label="Summary" value={riskSummary} onChangeText={setRiskSummary} multiline minHeight={92} placeholder="What should the Safety team know?" />
          <AppButton variant="dark" disabled={!canModerate} loading={createFlagMutation.isPending} onPress={() => createFlagMutation.mutate()}>
            Create safety flag
          </AppButton>
          <View style={styles.divider} />
          <LabeledInput label="Flag ID" value={selectedFlagId} onChangeText={setSelectedFlagId} mono />
          <ChipRow label="Move flag to" values={riskStatuses} selected={flagStatus} onSelect={(value) => setFlagStatus(value as RiskStatus)} />
          <AppButton variant="secondary" disabled={!canModerate} loading={updateFlagMutation.isPending} onPress={() => updateFlagMutation.mutate()}>
            Update flag status
          </AppButton>
        </SurfaceCard>

        <SectionHeader eyebrow="Room holds" title="Pause risky room settlement" detail="Use holds when a room has suspicious evidence, harassment, disputed play, or a funding/result review that must stop settlement." />
        <View style={styles.queueBlock}>
          {holds.length ? holds.slice(0, 10).map((hold) => (
            <RoomHoldCard key={hold.id} hold={hold} selected={releaseHoldId === hold.id} onPress={() => {
              setReleaseHoldId(hold.id);
              setRoomId(hold.match_room_id);
            }} />
          )) : <EmptyState title="No active room holds" body="Rooms with active safety or dispute holds appear here." />}
        </View>

        <SurfaceCard style={styles.formStack}>
          {noticeFor("holds")}
          <View style={styles.formHeader}>
            <View style={styles.formIcon}><LockKeyhole color={colors.amber} size={23} /></View>
            <View style={styles.fill}>
              <Text style={styles.rowTitle}>Place or release a hold</Text>
              <Text style={styles.rowMeta}>A hold should clearly explain why settlement or progression is paused.</Text>
            </View>
          </View>
          <LabeledInput label="Room ID" value={roomId} onChangeText={setRoomId} mono />
          <ChipRow label="Hold severity" values={severities} selected={holdSeverity} onSelect={(value) => setHoldSeverity(value as Severity)} />
          <LabeledInput label="Hold reason" value={holdReason} onChangeText={setHoldReason} multiline minHeight={92} />
          <AppButton variant="dark" disabled={!canModerate} loading={createHoldMutation.isPending} onPress={() => createHoldMutation.mutate()}>
            Place room hold
          </AppButton>
          <View style={styles.divider} />
          <LabeledInput label="Hold ID" value={releaseHoldId} onChangeText={setReleaseHoldId} mono />
          <LabeledInput label="Release note" optional value={releaseNote} onChangeText={setReleaseNote} multiline minHeight={76} />
          <AppButton variant="secondary" disabled={!canModerate} loading={releaseHoldMutation.isPending} onPress={() => releaseHoldMutation.mutate()}>
            Release hold
          </AppButton>
        </SurfaceCard>

        <SectionHeader eyebrow="Chat" title="Chat moderation queue" detail="Review reports and recent moderation events. Hide first when content should disappear from players but remain available for review; delete only when removal is final." />
        <View style={styles.queueBlock}>
          {chatEvents.length ? chatEvents.slice(0, 12).map((event) => (
            <ChatModerationCard key={event.id} event={event} onPress={() => {
              setChatChannel(event.channel_slug || event.channel_id);
              setChatMessageId(event.message_id ?? "");
              setChatTargetUserId(event.target_user_id ?? "");
              setChatReason(event.reason ?? "");
            }} />
          )) : <EmptyState title="No chat moderation events" body="Reported, hidden, deleted, locked, or muted chat activity appears here." />}
        </View>

        <SurfaceCard style={styles.formStack}>
          {noticeFor("chat")}
          <View style={styles.formHeader}>
            <View style={styles.formIcon}><MessageSquareWarning color={colors.cyan} size={23} /></View>
            <View style={styles.fill}>
              <Text style={styles.rowTitle}>Act on chat safety</Text>
              <Text style={styles.rowMeta}>Tap a queue item to copy its channel, message, player, and reason into this panel.</Text>
            </View>
          </View>
          <LabeledInput label="Channel slug or ID" value={chatChannel} onChangeText={setChatChannel} mono />
          <LabeledInput label="Message ID" value={chatMessageId} onChangeText={setChatMessageId} mono />
          <LabeledInput label="Target player ID" optional value={chatTargetUserId} onChangeText={setChatTargetUserId} mono />
          <LabeledInput label="Reason" value={chatReason} onChangeText={setChatReason} multiline minHeight={76} />
          <View style={styles.actionRow}>
            <SmallAction icon={<EyeOff color={colors.white} size={18} />} label="Hide" disabled={!canModerate} loading={hideMessageMutation.isPending} onPress={() => hideMessageMutation.mutate()} />
            <SmallAction icon={<Ban color={colors.white} size={18} />} label="Delete" danger disabled={!canModerate} loading={deleteMessageMutation.isPending} onPress={() => deleteMessageMutation.mutate()} />
          </View>
          <LabeledInput label="Mute duration minutes" value={muteMinutes} onChangeText={setMuteMinutes} />
          <AppButton variant="dark" disabled={!canModerate} loading={muteMemberMutation.isPending} onPress={() => muteMemberMutation.mutate()}>
            Mute member
          </AppButton>
        </SurfaceCard>

        <SectionHeader eyebrow="DM abuse" title="Private message safety signals" detail="This shows request and block metadata so the team can spot harassment patterns without browsing private conversations casually." />
        <SurfaceCard style={styles.formStack}>
          <Text style={styles.subhead}>Recent DM requests</Text>
          {dmRequests.slice(0, 5).map((request) => <DmRequestRow key={request.id} request={request} />)}
          {!dmRequests.length ? <Text style={styles.rowMeta}>No DM requests are waiting in the abuse context.</Text> : null}
          <Text style={styles.subhead}>Recent blocks</Text>
          {dmBlocks.slice(0, 5).map((block) => <DmBlockRow key={`${block.blocker_user_id}-${block.blocked_user_id}-${block.created_at}`} block={block} />)}
          {!dmBlocks.length ? <Text style={styles.rowMeta}>No recent block signals were returned.</Text> : null}
        </SurfaceCard>

        <SectionHeader eyebrow="Account moderation" title="Warnings, restrictions, and bans" detail="These actions affect players directly. Confirm your password, identify the player or room, and leave a plain-language reason." />
        <SurfaceCard style={styles.formStack}>
          {noticeFor("account")}
          <View style={styles.formHeader}>
            <View style={styles.formIcon}><KeyRound color={colors.cyan} size={23} /></View>
            <View style={styles.fill}>
              <Text style={styles.rowTitle}>{stepUpToken ? "Account moderation unlock active" : "Password confirmation required"}</Text>
              <Text style={styles.rowMeta}>{stepUpExpiresAt ? `Expires ${dateLabel(stepUpExpiresAt)}` : "The API rejects account moderation until step-up is active."}</Text>
            </View>
          </View>
          <LabeledInput label="Current password" value={password} onChangeText={setPassword} secure />
          <AppButton variant="secondary" disabled={!password.trim()} loading={stepUpMutation.isPending} onPress={() => stepUpMutation.mutate()}>
            Confirm password
          </AppButton>
          <ChipRow label="Action" values={actionTypes} selected={actionType} onSelect={(value) => setActionType(value as ActionType)} />
          <ChipRow label="Severity" values={severities} selected={actionSeverity} onSelect={(value) => setActionSeverity(value as Severity)} />
          <LabeledInput label="Target player ID" optional value={actionTargetUserId} onChangeText={setActionTargetUserId} mono />
          <LabeledInput label="Room ID" optional value={actionRoomId} onChangeText={setActionRoomId} mono />
          <LabeledInput label="Reason for action" value={actionSummary} onChangeText={setActionSummary} multiline minHeight={92} />
          <AppButton variant={actionType === "ban" || actionType === "suspend" ? "danger" : "dark"} disabled={!canModerate} loading={actionMutation.isPending} onPress={() => actionMutation.mutate()}>
            Save moderation action
          </AppButton>
        </SurfaceCard>

        <SectionHeader eyebrow="History" title="Recent moderation actions" detail="The latest warnings, restrictions, notes, room holds, and releases stay visible here for handoff between operators." />
        <View style={styles.queueBlock}>
          {actions.slice(0, 10).map((action) => <ModerationActionCard key={action.id} action={action} />)}
          {!actions.length ? <EmptyState title="No moderation actions yet" body="Account and room safety actions will appear here after they are saved." /> : null}
        </View>

        <SectionHeader eyebrow="Evidence" title="Evidence custody access" detail="Use this to spot unusual evidence access. Legal hold, quarantine, and file deletion remain web-console operations until the API exposes mobile-safe evidence file actions." />
        <View style={styles.queueBlock}>
          {evidenceEvents.slice(0, 10).map((event) => <EvidenceEventCard key={event.id} event={event} />)}
          {!evidenceEvents.length ? <EmptyState title="No evidence access events" body="Evidence access logs appear here when files are viewed or handled." /> : null}
        </View>

        <AppButton variant="secondary" onPress={() => safetyQuery.refetch()}>Refresh Safety</AppButton>
      </ScrollView>
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

function MetricCard({ tone, label: labelText, value, detail }: { tone: Tone; label: string; value: string; detail: string }) {
  return (
    <SurfaceCard style={[styles.metricCard, styles[`${tone}Top`]]}>
      <Text style={styles.metricLabel}>{labelText}</Text>
      <Text style={[styles.metricValue, styles[`${tone}Text`]]}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </SurfaceCard>
  );
}

function RiskFlagCard({ flag, selected, onPress }: { flag: AdminRiskFlag; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.rowCard, selected && styles.selectedRow]}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}><ShieldAlert color={colors.cyan} size={22} /></View>
        <View style={styles.fill}>
          <Text style={styles.rowTitle}>{label(flag.flag_type)}</Text>
          <Text style={styles.rowMeta}>{shortId(flag.user_id)} / {dateLabel(flag.created_at)}</Text>
          <Badge tone={severityTone(flag.severity)}>{label(flag.severity)}</Badge>
        </View>
      </View>
      <Text style={styles.cardBody}>{flag.summary || "No summary supplied."}</Text>
      <View style={styles.detailGrid}>
        <DetailCell label="Status" value={label(flag.status)} />
        <DetailCell label="Flag ID" value={shortId(flag.id)} mono />
      </View>
    </Pressable>
  );
}

function RoomHoldCard({ hold, selected, onPress }: { hold: AdminRoomHold; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.rowCard, selected && styles.selectedRow]}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarAmber}><LockKeyhole color={colors.amber} size={22} /></View>
        <View style={styles.fill}>
          <Text style={styles.rowTitle}>Room hold</Text>
          <Text style={styles.rowMeta}>{shortId(hold.match_room_id)} / {dateLabel(hold.created_at)}</Text>
          <Badge tone={statusTone(hold.status)}>{label(hold.status)}</Badge>
        </View>
      </View>
      <Text style={styles.cardBody}>{hold.reason}</Text>
      <View style={styles.detailGrid}>
        <DetailCell label="Severity" value={label(hold.severity)} />
        <DetailCell label="Hold ID" value={shortId(hold.id)} mono />
      </View>
    </Pressable>
  );
}

function ChatModerationCard({ event, onPress }: { event: ChatModerationEvent; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.rowCard}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}><MessageSquareWarning color={colors.cyan} size={22} /></View>
        <View style={styles.fill}>
          <Text style={styles.rowTitle}>{label(event.event_type)}</Text>
          <Text style={styles.rowMeta}>{event.channel_title || event.channel_slug || shortId(event.channel_id)} / {actorName(event)}</Text>
          <Badge tone={event.event_type.includes("deleted") || event.event_type.includes("reported") ? "amber" : "cyan"}>{dateLabel(event.created_at).split(",")[0]}</Badge>
        </View>
      </View>
      {event.message_body ? <Text style={styles.cardBody} numberOfLines={4}>{event.message_body}</Text> : null}
      {event.reason ? <Text style={styles.reasonText}>Reason: {event.reason}</Text> : null}
      <View style={styles.detailGrid}>
        <DetailCell label="Message" value={shortId(event.message_id)} mono />
        <DetailCell label="Target" value={shortId(event.target_user_id)} mono />
      </View>
    </Pressable>
  );
}

function ModerationActionCard({ action }: { action: AdminModerationAction }) {
  return (
    <View style={styles.rowCard}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarRed}><UserX color={colors.red} size={22} /></View>
        <View style={styles.fill}>
          <Text style={styles.rowTitle}>{label(action.action_type)}</Text>
          <Text style={styles.rowMeta}>{shortId(action.target_user_id || action.match_room_id)} / {dateLabel(action.created_at)}</Text>
          <Badge tone={severityTone(action.severity)}>{label(action.severity)}</Badge>
        </View>
      </View>
      <Text style={styles.cardBody}>{action.summary}</Text>
      <DetailCell label="Status" value={label(action.status)} />
    </View>
  );
}

function DmRequestRow({ request }: { request: ChatDmRequest }) {
  return (
    <View style={styles.compactRow}>
      <Text style={styles.compactTitle}>{requestName(request)} requested DM access</Text>
      <Text style={styles.compactMeta}>To {request.recipient_label || request.recipient_username || shortId(request.recipient_user_id)} / {label(request.status)} / {dateLabel(request.created_at)}</Text>
      {request.intro_message ? <Text style={styles.reasonText}>{request.intro_message}</Text> : null}
    </View>
  );
}

function DmBlockRow({ block }: { block: ChatUserBlock }) {
  return (
    <View style={styles.compactRow}>
      <Text style={styles.compactTitle}>{blockName(block)}</Text>
      <Text style={styles.compactMeta}>{dateLabel(block.created_at)}</Text>
      {block.reason ? <Text style={styles.reasonText}>Reason: {block.reason}</Text> : null}
    </View>
  );
}

function EvidenceEventCard({ event }: { event: EvidenceAccessEvent }) {
  return (
    <View style={styles.rowCard}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarGreen}><ShieldCheck color={colors.greenDark} size={22} /></View>
        <View style={styles.fill}>
          <Text style={styles.rowTitle}>{evidenceEventLabel(event.event)}</Text>
          <Text style={styles.rowMeta}>{event.actor_role || "Operator"} / {dateLabel(event.created_at)}</Text>
          <Badge tone={event.severity === "critical" ? "red" : event.severity === "warning" ? "amber" : "green"}>{label(event.severity)}</Badge>
        </View>
      </View>
      <View style={styles.detailGrid}>
        <DetailCell label="Actor" value={shortId(event.actor_user_id)} mono />
        <DetailCell label="Target" value={shortId(event.target_user_id)} mono />
        <DetailCell label="Request" value={shortId(event.request_id)} mono />
      </View>
    </View>
  );
}

function SmallAction({ icon, label: labelText, danger, disabled, loading, onPress }: { icon: ReactNode; label: string; danger?: boolean; disabled?: boolean; loading?: boolean; onPress: () => void }) {
  return (
    <Pressable disabled={disabled || loading} onPress={onPress} style={[styles.smallAction, danger && styles.smallActionDanger, (disabled || loading) && styles.disabled]}>
      {icon}
      <Text style={styles.smallActionText}>{loading ? "Saving..." : labelText}</Text>
    </Pressable>
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

function LabeledInput({
  label: labelText,
  optional,
  value,
  onChangeText,
  placeholder,
  multiline,
  minHeight,
  mono,
  secure
}: {
  label: string;
  optional?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  minHeight?: number;
  mono?: boolean;
  secure?: boolean;
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
        secureTextEntry={secure}
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
  playerButtonText: { color: colors.white, fontSize: 12, fontWeight: "900" },
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
  liveMeta: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: "800" },
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
  queueBlock: { gap: spacing.sm },
  rowCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: spacing.md, gap: spacing.md },
  selectedRow: { borderColor: colors.cyan, backgroundColor: "#f2fdff" },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  rowTitle: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: "900", flexShrink: 1 },
  rowMeta: { color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: "700", flexShrink: 1 },
  cardBody: { color: colors.ink, fontSize: 15, lineHeight: 23, fontWeight: "700" },
  reasonText: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.cyanSoft, alignItems: "center", justifyContent: "center" },
  avatarAmber: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff7da", alignItems: "center", justifyContent: "center" },
  avatarRed: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff0f3", alignItems: "center", justifyContent: "center" },
  avatarGreen: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  detailGrid: { gap: spacing.sm },
  detailCell: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  detailLabel: { color: colors.faint, fontSize: 11, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  detailValue: { marginTop: spacing.xs, color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: "800", flexShrink: 1 },
  monoText: { fontFamily: "monospace" },
  formStack: { gap: spacing.sm },
  formHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  formIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.cyanSoft, alignItems: "center", justifyContent: "center" },
  field: { gap: spacing.xs },
  inputLabel: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  optionalLabel: { marginTop: -4, color: colors.muted, fontSize: 13, fontWeight: "800" },
  input: { minHeight: 56, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, color: colors.ink, fontSize: 16, fontWeight: "700" },
  inputMono: { fontFamily: "monospace" },
  multilineInput: { paddingTop: spacing.md, paddingBottom: spacing.md, lineHeight: 23 },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { minHeight: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  chipTextActive: { color: colors.white },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  smallAction: { flex: 1, minHeight: 50, borderRadius: radius.md, backgroundColor: colors.navy, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  smallActionDanger: { backgroundColor: colors.red },
  smallActionText: { color: colors.white, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.sm },
  subhead: { color: colors.ink, fontSize: 16, fontWeight: "900", marginTop: spacing.xs },
  compactRow: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  compactTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  compactMeta: { marginTop: 3, color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  emptyState: { borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, padding: spacing.lg, alignItems: "center", gap: spacing.xs }
});
