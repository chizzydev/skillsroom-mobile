import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../../constants/theme";
import { AppButton } from "./AppButton";

export function FeedbackState({
  title,
  body,
  actionLabel,
  onAction,
  tone = "empty"
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "empty" | "error";
}) {
  return (
    <View style={[styles.wrap, tone === "error" && styles.error]}>
      <Text style={[styles.title, tone === "error" && styles.errorTitle]}>{title}</Text>
      {body ? <Text style={[styles.body, tone === "error" && styles.errorBody]}>{body}</Text> : null}
      {actionLabel && onAction ? <AppButton variant="secondary" onPress={onAction}>{actionLabel}</AppButton> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "center"
  },
  error: {
    backgroundColor: colors.redSoft,
    borderColor: colors.red,
    borderWidth: 1
  },
  title: {
    color: colors.white,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    textAlign: "center"
  },
  errorTitle: {
    color: colors.red
  },
  body: {
    color: "#c6d2df",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center"
  },
  errorBody: {
    color: colors.ink
  }
});
