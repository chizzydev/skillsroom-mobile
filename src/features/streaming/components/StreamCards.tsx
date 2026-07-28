import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { env } from "../../../config/env";
import { colors, radius, spacing } from "../../../constants/theme";
import type { CommunityLivestreamLink, StreamingAccount } from "../../../types/api";

type StreamProvider = "youtube" | "twitch" | "tiktok" | "kick";
type StreamFormNotice = { tone: "info" | "error" | "success"; message: string } | null;
type AttachInput = {
  title: string;
  stream_url: string;
  provider?: StreamProvider;
  visibility: "public" | "participants";
  stream_role: "official" | "player_a" | "player_b";
};

type StreamTelemetryEvent = "blocked_navigation" | "load_error" | "http_error" | "missing_embed" | "external_open_failed";
type StreamPlayerConfig = {
  label: string;
  dependableForLive: boolean;
  domains: string[];
  fallbackMessage: string;
  unsupportedEmbedMessage: string;
};

const playerConfigs: Record<StreamProvider, StreamPlayerConfig> = {
  youtube: {
    label: "YouTube",
    dependableForLive: true,
    domains: [
      "youtube.com",
      "youtube-nocookie.com",
      "youtu.be",
      "ytimg.com",
      "youtubei.googleapis.com",
      "googleapis.com",
      "googlevideo.com",
      "gstatic.com",
      "google.com",
      "googleusercontent.com",
      "ggpht.com"
    ],
    fallbackMessage: "YouTube blocked the embedded player here. Open it externally to keep watching.",
    unsupportedEmbedMessage: "This YouTube link cannot be embedded here. Open it externally to watch."
  },
  twitch: {
    label: "Twitch",
    dependableForLive: true,
    domains: ["twitch.tv", "ext-twitch.tv", "twitchcdn.net", "twitchstatic.com", "jtvnw.net"],
    fallbackMessage: "Twitch blocked the embedded player here. Open it externally to keep watching.",
    unsupportedEmbedMessage: "This Twitch link cannot be embedded here. Open it externally to watch."
  },
  tiktok: {
    label: "TikTok",
    dependableForLive: false,
    domains: [
      "tiktok.com",
      "tiktokv.com",
      "tiktokcdn.com",
      "tiktokcdn-us.com",
      "byteoversea.com",
      "ibytedtos.com",
      "ibyteimg.com",
      "ttwstatic.com",
      "muscdn.com",
      "byteimg.com",
      "isnssdk.com"
    ],
    fallbackMessage: "TikTok blocked the embedded player here. Open it externally to keep watching.",
    unsupportedEmbedMessage: "TikTok LIVE and short links may not embed in-app. Open it externally to watch."
  },
  kick: {
    label: "Kick",
    dependableForLive: true,
    domains: ["kick.com", "player.kick.com"],
    fallbackMessage: "Kick blocked the embedded player here. Open it externally to keep watching.",
    unsupportedEmbedMessage: "This Kick link cannot be embedded here. Open it externally to watch."
  }
};

const streamUrlPlaceholders: Record<StreamProvider, string> = {
  youtube: "https://www.youtube.com/watch?v=...",
  twitch: "https://www.twitch.tv/...",
  kick: "https://kick.com/...",
  tiktok: "https://www.tiktok.com/@player/video/..."
};

const streamSubmitHosts: Record<StreamProvider, string[]> = {
  youtube: ["youtube.com", "youtu.be"],
  twitch: ["twitch.tv"],
  kick: ["kick.com", "player.kick.com"],
  tiktok: ["tiktok.com", "tiktokv.com", "vt.tiktok.com"]
};

function clean(value?: string | null) {
  return String(value ?? "").replaceAll("_", " ") || "stream";
}

function roleLabel(value: AttachInput["stream_role"]) {
  if (value === "player_a") return "Player A";
  if (value === "player_b") return "Player B";
  return "Official";
}

