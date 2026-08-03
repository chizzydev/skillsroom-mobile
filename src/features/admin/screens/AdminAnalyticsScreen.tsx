import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, BarChart3, LineChart, Radio, ReceiptText, ShieldCheck, UsersRound, WalletCards } from "lucide-react-native";
import { ReactNode, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  adminLanesFor,
  canAccessAdmin,
  canUseAdminSection,
  getAdminAnalyticsSummary,
  roleLabel,
  type AdminAnalyticsSummary
} from "../../../api/admin";
import { plainApiError } from "../../../api/errors";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, spacing } from "../../../constants/theme";
import { useAuthStore } from "../../../store/auth-store";

type Tone = "cyan" | "green" | "amber" | "red";

const rangeOptions = [7, 28, 90] as const;

function numberLabel(value = 0) {
  return value.toLocaleString("en-NG");
}

function money(currency = "NGN", minor = 0) {
  return `${currency} ${Math.round(minor / 100).toLocaleString("en-NG")}`;
}

function pct(part = 0, total = 0) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function eventLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll(".", " / ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function dateLabel(value?: string | null) {
  if (!value) return "Not set";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;
  return new Date(value).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

function dayLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

function primaryCurrency(summary?: AdminAnalyticsSummary) {
  return summary?.revenue[0]?.currency ?? summary?.revenue_depth[0]?.currency ?? "NGN";
}

function trustedCommission(summary?: AdminAnalyticsSummary) {
  return (summary?.revenue ?? []).reduce(
    (sum, row) => sum + row.match_commission_reserved_minor + row.tournament_commission_reserved_minor,
    0
  );
}

function approvedFunds(summary?: AdminAnalyticsSummary) {
  return (summary?.revenue ?? []).reduce(
    (sum, row) => sum + row.approved_player_funds_minor + row.provider_successful_funds_minor,
    0
  );
}

function queuedMoney(summary?: AdminAnalyticsSummary) {
  return (summary?.revenue ?? []).reduce((sum, row) => sum + row.payout_queued_minor + row.refund_queued_minor, 0);
}

function revenueDepth(summary?: AdminAnalyticsSummary) {
  return (summary?.revenue_depth ?? []).reduce(
    (acc, row) => ({
      topupsApproved: acc.topupsApproved + row.wallet_topups_approved_count,
      topupsRejected: acc.topupsRejected + row.wallet_topups_rejected_count,
      payoutsQueued: acc.payoutsQueued + row.match_payouts_queued_count + row.tournament_payouts_queued_count,
      refundsQueued: acc.refundsQueued + row.match_refunds_queued_count + row.tournament_refunds_queued_count,
      matchCommission: acc.matchCommission + row.match_commission_reserved_minor,
      tournamentCommission: acc.tournamentCommission + row.tournament_commission_reserved_minor
    }),
    { topupsApproved: 0, topupsRejected: 0, payoutsQueued: 0, refundsQueued: 0, matchCommission: 0, tournamentCommission: 0 }
  );
}

function maxDaily(summary?: AdminAnalyticsSummary) {
  return Math.max(
    1,
    ...(summary?.daily ?? []).map((row) =>
      Math.max(row.active_users, row.sessions, row.rooms_created, row.challenges_created, row.tournament_entries)
    )
  );
}

function openAdminLane(section: string) {
  if (section === "overview") {
    router.replace({ pathname: "/admin" } as never);
    return;
  }
  if (section === "analytics") return;
  if (section === "funding") {
    router.push({ pathname: "/admin/funding" } as never);
    return;
  }
  if (section === "wallet") {
    router.push({ pathname: "/admin/wallet" } as never);
    return;
  }
  if (section === "results") {
    router.push({ pathname: "/admin/results" } as never);
    return;
  }
  if (section === "settlements") {
    router.push({ pathname: "/admin/payments" } as never);
    return;
  }
  if (section === "tournaments") {
    router.push({ pathname: "/admin/tournaments" } as never);
    return;
  }
  if (section === "players") {
    router.push({ pathname: "/admin/players" } as never);
    return;
  }
  if (section === "risk") {
    router.push({ pathname: "/admin/safety" } as never);
    return;
  }
  if (section === "team") {
    router.push({ pathname: "/admin/team" } as never);
    return;
  }
  router.replace({ pathname: "/admin" } as never);
}

export function AdminAnalyticsScreen() {
  const user = useAuthStore((state) => state.user);
  const [days, setDays] = useState<(typeof rangeOptions)[number]>(28);
  const canAdmin = canAccessAdmin(user);
  const canAnalytics = canUseAdminSection(user, "analytics");
  const lanes = useMemo(() => adminLanesFor(user), [user]);
  const analyticsQuery = useQuery({
    queryKey: ["admin", "analytics", days],
    queryFn: () => getAdminAnalyticsSummary(days),
    enabled: canAnalytics
  });

  const summary = analyticsQuery.data;
  const currency = primaryCurrency(summary);
  const depth = revenueDepth(summary);
  const maxTrend = maxDaily(summary);
  const latestDaily = summary?.daily.at(-1);

  if (!canAdmin) {
    return (
      <AppScreen>
        <SurfaceCard dark style={styles.permissionHero}>
          <Badge tone="dark">Team workspace</Badge>
          <Text style={styles.darkHeroTitle}>Admin access is not enabled for this account.</Text>
          <Text style={styles.darkCopy}>Only Support, Community Manager, Admin, and Owner roles can open the Skillsroom admin workspace.</Text>
        </SurfaceCard>
        <AppButton onPress={() => router.replace("/(app)/(tabs)/home")}>Back to player app</AppButton>
      </AppScreen>
    );
  }

  if (!canAnalytics) {
    return (
      <AppScreen>
        <SurfaceCard dark style={styles.permissionHero}>
          <Badge tone="dark">{`${roleLabel(user?.role)} role`}</Badge>
          <Text style={styles.darkHeroTitle}>Analytics are restricted for this role.</Text>
          <Text style={styles.darkCopy}>Product and revenue analytics are available to Admin and Owner roles.</Text>
        </SurfaceCard>
        <AppButton onPress={() => router.replace("/admin")}>Back to admin overview</AppButton>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <SurfaceCard dark style={styles.shell}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="Back to admin overview" onPress={() => router.replace("/admin")} style={styles.iconButton}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.6} />
          </Pressable>
          <View style={styles.brandMark}><Text style={styles.brandText}>SR</Text></View>
          <View style={styles.brandCopy}>
            <Text numberOfLines={1} style={styles.shellTitle}>Analytics</Text>
            <Text style={styles.shellMeta}>{roleLabel(user?.role)} product health</Text>
          </View>
          <Pressable onPress={() => router.replace("/(app)/(tabs)/home")} style={styles.playerButton}>
            <Text style={styles.playerButtonText}>Player app</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.laneTabs}>
          {lanes.map((lane) => (
            <Pressable key={lane.key} onPress={() => openAdminLane(lane.key)} style={[styles.laneTab, lane.key === "analytics" && styles.laneTabActive]}>
              <Text style={[styles.laneTabText, lane.key === "analytics" && styles.laneTabTextActive]}>{lane.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SurfaceCard>

      <SurfaceCard style={styles.hero}>
        <Badge tone="cyan">Production health</Badge>
        <Text style={styles.heroTitle}>Analytics snapshot</Text>
        <Text style={styles.copy}>Trusted product, funnel, and payment activity for the selected reporting window.</Text>
        <View style={styles.rangeRow}>
          {rangeOptions.map((option) => (
            <Pressable key={option} onPress={() => setDays(option)} style={[styles.rangeButton, days === option && styles.rangeButtonActive]}>
              <Text style={[styles.rangeText, days === option && styles.rangeTextActive]}>{option} days</Text>
            </Pressable>
          ))}
        </View>
      </SurfaceCard>

      <View style={styles.livePill}>
        <View style={styles.liveIcon}><Radio color={colors.greenDark} size={22} /></View>
        <View style={styles.fill}>
          <Text style={styles.liveTitle}>Analytics updates</Text>
          <Text style={styles.liveMeta}>{analyticsQuery.isFetching ? "Refreshing product health" : "Using trusted production records"}</Text>
        </View>
        <Badge tone="green">{summary ? "Ready" : "Loading"}</Badge>
      </View>

      {analyticsQuery.isError ? (
        <FeedbackState
          tone="error"
          title="Analytics could not load"
          body={plainApiError(analyticsQuery.error, "Try again when the API is reachable.")}
          actionLabel="Retry"
          onAction={() => void analyticsQuery.refetch()}
        />
      ) : null}

      {analyticsQuery.isLoading ? <FeedbackState title="Loading analytics" body="Checking production activity and trusted payment records." /> : null}

      {summary ? (
        <>
          <View style={styles.metricGrid}>
            <MetricCard tone="cyan" label="Total users" value={numberLabel(summary.kpis.total_users)} detail={`${numberLabel(summary.kpis.total_players)} player accounts`} icon={<UsersRound color={colors.cyan} size={22} />} />
            <MetricCard tone="green" label="Active users" value={numberLabel(summary.kpis.active_users)} detail={`${numberLabel(summary.kpis.sessions)} sessions`} icon={<LineChart color={colors.greenDark} size={22} />} />
            <MetricCard tone="amber" label="New users" value={numberLabel(summary.kpis.new_users)} detail={`${numberLabel(summary.kpis.new_players)} new players`} icon={<BarChart3 color={colors.amber} size={22} />} />
            <MetricCard tone="green" label="Production users" value={numberLabel(summary.kpis.real_production_users)} detail={`${pct(summary.kpis.real_production_users, summary.kpis.total_users)} of all accounts`} icon={<ShieldCheck color={colors.greenDark} size={22} />} />
          </View>

          <SurfaceCard>
            <SectionHeader eyebrow="Transactions" title="Trusted transaction volume" detail="Counts come from payment, payout, refund, and prize records only." />
            <View style={styles.windowGrid}>
              {summary.transaction_windows.map((window) => (
                <View key={window.window_key} style={styles.windowCard}>
                  <Text style={styles.metricLabel}>{window.label}</Text>
                  <Text style={styles.windowValue}>{numberLabel(window.transaction_count)}</Text>
                  <Text style={styles.rowMeta}>
                    {window.topup_count} top-ups / {window.payout_count} payouts / {window.refund_count} refunds
                  </Text>
                </View>
              ))}
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <SectionHeader eyebrow="Revenue" title="Trusted money health" detail="Revenue uses approved payment and prize records, not page counters." />
            <View style={styles.moneyGrid}>
              <MoneyTile label="Approved funds" value={money(currency, approvedFunds(summary))} tone="green" />
              <MoneyTile label="Commission reserved" value={money(currency, trustedCommission(summary))} tone="cyan" />
              <MoneyTile label="Queued payouts/refunds" value={money(currency, queuedMoney(summary))} tone="amber" />
              <MoneyTile label="Match / tournament" value={`${money(currency, depth.matchCommission)} / ${money(currency, depth.tournamentCommission)}`} tone="cyan" />
            </View>
            <View style={styles.depthGrid}>
              <DetailPill label="Top-ups approved" value={numberLabel(depth.topupsApproved)} />
              <DetailPill label="Top-ups rejected" value={numberLabel(depth.topupsRejected)} />
              <DetailPill label="Payout queue" value={numberLabel(depth.payoutsQueued)} />
              <DetailPill label="Refund queue" value={numberLabel(depth.refundsQueued)} />
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <SectionHeader eyebrow="Conversion" title="Visitor to first action" detail="A compact view of web visitors becoming real player activity." />
            <FunnelStep label="Visitors" value={summary.visitor_conversion.web_visitors} total={summary.visitor_conversion.web_visitors} />
            <FunnelStep label="Signups" value={summary.visitor_conversion.signups} total={summary.visitor_conversion.web_visitors} />
            <FunnelStep label="Profile ready" value={summary.visitor_conversion.profile_ready_users} total={summary.visitor_conversion.signups} />
            <FunnelStep label="First action" value={summary.visitor_conversion.first_action_users} total={summary.visitor_conversion.profile_ready_users} />
          </SurfaceCard>

          <SurfaceCard>
            <SectionHeader eyebrow="Funnel" title="Rooms, challenges, tournaments" detail="Key movement through the product, kept tight for mobile review." />
            <View style={styles.depthGrid}>
              <DetailPill label="Rooms created" value={numberLabel(summary.funnel_depth.room_entry.rooms_created)} />
              <DetailPill label="Room joins" value={numberLabel(summary.funnel_depth.room_entry.joined_players)} />
              <DetailPill label="Challenge accepted" value={pct(summary.funnel_depth.challenge_acceptance.challenges_accepted, summary.funnel_depth.challenge_acceptance.challenges_created)} />
              <DetailPill label="Event check-ins" value={numberLabel(summary.funnel_depth.tournament_progress.tournament_checked_in_entries)} />
              <DetailPill label="Results submitted" value={numberLabel(summary.funnel.result_submitted)} />
              <DetailPill label="Events completed" value={numberLabel(summary.funnel.tournament_completed)} />
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <SectionHeader eyebrow="Trend" title={`${days}-day activity`} detail={latestDaily ? `Latest day: ${dayLabel(latestDaily.day)}` : "No daily activity has been recorded yet."} />
            {summary.daily.slice(-14).map((row) => (
              <TrendRow key={row.day} label={dayLabel(row.day)} value={row.active_users} max={maxTrend} detail={`${row.sessions} sessions / ${row.events} events`} />
            ))}
            {!summary.daily.length ? <EmptyState title="No trend data yet" body="Activity will appear after tracked production events are recorded." /> : null}
          </SurfaceCard>

          <SurfaceCard>
            <SectionHeader eyebrow="Activity" title="Top events" detail="Event names are grouped counts; private message bodies, proof files, and bank details are not tracked." />
            {summary.top_events.slice(0, 6).map((event) => (
              <View key={event.event_name} style={styles.eventRow}>
                <View style={styles.eventIcon}><ReceiptText color={colors.cyan} size={20} /></View>
                <View style={styles.fill}>
                  <Text style={styles.rowTitle}>{eventLabel(event.event_name)}</Text>
                  <Text style={styles.rowMeta}>{numberLabel(event.user_count)} users</Text>
                </View>
                <Text style={styles.eventCount}>{numberLabel(event.event_count)}</Text>
              </View>
            ))}
            {!summary.top_events.length ? <EmptyState title="No top events yet" body="The first tracked app and web events will appear here." /> : null}
          </SurfaceCard>

          <SurfaceCard>
            <SectionHeader eyebrow="Data quality" title="Excluded test activity" detail="Heavy account exclusion and cutover controls stay on web admin." />
            <View style={styles.depthGrid}>
              <DetailPill label="Excluded users" value={numberLabel(summary.quality.excluded_users_count)} />
              <DetailPill label="Excluded events" value={numberLabel(summary.quality.explicitly_excluded_events)} />
              <DetailPill label="Pre-cutover events" value={numberLabel(summary.quality.pre_cutover_events)} />
              <DetailPill label="Cutover funds" value={money(currency, summary.quality.pre_cutover_approved_player_funds_minor)} />
            </View>
            <FormNotice
              tone="info"
              message={`Activity from ${dateLabel(summary.settings.production_activity_starts_at)} and revenue from ${dateLabel(summary.settings.production_revenue_starts_at)} are treated as production reporting.`}
            />
          </SurfaceCard>
        </>
      ) : null}
    </AppScreen>
  );
}

function SectionHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.copy}>{detail}</Text>
    </View>
  );
}

function MetricCard({ tone, label, value, detail, icon }: { tone: Tone; label: string; value: string; detail: string; icon: ReactNode }) {
  return (
    <SurfaceCard style={[styles.metricCard, styles[`${tone}Top`]]}>
      <View style={[styles.metricIcon, styles[`${tone}Soft`]]}>{icon}</View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, styles[`${tone}Text`]]} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </SurfaceCard>
  );
}

