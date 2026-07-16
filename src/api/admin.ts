import type {
  AuthUser,
  GameCatalog,
  ManualFundingSubmission,
  MatchResultClaim,
  PlayerProfile,
  PayoutProfile,
  Tournament,
  TournamentDetail,
  TournamentFormat,
  TournamentPrizeContribution,
  TournamentStateEvent,
  UserGameAccount,
  UserRole,
  WalletLedgerEntry,
  WalletPayoutRequest,
  WalletTopup
} from "../types/api";
import { apiRequest } from "./client";

export type AdminSection =
  | "overview"
  | "funding"
  | "wallet"
  | "results"
  | "settlements"
  | "tournaments"
  | "players"
  | "team"
  | "risk";

export type AdminLane = {
  key: AdminSection;
  label: string;
  detail: string;
};

export type AdminWorkItem = {
  id: string;
  type: string;
  room: string;
  actor: string;
  context: string;
  priority: string;
  tone: "cyan" | "green" | "amber" | "red";
  lane: AdminSection;
};

type AdminList<T, K extends string> = Record<K, T[]>;

type MoneyRow = {
  id: string;
  match_room_id?: string;
  user_id?: string;
  currency?: string;
  amount_minor?: number;
  payout_minor?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

type ResultClaimRow = {
  id: string;
  match_room_id?: string;
  claimant_user_id?: string;
  submitted_by_user_id?: string;
  score_summary?: string | null;
  status?: string;
  [key: string]: unknown;
};

type RiskFlagRow = {
  id: string;
  user_id?: string;
  severity?: string;
  summary?: string;
  [key: string]: unknown;
};

type RoomHoldRow = {
  id: string;
  match_room_id?: string;
  severity?: string;
  reason?: string;
  [key: string]: unknown;
};

type AnnouncementRow = {
  id: string;
  title?: string;
  summary?: string | null;
  status?: string;
  priority?: string;
  created_at?: string;
  published_at?: string | null;
  [key: string]: unknown;
};

export type CommunityAnnouncementCategory =
  | "announcement"
  | "tournament_update"
  | "maintenance"
  | "incident"
  | "winner_post"
  | "sponsor_note";

export type CommunityAnnouncementPriority = "low" | "normal" | "high" | "critical";

export type CreateCommunityAnnouncementInput = {
  scope: "platform" | "tournament";
  category: CommunityAnnouncementCategory;
  priority: CommunityAnnouncementPriority;
  title: string;
  summary?: string;
  body: string;
  cta_label?: string;
  cta_url?: string;
  publish_now?: boolean;
};

export type ChatChannelType = "game" | "tournament" | "match_room" | "group";
export type ChatChannelVisibility = "public" | "members" | "private";

export type CreateChatChannelInput = {
  channel_type: ChatChannelType;
  title?: string;
  slug?: string;
  description?: string;
  visibility?: ChatChannelVisibility;
  game_slug?: string;
  tournament_id?: string;
  match_room_id?: string;
};

export type AdminOverviewData = {
  lanes: AdminLane[];
  counts: {
    funding: number;
    results: number;
    settlements: number;
    walletTopups: number;
    walletPayouts: number;
    payments: number;
    safety: number;
    announcements: number;
  };
  workItems: AdminWorkItem[];
  announcements: AnnouncementRow[];
  loadErrors: string[];
};

export type TeamRole = "player" | "support" | "moderator" | "admin" | "owner";

export type AdminTeamMember = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  profile_display_name: string | null;
  user_role: TeamRole;
  user_status: "active" | "locked" | "disabled";
  team_member_id: string | null;
  team_role: TeamRole | null;
  team_status: "invited" | "active" | "suspended" | "removed" | null;
  is_platform_owner: boolean;
  ownership_percentage: string | null;
  invited_by_user_id: string | null;
  activated_at: string | null;
  suspended_at: string | null;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
  team_updated_at: string | null;
};

export type ManualFundingSubmissionStatus = NonNullable<ManualFundingSubmission["status"]>;

export type AdminStepUpResult = {
  step_up_token: string;
  expires_at?: string;
};

export type ReviewFundingSubmissionInput = {
  decision: "approve" | "reject";
  note?: string;
  stepUpToken: string;
};

export type WalletTopupStatus = NonNullable<WalletTopup["status"]>;
export type WalletPayoutRequestStatus = NonNullable<WalletPayoutRequest["status"]>;

export type WalletHold = {
  id: string;
  user_id?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  currency: string;
  amount_minor: number;
  status?: string;
  reason?: string | null;
  created_at?: string;
  [key: string]: unknown;
};

export type SuspiciousWalletTopupGroup = {
  duplicate_type: "transfer_reference" | "proof_url";
  group_key: string;
  occurrence_count: number;
  user_count: number;
  amount_minor_total: number;
  first_seen_at?: string;
  last_seen_at?: string;
  sample_topup_ids?: string[];
};

export type WalletFinancialTimelineItem = {
  id: string;
  event_type: string;
  source_table: string;
  user_id?: string | null;
  currency?: string | null;
  amount_minor?: number;
  status?: string | null;
  detail?: string | null;
  created_at?: string;
  [key: string]: unknown;
};

export type AdminWalletDashboard = {
  pending_topups: WalletTopup[];
  suspicious_duplicates: SuspiciousWalletTopupGroup[];
  active_holds: WalletHold[];
  payout_requests: WalletPayoutRequest[];
  recent_ledger_entries: WalletLedgerEntry[];
  room_financial_timeline: WalletFinancialTimelineItem[];
  tournament_financial_timeline: WalletFinancialTimelineItem[];
  guardrails?: string[];
};

export type AdminWalletDashboardInput = {
  userId?: string;
  matchRoomId?: string;
  tournamentId?: string;
  limit?: number;
};

export type ReviewWalletTopupInput = {
  decision: "approve" | "reject";
  note?: string;
  stepUpToken: string;
};

export type ReviewWalletPayoutInput = {
  decision: "mark_paid" | "reject";
  payment_reference?: string;
  note?: string;
  stepUpToken: string;
};

export type ResultClaimStatus = NonNullable<MatchResultClaim["status"]>;
export type ResultReviewDecision = "approve_claim" | "approve_no_response" | "reject_claim" | "mark_disputed" | "void_match";

