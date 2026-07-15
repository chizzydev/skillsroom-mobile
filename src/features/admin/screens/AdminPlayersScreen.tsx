import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, BadgeCheck, ClipboardCheck, Gamepad2, Radio, Search, ShieldAlert, Star, Trophy, UserRoundCheck } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  adminLanesFor,
  canAccessAdmin,
  canUseAdminSection,
  getAdminPlayerProfile,
  getPlayerTrustSummary,
  listAdminGameAccounts,
  listAdminLeaderboard,
  reviewAdminGameAccount,
  roleLabel,
  type AdminGameAccount,
  type AdminPlayerProfile,
  type LeaderboardRow,
  type PlayerTrustSummary
} from "../../../api/admin";
import { plainApiError } from "../../../api/errors";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, spacing } from "../../../constants/theme";
import { useActionFeedback } from "../../../providers/ActionFeedbackProvider";
import { useAuthStore } from "../../../store/auth-store";

type GameAccountStatus = "pending" | "verified" | "rejected" | "disabled";

type Notice = { tone: "error" | "success" | "info"; message: string } | null;
type Tone = "cyan" | "green" | "amber" | "red";

function shortId(value?: string | null) {
  if (!value) return "Not supplied";
  return value.length <= 14 ? value : `${value.slice(0, 8)}...${value.slice(-5)}`;
}

function label(value?: string | null) {
  if (!value) return "Unknown";
  return value.split("_").map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ");
}