function MoneyTile({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <View style={[styles.moneyTile, styles[`${tone}Top`]]}>
      <WalletCards color={tone === "green" ? colors.greenDark : tone === "amber" ? colors.amber : colors.cyan} size={20} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.moneyValue, styles[`${tone}Text`]]}>{value}</Text>
    </View>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailPill}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function FunnelStep({ label, value, total }: { label: string; value: number; total: number }) {
  const width = `${Math.max(4, Math.min(100, total ? Math.round((value / total) * 100) : 0))}%` as const;
  return (
    <View style={styles.funnelStep}>
      <View style={styles.funnelTop}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowMeta}>{numberLabel(value)} / {pct(value, total)}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width }]} />
      </View>
    </View>
  );
}

function TrendRow({ label, value, max, detail }: { label: string; value: number; max: number; detail: string }) {
  const width = `${Math.max(3, Math.min(100, Math.round((value / max) * 100)))}%` as const;
  return (
    <View style={styles.trendRow}>
      <View style={styles.trendTop}>
        <Text style={styles.trendLabel}>{label}</Text>
        <Text style={styles.trendMeta}>{numberLabel(value)} active</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, styles.trendFill, { width }]} />
      </View>
      <Text style={styles.rowMeta}>{detail}</Text>
    </View>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowMeta}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionHero: { minHeight: 260, justifyContent: "center" },
  shell: { padding: 0, overflow: "hidden" },
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: "#17263a" },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.navySoft },
  brandMark: { width: 42, height: 42, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.green },
  brandText: { color: colors.navy, fontWeight: "900", fontSize: 16 },
  brandCopy: { flex: 1, minWidth: 0 },
  shellTitle: { color: colors.white, fontSize: 18, fontWeight: "900" },
  shellMeta: { marginTop: 2, color: "#a7b5c7", fontSize: 12, fontWeight: "800" },
  playerButton: { minHeight: 36, borderRadius: radius.sm, borderWidth: 1, borderColor: "#22344b", paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  playerButtonText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  laneTabs: { gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  laneTab: { minHeight: 34, borderRadius: radius.sm, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.navySoft },
  laneTabActive: { backgroundColor: colors.white },
  laneTabText: { color: "#b7c4d4", fontWeight: "900" },
  laneTabTextActive: { color: colors.navy },
  hero: { backgroundColor: "#fbfefe" },
  heroTitle: { color: colors.ink, fontSize: 32, lineHeight: 38, fontWeight: "900" },
  darkHeroTitle: { color: colors.white, fontSize: 32, lineHeight: 38, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 25, fontWeight: "600" },
  darkCopy: { color: "#cbd6e5", fontSize: 16, lineHeight: 25, fontWeight: "600" },
  rangeRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  rangeButton: { minHeight: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
  rangeButtonActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  rangeText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  rangeTextActive: { color: colors.white },
  livePill: { minHeight: 78, borderRadius: radius.lg, borderWidth: 1, borderColor: "#b6f4db", backgroundColor: colors.greenSoft, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  liveIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  liveTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  liveMeta: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  fill: { flex: 1, minWidth: 0 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metricCard: { width: "47%", minHeight: 172, justifyContent: "space-between", padding: spacing.md },
  cyanTop: { borderTopWidth: 4, borderTopColor: colors.cyan },
  greenTop: { borderTopWidth: 4, borderTopColor: colors.greenDark },
  amberTop: { borderTopWidth: 4, borderTopColor: colors.amber },
  redTop: { borderTopWidth: 4, borderTopColor: colors.red },
  metricIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  cyanSoft: { backgroundColor: colors.cyanSoft },
  greenSoft: { backgroundColor: colors.greenSoft },
  amberSoft: { backgroundColor: colors.amberSoft },
  redSoft: { backgroundColor: colors.redSoft },
  metricLabel: { color: colors.faint, fontSize: 12, fontWeight: "900", letterSpacing: 3, textTransform: "uppercase" },
  metricValue: { fontSize: 34, fontWeight: "900" },
  metricDetail: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  cyanText: { color: colors.cyan },
  greenText: { color: colors.greenDark },
  amberText: { color: colors.amber },
  redText: { color: colors.red },
  eyebrow: { color: "#0898b8", fontSize: 12, fontWeight: "900", letterSpacing: 4, textTransform: "uppercase" },
  sectionTitle: { marginTop: spacing.xs, color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  rowTitle: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: "900", flexShrink: 1 },
  rowMeta: { color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: "700", flexShrink: 1 },
  windowGrid: { gap: spacing.sm },
  windowCard: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md, gap: spacing.xs },
  windowValue: { color: colors.ink, fontSize: 34, fontWeight: "900" },
  moneyGrid: { gap: spacing.sm },
  moneyTile: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md, gap: spacing.sm },
  moneyValue: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: "900" },
  depthGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  detailPill: { width: "47%", minHeight: 82, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md, justifyContent: "space-between" },
  detailLabel: { color: colors.faint, fontSize: 11, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  detailValue: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  funnelStep: { gap: spacing.xs },
  funnelTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  barTrack: { height: 11, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  barFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.greenDark },
  trendRow: { gap: spacing.xs },
  trendTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  trendLabel: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  trendMeta: { color: colors.faint, fontSize: 12, fontWeight: "900" },
  trendFill: { backgroundColor: colors.cyan },
  eventRow: { minHeight: 74, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
  eventIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.cyanSoft, alignItems: "center", justifyContent: "center" },
  eventCount: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  emptyState: { borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, padding: spacing.lg, alignItems: "center", gap: spacing.xs }
});
