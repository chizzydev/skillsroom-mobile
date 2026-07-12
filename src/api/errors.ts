import { ApiError } from "./client";

const fallbackMessage = "Something went wrong. Please try again.";
const sessionExpiredMessage = "Your session has expired. Please sign in again.";

const invalidCredentialCodes = new Set(["INVALID_CREDENTIALS"]);
const sessionFailureCodes = new Set([
  "AUTH_REQUIRED",
  "INVALID_ACCESS_TOKEN",
  "INVALID_REFRESH_TOKEN",
  "TOKEN_EXPIRED",
  "UNAUTHENTICATED"
]);

function cleanApiMessage(message?: string) {
  const value = message?.trim();
  return value && value !== "Something went wrong." ? value : null;
}

export function plainApiError(error: unknown, fallback = fallbackMessage) {
  if (error instanceof ApiError) {
    if (error.status === 0) return "Skillsroom is not reachable right now. Check your connection and try again.";
    if (error.status === 401) {
      if (error.code && invalidCredentialCodes.has(error.code)) return "Email, username, or password is incorrect.";

      const apiMessage = cleanApiMessage(error.message);
      if (apiMessage && (!error.code || !sessionFailureCodes.has(error.code))) return apiMessage;

      return apiMessage ?? sessionExpiredMessage;
    }
    if (error.message) return error.message;
  }

  if (error instanceof TypeError) {
    return "Skillsroom is not reachable right now. Check your connection and try again.";
  }

  if (error instanceof Error && error.message) return error.message;

  return fallback;
}
