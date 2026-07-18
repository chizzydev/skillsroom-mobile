import { apiRequest } from "./client";

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

export async function playerEngagement(input: { game_slug?: string; city?: string } = {}) {
  const params = new URLSearchParams();
  if (input.game_slug) params.set("game_slug", input.game_slug);
  if (input.city) params.set("city", input.city);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<PlayerEngagementSummary>(`/player/engagement${query}`);
}