function visibilityLabel(value: AttachInput["visibility"]) {
  return value === "participants" ? "Participants" : "Public";
}

function tone(value?: string | null): "cyan" | "green" | "amber" | "red" | "dark" {
  if (value === "live" || value === "connected" || value === "active") return "green";
  if (value === "offline" || value === "unavailable" || value === "revoked") return "red";
  if (value === "needs_reauth" || value === "manual" || value === "replay") return "amber";
  return "cyan";
}

function providerHint(provider?: string | null) {
  if (isStreamProvider(provider)) return playerConfigs[provider].label;
  return "Stream";
}

function isStreamProvider(provider?: string | null): provider is StreamProvider {
  return provider === "youtube" || provider === "twitch" || provider === "tiktok" || provider === "kick";
}

function inferStreamProvider(input: { provider?: string | null; streamUrl?: string | null; embedUrl?: string | null }): StreamProvider | null {
  if (isStreamProvider(input.provider)) return input.provider;
  const candidate = input.streamUrl ?? input.embedUrl;
  if (!candidate) return null;
  try {
    const host = new URL(candidate).hostname.toLowerCase();
    if (host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) return "youtube";
    if (host.endsWith("twitch.tv")) return "twitch";
    if (host.endsWith("tiktok.com") || host.endsWith("tiktokv.com") || host.endsWith("vt.tiktok.com")) return "tiktok";
    if (host.endsWith("kick.com")) return "kick";
  } catch {
    return null;
  }
  return null;
}

function validateProviderUrl(provider: StreamProvider, streamUrl: string): string | null {
  try {
    const parsed = new URL(streamUrl);
    if (parsed.protocol !== "https:") return "Use a secure HTTPS stream link.";
    const host = parsed.hostname.toLowerCase();
    const detectedProvider = inferStreamProvider({ streamUrl });
    if (!detectedProvider) return "Use a YouTube, Twitch, Kick, or TikTok stream link.";
    if (detectedProvider !== provider) {
      return `Paste a ${playerConfigs[provider].label} link or choose the matching provider.`;
    }
    const allowedHosts = streamSubmitHosts[provider];
    if (!allowedHosts.some((item) => host === item || host.endsWith(`.${item}`))) {
      return `Paste a public ${playerConfigs[provider].label} link.`;
    }
    return null;
  } catch {
    return "Enter a valid stream link.";
  }
}

function streamTelemetry(event: StreamTelemetryEvent, details: Record<string, unknown>) {
  if (!__DEV__) return;
  console.warn("[stream-player]", { event, ...details });
}

function embedParent() {
  try {
    return new URL(env.webAppUrl).hostname || "skillsroom.xyz";
  } catch {
    return "skillsroom.xyz";
  }
}

function firstPathSegment(url: URL) {
  return url.pathname.split("/").filter(Boolean)[0] ?? null;
}

function youtubeEmbedUrl(url: URL) {
  if (url.hostname === "youtu.be") {
    const videoId = firstPathSegment(url);
    return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` : null;
  }

  if (!url.hostname.endsWith("youtube.com")) return null;
  if (url.pathname === "/watch") {
    const videoId = url.searchParams.get("v");
    return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` : null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if ((segments[0] === "embed" || segments[0] === "live" || segments[0] === "shorts") && segments[1]) {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(segments[1])}`;
  }
  return null;
}

function twitchEmbedUrl(url: URL) {
  if (!url.hostname.endsWith("twitch.tv")) return null;
  const parent = encodeURIComponent(embedParent());
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] === "videos" && segments[1]) {
    return `https://player.twitch.tv/?video=${encodeURIComponent(segments[1])}&parent=${parent}`;
  }
  const channel = firstPathSegment(url);
  if (!channel || ["directory", "downloads", "jobs", "p", "settings", "team", "turbo", "videos"].includes(channel)) return null;
  return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}`;
}

function tiktokEmbedUrl(url: URL) {
  if (!url.hostname.endsWith("tiktok.com")) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const videoIndex = segments.findIndex((segment) => segment === "video");
  const videoId = videoIndex >= 0 ? segments[videoIndex + 1] : null;
  return videoId && /^\d+$/.test(videoId) ? `https://www.tiktok.com/embed/v2/${encodeURIComponent(videoId)}` : null;
}

