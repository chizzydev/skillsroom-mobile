import { ShieldAlert, ShieldCheck } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../../../constants/theme";
import type { PlayerTrustBadge, PlayerTrustSummary } from "../../../types/api";

type TrustTone = NonNullable<PlayerTrustBadge["tone"]>;

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function percent(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}%` : "New";
}

function playerLabel(trust: PlayerTrustSummary) {
  return trust.display_name || trust.username || (trust.user_id ? `${trust.user_id.slice(0, 8)}...${trust.user_id.slice(-4)}` : "Player");
}

function trustLevelLabel(value?: string | null) {
  if (value === "ready") return "Ready";
  if (value === "review") return "Review";
  if (value === "blocked") return "Blocked";
  return "Incomplete";
}

function gameHandleBadge(status?: string | null): PlayerTrustBadge {
  if (status === "verified") {
    return {
      key: "verified_game_handle",
      label: "Game handle check",
      value: "Verified",
      tone: "strong",
      public_note: "This player has a checked primary game handle."
    };
  }

  if (status === "pending") {
    return {
      key: "verified_game_handle",
      label: "Game handle check",
      value: "Saved",
      tone: "good",
      public_note: "This player has a saved primary game handle. Skillsroom can check it during room review."
    };
  }

  if (status === "rejected") {
    return {
      key: "verified_game_handle",
      label: "Game handle check",
      value: "Needs update",
      tone: "watch",
      public_note: "This player needs to update their primary game handle."
    };
  }

  return {
    key: "verified_game_handle",
    label: "Game handle check",
    value: "Missing",
    tone: "watch",
    public_note: "This player has not added a primary game handle yet."
  };
}

function rateTone(value: unknown): TrustTone {
  const next = numberValue(value, 0);
  if (next <= 2) return "strong";
  if (next <= 10) return "good";
  return "watch";
}

function qualityTone(value: unknown): TrustTone {
  if (typeof value !== "number" || !Number.isFinite(value)) return "new";
  if (value >= 95) return "strong";
  if (value >= 80) return "good";
  return "watch";
}

function fallbackBadges(trust: PlayerTrustSummary): PlayerTrustBadge[] {
  const completedMatches = numberValue(trust.completed_matches);
  return [
    {
      key: "verified_profile",
      label: "Verified profile",
      value: trust.profile_complete ? "Ready" : "Needs setup",
      tone: trust.profile_complete ? "strong" : "watch",
      public_note: trust.profile_complete ? "This player has finished the required player setup." : "This player still has profile steps to finish."
    },
    gameHandleBadge(trust.primary_game_status),
    {
      key: "completed_matches",
      label: "Completed matches",
      value: String(completedMatches),
      tone: completedMatches >= 20 ? "strong" : completedMatches >= 5 ? "good" : "new",
      public_note: completedMatches > 0 ? "This is the player's settled match history." : "This player is still building match history."
    },
    {
      key: "dispute_rate",
      label: "Dispute rate",
      value: percent(trust.dispute_rate),
      tone: rateTone(trust.dispute_rate),
      public_note: "Lower is better. This reflects disputes lost against completed matches."
    },
    {
      key: "no_show_rate",
      label: "No-show rate",
      value: percent(trust.no_show_rate),
      tone: rateTone(trust.no_show_rate),
      public_note: "Lower is better. This reflects missed matches against completed matches."
    },
    {
      key: "funding_reliability",
      label: "Payment reliability",
      value: percent(trust.funding_reliability),
      tone: qualityTone(trust.funding_reliability),
      public_note: typeof trust.funding_reliability === "number" ? "This reflects checked payment proof history." : "This player does not have enough checked payment history yet."
    },
    {
      key: "evidence_quality",
      label: "Proof quality",
      value: percent(trust.evidence_quality),
      tone: qualityTone(trust.evidence_quality),
      public_note: typeof trust.evidence_quality === "number" ? "This reflects useful proof attached to past result submissions." : "This player does not have enough proof history yet."
    }
  ];
}

function toneColor(tone: TrustTone) {
  if (tone === "strong") return colors.greenDark;
  if (tone === "good") return colors.cyan;
  if (tone === "watch") return colors.amber;
  return colors.faint;
}

function levelTone(level?: string | null): TrustTone {
  if (level === "ready") return "strong";
  if (level === "review" || level === "blocked") return "watch";
  return "new";
}

export function PlayerTrustCard({ trust, compact = false }: { trust: PlayerTrustSummary; compact?: boolean }) {
  const wins = numberValue(trust.wins);
  const losses = numberValue(trust.losses);
  const totalGames = Math.max(wins + losses, 0);
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const badges = trust.trust_badges?.length ? trust.trust_badges : fallbackBadges(trust);
  const visibleBadges = compact ? badges.slice(0, 4) : badges;
  const trustTone = levelTone(trust.trust_level);

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.header}>
        <View style={styles.fill}>
          <Text style={styles.eyebrow}>Player trust</Text>
          <Text style={styles.title} numberOfLines={1}>{playerLabel(trust)}</Text>
          {trust.primary_game_handle ? <Text style={styles.handle} numberOfLines={1}>{trust.primary_game_handle}</Text> : null}
        </View>
        <View style={[styles.levelPill, styles[trustTone]]}>
          <ShieldCheck color={toneColor(trustTone)} size={14} strokeWidth={2.5} />
          <Text style={[styles.levelText, { color: toneColor(trustTone) }]}>{trustLevelLabel(trust.trust_level)}</Text>
        </View>
      </View>

      {!compact ? (
        <View style={styles.metricGrid}>
          <Metric label="Trust score" value={String(numberValue(trust.reputation_score, 1000))} />
          <Metric label="Matches" value={String(numberValue(trust.completed_matches))} />
          <Metric label="Win rate" value={`${winRate}%`} />
          <Metric label="Dispute rate" value={percent(trust.dispute_rate)} />
        </View>
      ) : null}

      <View style={styles.badgeGrid}>
        {visibleBadges.map((badge) => (
          <View key={badge.key} style={[styles.badge, styles[badge.tone], compact && styles.compactBadge]}>
            <View style={styles.badgeTop}>
              <Text style={styles.badgeLabel} numberOfLines={1}>{badge.label}</Text>
              {badge.key === "extra_review" ? (
                <ShieldAlert color={toneColor(badge.tone)} size={13} strokeWidth={2.5} />
              ) : (
                <ShieldCheck color={toneColor(badge.tone)} size={13} strokeWidth={2.5} />
              )}
            </View>
            <Text style={[styles.badgeValue, { color: toneColor(badge.tone) }]} numberOfLines={1}>{badge.value}</Text>
            {!compact ? <Text style={styles.note}>{badge.public_note}</Text> : null}
          </View>
        ))}
      </View>

      {!compact && trust.public_trust_note ? <Text style={styles.footerNote}>{trust.public_trust_note}</Text> : null}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    gap: spacing.md
  },
  compactCard: {
    padding: spacing.sm,
    gap: spacing.sm
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  fill: {
    flex: 1,
    minWidth: 0
  },
  eyebrow: {
    color: colors.faint,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 4
  },
  handle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  },
  levelPill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  levelText: {
    fontSize: 11,
    fontWeight: "900"
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  metric: {
    width: "48%",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: colors.white
  },
  metricLabel: {
    color: colors.faint,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  metricValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  badge: {
    width: "48%",
    minHeight: 112,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: colors.white
  },
  compactBadge: {
    minHeight: 62
  },
  badgeTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs
  },
  badgeLabel: {
    flex: 1,
    minWidth: 0,
    color: colors.faint,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  badgeValue: {
    fontSize: 14,
    fontWeight: "900",
    marginTop: 5
  },
  note: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: spacing.xs
  },
  footerNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18
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
  }
});