function dateLabel(value?: string | null) {
  if (!value) return "Not supplied";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;
  return new Date(value).toLocaleString("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function accountTone(status?: string): Tone {
  if (status === "verified") return "green";
  if (status === "rejected" || status === "disabled") return "red";
  return "amber";
}

function trustTone(trust?: PlayerTrustSummary | null): Tone {
  if (trust?.trust_level === "ready") return "green";
  if (trust?.trust_level === "blocked") return "red";
  if (trust?.trust_level === "review") return "amber";
  return "cyan";
}

function disputeTone(row: Pick<LeaderboardRow, "disputes_lost" | "no_shows">): Tone {
  if (row.disputes_lost > 1 || row.no_shows > 1) return "red";
  if (row.disputes_lost > 0 || row.no_shows > 0) return "amber";
  return "green";
}

function leaderboardName(row: LeaderboardRow) {
  return row.display_name || row.username || shortId(row.user_id);
}

function profileName(row: AdminPlayerProfile) {
  return row.profile?.display_name || row.profile?.username || row.user.email || shortId(row.user.id);
}

function openAdminLane(section: string) {
  if (section === "overview") {
    router.replace({ pathname: "/admin" } as never);
    return;
  }
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
  if (section === "team") {
    router.push({ pathname: "/admin/team" } as never);
    return;
  }
  if (section === "risk") {
    router.push({ pathname: "/admin/safety" } as never);
  }
}

export function AdminPlayersScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { pushFeedback } = useActionFeedback();
  const [notice, setNotice] = useState<Notice>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [accountStatus, setAccountStatus] = useState<GameAccountStatus>("verified");
  const [leaderboardLimit, setLeaderboardLimit] = useState("50");
  const canAdmin = canAccessAdmin(user);
  const canPlayers = canUseAdminSection(user, "players");
  const canReviewGameAccounts = user?.role === "moderator" || user?.role === "admin" || user?.role === "owner";
  const lanes = useMemo(() => adminLanesFor(user), [user]);

  const playersQuery = useQuery({
    queryKey: ["admin", "players", leaderboardLimit],
    queryFn: async () => {
      const limit = Math.max(10, Math.min(100, Number(leaderboardLimit) || 50));
      const [leaderboardResult, pendingAccounts, verifiedAccounts] = await Promise.all([
        listAdminLeaderboard({ limit }),
        listAdminGameAccounts("pending"),
        listAdminGameAccounts("verified")
      ]);
      return {
        leaderboard: leaderboardResult.leaderboard ?? [],
        summary: leaderboardResult.summary,
        pendingAccounts,
        verifiedAccounts
      };
    },
    enabled: canPlayers
  });

  const contextQuery = useQuery({
    queryKey: ["admin", "players", "context", selectedUserId],
    queryFn: async () => {
      const [profile, trust] = await Promise.all([
        getAdminPlayerProfile(selectedUserId.trim()),
        getPlayerTrustSummary(selectedUserId.trim())
      ]);
      return { profile, trust };
    },
    enabled: canPlayers && Boolean(selectedUserId.trim())
  });

  const leaderboard = playersQuery.data?.leaderboard ?? [];
  const pendingAccounts = playersQuery.data?.pendingAccounts ?? [];
  const verifiedAccounts = playersQuery.data?.verifiedAccounts ?? [];
  const readyPlayers = leaderboard.filter((row) => row.completed_matches > 0).length;
  const attentionNeeded = leaderboard.filter((row) => row.disputes_lost > 0 || row.no_shows > 0).length;
  const totalWins = leaderboard.reduce((sum, row) => sum + row.wins, 0);
  const selectedAccount = [...pendingAccounts, ...verifiedAccounts].find((account) => account.id === selectedAccountId);

  const notify = (nextNotice: NonNullable<Notice>) => {
    setNotice(nextNotice);
    pushFeedback({
      tone: nextNotice.tone,
      title: nextNotice.tone === "error" ? "Player action failed" : "Player review updated",
      message: nextNotice.message
    });
  };

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!canReviewGameAccounts) throw new Error("Only Community Managers, Admins, and Owners can approve or reject handles.");
      if (!selectedAccountId.trim()) throw new Error("Select or paste a game account ID.");
      return reviewAdminGameAccount(selectedAccountId.trim(), {
        status: accountStatus,
        verification_notes: reviewNote
      });
    },
    onSuccess: async (account) => {
      notify({ tone: "success", message: `Handle review saved as ${label(account.status)}.` });
      setSelectedUserId(account.user_id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "players"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "players", "context", account.user_id] })
      ]);
    },
    onError: (error) => notify({ tone: "error", message: plainApiError(error, "The handle review could not be saved.") })
  });

  if (!canAdmin) {
    return (
      <AppScreen>
        <SurfaceCard dark style={styles.permissionHero}>
          <Badge tone="dark">Team workspace</Badge>
          <Text style={styles.darkHeroTitle}>Admin access is not enabled for this account.</Text>
          <Text style={styles.darkCopy}>Only Support, Community Manager, Admin, and Owner roles can open player review.</Text>
        </SurfaceCard>
        <AppButton onPress={() => router.replace("/(app)/(tabs)/home")}>Back to player app</AppButton>
      </AppScreen>
    );
  }

  if (!canPlayers) {
    return (
      <AppScreen>
        <SurfaceCard dark style={styles.permissionHero}>
          <Badge tone="dark">{roleLabel(user?.role)}</Badge>
          <Text style={styles.darkHeroTitle}>Player review is outside this role.</Text>
          <Text style={styles.darkCopy}>Ask an owner to grant Support, Community Manager, Admin, or Owner access for player context.</Text>
        </SurfaceCard>
        <AppButton onPress={() => router.replace("/admin")}>Back to overview</AppButton>
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false}>
      <View style={styles.shell}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.replace("/admin")} style={styles.iconButton}>
            <ArrowLeft color={colors.white} size={22} />
          </Pressable>
          <View style={styles.brandMark}><Text style={styles.brandText}>SR</Text></View>
          <View style={styles.brandCopy}>
            <Text style={styles.shellTitle} numberOfLines={1}>Player review</Text>
            <Text style={styles.shellMeta}>{roleLabel(user?.role)} workspace</Text>
          </View>
          <Pressable onPress={() => router.replace("/(app)/(tabs)/home")} style={styles.playerButton}>
            <Text style={styles.playerButtonText}>Player app</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.laneTabs}>
          {lanes.map((lane) => (
            <Pressable key={lane.key} onPress={() => openAdminLane(lane.key)} style={[styles.laneTab, lane.key === "players" && styles.laneTabActive]}>
              <Text style={[styles.laneTabText, lane.key === "players" && styles.laneTabTextActive]}>{lane.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
        {playersQuery.isError ? <FormNotice tone="error" message={plainApiError(playersQuery.error, "Unable to load player records right now.")} /> : null}

        <SurfaceCard style={styles.hero}>
          <Badge tone="cyan">Players</Badge>
          <Text style={styles.heroTitle}>Player trust and handle review.</Text>
          <Text style={styles.copy}>Check handles, match history, disputes, no-shows, game accounts, and safe support context before making player decisions.</Text>
        </SurfaceCard>

        <View style={styles.livePill}>
          <View style={styles.liveIcon}><Radio color={colors.greenDark} size={22} /></View>
          <View style={styles.fill}>
            <Text style={styles.liveTitle}>Player updates</Text>
            <Text style={styles.liveMeta}>Handle reviews and player context stay fresh while the workspace is open.</Text>
          </View>
          <Badge tone="green">On</Badge>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard tone="cyan" label="Players" value={String(leaderboard.length)} detail="Players with records" />
          <MetricCard tone="green" label="Active records" value={String(readyPlayers)} detail="Completed matches" />
          <MetricCard tone={attentionNeeded ? "amber" : "green"} label="Needs attention" value={String(attentionNeeded)} detail="Disputes or no-shows" />
          <MetricCard tone={pendingAccounts.length ? "amber" : "green"} label="Pending handles" value={String(pendingAccounts.length)} detail="Waiting for review" />
        </View>

        <SectionHeader eyebrow="Game handle" title="Handles waiting for review" detail="Approve only when the screenshot, lobby proof, UID, or community confirmation looks believable. Support can view; Community Managers and above can decide." />
        {playersQuery.isLoading ? (
          <FeedbackState title="Loading player records" body="Checking handles, leaderboard, and player context." />
        ) : (
          <View style={styles.queueBlock}>
            {pendingAccounts.length ? pendingAccounts.map((account) => (
              <GameAccountCard key={account.id} account={account} selected={selectedAccountId === account.id} onPress={() => {
                setSelectedAccountId(account.id);
                setSelectedUserId(account.user_id);
              }} />
            )) : <EmptyState title="No handles waiting" body="New handle submissions appear here after players add them from their profile." />}
          </View>
        )}

        <SurfaceCard style={styles.formStack}>
          <View style={styles.securityHeader}>
            <View style={styles.securityIcon}><ClipboardCheck color={colors.cyan} size={24} /></View>
            <View style={styles.fill}>
              <Text style={styles.rowTitle}>Review selected handle</Text>
              <Text style={styles.rowMeta}>{canReviewGameAccounts ? "Save a clear note so the next admin understands why this handle was verified or rejected." : "This role can inspect handles, but cannot approve or reject them."}</Text>
            </View>
          </View>
          {selectedAccount ? <FormNotice tone="info" message={`Selected: ${selectedAccount.handle} / ${selectedAccount.username || selectedAccount.display_name || shortId(selectedAccount.user_id)}`} /> : null}
          <LabeledInput label="Game account ID" value={selectedAccountId} onChangeText={setSelectedAccountId} mono />
          <ChipRow label="Decision" values={["verified", "rejected", "disabled", "pending"]} selected={accountStatus} onSelect={(value) => setAccountStatus(value as GameAccountStatus)} />
          <LabeledInput label="Review note" optional value={reviewNote} onChangeText={setReviewNote} placeholder="UID matches screenshot / proof unclear / duplicate handle" multiline minHeight={86} />
          <AppButton variant={accountStatus === "rejected" || accountStatus === "disabled" ? "danger" : "dark"} disabled={!canReviewGameAccounts} loading={reviewMutation.isPending} onPress={() => reviewMutation.mutate()}>
            Save handle review
          </AppButton>
        </SurfaceCard>

        <SectionHeader eyebrow="Player context" title="Support profile" detail="Paste or tap a player ID to inspect profile completion, game accounts, payout readiness, and open risk flags before acting." />
        <SurfaceCard style={styles.formStack}>
          <LabeledInput label="Player user ID" value={selectedUserId} onChangeText={setSelectedUserId} mono />
          {contextQuery.isFetching ? <Text style={styles.helpText}>Loading player context...</Text> : null}
          {contextQuery.data ? <PlayerContextCard data={contextQuery.data} /> : <EmptyState title="No player selected" body="Tap a leaderboard row or handle submission to load player context here." />}
        </SurfaceCard>

        <SectionHeader eyebrow="Directory" title="Reputation leaderboard" detail={`Total wins tracked: ${totalWins}. Use this to understand player history before result, risk, or support decisions.`} />
        <SurfaceCard style={styles.formStack}>
          <LabeledInput label="Rows to load" value={leaderboardLimit} onChangeText={setLeaderboardLimit} />
          <AppButton variant="secondary" onPress={() => playersQuery.refetch()}>Refresh leaderboard</AppButton>
        </SurfaceCard>
        <View style={styles.queueBlock}>
          {leaderboard.length ? leaderboard.map((row) => (
            <LeaderboardCard key={row.user_id} row={row} selected={selectedUserId === row.user_id} onPress={() => setSelectedUserId(row.user_id)} />
          )) : <EmptyState title="No player records yet" body="Player records appear after profiles and match history exist." />}
        </View>

        <SectionHeader eyebrow="Verified" title="Recently verified handles" detail="A quick reference for the handles that have already passed review." />
        <View style={styles.queueBlock}>
          {verifiedAccounts.slice(0, 8).map((account) => (
            <GameAccountCard key={account.id} account={account} selected={selectedAccountId === account.id} onPress={() => {
              setSelectedAccountId(account.id);
              setSelectedUserId(account.user_id);
            }} />
          ))}
          {!verifiedAccounts.length ? <EmptyState title="No verified handles loaded" body="Verified handles will appear here after review." /> : null}
        </View>
      </ScrollView>
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

function MetricCard({ tone, label: labelText, value, detail }: { tone: Tone; label: string; value: string; detail: string }) {
  return (
    <SurfaceCard style={[styles.metricCard, styles[`${tone}Top`]]}>
      <Text style={styles.metricLabel}>{labelText}</Text>
      <Text style={[styles.metricValue, styles[`${tone}Text`]]}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </SurfaceCard>
  );
}

function GameAccountCard({ account, selected, onPress }: { account: AdminGameAccount; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.rowCard, selected && styles.selectedRow]}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}><Gamepad2 color={colors.cyan} size={22} /></View>
        <View style={styles.fill}>
          <Text style={styles.rowTitle}>{account.username || account.display_name || "Unnamed player"}</Text>
          <Text style={styles.rowMeta}>{account.user_email || shortId(account.user_id)}</Text>
          <Badge tone={accountTone(account.status)}>{label(account.status)}</Badge>
        </View>
      </View>
      <View style={styles.detailGrid}>
        <DetailCell label="Handle" value={account.handle} mono />
        <DetailCell label="UID" value={account.external_uid || "Not supplied"} mono />
        <DetailCell label="Game" value={account.game_name || account.game_slug || shortId(account.game_id)} />
        <DetailCell label="Account ID" value={shortId(account.id)} mono />
      </View>
    </Pressable>
  );
}

function LeaderboardCard({ row, selected, onPress }: { row: LeaderboardRow; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.rowCard, selected && styles.selectedRow]}>
      <View style={styles.cardHeader}>
        <View style={styles.rankBadge}><Text style={styles.rankText}>#{row.rank}</Text></View>
        <View style={styles.fill}>
          <Text style={styles.rowTitle}>{leaderboardName(row)}</Text>
          <Text style={styles.rowMeta}>{row.primary_game_name || row.primary_game_slug || "No primary game"} / {row.primary_game_handle || "No handle"}</Text>
          <Badge tone={disputeTone(row)}>{`${row.disputes_lost} lost`}</Badge>
        </View>
      </View>
      <View style={styles.miniGrid}>
        <MiniStat label="Rep" value={String(row.reputation_score)} />
        <MiniStat label="Matches" value={String(row.completed_matches)} />
        <MiniStat label="Record" value={`${row.wins}-${row.losses}`} />
        <MiniStat label="No-shows" value={String(row.no_shows)} />
        <MiniStat label="Tourneys" value={String(row.completed_tournaments ?? 0)} />
        <MiniStat label="Podiums" value={String(row.podium_finishes ?? 0)} />
      </View>
    </Pressable>
  );
}