function kickEmbedUrl(url: URL) {
  if (!url.hostname.endsWith("kick.com")) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const username = url.hostname === "player.kick.com" ? segments[0] : firstPathSegment(url);
  if (!username || ["about", "browse", "categories", "community-guidelines", "privacy-policy", "terms-of-service"].includes(username)) return null;
  return `https://player.kick.com/${encodeURIComponent(username)}`;
}

function computedEmbedUrl(input: { provider?: string | null; streamUrl?: string | null; embedUrl?: string | null }) {
  if (input.embedUrl) return input.embedUrl;
  if (!input.streamUrl) return null;

  try {
    const url = new URL(input.streamUrl);
    if (url.protocol !== "https:") return null;
    const provider = inferStreamProvider(input);
    if (provider === "youtube") return youtubeEmbedUrl(url);
    if (provider === "twitch") return twitchEmbedUrl(url);
    if (provider === "tiktok") return tiktokEmbedUrl(url);
    if (provider === "kick") return kickEmbedUrl(url);
    return youtubeEmbedUrl(url) ?? twitchEmbedUrl(url) ?? tiktokEmbedUrl(url) ?? kickEmbedUrl(url);
  } catch {
    return null;
  }
}

function allowedPlayerNavigation(requestUrl: string | undefined, provider: StreamProvider | null) {
  if (!requestUrl) return { allowed: false, reason: "missing_url", host: null };
  try {
    const url = new URL(requestUrl);
    if (url.protocol === "about:" || url.protocol === "data:" || url.protocol === "blob:") {
      return { allowed: true, reason: "internal_player_protocol", host: url.protocol };
    }
    if (url.protocol !== "https:") return { allowed: false, reason: "unsupported_protocol", host: url.hostname || url.protocol };
    const host = url.hostname.toLowerCase();
    const domains = provider ? playerConfigs[provider].domains : Object.values(playerConfigs).flatMap((config) => config.domains);
    const allowed = domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
    return { allowed, reason: allowed ? "provider_domain" : "domain_not_allowed", host };
  } catch {
    return { allowed: false, reason: "invalid_url", host: null };
  }
}

function streamViewerParams(input: {
  title?: string | null;
  provider?: string | null;
  streamUrl?: string | null;
  embedUrl?: string | null;
  externalUrl?: string | null;
}) {
  return {
    title: input.title ?? "Stream player",
    provider: input.provider ?? "",
    streamUrl: input.streamUrl ?? "",
    embedUrl: input.embedUrl ?? "",
    externalUrl: input.externalUrl ?? input.streamUrl ?? ""
  };
}

export function openStreamViewer(input: {
  title?: string | null;
  provider?: string | null;
  streamUrl?: string | null;
  embedUrl?: string | null;
  externalUrl?: string | null;
}) {
  router.push({ pathname: "/(app)/streaming/viewer", params: streamViewerParams(input) } as never);
}

