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
  runner_up_username?: string | null;
  runner_up_display_name?: string | null;
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

export type OrganizerKind = "clan" | "host";

export type OrganizerBrand = {
  id: string;
  slug: string;
  kind: OrganizerKind;
  name: string;
  tag: string | null;
  description: string | null;
  region: string | null;
  city: string | null;
  campus: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  reputation_score: number;
  game_focus: string[];
  captain_user_id: string | null;
  captain_username: string | null;
  captain_display_name: string | null;
  created_at: string;
  share_path: string;
};

export type OrganizerRecord = {
  events_hosted: number;
  completed_events: number;
  tournament_wins: number;
  podium_finishes: number;
  match_wins: number;
  match_losses: number;
  match_draws: number;
};

export type OrganizerEvent = {
  tournament_id: string;
  tournament_slug: string;
  title: string;
  status: string;
  format: string;
  game_slug: string;
  game_name: string;
  currency: string;
  entry_fee_amount_minor: number;
  prize_pool_minor: number;
  registered_entry_count: number;
  starts_at: string | null;
  ends_at: string | null;
  role_label: string;
};

export type OrganizerMember = {
  user_id: string;
  role: string;
  username: string | null;
  display_name: string | null;
  reputation_score: number | null;
  city: string | null;
  campus: string | null;
  joined_at: string | null;
};

export type OrganizerLivestream = {
  id: string;
  tournament_id: string | null;
  tournament_title: string | null;
  tournament_slug: string | null;
  provider: string;
  title: string;
  stream_url: string;
  embed_url: string | null;
  is_featured: boolean;
  created_at: string;
};

export type OrganizerAnnouncement = {
  id: string;
  tournament_id: string | null;
  tournament_title: string | null;
  tournament_slug: string | null;
  category: string;
  priority: string;
  title: string;
  summary: string;
  published_at: string | null;
};

export type OrganizerHighlight = {
  tournament_id: string;
  tournament_slug: string;
  title: string;
  game_name: string;
  champion_entry_name: string | null;
  completed_match_count: number;
  projected_prize_minor: number;
  ends_at: string | null;
};

export type OrganizerSpace = {
  organizer: OrganizerBrand;
  record: OrganizerRecord;
  events: OrganizerEvent[];
  members: OrganizerMember[];
  livestreams: OrganizerLivestream[];
  announcements: OrganizerAnnouncement[];
  highlights: OrganizerHighlight[];
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
  rooms_created?: number;
  matches_completed: number;
  tournaments_hosted: number;
  winners_crowned: number;
  disputes_resolved?: number;
  payout_queue_count: number;
  payout_queue_minor?: number;
  refund_queue_count?: number;
  refund_queue_minor?: number;
  prize_reservations_minor: number;
  prize_reservations_count?: number;
  players_registered: number;
  clans_created: number;
  entries_checked_in?: number;
  verified_payouts_completed_count?: number | null;
  verified_payouts_completed_minor?: number | null;
};

export type CommunityTournamentWinnerPage = {
  tournament: {
    id: string;
    slug: string;
    title: string;
    status: string;
    format: string;
    entry_type: string;
    currency: string;
    projected_prize_minor: number;
    game_slug: string | null;
    game_name: string | null;
    registered_entry_count: number;
  };
  winner: {
    entry_id: string | null;
    entry_name: string;
    player_label: string;
    result_label: string;
    rank_path: string | null;
  };
  notable_matches: Array<{
    match_id: string;
    round_name: string;
    result_summary: string | null;
    winner_entry_name: string;
    winner_match_path: string | null;
  }>;
  share_path: string;
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

export async function communityTournamentWinnerPage(tournamentId: string) {
  return apiRequest<CommunityTournamentWinnerPage>(`/community/winners/tournaments/${encodeURIComponent(tournamentId)}`);
}

export async function communityClans(limit = 5) {
  const data = await apiRequest<{ clans: CommunityClan[] }>(`/community/clans?limit=${encodeURIComponent(limit)}`);
  return data.clans ?? [];
}

export async function organizerSpace(organizerIdOrSlug: string) {
  return apiRequest<OrganizerSpace>(`/community/organizers/${encodeURIComponent(organizerIdOrSlug)}`);
}

export async function communityLeaderboard(limit = 10) {
  return apiRequest<{ summary: CommunityLeaderboardSummary; leaderboard: CommunityLeaderboardRow[] }>(`/community/leaderboard?limit=${encodeURIComponent(limit)}`);
}
