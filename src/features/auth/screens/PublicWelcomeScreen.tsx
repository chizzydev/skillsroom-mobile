import { router } from "expo-router";
import { ChevronRight, MessageCircle, ShieldCheck, Swords, Trophy, Users, WalletCards } from "lucide-react-native";
import type { ReactNode } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { AppWordmark } from "../../../components/layout/AppWordmark";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { colors, radius, shadow, spacing } from "../../../constants/theme";
import { openNativeCommunity, openNativeGuide } from "../../public/navigation";

const heroArtwork = require("../../../../assets/marketing/skillsroom-premium/community-premium.png");
const tournamentArtwork = require("../../../../assets/marketing/skillsroom-premium/tournaments-premium.png");

const trustCards = [
  {
    eyebrow: "One clear flow",
    copy: "Room setup, proof, disputes, and final decisions all stay in one place."
  },
  {
    eyebrow: "Built for real matches",
    copy: "Made for competitive players, hosts, and communities that want things handled properly."
  },
  {
    eyebrow: "Know the vibe",
    copy: "Explore community updates, winners, and game activity before creating your player profile."
  }
];

const flowSteps = [
  ["Create or join", "Open a private room, join with a code, or enter a published tournament."],
  ["Fund clearly", "Wallet balances, manual proof, and locked funds stay separated."],
  ["Play and prove", "Rules, chat, evidence, result review, and disputes remain attached to the match."],
  ["Settle fairly", "Clear records make result reviews and payouts easier to follow."]
] as const;

