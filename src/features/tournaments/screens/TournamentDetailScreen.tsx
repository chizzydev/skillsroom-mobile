import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { plainApiError } from "../../../api/errors";
import { createLivestream } from "../../../api/streaming";
import {
  checkInForTournament,
  getTournamentDetail,
  listTournamentLivestreams,
  payTournamentEntryWithBalance,
  registerForTournament,
  submitTournamentEntryProof
} from "../../../api/tournaments";
import { walletOverview } from "../../../api/wallet";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, spacing } from "../../../constants/theme";
import { EvidenceUploadField } from "../../uploads/components/EvidenceUploadField";
import { NoStreamState, StreamAttachForm, StreamLinkCard } from "../../streaming/components/StreamCards";
import { useActionFeedback } from "../../../providers/ActionFeedbackProvider";
import { useAuthStore } from "../../../store/auth-store";
import type { CommunityLivestreamLink, TournamentDetail, TournamentEntry, TournamentMatch, TournamentMatchSide, TournamentStanding } from "../../../types/api";

type DetailView = "overview" | "entry" | "bracket" | "standings" | "streams";
type Notice = { tone: "error" | "success" | "info"; message: string } | null;
type DetailNotice = { view: DetailView; notice: NonNullable<Notice> } | null;

const views: DetailView[] = ["overview", "entry", "bracket", "standings", "streams"];
const collectionAccount = {
  bankName: "Opay",
  accountNumber: "8134979631",
  accountName: "Chizaram Anthony Chukwuka"
};

function money(minor?: number, currency = "NGN") {
  return `${currency} ${Math.round((minor ?? 0) / 100).toLocaleString()}`;
}

function clean(value?: string | null) {
  return String(value ?? "").replaceAll("_", " ") || "pending";
}

function paymentLabel(value?: string | null) {
  const status = String(value ?? "").toLowerCase();
  if (status === "approved") return "Confirmed";
  if (status === "submitted") return "Receipt sent";
  if (status === "pending") return "Payment due";
  if (status === "rejected") return "Resubmit";
  if (status === "refunded") return "Refunded";
  return clean(value);
}

