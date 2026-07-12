import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, CalendarDays, Megaphone, ShieldCheck, Trophy, UserRound } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { communityAnnouncement } from "../../../api/community";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, spacing } from "../../../constants/theme";

function formatDate(value?: string | null) {
  if (!value) return "Date not shown";
  return new Date(value).toLocaleString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function readable(value?: string | null) {
  return value ? value.replaceAll("_", " ") : "Announcement";
}

function priorityTone(priority?: string) {
  if (priority === "critical" || priority === "high") return "red" as const;
  if (priority === "low") return "amber" as const;
  return "cyan" as const;
}

function paragraphList(body?: string | null) {
  const paragraphs = (body ?? "").split(/\r?\n\r?\n/).map((item) => item.trim()).filter(Boolean);
  return paragraphs.length ? paragraphs : ["This update has no extra details yet."];
}

export function CommunityAnnouncementDetailScreen() {
  const params = useLocalSearchParams<{ announcementId?: string }>();
  const announcementId = Array.isArray(params.announcementId) ? params.announcementId[0] : params.announcementId;
  const announcementQuery = useQuery({
    queryKey: ["community", "announcement", announcementId],
    queryFn: () => communityAnnouncement(announcementId ?? ""),
    enabled: Boolean(announcementId)
  });
  const item = announcementQuery.data;
  const author = item?.author_display_name ?? item?.author_username ?? "Skillsroom";

  return (
    <AppScreen>
      <SurfaceCard dark style={styles.hero}>
        <View style={styles.heroTop}>
          <Pressable accessibilityLabel="Go back" style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.7} />
          </Pressable>
          <Badge tone="cyan">Update</Badge>
        </View>
        <Text style={styles.heroTitle}>{item?.title ?? "Community update"}</Text>
        <Text style={styles.heroCopy}>{item?.summary ?? "Opening the latest Skillsroom update."}</Text>
      </SurfaceCard>

      {!announcementId ? (
        <FeedbackState tone="error" title="Update not found" body="This notification did not include a valid update link." actionLabel="Back to Community" onAction={() => router.push({ pathname: "/community", params: { tab: "updates" } } as never)} />
      ) : null}

      {announcementQuery.isLoading ? <Text style={styles.loading}>Loading update...</Text> : null}

      {announcementQuery.isError ? (
        <FeedbackState
          tone="error"
          title="Could not open this update"
          body="The update may have been removed or the connection may have dropped."
          actionLabel="Retry"
          onAction={() => void announcementQuery.refetch()}
        />
      ) : null}

      {item ? (
        <>
          <SurfaceCard>
            <View style={styles.badges}>
              <Badge tone={priorityTone(item.priority)}>{readable(item.priority)}</Badge>
              <Badge tone="cyan">{readable(item.category)}</Badge>
              <Badge tone="green">{item.scope === "tournament" ? item.tournament_title ?? "Tournament" : "Platform"}</Badge>
            </View>
            <View style={styles.metaGrid}>
              <MetaRow icon={<CalendarDays color={colors.cyan} size={18} />} label="Posted" value={formatDate(item.published_at ?? item.created_at)} />
              <MetaRow icon={<UserRound color={colors.greenDark} size={18} />} label="From" value={author} />
              {item.game_name ? <MetaRow icon={<Trophy color={colors.amber} size={18} />} label="Game" value={item.game_name} /> : null}
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIcon}>
                <Megaphone color={colors.cyan} size={20} strokeWidth={2.6} />
              </View>
              <Text style={styles.sectionTitle}>What changed</Text>
            </View>
            {paragraphList(item.body).map((paragraph, index) => (
              <Text key={`${item.id}-${index}`} style={styles.bodyText}>{paragraph}</Text>
            ))}
          </SurfaceCard>

          {item.scope === "tournament" && item.tournament_id ? (
            <SurfaceCard>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIcon}>
                  <Trophy color={colors.amber} size={20} strokeWidth={2.6} />
                </View>
                <View style={styles.main}>
                  <Text style={styles.sectionTitle}>Related tournament</Text>
                  <Text style={styles.copy}>{item.tournament_title ?? "Open the tournament connected to this update."}</Text>
                </View>
              </View>
              <AppButton onPress={() => router.push(`/(app)/tournaments/${encodeURIComponent(item.tournament_id ?? "")}` as never)}>Open tournament</AppButton>
            </SurfaceCard>
          ) : null}

          {item.cta_label ? (
            <SurfaceCard>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIcon}>
                  <ShieldCheck color={colors.greenDark} size={20} strokeWidth={2.6} />
                </View>
                <View style={styles.main}>
                  <Text style={styles.sectionTitle}>{item.cta_label}</Text>
                  <Text style={styles.copy}>Follow the next step from this update inside Skillsroom where possible.</Text>
                </View>
              </View>
            </SurfaceCard>
          ) : null}
        </>
      ) : null}
    </AppScreen>
  );
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaIcon}>{icon}</View>
      <View style={styles.main}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.lg },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#1d3147",
    backgroundColor: colors.navySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  heroTitle: { color: colors.white, fontSize: 32, lineHeight: 38, fontWeight: "900" },
  heroCopy: { color: "#c8d4df", fontSize: 16, lineHeight: 24 },
  loading: { color: colors.muted, textAlign: "center", fontWeight: "900" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metaGrid: { gap: spacing.md },
  metaRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  metaIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  main: { flex: 1, minWidth: 0 },
  metaLabel: { color: colors.faint, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.6 },
  metaValue: { color: colors.ink, fontSize: 15, lineHeight: 21, fontWeight: "900", marginTop: 3 },
  sectionTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  sectionIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.cyanSoft, alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: colors.ink, fontSize: 22, lineHeight: 27, fontWeight: "900" },
  bodyText: { color: colors.ink, fontSize: 16, lineHeight: 26 },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22 }
});
