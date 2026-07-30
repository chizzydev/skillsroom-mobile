import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiRequest } from "./client";

type AnalyticsPlatform = "android" | "ios" | "web";
type AnalyticsMetadataKey = "source" | "action" | "tab" | "surface" | "target" | "queue" | "mode" | "entry_type" | "status";
type AnalyticsMetadata = Partial<Record<AnalyticsMetadataKey, string | number | boolean | undefined>>;

type TrackAnalyticsEventInput = {
  eventName: string;
  screen?: string;
  path?: string;
  entityType?: string;
  entityId?: string;
  matchRoomId?: string;
  tournamentId?: string;
  metadata?: AnalyticsMetadata;
};

const sessionId = `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const allowedMetadataKeys = new Set<AnalyticsMetadataKey>(["source", "action", "tab", "surface", "target", "queue", "mode", "entry_type", "status"]);

function platform(): AnalyticsPlatform {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "web") return "web";
  return "android";
}

function appVersion() {
  return Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? undefined;
}

function cleanMetadata(metadata: TrackAnalyticsEventInput["metadata"]) {
  if (!metadata) return undefined;
  return Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) =>
      allowedMetadataKeys.has(key as AnalyticsMetadataKey) &&
      (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    )
  );
}

export function trackAnalyticsEvent(input: TrackAnalyticsEventInput) {
  void apiRequest<{ event_id: string }>("/analytics/events", {
    method: "POST",
    body: {
      event_name: input.eventName,
      platform: platform(),
      session_id: sessionId,
      app_version: appVersion(),
      screen: input.screen,
      path: input.path,
      entity_type: input.entityType,
      entity_id: input.entityId,
      match_room_id: input.matchRoomId,
      tournament_id: input.tournamentId,
      metadata: cleanMetadata(input.metadata),
      occurred_at: new Date().toISOString()
    }
  }).catch(() => undefined);
}
