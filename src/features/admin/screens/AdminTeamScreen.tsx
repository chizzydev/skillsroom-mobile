import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, Crown, KeyRound, Radio, ShieldCheck, ShieldQuestion, UserCog, UsersRound } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  adminLanesFor,
  canAccessAdmin,
  canUseAdminSection,
  confirmAdminStepUp,
  listAdminTeamMembers,
  roleLabel,
  updateAdminTeamMemberRole,
  type AdminTeamMember,
  type TeamRole
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

type Notice = { tone: "error" | "success" | "info"; message: string } | null;
type Tone = "cyan" | "green" | "amber" | "red";

const assignableRoles: Array<Exclude<TeamRole, "owner">> = ["player", "support", "moderator", "admin"];

const roleDescriptions: Record<TeamRole, string> = {
  owner: "Full platform control. Keep this on the protected owner account only.",
  admin: "Reviews funding, wallet actions, payouts, refunds, tournaments, and major account decisions.",
  moderator: "Community Manager access for result reviews, tournament operations, disputes, room holds, and player safety.",
  support: "Player context, safe notes, and support visibility without money-moving controls.",
  player: "Normal player account. No admin workspace access."
};

function displayName(member: AdminTeamMember) {
  return member.username ?? member.profile_display_name ?? member.display_name ?? member.email ?? shortId(member.user_id);
}

function shortId(value?: string | null) {
  if (!value) return "Not supplied";
  return value.length <= 14 ? value : `${value.slice(0, 8)}...${value.slice(-5)}`;
}

function label(value?: string | null) {
  if (!value) return "Unknown";
  if (value === "moderator") return "Community Manager";
  return value.split("_").map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ");
}

