import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import type { Href } from "expo-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { markNotificationRead } from "../api/notifications";
import { routeFromNotificationPayload } from "../features/notifications/notificationRouting";
import { registerCurrentPushDevice } from "../features/notifications/pushRegistration";
import { useAuthStore } from "../store/auth-store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

function dataString(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function invalidateFromPush(queryClient: ReturnType<typeof useQueryClient>, data: Record<string, unknown>) {
  const type = dataString(data, "notification_type") ?? "";
  const roomId = dataString(data, "match_room_id");
  const actionUrl = dataString(data, "action_url") ?? "";

  void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  if (roomId || type.includes("match") || actionUrl.startsWith("/matches/")) {
    void queryClient.invalidateQueries({ queryKey: ["rooms"] });
    if (roomId) void queryClient.invalidateQueries({ queryKey: ["room", roomId] });
  }
  if (type.includes("wallet") || type.includes("topup") || type.includes("payout")) {
    void queryClient.invalidateQueries({ queryKey: ["wallet"] });
  }
  if (type.includes("tournament") || actionUrl.startsWith("/tournaments/")) {
    void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
  }
  if (type.includes("chat") || actionUrl.startsWith("/chat")) {
    void queryClient.invalidateQueries({ queryKey: ["chat"] });
  }
}

function routeFromActionUrl(actionUrl: string | null): Href {
  return routeFromNotificationPayload({ actionUrl }) ?? "/(app)/notifications";
}

async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  queryClient: ReturnType<typeof useQueryClient>
) {
  const data = response.notification.request.content.data as Record<string, unknown>;
  invalidateFromPush(queryClient, data);

  const notificationId = dataString(data, "notification_id");
  if (notificationId) {
    void markNotificationRead(notificationId).catch(() => undefined);
  }

  router.push(
    routeFromNotificationPayload({
      actionUrl: dataString(data, "action_url"),
      matchRoomId: dataString(data, "match_room_id"),
      notificationType: dataString(data, "notification_type"),
      tournamentId: dataString(data, "tournament_id"),
      metadata: data
    }) ?? routeFromActionUrl(dataString(data, "action_url"))
  );
}

export function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const isSignedIn = useAuthStore((state) => state.isSignedIn);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSignedIn) return;
    void registerCurrentPushDevice().catch(() => undefined);
  }, [isSignedIn]);

  useEffect(() => {
    if (Platform.OS !== "android" && Platform.OS !== "ios") return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(response, queryClient);
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) void handleNotificationResponse(response, queryClient);
    });

    return () => {
      subscription.remove();
    };
  }, [queryClient]);

  return children;
}
