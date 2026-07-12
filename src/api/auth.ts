import type { AuthSession, AuthUser } from "../types/api";
import { apiRequest } from "./client";
import { clearStoredTokens, getStoredTokens, setStoredTokens } from "./session";

function sessionTokens(session: AuthSession) {
  return {
    accessToken: session.access_token ?? session.accessToken ?? null,
    refreshToken: session.refresh_token ?? session.refreshToken ?? null
  };
}

export async function login(identifier: string, password: string) {
  const session = await apiRequest<AuthSession>("/auth/login", {
    method: "POST",
    body: { identifier, password },
    auth: false
  });
  const tokens = sessionTokens(session);
  await setStoredTokens(tokens.accessToken, tokens.refreshToken);
  return session;
}

export async function googleLogin(idToken: string) {
  const session = await apiRequest<AuthSession>("/auth/google", {
    method: "POST",
    body: { id_token: idToken },
    auth: false
  });
  const tokens = sessionTokens(session);
  await setStoredTokens(tokens.accessToken, tokens.refreshToken);
  return session;
}

export async function register(input: { email: string; username: string; password: string; password_confirm: string }) {
  const session = await apiRequest<AuthSession>("/auth/register", {
    method: "POST",
    body: input,
    auth: false
  });
  const tokens = sessionTokens(session);
  await setStoredTokens(tokens.accessToken, tokens.refreshToken);
  return session;
}

export async function logout() {
  const { refreshToken } = await getStoredTokens();
  try {
    await apiRequest("/auth/logout", {
      method: "POST",
      body: { refresh_token: refreshToken },
      auth: false
    });
  } finally {
    await clearStoredTokens();
  }
}

export async function me() {
  const data = await apiRequest<{ user: AuthUser }>("/auth/me");
  return data.user;
}

export async function requestPasswordReset(email: string) {
  return apiRequest("/auth/password-reset/request", {
    method: "POST",
    body: { email },
    auth: false
  });
}
