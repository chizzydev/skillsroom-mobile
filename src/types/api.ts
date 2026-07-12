export type UserRole = "player" | "support" | "moderator" | "admin" | "owner";

export type AuthUser = {
  id: string;
  email?: string | null;
  username?: string | null;
  display_name?: string | null;
  role?: UserRole;
  status?: string;
  sessionId?: string;
};

export type AuthSession = {
  user?: AuthUser;
  access_token?: string;
  refresh_token?: string;
  accessToken?: string;
  refreshToken?: string;
  token_type?: string;
};

export type MatchRoom = {
  id: string;
  room_code?: string;
  title?: string | null;
  status?: string;
  entry_amount_minor?: number;
  commission_bps?: number;
  currency?: string;
  game_slug?: string;
  game_id?: string;
  ruleset_slug?: string;
  ruleset_id?: string;
  creator_user_id?: string;
  player_a_user_id?: string | null;
  player_b_user_id?: string | null;
  participant_count?: number;
  max_participants?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type MatchParticipant = {
  id: string;
  match_room_id: string;
  user_id: string;
  slot?: "player_a" | "player_b" | string;
  participant_status?: string;
  funding_status?: "pending" | "submitted" | "approved" | "rejected" | "refunded" | string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type MatchStateEvent = {
  id?: string;
  match_room_id: string;
  from_status?: string | null;
  to_status: string;
  reason?: string;
  actor_user_id?: string | null;
  created_at?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type MatchTimeline = {
  room: MatchRoom;
  participants: MatchParticipant[];
  events: MatchStateEvent[];
  tournament_match_check_ins?: Array<Record<string, unknown>>;
};

export type ManualFundingSubmission = {
  id: string;
  match_room_id: string;
  participant_id?: string;
  user_id?: string;
  amount_minor?: number;
  currency?: string;
  status?: "submitted" | "approved" | "rejected" | "cancelled" | string;
  proof_url?: string | null;
  proof_note?: string | null;
  transfer_reference?: string | null;
  sender_bank_name?: string | null;
  sender_account_name?: string | null;
  submitted_at?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type RoomFundingOverview = {
  room: MatchRoom;
  participants: MatchParticipant[];
  submissions?: ManualFundingSubmission[];
  ledger_entries?: Array<Record<string, unknown>>;
};

export type MatchResultClaim = {
  id: string;
  match_room_id: string;
  claimed_winner_participant_id?: string;
  submitted_by_participant_id?: string;
  submitted_by_user_id?: string;
  status?: "submitted" | "opponent_agreed" | "opponent_disputed" | "admin_approved" | "admin_rejected" | "withdrawn" | string;
  score_summary?: string | null;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type MatchResultEvidence = {
  id?: string;
  match_room_id?: string;
  result_claim_id?: string;
  participant_id?: string;
  submitted_by_user_id?: string;
  evidence_type?: "screenshot" | "video" | "link" | "note" | string;
  uri?: string | null;
  title?: string | null;
  notes?: string | null;
  created_at?: string;
  [key: string]: unknown;
};

export type RoomResultOverview = {
  room: MatchRoom;
  participants: MatchParticipant[];
  claims?: MatchResultClaim[];
  evidence_items?: MatchResultEvidence[];
  responses?: Array<Record<string, unknown>>;
  reviews?: Array<Record<string, unknown>>;
};

export type CommunityLivestreamLink = {
  id: string;
  target_type: "tournament" | "match_room" | string;
  match_room_id?: string | null;
  tournament_id?: string | null;
  provider?: string;
  status?: string;
  visibility?: string;
  title?: string;
  stream_url?: string;
  embed_url?: string | null;
  stream_role?: string;
  playback_status?: string;
  display_order?: number;
  is_featured?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type WalletAccount = {
  id: string;
  user_id?: string;
  currency: string;
  available_balance_minor: number;
  locked_balance_minor: number;
  winnings_balance_minor: number;
  status?: "active" | "frozen" | "closed" | string;
  updated_at?: string;
  [key: string]: unknown;
};

export type WalletTopup = {
  id: string;
  currency: string;
  amount_minor: number;
  transfer_reference?: string | null;
  sender_account_name?: string | null;
  sender_bank_name?: string | null;
  proof_url?: string | null;
  proof_note?: string | null;
  status: "submitted" | "approved" | "rejected" | "cancelled" | string;
  submitted_at?: string;
  reviewed_at?: string | null;
  review_note?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type WalletPayoutRequest = {
  id: string;
  currency: string;
  amount_minor: number;
  status: "requested" | "approved" | "paid" | "rejected" | "cancelled" | "failed" | string;
  payout_recipient_name?: string;
  payout_bank_name?: string;
  payout_account_number_masked?: string;
  payout_bank_code?: string | null;
  payout_note?: string | null;
  requested_at?: string;
  reviewed_at?: string | null;
  review_note?: string | null;
  paid_at?: string | null;
  payment_reference?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type WalletLedgerEntry = {
  id: string;
  bucket?: "available" | "locked" | "winnings" | string;
  entry_type?: string;
  direction?: "credit" | "debit" | string;
  currency: string;
  amount_minor: number;
  balance_after_available_minor?: number;
  balance_after_locked_minor?: number;
  balance_after_winnings_minor?: number;
  source_type?: string;
  source_id?: string | null;
  created_at?: string;
  [key: string]: unknown;
};

export type WalletOverview = {
  account?: WalletAccount;
  balance?: {
    available_minor?: number;
    locked_minor?: number;
    winnings_minor?: number;
    currency?: string;
  };
  topups?: WalletTopup[];
  payout_requests?: WalletPayoutRequest[];
  ledger_entries?: WalletLedgerEntry[];
  [key: string]: unknown;
};

export type ChatNotificationLevel = "all" | "mentions" | "none";

export type ChatChannel = {
  id: string;
  slug: string;
  channel_type: "lobby" | "game" | "tournament" | "match_room" | "group" | "dm" | string;
  visibility: "public" | "members" | "private" | string;
  status: "active" | "archived" | "locked" | string;
  title: string;
  description?: string | null;
  game_id?: string | null;
  tournament_id?: string | null;
  match_room_id?: string | null;
  created_by_user_id?: string | null;
  last_message_id?: string | null;
  last_message_at?: string | null;
  created_at?: string;
  updated_at?: string;
  membership_status?: "active" | "muted" | "left" | "removed" | "blocked" | string | null;
  membership_role?: "member" | "moderator" | "admin" | "owner" | string | null;
  membership_last_read_at?: string | null;
  membership_last_seen_at?: string | null;
  unread_count?: number;
  online_count?: number;
  last_message_body?: string | null;
  last_message_sender_label?: string | null;
  last_message_sender_user_id?: string | null;
  slow_mode_seconds?: number;
  lockdown_until?: string | null;
  lockdown_reason?: string | null;
  membership_notification_level?: ChatNotificationLevel | null;
  membership_dm_notification_level?: ChatNotificationLevel | null;
  membership_push_enabled?: boolean | null;
  dm_peer_user_id?: string | null;
  dm_peer_username?: string | null;
  dm_peer_display_name?: string | null;
  dm_peer_label?: string | null;
  [key: string]: unknown;
};

export type ChatReaction = {
  reaction: "like" | "gg" | "fire" | "clap" | "trophy" | "heart" | "laugh" | "wow" | "sad" | "angry" | "hundred" | "game" | string;
  count: number;
  reacted_by_me?: boolean;
};

export type ChatAttachment = {
  id: string;
  channel_id: string;
  message_id?: string | null;
  uploader_user_id: string;
  attachment_type: "image" | "document" | string;
  status: "pending" | "ready" | "attached" | "hidden" | "deleted" | "failed" | string;
  mime_type?: string;
  byte_size?: number;
  width?: number | null;
  height?: number | null;
  original_name?: string | null;
  alt_text?: string | null;
  created_at?: string;
  uploader_label?: string;
  [key: string]: unknown;
};

export type ChatMessage = {
  id: string;
  channel_id: string;
  sender_user_id?: string | null;
  message_kind?: "user" | "system" | string;
  status?: "visible" | "hidden" | "deleted" | "flagged" | string;
  body: string;
  client_message_id?: string | null;
  reply_to_message_id?: string | null;
  reply_to_body?: string | null;
  reply_to_sender_label?: string | null;
  reactions?: ChatReaction[];
  attachments?: ChatAttachment[];
  hidden_at?: string | null;
  deleted_at?: string | null;
  edited_at?: string | null;
  created_at?: string;
  updated_at?: string;
  sender_username?: string | null;
  sender_display_name?: string | null;
  sender_label?: string;
  poll?: ChatPoll | null;
  view?: "full" | "list" | string;
  attachment_count?: number;
  attachment_preview?: Partial<ChatAttachment> | null;
  has_attachments?: boolean;
  has_poll?: boolean;
  poll_summary?: Partial<ChatPoll> | null;
  [key: string]: unknown;
};

export type ChatPollOption = {
  id: string;
  poll_id?: string;
  option_order?: number;
  label: string;
  vote_count?: number;
  voted_by_me?: boolean;
  [key: string]: unknown;
};

export type ChatPoll = {
  id: string;
  channel_id?: string;
  message_id?: string;
  created_by_user_id?: string | null;
  question: string;
  allow_multiple?: boolean;
  status?: "open" | "closed" | "cancelled" | string;
  closes_at?: string | null;
  closed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  options?: ChatPollOption[];
  total_votes?: number;
  [key: string]: unknown;
};

export type ChatPresenceMember = {
  user_id?: string;
  username?: string | null;
  display_name?: string | null;
  label?: string;
  is_online?: boolean;
  is_typing?: boolean;
  last_seen_at?: string;
  typing_until?: string | null;
  [key: string]: unknown;
};

export type ChatPresenceSummary = {
  online_count?: number;
  members?: ChatPresenceMember[];
  active?: ChatPresenceMember[];
  typing?: ChatPresenceMember[];
  [key: string]: unknown;
};

export type ChatMessagePageInfo = {
  has_older?: boolean;
  older_cursor?: string | null;
};

export type ChatMessagesResponse = {
  channel: ChatChannel;
  messages: ChatMessage[];
  pinned_messages?: Array<Record<string, unknown>>;
  presence?: ChatPresenceSummary;
  page_info?: ChatMessagePageInfo;
  read_boundary?: string | null;
};

export type ChatMessageSearchResponse = {
  channel?: ChatChannel;
  messages: ChatMessage[];
  page_info?: ChatMessagePageInfo;
  [key: string]: unknown;
};

export type ChatThreadResponse = {
  channel?: ChatChannel;
  root_message?: ChatMessage | null;
  messages?: ChatMessage[];
  replies?: ChatMessage[];
  [key: string]: unknown;
};

export type ChatDmRequest = {
  id: string;
  requester_user_id?: string;
  recipient_user_id?: string;
  status: "pending" | "accepted" | "declined" | "blocked" | string;
  intro_message?: string | null;
  created_at?: string;
  updated_at?: string;
  responded_at?: string | null;
  channel_id?: string | null;
  channel_slug?: string | null;
  requester_username?: string | null;
  requester_display_name?: string | null;
  requester_label?: string | null;
  recipient_username?: string | null;
  recipient_display_name?: string | null;
  recipient_label?: string | null;
  peer_user_id?: string | null;
  peer_username?: string | null;
  peer_display_name?: string | null;
  peer_label?: string | null;
  [key: string]: unknown;
};

export type ChatAttachmentAccess = {
  storage_key?: string;
  url?: string | null;
  attachment?: ChatAttachment;
  [key: string]: unknown;
};

export type ChatChannelControls = {
  channel?: ChatChannel;
  membership?: {
    notification_level?: ChatNotificationLevel | null;
    dm_notification_level?: ChatNotificationLevel | null;
    push_enabled?: boolean | null;
    [key: string]: unknown;
  } | null;
  notification_level?: ChatNotificationLevel | null;
  dm_notification_level?: ChatNotificationLevel | null;
  push_enabled?: boolean | null;
  slow_mode_seconds?: number;
  lockdown_until?: string | null;
  lockdown_reason?: string | null;
  can_moderate?: boolean;
  [key: string]: unknown;
};

export type ChatMediaResponse = {
  channel?: ChatChannel;
  media?: ChatAttachment[];
  attachments?: ChatAttachment[];
  page_info?: {
    has_older?: boolean;
    older_cursor?: string | null;
  };
  [key: string]: unknown;
};

export type UserNotification = {
  id: string;
  user_id: string;
  actor_user_id?: string | null;
  channel?: "in_app" | "email" | "sms" | string;
  status: "unread" | "read" | "archived" | string;
  title: string;
  body: string;
  action_url?: string | null;
  notification_type: string;
  match_room_id?: string | null;
  metadata?: Record<string, unknown>;
  read_at?: string | null;
  created_at: string;
  [key: string]: unknown;
};

export type MobilePushDevice = {
  id: string;
  user_id: string;
  provider: "expo" | string;
  push_token: string;
  platform: "android" | "ios" | string;
  device_id?: string | null;
  installation_id?: string | null;
  app_version?: string | null;
  enabled: boolean;
  last_registered_at?: string;
  disabled_at?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type RealtimeEvent = {
  id: string;
  audience?: "user" | "operator" | string;
  user_id?: string | null;
  actor_user_id?: string | null;
  event_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  match_room_id?: string | null;
  tournament_id?: string | null;
  notification_id?: string | null;
  payload?: Record<string, unknown>;
  created_at?: string;
  [key: string]: unknown;
};

export type TournamentFormat =
  | "single_elimination"
  | "double_elimination"
  | "round_robin"
  | "swiss"
  | "group_stage_playoffs"
  | "league"
  | "season"
  | "free_for_all"
  | "leaderboard"
  | "race"
  | "time_trial"
  | "grand_prix";

export type TournamentStatus =
  | "draft"
  | "published"
  | "registration_open"
  | "registration_locked"
  | "seeding"
  | "in_progress"
  | "awaiting_results"
  | "under_review"
  | "disputed"
  | "settlement_pending"
  | "completed"
  | "cancelled"
  | "refunded"
  | "voided";

export type Tournament = {
  id: string;
  slug?: string;
  title: string;
  description?: string | null;
  game_id?: string;
  ruleset_id?: string | null;
  game_slug?: string;
  game_name?: string;
  ruleset_slug?: string | null;
  created_by_user_id?: string;
  format: TournamentFormat | string;
  entry_type: "solo" | "team" | string;
  fee_mode: "free" | "paid" | "sponsored" | "hybrid" | string;
  scoring_mode?: "match_win_loss" | "cumulative_score" | "points" | "placement" | string;
  prize_distribution_mode?: "winner_take_all" | "top_2_split" | "top_3_split" | "custom_fixed" | "custom_percentage" | string;
  status: TournamentStatus | string;
  currency: string;
  entry_fee_amount_minor: number;
  sponsored_prize_pool_minor?: number;
  guaranteed_prize_pool_minor?: number;
  commission_bps?: number;
  min_entries: number;
  max_entries: number;
  team_size_min?: number;
  team_size_max?: number;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  registered_entry_count?: number;
  checked_in_entry_count?: number;
  approved_prize_contribution_minor?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type TournamentStateEvent = {
  id: string;
  tournament_id: string;
  from_status?: string | null;
  to_status: string;
  actor_user_id?: string | null;
  reason?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

export type TournamentEntry = {
  id: string;
  tournament_id: string;
  captain_user_id: string;
  display_name: string;
  team_name?: string | null;
  status: string;
  funding_status: string;
  seed?: number | null;
  checked_in_at?: string | null;
  created_at?: string;
  updated_at?: string;
  captain_username?: string | null;
  captain_display_name?: string | null;
  [key: string]: unknown;
};

export type TournamentEntryMember = {
  id: string;
  entry_id: string;
  tournament_id: string;
  user_id: string;
  game_account_id?: string | null;
  member_role?: string;
  status?: string;
  joined_at?: string;
  removed_at?: string | null;
  username?: string | null;
  display_name?: string | null;
  game_handle?: string | null;
  game_account_status?: string | null;
  [key: string]: unknown;
};

export type TournamentStage = {
  id: string;
  tournament_id: string;
  stage_order: number;
  stage_type: string;
  status: string;
  name: string;
  starts_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
};

export type TournamentRound = {
  id: string;
  tournament_id: string;
  stage_id: string;
  round_number: number;
  status: string;
  name: string;
  bracket_side?: string | null;
  group_key?: string | null;
  starts_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
};

export type TournamentMatch = {
  id: string;
  tournament_id: string;
  stage_id: string;
  round_id: string;
  match_room_id?: string | null;
  status: string;
  match_number: number;
  bracket_path?: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  result_summary?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TournamentMatchSide = {
  id: string;
  tournament_match_id: string;
  tournament_id: string;
  entry_id?: string | null;
  side_index: number;
  seed?: number | null;
  score?: number | null;
  result: string;
  is_winner: boolean;
  created_at?: string;
};

export type TournamentMatchCheckIn = {
  id: string;
  tournament_id: string;
  tournament_match_id: string;
  match_room_id: string;
  participant_id: string;
  user_id: string;
  checked_in_at: string;
  metadata?: Record<string, unknown>;
};

export type TournamentStanding = {
  id: string;
  tournament_id: string;
  stage_id?: string | null;
  entry_id: string;
  rank?: number | null;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  tiebreakers?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  updated_at?: string;
};

export type TournamentPrizeAllocation = {
  id: string;
  tournament_id: string;
  entry_id?: string | null;
  rank?: number | null;
  currency: string;
  amount_minor: number;
  status: string;
  notes?: string | null;
  created_at?: string;
};

export type TournamentPrizeContribution = {
  id: string;
  tournament_id: string;
  source: "participant_entries" | "sponsor_contribution" | "platform_bonus" | "manual_adjustment" | string;
  status: "planned" | "submitted" | "approved" | "rejected" | "cancelled" | "refunded" | string;
  contributor_user_id?: string | null;
  tournament_entry_id?: string | null;
  currency: string;
  amount_minor: number;
  external_reference?: string | null;
  proof_url?: string | null;
  payout_recipient_name?: string | null;
  payout_bank_name?: string | null;
  payout_account_number?: string | null;
  payout_account_number_masked?: string | null;
  payout_bank_code?: string | null;
  payout_note?: string | null;
  notes?: string | null;
  created_at?: string;
  tournament_title?: string;
  entry_display_name?: string | null;
  [key: string]: unknown;
};

export type TournamentHost = {
  id: string;
  tournament_id: string;
  user_id: string;
  role: string;
  status: string;
  username?: string | null;
  display_name?: string | null;
  [key: string]: unknown;
};

export type TournamentDetail = Tournament & {
  entries: TournamentEntry[];
  entry_members: TournamentEntryMember[];
  stages: TournamentStage[];
  rounds: TournamentRound[];
  matches: TournamentMatch[];
  match_sides: TournamentMatchSide[];
  match_check_ins: TournamentMatchCheckIn[];
  result_reviews?: Array<Record<string, unknown>>;
  standings: TournamentStanding[];
  prize_allocations: TournamentPrizeAllocation[];
  prize_contributions: TournamentPrizeContribution[];
  hosts: TournamentHost[];
};

export type GameCatalog = {
  games: Array<{ id?: string; slug: string; name: string; platform?: string; [key: string]: unknown }>;
  rulesets: Array<{ id?: string; slug: string; name: string; game_slug?: string; [key: string]: unknown }>;
};

export type PlayerProfile = {
  username?: string | null;
  display_name?: string | null;
  region?: string | null;
  city?: string | null;
  campus?: string | null;
  timezone?: string | null;
  bio?: string | null;
  visibility?: "private" | "room_participants" | "public" | string | null;
  age_confirmed_at?: string | null;
  profile_completed_at?: string | null;
  [key: string]: unknown;
};

export type UserGameAccount = {
  id?: string;
  game_id?: string;
  game_slug?: string;
  handle?: string | null;
  external_uid?: string | null;
  platform?: string | null;
  region?: string | null;
  status?: "pending" | "verified" | "rejected" | "disabled" | string;
  is_primary?: boolean;
  [key: string]: unknown;
};

export type PayoutProfile = {
  recipient_name?: string | null;
  bank_name?: string | null;
  account_number_masked?: string | null;
  bank_code?: string | null;
  payout_note?: string | null;
  currency?: string | null;
  [key: string]: unknown;
};

export type ProfileCompletion = {
  complete?: boolean;
  missing?: string[];
};

export type ProfileOverview = {
  profile?: PlayerProfile | null;
  game_accounts?: UserGameAccount[];
  payout_profile?: PayoutProfile | null;
  completion?: ProfileCompletion;
  trust?: Record<string, unknown> | null;
  user?: AuthUser;
  [key: string]: unknown;
};

export type PlayerTrustSummary = {
  user_id?: string;
  username?: string | null;
  display_name?: string | null;
  reputation_score?: number;
  completed_matches?: number;
  wins?: number;
  losses?: number;
  disputes_opened?: number;
  disputes_lost?: number;
  no_shows?: number;
  profile_complete?: boolean;
  primary_game_handle?: string | null;
  primary_game_external_uid?: string | null;
  primary_game_status?: UserGameAccount["status"] | null;
  moderation_status?: "clear" | "watchlisted" | "restricted" | "suspended" | "banned" | "under_review" | string;
  open_risk_flags?: number;
  trust_level?: "ready" | "review" | "blocked" | "incomplete" | string;
  [key: string]: unknown;
};

export type MyCommunityClanResponse = {
  clan?: {
    id: string;
    slug: string;
    name: string;
    tag?: string | null;
    description?: string | null;
    captain_user_id?: string;
    region?: string | null;
    city?: string | null;
    campus?: string | null;
    avatar_url?: string | null;
    banner_url?: string | null;
    visibility?: "public" | "invite_only" | "hidden" | string;
    moderation_status?: string | null;
    reputation_score?: number | null;
    game_focus?: string[];
    created_at?: string | null;
    updated_at?: string | null;
    [key: string]: unknown;
  } | null;
  members?: Array<{
    user_id: string;
    role?: "captain" | "member" | "substitute" | string;
    status?: string | null;
    joined_at?: string | null;
    username?: string | null;
    display_name?: string | null;
    reputation_score?: number | null;
    campus?: string | null;
    city?: string | null;
    [key: string]: unknown;
  }>;
  tournament_history?: Array<Record<string, unknown>>;
};

export type MyReferralProgramResponse = {
  referral_code?: string;
  referral_path?: string;
  referrals?: Array<{
    id: string;
    status?: "pending_activation" | "reward_eligible" | "reward_issued" | "reward_held" | "rejected" | string;
    issued_rewards?: string[];
    source_path?: string | null;
    channel?: string | null;
    created_at?: string | null;
    referred_username?: string | null;
    referred_display_name?: string | null;
    code?: string;
    [key: string]: unknown;
  }>;
  summary?: {
    total?: number;
    pending_activation?: number;
    reward_issued?: number;
    reward_held?: number;
    [key: string]: unknown;
  };
};

export type StreamingAccount = {
  id: string;
  provider: "youtube" | "twitch" | string;
  display_name?: string | null;
  channel_url?: string | null;
  live_stream_url?: string | null;
  live_embed_url?: string | null;
  live_title?: string | null;
  provider_login?: string | null;
  status?: string | null;
  live_status?: string | null;
  last_live_checked_at?: string | null;
  [key: string]: unknown;
};


