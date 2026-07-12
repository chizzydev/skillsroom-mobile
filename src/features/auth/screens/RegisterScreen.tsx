import { router } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { plainApiError } from "../../../api/errors";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, spacing } from "../../../constants/theme";
import { useAuthStore } from "../../../store/auth-store";
import { getNativeGoogleIdToken } from "../nativeGoogleSignIn";

export function RegisterScreen() {
  const signUp = useAuthStore((state) => state.signUp);
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; message: string } | null>(null);

  async function submit() {
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !trimmedEmail || !password || !passwordConfirm) {
      setNotice({ tone: "error", message: "Enter a username, email, password, and password confirmation." });
      return;
    }
    if (!/^[A-Za-z0-9_]{3,24}$/.test(trimmedUsername)) {
      setNotice({ tone: "error", message: "Use 3-24 letters, numbers, or underscores for your username." });
      return;
    }
    if (password.length < 10) {
      setNotice({ tone: "error", message: "Use at least 10 characters for your password." });
      return;
    }
    if (password !== passwordConfirm) {
      setNotice({ tone: "error", message: "The two passwords do not match." });
      return;
    }

    try {
      setNotice(null);
      setLoading(true);
      const result = await signUp({ email: trimmedEmail, username: trimmedUsername, password, password_confirm: passwordConfirm });
      if (result.signedIn) {
        router.replace("/(app)/(tabs)/home");
        return;
      }
      setNotice({
        tone: "success",
        message: "Account created. Check your email to verify your account, then come back and sign in."
      });
    } catch (error) {
      setNotice({ tone: "error", message: plainApiError(error, "Please check the details and try again.") });
    } finally {
      setLoading(false);
    }
  }

  async function submitGoogle() {
    try {
      setNotice(null);
      setGoogleLoading(true);
      const idToken = await getNativeGoogleIdToken();
      if (!idToken) return;

      await signInWithGoogle(idToken);
      router.replace("/(app)/(tabs)/home");
    } catch (error) {
      setNotice({ tone: "error", message: plainApiError(error, "Google sign-up failed. Try again.") });
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AppScreen>
      <SurfaceCard dark style={styles.hero}>
        <Badge tone="dark">New player</Badge>
        <Text style={styles.heroTitle}>Create your Skillsroom identity.</Text>
        <Text style={styles.heroCopy}>One profile for rooms, chat, tournaments, wallet activity, evidence, and payout readiness.</Text>
      </SurfaceCard>
      <SurfaceCard>
        <Badge>Create account</Badge>
        <Text style={styles.title}>Start playing under clear rules.</Text>
        <Text style={styles.copy}>Use an email you control. Your username is how other players can find you.</Text>
        <AppButton variant="secondary" loading={googleLoading} disabled={loading} onPress={submitGoogle}>
          Continue with Google
        </AppButton>
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>
        <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" placeholder="Username" placeholderTextColor={colors.faint} style={styles.input} />
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" textContentType="emailAddress" keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.faint} style={styles.input} />
        <PasswordInput value={password} onChangeText={setPassword} visible={passwordVisible} onToggle={() => setPasswordVisible((current) => !current)} placeholder="Password" />
        <PasswordInput value={passwordConfirm} onChangeText={setPasswordConfirm} visible={passwordConfirmVisible} onToggle={() => setPasswordConfirmVisible((current) => !current)} placeholder="Confirm password" />
        {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
        <AppButton loading={loading} onPress={submit}>Create account</AppButton>
        <AppButton variant="secondary" onPress={() => router.replace("/(auth)/login")}>Back to sign in</AppButton>
      </SurfaceCard>
      <View style={styles.readinessCard}>
        <Text style={styles.readinessEyebrow}>What unlocks after sign-up</Text>
        <View style={styles.readinessRow}><Text style={styles.readinessDot}>1</Text><Text style={styles.readinessCopy}>Finish profile readiness once and reuse it across rooms and tournaments.</Text></View>
        <View style={styles.readinessRow}><Text style={styles.readinessDot}>2</Text><Text style={styles.readinessCopy}>Fund entries with wallet balance or manual proof where required.</Text></View>
        <View style={styles.readinessRow}><Text style={styles.readinessDot}>3</Text><Text style={styles.readinessCopy}>Keep evidence, chat, results, and notifications attached to the right match.</Text></View>
      </View>
    </AppScreen>
  );
}

function PasswordInput({
  value,
  onChangeText,
  visible,
  onToggle,
  placeholder
}: {
  value: string;
  onChangeText: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <View style={styles.passwordWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoComplete="new-password"
        textContentType="newPassword"
        secureTextEntry={!visible}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        style={[styles.input, styles.passwordInput]}
      />
      <Pressable accessibilityRole="button" accessibilityLabel={visible ? "Hide password" : "Show password"} onPress={onToggle} style={styles.passwordToggle}>
        {visible ? <EyeOff size={20} color={colors.greenDark} strokeWidth={2.6} /> : <Eye size={20} color={colors.greenDark} strokeWidth={2.6} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingVertical: spacing.xl },
  heroTitle: { color: colors.white, fontSize: 36, lineHeight: 42, fontWeight: "900" },
  heroCopy: { color: "#c8d4e1", fontSize: 16, lineHeight: 25 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 40, fontWeight: "900" },
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
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { color: colors.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  readinessCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.navy,
    padding: spacing.lg,
    gap: spacing.md
  },
  readinessEyebrow: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase"
  },
  readinessRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start"
  },
  readinessDot: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    overflow: "hidden",
    textAlign: "center",
    textAlignVertical: "center",
    backgroundColor: "rgba(34, 199, 232, 0.14)",
    color: colors.cyan,
    fontWeight: "900"
  },
  readinessCopy: {
    flex: 1,
    color: "#d7e4ee",
    fontSize: 15,
    lineHeight: 23
  }
});
