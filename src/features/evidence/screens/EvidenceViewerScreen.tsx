import { router, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { ArrowLeft, ExternalLink, FileWarning } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { refreshAccessToken } from "../../../api/client";
import { getStoredTokens } from "../../../api/session";
import { env } from "../../../config/env";
import { colors, radius, spacing } from "../../../constants/theme";

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

const videoExtensions = new Set(["mp4", "mov", "m4v", "webm"]);
const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function extensionFrom(value?: string | null) {
  const match = value?.toLowerCase().match(/\.([a-z0-9]+)(?:$|[?#])/);
  return match?.[1] ?? null;
}

function headerValue(headers: Record<string, string> | undefined, name: string) {
  const wanted = name.toLowerCase();
  return Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === wanted)?.[1] ?? null;
}

function mediaKind(contentType?: string | null, fileName?: string | null, url?: string | null) {
  const normalizedType = contentType?.toLowerCase() ?? "";
  if (normalizedType.startsWith("video/")) return "video";
  if (normalizedType.startsWith("image/")) return "image";

  const extension = extensionFrom(fileName) ?? extensionFrom(url);
  if (extension && videoExtensions.has(extension)) return "video";
  if (extension && imageExtensions.has(extension)) return "image";
  return "file";
}

function mimeType(contentType?: string | null, fileName?: string | null, url?: string | null) {
  const normalizedType = contentType?.split(";")[0]?.trim();
  if (normalizedType) return normalizedType;

  const extension = extensionFrom(fileName) ?? extensionFrom(url);
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "mov":
      return "video/quicktime";
    case "m4v":
      return "video/x-m4v";
    case "webm":
      return "video/webm";
    default:
      return "video/mp4";
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function evidenceHtml(localUri: string, kind: string, title: string, type: string) {
  const safeUri = escapeHtml(localUri);
  const safeTitle = escapeHtml(title);

  const body =
    kind === "video"
      ? `<video controls playsinline preload="metadata" src="${safeUri}" type="${escapeHtml(type)}"></video>`
      : kind === "image"
        ? `<img alt="${safeTitle}" src="${safeUri}" />`
        : `<main><p>This file is ready.</p><a href="${safeUri}">Open evidence</a></main>`;

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <style>
      html, body { margin: 0; min-height: 100%; background: #0b1720; color: #e8f3f7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; }
      video, img { display: block; width: 100%; max-width: 100%; max-height: calc(100vh - 32px); border-radius: 16px; background: #000; object-fit: contain; }
      main { text-align: center; font-size: 15px; }
      a { color: #27c7e8; font-weight: 800; }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

function cacheName(fileName?: string | null, url?: string | null) {
  const source = fileName ?? url ?? `evidence-${Date.now()}`;
  return source.replace(/[^a-z0-9._-]/gi, "_").slice(-160);
}

async function ensureCacheDirectory() {
  const root = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!root) throw new Error("Evidence cache is not available on this device.");
  const directory = `${root}skillsroom-evidence/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
}

export function EvidenceViewerScreen() {
  const params = useLocalSearchParams<{ title?: string; url?: string; externalUrl?: string; fileName?: string }>();
  const title = firstParam(params.title) ?? "Evidence";
  const url = firstParam(params.url);
  const externalUrl = firstParam(params.externalUrl) ?? url;
  const fileName = firstParam(params.fileName);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
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

  useEffect(() => {
    let active = true;

    async function downloadEvidence(token: string | null, retried = false): Promise<void> {
      if (!url) {
        if (active) setError("This evidence link is missing.");
        return;
      }

      if (needsAuth && !token) {
        if (active) setError("Sign in again before opening this evidence.");
        return;
      }

      if (active) {
        setLoadingEvidence(true);
        setError(null);
        setLocalUri(null);
      }

      try {
        const directory = await ensureCacheDirectory();
        const target = `${directory}${cacheName(fileName, url)}`;
        await FileSystem.deleteAsync(target, { idempotent: true });

        const result = await FileSystem.downloadAsync(url, target, {
          headers: needsAuth && token
            ? {
                Authorization: `Bearer ${token}`,
                Accept: "*/*",
                "X-Skillsroom-Client": "mobile"
              }
            : undefined
        });

        if (!active) return;

        if (result.status === 401 && needsAuth && !retried) {
          const nextToken = await refreshAccessToken();
          if (nextToken) {
            await downloadEvidence(nextToken, true);
            return;
          }
        }

        if (result.status < 200 || result.status >= 300) {
          setError(
            result.status === 404
              ? "Evidence file was not found. Refresh the room and try again."
              : `Evidence returned ${result.status}.`
          );
          return;
        }

        setContentType(headerValue(result.headers, "content-type"));
        setLocalUri(result.uri);
      } catch {
        if (active) setError("This evidence could not be downloaded for preview.");
      } finally {
        if (active) setLoadingEvidence(false);
      }
    }

    if (!loadingToken && url) {
      void downloadEvidence(accessToken);
    }

    return () => {
      active = false;
    };
  }, [accessToken, fileName, loadingToken, needsAuth, url]);

  const kind = mediaKind(contentType, fileName, url);
  const resolvedMimeType = mimeType(contentType, fileName, url);
  const canLoad = Boolean(localUri);
  const viewerSource = localUri
    ? { html: evidenceHtml(localUri, kind, title, resolvedMimeType), baseUrl: localUri }
    : undefined;

  function openExternally() {
    const fallback = localUri ?? externalUrl ?? url;
    if (fallback) void Linking.openURL(fallback);
  }

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
        {externalUrl || localUri ? (
          <Pressable accessibilityLabel="Open externally" onPress={openExternally} style={styles.iconButton}>
            <ExternalLink color={colors.cyan} size={20} strokeWidth={2.5} />
          </Pressable>
        ) : null}
      </View>

      {loadingToken || loadingEvidence ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.copy}>{loadingToken ? "Preparing secure evidence viewer..." : "Downloading evidence..."}</Text>
        </View>
      ) : null}

      {!loadingToken && !loadingEvidence && !canLoad ? (
        <View style={styles.center}>
          <View style={styles.warningIcon}>
            <FileWarning color={colors.amber} size={28} />
          </View>
          <Text style={styles.emptyTitle}>Evidence could not open</Text>
          <Text style={styles.copy}>{error ?? "This evidence link is missing or needs a fresh sign-in."}</Text>
        </View>
      ) : null}

      {!loadingToken && !loadingEvidence && canLoad && viewerSource ? (
        <>
          <WebView
            source={viewerSource}
            style={styles.viewer}
            originWhitelist={["*"]}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
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
              <Pressable onPress={openExternally} style={styles.fallbackButton}>
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
