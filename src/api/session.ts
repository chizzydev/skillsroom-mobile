import * as SecureStore from "expo-secure-store";
import type { AuthUser } from "../types/api";

const ACCESS_TOKEN_KEY = "skillsroom.mobile.access_token";
const REFRESH_TOKEN_KEY = "skillsroom.mobile.refresh_token";
const CACHED_USER_KEY = "skillsroom.mobile.cached_user";

export type StoredTokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

export async function getStoredTokens(): Promise<StoredTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
  ]);

  return { accessToken, refreshToken };
}

export async function setStoredTokens(accessToken?: string | null, refreshToken?: string | null) {
  await Promise.all([
    accessToken ? SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken) : SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    refreshToken ? SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken) : SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
  ]);
}

export async function getStoredUser() {
  const raw = await SecureStore.getItemAsync(CACHED_USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthUser;
    return parsed?.id ? parsed : null;
  } catch {
    await SecureStore.deleteItemAsync(CACHED_USER_KEY);
    return null;
  }
}

export async function setStoredUser(user: AuthUser | null) {
  if (!user?.id) {
    await SecureStore.deleteItemAsync(CACHED_USER_KEY);
    return;
  }
  await SecureStore.setItemAsync(CACHED_USER_KEY, JSON.stringify(user));
}

export async function clearStoredTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(CACHED_USER_KEY)
  ]);
}