export function PublicWelcomeScreen() {
  return (
    <AppScreen>
      <AppWordmark />

      <ImageBackground source={heroArtwork} imageStyle={styles.heroImage} style={styles.hero}>
        <View style={styles.heroOverlay}>
          <Badge tone="cyan">Skill-based gaming platform</Badge>
          <Text style={styles.heroTitle}>Create fair match rooms, join tournaments, and play under clear rules.</Text>
          <Text style={styles.heroCopy}>
            Skillsroom gives players and organizers one place to manage rooms, results, disputes, and tournament play without confusing side chats and guesswork.
          </Text>
          <View style={styles.heroActions}>
            <AppButton onPress={() => router.push("/(auth)/register")}>Create account</AppButton>
            <AppButton variant="secondary" onPress={() => router.push("/(auth)/login")}>Sign in</AppButton>
            <AppButton variant="secondary" onPress={() => openNativeCommunity("hub")}>View community</AppButton>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.trustStack}>
        {trustCards.map((card) => (
          <View key={card.eyebrow} style={styles.trustCard}>
            <Text style={styles.eyebrow}>{card.eyebrow}</Text>
            <Text style={styles.trustCopy}>{card.copy}</Text>
          </View>
        ))}
      </View>

      <ImageBackground source={tournamentArtwork} imageStyle={styles.artImage} style={styles.artPanel}>
        <View style={styles.artOverlay}>
          <FeatureBand icon={<Users size={21} color={colors.cyan} />} title="For players" copy="See open events, winner highlights, community updates, and the format each tournament is using." />
          <FeatureBand icon={<ShieldCheck size={21} color={colors.cyan} />} title="Behind the scenes" copy="Reviews, funding checks, disputes, and payouts all stay tied to the same room or event." />
        </View>
      </ImageBackground>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.eyebrow}>How it works</Text>
          <Text style={styles.sectionTitle}>One match record from start to finish.</Text>
        </View>
        <View style={styles.flowList}>
          {flowSteps.map(([title, copy], index) => (
            <View key={title} style={styles.flowRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.flowText}>
                <Text style={styles.flowTitle}>{title}</Text>
                <Text style={styles.flowCopy}>{copy}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.capabilityGrid}>
        <Capability icon={<Swords size={22} color={colors.cyan} />} title="Match rooms" copy="Private matches with rules, entry checks, and evidence." />
        <Capability icon={<Trophy size={22} color={colors.amber} />} title="Tournaments" copy="Brackets, groups, Swiss events, and winner records." />
        <Capability icon={<MessageCircle size={22} color={colors.greenDark} />} title="Community" copy="Global chat, game channels, highlights, and updates." />
        <Capability icon={<WalletCards size={22} color={colors.red} />} title="Wallet" copy="Available, locked, winnings, pending top-ups, and payouts." />
      </View>

      <View style={styles.publicPanel}>
        <Text style={styles.eyebrow}>Look around first</Text>
        <Text style={styles.sectionTitle}>See Skillsroom in motion</Text>
        <View style={styles.publicLinks}>
          <PublicLink title="How Skillsroom works" onPress={() => openNativeGuide("how-it-works")} />
          <PublicLink title="Rules and player guidance" onPress={() => openNativeGuide("rules")} />
          <PublicLink title="Trust and fair play" onPress={() => openNativeGuide("trust")} />
          <PublicLink title="Help center" onPress={() => openNativeGuide("support")} />
          <PublicLink title="Community and leaderboards" onPress={() => openNativeCommunity("rankings")} />
          <PublicLink title="Highlights and winners" onPress={() => openNativeCommunity("highlights")} />
        </View>
      </View>

      <View style={styles.finalCta}>
        <Text style={styles.finalTitle}>Ready to play under clear rules?</Text>
        <Text style={styles.finalCopy}>Create your player profile now, or sign in if you already have a Skillsroom account.</Text>
        <View style={styles.finalActions}>
          <AppButton onPress={() => router.push("/(auth)/register")}>Create account</AppButton>
          <AppButton variant="secondary" onPress={() => router.push("/(auth)/login")}>Sign in</AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

function FeatureBand({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <View style={styles.featureBand}>
      {icon}
      <View style={styles.flowText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureCopy}>{copy}</Text>
      </View>
    </View>
  );
}

function Capability({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <View style={styles.capability}>
      <View style={styles.capabilityIcon}>{icon}</View>
      <Text style={styles.capabilityTitle}>{title}</Text>
      <Text style={styles.capabilityCopy}>{copy}</Text>
    </View>
  );
}

function PublicLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.publicLink}>
      <Text style={styles.publicLinkText}>{title}</Text>
      <ChevronRight size={17} color={colors.faint} strokeWidth={2.6} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: "hidden",
    minHeight: 610,
    borderRadius: radius.lg,
    backgroundColor: colors.navy,
    ...shadow.card
  },
  heroImage: {
    borderRadius: radius.lg
  },
  heroOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: "rgba(6, 19, 35, 0.76)"
  },
  heroTitle: {
    color: colors.white,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "900"
  },
  heroCopy: {
    color: "#d1deea",
    fontSize: 16,
    lineHeight: 25
  },
  heroActions: {
    gap: spacing.sm
  },
  trustStack: {
    gap: spacing.sm
  },
  trustCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(34, 199, 232, 0.18)",
    backgroundColor: colors.navySoft,
    padding: spacing.lg,
    gap: spacing.sm
  },
  eyebrow: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase"
  },
  trustCopy: {
    color: "#d8e4ee",
    fontSize: 16,
    lineHeight: 25
  },
  artPanel: {
    overflow: "hidden",
    minHeight: 360,
    borderRadius: radius.lg,
    backgroundColor: colors.navy
  },
  artImage: {
    borderRadius: radius.lg
  },
  artOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: "rgba(6, 19, 35, 0.34)"
  },
  featureBand: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
    backgroundColor: "rgba(6, 19, 35, 0.78)",
    padding: spacing.md
  },
  featureTitle: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2.5,
    textTransform: "uppercase"
  },
  featureCopy: {
    color: "#dce7f0",
    fontSize: 15,
    lineHeight: 23
  },
  section: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: "hidden",
    ...shadow.card
  },
  sectionHeader: {
    padding: spacing.lg,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900"
  },
  flowList: {
    padding: spacing.lg,
    gap: spacing.md
  },
  flowRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  stepNumber: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cyanSoft
  },
  stepNumberText: {
    color: colors.cyan,
    fontWeight: "900",
    fontSize: 16
  },
  flowText: {
    flex: 1,
    gap: spacing.xs
  },
  flowTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  flowCopy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23
  },
  capabilityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  capability: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 150,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadow.card
  },
  capabilityIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt
  },
  capabilityTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  capabilityCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20
  },
  publicPanel: {
    borderRadius: radius.lg,
    backgroundColor: colors.navy,
    padding: spacing.lg,
    gap: spacing.md
  },
  publicLinks: {
    gap: spacing.sm
  },
  publicLink: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  publicLinkText: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
    fontWeight: "900"
  },
  finalCta: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card
  },
  finalTitle: {
    color: colors.ink,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900"
  },
  finalCopy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23
  },
  finalActions: {
    gap: spacing.sm
  }
});