function PlayerContextCard({ data }: { data: { profile: AdminPlayerProfile; trust: PlayerTrustSummary } }) {
  const profile = data.profile.profile;
  const payout = data.profile.payout_profile;
  const trust = data.trust;
  return (
    <View style={styles.contextStack}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarLarge}><UserRoundCheck color={colors.greenDark} size={26} /></View>
        <View style={styles.fill}>
          <Text style={styles.heroSmall}>{profileName(data.profile)}</Text>
          <Text style={styles.rowMeta}>{trust.username ? `@${trust.username}` : shortId(trust.user_id)} / {label(trust.trust_level)}</Text>
          <Badge tone={trustTone(trust)}>{label(trust.trust_level)}</Badge>
        </View>
      </View>
      <View style={styles.detailGrid}>
        <DetailCell label="Profile" value={trust.profile_complete ? "Complete" : "Incomplete"} />
        <DetailCell label="Moderation" value={label(trust.moderation_status)} />
        <DetailCell label="Risk flags" value={String(trust.open_risk_flags ?? data.profile.risk_flags.filter((flag) => flag.status === "open").length)} />
        <DetailCell label="Payout" value={payout?.recipient_name ? `${payout.recipient_name} / ${payout.bank_name || "Bank missing"}` : "Not saved"} />
      </View>
      <Text style={styles.subhead}>Game accounts</Text>
      {data.profile.game_accounts.length ? data.profile.game_accounts.map((account) => (
        <View key={account.id} style={styles.compactRow}>
          <Text style={styles.compactTitle}>{account.handle}</Text>
          <Text style={styles.compactMeta}>{label(account.status)} / UID {account.external_uid || "not supplied"} / {account.is_primary ? "Primary" : "Secondary"}</Text>
        </View>
      )) : <Text style={styles.rowMeta}>No game accounts are saved.</Text>}
      <Text style={styles.subhead}>Open risk context</Text>
      {data.profile.risk_flags.length ? data.profile.risk_flags.slice(0, 4).map((flag) => (
        <View key={flag.id} style={styles.compactRow}>
          <Text style={styles.compactTitle}>{label(flag.severity)} / {label(flag.status)}</Text>
          <Text style={styles.compactMeta}>{flag.summary} / {dateLabel(flag.created_at)}</Text>
        </View>
      )) : <Text style={styles.rowMeta}>No risk flags are attached to this player.</Text>}
      {profile?.bio ? <Text style={styles.rowMeta}>Bio: {profile.bio}</Text> : null}
    </View>
  );
}

