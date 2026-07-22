import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { BadgeCheck, Banknote, Clock3, Copy, FileCheck2, KeyRound, Play, Radio, RefreshCw, Send, Share2, ShieldCheck, Trophy, Users } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { plainApiError } from "../../../api/errors";
import { profileTrustSummary } from "../../../api/profile";
import {
  createRoomInvite,
  getRoomFunding,
  getRoomResults,
  getRoomTimeline,
  joinRoom,
  listRoomLivestreams,
  openRoom,
  payRoomWithBalance,
  respondToResultClaim,
  startMatchPlay,
  submitManualFunding,
  submitResultClaim
} from "../../../api/rooms";
import { createLivestream } from "../../../api/streaming";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { CopyButton } from "../../../components/ui/CopyButton";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { OptionalFieldsPanel } from "../../../components/ui/OptionalFieldsPanel";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { openEvidenceInApp } from "../../evidence/openEvidence";
import { colors, radius, spacing } from "../../../constants/theme";
import { EvidenceUploadField } from "../../uploads/components/EvidenceUploadField";
import { NoStreamState, StreamAttachForm, StreamLinkCard } from "../../streaming/components/StreamCards";
import { PlayerTrustCard } from "../../trust/components/PlayerTrustCard";
import { useActionFeedback } from "../../../providers/ActionFeedbackProvider";
import { useAuthStore } from "../../../store/auth-store";
import type { ManualFundingSubmission, MatchParticipant, MatchResultClaim, MatchRoom, PlayerTrustSummary, RoomFundingOverview } from "../../../types/api";
import { roomIssueRulesFromRuleset } from "../roomIssueRules";

type Section = "overview" | "players" | "funding" | "live" | "result" | "history";
type RoomFocus = "section" | "players-list" | "funding-action" | "live-action" | "result-claim" | "result-response" | "history";
type Notice = { tone: "error" | "success" | "info"; message: string } | null;
type SectionNotice = { section: Section; notice: NonNullable<Notice> } | null;

const sections: Section[] = ["overview", "players", "funding", "live", "result", "history"];
const roomFocuses: RoomFocus[] = ["section", "players-list", "funding-action", "live-action", "result-claim", "result-response", "history"];
const collectionAccount = {
  bankName: "Opay",
  accountNumber: "8134979631",
  accountName: "Chizaram Anthony Chukwuka"
};

function validSection(value?: string | string[]) {
  const next = Array.isArray(value) ? value[0] : value;
  return sections.includes(next as Section) ? (next as Section) : null;
}

function validRoomFocus(value?: string | string[]) {
  const next = Array.isArray(value) ? value[0] : value;
  return roomFocuses.includes(next as RoomFocus) ? (next as RoomFocus) : null;
}

function money(minor?: number, currency = "NGN") {
  return `${currency} ${Math.round((minor ?? 0) / 100).toLocaleString()}`;
}

function sectionLabel(section: Section) {
  if (section === "live") return "Live";
  if (section === "funding") return "Entry";
  if (section === "history") return "Updates";
  return section[0].toUpperCase() + section.slice(1);
}

function statusLabel(status?: string, expired = false) {
  if (expired) return "Expired";
  if (status === "awaiting_funding") return "Entry needed";
  if (status === "funding_review") return "Entry review";
  if (status === "funded") return "Entry complete";
  if (status === "active") return "Live";
  if (status === "awaiting_results") return "Awaiting results";
  if (status === "under_review") return "Result review";
  if (status === "settlement_pending") return "Payout pending";
  if (status === "completed") return "Completed";
  if (status === "disputed") return "Disputed";
  return status === "open" ? "Open" : "Room";
}

function toneForStatus(status?: string, expired = false): "cyan" | "green" | "amber" | "red" | "dark" {
  if (expired) return "dark";
  if (status === "open" || status === "funded" || status === "active" || status === "completed") return "green";
  if (status === "awaiting_funding" || status === "funding_review" || status === "settlement_pending") return "amber";
  if (status === "disputed" || status === "voided" || status === "cancelled") return "red";
  return "cyan";
}

function nextAction(room?: MatchRoom, participantCount = 0, expired = false) {
  if (!room) return ["Loading room", "Checking the latest room details."] as const;
  if (expired) return ["Challenge expired", "This challenge window ended before another player accepted. Open it for history, or post a fresh challenge."] as const;
  if (room.status === "open") return participantCount < (room.max_participants ?? 2)
    ? (["Share the room code", "Send the room code to your opponent so they can join."] as const)
    : (["Entry is next", "Both players are in. Each entry must be confirmed before play."] as const);
  if (room.status === "awaiting_funding") return ["Complete your entry", "Use Skillsroom Balance or submit transfer proof. The room updates when your entry is confirmed."] as const;
  if (room.status === "funding_review") return ["Entry review", "A transfer or balance hold is being checked before play opens."] as const;
  if (room.status === "funded") return ["Confirm you are ready", "Both entries are confirmed. The match goes live after both players confirm."] as const;
  if (room.status === "active") return ["Submit result evidence", "After the match, submit the winner and proof for review."] as const;
  if (room.status === "awaiting_results") return ["Result needed", "A player should submit the winner and match proof."] as const;
  if (room.status === "under_review") return ["Review in progress", "Result evidence and responses are being checked."] as const;
  if (room.status === "disputed") return ["Dispute review", "The result is paused until the dispute is resolved."] as const;
  if (room.status === "settlement_pending") return ["Payout pending", "The winner is approved and payout handling is next."] as const;
  if (room.status === "completed") return ["Room complete", "This room is settled."] as const;
  return ["Room closed", "No player action is available for this room."] as const;
}

function participantLabel(participant?: MatchParticipant) {
  if (!participant) return "Open slot";
  if (participant.slot === "player_a") return "Player A";
  if (participant.slot === "player_b") return "Player B";
  return "Player";
}

function slotLabel(slot?: string) {
  if (slot === "player_a") return "Player A";
  if (slot === "player_b") return "Player B";
  return "Player";
}

function fundingStatusLabel(status?: string) {
  if (status === "submitted") return "Proof in review";
  if (status === "approved") return "Entry confirmed";
  if (status === "rejected") return "Needs correction";
  if (status === "refunded") return "Refunded";
  if (status === "cancelled") return "Cancelled";
  return "Pending";
}

function playerDisplayName(participant?: MatchParticipant, trust?: PlayerTrustSummary | null, currentUserId?: string) {
  if (!participant) return "Open slot";
  if (participant.user_id === currentUserId) return "You";
  return trust?.display_name || trust?.username || shortUser(participant.user_id);
}

function playerHandleLine(participant?: MatchParticipant, trust?: PlayerTrustSummary | null) {
  if (!participant) return "Waiting for player";
  if (trust?.primary_game_handle && trust.primary_game_external_uid) return `${trust.primary_game_handle} / ${trust.primary_game_external_uid}`;
  if (trust?.primary_game_handle) return trust.primary_game_handle;
  if (trust?.primary_game_external_uid) return `UID ${trust.primary_game_external_uid}`;
  return "No game handle shown";
}

function roomExpired(room?: MatchRoom | null) {
  const expiresAt = room?.expires_at;
  if (typeof expiresAt !== "string" && typeof expiresAt !== "number" && !(expiresAt instanceof Date)) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

function trustLabel(trust?: PlayerTrustSummary | null, loading = false) {
  if (!trust) return loading ? "Trust loading" : "Trust unavailable";
  if (trust.trust_level === "ready") return "Ready";
  if (trust.trust_level === "blocked") return "Blocked";
  if (trust.trust_level === "review") return "Review";
  if (trust.profile_complete) return "Profile ready";
  return "Setup incomplete";
}

function fundingMethodDetail(
  participant: MatchParticipant | undefined,
  submission: ManualFundingSubmission | undefined,
  funding: RoomFundingOverview | undefined
) {
  if (!participant) return { label: "Waiting", detail: "This slot has not been joined yet.", tone: "amber" as const };

  const escrowEntry = (funding?.ledger_entries ?? []).find((entry) => {
    const item = entry as Record<string, unknown>;
    return item.participant_id === participant.id && item.entry_type === "manual_funding_approved" && item.direction === "credit" && item.account_type === "match_escrow";
  }) as Record<string, unknown> | undefined;

  if (participant.funding_status === "approved" && escrowEntry?.source_type === "wallet_hold") {
    return { label: "Balance", detail: "Entry fee is locked from Skillsroom Balance.", tone: "green" as const };
  }
  if (participant.funding_status === "approved" && (submission?.status === "approved" || escrowEntry)) {
    return { label: "Manual transfer", detail: "Payment proof is approved for this room.", tone: "green" as const };
  }
  if (submission?.status === "submitted" || participant.funding_status === "submitted") {
    return { label: "Under review", detail: "Payment proof is waiting for Skillsroom review.", tone: "amber" as const };
  }
  if (submission?.status === "rejected" || participant.funding_status === "rejected") {
    return { label: "Needs correction", detail: "The last proof was rejected. Submit corrected proof.", tone: "red" as const };
  }
  if (participant.funding_status === "refunded") return { label: "Refunded", detail: "This entry has been returned.", tone: "amber" as const };
  return { label: "Not funded", detail: "Player still needs to pay the entry or upload payment proof.", tone: "amber" as const };
}

function fundingStatusTone(status?: string): "green" | "amber" | "red" {
  if (status === "approved") return "green";
  if (status === "rejected" || status === "cancelled") return "red";
  return "amber";
}

function shortUser(userId?: string) {
  if (!userId) return "Waiting for player";
  return userId.length > 12 ? `${userId.slice(0, 6)}...${userId.slice(-4)}` : userId;
}

function dateTimeLabel(value?: string | null) {
  if (!value) return "not set";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos"
  }).format(new Date(value));
}

