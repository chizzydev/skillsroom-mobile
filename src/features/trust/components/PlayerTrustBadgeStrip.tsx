import { ShieldCheck } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../../../constants/theme";

type TrustBadgeTone = "strong" | "good" | "watch" | "new";

export type PlayerTrustBadgeItem = {
  key: string;
  label: string;
  value: string;
  tone: TrustBadgeTone;
};

export type ChallengeTrustSource = {
  creator_profile_verified?: boolean;
  creator_game_handle_verified?: boolean;
  creator_completed_matches?: number;
  creator_dispute_rate?: number;
  creator_no_show_rate?: number;
  creator_funding_reliability?: number | null;
  creator_evidence_quality?: number | null;
  creator_trust_warning?: boolean;
};

function percent(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}%` : "New";
}

function lowRateTone(value?: number) {
  const next = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (next <= 2) return "strong";
  if (next <= 10) return "good";
  return "watch";
}

function qualityTone(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "new";
  if (value >= 95) return "strong";
  if (value >= 80) return "good";
  return "watch";
}

export function trustBadgesForChallenge(challenge: ChallengeTrustSource): PlayerTrustBadgeItem[] {
  const completedMatches = challenge.creator_completed_matches ?? 0;
  const badges: PlayerTrustBadgeItem[] = [
    {
      key: "verified_profile",
      label: "Verified profile",
      value: challenge.creator_profile_verified ? "Ready" : "Needs setup",
      tone: challenge.creator_profile_verified ? "strong" : "watch"
    },
    {
      key: "verified_game_handle",
      label: "Game handle check",
      value: challenge.creator_game_handle_verified ? "Verified" : "Saved",
      tone: challenge.creator_game_handle_verified ? "strong" : "good"
    },
    {
      key: "completed_matches",
      label: "Completed matches",
      value: String(completedMatches),
      tone: completedMatches >= 20 ? "strong" : completedMatches >= 5 ? "good" : "new"
    },
    {
      key: "dispute_rate",
      label: "Dispute rate",
      value: percent(challenge.creator_dispute_rate),
      tone: lowRateTone(challenge.creator_dispute_rate)
    },
    {
      key: "no_show_rate",
      label: "No-show rate",
      value: percent(challenge.creator_no_show_rate),
      tone: lowRateTone(challenge.creator_no_show_rate)
    },
    {
      key: "funding_reliability",
      label: "Payment reliability",
      value: percent(challenge.creator_funding_reliability),
      tone: qualityTone(challenge.creator_funding_reliability)
    },
    {
      key: "evidence_quality",
      label: "Proof quality",
      value: percent(challenge.creator_evidence_quality),
      tone: qualityTone(challenge.creator_evidence_quality)
    }
  ];

  if (challenge.creator_trust_warning) {
    badges.push({
      key: "extra_review",
      label: "Extra review",
      value: "Active",
      tone: "watch"
    });
  }

  return badges;
}

export function trustLabel(score?: number) {
  const next = typeof score === "number" && Number.isFinite(score) ? score : 0;
  if (next >= 1150) return "Very strong";
  if (next >= 1000) return "Strong";
  if (next >= 850) return "Fair";
  return "New player";
}

export function PlayerTrustBadgeStrip({ badges, compact = false }: { badges: PlayerTrustBadgeItem[]; compact?: boolean }) {
  return (
    <View style={[styles.wrap, compact && styles.compactWrap]}>
      {badges.map((badge) => (
        <View key={badge.key} style={[styles.badge, styles[badge.tone], compact && styles.compactBadge]}>
          <ShieldCheck color={toneColor(badge.tone)} size={compact ? 12 : 14} strokeWidth={2.5} />
          <View style={styles.badgeText}>
            <Text style={[styles.label, compact && styles.compactLabel]} numberOfLines={1}>{badge.label}</Text>
            <Text style={[styles.value, compact && styles.compactValue, { color: toneColor(badge.tone) }]} numberOfLines={1}>{badge.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function toneColor(tone: TrustBadgeTone) {
  if (tone === "strong") return colors.greenDark;
  if (tone === "good") return colors.cyan;
  if (tone === "watch") return colors.amber;
  return colors.faint;
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.sm
  },
  compactWrap: {
    justifyContent: "space-between",
    rowGap: spacing.xs
  },
  badge: {
    width: "48%",
    minHeight: 62,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  compactBadge: {
    width: "48%",
    minHeight: 46,
    paddingVertical: spacing.xs
  },
  strong: {
    backgroundColor: colors.greenSoft,
    borderColor: "#b6f4db"
  },
  good: {
    backgroundColor: colors.cyanSoft,
    borderColor: "#aeefff"
  },
  watch: {
    backgroundColor: colors.amberSoft,
    borderColor: "#ffdf9d"
  },
  new: {
    backgroundColor: colors.white,
    borderColor: colors.line
  },
  badgeText: {
    flex: 1,
    minWidth: 0
  },
  label: {
    color: colors.faint,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  value: {
    fontSize: 13,
    fontWeight: "900"
  },
  compactLabel: {
    fontSize: 9
  },
  compactValue: {
    fontSize: 11
  }
});
