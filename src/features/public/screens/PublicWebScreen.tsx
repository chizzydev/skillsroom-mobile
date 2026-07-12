import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type { WebView as WebViewType } from "react-native-webview";
import { env } from "../../../config/env";
import { colors, radius, spacing } from "../../../constants/theme";

const allowedPaths = new Set([
  "/community",
  "/community/highlights",
  "/community/proof",
  "/policies",
  "/terms",
  "/privacy",
  "/refunds",
  "/prizes",
  "/disputes",
  "/eligibility",
  "/conduct",
  "/compliance"
]);

const allowedPrefixes = [
  "/community/announcements/",
  "/community/winners/tournaments/",
  "/community/winners/matches/",
  "/community/clans/",
  "/community/players/"
];

function pathFromParam(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== "string") return "/community";
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  if (normalized.includes("://") || normalized.startsWith("//") || normalized.includes("\\") || normalized.includes("..")) {
    return "/community";
  }
  return allowedPaths.has(normalized) || allowedPrefixes.some((prefix) => normalized.startsWith(prefix)) ? normalized : "/community";
}

function titleFromPath(path: string) {
  if (path === "/community") return "Community";
  if (path === "/community/highlights") return "Highlights";
  if (path === "/community/proof") return "Platform activity";
  if (path.startsWith("/community/announcements/")) return "Announcement";
  if (path.startsWith("/community/winners/")) return "Winner story";
  if (path.startsWith("/community/clans/")) return "Clan";
  if (path.startsWith("/community/players/")) return "Player";
  if (path === "/policies") return "Player guide";
  if (path === "/terms") return "Terms";
  if (path === "/privacy") return "Privacy";
  if (path === "/refunds") return "Refunds";
  if (path === "/prizes") return "Prizes";
  if (path === "/disputes") return "Disputes";
  if (path === "/eligibility") return "Eligibility";
  if (path === "/conduct") return "Conduct";
  if (path === "/compliance") return "Skill gaming";
  return "Skillsroom";
}

export function publicWebHref(path: string) {
  return `/public-web?path=${encodeURIComponent(path)}`;
}

export function PublicWebScreen() {
  const params = useLocalSearchParams<{ path?: string }>();
  const path = pathFromParam(params.path);
  const url = useMemo(() => `${env.webAppUrl}${path}`, [path]);
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebViewType>(null);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft size={22} color={colors.ink} strokeWidth={2.7} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{titleFromPath(path)}</Text>
          <Text style={styles.url} numberOfLines={1}>{new URL(env.webAppUrl).hostname}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => webViewRef.current?.reload()} style={styles.iconButton}>
          <RefreshCw size={19} color={colors.ink} strokeWidth={2.6} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(url)} style={styles.iconButton}>
          <ExternalLink size={19} color={colors.ink} strokeWidth={2.6} />
        </Pressable>
      </View>
      <View style={styles.webWrap}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.greenDark} />
            <Text style={styles.loadingText}>Opening Skillsroom...</Text>
          </View>
        ) : null}
        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          startInLoadingState
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          style={styles.webview}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.white
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.line
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  url: { color: colors.muted, fontSize: 12, fontWeight: "800", marginTop: 2 },
  webWrap: { flex: 1, backgroundColor: colors.white },
  loading: {
    position: "absolute",
    zIndex: 2,
    left: 0,
    right: 0,
    top: 0,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt
  },
  loadingText: { color: colors.muted, fontWeight: "900" },
  webview: { flex: 1, backgroundColor: colors.white }
});
