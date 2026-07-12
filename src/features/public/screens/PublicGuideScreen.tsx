import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, HelpCircle, ShieldCheck, Swords, Trophy, WalletCards } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppWordmark } from "../../../components/layout/AppWordmark";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { colors, radius, shadow, spacing } from "../../../constants/theme";

type GuideTopic = "how-it-works" | "rules" | "trust" | "support";

type GuideContent = {
  eyebrow: string;
  title: string;
  copy: string;
  icon: ReactNode;
  sections: Array<{
    title: string;
    body: string;
    bullets: string[];
  }>;
};

const guideContent: Record<GuideTopic, GuideContent> = {
  "how-it-works": {
    eyebrow: "How it works",
    title: "One room record from setup to settlement.",
    copy: "Skillsroom keeps the match flow clear so players know what is happening, what is needed next, and where each decision lives.",
    icon: <Swords size={24} color={colors.cyan} strokeWidth={2.6} />,
    sections: [
      {
        title: "Create or join",
        body: "Start from a private room code, an open room, or a tournament event.",
        bullets: ["Rules and entry details are visible before play starts.", "Players can track whether a room is open, funded, live, or under review.", "Room chat and activity stay tied to the match."]
      },
      {
        title: "Fund clearly",
        body: "Entries are checked before the match becomes active.",
        bullets: ["Available balance is separate from locked funds.", "Manual proof can be reviewed where needed.", "Pending top-ups are not treated as spendable balance."]
      },
      {
        title: "Play and prove",
        body: "Result evidence and player responses stay attached to the same room.",
        bullets: ["Screenshots, notes, and result claims are easier to review.", "Disputes are handled in context.", "Finished rooms remain useful as match history."]
      }
    ]
  },
  rules: {
    eyebrow: "Rules",
    title: "Clear play beats confusion.",
    copy: "Every room or tournament should tell players the game, format, timing, scoring, and evidence expectations before the match matters.",
    icon: <Trophy size={24} color={colors.amber} strokeWidth={2.6} />,
    sections: [
      {
        title: "Before play",
        body: "Check the event or room instructions before joining.",
        bullets: ["Use the right game account and roster.", "Arrive before the agreed start or check-in window.", "Ask questions before the match starts, not after the result."]
      },
      {
        title: "During play",
        body: "Play the listed mode and keep useful proof as you go.",
        bullets: ["Avoid account sharing, substitutes, or rule changes without approval.", "Keep lobby and scoreboard screenshots where relevant.", "Use room chat for match coordination that should remain visible."]
      },
      {
        title: "After play",
        body: "Report the result honestly and respond quickly if review is needed.",
        bullets: ["Scores should match the real match result.", "Evidence should be clear, complete, and tied to the right room.", "False reporting can affect future access."]
      }
    ]
  },
  trust: {
    eyebrow: "Trust",
    title: "Fair rooms need visible context.",
    copy: "Skillsroom connects wallet states, evidence, chat, result history, and support actions so players are not relying on scattered screenshots.",
    icon: <ShieldCheck size={24} color={colors.greenDark} strokeWidth={2.6} />,
    sections: [
      {
        title: "Evidence-first review",
        body: "Decisions are easier when screenshots, chat, timestamps, and result claims live together.",
        bullets: ["Private proof stays access-controlled.", "Public winner pages can show finished outcomes without exposing private details.", "Review history helps support understand what happened."]
      },
      {
        title: "Wallet clarity",
        body: "Money states are separated so users do not confuse pending, locked, winnings, and available funds.",
        bullets: ["Available balance is ready for supported entries.", "Locked funds are reserved for rooms or events.", "Payout and refund states should be easy to follow."]
      },
      {
        title: "Player reputation",
        body: "Consistent participation should make future matches easier to trust.",
        bullets: ["Completed matches, no-shows, disputes, and tournament activity can shape trust signals.", "Players can improve trust by following rules and responding on time.", "Community visibility does not expose private evidence."]
      }
    ]
  },
  support: {
    eyebrow: "Support",
    title: "Get help with the right context.",
    copy: "Good support starts with the room code, tournament name, payment detail, screenshot, or message that explains the issue clearly.",
    icon: <HelpCircle size={24} color={colors.cyan} strokeWidth={2.6} />,
    sections: [
      {
        title: "Room or tournament help",
        body: "Send the exact match or event context first.",
        bullets: ["Include room code, tournament name, or round name.", "Explain what happened and when.", "Keep screenshots or videos until the issue is resolved."]
      },
      {
        title: "Wallet help",
        body: "Payment and payout questions need details that match the ledger.",
        bullets: ["Include amount, date, sender name, and reference where available.", "Do not post sensitive banking details in public chat.", "Pending review means support may need time to match the proof."]
      },
      {
        title: "Account help",
        body: "For login, profile, Google sign-in, or notification issues, describe the device and exact step where it failed.",
        bullets: ["Mention whether you are on Android, iOS, or web.", "Screenshot error messages where safe.", "Use the same email or username tied to your account."]
      }
    ]
  }
};

