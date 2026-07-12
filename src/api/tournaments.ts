import type { CommunityLivestreamLink, Tournament, TournamentDetail, TournamentEntry, TournamentPrizeContribution, TournamentStateEvent } from "../types/api";
import { apiRequest } from "./client";

export async function listTournaments(input: { status?: string; format?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  if (input.format) params.set("format", input.format);
  if (input.limit) params.set("limit", String(input.limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await apiRequest<{ tournaments: Tournament[] }>(`/tournaments${query}`);
  return data.tournaments ?? [];
}

export async function getTournamentDetail(tournamentId: string) {
  const data = await apiRequest<{ tournament: TournamentDetail; events: TournamentStateEvent[] }>(`/tournaments/${encodeURIComponent(tournamentId)}`);
  return data;
}

export async function registerForTournament(tournamentId: string, input: { display_name?: string; team_name?: string }) {
  const data = await apiRequest<{ entry: TournamentEntry }>(`/tournaments/${encodeURIComponent(tournamentId)}/register`, {
    method: "POST",
    body: input
  });
  return data.entry;
}

export async function checkInForTournament(tournamentId: string) {
  const data = await apiRequest<{ entry: TournamentEntry }>(`/tournaments/${encodeURIComponent(tournamentId)}/check-in`, {
    method: "POST",
    body: {}
  });
  return data.entry;
}

export async function payTournamentEntryWithBalance(tournamentId: string) {
  const data = await apiRequest<{ entry: TournamentEntry }>(`/tournaments/${encodeURIComponent(tournamentId)}/balance-entry`, {
    method: "POST",
    body: {}
  });
  return data.entry;
}

export async function submitTournamentEntryProof(tournamentId: string, input: {
  amount_minor: number;
  collection_bank_name: string;
  collection_account_number: string;
  collection_account_name: string;
  external_reference?: string;
  proof_url?: string;
  payout_recipient_name: string;
  payout_bank_name: string;
  payout_account_number: string;
  payout_bank_code?: string;
  payout_note?: string;
  notes?: string;
}) {
  const data = await apiRequest<{ contribution: TournamentPrizeContribution }>(`/tournaments/${encodeURIComponent(tournamentId)}/contributions`, {
    method: "POST",
    body: {
      source: "participant_entries",
      ...input
    }
  });
  return data.contribution;
}

export async function listTournamentLivestreams(tournamentId: string) {
  const data = await apiRequest<{ livestreams: CommunityLivestreamLink[] }>(
    `/community/livestreams/view?target_type=tournament&tournament_id=${encodeURIComponent(tournamentId)}`
  );
  return data.livestreams ?? [];
}