function resultResponseWindowExpired(claim?: MatchResultClaim | null) {
  if (!claim) return false;
  if (claim.opponent_response_overdue_at) return true;
  const dueAt = claim.opponent_response_due_at ? new Date(claim.opponent_response_due_at).getTime() : Number.NaN;
  return Number.isFinite(dueAt) && dueAt <= Date.now();
}

function responseCountdown(claim?: MatchResultClaim | null) {
  if (!claim?.opponent_response_due_at) return "No response deadline shown";
  const due = new Date(claim.opponent_response_due_at).getTime();
  const diff = due - Date.now();
  if (!Number.isFinite(due)) return "No response deadline shown";
  if (diff <= 0) return "Response time is overdue";
  const minutes = Math.ceil(diff / 60000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  return `${Math.ceil(hours / 24)}d left`;
}

function resultStatusCopy(claim?: MatchResultClaim | null, room?: MatchRoom) {
  if (!claim) return { label: "Waiting for result", detail: "A player still needs to submit the winner, score, and proof.", tone: "amber" as const };
  if (claim.status === "opponent_agreed") return { label: "Opponent agreed", detail: "The result can move to final review and prize handling.", tone: "green" as const };
  if (claim.status === "opponent_disputed") return { label: "Dispute open", detail: "The result needs team review before a winner or refund decision.", tone: "red" as const };
  if (claim.status === "admin_approved") return { label: "Winner confirmed", detail: "A final result decision has been made.", tone: "green" as const };
  if (claim.status === "admin_rejected") return { label: "Result rejected", detail: "The result claim was not accepted after review.", tone: "red" as const };
  if (claim.status === "withdrawn") return { label: "Result withdrawn", detail: "The claim was withdrawn. A fresh result may be needed.", tone: "amber" as const };
  if (room?.status === "under_review") return { label: "Team review", detail: "Proof and responses are being checked.", tone: "amber" as const };
  if (room?.status === "disputed") return { label: "Dispute review", detail: "The room is paused while the dispute is reviewed.", tone: "red" as const };
  return { label: "Opponent response", detail: "Waiting for the other player to agree or dispute.", tone: "cyan" as const };
}

function latestReviewForClaim(reviews?: Array<Record<string, unknown>>, claim?: MatchResultClaim | null) {
  if (!claim) return null;
  const claimReviews = (reviews ?? []).filter((review) => review.result_claim_id === claim.id);
  return claimReviews[claimReviews.length - 1] ?? null;
}

function finalDecisionSummary(claim?: MatchResultClaim | null, room?: MatchRoom, reviews?: Array<Record<string, unknown>>) {
  const review = latestReviewForClaim(reviews, claim);
  if (typeof review?.note === "string" && review.note.trim()) return review.note;
  if (review?.decision === "opponent_timeout_awarded" || review?.decision === "approve_no_response") {
    return "Final decision: winner awarded after the opponent did not respond in time.";
  }
  if (review?.decision === "approve_claim") return "Final decision: winner confirmed after both players responded.";
  if (review?.decision === "reject_claim") return "Final decision: this result was not accepted after review.";
  if (review?.decision === "void_match") return "Final decision: match closed without a winner. Entries are being returned.";
  if (claim?.status === "admin_approved") return "Final decision: winner confirmed from the submitted proof.";
  if (claim?.status === "admin_rejected") return "Final decision: this result claim was rejected.";
  if (room?.status === "completed") return "Final decision is complete for this room.";
  if (room?.status === "settlement_pending") return "Final decision is ready for prize review.";
  if (room?.status === "refunded") return "Final decision: refund path was used.";
  if (room?.status === "voided") return "Final decision: match closed without a winner.";
  return "No final decision yet.";
}

function canManageStreams(userRole?: string, room?: MatchRoom, userId?: string) {
  if (!userId) return false;
  if (["support", "moderator", "admin", "owner"].includes(userRole ?? "")) return true;
  return room?.created_by_user_id === userId;
}

function latestClaim(claims?: MatchResultClaim[]) {
  return [...(claims ?? [])].sort((a, b) => Date.parse(String(b.created_at ?? b.updated_at ?? "")) - Date.parse(String(a.created_at ?? a.updated_at ?? "")))[0] ?? null;
}

function feedbackTitle(tone: NonNullable<Notice>["tone"], section: Section) {
  if (tone === "error") return "Room action failed";
  if (tone === "info") return "Room update";
  if (section === "funding") return "Entry updated";
  if (section === "live") return "Match updated";
  if (section === "result") return "Result updated";
  if (section === "players") return "Players updated";
  return "Room updated";
}

export function RoomDetailScreen() {
  const { matchId, section: sectionParam, focus: focusParam } = useLocalSearchParams<{ matchId?: string; section?: string; focus?: string }>();
  const roomId = String(matchId ?? "");
  const routedSection = validSection(sectionParam);
  const routedFocus = validRoomFocus(focusParam);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { pushFeedback } = useActionFeedback();
  const [section, setSection] = useState<Section>("overview");
  const [notice, setNotice] = useState<Notice>(null);
  const [sectionNotice, setSectionNotice] = useState<SectionNotice>(null);
  const [proofUrl, setProofUrl] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [scoreSummary, setScoreSummary] = useState("");
  const [resultNote, setResultNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [detailJoinCode, setDetailJoinCode] = useState("");
  const [localFundingSubmitted, setLocalFundingSubmitted] = useState(false);
  const [fundingUploadResetSignal, setFundingUploadResetSignal] = useState(0);
  const [resultUploadResetSignal, setResultUploadResetSignal] = useState(0);
  const promptedNextStep = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const focusLayouts = useRef<Partial<Record<RoomFocus, number>>>({});
  const lastScrolledFocus = useRef<string | null>(null);

  const timelineQuery = useQuery({ queryKey: ["room", roomId, "timeline"], queryFn: () => getRoomTimeline(roomId), enabled: Boolean(roomId), refetchInterval: 10000 });
  const fundingQuery = useQuery({ queryKey: ["room", roomId, "funding"], queryFn: () => getRoomFunding(roomId), enabled: Boolean(roomId), refetchInterval: 10000 });
  const resultsQuery = useQuery({ queryKey: ["room", roomId, "results"], queryFn: () => getRoomResults(roomId), enabled: Boolean(roomId), refetchInterval: 10000 });
  const livestreamsQuery = useQuery({ queryKey: ["room", roomId, "livestreams"], queryFn: () => listRoomLivestreams(roomId), enabled: Boolean(roomId), refetchInterval: 15000 });

  const room = timelineQuery.data?.room;
  const roomIssueRules = roomIssueRulesFromRuleset(room?.ruleset_rules);
  const participants = fundingQuery.data?.participants ?? timelineQuery.data?.participants ?? [];
  const startConfirmations = timelineQuery.data?.start_confirmations ?? [];
  const participantUserIds = useMemo(
    () => Array.from(new Set(participants.map((participant) => participant.user_id).filter(Boolean))),
    [participants]
  );
  const trustQuery = useQuery({
    queryKey: ["room", roomId, "participant-trust", participantUserIds],
    queryFn: async () => {
      const entries = await Promise.all(
        participantUserIds.map(async (userId) => {
          try {
            return [userId, await profileTrustSummary(userId)] as const;
          } catch {
            return [userId, null] as const;
          }
        })
      );
      return Object.fromEntries(entries) as Record<string, PlayerTrustSummary | null>;
    },
    enabled: Boolean(roomId && participantUserIds.length)
  });
  const ownParticipant = participants.find((participant) => participant.user_id === user?.id);
  const claim = latestClaim(resultsQuery.data?.claims);
  const participantCount = room?.participant_count ?? participants.length;
  const isExpiredOpenRoom = Boolean(room?.status === "open" && roomExpired(room));
  const [actionTitle, actionBody] = nextAction(room, participantCount, isExpiredOpenRoom);
  const canAttachStream = canManageStreams(user?.role, room, user?.id);
  const isCreator = Boolean(user?.id && room?.creator_user_id === user.id);
  const canManageRoomInvites = Boolean(isCreator || ["moderator", "admin", "owner"].includes(String(user?.role ?? "")));
  const canInvite = Boolean(room?.status === "open" && !isExpiredOpenRoom && canManageRoomInvites && participantCount < (room?.max_participants ?? 2));
  const canJoinFromDetail = Boolean(room?.status === "open" && !isExpiredOpenRoom && !ownParticipant && participantCount < (room?.max_participants ?? 2));
  const ownFundingSubmission = useMemo(() => {
    const submissions = fundingQuery.data?.submissions ?? [];
    return submissions.find((submission) => {
      if (ownParticipant?.id && submission.participant_id === ownParticipant.id) return true;
      if (user?.id && submission.user_id === user.id) return true;
      return false;
    });
  }, [fundingQuery.data?.submissions, ownParticipant?.id, user?.id]);
  const ownFundingStatus = String(ownParticipant?.funding_status ?? ownFundingSubmission?.status ?? "");
  const ownEntryApproved = ownFundingStatus === "approved" || ownFundingSubmission?.status === "approved";
  const ownEntrySubmitted = localFundingSubmitted || ownFundingStatus === "submitted" || ownFundingSubmission?.status === "submitted";
  const canSubmitOwnFunding = Boolean(
    ownParticipant &&
    ["awaiting_funding", "funding_review"].includes(String(room?.status)) &&
    !ownEntryApproved &&
    !ownEntrySubmitted
  );
  const canSubmitManualFunding = canSubmitOwnFunding && Boolean(proofUrl.trim() && senderName.trim() && senderBank.trim());
  const needsOwnEntry = Boolean(
    ownParticipant &&
    ["awaiting_funding", "funding_review"].includes(String(room?.status)) &&
    !["approved", "submitted"].includes(ownFundingStatus)
  );
  const joinedParticipants = participants.filter((participant) => participant.participant_status === "joined");
  const ownStartConfirmed = Boolean(
    ownParticipant && startConfirmations.some((confirmation) => confirmation.participant_id === ownParticipant.id)
  );
  const waitingForOpponentStart = Boolean(
    ownParticipant &&
    room?.status === "funded" &&
    ownStartConfirmed &&
    startConfirmations.length < joinedParticipants.length
  );
  const canStartMatch = Boolean(ownParticipant && room?.status === "funded" && !ownStartConfirmed);
  const canSubmitRoomResult = Boolean(ownParticipant && ["active", "awaiting_results"].includes(String(room?.status)));
  const canRespondToResult = Boolean(
    claim &&
    ownParticipant &&
    ["submitted"].includes(String(claim.status)) &&
    claim.claimant_user_id !== user?.id &&
    claim.submitted_by_user_id !== user?.id &&
    claim.claimant_participant_id !== ownParticipant.id &&
    claim.submitted_by_participant_id !== ownParticipant.id &&
    claim.claimed_winner_participant_id !== ownParticipant.id
  );
  const isOwnResultClaim = Boolean(
    claim &&
    user?.id &&
    (claim.claimant_user_id === user.id || claim.submitted_by_user_id === user.id)
  );
  const resultResponseExpired = resultResponseWindowExpired(claim);
  const inviteCopy = room?.room_code ? `Join my Skillsroom room with code ${room.room_code}.` : null;
  const playerSlots = useMemo(() => {
    const baseSlots = ["player_a", "player_b"];
    const slots = baseSlots.slice(0, Math.max(room?.max_participants ?? 2, 2));
    return slots.map((slot) => ({
      slot,
      participant: participants.find((participant) => participant.slot === slot)
    }));
  }, [participants, room?.max_participants]);
  const fundedCount = participants.filter((participant) => participant.funding_status === "approved").length;

  const notify = (targetSection: Section, nextNotice: NonNullable<Notice>, focusSection = false) => {
    setNotice(nextNotice);
    setSectionNotice({ section: targetSection, notice: nextNotice });
    pushFeedback({
      tone: nextNotice.tone,
      title: feedbackTitle(nextNotice.tone, targetSection),
      message: nextNotice.message
    });
    if (focusSection) setSection(targetSection);
  };

  const activeSectionNotice = sectionNotice?.section === section ? sectionNotice.notice : null;
  const focusKey = routedFocus ? `${roomId}:${section}:${routedFocus}` : null;

  const scrollToFocus = (focus: RoomFocus) => {
    const y = focusLayouts.current[focus] ?? focusLayouts.current.section;
    if (y === undefined || !focusKey || lastScrolledFocus.current === focusKey) return;
    lastScrolledFocus.current = focusKey;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.md), animated: true });
    }, 120);
  };

  const registerFocusLayout = (focus: RoomFocus, parent?: RoomFocus) => (event: LayoutChangeEvent) => {
    const parentY = parent ? focusLayouts.current[parent] ?? 0 : 0;
    focusLayouts.current[focus] = parentY + event.nativeEvent.layout.y;
    if (routedFocus === focus || (routedFocus === "section" && focus === "section")) {
      scrollToFocus(focus);
    }
  };

  useEffect(() => {
    if (!roomId || !routedSection) return;
    promptedNextStep.current = `${roomId}:explicit:${routedSection}`;
    setSection(routedSection);
  }, [roomId, routedSection]);

  useEffect(() => {
    if (!roomId || routedSection) return;
    const promptKey = `${roomId}:${room?.status ?? "loading"}:${claim?.id ?? "none"}`;
    if (promptedNextStep.current === promptKey) return;

    if (needsOwnEntry) {
      promptedNextStep.current = promptKey;
      setSection("funding");
      return;
    }
    if (canStartMatch) {
      promptedNextStep.current = promptKey;
      setSection("live");
      return;
    }
    if (canSubmitRoomResult || canRespondToResult) {
      promptedNextStep.current = promptKey;
      setSection("result");
    }
  }, [canRespondToResult, canStartMatch, canSubmitRoomResult, claim?.id, needsOwnEntry, room?.status, roomId, routedSection]);

  useEffect(() => {
    if (!routedFocus) return;
    lastScrolledFocus.current = null;
    setTimeout(() => scrollToFocus(routedFocus), 160);
  }, [focusKey, routedFocus]);

  useEffect(() => {
    setLocalFundingSubmitted(false);
  }, [roomId]);

  useEffect(() => {
    if (ownFundingStatus === "rejected") setLocalFundingSubmitted(false);
  }, [ownFundingStatus]);

  const refreshRoom = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["rooms"] }),
      queryClient.invalidateQueries({ queryKey: ["room", roomId] })
    ]);
  };

  const openMutation = useMutation({
    mutationFn: () => openRoom(roomId),
    onSuccess: async () => {
      notify("overview", { tone: "success", message: "Room opened. Share the code with your opponent." }, true);
      await refreshRoom();
    },
    onError: (error) => notify("overview", { tone: "error", message: plainApiError(error, "Could not open room.") }, true)
  });

  const inviteMutation = useMutation({
    mutationFn: () => {
      if (!inviteUsername.trim()) throw new Error("Enter the Skillsroom username to invite.");
      return createRoomInvite({
        match_room_id: roomId,
        invitee_username: inviteUsername.trim(),
        message: inviteMessage.trim() || undefined
      });
    },
    onSuccess: async () => {
      notify("overview", { tone: "success", message: `Invite sent to ${inviteUsername.trim()}.` });
      setInviteUsername("");
      setInviteMessage("");
      await refreshRoom();
    },
    onError: (error) => notify("overview", { tone: "error", message: plainApiError(error, "Could not send invite.") })
  });

  const detailJoinMutation = useMutation({
    mutationFn: () => {
      const roomCode = detailJoinCode.trim().toUpperCase();
      if (roomCode.length < 4) throw new Error("Paste the room code your opponent shared.");
      return joinRoom(roomCode);
    },
    onSuccess: async (result) => {
      setDetailJoinCode("");
      setSection("funding");
      notify("funding", { tone: "success", message: `Joined ${result.room?.room_code ?? "the room"}. Choose balance payment or upload transfer proof below.` }, true);
      await refreshRoom();
      if (result.room?.id && result.room.id !== roomId) router.push(`/(app)/rooms/${result.room.id}`);
    },
    onError: (error) => notify("overview", { tone: "error", message: plainApiError(error, "Could not join room.") })
  });

  const balanceMutation = useMutation({
    mutationFn: () => payRoomWithBalance(roomId),
    onSuccess: async (result) => {
      queryClient.setQueryData<RoomFundingOverview | undefined>(["room", roomId, "funding"], (current) => {
        if (!current) return current;
        const nextParticipants = current.participants.map((participant) =>
          participant.id === result.participant.id ? { ...participant, funding_status: "approved" } : participant
        );
        return { ...current, participants: nextParticipants };
      });
      notify("funding", { tone: "success", message: "Your entry fee is held from Skillsroom Balance. The room will update when both players are ready." });
      await Promise.all([
        refreshRoom(),
        queryClient.invalidateQueries({ queryKey: ["room", roomId, "funding"] })
      ]);
    },
    onError: (error) => notify("funding", { tone: "error", message: plainApiError(error, "Could not pay with balance.") })
  });

  const manualFundingMutation = useMutation({
    mutationFn: () => {
      if (!room) throw new Error("Room is still loading.");
      if (!proofUrl.trim()) throw new Error("Add a proof link before submitting transfer proof.");
      if (!senderName.trim() || !senderBank.trim()) throw new Error("Add the sender account name and bank.");
      return submitManualFunding(roomId, {
        amount_minor: room.entry_amount_minor ?? 0,
        collection_bank_name: collectionAccount.bankName,
        collection_account_number: collectionAccount.accountNumber,
        collection_account_name: collectionAccount.accountName,
        transfer_reference: transferReference.trim() || undefined,
        sender_account_name: senderName.trim(),
        sender_bank_name: senderBank.trim(),
        proof_url: proofUrl.trim(),
        proof_note: proofNote.trim() || undefined
      });
    },
    onSuccess: async (submission) => {
      queryClient.setQueryData<RoomFundingOverview | undefined>(["room", roomId, "funding"], (current) => {
        if (!current) return current;
        const submissions = current.submissions ?? [];
        const nextSubmissions = submissions.some((item) => item.id === submission.id)
          ? submissions.map((item) => (item.id === submission.id ? submission : item))
          : [submission, ...submissions.filter((item) => item.participant_id !== submission.participant_id)];
        const nextParticipants = current.participants.map((participant) =>
          participant.id === submission.participant_id ? { ...participant, funding_status: "submitted" } : participant
        );
        return { ...current, submissions: nextSubmissions, participants: nextParticipants };
      });
      notify("funding", { tone: "success", message: "Entry proof submitted. Wait for Skillsroom review before sending anything again." });
      setLocalFundingSubmitted(true);
      setProofUrl("");
      setProofNote("");
      setTransferReference("");
      setFundingUploadResetSignal((value) => value + 1);
      await Promise.all([
        refreshRoom(),
        queryClient.invalidateQueries({ queryKey: ["room", roomId, "funding"] })
      ]);
    },
    onError: (error) => notify("funding", { tone: "error", message: plainApiError(error, "Could not submit entry proof.") })
  });

  const startMutation = useMutation({
    mutationFn: () => startMatchPlay(roomId),
    onSuccess: async (updatedRoom) => {
      if (updatedRoom.status === "active") {
        setSection("result");
        notify("result", { tone: "success", message: "Both players confirmed. Submit result evidence when play is done." }, true);
      } else {
        setSection("live");
        notify("live", { tone: "success", message: "Ready confirmed. Waiting for the other player before the match goes live." }, true);
      }
      await refreshRoom();
    },
    onError: (error) => notify("live", { tone: "error", message: plainApiError(error, "Could not confirm ready status.") })
  });

  const resultMutation = useMutation({
    mutationFn: () => {
      if (!ownParticipant?.id) throw new Error("Only room players can submit result evidence.");
      const evidenceType: "screenshot" | "video" | "link" = evidenceUrl.includes("/api/evidence-files/evidence-v1_") && evidenceUrl.match(/\.(mp4|webm|mov)$/i)
        ? "video"
        : evidenceUrl.includes("/api/evidence-files/evidence-v1_")
          ? "screenshot"
          : "link";
      const evidence = evidenceUrl.trim()
        ? [{ evidence_type: evidenceType, uri: evidenceUrl.trim(), title: "Match result evidence", notes: resultNote.trim() || undefined }]
        : [{ evidence_type: "note" as const, title: "Match result note", notes: resultNote.trim() || scoreSummary.trim() || "Result submitted from mobile." }];
      return submitResultClaim(roomId, {
        claimed_winner_participant_id: ownParticipant.id,
        score_summary: scoreSummary.trim() || undefined,
        note: resultNote.trim() || undefined,
        evidence
      });
    },
    onSuccess: async () => {
      notify("result", { tone: "success", message: "Result submitted. It will update after response or review." });
      setEvidenceUrl("");
      setResultNote("");
      setScoreSummary("");
      setResultUploadResetSignal((value) => value + 1);
      await refreshRoom();
    },
    onError: (error) => notify("result", { tone: "error", message: plainApiError(error, "Could not submit result.") })
  });

  const streamMutation = useMutation({
    mutationFn: (input: { title: string; stream_url: string; provider?: "youtube" | "twitch" | "tiktok"; visibility: "public" | "participants"; stream_role: "official" | "player_a" | "player_b" }) =>
      createLivestream({
        target_type: "match_room",
        match_room_id: roomId,
        playback_status: "live",
        ...input
      }),
    onSuccess: async () => {
      notify("live", { tone: "success", message: "Stream link attached. Viewers can open it from the Live section." });
      await queryClient.invalidateQueries({ queryKey: ["room", roomId, "livestreams"] });
    },
    onError: (error) => notify("live", { tone: "error", message: plainApiError(error, "Could not attach stream link.") })
  });

  const responseMutation = useMutation({
    mutationFn: (response: "agree" | "dispute") => {
      if (!claim?.id) throw new Error("There is no result claim to respond to.");
      return respondToResultClaim(claim.id, { response, note: responseNote.trim() || undefined });
    },
    onSuccess: async () => {
      notify("result", { tone: "success", message: "Response submitted. The room will update after review." });
      setResponseNote("");
      await refreshRoom();
    },
    onError: (error) => notify("result", { tone: "error", message: plainApiError(error, "Could not respond to result.") })
  });

  const fundingByParticipant = useMemo(() => {
    const submissions = fundingQuery.data?.submissions ?? [];
    return new Map(participants.map((participant) => [
      participant.id,
      submissions.find((submission) => submission.participant_id === participant.id || submission.user_id === participant.user_id)
    ]));
  }, [fundingQuery.data?.submissions, participants]);

  if (!roomId) {
    return <FeedbackState tone="error" title="Room missing" body="Open this room again from the lobby." />;
  }

  return (
    <AppScreen scrollRef={scrollRef}>
      <SurfaceCard dark>
        <View style={styles.heroTop}>
          <Badge tone="dark">Room Detail</Badge>
          <Pressable style={styles.refreshButton} onPress={() => void refreshRoom()}>
            <RefreshCw size={20} color={colors.white} />
          </Pressable>
        </View>
        <Text style={styles.heroTitle}>{room?.title ?? "Skillsroom match"}</Text>
        <Text style={styles.heroCopy}>{room?.room_code ? `Code ${room.room_code}` : "Loading room code..."} / {money(room?.entry_amount_minor, room?.currency)} / Players {participantCount}/{room?.max_participants ?? 2}</Text>
        <View style={styles.heroMetricGrid}>
          <DarkMetric icon={ShieldCheck} label="Status" value={statusLabel(room?.status, isExpiredOpenRoom)} />
          <DarkMetric icon={Users} label="Slots" value={`${participantCount}/${room?.max_participants ?? 2}`} />
          <DarkMetric icon={Banknote} label="Entry" value={money(room?.entry_amount_minor, room?.currency)} />
        </View>
      </SurfaceCard>

      {timelineQuery.isError ? <FeedbackState tone="error" title="Room unavailable" body="We could not load this room." actionLabel="Back to rooms" onAction={() => router.back()} /> : null}
      {notice && !activeSectionNotice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

      <SurfaceCard>
        <Badge tone={toneForStatus(room?.status, isExpiredOpenRoom)}>{statusLabel(room?.status, isExpiredOpenRoom)}</Badge>
        <Text style={styles.sectionTitle}>{actionTitle}</Text>
        <Text style={styles.copy}>{actionBody}</Text>
        {room?.status === "draft" && isCreator ? <AppButton loading={openMutation.isPending} onPress={() => openMutation.mutate()}>Open room</AppButton> : null}
        {needsOwnEntry ? <AppButton onPress={() => setSection("funding")}>Complete entry</AppButton> : null}
        {canStartMatch ? <AppButton onPress={() => setSection("live")}>Confirm ready</AppButton> : null}
        {waitingForOpponentStart ? <AppButton variant="secondary" onPress={() => setSection("live")}>Waiting on opponent</AppButton> : null}
        {canSubmitRoomResult ? <AppButton onPress={() => setSection("result")}>Submit result</AppButton> : null}
        {canRespondToResult ? <AppButton onPress={() => setSection("result")}>Respond to result</AppButton> : null}
        <View style={styles.quickActions}>
          <QuickAction icon={Copy} label="Code" value={room?.room_code ?? "..."} copyValue={room?.room_code} />
          <QuickAction icon={Share2} label="Invite" value="Copy text" copyValue={inviteCopy} copiedLabel="Invite copied" />
          <QuickAction icon={FileCheck2} label="Updates" value={(timelineQuery.data?.events?.length ?? 0).toString()} />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Badge tone="green">Process</Badge>
        <Text style={styles.sectionTitle}>Room progress</Text>
        <RoomFlow currentStatus={room?.status} expired={isExpiredOpenRoom} />
      </SurfaceCard>

      <View style={styles.sectionNav}>
        {sections.map((item) => (
          <Pressable key={item} onPress={() => setSection(item)} style={[styles.sectionButton, section === item && styles.sectionButtonOn]}>
            <Text style={[styles.sectionButtonText, section === item && styles.sectionButtonTextOn]}>{sectionLabel(item)}</Text>
          </Pressable>
        ))}
      </View>

      {section === "overview" ? (
        <View onLayout={registerFocusLayout("section")}>
          <SurfaceCard>
            <Badge>Room code</Badge>
            {activeSectionNotice ? <FormNotice tone={activeSectionNotice.tone} message={activeSectionNotice.message} /> : null}
            <Text style={styles.bigCode}>{room?.room_code ?? "..."}</Text>
            <CopyButton value={room?.room_code} label="Copy room code" copiedLabel="Room code copied" />
            <Text style={styles.copy}>Share this code with your opponent. The room will show when they join, complete entry, and submit a result.</Text>
            {isExpiredOpenRoom ? (
              <FormNotice tone="info" message="This challenge window has ended. Post a fresh challenge or create a new room before another player joins." />
            ) : null}
            {canManageRoomInvites ? (
              <View style={styles.inviteBox}>
                <Text style={styles.itemTitle}>Invite by username</Text>
                <Text style={styles.copy}>Send a direct room invite to a Skillsroom username. They can accept it from Notifications.</Text>
                <TextInput
                  value={inviteUsername}
                  onChangeText={setInviteUsername}
                  autoCapitalize="none"
                  editable={canInvite}
                  placeholder="player_username"
                  placeholderTextColor={colors.faint}
                  style={[styles.input, !canInvite && styles.inputDisabled]}
                />
                <TextInput
                  value={inviteMessage}
                  onChangeText={setInviteMessage}
                  editable={canInvite}
                  placeholder={`Join ${room?.room_code ?? "my room"} on Skillsroom.`}
                  placeholderTextColor={colors.faint}
                  style={[styles.input, !canInvite && styles.inputDisabled]}
                />
                <AppButton disabled={!canInvite} loading={inviteMutation.isPending} onPress={() => inviteMutation.mutate()}>Send invite</AppButton>
                {isExpiredOpenRoom ? (
                  <Text style={styles.helpText}>This challenge window has ended. Create a new room before inviting another player.</Text>
                ) : room?.status !== "open" ? (
                  <Text style={styles.helpText}>Open the room before inviting another player.</Text>
                ) : participantCount >= (room?.max_participants ?? 2) ? (
                  <Text style={styles.helpText}>This room already has all players.</Text>
                ) : (
                  <Text style={styles.helpText}>Room code sharing still works. Direct invite is best when you already know the player.</Text>
                )}
              </View>
            ) : null}
          </SurfaceCard>
          <SurfaceCard>
            <Badge tone="cyan">Game lobby</Badge>
            <Text style={styles.sectionTitle}>How to connect in-game</Text>
            <InstructionStep index="1" title="Copy opponent identity" detail="Use the game handle or UID from their profile, not an email address." />
            <InstructionStep index="2" title="Create game lobby" detail="One player creates the private game lobby and shares the in-game room code if needed." />
            <InstructionStep index="3" title="Capture proof" detail="Screenshot the lobby and final scoreboard. Keep usernames visible." />
            <InstructionStep index="4" title="Wait for ready status" detail="Do not play until the room says the match is ready." />
          </SurfaceCard>
          <SurfaceCard>
            <Badge tone="cyan">Fair play rules</Badge>
            <Text style={styles.sectionTitle}>When play does not go cleanly</Text>
            <Text style={styles.copy}>These room rules cover late opponents, no-shows, disconnects, timeouts, and proof that cannot be verified.</Text>
            <View style={styles.ruleGrid}>
              {roomIssueRules.map((rule) => (
                <View key={rule.key} style={styles.ruleCard}>
                  <Text style={styles.ruleTitle}>{rule.title}</Text>
                  <Text style={styles.ruleBody}>{rule.body}</Text>
                </View>
              ))}
            </View>
          </SurfaceCard>
          {canJoinFromDetail ? (
            <SurfaceCard>
              <Badge tone="green">Join room</Badge>
              <Text style={styles.sectionTitle}>Paste room code</Text>
              <Text style={styles.copy}>If this is the room your opponent shared, paste the code here to claim the open slot.</Text>
              <View style={styles.joinCodeShell}>
                <KeyRound size={22} color={colors.cyan} />
                <TextInput
                  value={detailJoinCode}
                  onChangeText={(value) => setDetailJoinCode(value.replace(/\s+/g, "").toUpperCase())}
                  autoCapitalize="characters"
                  placeholder={room?.room_code ?? "ROOMCODE"}
                  placeholderTextColor={colors.faint}
                  style={styles.joinCodeInput}
                />
              </View>
              <FormNotice tone="info" message="Joining adds you to this room. Entry confirmation still happens after both players are in." />
              <AppButton loading={detailJoinMutation.isPending} disabled={!detailJoinCode.trim()} onPress={() => detailJoinMutation.mutate()}>Join this room</AppButton>
            </SurfaceCard>
          ) : null}
        </View>
      ) : null}

      {section === "players" ? (
        <View onLayout={registerFocusLayout("players-list")}>
          <SurfaceCard>
            <Badge>Players</Badge>
            <Text style={styles.sectionTitle}>Room players</Text>
            <Text style={styles.copy}>Confirm who is in the room before entry, play, or result evidence. Use the game handle/UID shown here for the in-game lobby.</Text>
            {trustQuery.isFetching ? <Text style={styles.helpText}>Loading player identity...</Text> : null}
            {playerSlots.map(({ slot, participant }) => {
              const trust = participant ? trustQuery.data?.[participant.user_id] : null;
              const isYou = Boolean(participant && participant.user_id === user?.id);
              return (
                <View key={participant?.id ?? slot} style={styles.playerCard}>
                  <View style={styles.playerCardHeader}>
                    <View style={styles.fill}>
                      <Text style={styles.quickLabel}>{slotLabel(participant?.slot ?? slot)}</Text>
                      <Text style={styles.itemTitle}>{playerDisplayName(participant, trust, user?.id)}</Text>
                    </View>
                    <Badge tone={participant ? "green" : "amber"}>{participant ? (isYou ? "You" : "Opponent") : "Open"}</Badge>
                  </View>
                  <View style={styles.detailList}>
                    <DetailRow label="Game identity" value={playerHandleLine(participant, trust)} />
                    <DetailRow label="Trust" value={trustLabel(trust, trustQuery.isFetching)} />
                    <DetailRow label="Entry" value={participant ? fundingStatusLabel(participant.funding_status) : "Waiting"} />
                    <DetailRow label="User ref" value={participant ? shortUser(participant.user_id) : "Share the room code"} />
                  </View>
                  {trust ? <PlayerTrustCard compact trust={trust} /> : null}
                </View>
              );
            })}
            {participants.length < (room?.max_participants ?? 2) ? <FormNotice tone="info" message="An open slot remains. Share the room code with your opponent." /> : null}
            <SurfaceCard style={styles.embeddedCard}>
              <Badge tone="cyan">Player safety</Badge>
              <Text style={styles.copy}>Payment proof, result evidence, and private review notes stay visible only to the players involved and the Skillsroom team.</Text>
            </SurfaceCard>
          </SurfaceCard>
        </View>
      ) : null}

      {section === "funding" ? (
        <View onLayout={registerFocusLayout("funding-action")}>
        <SurfaceCard>
          <Badge tone="amber">Entry</Badge>
          <Text style={styles.sectionTitle}>Entry confirmation</Text>
          {activeSectionNotice ? <FormNotice tone={activeSectionNotice.tone} message={activeSectionNotice.message} /> : null}
          {needsOwnEntry ? <FormNotice tone="info" message={`Next step: confirm your ${money(room?.entry_amount_minor, room?.currency)} entry with Skillsroom Balance or transfer proof.`} /> : null}
          {needsOwnEntry || ownEntrySubmitted || ownEntryApproved ? (
            <FormNotice tone="info" message="Add your payout account on Profile before result review so approved winnings can be paid quickly." />
          ) : null}
          {ownEntrySubmitted && !ownEntryApproved ? (
            <FormNotice tone="success" message="Your transfer proof is under review. You do not need to submit again unless Skillsroom asks for a correction." />
          ) : null}
          {ownEntryApproved ? (
            <FormNotice tone="success" message={room?.status === "funded" ? "Both entries are confirmed. Start play when both players are ready." : "Your entry is confirmed. We are waiting for the other player or the next room step."} />
          ) : null}
          {ownFundingStatus === "rejected" ? (
            <FormNotice tone="error" message="Your last transfer proof needs correction. Upload a clearer proof or update the transfer details below." />
          ) : null}
          {fundingQuery.isError ? <FormNotice tone="info" message="Entry details are only visible to room participants." /> : null}
          <View style={styles.summaryGrid}>
            <View style={styles.summaryTile}>
              <Text style={styles.quickLabel}>Entry</Text>
              <Text style={styles.summaryValue}>{money(room?.entry_amount_minor, room?.currency)}</Text>
              <Text style={styles.copy}>Equal amount for both players</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.quickLabel}>Confirmed</Text>
              <Text style={styles.summaryValue}>{fundedCount}/{room?.max_participants ?? 2}</Text>
              <Text style={styles.copy}>Approved entries</Text>
            </View>
          </View>
          {playerSlots.map(({ slot, participant }) => {
            const trust = participant ? trustQuery.data?.[participant.user_id] : null;
            const submission = participant ? fundingByParticipant.get(participant.id) : undefined;
            const participantFundingStatus = String(participant?.funding_status ?? submission?.status ?? "pending");
            const method = fundingMethodDetail(participant, submission, fundingQuery.data);
            return (
              <View key={participant?.id ?? slot} style={styles.playerCard}>
                <View style={styles.playerCardHeader}>
                  <View style={styles.fill}>
                    <Text style={styles.quickLabel}>{slotLabel(participant?.slot ?? slot)}</Text>
                    <Text style={styles.itemTitle}>{playerDisplayName(participant, trust, user?.id)}</Text>
                    <Text style={styles.copy}>{playerHandleLine(participant, trust)}</Text>
                  </View>
                  <Badge tone={method.tone}>{method.label}</Badge>
                </View>
                <Text style={styles.copy}>{method.detail}</Text>
                <View style={styles.detailList}>
                  <DetailRow label="Entry amount" value={money(room?.entry_amount_minor, room?.currency)} />
                  <DetailRow label="Entry status" value={fundingStatusLabel(participantFundingStatus)} />
                  <DetailRow label="Proof" value={submission?.status ? fundingStatusLabel(submission.status) : "No proof shown"} />
                </View>
                {trust ? <PlayerTrustCard compact trust={trust} /> : null}
              </View>
            );
          })}
          {canSubmitOwnFunding ? (
            <>
              <AppButton loading={balanceMutation.isPending} onPress={() => balanceMutation.mutate()}>Pay with balance</AppButton>
              <FormNotice tone="info" message={`Manual transfer: ${collectionAccount.bankName} ${collectionAccount.accountNumber}, ${collectionAccount.accountName}. Upload payment proof or paste a proof link.`} />
              <TextInput value={senderName} onChangeText={setSenderName} placeholder="Sender account name" placeholderTextColor={colors.faint} style={styles.input} />
              <TextInput value={senderBank} onChangeText={setSenderBank} placeholder="Sender bank" placeholderTextColor={colors.faint} style={styles.input} />
              <EvidenceUploadField contextType="match_room" contextId={roomId} label="Entry proof upload" disabled={manualFundingMutation.isPending} resetSignal={fundingUploadResetSignal} onUploaded={(evidence) => setProofUrl(evidence.url)} />
              <OptionalFieldsPanel title="Optional transfer details" helper="Add only if your receipt has a reference, link, or note that helps review.">
                <TextInput value={transferReference} onChangeText={setTransferReference} placeholder="Transfer reference" placeholderTextColor={colors.faint} style={styles.input} />
                <TextInput value={proofUrl} onChangeText={setProofUrl} autoCapitalize="none" keyboardType="url" placeholder="Proof link" placeholderTextColor={colors.faint} style={styles.input} />
                <TextInput value={proofNote} onChangeText={setProofNote} placeholder="Proof note" placeholderTextColor={colors.faint} style={styles.input} />
              </OptionalFieldsPanel>
              <AppButton
                disabled={!canSubmitManualFunding}
                loading={manualFundingMutation.isPending}
                loadingLabel="Submitting proof..."
                onPress={() => manualFundingMutation.mutate()}
              >
                Submit proof for review
              </AppButton>
              {!canSubmitManualFunding ? (
                <Text style={styles.helpText}>Add sender name, sender bank, and uploaded proof before submitting.</Text>
              ) : null}
            </>
          ) : null}
          {!ownParticipant ? <FormNotice tone="info" message="Only room participants can submit entry proof for this room." /> : null}
        </SurfaceCard>
        </View>
      ) : null}

      {section === "live" ? (
        <View onLayout={registerFocusLayout("live-action")}>
        <SurfaceCard>
          <Badge tone="green">Live</Badge>
          <Text style={styles.sectionTitle}>Streams and play</Text>
          {activeSectionNotice ? <FormNotice tone={activeSectionNotice.tone} message={activeSectionNotice.message} /> : null}
          {canStartMatch ? <AppButton loading={startMutation.isPending} loadingLabel="Confirming..." onPress={() => startMutation.mutate()}>Confirm ready</AppButton> : null}
          {waitingForOpponentStart ? <FormNotice tone="success" message="Your ready status is confirmed. The match will go live after the other player confirms." /> : null}
          <FormNotice tone="info" message="Play only when the room says it is live. Streams can be official, Player A, or Player B links." />
          {livestreamsQuery.data?.length ? livestreamsQuery.data.map((stream) => <StreamLinkCard key={stream.id} stream={stream} />) : <NoStreamState target="room" />}
          <StreamAttachForm target="room" canAttach={canAttachStream} loading={streamMutation.isPending} onSubmit={(input) => streamMutation.mutate(input)} />
        </SurfaceCard>
        </View>
      ) : null}

      {section === "result" ? (
        <View onLayout={registerFocusLayout("result-claim")}>
        <SurfaceCard>
          <Badge tone="cyan">Result</Badge>
          <Text style={styles.sectionTitle}>Match result</Text>
          {activeSectionNotice ? <FormNotice tone={activeSectionNotice.tone} message={activeSectionNotice.message} /> : null}
          {resultsQuery.isError ? <FormNotice tone="info" message="Result details are only visible to room participants." /> : null}
          <ResultReviewPanel claim={claim} room={room} evidenceCount={resultsQuery.data?.evidence_items?.length ?? 0} />
          {claim?.status === "submitted" && canRespondToResult ? (
            <FormNotice
              tone={resultResponseExpired ? "error" : "info"}
              message={resultResponseExpired
                ? "Your response window is overdue. You can still try to agree or dispute while the team has not reviewed the claim."
                : `Respond by ${dateTimeLabel(claim.opponent_response_due_at)}. Agree if the result is correct, or dispute if it needs review.`}
            />
          ) : null}
          {claim?.status === "submitted" && isOwnResultClaim ? (
            <FormNotice
              tone={resultResponseExpired ? "info" : "success"}
              message={resultResponseExpired
                ? "The opponent response window is overdue. Skillsroom can now review this under the no-response policy."
                : `Waiting for opponent response until ${dateTimeLabel(claim.opponent_response_due_at)}.`}
            />
          ) : null}
          {claim?.status === "submitted" && !canRespondToResult && !isOwnResultClaim ? (
            <FormNotice
              tone={resultResponseExpired ? "info" : "success"}
              message={resultResponseExpired
                ? "Opponent response is overdue. Skillsroom review can use the no-response path after checking evidence."
                : `Opponent response due: ${dateTimeLabel(claim.opponent_response_due_at)}.`}
            />
          ) : null}
          <EvidenceChecklist hasScore={Boolean(scoreSummary.trim() || claim?.score_summary)} hasProof={Boolean(evidenceUrl.trim() || (resultsQuery.data?.evidence_items ?? []).length)} />
          {(resultsQuery.data?.evidence_items ?? []).length ? (
            <View style={styles.evidenceList}>
              {(resultsQuery.data?.evidence_items ?? []).slice(0, 4).map((item) => (
                <Pressable key={item.id ?? item.uri ?? item.title ?? "evidence"} style={styles.evidenceRow} onPress={() => {
                  openEvidenceInApp(item.uri, item.title ?? "Result evidence");
                }}>
                  <FileCheck2 size={20} color={colors.cyan} />
                  <View style={styles.fill}>
                    <Text style={styles.itemTitle}>{item.title ?? "Evidence item"}</Text>
                    <Text style={styles.copy}>{String(item.evidence_type ?? "proof")}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
          {["active", "awaiting_results"].includes(String(room?.status)) && ownParticipant ? (
            <>
              <FormNotice tone="info" message={`Submit your own win claim as ${playerDisplayName(ownParticipant, trustQuery.data?.[ownParticipant.user_id], user?.id)}. The opponent can agree or dispute from their side.`} />
              <TextInput value={scoreSummary} onChangeText={setScoreSummary} placeholder="Score summary" placeholderTextColor={colors.faint} style={styles.input} />
              <EvidenceUploadField contextType="match_room" contextId={roomId} label="Result evidence upload" disabled={resultMutation.isPending} resetSignal={resultUploadResetSignal} onUploaded={(evidence) => setEvidenceUrl(evidence.url)} />
              <OptionalFieldsPanel title="Optional result details" helper="Use this for a fallback proof link or extra context.">
                <TextInput value={evidenceUrl} onChangeText={setEvidenceUrl} autoCapitalize="none" keyboardType="url" placeholder="Evidence link" placeholderTextColor={colors.faint} style={styles.input} />
                <TextInput value={resultNote} onChangeText={setResultNote} placeholder="Result note" placeholderTextColor={colors.faint} style={styles.input} />
              </OptionalFieldsPanel>
              <AppButton loading={resultMutation.isPending} onPress={() => resultMutation.mutate()}>Submit result</AppButton>
            </>
          ) : null}
          {canRespondToResult ? (
            <View onLayout={registerFocusLayout("result-response", "result-claim")} style={styles.focusBlock}>
              <ResponseDecisionGuide overdue={resultResponseExpired} />
              <TextInput value={responseNote} onChangeText={setResponseNote} placeholder="Response note, optional" placeholderTextColor={colors.faint} style={styles.input} />
              <View style={styles.actions}>
                <AppButton style={styles.actionButton} loading={responseMutation.isPending} onPress={() => responseMutation.mutate("agree")}>Agree</AppButton>
                <AppButton style={styles.actionButton} variant="danger" loading={responseMutation.isPending} onPress={() => responseMutation.mutate("dispute")}>Dispute</AppButton>
              </View>
            </View>
          ) : null}
          <FinalDecisionCard claim={claim} room={room} reviews={resultsQuery.data?.reviews} />
        </SurfaceCard>
        </View>
      ) : null}

      {section === "history" ? (
        <View onLayout={registerFocusLayout("history")}>
        <SurfaceCard>
          <Badge tone="dark">History</Badge>
          <Text style={styles.sectionTitle}>Room updates</Text>
          {(timelineQuery.data?.events ?? []).length ? timelineQuery.data?.events.map((event, index) => (
            <View key={event.id ?? `${event.to_status}-${index}`} style={styles.checkRow}>
              <Badge tone={index === (timelineQuery.data?.events.length ?? 1) - 1 ? "green" : "cyan"}>{index === (timelineQuery.data?.events.length ?? 1) - 1 ? "Now" : "Done"}</Badge>
              <View style={styles.fill}>
                <Text style={styles.itemTitle}>{statusLabel(event.to_status)}</Text>
                <Text style={styles.copy}>{String(event.reason ?? "Room update").replaceAll("_", " ")}</Text>
              </View>
            </View>
          )) : <FeedbackState title="No room updates yet" body="Room updates will appear here as the match moves forward." />}
        </SurfaceCard>
        </View>
      ) : null}
    </AppScreen>
  );
}

function ResultReviewPanel({ claim, room, evidenceCount }: { claim: MatchResultClaim | null; room?: MatchRoom; evidenceCount: number }) {
  const status = resultStatusCopy(claim, room);
  return (
    <View style={styles.resultPanel}>
      <View style={styles.playerCardHeader}>
        <View style={styles.fill}>
          <Text style={styles.quickLabel}>Review status</Text>
          <Text style={styles.itemTitleWide}>{status.label}</Text>
          <Text style={styles.copy}>{status.detail}</Text>
        </View>
        <View style={styles.statusBadgeWrap}>
          <Badge tone={status.tone}>{claim ? status.label : "Waiting"}</Badge>
        </View>
      </View>
      <View style={styles.resultStepGrid}>
        <ResultStep done={Boolean(claim)} label="Result claim" detail={claim?.score_summary ?? "Winner and score not submitted yet"} />
        <ResultStep done={evidenceCount > 0} label="Proof saved" detail={`${evidenceCount} file${evidenceCount === 1 ? "" : "s"} attached`} />
        <ResultStep done={Boolean(claim && claim.status !== "submitted")} label="Opponent response" detail={claim ? responseCountdown(claim) : "Starts after result claim"} />
        <ResultStep done={["admin_approved", "admin_rejected"].includes(String(claim?.status)) || ["completed", "refunded", "voided"].includes(String(room?.status))} label="Final decision" detail={finalDecisionSummary(claim, room)} />
      </View>
    </View>
  );
}

function ResultStep({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <View style={[styles.resultStep, done && styles.resultStepDone]}>
      <View style={styles.resultStepIcon}>
        <BadgeCheck color={done ? colors.greenDark : colors.faint} size={18} />
      </View>
      <View style={styles.fill}>
        <Text style={styles.resultStepLabel}>{label}</Text>
        <Text style={styles.resultStepDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function EvidenceChecklist({ hasProof, hasScore }: { hasProof: boolean; hasScore: boolean }) {
  return (
    <View style={styles.checklist}>
      <Text style={styles.quickLabel}>Proof checklist</Text>
      <ChecklistRow done={hasScore} text="Score summary is clear." />
      <ChecklistRow done={hasProof} text="Screenshot or video proof is attached." />
      <ChecklistRow done={hasProof} text="Player names, game handles, and final scoreboard are visible." />
      <ChecklistRow done={hasProof} text="Upload before leaving the room so review can move quickly." />
    </View>
  );
}

function ChecklistRow({ done, text }: { done: boolean; text: string }) {
  return (
    <View style={styles.checklistRow}>
      <View style={[styles.checkDot, done && styles.checkDotDone]}>
        {done ? <BadgeCheck color={colors.white} size={14} /> : null}
      </View>
      <Text style={styles.checklistText}>{text}</Text>
    </View>
  );
}

function ResponseDecisionGuide({ overdue }: { overdue: boolean }) {
  return (
    <View style={[styles.responseGuide, overdue && styles.responseGuideLate]}>
      <Clock3 color={overdue ? colors.red : colors.cyan} size={20} />
      <View style={styles.fill}>
        <Text style={styles.itemTitle}>{overdue ? "Response time is overdue" : "Choose your response"}</Text>
        <Text style={styles.copy}>Tap Agree only if the winner, score, and proof are correct. Tap Dispute if proof is missing, unclear, or the score is wrong.</Text>
      </View>
    </View>
  );
}

function FinalDecisionCard({ claim, room, reviews }: { claim: MatchResultClaim | null; room?: MatchRoom; reviews?: Array<Record<string, unknown>> }) {
  return (
    <View style={styles.finalCard}>
      <Trophy color={colors.amber} size={22} />
      <View style={styles.fill}>
        <Text style={styles.itemTitle}>Final decision summary</Text>
        <Text style={styles.copy}>{finalDecisionSummary(claim, room, reviews)}</Text>
      </View>
    </View>
  );
}

function DarkMetric({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
  return (
    <View style={styles.darkMetric}>
      <Icon size={18} color={colors.cyan} />
      <Text style={styles.darkMetricLabel}>{label}</Text>
      <Text style={styles.darkMetricValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function QuickAction({
  icon: Icon,
  label,
  value,
  copyValue,
  copiedLabel
}: {
  icon: typeof Copy;
  label: string;
  value: string;
  copyValue?: string | null;
  copiedLabel?: string;
}) {
  return (
    <View style={styles.quickAction}>
      <Icon size={18} color={colors.cyan} />
      <Text style={styles.quickLabel}>{label}</Text>
      <Text style={styles.quickValue} numberOfLines={1}>{value}</Text>
      {copyValue ? <CopyButton value={copyValue} label="Copy" copiedLabel={copiedLabel ?? "Copied"} compact /> : null}
    </View>
  );
}

function RoomFlow({ currentStatus, expired = false }: { currentStatus?: string; expired?: boolean }) {
  const steps = [
    {
      key: "open",
      title: expired ? "Expired" : "Open",
      detail: expired ? "The join window ended before another player accepted." : "Room is visible or shareable by code.",
      done: !["draft", undefined].includes(currentStatus) && !expired,
      active: expired || currentStatus === "open"
    },
    { key: "fund", title: "Confirm entry", detail: "Both entries must be confirmed before play.", done: ["funded", "active", "awaiting_results", "under_review", "disputed", "settlement_pending", "completed"].includes(String(currentStatus)), active: ["awaiting_funding", "funding_review"].includes(String(currentStatus)) },
    { key: "play", title: "Play", detail: "Match starts after both entries are confirmed.", done: ["awaiting_results", "under_review", "disputed", "settlement_pending", "completed"].includes(String(currentStatus)), active: ["funded", "active"].includes(String(currentStatus)) },
    { key: "review", title: "Review", detail: "Result evidence and responses are checked.", done: ["settlement_pending", "completed"].includes(String(currentStatus)), active: ["awaiting_results", "under_review", "disputed"].includes(String(currentStatus)) },
    { key: "settle", title: "Payout", detail: "Winner payout or refund is completed.", done: currentStatus === "completed", active: currentStatus === "settlement_pending" }
  ];

  return (
    <View style={styles.flowList}>
      {steps.map((step, index) => (
        <View key={step.key} style={styles.flowRow}>
          <View style={[styles.flowMarker, step.done && styles.flowMarkerDone, step.active && styles.flowMarkerActive]}>
            {step.done ? <BadgeCheck size={18} color={colors.white} /> : <Text style={styles.flowMarkerText}>{index + 1}</Text>}
          </View>
          <View style={styles.fill}>
            <Text style={styles.itemTitle}>{step.title}</Text>
            <Text style={styles.copy}>{step.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function InstructionStep({ index, title, detail }: { index: string; title: string; detail: string }) {
  return (
    <View style={styles.instructionRow}>
      <Text style={styles.instructionIndex}>{index}</Text>
      <View style={styles.fill}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.copy}>{detail}</Text>
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  refreshButton: { width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.navySoft, borderWidth: 1, borderColor: "#22344b" },
  heroTitle: { color: colors.white, fontSize: 34, lineHeight: 40, fontWeight: "900" },
  heroCopy: { color: "#c8d4e1", fontSize: 16, lineHeight: 24 },
  heroMetricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  darkMetric: { flexBasis: "30%", flexGrow: 1, borderWidth: 1, borderColor: "#22344b", borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.navySoft, gap: 4 },
  darkMetricLabel: { color: "#9dafc1", fontSize: 11, fontWeight: "900" },
  darkMetricValue: { color: colors.white, fontSize: 14, fontWeight: "900" },
  sectionTitle: { color: colors.ink, fontSize: 26, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22, flexShrink: 1 },
  helpText: { color: colors.muted, fontSize: 13, fontWeight: "800", lineHeight: 19 },
  itemTitle: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: "900", flexShrink: 1 },
  itemTitleWide: { color: colors.ink, fontSize: 20, lineHeight: 25, fontWeight: "900", flexShrink: 1 },
  bigCode: { color: colors.ink, fontSize: 42, letterSpacing: 3, fontWeight: "900" },
  fill: { flex: 1, minWidth: 0 },
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  quickAction: { flexBasis: "30%", flexGrow: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surfaceAlt, gap: 4 },
  quickLabel: { color: colors.faint, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 },
  quickValue: { color: colors.ink, fontWeight: "900" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  summaryTile: { flexBasis: "45%", flexGrow: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceAlt, gap: 4 },
  summaryValue: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  ruleGrid: { gap: spacing.sm },
  ruleCard: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceAlt },
  ruleTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  ruleBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6, fontWeight: "700" },
  flowList: { gap: spacing.sm },
  flowRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceAlt },
  flowMarker: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.cyanSoft },
  flowMarkerDone: { backgroundColor: colors.green },
  flowMarkerActive: { backgroundColor: colors.cyan },
  flowMarkerText: { color: colors.cyan, fontWeight: "900" },
  instructionRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceAlt },
  instructionIndex: { width: 38, height: 38, borderRadius: 14, textAlign: "center", textAlignVertical: "center", color: colors.cyan, backgroundColor: colors.cyanSoft, fontSize: 18, fontWeight: "900" },
  inviteBox: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceAlt, gap: spacing.sm },
  embeddedCard: { backgroundColor: colors.surfaceAlt, shadowOpacity: 0, elevation: 0 },
  resultPanel: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.md, gap: spacing.md },
  resultStepGrid: { gap: spacing.sm },
  resultStep: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, padding: spacing.md },
  resultStepDone: { borderColor: "#b6f4db", backgroundColor: colors.greenSoft },
  resultStepIcon: { width: 24, alignItems: "center", paddingTop: 1 },
  resultStepLabel: { color: colors.ink, fontSize: 14, lineHeight: 18, fontWeight: "900", flexShrink: 1 },
  resultStepDetail: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "700", marginTop: 2, flexShrink: 1 },
  checklist: { borderWidth: 1, borderColor: "#aeefff", borderRadius: radius.md, backgroundColor: colors.cyanSoft, padding: spacing.md, gap: spacing.sm },
  checklistRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  checklistText: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: "700" },
  checkDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkDotDone: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  responseGuide: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", borderWidth: 1, borderColor: "#aeefff", borderRadius: radius.md, backgroundColor: colors.cyanSoft, padding: spacing.md },
  responseGuideLate: { borderColor: "#ffc6d0", backgroundColor: colors.redSoft },
  finalCard: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", borderWidth: 1, borderColor: "#ffdf9d", borderRadius: radius.md, backgroundColor: colors.amberSoft, padding: spacing.md },
  evidenceList: { gap: spacing.sm },
  evidenceRow: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, flexDirection: "row", gap: spacing.md, alignItems: "center", backgroundColor: colors.surfaceAlt },
  sectionNav: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sectionButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  sectionButtonOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  sectionButtonText: { color: colors.muted, fontWeight: "900" },
  sectionButtonTextOn: { color: colors.greenDark },
  checkRow: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    backgroundColor: colors.surfaceAlt
  },
  playerRow: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    backgroundColor: colors.surfaceAlt
  },
  playerCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt
  },
  playerCardHeader: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap"
  },
  statusBadgeWrap: { alignSelf: "flex-start", maxWidth: "100%" },
  detailList: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    padding: spacing.sm,
    gap: spacing.xs
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    alignItems: "flex-start"
  },
  detailLabel: { color: colors.muted, fontSize: 13, fontWeight: "800", flex: 1 },
  detailValue: { color: colors.ink, fontSize: 13, fontWeight: "900", flex: 1.2, textAlign: "right" },
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
  inputDisabled: {
    color: colors.faint,
    backgroundColor: colors.white,
    opacity: 0.72
  },
  joinCodeShell: {
    minHeight: 68,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt
  },
  joinCodeInput: {
    flex: 1,
    minHeight: 66,
    fontSize: 22,
    letterSpacing: 2,
    fontWeight: "900",
    color: colors.ink
  },
  focusBlock: { gap: spacing.md },
  actions: { flexDirection: "row", gap: spacing.md },
  actionButton: { flex: 1 }
});
