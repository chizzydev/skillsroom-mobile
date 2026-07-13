import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, radius, shadow } from "../../constants/theme";

export function AppButton({
  children,
  onPress,
  variant = "primary",
  disabled,
  loading,
  loadingLabel,
  style
}: {
  children: ReactNode;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger" | "dark";
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  style?: ViewStyle;
}) {
  const isDisabled = Boolean(disabled || loading);
  const visuallyDisabled = Boolean(disabled && !loading);
  const isInverse = variant === "danger" || variant === "dark";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        visuallyDisabled && styles[`${variant}Disabled`],
        pressed && !isDisabled ? styles.pressed : null,
        style
      ]}
    >
      {loading ? (
        <>
          <ActivityIndicator color={isInverse ? colors.white : colors.ink} />
          {loadingLabel ? <Text style={[styles.text, styles.loadingText, isInverse && styles.inverseText]}>{loadingLabel}</Text> : null}
        </>
      ) : (
        <Text style={[styles.text, isInverse && styles.inverseText, visuallyDisabled && !isInverse && styles.disabledText, visuallyDisabled && isInverse && styles.disabledInverseText]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    borderWidth: 1
  },
  primary: {
    backgroundColor: colors.green,
    borderColor: colors.green,
    ...shadow.glow
  },
  secondary: {
    backgroundColor: colors.white,
    borderColor: colors.line
  },
  danger: {
    backgroundColor: colors.red,
    borderColor: colors.red
  },
  dark: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  primaryDisabled: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.line,
    shadowOpacity: 0,
    elevation: 0
  },
  secondaryDisabled: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.line
  },
  dangerDisabled: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.line
  },
  darkDisabled: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.line
  },
  pressed: {
    transform: [{ scale: 0.98 }]
  },
  text: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 16
  },
  inverseText: {
    color: colors.white
  },
  loadingText: {
    fontSize: 14
  },
  disabledText: {
    color: colors.faint
  },
  disabledInverseText: {
    color: colors.faint
  }
});
