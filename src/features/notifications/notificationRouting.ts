import type { Href } from "expo-router";
import type { UserNotification } from "../../types/api";

type NotificationRouteInput = {
  actionUrl?: string | null;
  matchRoomId?: string | null;
  notificationType?: string | null;
  metadata?: Record<string, unknown> | null;
  tournamentId?: string | null;
};

function text(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function metadataText(input: NotificationRouteInput, key: string) {
  return text(input.metadata?.[key]);
}

function encoded(value: string) {
  return encodeURIComponent(value);
}

function matchSection(actionUrl: string, notificationType: string) {
  if (notificationType.startsWith("match_result_response")) return "result";
  if (actionUrl.includes("#result")) return "result";
  if (actionUrl.includes("#funding")) return "funding";
  if (actionUrl.includes("#live")) return "live";
  if (actionUrl.includes("#players")) return "players";
  if (actionUrl.includes("#room-flow") || actionUrl.includes("#history")) return "history";
  return "overview";
}

function matchFocus(actionUrl: string, notificationType: string) {
  if (notificationType.startsWith("match_result_response") || actionUrl.includes("#result-response")) return "result-response";
  if (actionUrl.includes("#result")) return "result-claim";
  if (actionUrl.includes("#funding")) return "funding-action";
  if (actionUrl.includes("#live")) return "live-action";
  if (actionUrl.includes("#players")) return "players-list";
  if (actionUrl.includes("#room-flow") || actionUrl.includes("#history")) return "history";
  return "section";
}

function tournamentView(actionUrl: string, notificationType: string) {
  if (actionUrl.includes("#registration")) return "entry";
  if (actionUrl.includes("#contribution") || actionUrl.includes("#prizes")) return "entry";
  if (actionUrl.includes("#result-reviews") || actionUrl.includes("#competition")) return "bracket";
  if (actionUrl.includes("#standings")) return "standings";
  if (actionUrl.includes("#streams") || actionUrl.includes("#broadcast")) return "streams";
  if (notificationType === "tournament_registration" || notificationType === "tournament_check_in") return "entry";
  if (notificationType.includes("payout") || notificationType.includes("refund") || notificationType.includes("wallet")) return "entry";
  if (notificationType.includes("result") || notificationType === "tournament_match_ready") return "bracket";
  return "overview";
}

function tournamentFocus(actionUrl: string, notificationType: string) {
  if (actionUrl.includes("#registration")) return "registration";
  if (actionUrl.includes("#contribution") || actionUrl.includes("#prizes") || notificationType.includes("payout") || notificationType.includes("refund") || notificationType.includes("wallet")) return "payment";
  if (actionUrl.includes("#result-reviews") || actionUrl.includes("#competition") || notificationType.includes("result") || notificationType === "tournament_match_ready") return "bracket";
  if (actionUrl.includes("#standings")) return "standings";
  if (actionUrl.includes("#streams") || actionUrl.includes("#broadcast")) return "streams";
  if (notificationType === "tournament_registration" || notificationType === "tournament_check_in") return "registration";
  return "section";
}

export function routeFromNotificationPayload(input: NotificationRouteInput): Href | null {
  const actionUrl = input.actionUrl ?? "";
  const notificationType = input.notificationType ?? "";
  const announcementId = metadataText(input, "announcement_id");

  if (notificationType.includes("announcement") && announcementId) {
    return `/community/announcements/${encoded(announcementId)}` as Href;
  }

  const actionAnnouncement = actionUrl.match(/^\/community\/announcements\/([^/?#]+)/);
  if (actionAnnouncement?.[1]) {
    return `/community/announcements/${encoded(decodeURIComponent(actionAnnouncement[1]))}` as Href;
  }

  const actionMatch = actionUrl.match(/^\/(?:matches|rooms)\/([^/?#]+)/);
  const roomId = input.matchRoomId ?? metadataText(input, "match_room_id") ?? (actionMatch?.[1] ? decodeURIComponent(actionMatch[1]) : null);
  if (roomId) {
    const section = matchSection(actionUrl, notificationType);
    const focus = matchFocus(actionUrl, notificationType);
    return `/(app)/rooms/${encoded(roomId)}?section=${encoded(section)}&focus=${encoded(focus)}` as Href;
  }

  const actionTournament = actionUrl.match(/^\/tournaments\/([^/?#]+)/);
  const tournamentId = input.tournamentId ?? metadataText(input, "tournament_id") ?? (actionTournament?.[1] ? decodeURIComponent(actionTournament[1]) : null);
  if (tournamentId) {
    const view = tournamentView(actionUrl, notificationType);
    const focus = tournamentFocus(actionUrl, notificationType);
    return `/(app)/tournaments/${encoded(tournamentId)}?view=${encoded(view)}&focus=${encoded(focus)}` as Href;
  }

  const chatChannel = actionUrl.match(/^\/chat\?channel=([^&#]+)/);
  if (chatChannel?.[1]) return `/(app)/chat/${encoded(decodeURIComponent(chatChannel[1]))}` as Href;

  if (actionUrl === "/community" || actionUrl === "/community/") return { pathname: "/community", params: { tab: "hub" } } as Href;
  if (actionUrl.startsWith("/community/highlights") || actionUrl.startsWith("/community/winners/")) return { pathname: "/community", params: { tab: "highlights" } } as Href;
  if (actionUrl.startsWith("/community/announcements")) return { pathname: "/community", params: { tab: "updates" } } as Href;
  if (actionUrl.startsWith("/community/clans")) return { pathname: "/community", params: { tab: "clans" } } as Href;
  if (actionUrl.startsWith("/community/players") || actionUrl.startsWith("/community/leaderboard")) return { pathname: "/community", params: { tab: "rankings" } } as Href;
  if (actionUrl.startsWith("/chat")) return "/(app)/(tabs)/chat" as Href;
  if (actionUrl.startsWith("/wallet") || notificationType.includes("wallet") || notificationType.includes("topup")) return "/(app)/(tabs)/wallet" as Href;
  if (actionUrl.startsWith("/profile") || notificationType.includes("payout")) return "/(app)/(tabs)/profile" as Href;
  if (actionUrl.startsWith("/notifications")) return "/(app)/notifications" as Href;
  if (notificationType.includes("chat")) return "/(app)/(tabs)/chat" as Href;
  if (notificationType.includes("tournament")) return "/(app)/(tabs)/tournaments" as Href;
  return null;
}

export function routeFromUserNotification(notification: UserNotification): Href | null {
  return routeFromNotificationPayload({
    actionUrl: notification.action_url,
    matchRoomId: notification.match_room_id,
    notificationType: notification.notification_type,
    metadata: notification.metadata,
    tournamentId: text(notification.metadata?.tournament_id)
  });
}