export type PlayerTrustSummary = {
  user_id?: string;
  username?: string | null;
  display_name?: string | null;
  reputation_score?: number | null;
  completed_matches?: number | null;
  wins?: number | null;
  losses?: number | null;
  disputes_opened?: number | null;
  disputes_lost?: number | null;
  no_shows?: number | null;
  profile_complete?: boolean;
  primary_game_handle?: string | null;
  primary_game_external_uid?: string | null;
  primary_game_status?: UserGameAccount["status"] | null;
  moderation_status?: "clear" | "watchlisted" | "restricted" | "suspended" | "banned" | "under_review" | string;
  open_risk_flags?: number;
  trust_level?: "ready" | "review" | "blocked" | "incomplete" | string;
  trust_score?: number | null;
  [key: string]: unknown;
};

export type ReviewResultClaimInput = {
  decision: ResultReviewDecision;
  note?: string;
  stepUpToken: string;
};

export type PaymentStatus = "queued" | "completed" | "failed";
export type SettlementStatus = "payout_pending" | "completed" | "cancelled";
export type RefundStatus = "queued" | "completed" | "failed";

export type TournamentEntryType = "solo" | "team";
export type TournamentFeeMode = "free" | "paid" | "sponsored" | "hybrid";
export type TournamentScoringMode = "match_win_loss" | "cumulative_score" | "points" | "placement";
export type TournamentPrizeDistributionMode = "winner_take_all" | "top_2_split" | "top_3_split" | "custom_fixed" | "custom_percentage";
export type TournamentSeedMode = "registration_order" | "random" | "reputation" | "manual";
export type TournamentResultReviewDecision = "confirm_score" | "mark_disputed" | "void_match" | "forfeit_entry" | "no_show_entry" | "disqualify_entry";
export type TournamentHostRole = "creator" | "co_host" | "sponsor";

