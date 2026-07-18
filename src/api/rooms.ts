import type {
  CommunityLivestreamLink,
  GameCatalog,
  ManualFundingSubmission,
  MatchChallenge,
  MatchChallengeListRow,
  MatchChallengeSkillLevel,
  MatchChallengeVisibility,
  MatchParticipant,
  MatchResultClaim,
  MatchRoom,
  MatchTimeline,
  RoomFundingOverview,
  RoomResultOverview
} from "../types/api";
import { apiRequest } from "./client";

export type RoomListStatus = "open" | "awaiting_funding" | "funding_review" | "funded" | "active" | "under_review" | "disputed";

export async function listRooms(status?: RoomListStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await apiRequest<{ rooms: MatchRoom[] }>(`/match-rooms${query}`);
  return data.rooms ?? [];
}

export async function listMatchChallenges(input: {
  game_slug?: string;
  platform?: string;
  region?: string;
  skill_level?: MatchChallengeSkillLevel;
  visibility?: MatchChallengeVisibility;
  limit?: number;
} = {}) {
  const params = new URLSearchParams();
  if (input.game_slug) params.set("game_slug", input.game_slug);
  if (input.platform) params.set("platform", input.platform);
  if (input.region) params.set("region", input.region);
  if (input.skill_level) params.set("skill_level", input.skill_level);
  if (input.visibility) params.set("visibility", input.visibility);
  if (input.limit) params.set("limit", String(input.limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await apiRequest<{ challenges: MatchChallengeListRow[] }>(`/match-rooms/challenges${query}`);
  return data.challenges ?? [];
}

export async function createRoom(input: {
  game_slug: string;
  ruleset_slug: string;
  entry_amount_minor: number;
  commission_bps: number;
  title?: string;
  open_on_create?: boolean;
}) {
  const data = await apiRequest<{ room: MatchRoom }>("/match-rooms", {
    method: "POST",
    body: input
  });
  return data.room;
}

export async function createMatchChallenge(input: {
  game_slug: string;
  ruleset_slug: string;
  entry_amount_minor: number;
  commission_bps: number;
  title?: string;
  visibility: MatchChallengeVisibility;
  platform: string;
  region: string;
  skill_level: MatchChallengeSkillLevel;
  expires_at?: string;
}) {
  return apiRequest<{ room: MatchRoom; challenge: MatchChallenge }>("/match-rooms/challenges", {
    method: "POST",
    body: input
  });
}

export async function acceptMatchChallenge(challengeId: string) {
  return apiRequest<{ room: MatchRoom; participant: MatchParticipant; challenge: MatchChallenge }>(
    `/match-rooms/challenges/${encodeURIComponent(challengeId)}/accept`,
    {
      method: "POST",
      body: {}
    }
  );
}

export async function joinRoom(roomCode: string) {
  return apiRequest<{ room?: MatchRoom; [key: string]: unknown }>("/match-rooms/join", {
    method: "POST",
    body: { room_code: roomCode.trim() }
  });
}

export async function openRoom(roomId: string) {
  const data = await apiRequest<{ room: MatchRoom }>(`/match-rooms/${roomId}/open`, {
    method: "POST",
    body: {}
  });
  return data.room;
}

export async function createRoomInvite(input: {
  match_room_id: string;
  invitee_username: string;
  message?: string;
}) {
  return apiRequest<{ invite: Record<string, unknown> }>("/community/invites", {
    method: "POST",
    body: input
  });
}

export async function getRoomTimeline(roomId: string) {
  return apiRequest<MatchTimeline>(`/match-rooms/${roomId}/timeline`);
}

export async function getGames() {
  return apiRequest<GameCatalog>("/games");
}

export async function getRoomFunding(roomId: string) {
  return apiRequest<RoomFundingOverview>(`/match-rooms/${roomId}/funding`);
}

export async function payRoomWithBalance(roomId: string) {
  return apiRequest<{ room: MatchRoom; participant: MatchParticipant; hold: unknown }>(`/match-rooms/${roomId}/balance-funding`, {
    method: "POST",
    body: {}
  });
}

export async function submitManualFunding(roomId: string, input: {
  amount_minor: number;
  collection_bank_name: string;
  collection_account_number: string;
  collection_account_name: string;
  transfer_reference?: string;
  sender_account_name: string;
  sender_bank_name: string;
  proof_url: string;
  proof_note?: string;
}) {
  const data = await apiRequest<{ submission: ManualFundingSubmission }>(`/match-rooms/${roomId}/funding-submissions`, {
    method: "POST",
    body: input
  });
  return data.submission;
}

export async function startMatchPlay(roomId: string) {
  const data = await apiRequest<{ room: MatchRoom }>(`/match-rooms/${roomId}/start-play`, {
    method: "POST",
    body: {}
  });
  return data.room;
}

export async function getRoomResults(roomId: string) {
  return apiRequest<RoomResultOverview>(`/match-rooms/${roomId}/results`);
}

export async function submitResultClaim(roomId: string, input: {
  claimed_winner_participant_id: string;
  score_summary?: string;
  note?: string;
  evidence: Array<{
    evidence_type: "screenshot" | "video" | "link" | "note";
    uri?: string;
    title?: string;
    notes?: string;
  }>;
}) {
  const data = await apiRequest<{ claim: MatchResultClaim }>(`/match-rooms/${roomId}/result-claims`, {
    method: "POST",
    body: input
  });
  return data.claim;
}

export async function respondToResultClaim(claimId: string, input: {
  response: "agree" | "dispute";
  note?: string;
}) {
  return apiRequest(`/match-rooms/result-claims/${claimId}/responses`, {
    method: "POST",
    body: input
  });
}

export async function listRoomLivestreams(roomId: string) {
  const data = await apiRequest<{ livestreams: CommunityLivestreamLink[] }>(
    `/community/livestreams/view?target_type=match_room&match_room_id=${encodeURIComponent(roomId)}`
  );
  return data.livestreams ?? [];
}
