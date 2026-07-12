import type { MyCommunityClanResponse, MyReferralProgramResponse, PlayerTrustSummary, ProfileOverview } from "../types/api";
import { apiRequest } from "./client";

export async function profileOverview() {
  return apiRequest<ProfileOverview>("/profiles/me");
}

export async function profileTrustSummary(userId: string) {
  const data = await apiRequest<{ trust: PlayerTrustSummary }>(`/profiles/trust/${encodeURIComponent(userId)}`);
  return data.trust;
}

export async function myCommunityClan() {
  return apiRequest<MyCommunityClanResponse>("/community/clans/mine");
}

export async function myReferralProgram() {
  return apiRequest<MyReferralProgramResponse>("/community/referrals/me");
}

export async function saveProfile(input: {
  username: string;
  display_name?: string;
  region?: string;
  city?: string;
  campus?: string;
  timezone?: string;
  bio?: string;
  visibility?: "private" | "room_participants" | "public";
  age_confirmed?: boolean;
}) {
  const data = await apiRequest<{ profile: ProfileOverview["profile"] }>("/profiles/me", {
    method: "PUT",
    body: input
  });
  return data.profile;
}

export async function saveGameAccount(input: {
  game_slug: string;
  handle: string;
  external_uid?: string;
  region?: string;
  is_primary?: boolean;
}) {
  const data = await apiRequest<{ game_account: NonNullable<ProfileOverview["game_accounts"]>[number] }>("/profiles/me/game-accounts", {
    method: "POST",
    body: input
  });
  return data.game_account;
}

export async function savePayoutProfile(input: {
  recipient_name: string;
  bank_name: string;
  account_number: string;
  bank_code?: string;
  payout_note?: string;
  currency?: string;
}) {
  const data = await apiRequest<{ payout_profile: ProfileOverview["payout_profile"] }>("/profiles/me/payout-profile", {
    method: "PUT",
    body: input
  });
  return data.payout_profile;
}