function amountFromNaira(value: string) {
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function statusTone(status?: string): "cyan" | "green" | "amber" | "red" | "dark" {
  if (["registration_open", "registered", "approved", "checked_in", "completed"].includes(status ?? "")) return "green";
  if (["pending", "submitted", "registration_locked", "seeding", "in_progress", "under_review"].includes(status ?? "")) return "amber";
  if (["rejected", "cancelled", "voided", "disqualified", "removed"].includes(status ?? "")) return "red";
  if (["settlement_pending", "completed"].includes(status ?? "")) return "dark";
  return "cyan";
}

function entryName(entry?: TournamentEntry | null) {
  if (!entry) return "Open slot";
  return entry.team_name ?? entry.display_name ?? entry.captain_username ?? "Entry";
}

function findMyEntry(tournament?: TournamentDetail, userId?: string) {
  if (!tournament || !userId) return null;
  return tournament.entries.find((entry) => entry.captain_user_id === userId)
    ?? tournament.entries.find((entry) => tournament.entry_members.some((member) => member.entry_id === entry.id && member.user_id === userId))
    ?? null;
}

function checkInOpen(status?: string) {
  return status === "registration_open" || status === "registration_locked";
}

function canManageTournamentStreams(tournament?: TournamentDetail, userId?: string, role?: string) {
  if (!tournament || !userId) return false;
  if (["support", "moderator", "admin", "owner"].includes(role ?? "")) return true;
  if (tournament.created_by_user_id === userId) return true;
  return tournament.hosts.some((host) => host.user_id === userId && host.status === "active" && host.role !== "sponsor");
}

function feedbackTitle(tone: NonNullable<Notice>["tone"], view: DetailView) {
  if (tone === "error") return "Tournament action failed";
  if (tone === "info") return "Tournament update";
  if (view === "entry") return "Entry updated";
  if (view === "streams") return "Stream updated";
  return "Tournament updated";
}

export function TournamentDetailScreen() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId?: string }>();
  const target = typeof tournamentId === "string" ? decodeURIComponent(tournamentId) : "";
  const queryClient = useQueryClient();
  const { pushFeedback } = useActionFeedback();
  const user = useAuthStore((state) => state.user);
  const userId = user?.id;
  const [view, setView] = useState<DetailView>("overview");
  const [notice, setNotice] = useState<Notice>(null);
  const [localNotice, setLocalNotice] = useState<DetailNotice>(null);
  const [displayName, setDisplayName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [senderAccount, setSenderAccount] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [proofUploadResetSignal, setProofUploadResetSignal] = useState(0);

  const detailQuery = useQuery({ queryKey: ["tournaments", "detail", target], queryFn: () => getTournamentDetail(target), enabled: Boolean(target), refetchInterval: 10000 });
  const streamsQuery = useQuery({ queryKey: ["tournaments", "streams", target], queryFn: () => listTournamentLivestreams(target), enabled: Boolean(target), refetchInterval: 15000 });
  const walletQuery = useQuery({ queryKey: ["wallet"], queryFn: walletOverview });
  const tournament = detailQuery.data?.tournament;
  const events = detailQuery.data?.events ?? [];
  const streams = streamsQuery.data ?? [];
  const myEntry = findMyEntry(tournament, userId);
  const needsFunding = Boolean(tournament && ["paid", "hybrid"].includes(tournament.fee_mode) && tournament.entry_fee_amount_minor > 0);
  const registrationOpen = tournament?.status === "registration_open";
  const canCheckIn = Boolean(myEntry && myEntry.status === "registered" && checkInOpen(tournament?.status));
  const canFund = Boolean(myEntry && needsFunding && ["pending", "rejected"].includes(myEntry.funding_status));
  const available = walletQuery.data?.account?.currency === tournament?.currency ? walletQuery.data?.account?.available_balance_minor ?? 0 : 0;
  const enoughBalance = tournament ? available >= tournament.entry_fee_amount_minor : false;
  const canAttachStream = canManageTournamentStreams(tournament, userId, user?.role);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    await queryClient.invalidateQueries({ queryKey: ["wallet"] });
  };

  const notify = (targetView: DetailView, nextNotice: NonNullable<Notice>, focusView = false) => {
    setNotice(nextNotice);
    setLocalNotice({ view: targetView, notice: nextNotice });
    pushFeedback({
      tone: nextNotice.tone,
      title: feedbackTitle(nextNotice.tone, targetView),
      message: nextNotice.message
    });
    if (focusView) setView(targetView);
  };

  const noticeFor = (targetView: DetailView) => localNotice?.view === targetView ? localNotice.notice : null;

  const registerMutation = useMutation({
    mutationFn: () => {
      if (!tournament) throw new Error("Tournament is not loaded yet.");
      if (!registrationOpen) throw new Error("Registration is not open.");
      if (tournament.entry_type === "team" && !teamName.trim()) throw new Error("Enter your team name.");
      return registerForTournament(tournament.id, {
        display_name: displayName.trim() || undefined,
        team_name: teamName.trim() || undefined
      });
    },
    onSuccess: async () => {
      notify("entry", { tone: "success", message: "Registration saved. Paid entries still need payment confirmation before play." }, true);
      setDisplayName("");
      setTeamName("");
      await refresh();
    },
    onError: (error) => notify("entry", { tone: "error", message: plainApiError(error, "Could not register for this tournament.") }, true)
  });

  const balanceMutation = useMutation({
    mutationFn: () => {
      if (!tournament) throw new Error("Tournament is not loaded yet.");
      return payTournamentEntryWithBalance(tournament.id);
    },
    onSuccess: async () => {
      notify("entry", { tone: "success", message: "Entry paid from your Skillsroom balance. We are confirming the tournament entry now." });
      await refresh();
    },
    onError: (error) => notify("entry", { tone: "error", message: plainApiError(error, "Could not pay entry from balance.") })
  });

  const proofMutation = useMutation({
    mutationFn: () => {
      if (!tournament) throw new Error("Tournament is not loaded yet.");
      const amountMinor = amountFromNaira(String(tournament.entry_fee_amount_minor / 100));
      if (amountMinor !== tournament.entry_fee_amount_minor) throw new Error("Entry amount could not be prepared.");
      if (!proofUrl.trim()) throw new Error("Add a receipt or screenshot link before submitting.");
      if (!senderName.trim() || !senderBank.trim() || !senderAccount.trim()) {
        throw new Error("Enter the account name, bank, and account number we should use if a refund is needed.");
      }
      return submitTournamentEntryProof(tournament.id, {
        amount_minor: tournament.entry_fee_amount_minor,
        collection_bank_name: collectionAccount.bankName,
        collection_account_number: collectionAccount.accountNumber,
        collection_account_name: collectionAccount.accountName,
        external_reference: transferReference.trim() || undefined,
        proof_url: proofUrl.trim(),
        payout_recipient_name: senderName.trim(),
        payout_bank_name: senderBank.trim(),
        payout_account_number: senderAccount.replace(/\D+/g, ""),
        notes: proofNote.trim() || undefined
      });
    },
    onSuccess: async () => {
      notify("entry", { tone: "success", message: "Receipt submitted. Your entry will update after Skillsroom confirms the transfer." });
      setProofUrl("");
      setTransferReference("");
      setProofNote("");
      setProofUploadResetSignal((value) => value + 1);
      await refresh();
    },
    onError: (error) => notify("entry", { tone: "error", message: plainApiError(error, "Could not submit receipt.") })
  });

  const checkInMutation = useMutation({
    mutationFn: () => {
      if (!tournament) throw new Error("Tournament is not loaded yet.");
      return checkInForTournament(tournament.id);
    },
    onSuccess: async () => {
      notify("entry", { tone: "success", message: "Checked in. You are ready for seeding or pairing." });
      await refresh();
    },
    onError: (error) => notify("entry", { tone: "error", message: plainApiError(error, "Could not check in.") })
  });

  const streamMutation = useMutation({
    mutationFn: (input: { title: string; stream_url: string; provider?: "youtube" | "twitch" | "tiktok"; visibility: "public" | "participants"; stream_role: "official" | "player_a" | "player_b" }) => {
      if (!tournament) throw new Error("Tournament is not loaded yet.");
      return createLivestream({
        target_type: "tournament",
        tournament_id: tournament.id,
        playback_status: "live",
        ...input
      });
    },
    onSuccess: async () => {
      notify("streams", { tone: "success", message: "Tournament stream attached. Viewers can open it from Streams." });
      await queryClient.invalidateQueries({ queryKey: ["tournaments", "streams", target] });
    },
    onError: (error) => notify("streams", { tone: "error", message: plainApiError(error, "Could not attach stream link.") })
  });

  if (detailQuery.isError) {
    return (
      <AppScreen>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Back</Text></Pressable>
        <FeedbackState tone="error" title="Tournament unavailable" body="This tournament could not be loaded." actionLabel="Retry" onAction={() => void detailQuery.refetch()} />
      </AppScreen>
    );
  }

  if (!tournament) {
    return (
      <AppScreen>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Back</Text></Pressable>
        <FeedbackState title="Loading tournament" body="Getting the latest entry, payment, and bracket details." />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Back</Text></Pressable>
        <AppButton variant="secondary" onPress={() => void refresh()} style={styles.refreshButton}>Refresh</AppButton>
      </View>

      <SurfaceCard dark>
        <Badge tone="dark">{clean(tournament.status)}</Badge>
        <Text style={styles.heroTitle}>{tournament.title}</Text>
        <Text style={styles.heroCopy}>{tournament.game_name ?? tournament.game_slug ?? "Tournament"} - {clean(tournament.format)}</Text>
      </SurfaceCard>

      {notice && !noticeFor(view) ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

      <SurfaceCard>
        <Text style={styles.currentTitle}>{myEntry ? `Your entry: ${clean(myEntry.status)}` : registrationOpen ? "Registration is open" : "Registration is not open"}</Text>
        <Text style={styles.copy}>{myEntry ? `${paymentLabel(myEntry.funding_status)}${myEntry.checked_in_at ? " - Checked in" : ""}` : "Register from the Entry tab when this event is open."}</Text>
      </SurfaceCard>

      <View style={styles.nav}>
        {views.map((item) => (
          <Pressable key={item} onPress={() => setView(item)} style={[styles.navButton, view === item && styles.navButtonOn]}>
            <Text style={[styles.navText, view === item && styles.navTextOn]}>{clean(item)}</Text>
          </Pressable>
        ))}
      </View>

      {view === "overview" ? <Overview tournament={tournament} events={events} /> : null}
      {view === "entry" ? (
        <EntryPanel
          notice={noticeFor("entry")}
          tournament={tournament}
          myEntry={myEntry}
          registrationOpen={registrationOpen}
          needsFunding={needsFunding}
          canFund={canFund}
          canCheckIn={canCheckIn}
          available={available}
          enoughBalance={enoughBalance}
          displayName={displayName}
          teamName={teamName}
          proofUrl={proofUrl}
          transferReference={transferReference}
          senderName={senderName}
          senderBank={senderBank}
          senderAccount={senderAccount}
          proofNote={proofNote}
          proofUploadResetSignal={proofUploadResetSignal}
          onDisplayName={setDisplayName}
          onTeamName={setTeamName}
          onProofUrl={setProofUrl}
          onTransferReference={setTransferReference}
          onSenderName={setSenderName}
          onSenderBank={setSenderBank}
          onSenderAccount={setSenderAccount}
          onProofNote={setProofNote}
          onRegister={() => registerMutation.mutate()}
          onBalance={() => balanceMutation.mutate()}
          onProof={() => proofMutation.mutate()}
          onCheckIn={() => checkInMutation.mutate()}
          registerLoading={registerMutation.isPending}
          balanceLoading={balanceMutation.isPending}
          proofLoading={proofMutation.isPending}
          checkInLoading={checkInMutation.isPending}
          tournamentId={tournament.id}
        />
      ) : null}
      {view === "bracket" ? <BracketPanel tournament={tournament} /> : null}
      {view === "standings" ? <StandingsPanel tournament={tournament} /> : null}
      {view === "streams" ? (
        <StreamsPanel
          notice={noticeFor("streams")}
          streams={streams}
          loading={streamsQuery.isLoading}
          canAttach={canAttachStream}
          attachLoading={streamMutation.isPending}
          onAttach={(input) => streamMutation.mutate(input)}
        />
      ) : null}
    </AppScreen>
  );
}

function Overview({ tournament, events }: { tournament: TournamentDetail; events: Array<{ id?: string; to_status?: string; reason?: string; created_at?: string }> }) {
  const prize = (tournament.sponsored_prize_pool_minor ?? 0) + (tournament.guaranteed_prize_pool_minor ?? 0) + (tournament.approved_prize_contribution_minor ?? 0);

  return (
    <>
      <View style={styles.stats}>
        <StatCard label="Entry" value={tournament.entry_fee_amount_minor > 0 ? money(tournament.entry_fee_amount_minor, tournament.currency) : "Free"} />
        <StatCard label="Prize pool" value={money(prize, tournament.currency)} />
        <StatCard label="Entries" value={`${tournament.registered_entry_count ?? tournament.entries.length}/${tournament.max_entries}`} />
        <StatCard label="Check-ins" value={`${tournament.checked_in_entry_count ?? 0}`} />
      </View>
      {tournament.description ? <SurfaceCard><Text style={styles.copy}>{tournament.description}</Text></SurfaceCard> : null}
      <SurfaceCard>
        <Badge>Timeline</Badge>
        {events.slice(0, 6).map((event) => (
          <View key={event.id ?? `${event.to_status}-${event.created_at}`} style={styles.timelineRow}>
            <Text style={styles.timelineTitle}>{clean(event.to_status)}</Text>
            <Text style={styles.copy}>{event.reason ?? "Tournament update"}</Text>
          </View>
        ))}
        {!events.length ? <Text style={styles.copy}>Tournament updates will appear here.</Text> : null}
      </SurfaceCard>
    </>
  );
}

function EntryPanel(props: {
  notice?: Notice;
  tournament: TournamentDetail;
  myEntry: TournamentEntry | null;
  registrationOpen: boolean;
  needsFunding: boolean;
  canFund: boolean;
  canCheckIn: boolean;
  available: number;
  enoughBalance: boolean;
  displayName: string;
  teamName: string;
  proofUrl: string;
  transferReference: string;
  senderName: string;
  senderBank: string;
  senderAccount: string;
  proofNote: string;
  proofUploadResetSignal: number;
  onDisplayName: (value: string) => void;
  onTeamName: (value: string) => void;
  onProofUrl: (value: string) => void;
  onTransferReference: (value: string) => void;
  onSenderName: (value: string) => void;
  onSenderBank: (value: string) => void;
  onSenderAccount: (value: string) => void;
  onProofNote: (value: string) => void;
  onRegister: () => void;
  onBalance: () => void;
  onProof: () => void;
  onCheckIn: () => void;
  registerLoading: boolean;
  balanceLoading: boolean;
  proofLoading: boolean;
  checkInLoading: boolean;
  tournamentId: string;
}) {
  return (
    <>
      <SurfaceCard>
        <Badge tone={props.myEntry ? "green" : "cyan"}>{props.myEntry ? "Entered" : "Register"}</Badge>
        <Text style={styles.sectionTitle}>Entry readiness</Text>
        {props.notice ? <FormNotice tone={props.notice.tone} message={props.notice.message} /> : null}
        <Text style={styles.copy}>Registration requires a complete profile, age confirmation, and a primary game account for this tournament game.</Text>
        <TextInput value={props.displayName} onChangeText={props.onDisplayName} placeholder="Display name shown in bracket" placeholderTextColor={colors.faint} style={styles.input} editable={props.registrationOpen && !props.myEntry} />
        {props.tournament.entry_type === "team" ? (
          <TextInput value={props.teamName} onChangeText={props.onTeamName} placeholder="Team name" placeholderTextColor={colors.faint} style={styles.input} editable={props.registrationOpen && !props.myEntry} />
        ) : null}
        <AppButton disabled={!props.registrationOpen || Boolean(props.myEntry)} loading={props.registerLoading} onPress={props.onRegister}>
          {props.myEntry ? "Already registered" : props.registrationOpen ? "Register" : "Registration closed"}
        </AppButton>
      </SurfaceCard>

      {props.needsFunding ? (
        <SurfaceCard>
          <Badge tone={props.canFund ? "amber" : "green"}>{props.myEntry ? paymentLabel(props.myEntry.funding_status) : "Payment"}</Badge>
          <Text style={styles.sectionTitle}>Entry payment</Text>
          <Text style={styles.copy}>Entry fee is {money(props.tournament.entry_fee_amount_minor, props.tournament.currency)}. Use your Skillsroom balance or submit a transfer receipt for confirmation.</Text>
          <Text style={styles.copy}>Available balance: {money(props.available, props.tournament.currency)}</Text>
          <AppButton disabled={!props.canFund || !props.enoughBalance} loading={props.balanceLoading} onPress={props.onBalance}>
            Pay from balance
          </AppButton>
          <View style={styles.paymentBox}>
            <Text style={styles.sectionTitle}>Manual transfer</Text>
            <Text style={styles.copy}>{collectionAccount.bankName} - {collectionAccount.accountNumber} - {collectionAccount.accountName}</Text>
            <EvidenceUploadField contextType="tournament" contextId={props.tournamentId} label="Receipt upload" disabled={!props.canFund || props.proofLoading} resetSignal={props.proofUploadResetSignal} onUploaded={(evidence) => props.onProofUrl(evidence.url)} />
            <TextInput value={props.proofUrl} onChangeText={props.onProofUrl} autoCapitalize="none" placeholder="Receipt or screenshot link" placeholderTextColor={colors.faint} style={styles.input} editable={props.canFund} />
            <TextInput value={props.transferReference} onChangeText={props.onTransferReference} placeholder="Transfer reference, optional" placeholderTextColor={colors.faint} style={styles.input} editable={props.canFund} />
            <TextInput value={props.senderName} onChangeText={props.onSenderName} placeholder="Refund account name" placeholderTextColor={colors.faint} style={styles.input} editable={props.canFund} />
            <TextInput value={props.senderBank} onChangeText={props.onSenderBank} placeholder="Refund bank" placeholderTextColor={colors.faint} style={styles.input} editable={props.canFund} />
            <TextInput value={props.senderAccount} onChangeText={props.onSenderAccount} keyboardType="number-pad" placeholder="Refund account number" placeholderTextColor={colors.faint} style={styles.input} editable={props.canFund} />
            <TextInput value={props.proofNote} onChangeText={props.onProofNote} multiline placeholder="Note, optional" placeholderTextColor={colors.faint} style={[styles.input, styles.textarea]} editable={props.canFund} />
            <AppButton variant="secondary" disabled={!props.canFund} loading={props.proofLoading} onPress={props.onProof}>
              Submit receipt
            </AppButton>
          </View>
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <Badge tone={props.canCheckIn ? "green" : "cyan"}>Check-in</Badge>
        <Text style={styles.sectionTitle}>{props.myEntry?.checked_in_at ? "You are checked in" : "Ready check"}</Text>
        <Text style={styles.copy}>Check-in confirms you are available before seeding or pairing. Paid entries must be approved first.</Text>
        <AppButton variant="secondary" disabled={!props.canCheckIn} loading={props.checkInLoading} onPress={props.onCheckIn}>
          {props.myEntry?.checked_in_at ? "Checked in" : checkInOpen(props.tournament.status) ? "Check in" : "Check-in closed"}
        </AppButton>
      </SurfaceCard>

      <SurfaceCard>
        <Badge>Entrants</Badge>
        {props.tournament.entries.map((entry) => (
          <View key={entry.id} style={styles.entryRow}>
            <View style={styles.entryMain}>
              <Text style={styles.rowTitle}>{entryName(entry)}</Text>
              <Text style={styles.copy}>{entry.captain_username ?? entry.captain_display_name ?? "Player"}</Text>
            </View>
            <Badge tone={statusTone(entry.funding_status)}>{paymentLabel(entry.funding_status)}</Badge>
          </View>
        ))}
        {!props.tournament.entries.length ? <Text style={styles.copy}>Entries will appear as players register.</Text> : null}
      </SurfaceCard>
    </>
  );
}

function BracketPanel({ tournament }: { tournament: TournamentDetail }) {
  const entriesById = useMemo(() => new Map(tournament.entries.map((entry) => [entry.id, entry])), [tournament.entries]);
  const sidesByMatch = useMemo(() => {
    const grouped = new Map<string, TournamentMatchSide[]>();
    tournament.match_sides.forEach((side) => grouped.set(side.tournament_match_id, [...(grouped.get(side.tournament_match_id) ?? []), side]));
    return grouped;
  }, [tournament.match_sides]);
  const roundsById = useMemo(() => new Map(tournament.rounds.map((round) => [round.id, round])), [tournament.rounds]);
  const matches = [...tournament.matches].sort((a, b) => a.match_number - b.match_number);

  return (
    <SurfaceCard>
      <Badge>Bracket</Badge>
      <Text style={styles.sectionTitle}>Match path</Text>
      {matches.map((match) => (
        <MatchRow key={match.id} match={match} roundName={roundsById.get(match.round_id)?.name} sides={sidesByMatch.get(match.id) ?? []} entriesById={entriesById} />
      ))}
      {!matches.length ? <FeedbackState title="Bracket pending" body="Matches will appear after the event is seeded or paired." /> : null}
    </SurfaceCard>
  );
}

function MatchRow({ match, roundName, sides, entriesById }: { match: TournamentMatch; roundName?: string; sides: TournamentMatchSide[]; entriesById: Map<string, TournamentEntry> }) {
  return (
    <View style={styles.matchRow}>
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle}>{roundName ?? `Match ${match.match_number}`}</Text>
        <Badge tone={statusTone(match.status)}>{clean(match.status)}</Badge>
      </View>
      {sides.sort((a, b) => a.side_index - b.side_index).map((side) => (
        <Text key={side.id} style={styles.copy}>
          {side.side_index + 1}. {entryName(side.entry_id ? entriesById.get(side.entry_id) : null)}{side.score !== null && side.score !== undefined ? ` - ${side.score}` : ""}{side.is_winner ? " - Winner" : ""}
        </Text>
      ))}
      {match.result_summary ? <Text style={styles.copy}>{match.result_summary}</Text> : null}
    </View>
  );
}

function StandingsPanel({ tournament }: { tournament: TournamentDetail }) {
  const entriesById = useMemo(() => new Map(tournament.entries.map((entry) => [entry.id, entry])), [tournament.entries]);
  const standings = [...tournament.standings].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));

  return (
    <SurfaceCard>
      <Badge>Standings</Badge>
      <Text style={styles.sectionTitle}>Leaderboard</Text>
      {standings.map((standing) => (
        <StandingRow key={standing.id} standing={standing} entry={entriesById.get(standing.entry_id)} />
      ))}
      {!standings.length ? <FeedbackState title="Standings pending" body="Standings will appear after approved tournament results." /> : null}
    </SurfaceCard>
  );
}

