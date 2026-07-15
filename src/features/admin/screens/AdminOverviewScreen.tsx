import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, BellDot, BriefcaseBusiness, ChevronRight, Radio, ShieldCheck, WalletCards } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  adminOverview,
  archiveCommunityAnnouncement,
  canAccessAdmin,
  createChatChannel,
  createCommunityAnnouncement,
  publishCommunityAnnouncement,
  roleLabel,
  type AdminWorkItem,
  type ChatChannelType,
  type ChatChannelVisibility,
  type CommunityAnnouncementCategory,
  type CommunityAnnouncementPriority
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

type Tone = "cyan" | "green" | "amber" | "red";

const announcementCategories: Array<{ value: CommunityAnnouncementCategory; label: string }> = [
  { value: "announcement", label: "Announcement" },
  { value: "maintenance", label: "Maintenance" },
  { value: "incident", label: "Incident" },
  { value: "winner_post", label: "Winner post" },
  { value: "tournament_update", label: "Tournament update" },
  { value: "sponsor_note", label: "Sponsor note" }
];

const announcementPriorities: Array<{ value: CommunityAnnouncementPriority; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
  { value: "low", label: "Low" }
];

const channelTypes: Array<{ value: ChatChannelType; label: string }> = [
  { value: "group", label: "Community" },
  { value: "game", label: "Game" },
  { value: "tournament", label: "Tournament" },
  { value: "match_room", label: "Room" }
];

const channelVisibilities: Array<{ value: ChatChannelVisibility; label: string }> = [
  { value: "public", label: "Public" },
  { value: "members", label: "Members" },
  { value: "private", label: "Private" }
];

type Notice = { tone: "error" | "success" | "info"; message: string } | null;
type AdminLaneKey = "overview" | "funding" | "wallet" | "results" | "settlements" | "tournaments" | "players" | "team" | "risk";

function roleCopy(role?: string) {
  if (role === "moderator") {
    return {
      eyebrow: "Community",
      title: "Community manager workspace",
      body: "Review match results, player handles, tournament activity, and safety reports from one focused mobile command center."
    };
  }
  if (role === "support") {
    return {
      eyebrow: "Support",
      title: "Support workspace",
      body: "Check player records, support context, and safe risk visibility without exposing money controls."
    };
  }
  if (role === "owner") {
    return {
      eyebrow: "Owner",
      title: "Owner command center",
      body: "Monitor money reviews, results, safety, tournaments, community operations, and team access from one admin home."
    };
  }
  return {
    eyebrow: "Admin",
    title: "Admin dashboard",
    body: "Review payments, wallet top-ups, match results, refunds, player reports, and support items from one place."
  };
}

