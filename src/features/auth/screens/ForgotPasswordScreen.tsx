import { router } from "expo-router";
import { ArrowLeft, MailCheck } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { requestPasswordReset } from "../../../api/auth";
import { plainApiError } from "../../../api/errors";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, spacing } from "../../../constants/theme";

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; message: string } | null>(null);

  async function submit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setNotice({ tone: "error", message: "Enter the email for your Skillsroom account." });
      return;
    }

    try {
      setNotice(null);
      setLoading(true);
      await requestPasswordReset(trimmedEmail);
      setNotice({ tone: "success", message: "If that email exists, Skillsroom will send reset instructions." });
    } catch (error) {
      setNotice({ tone: "error", message: plainApiError(error, "Please try again.") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen>
      <Pressable accessibilityRole="button" onPress={() => router.replace("/(auth)/login")} style={styles.backButton}>
        <ArrowLeft size={22} color={colors.ink} strokeWidth={2.6} />
        <Text style={styles.backText}>Sign in</Text>
      </Pressable>
      <SurfaceCard dark style={styles.hero}>
        <Badge tone="dark">Account recovery</Badge>
        <Text style={styles.heroTitle}>Get back into your rooms.</Text>
        <Text style={styles.heroCopy}>We will send a reset link if the email belongs to a Skillsroom account.</Text>
      </SurfaceCard>
      <SurfaceCard>
        <View style={styles.iconWrap}>
          <MailCheck size={26} color={colors.greenDark} strokeWidth={2.6} />
        </View>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.copy}>Enter your email and we will send the next step if the account exists.</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" textContentType="emailAddress" keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.faint} style={styles.input} />
        {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
        <AppButton loading={loading} onPress={submit}>Send reset link</AppButton>
        <AppButton variant="secondary" onPress={() => router.replace("/(auth)/login")}>Back to sign in</AppButton>
      </SurfaceCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    minHeight: 46
  },
  backText: { color: colors.ink, fontWeight: "900" },
  hero: { paddingVertical: spacing.xl },
  heroTitle: { color: colors.white, fontSize: 36, lineHeight: 42, fontWeight: "900" },
  heroCopy: { color: "#c8d4e1", fontSize: 16, lineHeight: 25 },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.greenSoft
  },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 17,
    color: colors.ink,
    backgroundColor: colors.surfaceAlt
  }
});
