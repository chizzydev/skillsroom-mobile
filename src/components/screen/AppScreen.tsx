import { useSegments } from "expo-router";
import { ReactNode, RefObject } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../../constants/theme";

export function AppScreen({ children, scroll = true, scrollRef }: { children: ReactNode; scroll?: boolean; scrollRef?: RefObject<ScrollView | null> }) {
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const isBottomTabScreen = segments.includes("(tabs)");
  const safeEdges = isBottomTabScreen ? (["top", "left", "right"] as const) : (["top", "left", "right", "bottom"] as const);
  const bottomPadding = isBottomTabScreen ? spacing.md + Math.min(insets.bottom, spacing.xs) : spacing.xl;
  const content = <View style={[styles.content, { paddingBottom: scroll ? bottomPadding : 0 }]}>{children}</View>;

  return (
    <SafeAreaView edges={safeEdges} style={styles.safe}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {scroll ? (
          <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  keyboard: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: colors.bg
  },
  content: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md
  }
});