export function EmbeddedStreamPlayer({
  provider,
  title,
  streamUrl,
  embedUrl,
  initiallyLoaded = false,
  fill = false,
  style
}: {
  provider?: string | null;
  title?: string | null;
  streamUrl?: string | null;
  embedUrl?: string | null;
  initiallyLoaded?: boolean;
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [loaded, setLoaded] = useState(initiallyLoaded);
  const [failed, setFailed] = useState(false);
  const resolvedProvider = inferStreamProvider({ provider, streamUrl, embedUrl });
  const source = computedEmbedUrl({ provider: resolvedProvider, streamUrl, embedUrl });
  const config = resolvedProvider ? playerConfigs[resolvedProvider] : null;
  const missingEmbedLogged = useRef(false);

  useEffect(() => {
    missingEmbedLogged.current = false;
  }, [source, streamUrl, embedUrl, resolvedProvider]);

  useEffect(() => {
    if (source || missingEmbedLogged.current) return;
    if (!streamUrl && !embedUrl) return;
    missingEmbedLogged.current = true;
    streamTelemetry("missing_embed", {
      provider: resolvedProvider ?? provider ?? "unknown",
      title: title ?? "stream",
      streamUrl,
      hasEmbedUrl: Boolean(embedUrl)
    });
  }, [embedUrl, provider, resolvedProvider, source, streamUrl, title]);

  if (!source) {
    return (
      <View style={[fill ? styles.playerWrapFill : styles.playerWrap, style]}>
        <View style={styles.playerPlaceholder}>
          <Badge tone="amber">{`${providerHint(resolvedProvider ?? provider)} player`}</Badge>
          <Text style={styles.copy}>{config?.unsupportedEmbedMessage ?? "This stream cannot be embedded here. Open it externally to watch."}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[fill ? styles.playerWrapFill : styles.playerWrap, style]}>
      {loaded && !failed ? (
        <WebView
          source={{ uri: source }}
          style={styles.webview}
          originWhitelist={["https://*"]}
          javaScriptEnabled
          domStorageEnabled
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false}
          onError={(event) => {
            streamTelemetry("load_error", {
              provider: resolvedProvider ?? "unknown",
              title: title ?? "stream",
              source,
              description: event.nativeEvent.description,
              code: event.nativeEvent.code
            });
            setFailed(true);
          }}
          onHttpError={(event) => {
            streamTelemetry("http_error", {
              provider: resolvedProvider ?? "unknown",
              title: title ?? "stream",
              source,
              statusCode: event.nativeEvent.statusCode,
              url: event.nativeEvent.url
            });
            setFailed(true);
          }}
          onShouldStartLoadWithRequest={(request) => {
            const decision = allowedPlayerNavigation(request.url, resolvedProvider);
            if (!decision.allowed) {
              streamTelemetry("blocked_navigation", {
                provider: resolvedProvider ?? "unknown",
                title: title ?? "stream",
                source,
                requestUrl: request.url,
                host: decision.host,
                reason: decision.reason,
                navigationType: request.navigationType
              });
            }
            return decision.allowed;
          }}
          accessibilityLabel={`${providerHint(resolvedProvider ?? provider)} player for ${title ?? "stream"}`}
        />
      ) : (
        <View style={styles.playerPlaceholder}>
          <Badge tone={failed ? "amber" : "dark"}>{`${providerHint(resolvedProvider ?? provider)} player`}</Badge>
          <Text style={styles.copy}>{failed ? config?.fallbackMessage ?? "Player could not load here. Open externally if this provider blocks embeds." : "Load the embedded player when you are ready to watch."}</Text>
          <AppButton variant="secondary" onPress={() => {
            setFailed(false);
            setLoaded(true);
          }}>
            Load player
          </AppButton>
        </View>
      )}
    </View>
  );
}

