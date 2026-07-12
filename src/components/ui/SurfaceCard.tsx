import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius, shadow, spacing } from "../../constants/theme";

export function SurfaceCard({ children, dark = false, style }: { children: ReactNode; dark?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, dark && styles.dark, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card
  },
  dark: {
    backgroundColor: colors.navy,
    borderColor: "#18304a"
  }
});
