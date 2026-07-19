import type { MatchRoom, Tournament, WalletAccount } from "../types/api";
import { apiRequest } from "./client";

export type PlayerHomeReadiness = {
  status: "ready" | "needs_profile" | "needs_game" | "needs_review" | "blocked";
  label: string;
  detail: string;
  missing: string[];
};

export type PlayerHomeRoomPreview = MatchRoom & {
  participant_count: number;
  game_slug: string | null;
  game_name: string | null;
  ruleset_slug: string | null;
  ruleset_title: string | null;
};

export type PlayerLadderRow = {
  rank: number;
  user_id: string;
  username: string | null;
  display_name: string | null;
  city: string | null;
  region: string | null;
  game_slug: string;
  game_name: string;
  wins: number;
  matches_played: number;
  score: number;
};

export type PlayerMission = {
  key: string;
  title: string;
  detail: string;
  progress: number;
  target: number;
  completed: boolean;
  action_label: string;
  action_href: string;
};

export type PlayerEngagementSummary = {
  daily_ladders: PlayerLadderRow[];
  weekly_ladders: PlayerLadderRow[];
  missions: PlayerMission[];
};

export type PlayerHomeSummary = {
  room_status_counts: Record<string, number>;
  active_room_previews: PlayerHomeRoomPreview[];
  open_room_previews: PlayerHomeRoomPreview[];
  recommended_room_previews: PlayerHomeRoomPreview[];
  active_review_previews: PlayerHomeRoomPreview[];
  open_tournament_previews: Tournament[];
  unread_notification_count: number;
  wallet_mini_balance: {
    currency: string;
    available_balance_minor: number;
    locked_balance_minor: number;
    winnings_balance_minor: number;
    status: WalletAccount["status"] | null;
  };
  wallet_readiness: PlayerHomeReadiness;
  profile_readiness: PlayerHomeReadiness;
  play_now_counts: {
    open_rooms: number;
    open_tournaments: number;
    recommended_matches: number;
    active_reviews: number;
  };
  daily_ladders: PlayerLadderRow[];
  weekly_ladders: PlayerLadderRow[];
  missions: PlayerMission[];
  active_tournament_preview_count: number;
  community_highlights_preview: Array<Record<string, unknown>>;
};

export async function playerEngagement(input: { game_slug?: string; city?: string } = {}) {
  const params = new URLSearchParams();
  if (input.game_slug) params.set("game_slug", input.game_slug);
  if (input.city) params.set("city", input.city);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<PlayerEngagementSummary>(`/player/engagement${query}`);
}

export async function playerHomeSummary() {
  return apiRequest<PlayerHomeSummary>("/player/home-summary");
}
