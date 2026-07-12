import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { registerMobilePushDevice, unregisterMobilePushDevice } from "../../api/notifications";

const PUSH_TOKEN_KEY = "skillsroom.expoPushToken";
const INSTALLATION_ID_KEY = "skillsroom.installationId";

function makeInstallationId() {
  return `sr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

async function installationId() {
  const existing = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  if (existing) return existing;
  const next = makeInstallationId();
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, next);
  return next;
}

function expoProjectId() {
  return (
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID
  );
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("skillsroom-updates", {
    name: "Skillsroom updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#19c37d"
  });
}

function isGrantedPermission(value: unknown) {
  const permission = value as { granted?: unknown; status?: unknown };
  return permission.granted === true || permission.status === "granted";
}

async function permissionGranted() {
  const current = await Notifications.getPermissionsAsync();
  if (isGrantedPermission(current)) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return isGrantedPermission(requested);
}

export async function registerCurrentPushDevice() {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return null;
  if (!Device.isDevice) return null;

  await ensureAndroidChannel();
  if (!(await permissionGranted())) return null;

  const projectId = expoProjectId();
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  const pushToken = token.data;
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, pushToken);

  return registerMobilePushDevice({
    push_token: pushToken,
    platform: Platform.OS,
    installation_id: await installationId(),
    device_id: Device.modelId ?? Device.deviceName ?? undefined,
    app_version: Constants.expoConfig?.version,
    enabled: true
  });
}

export async function unregisterCurrentPushDevice() {
  const pushToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (!pushToken) return null;
  try {
    return await unregisterMobilePushDevice(pushToken);
  } finally {
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  }
}
