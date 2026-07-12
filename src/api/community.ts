import { apiRequest } from "./client";

export type CommunityAnnouncement = {
  id: string;
  scope: "platform" | "tournament" | string;
  category: "announcement" | "tournament_update" | "winner_post" | "maintenance" | "incident" | "sponsor_note" | string;
  status: "draft" | "published" | "archived" | string;
  priority: "low" | "normal" | "high" | "critical" | string;
  tournament_id: string | null;
  title: string;
  summary: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  published_at: string | null;
  created_at: string;
  tournament_title?: string | null;
  game_name?: string | null;
  author_username?: string | null;
  author_display_name?: string | null;
};

export type CommunityHighlight = {
  tournament_id: string;
  tournament_slug: string;
  title: string;
  status: string;
  format: string;
  entry_type: string;
  game_slug: string;
  game_name: string;
  currency: string;
  projected_prize_minor: number;
  registered_entry_count: number;
  completed_match_count: number;
  champion_entry_name: string | null;
  champion_username: string | null;
  champion_display_name: string | null;
  runner_up_entry_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

export type CommunityClan = {
  id: string;
  slug: string;
  name: string;
  tag: string | null;
  description: string | null;
  region: string;
  city: string | null;
  campus: string | null;
  reputation_score: number;
  game_focus: string[];
  member_count: number;
  completed_tournaments: number;
  tournament_wins: number;
  podium_finishes: number;
  match_record: {
    wins: number;
    losses: number;
    draws: number;
  };
  captain_username?: string | null;
  captain_display_name?: string | null;
};

export type CommunityLeaderboardRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  region: string;
  city: string | null;
  campus: string | null;
  primary_game_name: string | null;
  reputation_score: number;
  leaderboard_score: number;
  rank: number;
  completed_matches: number;
  wins: number;
  losses: number;
  completed_tournaments: number;
  tournament_wins: number;
  podium_finishes: number;
};

export type CommunityLeaderboardSummary = {
  ranked_players: number;
  completed_matches: number;
  completed_tournaments: number;
  tournament_wins: number;
  podium_finishes: number;
  active_games: number;
  active_cities: number;
  active_campuses: number;
};

export type CommunitySocialProofMetrics = {
  matches_completed: number;
  tournaments_hosted: number;
  winners_crowned: number;
  payout_queue_count: number;
  prize_reservations_minor: number;
  players_registered: number;
  clans_created: number;
};

export async function communitySocialProof() {
  const data = await apiRequest<{ metrics: CommunitySocialProofMetrics }>("/community/social-proof");
  return data.metrics;
}

export async function communityAnnouncements(limit = 6) {
  const data = await apiRequest<{ announcements: CommunityAnnouncement[] }>(`/community/announcements?limit=${encodeURIComponent(limit)}`);
  return data.announcements ?? [];
}

export async function communityAnnouncement(announcementId: string) {
  const data = await apiRequest<{ announcement: CommunityAnnouncement }>(`/community/announcements/${encodeURIComponent(announcementId)}`);
  return data.announcement;
}

export async function communityHighlights(limit = 8) {
  const data = await apiRequest<{ tournament_highlights: CommunityHighlight[] }>(`/community/highlights?limit=${encodeURIComponent(limit)}`);
  return data.tournament_highlights ?? [];
}

export async function communityClans(limit = 5) {
  const data = await apiRequest<{ clans: CommunityClan[] }>(`/community/clans?limit=${encodeURIComponent(limit)}`);
  return data.clans ?? [];
}

export async function communityLeaderboard(limit = 10) {
  return apiRequest<{ summary: CommunityLeaderboardSummary; leaderboard: CommunityLeaderboardRow[] }>(`/community/leaderboard?limit=${encodeURIComponent(limit)}`);
}
