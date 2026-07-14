import type { MyCommunityClanResponse, MyReferralProgramResponse, PlayerTrustSummary, ProfileOverview } from "../types/api";
import { apiRequest } from "./client";

async function profileWithSections(path: string) {
  const summary = await apiRequest<ProfileOverview>(path);
  const [gameAccountsResult, payoutProfileResult] = await Promise.allSettled([
    profileGameAccounts(),
    profilePayoutProfile()
  ]);

  const fallbackPrimaryAccount =
    summary.primary_game_account && typeof summary.primary_game_account === "object"
      ? [{ ...summary.primary_game_account, is_primary: true }]
      : [];

  return {
    ...summary,
    game_accounts: gameAccountsResult.status === "fulfilled" ? gameAccountsResult.value : fallbackPrimaryAccount,
    payout_profile: payoutProfileResult.status === "fulfilled" ? payoutProfileResult.value : summary.payout_profile ?? null
  };
}

export async function profileOverview() {
  return profileWithSections("/profiles/me?view=summary");
}

export async function profileDetails() {
  return profileWithSections("/profiles/me");
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

export async function profileGameAccounts() {
  const data = await apiRequest<{ game_accounts: NonNullable<ProfileOverview["game_accounts"]> }>("/profiles/me/game-accounts");
  return data.game_accounts ?? [];
}

export async function profilePayoutProfile() {
  const data = await apiRequest<{ payout_profile: ProfileOverview["payout_profile"] }>("/profiles/me/payout-profile");
  return data.payout_profile ?? null;
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
