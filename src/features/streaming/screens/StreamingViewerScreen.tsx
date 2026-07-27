import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { colors, radius, spacing } from "../../../constants/theme";
import { EmbeddedStreamPlayer } from "../components/StreamCards";

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function StreamingViewerScreen() {
  const params = useLocalSearchParams<{
    title?: string;
    provider?: string;
    streamUrl?: string;
    embedUrl?: string;
    externalUrl?: string;
  }>();
  const title = firstParam(params.title) || "Stream player";
  const provider = firstParam(params.provider);
  const streamUrl = firstParam(params.streamUrl);
  const embedUrl = firstParam(params.embedUrl);
  const externalUrl = firstParam(params.externalUrl) || streamUrl;

  const openExternally = async () => {
    if (!externalUrl) return;
    await Linking.openURL(externalUrl);
  };

  return (
    <AppScreen scroll={false}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
            <ArrowLeft size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.titleWrap}>
            <Badge tone="dark">{provider || "stream"}</Badge>
            <Text numberOfLines={2} style={styles.title}>{title}</Text>
          </View>
        </View>

        <EmbeddedStreamPlayer
          provider={provider}
          title={title}
          streamUrl={streamUrl}
          embedUrl={embedUrl}
          initiallyLoaded
          fill
          style={styles.player}
        />

        <View style={styles.actions}>
          <AppButton variant="secondary" disabled={!externalUrl} onPress={() => void openExternally()}>
            Open externally
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.md
  },
  header: {
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
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  titleWrap: {
    flex: 1,
    gap: spacing.xs
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28
  },
  player: {
    minHeight: 320
  },
  actions: {
    gap: spacing.sm
  },
});
