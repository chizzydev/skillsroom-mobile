import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, Bell, Check, ChevronRight, MessageCircle, RefreshCw } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { listDmRequests } from "../../../api/chat";
import { plainApiError } from "../../../api/errors";
import { listNotifications, markNotificationRead } from "../../../api/notifications";
import { AppScreen } from "../../../components/screen/AppScreen";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, spacing } from "../../../constants/theme";
import type { UserNotification } from "../../../types/api";
import { routeFromUserNotification } from "../notificationRouting";

type InboxTab = "unread" | "read";

function formatWhen(value?: string) {
  if (!value) return "Just now";
  return new Date(value).toLocaleString("en-NG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function NotificationsScreen() {
  const [tab, setTab] = useState<InboxTab>("unread");
  const [notice, setNotice] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({ queryKey: ["notifications", tab], queryFn: () => listNotifications(tab) });
  const dmRequestsQuery = useQuery({ queryKey: ["notifications", "dm-requests"], queryFn: listDmRequests });
  const pendingDmRequests = useMemo(() => (dmRequestsQuery.data ?? []).filter((request) => request.status === "pending"), [dmRequestsQuery.data]);

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async () => {
      setNotice(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] })
      ]);
    },
    onError: (error) => setNotice(plainApiError(error, "Could not mark this notification as read."))
  });

  async function openNotification(notification: UserNotification) {
    if (notification.status === "unread") {
      readMutation.mutate(notification.id);
    }
    const target = routeFromUserNotification(notification);
    if (target) {
      router.push(target as never);
      return;
    }
    setNotice("Marked as read. This update does not need another screen.");
  }

  return (
    <AppScreen>
      <SurfaceCard dark style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroActions}>
            <Pressable accessibilityLabel="Go back" style={styles.iconButton} onPress={() => router.back()}>
              <ArrowLeft color={colors.white} size={20} strokeWidth={2.7} />
            </Pressable>
            <Badge tone="cyan">Inbox</Badge>
          </View>
          <Pressable accessibilityLabel="Refresh notifications" style={styles.iconButton} onPress={() => void notificationsQuery.refetch()}>
            <RefreshCw color={colors.white} size={19} strokeWidth={2.5} />
          </Pressable>
        </View>
        <Text style={styles.heroTitle}>Notifications and requests.</Text>
        <Text style={styles.heroCopy}>Room invites, DM requests, match updates, wallet movement, and tournament activity live here.</Text>
      </SurfaceCard>

      <View style={styles.tabs}>
        {(["unread", "read"] as const).map((item) => (
          <Pressable key={item} style={[styles.tab, tab === item && styles.tabActive]} onPress={() => setTab(item)}>
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item === "unread" ? "Unread" : "Read"}</Text>
          </Pressable>
        ))}
      </View>

      {notice ? <FormNotice tone="error" message={notice} /> : null}

      <SurfaceCard>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <MessageCircle color={colors.cyan} size={21} />
          </View>
          <View style={styles.main}>
            <Text style={styles.sectionTitle}>DM requests</Text>
            <Text style={styles.copy}>{pendingDmRequests.length ? `${pendingDmRequests.length} request${pendingDmRequests.length === 1 ? "" : "s"} waiting.` : "No private chat requests waiting."}</Text>
          </View>
          <Pressable style={styles.smallAction} onPress={() => router.push("/(app)/chat/dm-requests")}>
            <ChevronRight color={colors.ink} size={20} />
          </Pressable>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Bell color={colors.cyan} size={21} />
          </View>
          <View style={styles.main}>
            <Text style={styles.sectionTitle}>{tab === "unread" ? "Unread updates" : "Read updates"}</Text>
            <Text style={styles.copy}>Tap any update to open the related Skillsroom area.</Text>
          </View>
        </View>

        {notificationsQuery.isLoading ? <Text style={styles.copy}>Loading notifications...</Text> : null}
        {notificationsQuery.isError ? (
          <FeedbackState tone="error" title="Unable to load notifications" body="Check your connection and try again." actionLabel="Retry" onAction={() => void notificationsQuery.refetch()} />
        ) : null}
        {!notificationsQuery.isLoading && !notificationsQuery.isError && !notificationsQuery.data?.length ? (
          <FeedbackState title={tab === "unread" ? "Inbox is clear" : "No read notifications yet"} body={tab === "unread" ? "New room, chat, wallet, and tournament updates will appear here." : "Updates you mark as read will appear here."} />
        ) : null}

        {(notificationsQuery.data ?? []).map((notification) => (
          <Pressable key={notification.id} style={styles.notificationRow} onPress={() => void openNotification(notification)}>
            <View style={styles.notificationDot} />
            <View style={styles.main}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              <Text style={styles.notificationBody}>{notification.body}</Text>
              <Text style={styles.notificationTime}>{formatWhen(notification.created_at)}</Text>
            </View>
            {notification.status === "unread" ? (
              <Pressable
                disabled={readMutation.isPending}
                style={styles.readButton}
                onPress={(event) => {
                  event.stopPropagation();
                  readMutation.mutate(notification.id);
                }}
              >
                <Check color={colors.greenDark} size={18} strokeWidth={2.6} />
              </Pressable>
            ) : (
              <ChevronRight color={colors.faint} size={20} />
            )}
          </Pressable>
        ))}
      </SurfaceCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.lg },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
  iconButton: { width: 42, height: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: "#1d3147", alignItems: "center", justifyContent: "center", backgroundColor: colors.navySoft },
  heroTitle: { color: colors.white, fontSize: 33, lineHeight: 38, fontWeight: "900" },
  heroCopy: { color: "#c8d4df", fontSize: 16, lineHeight: 24 },
  tabs: { flexDirection: "row", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: radius.lg, padding: 4 },
  tab: { flex: 1, minHeight: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: colors.navy },
  tabText: { color: colors.muted, fontWeight: "900" },
  tabTextActive: { color: colors.white },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  sectionIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.cyanSoft, alignItems: "center", justifyContent: "center" },
  main: { flex: 1, minWidth: 0 },
  sectionTitle: { color: colors.ink, fontSize: 22, lineHeight: 27, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  smallAction: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.cyanSoft, alignItems: "center", justifyContent: "center" },
  notificationRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  notificationDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.cyan, marginTop: 6 },
  notificationTitle: { color: colors.ink, fontSize: 16, lineHeight: 21, fontWeight: "900" },
  notificationBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4, flexShrink: 1 },
  notificationTime: { color: colors.faint, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, marginTop: spacing.sm },
  readButton: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" }
});
