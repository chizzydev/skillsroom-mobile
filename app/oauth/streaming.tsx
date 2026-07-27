import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { completeStreamingOauth } from "../../src/api/streaming";
import { ApiError } from "../../src/api/client";
import { plainApiError } from "../../src/api/errors";
import { AppScreen } from "../../src/components/screen/AppScreen";
import { AppButton } from "../../src/components/ui/AppButton";
import { FeedbackState } from "../../src/components/ui/FeedbackState";
import { SurfaceCard } from "../../src/components/ui/SurfaceCard";
import { colors, spacing } from "../../src/constants/theme";
import { useActionFeedback } from "../../src/providers/ActionFeedbackProvider";

function paramText(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function providerLabel(provider?: string | null) {
  if (provider === "youtube") return "YouTube";
  if (provider === "kick") return "Kick";
  return "Twitch";
}

export default function StreamingOauthCallbackScreen() {
  const queryClient = useQueryClient();
  const { pushFeedback } = useActionFeedback();
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string; error_description?: string }>();
  const completedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    const code = paramText(params.code);
    const state = paramText(params.state);
    const error = paramText(params.error);
    const errorDescription = paramText(params.error_description);

    async function finishConnection() {
      if (error) {
        throw new Error(errorDescription || "The streaming provider did not finish the connection.");
      }
      if (!code || !state) {
        throw new Error("The streaming provider returned an incomplete connection link.");
      }

      const result = await completeStreamingOauth({ code, state });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["streaming-accounts"] });
      pushFeedback({
        tone: "success",
        title: `${providerLabel(result.account.provider)} connected.`
      });
      router.replace("/(app)/(tabs)/profile");
    }

    void finishConnection().catch(async (error) => {
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["streaming-accounts"] });
      if (error instanceof ApiError && error.code === "STREAMING_OAUTH_STATE_INVALID") {
        pushFeedback({
          tone: "info",
          title: "Streaming connection checked.",
          message: "Open Profile to confirm your saved channel."
        });
        router.replace("/(app)/(tabs)/profile");
        return;
      }
      setErrorMessage(plainApiError(error, "Could not connect the streaming channel."));
    });
  }, [params.code, params.error, params.error_description, params.state, pushFeedback, queryClient]);

  if (errorMessage) {
    return (
      <AppScreen>
        <FeedbackState
          tone="error"
          title="Streaming connection needs attention"
          body={errorMessage}
          actionLabel="Back to Profile"
          onAction={() => router.replace("/(app)/(tabs)/profile")}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <SurfaceCard style={styles.card}>
        <ActivityIndicator color={colors.greenDark} />
        <View style={styles.copyWrap}>
          <Text style={styles.title}>Connecting stream channel</Text>
          <Text style={styles.copy}>Keep this screen open while Skillsroom finishes the connection.</Text>
        </View>
        <AppButton variant="secondary" onPress={() => router.replace("/(app)/(tabs)/profile")}>
          Back to Profile
        </AppButton>
      </SurfaceCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: spacing.lg
  },
  copyWrap: {
    gap: spacing.xs
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center"
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  }
});