function topicFromParam(value: unknown): GuideTopic {
  const topic = Array.isArray(value) ? value[0] : value;
  if (topic === "rules" || topic === "trust" || topic === "support" || topic === "how-it-works") return topic;
  return "how-it-works";
}

export function nativeGuideHref(topic: GuideTopic) {
  return `/public-guide?topic=${encodeURIComponent(topic)}`;
}

export function PublicGuideScreen() {
  const params = useLocalSearchParams<{ topic?: string }>();
  const topic = topicFromParam(params.topic);
  const content = guideContent[topic];

  return (
    <AppScreen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <ArrowLeft size={22} color={colors.ink} strokeWidth={2.6} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <AppWordmark />
      <View style={styles.hero}>
        <View style={styles.iconWrap}>{content.icon}</View>
        <Badge tone="cyan">{content.eyebrow}</Badge>
        <Text style={styles.heroTitle}>{content.title}</Text>
        <Text style={styles.heroCopy}>{content.copy}</Text>
      </View>
      {content.sections.map((section, index) => (
        <View key={section.title} style={styles.sectionCard}>
          <View style={styles.sectionNumber}>
            <Text style={styles.sectionNumberText}>{index + 1}</Text>
          </View>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
          <View style={styles.bulletList}>
            {section.bullets.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      <View style={styles.cta}>
        <Text style={styles.ctaTitle}>Ready for the full platform?</Text>
        <Text style={styles.ctaCopy}>Create an account or sign in to open rooms, chat, tournaments, wallet, and your player profile.</Text>
        <View style={styles.ctaActions}>
          <AppButton onPress={() => router.push("/(auth)/register")}>Create account</AppButton>
          <AppButton variant="secondary" onPress={() => router.push("/(auth)/login")}>Sign in</AppButton>
        </View>
      </View>
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
  hero: {
    borderRadius: radius.lg,
    backgroundColor: colors.navy,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  heroTitle: { color: colors.white, fontSize: 34, lineHeight: 40, fontWeight: "900" },
  heroCopy: { color: "#d4e1ec", fontSize: 16, lineHeight: 25 },
  sectionCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card
  },
  sectionNumber: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cyanSoft
  },
  sectionNumberText: { color: colors.cyan, fontWeight: "900", fontSize: 16 },
  sectionTitle: { color: colors.ink, fontSize: 22, lineHeight: 28, fontWeight: "900" },
  sectionBody: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  bulletList: { gap: spacing.sm, marginTop: spacing.xs },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  bulletDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.green, marginTop: 8 },
  bulletText: { flex: 1, color: colors.muted, fontSize: 14, lineHeight: 22, fontWeight: "700" },
  cta: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card
  },
  ctaTitle: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  ctaCopy: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  ctaActions: { gap: spacing.sm }
});
