import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../../constants/theme";

export function OptionalFieldsPanel({
  title,
  helper,
  children,
  defaultOpen = false
}: {
  title: string;
  helper?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = open ? ChevronUp : ChevronDown;

  return (
    <View style={styles.shell}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {helper ? <Text style={styles.helper}>{helper}</Text> : null}
        </View>
        <Icon color={colors.cyan} size={20} strokeWidth={2.6} />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden"
  },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  headerPressed: {
    backgroundColor: colors.cyanSoft
  },
  headerText: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  helper: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  body: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    padding: spacing.md
  }
});