function StandingRow({ standing, entry }: { standing: TournamentStanding; entry?: TournamentEntry }) {
  return (
    <View style={styles.entryRow}>
      <View style={styles.entryMain}>
        <Text style={styles.rowTitle}>#{standing.rank ?? "-"} {entryName(entry)}</Text>
        <Text style={styles.copy}>{standing.wins}W {standing.losses}L {standing.draws}D</Text>
      </View>
      <Text style={styles.points}>{standing.points} pts</Text>
    </View>
  );
}

function StreamsPanel({
  notice,
  streams,
  loading,
  canAttach,
  attachLoading,
  onAttach
}: {
  notice?: Notice;
  streams: CommunityLivestreamLink[];
  loading: boolean;
  canAttach: boolean;
  attachLoading?: boolean;
  onAttach: (input: { title: string; stream_url: string; provider?: "youtube" | "twitch" | "tiktok"; visibility: "public" | "participants"; stream_role: "official" | "player_a" | "player_b" }) => void;
}) {
  return (
    <SurfaceCard>
      <Badge>Streams</Badge>
      <Text style={styles.sectionTitle}>Official streams</Text>
      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
      {loading ? <Text style={styles.copy}>Loading streams...</Text> : null}
      {streams.map((stream) => <StreamLinkCard key={stream.id} stream={stream} />)}
      {!loading && !streams.length ? <NoStreamState target="tournament" /> : null}
      <StreamAttachForm target="tournament" canAttach={canAttach} loading={attachLoading} onSubmit={onAttach} />
    </SurfaceCard>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  backButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, justifyContent: "center" },
  backText: { color: colors.ink, fontWeight: "900" },
  refreshButton: { minHeight: 42, paddingHorizontal: 14 },
  heroTitle: { color: colors.white, fontSize: 30, lineHeight: 36, fontWeight: "900", marginTop: spacing.sm },
  heroCopy: { color: "#c8d4e1", fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
  currentTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  nav: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  navButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, justifyContent: "center" },
  navButtonOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  navText: { color: colors.muted, fontWeight: "900", fontSize: 12, textTransform: "uppercase" },
  navTextOn: { color: colors.white },
  stats: { gap: spacing.sm },
  stat: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, padding: spacing.md },
  statLabel: { color: colors.faint, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  statValue: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 4 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: spacing.sm },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, color: colors.ink, fontSize: 16, marginTop: spacing.sm },
  textarea: { minHeight: 86, paddingTop: spacing.md, textAlignVertical: "top" },
  paymentBox: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  timelineRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm, marginTop: spacing.sm },
  timelineTitle: { color: colors.ink, fontWeight: "900" },
  entryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm, marginTop: spacing.sm },
  entryMain: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  rowTitle: { color: colors.ink, fontSize: 16, lineHeight: 21, fontWeight: "900", flexShrink: 1 },
  matchRow: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm, gap: spacing.xs },
  points: { color: colors.ink, fontWeight: "900" },
  streamRow: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm, gap: spacing.sm }
});
