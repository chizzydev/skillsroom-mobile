import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { BadgeCheck, Banknote, Clock3, Copy, FileCheck2, Play, Radio, RefreshCw, Send, Share2, ShieldCheck, Trophy, Users } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { plainApiError } from "../../../api/errors";
import {
  createRoomInvite,
  getRoomFunding,
  getRoomResults,
  getRoomTimeline,
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
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, spacing } from "../../../constants/theme";
import { EvidenceUploadField } from "../../uploads/components/EvidenceUploadField";
import { NoStreamState, StreamAttachForm, StreamLinkCard } from "../../streaming/components/StreamCards";
import { useAuthStore } from "../../../store/auth-store";
import type { MatchParticipant, MatchResultClaim, MatchRoom } from "../../../types/api";

type Section = "overview" | "players" | "funding" | "live" | "result" | "history";
type Notice = { tone: "error" | "success" | "info"; message: string } | null;

const sections: Section[] = ["overview", "players", "funding", "live", "result", "history"];
const collectionAccount = {
  bankName: "Opay",
  accountNumber: "8134979631",
  accountName: "Chizaram Anthony Chukwuka"
};

function money(minor?: number, currency = "NGN") {
  return `${currency} ${Math.round((minor ?? 0) / 100).toLocaleString()}`;
}

function sectionLabel(section: Section) {
  if (section === "live") return "Live";
  if (section === "funding") return "Entry";
  if (section === "history") return "Updates";
  return section[0].toUpperCase() + section.slice(1);
}