function shortId(value: string) {
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function AdminOverviewScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { pushFeedback } = useActionFeedback();
  const [selectedLane, setSelectedLane] = useState("overview");
  const [announcementNotice, setAnnouncementNotice] = useState<Notice>(null);
  const [announcementCategory, setAnnouncementCategory] = useState<CommunityAnnouncementCategory>("announcement");
  const [announcementPriority, setAnnouncementPriority] = useState<CommunityAnnouncementPriority>("normal");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementSummary, setAnnouncementSummary] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementCtaLabel, setAnnouncementCtaLabel] = useState("");
  const [announcementCtaUrl, setAnnouncementCtaUrl] = useState("");
  const [publishNow, setPublishNow] = useState(false);
  const [channelNotice, setChannelNotice] = useState<Notice>(null);
  const [channelType, setChannelType] = useState<ChatChannelType>("group");
  const [channelVisibility, setChannelVisibility] = useState<ChatChannelVisibility>("public");
  const [channelTitle, setChannelTitle] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [channelSlug, setChannelSlug] = useState("");
  const [channelGameSlug, setChannelGameSlug] = useState("");
  const [channelTournamentId, setChannelTournamentId] = useState("");
  const [channelRoomId, setChannelRoomId] = useState("");
  const [announcementActionId, setAnnouncementActionId] = useState<string | null>(null);
  const copy = roleCopy(user?.role);
  const canAdmin = canAccessAdmin(user);
  const overviewQuery = useQuery({
    queryKey: ["admin", "overview", user?.role],
    queryFn: () => adminOverview(user),
    enabled: canAdmin
  });

  const data = overviewQuery.data;
  const lanes = data?.lanes ?? [];
  const selectedLaneDetail = lanes.find((lane) => lane.key === selectedLane)?.detail;
  const counts = data?.counts;
  const totalWaiting = useMemo(() => {
    if (!counts) return 0;
    return counts.funding + counts.results + counts.payments + counts.walletTopups + counts.walletPayouts + counts.safety;
  }, [counts]);
  const canManageCommunity = user?.role === "owner" || user?.role === "admin";

  const notifyAnnouncement = (nextNotice: NonNullable<Notice>) => {
    setAnnouncementNotice(nextNotice);
    pushFeedback({
      tone: nextNotice.tone,
      title: nextNotice.tone === "error" ? "Announcement action failed" : "Announcement updated",
      message: nextNotice.message
    });
  };

  const notifyChannel = (nextNotice: NonNullable<Notice>) => {
    setChannelNotice(nextNotice);
    pushFeedback({
      tone: nextNotice.tone,
      title: nextNotice.tone === "error" ? "Channel action failed" : "Channel updated",
      message: nextNotice.message
    });
  };

  const announcementMutation = useMutation({
    mutationFn: () => {
      if (!announcementTitle.trim()) throw new Error("Enter an announcement title.");
      if (!announcementBody.trim()) throw new Error("Enter the announcement body.");
      return createCommunityAnnouncement({
        scope: "platform",
        category: announcementCategory,
        priority: announcementPriority,
        title: announcementTitle.trim(),
        summary: announcementSummary.trim() || undefined,
        body: announcementBody.trim(),
        cta_label: announcementCtaLabel.trim() || undefined,
        cta_url: announcementCtaUrl.trim() || undefined,
        publish_now: publishNow
      });
    },
    onSuccess: async () => {
      notifyAnnouncement({ tone: "success", message: publishNow ? "Announcement published." : "Announcement saved as a draft." });
      setAnnouncementTitle("");
      setAnnouncementSummary("");
      setAnnouncementBody("");
      setAnnouncementCtaLabel("");
      setAnnouncementCtaUrl("");
      setPublishNow(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (error) => {
      notifyAnnouncement({ tone: "error", message: plainApiError(error, "The announcement could not be saved.") });
    }
  });

  const publishMutation = useMutation({
    mutationFn: (announcementId: string) => publishCommunityAnnouncement(announcementId),
    onMutate: (announcementId) => setAnnouncementActionId(announcementId),
    onSuccess: async () => {
      notifyAnnouncement({ tone: "success", message: "Announcement published." });
      await queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (error) => {
      notifyAnnouncement({ tone: "error", message: plainApiError(error, "The announcement could not be published.") });
    },
    onSettled: () => setAnnouncementActionId(null)
  });

  const archiveMutation = useMutation({
    mutationFn: (announcementId: string) => archiveCommunityAnnouncement(announcementId),
    onMutate: (announcementId) => setAnnouncementActionId(announcementId),
    onSuccess: async () => {
      notifyAnnouncement({ tone: "success", message: "Announcement archived." });
      await queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (error) => {
      notifyAnnouncement({ tone: "error", message: plainApiError(error, "The announcement could not be archived.") });
    },
    onSettled: () => setAnnouncementActionId(null)
  });

  const channelMutation = useMutation({
    mutationFn: () => {
      if (channelType === "group" && !channelTitle.trim()) throw new Error("Enter a title for the community channel.");
      if (channelType === "game" && !channelGameSlug.trim()) throw new Error("Enter the game slug for this channel.");
      if (channelType === "tournament" && !channelTournamentId.trim()) throw new Error("Enter the tournament ID for this channel.");
      if (channelType === "match_room" && !channelRoomId.trim()) throw new Error("Enter the room ID for this channel.");
      return createChatChannel({
        channel_type: channelType,
        title: channelTitle.trim() || undefined,
        slug: channelSlug.trim() || undefined,
        description: channelDescription.trim() || undefined,
        visibility: channelVisibility,
        game_slug: channelGameSlug.trim() || undefined,
        tournament_id: channelTournamentId.trim() || undefined,
        match_room_id: channelRoomId.trim() || undefined
      });
    },
    onSuccess: async () => {
      notifyChannel({ tone: "success", message: "Community channel saved." });
      setChannelTitle("");
      setChannelDescription("");
      setChannelSlug("");
      setChannelGameSlug("");
      setChannelTournamentId("");
      setChannelRoomId("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (error) => {
      notifyChannel({ tone: "error", message: plainApiError(error, "The community channel could not be saved.") });
    }
  });

  const openLane = (laneKey: AdminLaneKey) => {
    if (laneKey === "funding") {
      router.push({ pathname: "/admin/funding" } as never);
      return;
    }
    if (laneKey === "wallet") {
      router.push({ pathname: "/admin/wallet" } as never);
      return;
    }
    if (laneKey === "results") {
      router.push({ pathname: "/admin/results" } as never);
      return;
    }
    if (laneKey === "settlements") {
      router.push({ pathname: "/admin/payments" } as never);
      return;
    }
    if (laneKey === "tournaments") {
      router.push({ pathname: "/admin/tournaments" } as never);
      return;
    }
    if (laneKey === "players") {
      router.push({ pathname: "/admin/players" } as never);
      return;
    }
    if (laneKey === "risk") {
      router.push({ pathname: "/admin/safety" } as never);
      return;
    }
    if (laneKey === "team") {
      router.push({ pathname: "/admin/team" } as never);
      return;
    }
    setSelectedLane(laneKey);
  };

  if (!canAdmin) {
    return (
      <AppScreen>
        <SurfaceCard dark style={styles.permissionHero}>
          <Badge tone="dark">Team workspace</Badge>
          <Text style={styles.darkHeroTitle}>Admin access is not enabled for this account.</Text>
          <Text style={styles.darkHeroCopy}>Only Support, Community Manager, Admin, and Owner roles can open the Skillsroom admin workspace.</Text>
        </SurfaceCard>
        <AppButton onPress={() => router.replace("/(app)/(tabs)/home")}>Back to player app</AppButton>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <SurfaceCard dark style={styles.shell}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="Back to player app" onPress={() => router.replace("/(app)/(tabs)/home")} style={styles.iconButton}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.6} />
          </Pressable>
          <View style={styles.brandMark}>
            <Text style={styles.brandText}>SR</Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.shellTitle} numberOfLines={1}>Skillsroom Admin</Text>
            <Text style={styles.shellMeta}>{roleLabel(user?.role)}</Text>
          </View>
          <Pressable style={styles.playerButton} onPress={() => router.replace("/(app)/(tabs)/home")}>
            <Text style={styles.playerButtonText}>Player app</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.laneTabs}>
          {lanes.map((lane) => (
            <Pressable
              key={lane.key}
              onPress={() => openLane(lane.key)}
              style={[styles.laneTab, selectedLane === lane.key && styles.laneTabActive]}
            >
              <Text style={[styles.laneTabText, selectedLane === lane.key && styles.laneTabTextActive]}>{lane.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SurfaceCard>

      <SurfaceCard style={styles.hero}>
        <Badge tone={copy.eyebrow === "Support" ? "green" : "cyan"}>{copy.eyebrow}</Badge>
        <Text style={styles.heroTitle}>{copy.title}</Text>
        <Text style={styles.copy}>{copy.body}</Text>
        <View style={styles.heroFooter}>
          <View style={styles.livePill}>
            <Radio color={colors.greenDark} size={18} />
            <View>
              <Text style={styles.liveTitle}>Live updates</Text>
              <Text style={styles.liveMeta}>{overviewQuery.isFetching ? "Refreshing queue" : "Listening for updates"}</Text>
            </View>
          </View>
          <Text style={styles.waitingNumber}>{overviewQuery.isLoading ? "-" : totalWaiting}</Text>
        </View>
      </SurfaceCard>

      {overviewQuery.isError ? (
        <FeedbackState
          tone="error"
          title="Admin workspace unavailable"
          body="We could not load the admin queues right now. Check the API connection and try again."
          actionLabel="Retry"
          onAction={() => void overviewQuery.refetch()}
        />
      ) : null}

      {data?.loadErrors.length ? <FormNotice tone="info" message={data.loadErrors.join(" ")} /> : null}

      {selectedLane !== "overview" ? (
        <FormNotice tone="info" message={`${selectedLaneDetail ?? "This admin area"} Use the cards below to review the work your role can manage.`} />
      ) : null}

      <View style={styles.metricGrid}>
        <MetricCard tone="amber" label="Funding" value={counts?.funding ?? 0} detail="Manual transfers waiting" icon={<WalletCards color={colors.amber} size={22} />} />
        <MetricCard tone="cyan" label="Results" value={counts?.results ?? 0} detail="Claims and evidence" icon={<ShieldCheck color={colors.cyan} size={22} />} />
        <MetricCard tone="green" label="Payments" value={counts?.payments ?? 0} detail="Payouts and refunds" icon={<BriefcaseBusiness color={colors.greenDark} size={22} />} />
        <MetricCard tone="red" label="Safety" value={counts?.safety ?? 0} detail="Flags and room holds" icon={<BellDot color={colors.red} size={22} />} />
      </View>

      <SurfaceCard>
        <SectionHeader eyebrow="Queue" title="Priority work" detail="Newest items you are allowed to review." />
        {overviewQuery.isLoading ? <Text style={styles.copy}>Loading admin queues...</Text> : null}
        {!overviewQuery.isLoading && !data?.workItems.length ? (
          <EmptyState title="Nothing waiting right now" body="When funding, result, settlement, wallet, or safety items need your role, they will appear here first." />
        ) : null}
        {data?.workItems.map((item) => <WorkItemRow key={`${item.lane}-${item.id}`} item={item} />)}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader
          eyebrow="Workspace"
          title="Your admin areas"
          detail="Open the review areas available to your role. Each area keeps its queues, decisions, and history in one place."
        />
        {lanes.map((lane) => (
          <Pressable key={lane.key} style={styles.laneRow} onPress={() => openLane(lane.key)}>
            <View style={styles.laneIcon}>
              <Text style={styles.laneIconText}>{lane.label.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={styles.fill}>
              <Text style={styles.rowTitle}>{lane.label}</Text>
              <Text style={styles.rowMeta}>{lane.detail}</Text>
            </View>
            <ChevronRight color={colors.faint} size={20} />
          </Pressable>
        ))}
      </SurfaceCard>

      {canManageCommunity ? (
        <SurfaceCard style={styles.communityCard}>
          <View style={styles.communityHeader}>
            <SectionHeader
              eyebrow="Community"
              title="Platform announcements"
              detail="Post public platform notices for maintenance windows, community updates, winner stories, or policy changes."
            />
          </View>

          <View style={styles.formPanel}>
            <Text style={styles.inputLabel}>Category</Text>
            <SegmentedOptions options={announcementCategories} selected={announcementCategory} onSelect={setAnnouncementCategory} />

            <Text style={styles.inputLabel}>Priority</Text>
            <SegmentedOptions options={announcementPriorities} selected={announcementPriority} onSelect={setAnnouncementPriority} />

            <LabeledInput label="Title" value={announcementTitle} onChangeText={setAnnouncementTitle} maxLength={140} />
            <LabeledInput
              label="Summary"
              optional
              value={announcementSummary}
              onChangeText={setAnnouncementSummary}
              placeholder="Leave blank to use the start of the body."
              multiline
              minHeight={92}
              maxLength={280}
            />
            <LabeledInput label="Body" value={announcementBody} onChangeText={setAnnouncementBody} multiline minHeight={170} maxLength={4000} />
            <View style={styles.twoColumn}>
              <LabeledInput label="CTA label" optional value={announcementCtaLabel} onChangeText={setAnnouncementCtaLabel} placeholder="Read more" />
              <LabeledInput label="CTA URL" optional value={announcementCtaUrl} onChangeText={setAnnouncementCtaUrl} placeholder="https://skillsroom.xyz/..." />
            </View>

            <Pressable style={styles.publishToggle} onPress={() => setPublishNow((value) => !value)}>
              <View style={[styles.checkbox, publishNow && styles.checkboxOn]}>
                {publishNow ? <Text style={styles.checkboxText}>✓</Text> : null}
              </View>
              <View style={styles.fill}>
                <Text style={styles.rowTitle}>Publish immediately</Text>
                <Text style={styles.rowMeta}>Leave off to save as a draft for review.</Text>
              </View>
            </Pressable>

            {announcementNotice ? <FormNotice tone={announcementNotice.tone} message={announcementNotice.message} /> : null}
            <AppButton loading={announcementMutation.isPending} onPress={() => announcementMutation.mutate()}>
              Save announcement
            </AppButton>
          </View>

          <View style={styles.managedHeader}>
            <View>
              <Text style={styles.eyebrow}>Managed</Text>
              <Text style={styles.rowTitle}>{counts?.announcements ?? 0} platform notices</Text>
            </View>
            <Badge tone="cyan">Platform</Badge>
          </View>
          {data?.announcements.length ? data.announcements.slice(0, 4).map((item) => (
            <View key={item.id} style={styles.lightAnnouncementRow}>
              <Text style={styles.rowTitle}>{item.title ?? "Platform announcement"}</Text>
              <Text style={styles.rowMeta}>{item.summary ?? "No summary supplied."}</Text>
              <Text style={styles.lightAnnouncementMeta}>{item.status ?? "draft"} - {item.priority ?? "normal"}</Text>
              <View style={styles.inlineActions}>
                {item.status !== "published" ? (
                  <AppButton
                    variant="secondary"
                    style={styles.compactButton}
                    loading={announcementActionId === item.id && publishMutation.isPending}
                    onPress={() => publishMutation.mutate(item.id)}
                  >
                    Publish
                  </AppButton>
                ) : null}
                {item.status !== "archived" ? (
                  <AppButton
                    variant="secondary"
                    style={styles.compactButton}
                    loading={announcementActionId === item.id && archiveMutation.isPending}
                    onPress={() => archiveMutation.mutate(item.id)}
                  >
                    Archive
                  </AppButton>
                ) : null}
              </View>
            </View>
          )) : (
            <View style={styles.emptyInset}>
              <EmptyState title="No platform announcements yet" body="Saved and published platform notices will appear here." />
            </View>
          )}
        </SurfaceCard>
      ) : null}

      {canManageCommunity ? (
        <SurfaceCard style={styles.channelCard}>
          <SectionHeader
            eyebrow="Channels"
            title="Community channel setup"
            detail="Create broad community channels, or ensure game, tournament, and room-linked channels for the signed-in channel list."
          />

          <View style={styles.formPanelFlush}>
            <Text style={styles.inputLabel}>Channel type</Text>
            <SegmentedOptions options={channelTypes} selected={channelType} onSelect={setChannelType} />

            <Text style={styles.inputLabel}>Visibility</Text>
            <SegmentedOptions options={channelVisibilities} selected={channelVisibility} onSelect={setChannelVisibility} />

            <LabeledInput label="Channel title" optional value={channelTitle} onChangeText={setChannelTitle} placeholder="Global community, Game hub, Tournament desk..." />
            <LabeledInput label="Description" optional value={channelDescription} onChangeText={setChannelDescription} placeholder="Short purpose shown in the channel list." multiline minHeight={92} />
            <LabeledInput label="Optional slug" optional value={channelSlug} onChangeText={setChannelSlug} placeholder="global-chat" />

            <View style={styles.channelLinkGrid}>
              <LabeledInput label="Game slug" optional value={channelGameSlug} onChangeText={setChannelGameSlug} placeholder="game-slug" />
              <LabeledInput label="Tournament ID" optional value={channelTournamentId} onChangeText={setChannelTournamentId} placeholder="tournament id" />
              <LabeledInput label="Room ID" optional value={channelRoomId} onChangeText={setChannelRoomId} placeholder="room id" />
            </View>

            <FormNotice
              tone="info"
              message="Use the matching link field for game, tournament, or room channels. Community channels can use only a title and description."
            />
            {channelNotice ? <FormNotice tone={channelNotice.tone} message={channelNotice.message} /> : null}
            <AppButton loading={channelMutation.isPending} onPress={() => channelMutation.mutate()}>
              Save channel
            </AppButton>
          </View>
        </SurfaceCard>
      ) : null}

      {user?.role === "owner" ? (
        <SurfaceCard>
          <SectionHeader eyebrow="Team access" title="Role guide" detail="Owner-only reference for what each team role can see and manage." />
          <View style={styles.roleGrid}>
            <RoleCard role="Owner" scope="Full" detail="Full platform control, team roles, money, safety, and public operations." />
            <RoleCard role="Admin" scope="Money" detail="Funding, wallet, payouts, refunds, tournaments, and result support." />
            <RoleCard role="Community Manager" scope="Community" detail="Result evidence, disputes, room holds, player trust, and tournament moderation." />
            <RoleCard role="Support" scope="Assist" detail="Player context, support notes, and safe visibility into reports." />
          </View>
        </SurfaceCard>
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

function MetricCard({ tone, label, value, detail, icon }: { tone: Tone; label: string; value: number; detail: string; icon: React.ReactNode }) {
  return (
    <SurfaceCard style={[styles.metricCard, styles[`${tone}Top`]]}>
      <View style={[styles.metricIcon, styles[`${tone}Soft`]]}>{icon}</View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, styles[`${tone}Text`]]}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </SurfaceCard>
  );
}

function WorkItemRow({ item }: { item: AdminWorkItem }) {
  return (
    <View style={styles.workRow}>
      <Badge tone={item.tone}>{item.priority}</Badge>
      <View style={styles.workMain}>
        <Text style={styles.rowTitle}>{item.type}</Text>
        <Text style={styles.rowMeta}>{item.context}</Text>
        <Text style={styles.workMeta}>{item.room} - {item.actor} - {shortId(item.id)}</Text>
      </View>
    </View>
  );
}

function SegmentedOptions<T extends string>({
  options,
  selected,
  onSelect
}: {
  options: Array<{ value: T; label: string }>;
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.segmentedWrap}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onSelect(option.value)}
          style={[styles.segmentedOption, selected === option.value && styles.segmentedOptionActive]}
        >
          <Text style={[styles.segmentedText, selected === option.value && styles.segmentedTextActive]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function LabeledInput({
  label,
  optional,
  value,
  onChangeText,
  placeholder,
  multiline,
  minHeight,
  maxLength
}: {
  label: string;
  optional?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  minHeight?: number;
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>
      {optional ? <Text style={styles.optionalLabel}>(optional)</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        multiline={multiline}
        maxLength={maxLength}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.multilineInput, minHeight ? { minHeight } : null]}
      />
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

function DarkStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.darkStat}>
      <Text style={styles.darkStatValue}>{value}</Text>
      <Text style={styles.darkStatLabel}>{label}</Text>
    </View>
  );
}

function RoleCard({ role, scope, detail }: { role: string; scope: string; detail: string }) {
  return (
    <View style={styles.roleCard}>
      <Text style={styles.metricLabel}>{role}</Text>
      <Text style={styles.roleScope}>{scope}</Text>
      <Text style={styles.rowMeta}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    padding: 0,
    overflow: "hidden"
  },
  permissionHero: {
    minHeight: 260,
    justifyContent: "center"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#17263a"
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navySoft
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green
  },
  brandText: {
    color: colors.navy,
    fontWeight: "900",
    fontSize: 16
  },
  brandCopy: {
    flex: 1,
    minWidth: 0
  },
  shellTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900"
  },
  shellMeta: {
    marginTop: 2,
    color: "#a7b5c7",
    fontSize: 12,
    fontWeight: "800"
  },
  playerButton: {
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "#22344b",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  playerButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "900"
  },
  laneTabs: {
    gap: spacing.sm,
    padding: spacing.md
  },
  laneTab: {
    minHeight: 44,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navySoft
  },
  laneTabActive: {
    backgroundColor: colors.white
  },
  laneTabText: {
    color: "#b7c4d4",
    fontWeight: "900"
  },
  laneTabTextActive: {
    color: colors.navy
  },
  hero: {
    backgroundColor: "#fbfefe"
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900"
  },
  darkHeroTitle: {
    color: colors.white,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900"
  },
  copy: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 25,
    fontWeight: "600"
  },
  darkHeroCopy: {
    color: "#cbd6e5",
    fontSize: 16,
    lineHeight: 25,
    fontWeight: "600"
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  livePill: {
    flex: 1,
    minHeight: 66,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#b6f4db",
    backgroundColor: colors.greenSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md
  },
  liveTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  liveMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  waitingNumber: {
    color: colors.ink,
    fontSize: 42,
    fontWeight: "900"
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  metricCard: {
    width: "47%",
    minHeight: 166,
    justifyContent: "space-between",
    padding: spacing.md
  },
  cyanTop: { borderTopWidth: 4, borderTopColor: colors.cyan },
  greenTop: { borderTopWidth: 4, borderTopColor: colors.greenDark },
  amberTop: { borderTopWidth: 4, borderTopColor: colors.amber },
  redTop: { borderTopWidth: 4, borderTopColor: colors.red },
  metricIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center"
  },
  cyanSoft: { backgroundColor: colors.cyanSoft },
  greenSoft: { backgroundColor: colors.greenSoft },
  amberSoft: { backgroundColor: colors.amberSoft },
  redSoft: { backgroundColor: colors.redSoft },
  metricLabel: {
    color: colors.faint,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase"
  },
  metricValue: {
    fontSize: 38,
    fontWeight: "900"
  },
  cyanText: { color: colors.cyan },
  greenText: { color: colors.greenDark },
  amberText: { color: colors.amber },
  redText: { color: colors.red },
  metricDetail: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  eyebrow: {
    color: "#0898b8",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 4,
    textTransform: "uppercase"
  },
  sectionTitle: {
    marginTop: spacing.xs,
    color: colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900"
  },
  workRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.sm
  },
  workMain: {
    gap: 4
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700"
  },
  workMeta: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  emptyState: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs
  },
  laneRow: {
    minHeight: 82,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  laneIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.cyanSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  laneIconText: {
    color: "#0898b8",
    fontWeight: "900"
  },
  fill: {
    flex: 1,
    minWidth: 0
  },
  darkTitle: {
    color: colors.white,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900"
  },
  darkCopy: {
    color: "#cbd6e5",
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "600"
  },
  darkStatRow: {
    flexDirection: "row",
    gap: spacing.md
  },
  darkStat: {
    flex: 1,
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#22344b",
    backgroundColor: colors.navySoft,
    padding: spacing.md,
    justifyContent: "center"
  },
  darkStatValue: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "900"
  },
  darkStatLabel: {
    color: "#91a0b4",
    marginTop: 3,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase"
  },
  announcementRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#22344b",
    padding: spacing.md,
    backgroundColor: "#0b1b2d"
  },
  announcementTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "900"
  },
  announcementMeta: {
    marginTop: 4,
    color: "#91a0b4",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  communityCard: {
    borderColor: "#b8eff8",
    padding: 0,
    overflow: "hidden"
  },
  communityHeader: {
    padding: spacing.md,
    paddingBottom: 0
  },
  formPanel: {
    margin: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    padding: spacing.md,
    gap: spacing.sm
  },
  formPanelFlush: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    padding: spacing.md,
    gap: spacing.sm
  },
  inputLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  optionalLabel: {
    marginTop: -4,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  segmentedWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  segmentedOption: {
    minHeight: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentedOptionActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  segmentedText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900"
  },
  segmentedTextActive: {
    color: colors.white
  },
  field: {
    gap: spacing.xs
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700"
  },
  multilineInput: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    lineHeight: 23
  },
  twoColumn: {
    gap: spacing.sm
  },
  publishToggle: {
    minHeight: 76,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  },
  checkboxOn: {
    backgroundColor: colors.green,
    borderColor: colors.green
  },
  checkboxText: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: "900"
  },
  managedHeader: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  lightAnnouncementRow: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.xs
  },
  lightAnnouncementMeta: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase"
  },
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  compactButton: {
    minHeight: 42,
    flexGrow: 1
  },
  channelCard: {
    borderColor: colors.line
  },
  channelLinkGrid: {
    gap: spacing.sm
  },
  emptyInset: {
    margin: spacing.md,
    marginTop: 0
  },
  roleGrid: {
    gap: spacing.sm
  },
  roleCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md
  },
  roleScope: {
    marginVertical: spacing.xs,
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900"
  }
});