export function StreamLinkCard({ stream }: { stream: CommunityLivestreamLink }) {
  const provider = inferStreamProvider({ provider: stream.provider, streamUrl: stream.stream_url, embedUrl: stream.embed_url });
  const config = provider ? playerConfigs[provider] : null;
  const playerSource = computedEmbedUrl({ provider: stream.provider, streamUrl: stream.stream_url, embedUrl: stream.embed_url });
  const openExternally = async () => {
    if (!stream.stream_url) return;
    try {
      await Linking.openURL(stream.stream_url);
    } catch (error) {
      streamTelemetry("external_open_failed", {
        provider: stream.provider,
        title: stream.title ?? "stream",
        streamUrl: stream.stream_url,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.rowTop}>
        <Badge tone={tone(stream.playback_status)}>{clean(stream.playback_status)}</Badge>
        <Text style={styles.role}>{clean(stream.stream_role)}</Text>
      </View>
      <Text style={styles.title}>{stream.title ?? "Stream link"}</Text>
      <Text style={styles.copy}>{providerHint(stream.provider)} - {clean(stream.playback_status)}</Text>
      {config && !config.dependableForLive ? <Text style={styles.providerNote}>{config.unsupportedEmbedMessage}</Text> : null}
      {playerSource ? (
        <>
          <EmbeddedStreamPlayer provider={stream.provider} title={stream.title} streamUrl={stream.stream_url} embedUrl={stream.embed_url} />
          <AppButton
            variant="dark"
            onPress={() => openStreamViewer({
              title: stream.title,
              provider: stream.provider,
              streamUrl: stream.stream_url,
              embedUrl: stream.embed_url,
              externalUrl: stream.stream_url
            })}
          >
            Watch player
          </AppButton>
        </>
      ) : (
        <Text style={styles.providerNote}>This stream link opens outside Skillsroom.</Text>
      )}
      <AppButton variant="secondary" disabled={!stream.stream_url} onPress={() => void openExternally()}>
        Open externally
      </AppButton>
    </View>
  );
}

export function ConnectedChannelCard({
  account,
  onRefresh,
  loading,
  compactPlayer,
  onDisconnect,
  disconnecting
}: {
  account: StreamingAccount;
  onRefresh?: () => void;
  loading?: boolean;
  compactPlayer?: boolean;
  onDisconnect?: () => void;
  disconnecting?: boolean;
}) {
  const playerSource = computedEmbedUrl({ provider: account.provider, streamUrl: account.live_stream_url, embedUrl: account.live_embed_url });
  const hasOpenableLiveUrl = Boolean(account.live_stream_url && account.live_stream_url !== account.channel_url);
  const openUrl = async (url: string | null | undefined, label: string) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch (error) {
      streamTelemetry("external_open_failed", {
        provider: account.provider,
        title: account.display_name ?? label,
        streamUrl: url,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.rowTop}>
        <Badge tone={tone(account.status)}>{account.provider}</Badge>
        <Text style={styles.role}>{clean(account.live_status ?? account.status)}</Text>
      </View>
      <Text style={styles.title}>{account.display_name ?? "Stream channel"}</Text>
      <Text style={styles.copy}>This is your saved profile channel. It is not a room or tournament stream until attached to one.</Text>
      {playerSource ? (
        compactPlayer ? (
          <Text style={styles.providerNote}>Live video is available. Open the player for a larger viewing screen.</Text>
        ) : (
          <EmbeddedStreamPlayer provider={account.provider} title={account.live_title ?? account.display_name} streamUrl={account.live_stream_url} embedUrl={account.live_embed_url} />
        )
      ) : (
        <Text style={styles.providerNote}>This saved channel opens on {providerHint(account.provider)}.</Text>
      )}
      {playerSource ? (
        <AppButton
          variant="dark"
          onPress={() => openStreamViewer({
            title: account.live_title ?? account.display_name,
            provider: account.provider,
            streamUrl: account.live_stream_url,
            embedUrl: account.live_embed_url,
            externalUrl: account.live_stream_url ?? account.channel_url
          })}
        >
          Watch player
        </AppButton>
      ) : null}
      {account.channel_url ? (
        <AppButton variant="secondary" onPress={() => void openUrl(account.channel_url, "channel")}>
          Open channel
        </AppButton>
      ) : null}
      {hasOpenableLiveUrl ? (
        <AppButton variant="secondary" onPress={() => void openUrl(account.live_stream_url, "live video")}>
          Open live video
        </AppButton>
      ) : null}
      {onRefresh ? <AppButton variant="secondary" loading={loading} onPress={onRefresh}>Refresh status</AppButton> : null}
      {onDisconnect ? <AppButton variant="danger" loading={disconnecting} onPress={onDisconnect}>Disconnect channel</AppButton> : null}
    </View>
  );
}

export function NoStreamState({ target }: { target: "room" | "tournament" }) {
  return (
    <FeedbackState
      title={`No ${target} stream yet`}
      body="Connected profile channels are separate from watch links. A stream appears here only after an eligible host attaches a live link to this room or tournament."
    />
  );
}

export function StreamAttachForm({
  canAttach,
  target,
  loading,
  resetSignal,
  onSubmit
}: {
  canAttach: boolean;
  target: "room" | "tournament";
  loading?: boolean;
  resetSignal?: number;
  onSubmit: (input: AttachInput) => void;
}) {
  const [provider, setProvider] = useState<StreamProvider>("youtube");
  const [visibility, setVisibility] = useState<"public" | "participants">("participants");
  const [streamRole, setStreamRole] = useState<"official" | "player_a" | "player_b">("official");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState<StreamFormNotice>(null);

  useEffect(() => {
    setTitle("");
    setUrl("");
    setNotice(null);
  }, [resetSignal]);

  const submit = () => {
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();
    const validationMessage = validateProviderUrl(provider, trimmedUrl);
    if (validationMessage) {
      setNotice({ tone: "error", message: validationMessage });
      return;
    }
    setNotice(null);
    onSubmit({ provider, visibility, stream_role: streamRole, title: trimmedTitle, stream_url: trimmedUrl });
  };

  if (!canAttach) {
    return <FormNotice tone="info" message={`Only eligible ${target} hosts can attach stream links here. Viewers will still see the stream once it is attached.`} />;
  }

  return (
    <View style={styles.attach}>
      <Text style={styles.title}>Attach stream link</Text>
      <View style={styles.segmentRow}>
        {(["youtube", "twitch", "kick", "tiktok"] as const).map((item) => (
          <Pressable key={item} onPress={() => {
            setProvider(item);
            setNotice(null);
          }} style={[styles.segment, provider === item && styles.segmentOn]}>
            <Text style={[styles.segmentText, provider === item && styles.segmentTextOn]}>{playerConfigs[item].label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.segmentRow}>
        {(["official", "player_a", "player_b"] as const).map((item) => (
          <Pressable key={item} onPress={() => setStreamRole(item)} style={[styles.segment, streamRole === item && styles.segmentOn]}>
            <Text style={[styles.segmentText, streamRole === item && styles.segmentTextOn]}>{roleLabel(item)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.segmentRow}>
        {(["participants", "public"] as const).map((item) => (
          <Pressable key={item} onPress={() => setVisibility(item)} style={[styles.segment, visibility === item && styles.segmentOn]}>
            <Text style={[styles.segmentText, visibility === item && styles.segmentTextOn]}>{visibilityLabel(item)}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={title} onChangeText={setTitle} placeholder="Stream title" placeholderTextColor={colors.faint} style={styles.input} />
      <TextInput value={url} onChangeText={(value) => {
        setUrl(value);
        if (notice) setNotice(null);
      }} autoCapitalize="none" keyboardType="url" placeholder={streamUrlPlaceholders[provider]} placeholderTextColor={colors.faint} style={styles.input} />
      <Text style={styles.copy}>Twitch and Kick are best for live rooms. YouTube videos and TikTok video links can load in-app where the provider allows it; some channel, LIVE, or short links may need external open.</Text>
      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
      <AppButton
        loading={loading}
        loadingLabel="Attaching..."
        disabled={loading || !title.trim() || !url.trim()}
        onPress={submit}
      >
        Attach stream
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  role: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  providerNote: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    padding: spacing.sm
  },
  attach: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
    gap: spacing.sm
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  segment: {
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  segmentOn: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  segmentText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  segmentTextOn: {
    color: colors.white
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    fontSize: 16
  },
  playerWrap: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
    aspectRatio: 16 / 9
  },
  playerWrapFill: {
    flex: 1,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.ink
  },
  webview: {
    flex: 1,
    backgroundColor: colors.ink
  },
  playerPlaceholder: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.ink
  }
});
