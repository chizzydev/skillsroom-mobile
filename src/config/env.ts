const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const productionApiBaseUrl = "https://skillsroom-api-production.up.railway.app";
const webAppUrl = trimTrailingSlash(process.env.EXPO_PUBLIC_WEB_APP_URL ?? "https://skillsroom.xyz");
const productionStreamingOauthRedirectUri = "https://skillsroom.xyz/api/streaming/oauth/mobile-callback";
const appScheme = process.env.EXPO_PUBLIC_APP_SCHEME ?? (__DEV__ ? "skillsroom-dev" : "skillsroom");

export const env = {
  apiBaseUrl: trimTrailingSlash(process.env.EXPO_PUBLIC_API_BASE_URL ?? (__DEV__ ? "http://127.0.0.1:4100" : productionApiBaseUrl)),
  appScheme,
  webAppUrl,
  streamingOauthRedirectUri:
    process.env.EXPO_PUBLIC_STREAMING_OAUTH_REDIRECT_URI ??
    productionStreamingOauthRedirectUri,
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
};
