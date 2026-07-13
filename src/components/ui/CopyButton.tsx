import * as Clipboard from "expo-clipboard";
import { Check, Copy } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, radius, spacing } from "../../constants/theme";

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  disabled,
  compact,
  style
}: {
  value?: string | null;
  label?: string;
  copiedLabel?: string;
  disabled?: boolean;
  compact?: boolean;
  style?: ViewStyle;
}) {
  const [copied, setCopied] = useState(false);
  const canCopy = Boolean(value && !disabled);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timeout);
  }, [copied]);

  async function copyValue() {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setCopied(true);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} to clipboard`}
      disabled={!canCopy}
      onPress={() => void copyValue()}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        copied && styles.copied,
        !canCopy && styles.disabled,
        pressed && canCopy ? styles.pressed : null,
        style
      ]}
    >
      {copied ? <Check size={16} color={colors.greenDark} strokeWidth={2.8} /> : <Copy size={16} color={canCopy ? colors.cyan : colors.faint} strokeWidth={2.6} />}
      <Text style={[styles.text, copied && styles.copiedText, !canCopy && styles.disabledText]}>{copied ? copiedLabel : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md
  },
  compact: {
    minHeight: 34,
    paddingHorizontal: spacing.sm
  },
  copied: {
    borderColor: colors.green,
    backgroundColor: colors.greenSoft
  },
  disabled: {
    opacity: 0.55
  },
  pressed: {
    transform: [{ scale: 0.98 }]
  },
  text: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 12
  },
  copiedText: {
    color: colors.greenDark
  },
  disabledText: {
    color: colors.faint
  }
});
