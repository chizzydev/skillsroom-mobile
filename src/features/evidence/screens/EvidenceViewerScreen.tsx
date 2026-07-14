import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ExternalLink, FileWarning } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { getStoredTokens } from "../../../api/session";
import { env } from "../../../config/env";
import { colors, radius, spacing } from "../../../constants/theme";

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function EvidenceViewerScreen() {
  const params = useLocalSearchParams<{ title?: string; url?: string; externalUrl?: string; fileName?: string }>();
  const title = firstParam(params.title) ?? "Evidence";
  const url = firstParam(params.url);
  const externalUrl = firstParam(params.externalUrl) ?? url;
  const fileName = firstParam(params.fileName);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const needsAuth = useMemo(() => Boolean(url?.startsWith(env.apiBaseUrl)), [url]);

  useEffect(() => {
    let active = true;
    getStoredTokens()
      .then((tokens) => {
        if (!active) return;
        setAccessToken(tokens.accessToken);
      })
      .catch(() => {
        if (active) setError("Sign in again before opening this evidence.");
      })
      .finally(() => {
        if (active) setLoadingToken(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const canLoad = Boolean(url && (!needsAuth || accessToken));
  const headers = needsAuth && accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
        Accept: "*/*",
        "X-Skillsroom-Client": "mobile"
      }
    : undefined;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft color={colors.ink} size={22} strokeWidth={2.7} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.meta} numberOfLines={1}>{fileName ?? "Skillsroom evidence"}</Text>
        </View>
        {externalUrl ? (
          <Pressable accessibilityLabel="Open externally" onPress={() => void Linking.openURL(externalUrl)} style={styles.iconButton}>
            <ExternalLink color={colors.cyan} size={20} strokeWidth={2.5} />
          </Pressable>
        ) : null}
      </View>

      {loadingToken ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.copy}>Preparing secure evidence viewer...</Text>
        </View>
      ) : null}

      {!loadingToken && !canLoad ? (
        <View style={styles.center}>
          <View style={styles.warningIcon}>
            <FileWarning color={colors.amber} size={28} />
          </View>
          <Text style={styles.emptyTitle}>Evidence could not open</Text>
          <Text style={styles.copy}>{error ?? "This evidence link is missing or needs a fresh sign-in."}</Text>
        </View>
      ) : null}

      {!loadingToken && canLoad && url ? (
        <>
          <WebView
            source={{ uri: url, headers }}
            style={styles.viewer}
            originWhitelist={["*"]}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled={false}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.center}>
                <ActivityIndicator color={colors.cyan} />
                <Text style={styles.copy}>Loading evidence...</Text>
              </View>
            )}
            onHttpError={(event) => {
              setError(`Evidence returned ${event.nativeEvent.statusCode}.`);
            }}
            onError={() => {
              setError("This evidence could not be previewed in the app.");
            }}
          />
          {error ? (
            <View style={styles.inlineError}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => void Linking.openURL(externalUrl ?? url)} style={styles.fallbackButton}>
                <Text style={styles.fallbackText}>Open externally</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  headerText: { flex: 1 },
  title: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  viewer: { flex: 1, backgroundColor: colors.bg },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  warningIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.amberSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  inlineError: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.red,
    backgroundColor: colors.redSoft,
    padding: spacing.md,
    gap: spacing.sm
  },
  errorText: { color: colors.red, fontSize: 13, fontWeight: "800" },
  fallbackButton: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  fallbackText: { color: colors.ink, fontSize: 13, fontWeight: "900" }
});
