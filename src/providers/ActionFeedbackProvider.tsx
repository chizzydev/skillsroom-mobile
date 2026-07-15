import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadow, spacing } from "../constants/theme";

export type ActionFeedbackTone = "success" | "error" | "info" | "warning";

type ActionFeedbackItem = {
  id: string;
  title: string;
  message?: string;
  tone: ActionFeedbackTone;
};

type ActionFeedbackContextValue = {
  pushFeedback: (feedback: Omit<ActionFeedbackItem, "id"> & { id?: string }) => void;
  dismissFeedback: (id: string) => void;
};

const ActionFeedbackContext = createContext<ActionFeedbackContextValue | null>(null);
const MAX_VISIBLE_FEEDBACK = 2;
const MAX_TOAST_WIDTH = 430;
const COMPACT_SCREEN_WIDTH = 360;

function makeId() {
  return `feedback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toneLabel(tone: ActionFeedbackTone) {
  if (tone === "success") return "Done";
  if (tone === "error") return "Needs attention";
  if (tone === "warning") return "Check this";
  return "Update";
}

function dismissAfterMs(tone: ActionFeedbackTone) {
  if (tone === "error") return 7600;
  if (tone === "warning") return 6600;
  if (tone === "info") return 5600;
  return 4400;
}

export function ActionFeedbackProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<ActionFeedbackItem[]>([]);
  const horizontalPadding = width <= COMPACT_SCREEN_WIDTH ? spacing.sm : spacing.md;
  const toastWidth = Math.max(0, Math.min(width - horizontalPadding * 2, MAX_TOAST_WIDTH));

  const dismissFeedback = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const pushFeedback = useCallback((feedback: Omit<ActionFeedbackItem, "id"> & { id?: string }) => {
    const item = { ...feedback, id: feedback.id ?? makeId() };
    setItems((current) => [item, ...current.filter((existing) => existing.id !== item.id)].slice(0, MAX_VISIBLE_FEEDBACK));
  }, []);

  useEffect(() => {
    if (!items.length) return;
    const timer = setTimeout(() => {
      setItems((current) => current.slice(0, -1));
    }, dismissAfterMs(items[items.length - 1].tone));
    return () => clearTimeout(timer);
  }, [items]);

  const value = useMemo(() => ({ pushFeedback, dismissFeedback }), [dismissFeedback, pushFeedback]);

  return (
    <ActionFeedbackContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.host, { paddingTop: insets.top + spacing.sm, paddingHorizontal: horizontalPadding }]}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="alert"
            accessibilityHint="Tap to dismiss"
            onPress={() => dismissFeedback(item.id)}
            style={[
              styles.toast,
              { width: toastWidth },
              item.tone === "success" && styles.success,
              item.tone === "error" && styles.error,
              item.tone === "warning" && styles.warning,
              item.tone === "info" && styles.info
            ]}
          >
            <View style={styles.toastHeader}>
              <Text style={styles.eyebrow}>{toneLabel(item.tone)}</Text>
              <Text accessibilityLabel="Dismiss message" style={styles.close}>Close</Text>
            </View>
            <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
            {item.message ? <Text numberOfLines={3} style={styles.message}>{item.message}</Text> : null}
          </Pressable>
        ))}
      </View>
    </ActionFeedbackContext.Provider>
  );
}

export function useActionFeedback() {
  const value = useContext(ActionFeedbackContext);
  if (!value) {
    return {
      pushFeedback: () => undefined,
      dismissFeedback: () => undefined
    };
  }
  return value;
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    gap: spacing.sm,
    alignItems: "center"
  },
  toast: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadow.card
  },
  toastHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.xs
  },
  success: {
    borderColor: colors.green,
    backgroundColor: colors.greenSoft
  },
  error: {
    borderColor: colors.red,
    backgroundColor: colors.redSoft
  },
  warning: {
    borderColor: colors.amber,
    backgroundColor: colors.amberSoft
  },
  info: {
    borderColor: colors.cyan,
    backgroundColor: colors.cyanSoft
  },
  eyebrow: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  close: {
    color: colors.faint,
    fontSize: 12,
    fontWeight: "900"
  },
  title: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900"
  },
  message: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: spacing.xs
  }
});
