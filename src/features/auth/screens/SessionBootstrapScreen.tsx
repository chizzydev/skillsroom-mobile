import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AppButton } from "../../../components/ui/AppButton";
import { colors, spacing } from "../../../constants/theme";
import { useAuthStore } from "../../../store/auth-store";

export function SessionBootstrapScreen() {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const bootstrapError = useAuthStore((state) => state.bootstrapError);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);

  return (
    <View style={styles.center}>
      {bootstrapError ? (
        <View style={styles.card}>
          <Text style={styles.title}>Cannot reach Skillsroom</Text>
          <Text style={styles.body}>{bootstrapError}</Text>
          <AppButton loading={isBootstrapping} onPress={() => void bootstrap()}>
            Retry
          </AppButton>
        </View>
      ) : (
        <>
          <ActivityIndicator color={colors.green} size="large" />
          <Text style={styles.body}>Checking your session...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.bg
  },
  card: {
    width: "100%",
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.white
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center"
  },
  body: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center"
  }
});