function ChipRow({ label: labelText, values, selected, onSelect }: { label: string; values: string[]; selected: string; onSelect: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{labelText}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {values.map((value) => (
          <Pressable key={value} onPress={() => onSelect(value)} style={[styles.chip, selected === value && styles.chipActive]}>
            <Text style={[styles.chipText, selected === value && styles.chipTextActive]}>{label(value)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function LabeledInput({
  label: labelText,
  optional,
  value,
  onChangeText,
  placeholder,
  multiline,
  minHeight,
  mono
}: {
  label: string;
  optional?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  minHeight?: number;
  mono?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{labelText}</Text>
      {optional ? <Text style={styles.optionalLabel}>(optional)</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        multiline={multiline}
        autoCapitalize="none"
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.multilineInput, mono && styles.inputMono, minHeight ? { minHeight } : null]}
      />
    </View>
  );
}

function DetailCell({ label: labelText, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailCell}>
      <Text style={styles.detailLabel}>{labelText}</Text>
      <Text style={[styles.detailValue, mono && styles.monoText]}>{value}</Text>
    </View>
  );
}

function MiniStat({ label: labelText, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.metricLabel}>{labelText}</Text>
      <Text style={styles.miniValue}>{value}</Text>
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
  shell: { backgroundColor: colors.navy, padding: 0, overflow: "hidden" },
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: "#17263a" },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.navySoft },
  brandMark: { width: 48, height: 48, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.green },
  brandText: { color: colors.navy, fontWeight: "900", fontSize: 16 },
  brandCopy: { flex: 1, minWidth: 0 },
  shellTitle: { color: colors.white, fontSize: 20, fontWeight: "900" },
  shellMeta: { marginTop: 2, color: "#a7b5c7", fontSize: 12, fontWeight: "800" },
  playerButton: { minHeight: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: "#22344b", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  playerButtonText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  laneTabs: { gap: spacing.sm, padding: spacing.md },
  laneTab: { minHeight: 44, borderRadius: radius.sm, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.navySoft },
  laneTabActive: { backgroundColor: colors.white },
  laneTabText: { color: "#b7c4d4", fontWeight: "900" },
  laneTabTextActive: { color: colors.navy },
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  hero: { backgroundColor: "#fbfefe" },
  heroTitle: { color: colors.ink, fontSize: 32, lineHeight: 38, fontWeight: "900" },
  darkHeroTitle: { color: colors.white, fontSize: 32, lineHeight: 38, fontWeight: "900" },
  heroSmall: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 25, fontWeight: "600" },
  darkCopy: { color: "#cbd6e5", fontSize: 16, lineHeight: 25, fontWeight: "600" },
  livePill: { minHeight: 78, borderRadius: radius.lg, borderWidth: 1, borderColor: "#b6f4db", backgroundColor: colors.greenSoft, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  liveIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  liveTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  liveMeta: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  fill: { flex: 1, minWidth: 0 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metricCard: { width: "47%", minHeight: 142, justifyContent: "space-between", padding: spacing.md },
  cyanTop: { borderTopWidth: 4, borderTopColor: colors.cyan },
  greenTop: { borderTopWidth: 4, borderTopColor: colors.greenDark },
  amberTop: { borderTopWidth: 4, borderTopColor: colors.amber },
  redTop: { borderTopWidth: 4, borderTopColor: colors.red },
  metricLabel: { color: colors.faint, fontSize: 11, lineHeight: 15, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  metricValue: { fontSize: 34, fontWeight: "900" },
  cyanText: { color: colors.cyan },
  greenText: { color: colors.greenDark },
  amberText: { color: colors.amber },
  redText: { color: colors.red },
  metricDetail: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  eyebrow: { color: "#0898b8", fontSize: 12, fontWeight: "900", letterSpacing: 4, textTransform: "uppercase" },
  sectionTitle: { marginTop: spacing.xs, color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  queueBlock: { gap: spacing.sm },
  rowCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: spacing.md, gap: spacing.md },
  selectedRow: { borderColor: colors.cyan, backgroundColor: "#f2fdff" },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  rowTitle: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: "900", flexShrink: 1 },
  rowMeta: { color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: "700", flexShrink: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.cyanSoft, alignItems: "center", justifyContent: "center" },
  avatarLarge: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  rankBadge: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  rankText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  detailGrid: { gap: spacing.sm },
  detailCell: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  detailLabel: { color: colors.faint, fontSize: 11, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  detailValue: { marginTop: spacing.xs, color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: "800", flexShrink: 1 },
  monoText: { fontFamily: "monospace" },
  formStack: { gap: spacing.sm },
  securityHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  securityIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.cyanSoft, alignItems: "center", justifyContent: "center" },
  field: { gap: spacing.xs },
  inputLabel: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  optionalLabel: { marginTop: -4, color: colors.muted, fontSize: 13, fontWeight: "800" },
  input: { minHeight: 56, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, color: colors.ink, fontSize: 16, fontWeight: "700" },
  inputMono: { fontFamily: "monospace" },
  multilineInput: { paddingTop: spacing.md, paddingBottom: spacing.md, lineHeight: 23 },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { minHeight: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  chipTextActive: { color: colors.white },
  miniGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  miniStat: { flexGrow: 1, flexBasis: "47%", minWidth: 118, minHeight: 82, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.sm },
  miniValue: { marginTop: spacing.xs, color: colors.ink, fontSize: 22, fontWeight: "900" },
  contextStack: { gap: spacing.md },
  subhead: { color: colors.ink, fontSize: 16, fontWeight: "900", marginTop: spacing.xs },
  compactRow: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  compactTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  compactMeta: { marginTop: 3, color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  helpText: { color: colors.amber, fontSize: 13, lineHeight: 20, fontWeight: "800" },
  emptyState: { borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, padding: spacing.lg, alignItems: "center", gap: spacing.xs }
});
