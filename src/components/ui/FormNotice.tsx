import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../../constants/theme";

export function FormNotice({ message, tone }: { message: string; tone: "error" | "success" | "info" | "warning" }) {
  return (
    <View style={[styles.wrap, tone === "error" && styles.error, tone === "success" && styles.success, tone === "warning" && styles.warning]}>
      <Text style={[styles.text, tone === "error" && styles.errorText, tone === "warning" && styles.warningText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.cyanSoft
  },
  error: {
    borderColor: colors.red,
    backgroundColor: colors.redSoft
  },
  success: {
    borderColor: colors.green,
    backgroundColor: colors.greenSoft
  },
  warning: {
    borderColor: colors.amber,
    backgroundColor: colors.amberSoft
  },
  text: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700"
  },
  errorText: {
    color: colors.red
  },
  warningText: {
    color: colors.ink
  }
});
