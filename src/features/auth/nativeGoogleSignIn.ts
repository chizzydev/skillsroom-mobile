import { GoogleSignin, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import { env } from "../../config/env";

let configured = false;

function configureGoogleSignIn() {
  if (configured) return;

  if (!env.googleWebClientId) {
    throw new Error("Google sign-in is not available in this app version yet. Use email or username for now.");
  }

  GoogleSignin.configure({
    webClientId: env.googleWebClientId,
    ...(env.googleIosClientId ? { iosClientId: env.googleIosClientId } : {})
  });
  configured = true;
}

function nativeGoogleErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  const rawMessage = error instanceof Error ? error.message : "";

  if (code === statusCodes.SIGN_IN_CANCELLED) return null;
  if (code === statusCodes.IN_PROGRESS) return "Google sign-in is already open. Finish that request or try again.";
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return "Google Play services is not available or needs an update on this device.";
  if (code === "10" || rawMessage.includes("DEVELOPER_ERROR")) {
    return "Google sign-in is not fully connected for this installed app yet. Update the app or use email/password for now.";
  }

  if (rawMessage) return rawMessage;
  return "Google sign-in did not finish. Try again.";
}

export async function getNativeGoogleIdToken() {
  try {
    configureGoogleSignIn();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    await GoogleSignin.signOut().catch(() => undefined);
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;

    const idToken = response.data.idToken ?? (await GoogleSignin.getTokens()).idToken;
    if (!idToken) {
      throw new Error("Google did not return a verified sign-in token. Try again.");
    }
    return idToken;
  } catch (error) {
    const message = nativeGoogleErrorMessage(error);
    if (!message) return null;
    throw new Error(message);
  }
}
