import type { CommunityLivestreamLink, StreamingAccount } from "../types/api";
import { apiRequest } from "./client";

export async function listStreamingAccounts() {
  const data = await apiRequest<{ accounts: StreamingAccount[] }>("/streaming/accounts");
  return data.accounts ?? [];
}

export async function saveManualStreamingAccount(input: {
  provider: "youtube" | "twitch";
  channel_url: string;
  display_name: string;
  provider_login?: string;
}) {
  const data = await apiRequest<{ account: StreamingAccount }>("/streaming/accounts/manual", {
    method: "POST",
    body: input
  });
  return data.account;
}

export async function startStreamingOauth(input: {
  provider: "youtube" | "twitch";
  redirect_uri: string;
  redirect_path?: string;
}) {
  return apiRequest<{ authorization_url: string; redirect_uri: string; state: string }>("/streaming/oauth/start", {
    method: "POST",
    body: {
      provider: input.provider,
      redirect_uri: input.redirect_uri,
      redirect_path: input.redirect_path ?? "/profile"
    }
  });
}

export async function completeStreamingOauth(input: { state: string; code: string }) {
  const data = await apiRequest<{ account: StreamingAccount; redirect_path: string }>("/streaming/oauth/complete", {
    method: "POST",
    body: input
  });
  return data;
}

export async function syncStreamingAccount(accountId: string) {
  const data = await apiRequest<{ account: StreamingAccount }>(`/streaming/accounts/${accountId}/sync`, {
    method: "POST"
  });
  return data.account;
}

export async function createLivestream(input: {
  target_type: "match_room" | "tournament";
  match_room_id?: string;
  tournament_id?: string;
  provider?: "youtube" | "twitch" | "tiktok";
  visibility: "public" | "participants";
  stream_role?: "official" | "player_a" | "player_b";
  playback_status?: "live" | "offline" | "replay" | "unavailable";
  title: string;
  stream_url: string;
}) {
  const data = await apiRequest<{ livestream: CommunityLivestreamLink }>("/community/livestreams", {
    method: "POST",
    body: input
  });
  return data.livestream;
}
