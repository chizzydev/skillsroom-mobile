import type { MobilePushDevice, NotificationPreference, RoomInvite, UserNotification } from "../types/api";
import { apiRequest } from "./client";

export async function listNotifications(status: "unread" | "read" | "archived" = "unread") {
  const data = await apiRequest<{ notifications: UserNotification[] } | UserNotification[]>(`/community/notifications?status=${encodeURIComponent(status)}`);
  return Array.isArray(data) ? data : data.notifications ?? [];
}

export async function markNotificationRead(notificationId: string) {
  const data = await apiRequest<{ notification: UserNotification }>(`/community/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: "POST",
    body: {}
  });
  return data.notification;
}

export async function listRoomInvites(status: RoomInvite["status"] = "pending") {
  const data = await apiRequest<{ invites: RoomInvite[] }>(`/community/invites?status=${encodeURIComponent(status)}`);
  return data.invites ?? [];
}

export async function respondToRoomInvite(inviteId: string, response: "accepted" | "declined") {
  const data = await apiRequest<{ invite: RoomInvite }>(`/community/invites/${encodeURIComponent(inviteId)}/respond`, {
    method: "POST",
    body: { response }
  });
  return data.invite;
}

export async function getNotificationPreferences() {
  const data = await apiRequest<{ preferences: NotificationPreference }>("/community/notification-preferences");
  return data.preferences;
}

export async function updateNotificationPreferences(input: Partial<Pick<
  NotificationPreference,
  "in_app_enabled" | "in_app_sound_enabled" | "email_enabled" | "sms_enabled" | "room_invites_enabled" | "match_updates_enabled" | "marketing_enabled"
>>) {
  const data = await apiRequest<{ preferences: NotificationPreference }>("/community/notification-preferences", {
    method: "PUT",
    body: input
  });
  return data.preferences;
}

export async function registerMobilePushDevice(input: {
  push_token: string;
  platform: "android" | "ios";
  device_id?: string;
  installation_id?: string;
  app_version?: string;
  enabled?: boolean;
}) {
  const data = await apiRequest<{ device: MobilePushDevice }>("/community/mobile-push/devices", {
    method: "POST",
    body: input
  });
  return data.device;
}

export async function unregisterMobilePushDevice(pushToken: string) {
  const data = await apiRequest<{ device: MobilePushDevice | null }>("/community/mobile-push/devices", {
    method: "DELETE",
    body: { push_token: pushToken }
  });
  return data.device;
}
