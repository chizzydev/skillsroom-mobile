import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "skillsroom.mobile.access_token";
const REFRESH_TOKEN_KEY = "skillsroom.mobile.refresh_token";

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

export async function clearStoredTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
  ]);
}