function statusLabel(status?: string) {
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

function toneForStatus(status?: string): "cyan" | "green" | "amber" | "red" | "dark" {
  if (status === "open" || status === "funded" || status === "active" || status === "completed") return "green";
  if (status === "awaiting_funding" || status === "funding_review" || status === "settlement_pending") return "amber";
  if (status === "disputed" || status === "voided" || status === "cancelled") return "red";
  return "cyan";
}

function nextAction(room?: MatchRoom, participantCount = 0) {
  if (!room) return ["Loading room", "Checking the latest room details."] as const;
  if (room.status === "open") return participantCount < (room.max_participants ?? 2)
    ? (["Share the room code", "Send the room code to your opponent so they can join."] as const)
    : (["Entry is next", "Both players are in. Each entry must be confirmed before play."] as const);
  if (room.status === "awaiting_funding") return ["Complete your entry", "Use Skillsroom Balance or submit transfer proof. The room updates when your entry is confirmed."] as const;
  if (room.status === "funding_review") return ["Entry review", "A transfer or balance hold is being checked before play opens."] as const;
  if (room.status === "funded") return ["Start the match", "Both entries are confirmed. Start play only when both players are ready."] as const;
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

function shortUser(userId?: string) {
  if (!userId) return "Waiting for player";
  return userId.length > 12 ? `${userId.slice(0, 6)}...${userId.slice(-4)}` : userId;
}

function canManageStreams(userRole?: string, room?: MatchRoom, userId?: string) {
  if (!userId) return false;
  if (["support", "moderator", "admin", "owner"].includes(userRole ?? "")) return true;
  return room?.created_by_user_id === userId;
}

function latestClaim(claims?: MatchResultClaim[]) {
  return [...(claims ?? [])].sort((a, b) => Date.parse(String(b.created_at ?? b.updated_at ?? "")) - Date.parse(String(a.created_at ?? a.updated_at ?? "")))[0] ?? null;
}

export function RoomDetailScreen() {
  const { matchId } = useLocalSearchParams<{ matchId?: string }>();
  const roomId = String(matchId ?? "");
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("overview");
  const [notice, setNotice] = useState<Notice>(null);
  const [proofUrl, setProofUrl] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [scoreSummary, setScoreSummary] = useState("");
  const [resultNote, setResultNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [selectedWinnerId, setSelectedWinnerId] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");

  const timelineQuery = useQuery({ queryKey: ["room", roomId, "timeline"], queryFn: () => getRoomTimeline(roomId), enabled: Boolean(roomId), refetchInterval: 10000 });
  const fundingQuery = useQuery({ queryKey: ["room", roomId, "funding"], queryFn: () => getRoomFunding(roomId), enabled: Boolean(roomId), refetchInterval: 10000 });
  const resultsQuery = useQuery({ queryKey: ["room", roomId, "results"], queryFn: () => getRoomResults(roomId), enabled: Boolean(roomId), refetchInterval: 10000 });
  const livestreamsQuery = useQuery({ queryKey: ["room", roomId, "livestreams"], queryFn: () => listRoomLivestreams(roomId), enabled: Boolean(roomId), refetchInterval: 15000 });

  const room = timelineQuery.data?.room;
  const participants = fundingQuery.data?.participants ?? timelineQuery.data?.participants ?? [];
  const ownParticipant = participants.find((participant) => participant.user_id === user?.id);
  const claim = latestClaim(resultsQuery.data?.claims);
  const participantCount = room?.participant_count ?? participants.length;
  const [actionTitle, actionBody] = nextAction(room, participantCount);
  const canAttachStream = canManageStreams(user?.role, room, user?.id);
  const isCreator = Boolean(user?.id && room?.creator_user_id === user.id);
  const canInvite = Boolean(room?.status === "open" && isCreator && participantCount < (room?.max_participants ?? 2));

  const refreshRoom = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["rooms"] }),
      queryClient.invalidateQueries({ queryKey: ["room", roomId] })
    ]);
  };

  const openMutation = useMutation({
    mutationFn: () => openRoom(roomId),
    onSuccess: async () => {
      setNotice({ tone: "success", message: "Room opened. Share the code with your opponent." });
      await refreshRoom();
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Could not open room.") })
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
      setNotice({ tone: "success", message: "Invite sent." });
      setInviteUsername("");
      setInviteMessage("");
      await refreshRoom();
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Could not send invite.") })
  });

  const balanceMutation = useMutation({
    mutationFn: () => payRoomWithBalance(roomId),
    onSuccess: async () => {
      setNotice({ tone: "success", message: "Your entry fee is held from Skillsroom Balance. The room will update when both players are ready." });
      await refreshRoom();
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Could not pay with balance.") })
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
    onSuccess: async () => {
      setNotice({ tone: "success", message: "Entry proof submitted. It will show as complete after review." });
      setProofUrl("");
      setProofNote("");
      await refreshRoom();
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Could not submit entry proof.") })
  });

  const startMutation = useMutation({
    mutationFn: () => startMatchPlay(roomId),
    onSuccess: async () => {
      setNotice({ tone: "success", message: "Match started. Submit result evidence when play is done." });
      await refreshRoom();
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Could not start match.") })
  });

  const resultMutation = useMutation({
    mutationFn: () => {
      if (!selectedWinnerId) throw new Error("Choose the winner before submitting the result.");
      const evidenceType: "screenshot" | "video" | "link" = evidenceUrl.includes("/api/evidence-files/evidence-v1_") && evidenceUrl.match(/\.(mp4|webm|mov)$/i)
        ? "video"
        : evidenceUrl.includes("/api/evidence-files/evidence-v1_")
          ? "screenshot"
          : "link";
      const evidence = evidenceUrl.trim()
        ? [{ evidence_type: evidenceType, uri: evidenceUrl.trim(), title: "Match result evidence", notes: resultNote.trim() || undefined }]
        : [{ evidence_type: "note" as const, title: "Match result note", notes: resultNote.trim() || scoreSummary.trim() || "Result submitted from mobile." }];
      return submitResultClaim(roomId, {
        claimed_winner_participant_id: selectedWinnerId,
        score_summary: scoreSummary.trim() || undefined,
        note: resultNote.trim() || undefined,
        evidence
      });
    },
    onSuccess: async () => {
      setNotice({ tone: "success", message: "Result submitted. It will update after response or review." });
      setEvidenceUrl("");
      setResultNote("");
      await refreshRoom();
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Could not submit result.") })
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
      setNotice({ tone: "success", message: "Stream link attached. Viewers can open it from the Live section." });
      await queryClient.invalidateQueries({ queryKey: ["room", roomId, "livestreams"] });
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Could not attach stream link.") })
  });

  const responseMutation = useMutation({
    mutationFn: (response: "agree" | "dispute") => {
      if (!claim?.id) throw new Error("There is no result claim to respond to.");
      return respondToResultClaim(claim.id, { response, note: responseNote.trim() || undefined });
    },
    onSuccess: async () => {
      setNotice({ tone: "success", message: "Response submitted. The room will update after review." });
      setResponseNote("");
      await refreshRoom();
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Could not respond to result.") })
  });

  const fundingByParticipant = useMemo(() => {
    const submissions = fundingQuery.data?.submissions ?? [];
    return new Map(participants.map((participant) => [
      participant.id,
      submissions.find((submission) => submission.participant_id === participant.id)
    ]));
  }, [fundingQuery.data?.submissions, participants]);

  if (!roomId) {
    return <FeedbackState tone="error" title="Room missing" body="Open this room again from the lobby." />;
  }

  return (
    <AppScreen>
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
          <DarkMetric icon={ShieldCheck} label="Status" value={statusLabel(room?.status)} />
          <DarkMetric icon={Users} label="Slots" value={`${participantCount}/${room?.max_participants ?? 2}`} />
          <DarkMetric icon={Banknote} label="Entry" value={money(room?.entry_amount_minor, room?.currency)} />
        </View>
      </SurfaceCard>

      {timelineQuery.isError ? <FeedbackState tone="error" title="Room unavailable" body="We could not load this room." actionLabel="Back to rooms" onAction={() => router.back()} /> : null}
      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

      <SurfaceCard>
        <Badge tone={toneForStatus(room?.status)}>{statusLabel(room?.status)}</Badge>
        <Text style={styles.sectionTitle}>{actionTitle}</Text>
        <Text style={styles.copy}>{actionBody}</Text>
        {room?.status === "draft" && isCreator ? <AppButton loading={openMutation.isPending} onPress={() => openMutation.mutate()}>Open room</AppButton> : null}
        <View style={styles.quickActions}>
          <QuickAction icon={Copy} label="Code" value={room?.room_code ?? "..."} />
          <QuickAction icon={Share2} label="Next" value={actionTitle} />
          <QuickAction icon={FileCheck2} label="Updates" value={(timelineQuery.data?.events?.length ?? 0).toString()} />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Badge tone="green">Process</Badge>
        <Text style={styles.sectionTitle}>Room progress</Text>
        <RoomFlow currentStatus={room?.status} />
      </SurfaceCard>

      <View style={styles.sectionNav}>
        {sections.map((item) => (
          <Pressable key={item} onPress={() => setSection(item)} style={[styles.sectionButton, section === item && styles.sectionButtonOn]}>
            <Text style={[styles.sectionButtonText, section === item && styles.sectionButtonTextOn]}>{sectionLabel(item)}</Text>
          </Pressable>
        ))}
      </View>

      {section === "overview" ? (
        <>
          <SurfaceCard>
            <Badge>Room code</Badge>
            <Text style={styles.bigCode}>{room?.room_code ?? "..."}</Text>
            <Text style={styles.copy}>Share this code with your opponent. The room will show when they join, complete entry, and submit a result.</Text>
            {canInvite ? (
              <View style={styles.inviteBox}>
                <Text style={styles.itemTitle}>Invite by username</Text>
                <TextInput value={inviteUsername} onChangeText={setInviteUsername} autoCapitalize="none" placeholder="player_username" placeholderTextColor={colors.faint} style={styles.input} />
                <TextInput value={inviteMessage} onChangeText={setInviteMessage} placeholder={`Join ${room?.room_code ?? "my room"} on Skillsroom.`} placeholderTextColor={colors.faint} style={styles.input} />
                <AppButton loading={inviteMutation.isPending} onPress={() => inviteMutation.mutate()}>Send invite</AppButton>
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
        </>
      ) : null}

      {section === "players" ? (
        <SurfaceCard>
          <Badge>Players</Badge>
          <Text style={styles.sectionTitle}>Slots</Text>
          {participants.map((participant) => (
            <View key={participant.id} style={styles.playerRow}>
              <View style={styles.fill}>
                <Text style={styles.itemTitle}>{participantLabel(participant)}</Text>
                <Text style={styles.copy}>{shortUser(participant.user_id)}</Text>
              </View>
              <Badge tone={participant.funding_status === "approved" ? "green" : "amber"}>{participant.funding_status ?? "pending"}</Badge>
            </View>
          ))}
          {participants.length < (room?.max_participants ?? 2) ? <FormNotice tone="info" message="An open slot remains. Share the room code with your opponent." /> : null}
          <SurfaceCard style={styles.embeddedCard}>
            <Badge tone="cyan">Player safety</Badge>
            <Text style={styles.copy}>Only joined players can submit entry proof or result evidence. Private review details stay protected.</Text>
          </SurfaceCard>
        </SurfaceCard>
      ) : null}

      {section === "funding" ? (
        <SurfaceCard>
          <Badge tone="amber">Entry</Badge>
          <Text style={styles.sectionTitle}>Entry confirmation</Text>
          {fundingQuery.isError ? <FormNotice tone="info" message="Entry details are only visible to room participants." /> : null}
          {participants.map((participant) => {
            const submission = fundingByParticipant.get(participant.id);
            return (
              <View key={participant.id} style={styles.playerRow}>
                <View style={styles.fill}>
                  <Text style={styles.itemTitle}>{participantLabel(participant)}</Text>
                  <Text style={styles.copy}>{submission?.status ? `Transfer proof: ${submission.status}` : "No transfer proof shown."}</Text>
                </View>
                <Badge tone={participant.funding_status === "approved" ? "green" : participant.funding_status === "rejected" ? "red" : "amber"}>{participant.funding_status ?? "pending"}</Badge>
              </View>
            );
          })}
          {ownParticipant && ["awaiting_funding", "funding_review"].includes(String(room?.status)) ? (
            <>
              <AppButton loading={balanceMutation.isPending} onPress={() => balanceMutation.mutate()}>Pay with balance</AppButton>
              <FormNotice tone="info" message={`Manual transfer: ${collectionAccount.bankName} ${collectionAccount.accountNumber}, ${collectionAccount.accountName}. Upload payment proof or paste a proof link.`} />
              <TextInput value={senderName} onChangeText={setSenderName} placeholder="Sender account name" placeholderTextColor={colors.faint} style={styles.input} />
              <TextInput value={senderBank} onChangeText={setSenderBank} placeholder="Sender bank" placeholderTextColor={colors.faint} style={styles.input} />
              <TextInput value={transferReference} onChangeText={setTransferReference} placeholder="Transfer reference, optional" placeholderTextColor={colors.faint} style={styles.input} />
              <EvidenceUploadField contextType="match_room" contextId={roomId} label="Entry proof upload" disabled={manualFundingMutation.isPending} onUploaded={(evidence) => setProofUrl(evidence.url)} />
              <TextInput value={proofUrl} onChangeText={setProofUrl} autoCapitalize="none" keyboardType="url" placeholder="Proof link" placeholderTextColor={colors.faint} style={styles.input} />
              <TextInput value={proofNote} onChangeText={setProofNote} placeholder="Proof note" placeholderTextColor={colors.faint} style={styles.input} />
              <AppButton loading={manualFundingMutation.isPending} onPress={() => manualFundingMutation.mutate()}>Submit proof for review</AppButton>
            </>
          ) : null}
          {!ownParticipant ? <FormNotice tone="info" message="Only room participants can submit entry proof for this room." /> : null}
        </SurfaceCard>
      ) : null}

      {section === "live" ? (
        <SurfaceCard>
          <Badge tone="green">Live</Badge>
          <Text style={styles.sectionTitle}>Streams and play</Text>
          {room?.status === "funded" ? <AppButton loading={startMutation.isPending} onPress={() => startMutation.mutate()}>Start match</AppButton> : null}
          <FormNotice tone="info" message="Start play only when the room says it is ready. Streams can be official, Player A, or Player B links." />
          {livestreamsQuery.data?.length ? livestreamsQuery.data.map((stream) => <StreamLinkCard key={stream.id} stream={stream} />) : <NoStreamState target="room" />}
          <StreamAttachForm target="room" canAttach={canAttachStream} loading={streamMutation.isPending} onSubmit={(input) => streamMutation.mutate(input)} />
        </SurfaceCard>
      ) : null}

      {section === "result" ? (
        <SurfaceCard>
          <Badge tone="cyan">Result</Badge>
          <Text style={styles.sectionTitle}>Match result</Text>
          {resultsQuery.isError ? <FormNotice tone="info" message="Result details are only visible to room participants." /> : null}
          {claim ? <FormNotice tone="info" message={`Latest claim: ${claim.status ?? "submitted"}${claim.score_summary ? `, ${claim.score_summary}` : ""}.`} /> : <Text style={styles.copy}>No result claim has been submitted yet.</Text>}
          {(resultsQuery.data?.evidence_items ?? []).length ? (
            <View style={styles.evidenceList}>
              {(resultsQuery.data?.evidence_items ?? []).slice(0, 4).map((item) => (
                <Pressable key={item.id ?? item.uri ?? item.title ?? "evidence"} style={styles.evidenceRow} onPress={() => item.uri ? void Linking.openURL(item.uri) : undefined}>
                  <FileCheck2 size={20} color={colors.cyan} />
                  <View style={styles.fill}>
                    <Text style={styles.itemTitle}>{item.title ?? "Evidence item"}</Text>
                    <Text style={styles.copy}>{String(item.evidence_type ?? "proof")}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
          {["active", "awaiting_results", "under_review"].includes(String(room?.status)) && ownParticipant ? (
            <>
              <Text style={styles.itemTitle}>Choose winner</Text>
              <View style={styles.sectionNav}>
                {participants.map((participant) => (
                  <Pressable key={participant.id} onPress={() => setSelectedWinnerId(participant.id)} style={[styles.sectionButton, selectedWinnerId === participant.id && styles.sectionButtonOn]}>
                    <Text style={[styles.sectionButtonText, selectedWinnerId === participant.id && styles.sectionButtonTextOn]}>{participantLabel(participant)}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={scoreSummary} onChangeText={setScoreSummary} placeholder="Score summary" placeholderTextColor={colors.faint} style={styles.input} />
              <EvidenceUploadField contextType="match_room" contextId={roomId} label="Result evidence upload" disabled={resultMutation.isPending} onUploaded={(evidence) => setEvidenceUrl(evidence.url)} />
              <TextInput value={evidenceUrl} onChangeText={setEvidenceUrl} autoCapitalize="none" keyboardType="url" placeholder="Evidence link, optional" placeholderTextColor={colors.faint} style={styles.input} />
              <TextInput value={resultNote} onChangeText={setResultNote} placeholder="Result note" placeholderTextColor={colors.faint} style={styles.input} />
              <AppButton loading={resultMutation.isPending} onPress={() => resultMutation.mutate()}>Submit result</AppButton>
            </>
          ) : null}
          {claim && ownParticipant && claim.submitted_by_user_id !== user?.id && ["submitted"].includes(String(claim.status)) ? (
            <>
              <TextInput value={responseNote} onChangeText={setResponseNote} placeholder="Response note, optional" placeholderTextColor={colors.faint} style={styles.input} />
              <View style={styles.actions}>
                <AppButton style={styles.actionButton} loading={responseMutation.isPending} onPress={() => responseMutation.mutate("agree")}>Agree</AppButton>
                <AppButton style={styles.actionButton} variant="danger" loading={responseMutation.isPending} onPress={() => responseMutation.mutate("dispute")}>Dispute</AppButton>
              </View>
            </>
          ) : null}
        </SurfaceCard>
      ) : null}

      {section === "history" ? (
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
      ) : null}
    </AppScreen>
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

function QuickAction({ icon: Icon, label, value }: { icon: typeof Copy; label: string; value: string }) {
  return (
    <View style={styles.quickAction}>
      <Icon size={18} color={colors.cyan} />
      <Text style={styles.quickLabel}>{label}</Text>
      <Text style={styles.quickValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function RoomFlow({ currentStatus }: { currentStatus?: string }) {
  const steps = [
    { key: "open", title: "Open", detail: "Room is visible or shareable by code.", done: !["draft", undefined].includes(currentStatus), active: currentStatus === "open" },
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
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  itemTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  bigCode: { color: colors.ink, fontSize: 42, letterSpacing: 3, fontWeight: "900" },
  fill: { flex: 1 },
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  quickAction: { flexBasis: "30%", flexGrow: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surfaceAlt, gap: 4 },
  quickLabel: { color: colors.faint, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 },
  quickValue: { color: colors.ink, fontWeight: "900" },
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
  actions: { flexDirection: "row", gap: spacing.md },
  actionButton: { flex: 1 }
});
