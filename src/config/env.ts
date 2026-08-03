import Constants from "expo-constants";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const productionApiBaseUrl = "https://skillsroom-api-production.up.railway.app";
const webAppUrl = trimTrailingSlash(process.env.EXPO_PUBLIC_WEB_APP_URL ?? "https://skillsroom.xyz");
const productionStreamingOauthRedirectUri = "https://skillsroom.xyz/api/streaming/oauth/mobile-callback";
const appScheme = process.env.EXPO_PUBLIC_APP_SCHEME ?? (__DEV__ ? "skillsroom-dev" : "skillsroom");
const configuredApiBaseUrl = trimTrailingSlash(process.env.EXPO_PUBLIC_API_BASE_URL ?? (__DEV__ ? "http://127.0.0.1:4100" : productionApiBaseUrl));
const appVariant = Constants.expoConfig?.extra?.appVariant === "development" ? "development" : "production";
const allowProductionApiInDevelopment = process.env.EXPO_PUBLIC_ALLOW_PRODUCTION_API_IN_DEV === "true";

if (__DEV__ && configuredApiBaseUrl === productionApiBaseUrl && !allowProductionApiInDevelopment) {
  throw new Error("Development builds must use a local or staging API URL. Set EXPO_PUBLIC_ALLOW_PRODUCTION_API_IN_DEV=true only for a deliberate production smoke test.");
}

export const env = {
  apiBaseUrl: configuredApiBaseUrl,
  appVariant,
  appScheme,
  webAppUrl,
  streamingOauthRedirectUri:
    process.env.EXPO_PUBLIC_STREAMING_OAUTH_REDIRECT_URI ??
    productionStreamingOauthRedirectUri,
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
};