export type CreateTournamentInput = {
  title: string;
  description?: string;
  game_slug: string;
  ruleset_slug?: string;
  format: TournamentFormat;
  entry_type: TournamentEntryType;
  fee_mode: TournamentFeeMode;
  scoring_mode: TournamentScoringMode;
  prize_distribution_mode: TournamentPrizeDistributionMode;
  currency: string;
  entry_fee_amount_minor: number;
  sponsored_prize_pool_minor?: number;
  guaranteed_prize_pool_minor?: number;
  commission_bps?: number;
  min_entries: number;
  max_entries: number;
  team_size_min?: number;
  team_size_max?: number;
  registration_opens_at?: string;
  registration_closes_at?: string;
  starts_at?: string;
  ends_at?: string;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type TournamentCumulativeScoreResultInput = {
  entry_id: string;
  placement?: number;
  score?: number;
  kills?: number;
  time_ms?: number;
  bonus_points?: number;
  penalty_points?: number;
  metadata?: Record<string, unknown>;
};

export type LeaderboardRow = {
  user_id: string;
  username: string;
  display_name?: string | null;
  region?: string | null;
  city?: string | null;
  campus?: string | null;
  primary_game_slug?: string | null;
  primary_game_name?: string | null;
  primary_game_handle?: string | null;
  reputation_score: number;
  leaderboard_score?: number;
  rank: number;
  completed_matches: number;
  wins: number;
  losses: number;
  disputes_lost: number;
  no_shows: number;
  completed_tournaments?: number;
  tournament_wins?: number;
  podium_finishes?: number;
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

export type AdminGameAccount = {
  id: string;
  user_id: string;
  game_id?: string | null;
  game_slug?: string | null;
  game_name?: string | null;
  handle: string;
  external_uid?: string | null;
  platform?: string | null;
  region?: string | null;
  status: UserGameAccount["status"];
  is_primary?: boolean;
  verification_notes?: string | null;
  verified_by_user_id?: string | null;
  verified_at?: string | null;
  created_at?: string;
  updated_at?: string;
  username?: string | null;
  display_name?: string | null;
  user_email?: string | null;
  [key: string]: unknown;
};

export type AdminRiskFlag = {
  id: string;
  user_id?: string | null;
  flag_type?: string;
  severity?: "low" | "medium" | "high" | "critical" | string;
  status?: "open" | "reviewing" | "resolved" | "dismissed" | string;
  summary?: string;
  created_by_user_id?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type AdminRoomHold = {
  id: string;
  match_room_id: string;
  status: "active" | "released" | "expired" | string;
  reason: string;
  severity: "low" | "medium" | "high" | "critical" | string;
  created_by_user_id?: string | null;
  created_at?: string;
  [key: string]: unknown;
};

export type AdminModerationAction = {
  id: string;
  target_user_id?: string | null;
  match_room_id?: string | null;
  action_type: "note" | "warn" | "restrict" | "suspend" | "ban" | "release_hold" | "room_hold" | string;
  status: "active" | "expired" | "reversed" | string;
  severity: "low" | "medium" | "high" | "critical" | string;
  summary: string;
  created_by_user_id?: string | null;
  created_at?: string;
  [key: string]: unknown;
};

export type AdminRiskDashboard = {
  risk_flags: Array<{ status: string; severity: string; count: string }>;
  room_holds: Array<{ status: string; count: string }>;
  moderation_actions: Array<{ action_type: string; count: string }>;
  users: Array<{ moderation_status: string; count: string }>;
};

export type ChatModerationEvent = {
  id: string;
  channel_id: string;
  message_id?: string | null;
  target_user_id?: string | null;
  actor_user_id?: string | null;
  event_type:
    | "message_hidden"
    | "message_deleted"
    | "message_reported"
    | "member_muted"
    | "member_unmuted"
    | "channel_locked"
    | "channel_unlocked"
    | string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  channel_slug?: string | null;
  channel_title?: string | null;
  message_body?: string | null;
  message_status?: string | null;
  sender_username?: string | null;
  sender_display_name?: string | null;
  actor_username?: string | null;
  actor_display_name?: string | null;
};

export type ChatDmRequest = {
  id: string;
  requester_user_id: string;
  recipient_user_id: string;
  channel_id?: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled" | string;
  intro_message?: string | null;
  responded_at?: string | null;
  created_at: string;
  updated_at?: string;
  requester_username?: string | null;
  requester_display_name?: string | null;
  recipient_username?: string | null;
  recipient_display_name?: string | null;
  channel_slug?: string | null;
  channel_title?: string | null;
  requester_label?: string;
  recipient_label?: string;
};

export type ChatUserBlock = {
  blocker_user_id: string;
  blocked_user_id: string;
  reason?: string | null;
  created_at: string;
  blocker_username?: string | null;
  blocker_display_name?: string | null;
  blocked_username?: string | null;
  blocked_display_name?: string | null;
  blocker_label?: string;
  blocked_label?: string;
};

export type EvidenceAccessEvent = {
  id: string;
  event: string;
  severity: "info" | "warning" | "critical" | string;
  actor_user_id?: string | null;
  actor_role?: string | null;
  target_user_id?: string | null;
  request_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  request_method?: string | null;
  request_path?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type CreateRiskFlagInput = {
  user_id: string;
  flag_type: string;
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
};

export type CreateRoomHoldInput = {
  match_room_id: string;
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
};

export type CreateModerationActionInput = {
  action_type: "note" | "warn" | "restrict" | "suspend" | "ban" | "release_hold" | "room_hold";
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
  target_user_id?: string;
  match_room_id?: string;
  stepUpToken: string;
};

export type AdminPlayerProfile = {
  user: AuthUser;
  profile: PlayerProfile | null;
  payout_profile?: PayoutProfile | null;
  game_accounts: AdminGameAccount[];
  risk_flags: AdminRiskFlag[];
};

export type MatchSettlement = {
  id: string;
  match_room_id: string;
  result_claim_id?: string | null;
  winner_user_id?: string | null;
  currency: string;
  gross_pool_minor?: number;
  commission_minor?: number;
  payout_minor: number;
  status: string;
  reserved_at: string;
  completed_at?: string | null;
  notes?: string | null;
  room_code?: string | null;
  room_title?: string | null;
  winner_username?: string | null;
  winner_display_name?: string | null;
  winner_primary_game_handle?: string | null;
  winner_primary_game_external_uid?: string | null;
};

export type MatchPayout = {
  id: string;
  settlement_id: string;
  match_room_id: string;
  user_id: string;
  currency: string;
  amount_minor: number;
  status: string;
  payout_reference?: string | null;
  completion_proof_url?: string | null;
  recipient_name?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  account_number_masked?: string | null;
  bank_code?: string | null;
  payout_note?: string | null;
  instruction_status?: "ready" | "missing";
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
  room_code?: string | null;
  room_title?: string | null;
  username?: string | null;
  display_name?: string | null;
  primary_game_handle?: string | null;
  primary_game_external_uid?: string | null;
};

export type MatchRefund = {
  id: string;
  match_room_id: string;
  user_id: string;
  currency: string;
  amount_minor: number;
  status: string;
  reason?: string | null;
  refund_reference?: string | null;
  completion_proof_url?: string | null;
  recipient_name?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  account_number_masked?: string | null;
  bank_code?: string | null;
  payout_note?: string | null;
  instruction_status?: "ready" | "missing";
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
  room_code?: string | null;
  room_title?: string | null;
  username?: string | null;
  display_name?: string | null;
  primary_game_handle?: string | null;
  primary_game_external_uid?: string | null;
};

export type TournamentSettlement = {
  id: string;
  tournament_id: string;
  currency: string;
  gross_pool_minor?: number;
  commission_minor?: number;
  payout_pool_minor: number;
  status: string;
  reserved_at: string;
  completed_at?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type TournamentPayout = {
  id: string;
  settlement_id: string;
  tournament_id: string;
  entry_id?: string | null;
  user_id: string;
  currency: string;
  amount_minor: number;
  status: string;
  payout_reference?: string | null;
  completion_proof_url?: string | null;
  recipient_name?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  account_number_masked?: string | null;
  bank_code?: string | null;
  payout_note?: string | null;
  instruction_status?: "ready" | "missing";
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
  tournament_title?: string | null;
  entry_display_name?: string | null;
  username?: string | null;
  display_name?: string | null;
  primary_game_handle?: string | null;
  primary_game_external_uid?: string | null;
};

export type TournamentRefund = {
  id: string;
  tournament_id: string;
  entry_id?: string | null;
  user_id: string;
  currency: string;
  amount_minor: number;
  status: string;
  reason?: string | null;
  refund_reference?: string | null;
  completion_proof_url?: string | null;
  recipient_name?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  account_number_masked?: string | null;
  bank_code?: string | null;
  payout_note?: string | null;
  instruction_status?: "ready" | "missing";
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
  tournament_title?: string | null;
  entry_display_name?: string | null;
  username?: string | null;
  display_name?: string | null;
  primary_game_handle?: string | null;
  primary_game_external_uid?: string | null;
};

export type CompletePayoutInput = {
  payout_reference?: string;
  completion_proof_url: string;
  stepUpToken: string;
};

export type CompleteRefundInput = {
  refund_reference?: string;
  completion_proof_url: string;
  stepUpToken: string;
};

export type UpdatePaymentInstructionsInput = {
  recipient_name?: string;
  bank_name?: string;
  account_number?: string;
  bank_code?: string;
  payout_note?: string;
  use_fallback?: boolean;
  stepUpToken: string;
};

export function canAccessAdmin(user: AuthUser | null | undefined) {
  return Boolean(user && ["support", "moderator", "admin", "owner"].includes(user.role ?? "player") && user.status !== "locked" && user.status !== "disabled");
}

export function roleLabel(role?: UserRole) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Community Manager";
  if (role === "support") return "Support";
  return "Player";
}

export function canUseAdminSection(user: AuthUser | null | undefined, section: AdminSection) {
  if (!canAccessAdmin(user)) return false;
  if (user?.role === "owner") return true;

  const sectionsByRole: Record<Exclude<UserRole, "player" | "owner">, AdminSection[]> = {
    admin: ["overview", "funding", "wallet", "results", "settlements", "tournaments"],
    moderator: ["overview", "results", "tournaments", "players", "risk"],
    support: ["overview", "players", "risk"]
  };

  return user?.role ? sectionsByRole[user.role as Exclude<UserRole, "player" | "owner">]?.includes(section) ?? false : false;
}

export function adminLanesFor(user: AuthUser | null | undefined): AdminLane[] {
  const lanes: AdminLane[] = [
    { key: "overview", label: "Overview", detail: "Everything waiting across your allowed workspace." },
    { key: "funding", label: "Funding", detail: "Manual transfers and room entry checks." },
    { key: "wallet", label: "Wallet", detail: "Top-ups, wallet payouts, and ledger-sensitive reviews." },
    { key: "results", label: "Results", detail: "Match claims, proof, disputes, and review decisions." },
    { key: "settlements", label: "Payments", detail: "Winner payouts, refunds, and settlement reserves." },
    { key: "tournaments", label: "Tournaments", detail: "Event operations, bracket health, and host support." },
    { key: "players", label: "Players", detail: "Player records, trust signals, and support context." },
    { key: "risk", label: "Safety", detail: "Reports, room holds, and moderation controls." },
    { key: "team", label: "Team roles", detail: "Owner-only team access management." }
  ];

  return lanes.filter((lane) => canUseAdminSection(user, lane.key));
}

function money(currency = "NGN", minor = 0) {
  return `${currency} ${Math.round(minor / 100).toLocaleString()}`;
}

function valueText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function severityTone(severity?: string): AdminWorkItem["tone"] {
  return severity === "critical" || severity === "high" ? "red" : "amber";
}

function fundingWorkItem(row: MoneyRow): AdminWorkItem {
  return {
    id: row.id,
    type: "Funding review",
    room: valueText(row.match_room_id, "Room"),
    actor: valueText(row.user_id, "Player"),
    context: money(row.currency, row.amount_minor),
    priority: "Verify transfer",
    tone: "amber",
    lane: "funding"
  };
}

function walletTopupWorkItem(row: MoneyRow): AdminWorkItem {
  return {
    id: row.id,
    type: "Wallet top-up",
    room: "Wallet",
    actor: valueText(row.user_id, "Player"),
    context: money(row.currency, row.amount_minor),
    priority: "Bank check",
    tone: "amber",
    lane: "wallet"
  };
}

function walletPayoutWorkItem(row: MoneyRow): AdminWorkItem {
  return {
    id: row.id,
    type: "Wallet payout",
    room: "Wallet",
    actor: valueText(row.user_id, "Player"),
    context: money(row.currency, row.amount_minor),
    priority: "Pay winnings",
    tone: "red",
    lane: "wallet"
  };
}

function resultWorkItem(row: ResultClaimRow): AdminWorkItem {
  return {
    id: row.id,
    type: "Result claim",
    room: valueText(row.match_room_id, "Room"),
    actor: valueText(row.claimant_user_id ?? row.submitted_by_user_id, "Player"),
    context: row.score_summary?.trim() || "No score line supplied",
    priority: "Evidence check",
    tone: "cyan",
    lane: "results"
  };
}

function settlementWorkItem(row: MoneyRow): AdminWorkItem {
  return {
    id: row.id,
    type: "Settlement reserve",
    room: valueText(row.match_room_id, "Room"),
    actor: valueText(row.user_id, "Winner"),
    context: money(row.currency, row.payout_minor ?? row.amount_minor),
    priority: "Queue payout",
    tone: "green",
    lane: "settlements"
  };
}

function payoutWorkItem(row: MoneyRow): AdminWorkItem {
  return {
    id: row.id,
    type: "Manual payout",
    room: valueText(row.match_room_id, "Room"),
    actor: valueText(row.user_id, "Player"),
    context: money(row.currency, row.amount_minor),
    priority: "Bank transfer",
    tone: "green",
    lane: "settlements"
  };
}

function refundWorkItem(row: MoneyRow): AdminWorkItem {
  return {
    id: row.id,
    type: "Manual refund",
    room: valueText(row.match_room_id, "Room"),
    actor: valueText(row.user_id, "Player"),
    context: money(row.currency, row.amount_minor),
    priority: "Return funds",
    tone: "red",
    lane: "settlements"
  };
}

function riskWorkItem(row: RiskFlagRow): AdminWorkItem {
  return {
    id: row.id,
    type: "Player safety flag",
    room: "User",
    actor: valueText(row.user_id, "Player"),
    context: valueText(row.summary, "Safety review"),
    priority: valueText(row.severity, "Review"),
    tone: severityTone(row.severity),
    lane: "risk"
  };
}

function holdWorkItem(row: RoomHoldRow): AdminWorkItem {
  return {
    id: row.id,
    type: "Room hold",
    room: valueText(row.match_room_id, "Room"),
    actor: "Skillsroom team",
    context: valueText(row.reason, "Room moderation hold"),
    priority: valueText(row.severity, "Review"),
    tone: severityTone(row.severity),
    lane: "risk"
  };
}

async function safeList<T, K extends string>(path: string, key: K, label: string, errors: string[]) {
  try {
    const data = await apiRequest<AdminList<T, K>>(path);
    return data[key] ?? [];
  } catch {
    errors.push(`${label} could not be loaded.`);
    return [];
  }
}

export async function adminOverview(user: AuthUser | null | undefined): Promise<AdminOverviewData> {
  const loadErrors: string[] = [];
  const canFunding = canUseAdminSection(user, "funding");
  const canWallet = canUseAdminSection(user, "wallet");
  const canResults = canUseAdminSection(user, "results");
  const canSettlements = canUseAdminSection(user, "settlements");
  const canRisk = canUseAdminSection(user, "risk");
  const canManageCommunity = user?.role === "owner" || user?.role === "admin";

  const [
    funding,
    walletTopups,
    walletPayouts,
    results,
    settlements,
    payouts,
    refunds,
    flags,
    holds,
    announcements
  ] = await Promise.all([
    canFunding ? safeList<MoneyRow, "submissions">("/admin/funding/submissions?status=submitted", "submissions", "Funding queue", loadErrors) : Promise.resolve([]),
    canWallet ? safeList<MoneyRow, "topups">("/admin/wallet/topups?status=submitted", "topups", "Wallet top-ups", loadErrors) : Promise.resolve([]),
    canWallet ? safeList<MoneyRow, "payout_requests">("/admin/wallet/payout-requests?status=requested", "payout_requests", "Wallet payouts", loadErrors) : Promise.resolve([]),
    canResults ? safeList<ResultClaimRow, "claims">("/admin/results/claims?status=submitted", "claims", "Result review queue", loadErrors) : Promise.resolve([]),
    canSettlements ? safeList<MoneyRow, "settlements">("/admin/settlements/settlements?status=payout_pending", "settlements", "Settlement queue", loadErrors) : Promise.resolve([]),
    canSettlements ? safeList<MoneyRow, "payouts">("/admin/settlements/payouts?status=queued", "payouts", "Payout queue", loadErrors) : Promise.resolve([]),
    canSettlements ? safeList<MoneyRow, "refunds">("/admin/settlements/refunds?status=queued", "refunds", "Refund queue", loadErrors) : Promise.resolve([]),
    canRisk ? safeList<RiskFlagRow, "flags">("/admin/risk/flags?status=open", "flags", "Safety flags", loadErrors) : Promise.resolve([]),
    canRisk ? safeList<RoomHoldRow, "holds">("/admin/risk/room-holds?status=active", "holds", "Room holds", loadErrors) : Promise.resolve([]),
    canManageCommunity ? safeList<AnnouncementRow, "announcements">("/community/announcements/manage?scope=platform&limit=8", "announcements", "Community publishing tools", loadErrors) : Promise.resolve([])
  ]);

  const workItems = [
    ...funding.map(fundingWorkItem),
    ...walletTopups.map(walletTopupWorkItem),
    ...walletPayouts.map(walletPayoutWorkItem),
    ...results.map(resultWorkItem),
    ...settlements.map(settlementWorkItem),
    ...payouts.map(payoutWorkItem),
    ...refunds.map(refundWorkItem),
    ...flags.map(riskWorkItem),
    ...holds.map(holdWorkItem)
  ].slice(0, 12);

  return {
    lanes: adminLanesFor(user),
    counts: {
      funding: funding.length,
      results: results.length,
      settlements: settlements.length,
      walletTopups: walletTopups.length,
      walletPayouts: walletPayouts.length,
      payments: payouts.length + refunds.length,
      safety: flags.length + holds.length,
      announcements: announcements.length
    },
    workItems,
    announcements,
    loadErrors
  };
}

export async function createCommunityAnnouncement(input: CreateCommunityAnnouncementInput) {
  const data = await apiRequest<{ announcement: AnnouncementRow }>("/community/announcements", {
    method: "POST",
    body: input
  });
  return data.announcement;
}

export async function publishCommunityAnnouncement(announcementId: string) {
  const data = await apiRequest<{ announcement: AnnouncementRow }>(
    `/community/announcements/${encodeURIComponent(announcementId)}/publish`,
    { method: "POST", body: {} }
  );
  return data.announcement;
}

export async function archiveCommunityAnnouncement(announcementId: string) {
  const data = await apiRequest<{ announcement: AnnouncementRow }>(
    `/community/announcements/${encodeURIComponent(announcementId)}/archive`,
    { method: "POST", body: {} }
  );
  return data.announcement;
}

export async function createChatChannel(input: CreateChatChannelInput) {
  return apiRequest<{ channel: unknown }>("/community/channels", {
    method: "POST",
    body: input
  });
}

export async function confirmAdminStepUp(password: string) {
  return apiRequest<AdminStepUpResult>("/auth/step-up", {
    method: "POST",
    body: { password }
  });
}

export async function listAdminTeamMembers() {
  const data = await apiRequest<{ members: AdminTeamMember[] }>("/admin/team/members");
  return data.members ?? [];
}

export async function updateAdminTeamMemberRole(input: {
  userId: string;
  role: Exclude<TeamRole, "owner">;
  note?: string;
  stepUpToken: string;
}) {
  const data = await apiRequest<{ members: AdminTeamMember[] }>(`/admin/team/members/${encodeURIComponent(input.userId)}/role`, {
    method: "PATCH",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: {
      role: input.role,
      note: input.note?.trim() || undefined
    }
  });
  return data.members ?? [];
}

export async function getAdminRiskDashboard() {
  return apiRequest<AdminRiskDashboard>("/admin/risk/dashboard");
}

export async function listAdminRiskFlags(status = "open") {
  const data = await apiRequest<{ flags: AdminRiskFlag[] }>(`/admin/risk/flags?status=${encodeURIComponent(status)}`);
  return data.flags ?? [];
}

export async function createAdminRiskFlag(input: CreateRiskFlagInput) {
  const data = await apiRequest<{ flag: AdminRiskFlag }>("/admin/risk/flags", {
    method: "POST",
    body: {
      user_id: input.user_id.trim(),
      flag_type: input.flag_type.trim(),
      severity: input.severity,
      summary: input.summary.trim()
    }
  });
  return data.flag;
}

export async function updateAdminRiskFlagStatus(flagId: string, status: "open" | "reviewing" | "resolved" | "dismissed") {
  const data = await apiRequest<{ flag: AdminRiskFlag }>(`/admin/risk/flags/${encodeURIComponent(flagId)}`, {
    method: "PATCH",
    body: { status }
  });
  return data.flag;
}

export async function listAdminRoomHolds(status = "active") {
  const data = await apiRequest<{ holds: AdminRoomHold[] }>(`/admin/risk/room-holds?status=${encodeURIComponent(status)}`);
  return data.holds ?? [];
}

export async function createAdminRoomHold(input: CreateRoomHoldInput) {
  const data = await apiRequest<{ hold: AdminRoomHold }>("/admin/risk/room-holds", {
    method: "POST",
    body: {
      match_room_id: input.match_room_id.trim(),
      reason: input.reason.trim(),
      severity: input.severity
    }
  });
  return data.hold;
}

export async function releaseAdminRoomHold(holdId: string, releaseNote: string) {
  const data = await apiRequest<{ hold: AdminRoomHold }>(`/admin/risk/room-holds/${encodeURIComponent(holdId)}/release`, {
    method: "POST",
    body: { release_note: releaseNote.trim() || undefined }
  });
  return data.hold;
}

export async function listAdminModerationActions() {
  const data = await apiRequest<{ actions: AdminModerationAction[] }>("/admin/risk/actions");
  return data.actions ?? [];
}

export async function createAdminModerationAction(input: CreateModerationActionInput) {
  const data = await apiRequest<{ action: AdminModerationAction }>("/admin/risk/actions", {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: {
      action_type: input.action_type,
      severity: input.severity,
      summary: input.summary.trim(),
      target_user_id: input.target_user_id?.trim() || undefined,
      match_room_id: input.match_room_id?.trim() || undefined
    }
  });
  return data.action;
}

export async function listAdminChatModerationQueue() {
  const data = await apiRequest<{ events: ChatModerationEvent[] }>("/community/chat-moderation");
  return data.events ?? [];
}

export async function hideAdminChatMessage(channelIdOrSlug: string, messageId: string, reason: string) {
  return apiRequest<{ event: ChatModerationEvent }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/hide`,
    {
      method: "POST",
      body: { reason: reason.trim() }
    }
  );
}

export async function deleteAdminChatMessage(channelIdOrSlug: string, messageId: string, reason?: string) {
  return apiRequest<{ event: ChatModerationEvent }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/delete`,
    {
      method: "POST",
      body: { reason: reason?.trim() || undefined }
    }
  );
}

export async function muteAdminChatMember(channelIdOrSlug: string, input: { user_id: string; duration_minutes: number; reason: string }) {
  return apiRequest<{ event: ChatModerationEvent }>(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/members/mute`, {
    method: "POST",
    body: {
      user_id: input.user_id.trim(),
      duration_minutes: input.duration_minutes,
      reason: input.reason.trim()
    }
  });
}

export async function getAdminDmAbuseQueue() {
  return apiRequest<{ requests: ChatDmRequest[]; blocks: ChatUserBlock[]; retention_policy: Record<string, string> }>("/community/dm-abuse");
}

export async function listAdminEvidenceAccessEvents(limit = 30) {
  const data = await apiRequest<{ events: EvidenceAccessEvent[] }>(`/evidence/access-events?limit=${encodeURIComponent(String(limit))}`);
  return data.events ?? [];
}

export async function listAdminFundingSubmissions(status: ManualFundingSubmissionStatus = "submitted") {
  const data = await apiRequest<{ submissions: ManualFundingSubmission[] }>(
    `/admin/funding/submissions?status=${encodeURIComponent(status)}`
  );
  return data.submissions ?? [];
}

export async function reviewAdminFundingSubmission(submissionId: string, input: ReviewFundingSubmissionInput) {
  const data = await apiRequest<{ submission: ManualFundingSubmission }>(
    `/admin/funding/submissions/${encodeURIComponent(submissionId)}/review`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: {
        decision: input.decision,
        note: input.note?.trim() || undefined
      }
    }
  );
  return data.submission;
}

export async function listAdminWalletTopups(status: WalletTopupStatus = "submitted") {
  const data = await apiRequest<{ topups: WalletTopup[] }>(`/admin/wallet/topups?status=${encodeURIComponent(status)}`);
  return data.topups ?? [];
}

export async function listAdminWalletPayoutRequests(status: WalletPayoutRequestStatus = "requested") {
  const data = await apiRequest<{ payout_requests: WalletPayoutRequest[] }>(
    `/admin/wallet/payout-requests?status=${encodeURIComponent(status)}`
  );
  return data.payout_requests ?? [];
}

export async function getAdminWalletDashboard(input: AdminWalletDashboardInput = {}) {
  const params = new URLSearchParams();
  if (input.userId) params.set("user_id", input.userId);
  if (input.matchRoomId) params.set("match_room_id", input.matchRoomId);
  if (input.tournamentId) params.set("tournament_id", input.tournamentId);
  if (input.limit) params.set("limit", String(input.limit));
  const query = params.toString();
  return apiRequest<AdminWalletDashboard>(`/admin/wallet/dashboard${query ? `?${query}` : ""}`);
}

export async function reviewAdminWalletTopup(topupId: string, input: ReviewWalletTopupInput) {
  return apiRequest<{ topup: WalletTopup; ledger_entries: WalletLedgerEntry[] }>(
    `/admin/wallet/topups/${encodeURIComponent(topupId)}/review`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: {
        decision: input.decision,
        note: input.note?.trim() || undefined
      }
    }
  );
}

export async function reviewAdminWalletPayoutRequest(payoutRequestId: string, input: ReviewWalletPayoutInput) {
  return apiRequest<{ payout_request: WalletPayoutRequest; ledger_entries: WalletLedgerEntry[] }>(
    `/admin/wallet/payout-requests/${encodeURIComponent(payoutRequestId)}/review`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: {
        decision: input.decision,
        payment_reference: input.payment_reference?.trim() || undefined,
        note: input.note?.trim() || undefined
      }
    }
  );
}

export async function listAdminResultClaims(status: ResultClaimStatus = "submitted") {
  const data = await apiRequest<{ claims: MatchResultClaim[] }>(
    `/admin/results/claims?status=${encodeURIComponent(status)}`
  );
  return data.claims ?? [];
}

export async function reviewAdminResultClaim(claimId: string, input: ReviewResultClaimInput) {
  const data = await apiRequest<{ claim: MatchResultClaim }>(
    `/admin/results/claims/${encodeURIComponent(claimId)}/review`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: {
        decision: input.decision,
        note: input.note?.trim() || undefined
      }
    }
  );
  return data.claim;
}

export async function getPlayerTrustSummary(userId: string) {
  const data = await apiRequest<{ trust: PlayerTrustSummary }>(`/profiles/trust/${encodeURIComponent(userId)}`);
  return data.trust;
}

export async function listMatchSettlements(status?: SettlementStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await apiRequest<{ settlements: MatchSettlement[] }>(`/admin/settlements/settlements${query}`);
  return data.settlements ?? [];
}

export async function reserveMatchSettlement(input: { match_room_id: string; notes?: string; stepUpToken: string }) {
  return apiRequest<{ settlement: MatchSettlement; payout: MatchPayout }>("/admin/settlements/settlements", {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: {
      match_room_id: input.match_room_id,
      notes: input.notes?.trim() || undefined
    }
  });
}

export async function listMatchPayouts(status?: PaymentStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await apiRequest<{ payouts: MatchPayout[] }>(`/admin/settlements/payouts${query}`);
  return data.payouts ?? [];
}

export async function completeMatchPayout(payoutId: string, input: CompletePayoutInput) {
  return apiRequest<{ settlement: MatchSettlement; payout: MatchPayout }>(
    `/admin/settlements/payouts/${encodeURIComponent(payoutId)}/complete`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: {
        payout_reference: input.payout_reference?.trim() || undefined,
        completion_proof_url: input.completion_proof_url.trim()
      }
    }
  );
}

export async function updateMatchPayoutInstructions(payoutId: string, input: UpdatePaymentInstructionsInput) {
  return apiRequest<{ payout: MatchPayout }>(`/admin/settlements/payouts/${encodeURIComponent(payoutId)}/instructions`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: {
      recipient_name: input.recipient_name?.trim() || undefined,
      bank_name: input.bank_name?.trim() || undefined,
      account_number: input.account_number?.trim() || undefined,
      bank_code: input.bank_code?.trim() || undefined,
      payout_note: input.payout_note?.trim() || undefined,
      use_fallback: input.use_fallback
    }
  });
}

export async function listMatchRefunds(status?: RefundStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await apiRequest<{ refunds: MatchRefund[] }>(`/admin/settlements/refunds${query}`);
  return data.refunds ?? [];
}

export async function reserveMatchRefunds(input: { match_room_id: string; reason: string; stepUpToken: string }) {
  return apiRequest<{ refunds: MatchRefund[] }>("/admin/settlements/refunds", {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: {
      match_room_id: input.match_room_id,
      reason: input.reason.trim()
    }
  });
}

export async function completeMatchRefund(refundId: string, input: CompleteRefundInput) {
  return apiRequest<{ refund: MatchRefund }>(`/admin/settlements/refunds/${encodeURIComponent(refundId)}/complete`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: {
      refund_reference: input.refund_reference?.trim() || undefined,
      completion_proof_url: input.completion_proof_url.trim()
    }
  });
}

export async function updateMatchRefundInstructions(refundId: string, input: UpdatePaymentInstructionsInput) {
  return apiRequest<{ refund: MatchRefund }>(`/admin/settlements/refunds/${encodeURIComponent(refundId)}/instructions`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: {
      recipient_name: input.recipient_name?.trim() || undefined,
      bank_name: input.bank_name?.trim() || undefined,
      account_number: input.account_number?.trim() || undefined,
      bank_code: input.bank_code?.trim() || undefined,
      payout_note: input.payout_note?.trim() || undefined,
      use_fallback: input.use_fallback
    }
  });
}

export async function listTournamentSettlements(status?: SettlementStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await apiRequest<{ settlements: TournamentSettlement[] }>(`/admin/settlements/tournament-settlements${query}`);
  return data.settlements ?? [];
}

export async function listTournamentPayouts(status?: PaymentStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await apiRequest<{ payouts: TournamentPayout[] }>(`/admin/settlements/tournament-payouts${query}`);
  return data.payouts ?? [];
}

export async function completeTournamentPayout(payoutId: string, input: CompletePayoutInput) {
  return apiRequest<{ settlement: TournamentSettlement; payout: TournamentPayout }>(
    `/admin/settlements/tournament-payouts/${encodeURIComponent(payoutId)}/complete`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: {
        payout_reference: input.payout_reference?.trim() || undefined,
        completion_proof_url: input.completion_proof_url.trim()
      }
    }
  );
}

export async function updateTournamentPayoutInstructions(payoutId: string, input: UpdatePaymentInstructionsInput) {
  return apiRequest<{ payout: TournamentPayout }>(
    `/admin/settlements/tournament-payouts/${encodeURIComponent(payoutId)}/instructions`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: {
        recipient_name: input.recipient_name?.trim() || undefined,
        bank_name: input.bank_name?.trim() || undefined,
        account_number: input.account_number?.trim() || undefined,
        bank_code: input.bank_code?.trim() || undefined,
        payout_note: input.payout_note?.trim() || undefined,
        use_fallback: input.use_fallback
      }
    }
  );
}

export async function listTournamentRefunds(status?: RefundStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await apiRequest<{ refunds: TournamentRefund[] }>(`/admin/settlements/tournament-refunds${query}`);
  return data.refunds ?? [];
}

export async function completeTournamentRefund(refundId: string, input: CompleteRefundInput) {
  return apiRequest<{ refund: TournamentRefund }>(
    `/admin/settlements/tournament-refunds/${encodeURIComponent(refundId)}/complete`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: {
        refund_reference: input.refund_reference?.trim() || undefined,
        completion_proof_url: input.completion_proof_url.trim()
      }
    }
  );
}

export async function updateTournamentRefundInstructions(refundId: string, input: UpdatePaymentInstructionsInput) {
  return apiRequest<{ refund: TournamentRefund }>(
    `/admin/settlements/tournament-refunds/${encodeURIComponent(refundId)}/instructions`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: {
        recipient_name: input.recipient_name?.trim() || undefined,
        bank_name: input.bank_name?.trim() || undefined,
        account_number: input.account_number?.trim() || undefined,
        bank_code: input.bank_code?.trim() || undefined,
        payout_note: input.payout_note?.trim() || undefined,
        use_fallback: input.use_fallback
      }
    }
  );
}

export async function listAdminGameCatalog() {
  return apiRequest<GameCatalog>("/games");
}

export async function listAdminTournaments(input: { status?: string; format?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  if (input.format) params.set("format", input.format);
  if (input.limit) params.set("limit", String(input.limit));
  const query = params.toString();
  const data = await apiRequest<{ tournaments: Tournament[] }>(`/tournaments${query ? `?${query}` : ""}`);
  return data.tournaments ?? [];
}

export async function getAdminTournamentDetail(tournamentId: string) {
  return apiRequest<{ tournament: TournamentDetail; events: TournamentStateEvent[] }>(`/tournaments/${encodeURIComponent(tournamentId)}`);
}

export async function createAdminTournament(input: CreateTournamentInput) {
  const data = await apiRequest<{ tournament: Tournament }>("/tournaments", {
    method: "POST",
    body: input
  });
  return data.tournament;
}

export async function listAdminTournamentContributions(status = "submitted") {
  const data = await apiRequest<{ contributions: TournamentPrizeContribution[] }>(
    `/tournaments/admin/contributions?status=${encodeURIComponent(status)}`
  );
  return data.contributions ?? [];
}

export async function reviewAdminTournamentContribution(
  contributionId: string,
  input: { decision: "approve" | "reject"; note?: string; stepUpToken: string }
) {
  const data = await apiRequest<{ contribution: TournamentPrizeContribution }>(
    `/tournaments/admin/contributions/${encodeURIComponent(contributionId)}/review`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: {
        decision: input.decision,
        note: input.note?.trim() || undefined
      }
    }
  );
  return data.contribution;
}

export async function seedAdminTournament(tournamentId: string, input: { mode: TournamentSeedMode; entry_ids?: string[]; reason?: string }) {
  return apiRequest<{ tournament: Tournament; entries?: unknown[] }>(`/tournaments/${encodeURIComponent(tournamentId)}/seeding`, {
    method: "POST",
    body: {
      mode: input.mode,
      entry_ids: input.entry_ids?.filter(Boolean),
      reason: input.reason?.trim() || undefined
    }
  });
}

export async function generateAdminTournamentStructure(tournamentId: string, input: { force?: boolean; reason?: string }) {
  return apiRequest<{ tournament: Tournament; stages?: unknown[]; rounds?: unknown[]; matches?: unknown[] }>(
    `/tournaments/${encodeURIComponent(tournamentId)}/structure`,
    {
      method: "POST",
      body: {
        force: input.force,
        reason: input.reason?.trim() || undefined
      }
    }
  );
}

export async function linkAdminTournamentMatchRooms(
  tournamentId: string,
  input: { round_id?: string; match_id?: string; reason?: string; stepUpToken: string }
) {
  return apiRequest<{ linked_matches?: unknown[]; rooms?: unknown[] }>(`/tournaments/${encodeURIComponent(tournamentId)}/match-rooms`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: {
      round_id: input.round_id?.trim() || undefined,
      match_id: input.match_id?.trim() || undefined,
      reason: input.reason?.trim() || undefined
    }
  });
}

export async function applyAdminTournamentCumulativeScores(
  tournamentId: string,
  input: { match_id: string; results: TournamentCumulativeScoreResultInput[]; reason?: string; stepUpToken: string }
) {
  return apiRequest<{ match?: unknown; standings?: unknown[] }>(`/tournaments/${encodeURIComponent(tournamentId)}/cumulative-scores`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: {
      match_id: input.match_id.trim(),
      results: input.results,
      reason: input.reason?.trim() || undefined
    }
  });
}

export async function reviewAdminTournamentMatchResult(
  tournamentId: string,
  matchId: string,
  input: {
    decision: TournamentResultReviewDecision;
    winning_entry_id?: string;
    penalized_entry_id?: string;
    result_claim_id?: string;
    score_summary?: string;
    note?: string;
    stepUpToken: string;
  }
) {
  return apiRequest<{ review?: unknown; match?: unknown }>(
    `/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(matchId)}/result-review`,
    {
      method: "POST",
      headers: { "x-admin-step-up": input.stepUpToken },
      body: {
        decision: input.decision,
        winning_entry_id: input.winning_entry_id?.trim() || undefined,
        penalized_entry_id: input.penalized_entry_id?.trim() || undefined,
        result_claim_id: input.result_claim_id?.trim() || undefined,
        score_summary: input.score_summary?.trim() || undefined,
        note: input.note?.trim() || undefined
      }
    }
  );
}

export async function reserveAdminTournamentSettlement(tournamentId: string, input: { notes?: string; stepUpToken: string }) {
  return apiRequest<{ settlement?: unknown; payouts?: unknown[] }>(`/tournaments/${encodeURIComponent(tournamentId)}/settlement`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: { notes: input.notes?.trim() || undefined }
  });
}

export async function reserveAdminTournamentRefunds(tournamentId: string, input: { reason: string; stepUpToken: string }) {
  return apiRequest<{ refunds?: unknown[] }>(`/tournaments/${encodeURIComponent(tournamentId)}/refunds`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: { reason: input.reason.trim() }
  });
}

export async function grantAdminTournamentHost(
  tournamentId: string,
  input: {
    target: string;
    role: TournamentHostRole;
    permissions: Record<string, boolean>;
    notes?: string;
    stepUpToken: string;
  }
) {
  const target = input.target.trim();
  const looksLikeUserId = target.includes("-") || target.includes("|") || target.startsWith("usr_") || target.startsWith("user_");
  return apiRequest<{ host?: unknown }>(`/tournaments/${encodeURIComponent(tournamentId)}/hosts`, {
    method: "POST",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: {
      ...(looksLikeUserId ? { user_id: target } : { username: target }),
      role: input.role,
      permissions: input.permissions,
      notes: input.notes?.trim() || undefined
    }
  });
}

export async function updateAdminTournamentHostEvent(
  tournamentId: string,
  input: {
    title?: string;
    description?: string;
    registration_opens_at?: string;
    registration_closes_at?: string;
    starts_at?: string;
    ends_at?: string;
    settings?: Record<string, unknown>;
    stepUpToken: string;
  }
) {
  return apiRequest<{ tournament: Tournament }>(`/tournaments/${encodeURIComponent(tournamentId)}/host-event`, {
    method: "PATCH",
    headers: { "x-admin-step-up": input.stepUpToken },
    body: {
      title: input.title?.trim() || undefined,
      description: input.description?.trim() || undefined,
      registration_opens_at: input.registration_opens_at,
      registration_closes_at: input.registration_closes_at,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      settings: input.settings
    }
  });
}

export async function listAdminLeaderboard(input: { limit?: number; game_slug?: string; city?: string; campus?: string; region?: string } = {}) {
  const params = new URLSearchParams();
  if (input.limit) params.set("limit", String(input.limit));
  if (input.game_slug) params.set("game_slug", input.game_slug);
  if (input.city) params.set("city", input.city);
  if (input.campus) params.set("campus", input.campus);
  if (input.region) params.set("region", input.region);
  const query = params.toString();
  return apiRequest<{ leaderboard: LeaderboardRow[]; summary: CommunityLeaderboardSummary }>(`/community/leaderboard${query ? `?${query}` : ""}`);
}

export async function listAdminGameAccounts(status?: UserGameAccount["status"]) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await apiRequest<{ game_accounts: AdminGameAccount[] }>(`/profiles/admin/game-accounts${query}`);
  return data.game_accounts ?? [];
}

export async function reviewAdminGameAccount(
  accountId: string,
  input: {
    status: UserGameAccount["status"];
    verification_notes?: string;
  }
) {
  const data = await apiRequest<{ game_account: AdminGameAccount }>(`/profiles/admin/game-accounts/${encodeURIComponent(accountId)}`, {
    method: "PATCH",
    body: {
      status: input.status,
      verification_notes: input.verification_notes?.trim() || undefined
    }
  });
  return data.game_account;
}

export async function getAdminPlayerProfile(userId: string) {
  return apiRequest<AdminPlayerProfile>(`/profiles/admin/${encodeURIComponent(userId)}`);
}
