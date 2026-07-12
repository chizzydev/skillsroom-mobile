import { Link, router } from "expo-router";
import { CheckCircle2, Eye, EyeOff, ShieldCheck, Swords, Trophy, WalletCards } from "lucide-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { plainApiError } from "../../../api/errors";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppWordmark } from "../../../components/layout/AppWordmark";
import { AppButton } from "../../../components/ui/AppButton";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { Badge } from "../../../components/ui/Badge";
import { FormNotice } from "../../../components/ui/FormNotice";
import { colors, radius, spacing } from "../../../constants/theme";
import { useAuthStore } from "../../../store/auth-store";
import { getNativeGoogleIdToken } from "../nativeGoogleSignIn";

const authArtwork = require("../../../../assets/marketing/skillsroom-premium/tournaments-premium.png");

export function LoginScreen() {
  const signIn = useAuthStore((state) => state.signIn);
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submit() {
    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      setErrorMessage("Enter your email or username and password to sign in.");
      return;
    }

    try {
      setErrorMessage(null);
      setLoading(true);
      await signIn(trimmedIdentifier, password);
      router.replace("/(app)/(tabs)/home");
    } catch (error) {
      setErrorMessage(plainApiError(error, "Check your details and try again."));
    } finally {
      setLoading(false);
    }
  }

  async function submitGoogle() {
    try {
      setErrorMessage(null);
      setGoogleLoading(true);
      const idToken = await getNativeGoogleIdToken();
      if (!idToken) return;

      await signInWithGoogle(idToken);
      router.replace("/(app)/(tabs)/home");
    } catch (error) {
      setErrorMessage(plainApiError(error, "Google sign-in failed. Try again."));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AppScreen>
      <AppWordmark />
      <ImageBackground source={authArtwork} imageStyle={styles.heroImage} style={styles.hero}>
        <View style={styles.heroOverlay}>
          <Badge tone="dark">Account access</Badge>
          <Text style={styles.heroTitle}>Welcome back.</Text>
          <Text style={styles.heroCopy}>Open your rooms, messages, tournament entries, wallet, and account settings.</Text>
          <View style={styles.heroStats}>
            <TrustPill icon={<Swords size={16} color={colors.cyan} />} label="Rooms" />
            <TrustPill icon={<Trophy size={16} color={colors.cyan} />} label="Tourneys" />
            <TrustPill icon={<WalletCards size={16} color={colors.cyan} />} label="Wallet" />
          </View>
        </View>
      </ImageBackground>
      <SurfaceCard>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.copy}>Use Google or your Skillsroom details. Every session stays tied to your player profile.</Text>
        <AppButton variant="secondary" loading={googleLoading} disabled={loading} onPress={submitGoogle}>
          Continue with Google
        </AppButton>
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>
        <TextInput
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          keyboardType="default"
          placeholder="Email or username"
          placeholderTextColor={colors.faint}
          style={styles.input}
        />
        <View style={styles.passwordWrap}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.faint}
            autoComplete="password"
            textContentType="password"
            secureTextEntry={!passwordVisible}
            style={[styles.input, styles.passwordInput]}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? "Hide password" : "Show password"} onPress={() => setPasswordVisible((current) => !current)} style={styles.passwordToggle}>
            {passwordVisible ? <EyeOff size={20} color={colors.greenDark} strokeWidth={2.6} /> : <Eye size={20} color={colors.greenDark} strokeWidth={2.6} />}
          </Pressable>
        </View>
        {errorMessage ? <FormNotice tone="error" message={errorMessage} /> : null}
        <AppButton loading={loading} onPress={submit}>Sign in</AppButton>
        <View style={styles.links}>
          <Link href="/(auth)/register" style={styles.link}>Create account</Link>
          <Link href="/(auth)/forgot-password" style={styles.link}>Forgot password?</Link>
        </View>
      </SurfaceCard>
      <SurfaceCard style={styles.promiseCard}>
        <View style={styles.promiseIcon}>
          <ShieldCheck size={24} color={colors.greenDark} strokeWidth={2.6} />
        </View>
        <View style={styles.promiseText}>
          <Text style={styles.promiseTitle}>Built for fair play</Text>
          <Text style={styles.promiseCopy}>Rooms, funding, evidence, chat, and results stay connected so every review is easier to trust.</Text>
        </View>
      </SurfaceCard>
      <View style={styles.featureGrid}>
        <FeatureCard title="Fund once" copy="Wallet and proof states stay separate from playable balance." />
        <FeatureCard title="Play cleanly" copy="Rules, entries, evidence, and review status follow every room." />
        <FeatureCard title="Stay updated" copy="Notifications and chat keep you close to rooms and events." />
      </View>
    </AppScreen>
  );
}

function TrustPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={styles.trustPill}>
      {icon}
      <Text style={styles.trustPillText}>{label}</Text>
    </View>
  );
}

function FeatureCard({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.featureCard}>
      <CheckCircle2 size={18} color={colors.greenDark} strokeWidth={2.5} />
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureCopy}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: "hidden",
    borderRadius: radius.lg,
    backgroundColor: colors.navy,
    minHeight: 330
  },
  heroImage: {
    borderRadius: radius.lg
  },
  heroOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: "rgba(6, 19, 35, 0.78)"
  },
  heroTitle: {
    color: colors.white,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "900"
  },
  heroCopy: {
    color: "#c8d4e1",
    fontSize: 17,
    lineHeight: 26
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  trustPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: "rgba(16, 29, 45, 0.86)",
    borderWidth: 1,
    borderColor: "rgba(34, 199, 232, 0.25)"
  },
  trustPillText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 12
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900"
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23
  },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 17,
    color: colors.ink,
    backgroundColor: colors.surfaceAlt
  },
  passwordWrap: {
    position: "relative"
  },
  passwordInput: {
    paddingRight: 82
  },
  passwordToggle: {
    position: "absolute",
    right: spacing.sm,
    top: 9,
    minHeight: 40,
    minWidth: 60,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line
  },
  dividerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  links: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  link: {
    color: colors.greenDark,
    fontWeight: "800"
  },
  promiseCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  promiseIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.greenSoft
  },
  promiseText: {
    flex: 1,
    gap: spacing.xs
  },
  promiseTitle: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 18
  },
  promiseCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21
  },
  featureGrid: {
    gap: spacing.sm
  },
  featureCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs
  },
  featureTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  featureCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21
  }
});
