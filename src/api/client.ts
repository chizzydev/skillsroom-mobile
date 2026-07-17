import { env } from "../config/env";
import { clearStoredTokens, getStoredTokens, setStoredTokens } from "./session";

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { message?: string; code?: string };
  message?: string;
};

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  retryOnAuth?: boolean;
};

let authFailureHandler: (() => void) | null = null;
let activeRefreshRequest: Promise<string | null> | null = null;

export function setAuthFailureHandler(handler: (() => void) | null) {
  authFailureHandler = handler;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function unwrap<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }
  return payload as T;
}

async function requestFreshAccessToken() {
  const { refreshToken } = await getStoredTokens();
  if (!refreshToken) return null;

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Skillsroom-Client": "mobile"
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
  } catch {
    throw new ApiError("Skillsroom is not reachable right now. Check your connection and try again.", 0, "NETWORK_ERROR");
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json") ? await response.json() : null;
    const message =
      payload?.error?.message ??
      payload?.message ??
      "Skillsroom could not refresh your session right now. Try again.";

    if (response.status !== 401 && response.status !== 403) {
      throw new ApiError(message, response.status, payload?.error?.code);
    }

    await clearStoredTokens();
    return null;
  }

  const payload = unwrap<{ access_token?: string; refresh_token?: string; accessToken?: string; refreshToken?: string }>(
    await response.json()
  );
  const accessToken = payload.access_token ?? payload.accessToken ?? null;
  const nextRefreshToken = payload.refresh_token ?? payload.refreshToken ?? refreshToken;

  await setStoredTokens(accessToken, nextRefreshToken);
  return accessToken;
}

export async function refreshAccessToken() {
  if (activeRefreshRequest) return activeRefreshRequest;

  activeRefreshRequest = requestFreshAccessToken().finally(() => {
    activeRefreshRequest = null;
  });

  return activeRefreshRequest;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers: extraHeaders = {}, auth = true, retryOnAuth = true } = options;
  const { accessToken } = await getStoredTokens();

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Skillsroom-Client": "mobile",
    ...extraHeaders
  };
  if (body !== undefined && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError("Skillsroom is not reachable right now. Check your connection and try again.", 0, "NETWORK_ERROR");
  }

  if (response.status === 401 && auth && retryOnAuth) {
    const nextAccessToken = await refreshAccessToken();
    if (nextAccessToken) {
      return apiRequest<T>(path, { ...options, retryOnAuth: false });
    }
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 401 && auth) {
      authFailureHandler?.();
    }

    const message =
      payload?.error?.message ??
      payload?.message ??
      (response.status === 403 ? "You do not have permission to do that yet." : "Something went wrong.");
    throw new ApiError(message, response.status, payload?.error?.code);
  }

  return unwrap<T>(payload);
}