function dateLabel(value?: string | null) {
  if (!value) return "Not recorded";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;
  return new Date(value).toLocaleString("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function roleTone(role?: TeamRole | null): Tone {
  if (role === "owner" || role === "support") return "green";
  if (role === "admin") return "cyan";
  if (role === "moderator") return "amber";
  return "cyan";
}

function statusTone(status?: string | null): Tone {
  if (status === "active") return "green";
  if (status === "locked" || status === "invited" || status === "suspended") return "amber";
  if (status === "disabled" || status === "removed") return "red";
  return "cyan";
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
  if (section === "players") {
    router.push({ pathname: "/admin/players" } as never);
    return;
  }
  if (section === "risk") {
    router.push({ pathname: "/admin/safety" } as never);
    return;
  }
  if (section === "team") return;
  router.replace({ pathname: "/admin" } as never);
}

export function AdminTeamScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<Exclude<TeamRole, "owner">>("support");
  const [note, setNote] = useState("");
  const [password, setPassword] = useState("");
  const [stepUpToken, setStepUpToken] = useState<string | null>(null);
  const [stepUpExpiresAt, setStepUpExpiresAt] = useState<string | null>(null);
  const canAdmin = canAccessAdmin(user);
  const canTeam = canUseAdminSection(user, "team");
  const lanes = useMemo(() => adminLanesFor(user), [user]);

  const teamQuery = useQuery({
    queryKey: ["admin", "team", "members"],
    queryFn: listAdminTeamMembers,
    enabled: canTeam
  });

  const members = teamQuery.data ?? [];
  const selectedMember = members.find((member) => member.user_id === selectedUserId);
  const ownerCount = members.filter((member) => member.user_role === "owner").length;
  const adminCount = members.filter((member) => member.user_role === "admin").length;
  const moderatorCount = members.filter((member) => member.user_role === "moderator").length;
  const supportCount = members.filter((member) => member.user_role === "support").length;

  const stepUpMutation = useMutation({
    mutationFn: () => confirmAdminStepUp(password),
    onSuccess: (result) => {
      setStepUpToken(result.step_up_token);
      setStepUpExpiresAt(result.expires_at ?? null);
      setPassword("");
      setNotice({ tone: "success", message: "Role-change unlock is active for this session." });
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Step-up confirmation failed.") })
  });

  const roleMutation = useMutation({
    mutationFn: () => {
      if (!selectedUserId.trim()) throw new Error("Select a team member first.");
      if (!stepUpToken) throw new Error("Confirm your password before changing a team role.");
      return updateAdminTeamMemberRole({
        userId: selectedUserId.trim(),
        role: selectedRole,
        note,
        stepUpToken
      });
    },
    onSuccess: async (updatedMembers) => {
      queryClient.setQueryData(["admin", "team", "members"], updatedMembers);
      setNotice({ tone: "success", message: `${selectedMember ? displayName(selectedMember) : "Team member"} is now ${label(selectedRole)}.` });
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "team", "members"] });
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Team role could not be updated.") })
  });

  if (!canAdmin) {
    return (
      <AppScreen>
        <SurfaceCard dark style={styles.permissionHero}>
          <Badge tone="dark">Team workspace</Badge>
          <Text style={styles.darkHeroTitle}>Admin access is not enabled for this account.</Text>
          <Text style={styles.darkCopy}>Only platform operators can open the Skillsroom admin workspace.</Text>
        </SurfaceCard>
        <AppButton onPress={() => router.replace("/(app)/(tabs)/home")}>Back to player app</AppButton>
      </AppScreen>
    );
  }

  if (!canTeam) {
    return (
      <AppScreen>
        <SurfaceCard dark style={styles.permissionHero}>
          <Badge tone="dark">{roleLabel(user?.role)}</Badge>
          <Text style={styles.darkHeroTitle}>Owner access is required.</Text>
          <Text style={styles.darkCopy}>Team role changes are intentionally limited to the platform owner. Your other admin areas remain available.</Text>
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
            <Text style={styles.shellTitle} numberOfLines={1}>Team roles</Text>
            <Text style={styles.shellMeta}>Owner workspace</Text>
          </View>
          <Pressable onPress={() => router.replace("/(app)/(tabs)/home")} style={styles.playerButton}>
            <Text style={styles.playerButtonText}>Player app</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.laneTabs}>
          {lanes.map((lane) => (
            <Pressable key={lane.key} onPress={() => openAdminLane(lane.key)} style={[styles.laneTab, lane.key === "team" && styles.laneTabActive]}>
              <Text style={[styles.laneTabText, lane.key === "team" && styles.laneTabTextActive]}>{lane.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
        {teamQuery.isError ? <FormNotice tone="error" message={plainApiError(teamQuery.error, "Unable to load team roles right now.")} /> : null}

        <SurfaceCard style={styles.hero}>
          <Badge tone="cyan">Owner</Badge>
          <Text style={styles.heroTitle}>Team roles without loose access.</Text>
          <Text style={styles.copy}>Give each operator the exact level they need, keep owner controls protected, and record a clear reason for every role change.</Text>
        </SurfaceCard>

        <View style={styles.livePill}>
          <View style={styles.liveIcon}><Radio color={colors.greenDark} size={22} /></View>
          <View style={styles.fill}>
            <Text style={styles.liveTitle}>Role directory</Text>
            <Text style={styles.liveMeta}>Owner-only view. Role changes require password confirmation and stay visible in team history.</Text>
          </View>
          <Badge tone="green">Locked</Badge>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard tone="green" label="Owner" value={String(ownerCount)} detail="Protected account" />
          <MetricCard tone="cyan" label="Admins" value={String(adminCount)} detail="Money and key decisions" />
          <MetricCard tone="amber" label="Community Managers" value={String(moderatorCount)} detail="Results, disputes, safety" />
          <MetricCard tone="green" label="Support" value={String(supportCount)} detail="Player context" />
        </View>

        <SectionHeader
          eyebrow="Security"
          title="Unlock role changes"
          detail="Confirm your current Skillsroom password before changing a role. Do this only when you have a clear reason that another owner can review later."
        />
        <SurfaceCard style={styles.formStack}>
          <View style={styles.securityHeader}>
            <View style={styles.securityIcon}><KeyRound color={colors.cyan} size={24} /></View>
            <View style={styles.fill}>
              <Text style={styles.rowTitle}>{stepUpToken ? "Role-change unlock active" : "Password confirmation required"}</Text>
              <Text style={styles.rowMeta}>{stepUpExpiresAt ? `Expires ${dateLabel(stepUpExpiresAt)}` : "The API will reject role updates until step-up is active."}</Text>
            </View>
          </View>
          <LabeledInput label="Current password" value={password} onChangeText={setPassword} placeholder="Enter owner password" secure />
          <AppButton onPress={() => stepUpMutation.mutate()} loading={stepUpMutation.isPending} disabled={!password.trim()}>
            Confirm password
          </AppButton>
        </SurfaceCard>

        <SectionHeader
          eyebrow="Team"
          title="Members and roles"
          detail="Tap a user to prepare a role change. The protected owner account cannot be changed from this page."
        />
        {teamQuery.isLoading ? (
          <FeedbackState title="Loading team roles" body="Checking registered users and operator assignments." />
        ) : (
          <View style={styles.queueBlock}>
            {members.length ? members.map((member) => (
              <MemberCard
                key={member.user_id}
                member={member}
                selected={member.user_id === selectedUserId}
                onPress={() => {
                  if (member.is_platform_owner || member.user_role === "owner") {
                    setNotice({ tone: "info", message: "The protected owner account cannot be changed from this page." });
                    return;
                  }
                  setSelectedUserId(member.user_id);
                  setSelectedRole(member.user_role);
                }}
              />
            )) : <EmptyState title="No team members loaded" body="Registered users will appear here when role records are available." />}
          </View>
        )}

        <SurfaceCard style={styles.formStack}>
          <View style={styles.securityHeader}>
            <View style={styles.securityIcon}><UserCog color={colors.cyan} size={24} /></View>
            <View style={styles.fill}>
              <Text style={styles.rowTitle}>Assign role</Text>
              <Text style={styles.rowMeta}>{selectedMember ? `Selected: ${displayName(selectedMember)}` : "Select a member above or paste a user ID."}</Text>
            </View>
          </View>
          <LabeledInput label="User ID" value={selectedUserId} onChangeText={setSelectedUserId} placeholder="Paste user ID" mono />
          <ChipRow label="New role" values={assignableRoles} selected={selectedRole} onSelect={setSelectedRole} />
          <LabeledInput
            label="Change reason"
            optional
            value={note}
            onChangeText={setNote}
            placeholder="Why this role is being granted or removed"
            multiline
            minHeight={110}
          />
          <Text style={styles.helpText}>Owner cannot be assigned here. Choose Player to remove admin workspace access from a non-owner operator.</Text>
          <AppButton
            onPress={() => roleMutation.mutate()}
            loading={roleMutation.isPending}
            disabled={!selectedUserId.trim() || !stepUpToken}
          >
            Update role
          </AppButton>
        </SurfaceCard>

        <SectionHeader eyebrow="Role guide" title="What each role can do" detail="Use the narrowest role that lets the person do their job. That keeps wallet, payout, and safety decisions cleaner." />
        <View style={styles.roleGuide}>
          {(Object.keys(roleDescriptions) as TeamRole[]).map((role) => (
            <SurfaceCard key={role} style={styles.roleCard}>
              <View style={styles.rowTop}>
                <RoleIcon role={role} />
                <View style={styles.fill}>
                  <Text style={styles.rowTitle}>{label(role)}</Text>
                  <Text style={styles.rowMeta}>{roleDescriptions[role]}</Text>
                </View>
              </View>
            </SurfaceCard>
          ))}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function MemberCard({ member, selected, onPress }: { member: AdminTeamMember; selected: boolean; onPress: () => void }) {
  const protectedOwner = member.is_platform_owner || member.user_role === "owner";
  return (
    <Pressable onPress={onPress} style={[styles.rowCard, selected && styles.selectedRow, protectedOwner && styles.ownerRow]}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, protectedOwner && styles.ownerAvatar]}>
          {protectedOwner ? <Crown color={colors.greenDark} size={22} /> : <UsersRound color={colors.cyan} size={22} />}
        </View>
        <View style={styles.fill}>
          <Text style={styles.rowTitle}>{displayName(member)}</Text>
          <Text style={styles.rowMeta}>{member.email ?? "No email supplied"}</Text>
          <Badge tone={roleTone(member.user_role)}>{label(member.user_role)}</Badge>
        </View>
      </View>
      <View style={styles.detailGrid}>
        <DetailCell label="User ID" value={shortId(member.user_id)} mono />
        <DetailCell label="User status" value={label(member.user_status)} tone={statusTone(member.user_status)} />
        <DetailCell label="Team status" value={label(member.team_status ?? (member.user_role === "player" ? "not team" : "active"))} tone={statusTone(member.team_status ?? member.user_status)} />
        <DetailCell label="Ownership" value={member.ownership_percentage ? `${member.ownership_percentage}%` : protectedOwner ? "Protected" : "None"} />
      </View>
      <Text style={styles.rowMeta}>
        {protectedOwner
          ? "Owner role is locked on purpose. Use this page for Admin, Community Manager, Support, and Player assignments."
          : roleDescriptions[member.user_role]}
      </Text>
      <View style={styles.metaStrip}>
        <Text style={styles.metaText}>Activated: {dateLabel(member.activated_at)}</Text>
        <Text style={styles.metaText}>Updated: {dateLabel(member.team_updated_at ?? member.updated_at)}</Text>
      </View>
    </Pressable>
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

function RoleIcon({ role }: { role: TeamRole }) {
  const iconColor = role === "owner" || role === "support" ? colors.greenDark : role === "admin" ? colors.cyan : colors.amber;
  return (
    <View style={styles.avatar}>
      {role === "owner" ? <Crown color={iconColor} size={22} /> : role === "admin" ? <ShieldCheck color={iconColor} size={22} /> : <ShieldQuestion color={iconColor} size={22} />}
    </View>
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

function ChipRow<T extends string>({ label: labelText, values, selected, onSelect }: { label: string; values: T[]; selected: T; onSelect: (value: T) => void }) {
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
  mono,
  secure
}: {
  label: string;
  optional?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  minHeight?: number;
  mono?: boolean;
  secure?: boolean;
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
        secureTextEntry={secure}
        autoCapitalize="none"
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.multilineInput, mono && styles.inputMono, minHeight ? { minHeight } : null]}
      />
    </View>
  );
}

function DetailCell({ label: labelText, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: Tone }) {
  return (
    <View style={styles.detailCell}>
      <Text style={styles.detailLabel}>{labelText}</Text>
      <Text style={[styles.detailValue, mono && styles.monoText, tone && styles[`${tone}Text`]]}>{value}</Text>
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
  metricLabel: { color: colors.faint, fontSize: 12, fontWeight: "900", letterSpacing: 3, textTransform: "uppercase" },
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
  ownerRow: { borderColor: "#b6f4db", backgroundColor: "#fbfffd" },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  rowTitle: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: "900", flexShrink: 1 },
  rowMeta: { color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: "700", flexShrink: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.cyanSoft, alignItems: "center", justifyContent: "center" },
  ownerAvatar: { backgroundColor: colors.greenSoft },
  detailGrid: { gap: spacing.sm },
  detailCell: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  detailLabel: { color: colors.faint, fontSize: 11, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  detailValue: { marginTop: spacing.xs, color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: "800", flexShrink: 1 },
  monoText: { fontFamily: "monospace" },
  metaStrip: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm, gap: 2 },
  metaText: { color: colors.faint, fontSize: 12, fontWeight: "800" },
  formStack: { gap: spacing.md },
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
  helpText: { color: colors.amber, fontSize: 13, lineHeight: 20, fontWeight: "800" },
  roleGuide: { gap: spacing.sm },
  roleCard: { padding: spacing.md },
  emptyState: { borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, padding: spacing.lg, alignItems: "center", gap: spacing.xs }
});
