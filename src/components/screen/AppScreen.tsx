import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../../constants/theme";

export function AppScreen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(spacing.md, Math.min(insets.bottom, spacing.md));
  const content = <View style={[styles.content, { paddingBottom: scroll ? bottomPadding : 0 }]}>{children}</View>;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
