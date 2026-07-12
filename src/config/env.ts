const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const webAppUrl = trimTrailingSlash(process.env.EXPO_PUBLIC_WEB_APP_URL ?? "https://skillsroom.xyz");
const productionStreamingOauthRedirectUri = "https://skillsroom.xyz/api/streaming/oauth/mobile-callback";

export const env = {
  apiBaseUrl: trimTrailingSlash(process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4100"),
  webAppUrl,
  streamingOauthRedirectUri:
    process.env.EXPO_PUBLIC_STREAMING_OAUTH_REDIRECT_URI ??
    productionStreamingOauthRedirectUri,
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
};
