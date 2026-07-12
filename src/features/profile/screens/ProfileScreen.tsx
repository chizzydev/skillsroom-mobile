import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { BadgeCheck, Banknote, BriefcaseBusiness, Copy, Gamepad2, Link as LinkIcon, Radio, ShieldCheck } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ImageBackground, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { canAccessAdmin, roleLabel } from "../../../api/admin";
import { plainApiError } from "../../../api/errors";
import { myCommunityClan, myReferralProgram, profileOverview, profileTrustSummary, saveGameAccount, savePayoutProfile, saveProfile } from "../../../api/profile";
import { getGames } from "../../../api/rooms";
import { completeStreamingOauth, listStreamingAccounts, saveManualStreamingAccount, startStreamingOauth, syncStreamingAccount } from "../../../api/streaming";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { env } from "../../../config/env";
import { colors, radius, shadow, spacing } from "../../../constants/theme";
import { useAuthStore } from "../../../store/auth-store";
import type { PlayerTrustSummary, UserGameAccount } from "../../../types/api";
import { ConnectedChannelCard } from "../../streaming/components/StreamCards";

type Notice = { tone: "error" | "success" | "info"; message: string } | null;
type Visibility = "private" | "room_participants" | "public";
type StreamProvider = "youtube" | "twitch";
type IconComponent = typeof ShieldCheck;

const profileArtwork = require("../../../../assets/marketing/skillsroom-premium/community-premium.png");

WebBrowser.maybeCompleteAuthSession();

function asText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function missingText(key: string) {
  if (key === "username") return "Choose a Skillsroom username.";
  if (key === "age_confirmation") return "Confirm you are old enough to use Skillsroom.";
  if (key === "primary_game_account") return "Add your main in-game handle.";
  return key.replaceAll("_", " ");
}

function accountStatusLabel(status?: string) {
  if (status === "verified") return "Verified";
  if (status === "rejected") return "Needs update";
  if (status === "disabled") return "Disabled";
  return "Saved";
}

function accountTone(status?: string) {
  if (status === "verified") return "green";
  if (status === "rejected" || status === "disabled") return "red";
  return "cyan";
}

function visibilityLabel(value: Visibility) {
  if (value === "private") return "Private";
  if (value === "public") return "Public";
  return "Room players";
}

function titleCase(value?: string | null) {
  return (value || "open").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function trustTone(trust?: PlayerTrustSummary | null) {
  if (!trust || trust.trust_level === "incomplete") return "amber";
  if (trust.trust_level === "blocked" || trust.moderation_status === "restricted" || trust.moderation_status === "suspended" || trust.moderation_status === "banned") return "red";
  if (trust.trust_level === "review" || trust.moderation_status === "under_review" || trust.moderation_status === "watchlisted") return "amber";
  return "green";
}

export function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const queryClient = useQueryClient();

  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: profileOverview });
  const gamesQuery = useQuery({ queryKey: ["games"], queryFn: getGames });
  const streamsQuery = useQuery({ queryKey: ["streaming-accounts"], queryFn: listStreamingAccounts });
  const trustQuery = useQuery({
    queryKey: ["profile-trust", user?.id],
    queryFn: () => profileTrustSummary(user!.id),
    enabled: Boolean(user?.id)
  });
  const clanQuery = useQuery({ queryKey: ["my-community-clan"], queryFn: myCommunityClan });
  const referralQuery = useQuery({ queryKey: ["my-referral-program"], queryFn: myReferralProgram });

  const profile = profileQuery.data?.profile;
  const gameAccounts = profileQuery.data?.game_accounts ?? [];
  const payoutProfile = profileQuery.data?.payout_profile;
  const completion = profileQuery.data?.completion;
  const primaryAccount = gameAccounts.find((account) => account.is_primary && account.status !== "disabled");
  const games = gamesQuery.data?.games ?? [];
  const defaultGameSlug = games[0]?.slug ?? "";
  const streams = streamsQuery.data ?? [];
  const trust = trustQuery.data ?? (profileQuery.data?.trust as PlayerTrustSummary | undefined) ?? null;
  const clan = clanQuery.data?.clan ?? null;
  const clanMembers = clanQuery.data?.members ?? [];
  const clanHistory = clanQuery.data?.tournament_history ?? [];
  const referralSummary = referralQuery.data?.summary ?? {};
  const referrals = referralQuery.data?.referrals ?? [];
  const referralUrl = referralQuery.data?.referral_path ? new URL(referralQuery.data.referral_path, env.webAppUrl).toString() : "";

  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [gameNotice, setGameNotice] = useState<Notice>(null);
  const [payoutNotice, setPayoutNotice] = useState<Notice>(null);
  const [streamNotice, setStreamNotice] = useState<Notice>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [region, setRegion] = useState("NG");
  const [city, setCity] = useState("");
  const [campus, setCampus] = useState("");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("room_participants");
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const [gameSlug, setGameSlug] = useState(defaultGameSlug);
  const [gameHandle, setGameHandle] = useState("");
  const [externalUid, setExternalUid] = useState("");
  const [gameRegion, setGameRegion] = useState("NG");

  const [recipientName, setRecipientName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [payoutNote, setPayoutNote] = useState("");

  const [streamProvider, setStreamProvider] = useState<StreamProvider>("youtube");
  const [streamName, setStreamName] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [streamLogin, setStreamLogin] = useState("");
  const [oauthProvider, setOauthProvider] = useState<StreamProvider | null>(null);

  useEffect(() => {
    setDisplayName(asText(profile?.display_name, user?.display_name ?? ""));
    setUsername(asText(profile?.username, user?.email?.split("@")[0]?.replace(/[^A-Za-z0-9_]/g, "").slice(0, 24) ?? ""));
    setRegion(asText(profile?.region, "NG"));
    setCity(asText(profile?.city));
    setCampus(asText(profile?.campus));
    setTimezone(asText(profile?.timezone, "Africa/Lagos"));
    setBio(asText(profile?.bio));
    setVisibility((profile?.visibility as Visibility) ?? "room_participants");
    setAgeConfirmed(Boolean(profile?.age_confirmed_at));
  }, [profile, user]);

  useEffect(() => {
    setGameSlug(defaultGameSlug);
    setGameRegion(asText(profile?.region, "NG"));
  }, [defaultGameSlug, profile?.region]);

  useEffect(() => {
    setRecipientName(asText(payoutProfile?.recipient_name, asText(profile?.display_name)));
    setBankName(asText(payoutProfile?.bank_name));
    setBankCode(asText(payoutProfile?.bank_code));
    setPayoutNote(asText(payoutProfile?.payout_note));
  }, [payoutProfile, profile?.display_name]);

  const readinessItems = useMemo(() => {
    const missing = new Set(completion?.missing ?? []);
    return [
      { label: "Profile details", done: !missing.has("username"), detail: missing.has("username") ? "Set your username and region." : "Your public player name is set." },
      { label: "Age confirmation", done: !missing.has("age_confirmation"), detail: missing.has("age_confirmation") ? "Required before serious room activity." : "Age confirmation is saved." },
      { label: "Primary game account", done: !missing.has("primary_game_account"), detail: missing.has("primary_game_account") ? "Add the handle opponents will see." : "Your main game handle is saved." },
      { label: "Payout details", done: Boolean(payoutProfile), detail: payoutProfile ? "Winner payout instructions are saved." : "Add bank details for future winnings." },
      { label: "Stream channel", done: streams.length > 0, detail: streams.length > 0 ? "At least one channel is connected." : "Optional now, useful for streamed matches." }
    ];
  }, [completion?.missing, payoutProfile, streams.length]);

  const completedReadiness = readinessItems.filter((item) => item.done).length;
  const hasAdminAccess = canAccessAdmin(user);

  const refreshProfile = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["profile"] }),
      queryClient.invalidateQueries({ queryKey: ["profile-trust"] }),
      queryClient.invalidateQueries({ queryKey: ["streaming-accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["my-community-clan"] }),
      queryClient.invalidateQueries({ queryKey: ["my-referral-program"] })
    ]);
  };

  const profileMutation = useMutation({
    mutationFn: () => {
      const cleanUsername = username.trim();
      if (!/^[A-Za-z0-9_]{3,24}$/.test(cleanUsername)) {
        throw new Error("Use 3 to 24 letters, numbers, or underscores for your username.");
      }
      if (!ageConfirmed) throw new Error("Confirm you are old enough to use Skillsroom.");
      return saveProfile({
        username: cleanUsername,
        display_name: displayName.trim() || undefined,
        region: region.trim() || "NG",
        city: city.trim() || undefined,
        campus: campus.trim() || undefined,
        timezone: timezone.trim() || "Africa/Lagos",
        bio: bio.trim() || undefined,
        visibility,
        age_confirmed: ageConfirmed
      });
    },
    onSuccess: async () => {
      setProfileNotice({ tone: "success", message: "Profile details saved." });
      await refreshProfile();
    },
    onError: (error) => setProfileNotice({ tone: "error", message: plainApiError(error, "Could not save profile details.") })
  });

  const gameMutation = useMutation({
    mutationFn: () => {
      if (!gameSlug) throw new Error("Choose a game before saving your handle.");
      if (!gameHandle.trim()) throw new Error("Enter your in-game handle.");
      return saveGameAccount({
        game_slug: gameSlug,
        handle: gameHandle.trim(),
        external_uid: externalUid.trim() || undefined,
        region: gameRegion.trim() || region.trim() || "NG",
        is_primary: true
      });
    },
    onSuccess: async () => {
      setGameHandle("");
      setExternalUid("");
      setGameNotice({ tone: "success", message: "Primary game account saved." });
      await refreshProfile();
    },
    onError: (error) => setGameNotice({ tone: "error", message: plainApiError(error, "Could not save game account.") })
  });

  const payoutMutation = useMutation({
    mutationFn: () => {
      if (!recipientName.trim() || !bankName.trim() || !accountNumber.trim()) {
        throw new Error("Enter the account name, bank name, and account number.");
      }
      return savePayoutProfile({
        recipient_name: recipientName.trim(),
        bank_name: bankName.trim(),
        account_number: accountNumber.replace(/\s+/g, ""),
        bank_code: bankCode.trim() || undefined,
        payout_note: payoutNote.trim() || undefined,
        currency: "NGN"
      });
    },
    onSuccess: async () => {
      setAccountNumber("");
      setPayoutNotice({ tone: "success", message: "Payout details saved for future winnings." });
      await refreshProfile();
    },
    onError: (error) => setPayoutNotice({ tone: "error", message: plainApiError(error, "Could not save payout details.") })
  });

  const streamMutation = useMutation({
    mutationFn: () => {
      if (!streamName.trim() || !streamUrl.trim()) throw new Error("Enter the channel name and public channel link.");
      return saveManualStreamingAccount({
        provider: streamProvider,
        display_name: streamName.trim(),
        channel_url: streamUrl.trim(),
        provider_login: streamLogin.trim() || undefined
      });
    },
    onSuccess: async () => {
      setStreamName("");
      setStreamUrl("");
      setStreamLogin("");
      setStreamNotice({ tone: "success", message: "Stream channel saved." });
      await refreshProfile();
    },
    onError: (error) => setStreamNotice({ tone: "error", message: plainApiError(error, "Could not save stream channel.") })
  });

  async function logout() {
    setLogoutLoading(true);
    await signOut();
    setLogoutLoading(false);
    router.replace("/(auth)/login");
  }

  async function connectStreamingOauth(provider: StreamProvider) {
    setOauthProvider(provider);
    setStreamNotice(null);
    try {
      const appRedirectUri = AuthSession.makeRedirectUri({
        scheme: "skillsroom",
        path: "oauth/streaming",
        native: "skillsroom://oauth/streaming"
      });
      const started = await startStreamingOauth({
        provider,
        redirect_uri: env.streamingOauthRedirectUri,
        redirect_path: "/profile"
      });
      const result = await WebBrowser.openAuthSessionAsync(started.authorization_url, appRedirectUri);
      if (result.type !== "success") {
        setStreamNotice({ tone: "info", message: "Streaming connection was cancelled before it finished." });
        return;
      }

      const callback = new URL(result.url);
      const error = callback.searchParams.get("error");
      const code = callback.searchParams.get("code");
      const state = callback.searchParams.get("state");
      if (error) throw new Error("Streaming provider rejected the connection.");
      if (!code || !state) throw new Error("Streaming provider returned an incomplete callback.");
      if (state !== started.state) throw new Error("Streaming connection state did not match. Try again.");
      await completeStreamingOauth({ code, state });
      setStreamNotice({ tone: "success", message: `${provider === "youtube" ? "YouTube" : "Twitch"} connected.` });
      await refreshProfile();
    } catch (error) {
      setStreamNotice({ tone: "error", message: plainApiError(error, "Could not connect streaming OAuth.") });
    } finally {
      setOauthProvider(null);
    }
  }

  return (
    <AppScreen>
      <ImageBackground source={profileArtwork} imageStyle={styles.heroImage} style={styles.hero}>
        <View style={styles.heroShade}>
          <View style={styles.heroTop}>
            <Badge tone="cyan">Player profile</Badge>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(displayName || username || user?.email || "SR").slice(0, 2).toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{displayName || username || "Your Skillsroom profile"}</Text>
          <Text style={styles.heroCopy}>Your identity, game handles, payout details, stream channels, clan activity, and referrals live here.</Text>
          <View style={styles.heroStats}>
            <MiniMetric label="Ready" value={`${completedReadiness}/${readinessItems.length}`} />
            <MiniMetric label="Trust" value={titleCase(trust?.trust_level)} />
            <MiniMetric label="Rep" value={String(asNumber(trust?.reputation_score, asNumber(profile?.reputation_score, 1000)))} />
          </View>
        </View>
      </ImageBackground>

      {profileQuery.isError ? <FeedbackState tone="error" title="Profile unavailable" body="We could not load your player setup right now." actionLabel="Retry" onAction={() => void profileQuery.refetch()} /> : null}

      <View style={styles.quickGrid}>
        <ProfileSignal icon={ShieldCheck} label="Trust level" value={titleCase(trust?.trust_level)} tone={trustTone(trust)} detail={titleCase(trust?.moderation_status ?? "clear")} />
        <ProfileSignal icon={Gamepad2} label="Primary handle" value={primaryAccount?.handle ?? "Open"} tone={primaryAccount ? accountTone(primaryAccount.status) : "amber"} detail={primaryAccount?.external_uid ?? "Add player ID"} />
        <ProfileSignal icon={Banknote} label="Payouts" value={payoutProfile ? "Saved" : "Open"} tone={payoutProfile ? "green" : "amber"} detail={payoutProfile?.bank_name ?? "Future winnings"} />
        <ProfileSignal icon={Radio} label="Streaming" value={String(streams.length)} tone={streams.length ? "green" : "cyan"} detail={streams.length ? "Connected" : "Optional"} />
      </View>

      {hasAdminAccess ? (
        <SurfaceCard dark>
          <View style={styles.rowBetween}>
            <View style={styles.fill}>
              <Badge tone="dark">Admin access</Badge>
              <Text style={styles.darkTitle}>Skillsroom Admin</Text>
              <Text style={styles.darkCopy}>Open the admin tools available to {roleLabel(user?.role).toLowerCase()} roles, including player support and money-sensitive checks.</Text>
            </View>
            <View style={styles.adminIcon}>
              <BriefcaseBusiness color={colors.cyan} size={24} />
            </View>
          </View>
          <AppButton onPress={() => router.push({ pathname: "/admin" } as never)}>Open admin dashboard</AppButton>
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <View style={styles.rowBetween}>
          <View style={styles.fill}>
            <Badge tone={completion?.complete ? "green" : "amber"}>{completion?.complete ? "Ready" : "Setup open"}</Badge>
            <Text style={styles.sectionTitle}>Readiness</Text>
            <Text style={styles.copy}>Finish the important setup once, then use this profile across rooms, tournaments, payouts, streams, and community activity.</Text>
          </View>
          <Text style={styles.score}>{completedReadiness}/{readinessItems.length}</Text>
        </View>
        {completion?.missing?.length ? <FormNotice tone="info" message={completion.missing.map(missingText).join(" ")} /> : null}
        <View style={styles.checkList}>
          {readinessItems.map((item) => (
            <View key={item.label} style={styles.checkRow}>
              <Badge tone={item.done ? "green" : "amber"}>{item.done ? "Done" : "Open"}</Badge>
              <View style={styles.fill}>
                <Text style={styles.itemTitle}>{item.label}</Text>
                <Text style={styles.copy}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </SurfaceCard>

      <SurfaceCard dark>
        <Badge tone="dark">Trust card</Badge>
        <Text style={styles.darkTitle}>Player summary</Text>
        <Text style={styles.darkCopy}>This is the reputation summary attached to your room activity and public player profile.</Text>
        <View style={styles.darkMetricGrid}>
          <DarkMetric label="Matches" value={String(asNumber(trust?.completed_matches, asNumber(profile?.completed_matches)))} />
          <DarkMetric label="Wins" value={String(asNumber(trust?.wins, asNumber(profile?.wins)))} />
          <DarkMetric label="Losses" value={String(asNumber(trust?.losses, asNumber(profile?.losses)))} />
          <DarkMetric label="No shows" value={String(asNumber(trust?.no_shows))} />
        </View>
        <View style={styles.trustStrip}>
          <Text style={styles.trustStripTitle}>{primaryAccount?.handle ?? trust?.primary_game_handle ?? "No primary handle yet"}</Text>
          <Text style={styles.darkCopy}>{primaryAccount?.external_uid || trust?.primary_game_external_uid || "Add a UID/player ID where your game supports it."}</Text>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Badge>Profile details</Badge>
        <Text style={styles.sectionTitle}>Edit identity</Text>
        <Text style={styles.copy}>Set the name, location, and short bio other players will see around rooms, tournaments, and community activity.</Text>
        <View style={styles.formGrid}>
          <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Username" placeholderTextColor={colors.faint} style={styles.input} />
          <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Display name" placeholderTextColor={colors.faint} style={styles.input} />
          <View style={styles.twoCol}>
            <TextInput value={region} onChangeText={setRegion} placeholder="Region" placeholderTextColor={colors.faint} style={[styles.input, styles.half]} />
            <TextInput value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={colors.faint} style={[styles.input, styles.half]} />
          </View>
          <TextInput value={campus} onChangeText={setCampus} placeholder="Campus or community" placeholderTextColor={colors.faint} style={styles.input} />
          <TextInput value={timezone} onChangeText={setTimezone} placeholder="Timezone" placeholderTextColor={colors.faint} style={styles.input} />
          <TextInput value={bio} onChangeText={setBio} placeholder="Short player bio" placeholderTextColor={colors.faint} multiline maxLength={180} style={[styles.input, styles.textArea]} />
        </View>
        <SegmentedControl values={["room_participants", "private", "public"]} selected={visibility} labelFor={visibilityLabel} onSelect={setVisibility} />
        <Pressable style={styles.confirmRow} onPress={() => setAgeConfirmed((value) => !value)}>
          <View style={[styles.checkbox, ageConfirmed && styles.checkboxOn]} />
          <Text style={styles.copy}>I confirm I am old enough to use Skillsroom.</Text>
        </Pressable>
        {profileNotice ? <FormNotice tone={profileNotice.tone} message={profileNotice.message} /> : null}
        <AppButton loading={profileMutation.isPending} onPress={() => profileMutation.mutate()}>Save profile</AppButton>
      </SurfaceCard>

      <SurfaceCard>
        <Badge tone="green">Game accounts</Badge>
        <Text style={styles.sectionTitle}>Connected handles</Text>
        <Text style={styles.copy}>Your in-game handles are what players use to find you during rooms and tournaments.</Text>
        {gameAccounts.length ? (
          <View style={styles.cardList}>
            {gameAccounts.slice(0, 4).map((account) => <GameAccountRow key={account.id ?? `${account.handle}-${account.game_id}`} account={account} games={games} />)}
          </View>
        ) : (
          <FormNotice tone="info" message="Add the exact in-game name opponents will use to find you." />
        )}
        <SegmentedControl values={games.map((game) => game.slug).slice(0, 4)} selected={gameSlug} labelFor={(slug) => games.find((game) => game.slug === slug)?.name ?? slug} onSelect={setGameSlug} />
        <View style={styles.formGrid}>
          <TextInput value={gameHandle} onChangeText={setGameHandle} placeholder="In-game handle" placeholderTextColor={colors.faint} style={styles.input} />
          <TextInput value={externalUid} onChangeText={setExternalUid} placeholder="External player ID or UID" placeholderTextColor={colors.faint} style={styles.input} />
          <TextInput value={gameRegion} onChangeText={setGameRegion} placeholder="Game region" placeholderTextColor={colors.faint} style={styles.input} />
        </View>
        {gameNotice ? <FormNotice tone={gameNotice.tone} message={gameNotice.message} /> : null}
        <AppButton loading={gameMutation.isPending || gamesQuery.isLoading} onPress={() => gameMutation.mutate()}>Save primary game account</AppButton>
      </SurfaceCard>

      <SurfaceCard>
        <Badge tone="amber">Payout profile</Badge>
        <Text style={styles.sectionTitle}>Future winnings</Text>
        <Text style={styles.copy}>Payout details stay ready so winner payouts and refunds can be handled without asking for account details again.</Text>
        {payoutProfile ? <FormNotice tone="success" message={`Saved for ${payoutProfile.recipient_name ?? "your account"} at ${payoutProfile.bank_name ?? "your bank"} ${payoutProfile.account_number_masked ?? ""}.`} /> : null}
        <View style={styles.formGrid}>
          <TextInput value={recipientName} onChangeText={setRecipientName} placeholder="Account name" placeholderTextColor={colors.faint} style={styles.input} />
          <TextInput value={bankName} onChangeText={setBankName} placeholder="Bank name" placeholderTextColor={colors.faint} style={styles.input} />
          <TextInput value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" placeholder={payoutProfile ? "Account number required to update" : "Account number"} placeholderTextColor={colors.faint} style={styles.input} />
          <TextInput value={bankCode} onChangeText={setBankCode} placeholder="Bank code, if you know it" placeholderTextColor={colors.faint} style={styles.input} />
          <TextInput value={payoutNote} onChangeText={setPayoutNote} placeholder="Payout note" placeholderTextColor={colors.faint} style={styles.input} />
        </View>
        {payoutNotice ? <FormNotice tone={payoutNotice.tone} message={payoutNotice.message} /> : null}
        <AppButton loading={payoutMutation.isPending} onPress={() => payoutMutation.mutate()}>Save payout details</AppButton>
      </SurfaceCard>

      <SurfaceCard>
        <Badge>Streaming accounts</Badge>
        <Text style={styles.sectionTitle}>YouTube and Twitch</Text>
        <Text style={styles.copy}>Connect or save the channel you use for match streams so players can watch from the match room.</Text>
        {streams.length ? streams.map((account) => (
          <ConnectedChannelCard
            key={account.id}
            account={account}
            loading={streamMutation.isPending}
            onRefresh={() => void syncStreamingAccount(account.id).then(refreshProfile).catch((error) => setStreamNotice({ tone: "error", message: plainApiError(error, "Could not refresh stream status.") }))}
          />
        )) : <FormNotice tone="info" message="Connect a channel before your next streamed match, or save a public channel link manually." />}
        <View style={styles.twoCol}>
          <AppButton style={styles.halfButton} loading={oauthProvider === "youtube"} disabled={Boolean(oauthProvider)} onPress={() => void connectStreamingOauth("youtube")}>YouTube</AppButton>
          <AppButton style={styles.halfButton} loading={oauthProvider === "twitch"} disabled={Boolean(oauthProvider)} onPress={() => void connectStreamingOauth("twitch")}>Twitch</AppButton>
        </View>
        <SegmentedControl values={["youtube", "twitch"]} selected={streamProvider} labelFor={(value) => (value === "youtube" ? "YouTube" : "Twitch")} onSelect={setStreamProvider} />
        <View style={styles.formGrid}>
          <TextInput value={streamName} onChangeText={setStreamName} placeholder="Channel display name" placeholderTextColor={colors.faint} style={styles.input} />
          <TextInput value={streamUrl} onChangeText={setStreamUrl} autoCapitalize="none" keyboardType="url" placeholder="https://..." placeholderTextColor={colors.faint} style={styles.input} />
          <TextInput value={streamLogin} onChangeText={setStreamLogin} autoCapitalize="none" placeholder="Channel handle, optional" placeholderTextColor={colors.faint} style={styles.input} />
        </View>
        {streamNotice ? <FormNotice tone={streamNotice.tone} message={streamNotice.message} /> : null}
        <AppButton loading={streamMutation.isPending} onPress={() => streamMutation.mutate()}>Save stream channel</AppButton>
      </SurfaceCard>

      <View style={styles.sideBySide}>
        <SurfaceCard style={styles.flexCard}>
          <Badge tone={clan ? "green" : "cyan"}>Clan</Badge>
          <Text style={styles.sectionTitle}>Clan activity</Text>
          <Text style={styles.copy}>{clan ? clan.name : "Create or manage a clan on web when you are ready for team tournament identity."}</Text>
          <View style={styles.compactStats}>
            <CompactStat label="Members" value={String(clanMembers.length)} />
            <CompactStat label="Reputation" value={String(clan?.reputation_score ?? 1000)} />
            <CompactStat label="Tourneys" value={String(clanHistory.length)} />
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.flexCard}>
          <Badge tone="green">Referrals</Badge>
          <Text style={styles.sectionTitle}>Invite serious players</Text>
          <Text style={styles.copy}>Rewards stay non-money for now and unlock after real setup and activity.</Text>
          <View style={styles.referralBox}>
            <Text style={styles.referralCode}>{referralQuery.data?.referral_code ?? "Loading"}</Text>
            {referralUrl ? (
              <Pressable style={styles.linkRow} onPress={() => void Linking.openURL(referralUrl)}>
                <LinkIcon size={18} color={colors.cyan} />
                <Text numberOfLines={2} style={styles.linkText}>{referralUrl}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.compactStats}>
            <CompactStat label="Total" value={String(referralSummary.total ?? 0)} />
            <CompactStat label="Pending" value={String(referralSummary.pending_activation ?? 0)} />
            <CompactStat label="Issued" value={String(referralSummary.reward_issued ?? 0)} />
          </View>
          {referrals.slice(0, 2).map((referral) => (
            <View key={referral.id} style={styles.referralRow}>
              <Text style={styles.itemTitle}>{referral.referred_display_name || referral.referred_username || "Referred player"}</Text>
              <Badge tone={referral.status === "reward_issued" ? "green" : referral.status === "reward_held" ? "amber" : "cyan"}>{titleCase(referral.status)}</Badge>
            </View>
          ))}
        </SurfaceCard>
      </View>

      <SurfaceCard>
        <Badge tone="dark">Account access</Badge>
        <Text style={styles.sectionTitle}>Session</Text>
        <Text style={styles.copy}>{user?.email ?? "Signed in"}</Text>
        <View style={styles.accountGrid}>
          <AccountTile icon={BadgeCheck} title="Google sign-in" detail="Manage linked Google access from the secure web profile for now." />
          <AccountTile icon={Copy} title="Password setup" detail="Use the secure email reset flow if this account needs a new password." />
        </View>
        <AppButton variant="danger" loading={logoutLoading} onPress={logout}>Sign out</AppButton>
      </SurfaceCard>
    </AppScreen>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniMetric}>
      <Text style={styles.miniValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function ProfileSignal({ icon: Icon, label, value, detail, tone }: { icon: IconComponent; label: string; value: string; detail: string; tone: "cyan" | "green" | "amber" | "red" }) {
  return (
    <SurfaceCard style={styles.signalCard}>
      <View style={[styles.signalIcon, styles[`${tone}Icon`]]}>
        <Icon size={22} color={tone === "amber" ? colors.amber : tone === "red" ? colors.red : tone === "green" ? colors.greenDark : colors.cyan} />
      </View>
      <Text style={styles.signalLabel}>{label}</Text>
      <Text style={styles.signalValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.copy} numberOfLines={2}>{detail}</Text>
    </SurfaceCard>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.darkMetric}>
      <Text style={styles.darkMetricValue}>{value}</Text>
      <Text style={styles.darkMetricLabel}>{label}</Text>
    </View>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.compactStat}>
      <Text style={styles.compactValue}>{value}</Text>
      <Text style={styles.compactLabel}>{label}</Text>
    </View>
  );
}

function AccountTile({ icon: Icon, title, detail }: { icon: IconComponent; title: string; detail: string }) {
  return (
    <View style={styles.accountTile}>
      <Icon size={22} color={colors.cyan} />
      <View style={styles.fill}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.copy}>{detail}</Text>
      </View>
    </View>
  );
}

function GameAccountRow({ account, games }: { account: UserGameAccount; games: Array<{ id?: string; slug: string; name: string }> }) {
  const game = games.find((item) => item.id === account.game_id || item.slug === account.game_slug);
  return (
    <View style={styles.accountTile}>
      <Gamepad2 size={22} color={colors.cyan} />
      <View style={styles.fill}>
        <Text style={styles.itemTitle}>{account.handle ?? "Game handle"}</Text>
        <Text style={styles.copy}>{game?.name ?? account.game_slug ?? "Game"} / {account.region ?? "NG"}</Text>
      </View>
      <Badge tone={accountTone(account.status)}>{account.is_primary ? "Primary" : accountStatusLabel(account.status)}</Badge>
    </View>
  );
}

function SegmentedControl<T extends string>({
  values,
  selected,
  labelFor,
  onSelect
}: {
  values: T[];
  selected: T;
  labelFor: (value: T) => string;
  onSelect: (value: T) => void;
}) {
  if (values.length === 0) return null;

  return (
    <View style={styles.segmentWrap}>
      {values.map((value) => (
        <Pressable key={value} onPress={() => onSelect(value)} style={[styles.segment, selected === value && styles.segmentOn]}>
          <Text style={[styles.segmentText, selected === value && styles.segmentTextOn]}>{labelFor(value)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 520,
    overflow: "hidden",
    borderRadius: radius.lg,
    backgroundColor: colors.navy,
    ...shadow.card
  },
  heroImage: { borderRadius: radius.lg },
  heroShade: {
    minHeight: 520,
    padding: spacing.lg,
    justifyContent: "space-between",
    backgroundColor: "rgba(4,12,24,0.7)"
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)"
  },
  avatarText: { color: colors.green, fontWeight: "900", fontSize: 22 },
  heroTitle: { color: colors.white, fontSize: 44, lineHeight: 50, fontWeight: "900" },
  heroCopy: { color: "#d4deea", fontSize: 17, lineHeight: 26 },
  heroStats: { flexDirection: "row", gap: spacing.sm },
  miniMetric: {
    flex: 1,
    minHeight: 82,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: spacing.md,
    justifyContent: "center"
  },
  miniValue: { color: colors.white, fontSize: 20, fontWeight: "900" },
  miniLabel: { color: "#b9c8d8", fontSize: 12, fontWeight: "900", marginTop: 4 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  signalCard: { flexBasis: "47%", flexGrow: 1, padding: spacing.md },
  signalIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  cyanIcon: { backgroundColor: colors.cyanSoft },
  greenIcon: { backgroundColor: colors.greenSoft },
  amberIcon: { backgroundColor: colors.amberSoft },
  redIcon: { backgroundColor: colors.redSoft },
  signalLabel: { color: colors.faint, fontSize: 11, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  signalValue: { color: colors.ink, fontSize: 22, fontWeight: "900", marginTop: 4 },
  sectionTitle: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: "900" },
  darkTitle: { color: colors.white, fontSize: 30, lineHeight: 36, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  darkCopy: { color: "#c8d4e1", fontSize: 15, lineHeight: 22 },
  itemTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  score: { color: colors.greenDark, fontSize: 34, fontWeight: "900" },
  fill: { flex: 1 },
  rowBetween: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  adminIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.navySoft,
    borderWidth: 1,
    borderColor: "#22344b",
    alignItems: "center",
    justifyContent: "center"
  },
  checkList: { gap: spacing.sm },
  checkRow: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    backgroundColor: colors.surfaceAlt
  },
  darkMetricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  darkMetric: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "#22344b",
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: "rgba(255,255,255,0.05)"
  },
  darkMetricValue: { color: colors.white, fontSize: 28, fontWeight: "900" },
  darkMetricLabel: { color: "#9dafc1", fontWeight: "900", marginTop: 4 },
  trustStrip: { borderWidth: 1, borderColor: "#22344b", borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.navySoft },
  trustStripTitle: { color: colors.white, fontSize: 18, fontWeight: "900" },
  formGrid: { gap: spacing.sm },
  twoCol: { flexDirection: "row", gap: spacing.md },
  half: { flex: 1 },
  halfButton: { flex: 1, minHeight: 50 },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surfaceAlt
  },
  textArea: {
    minHeight: 96,
    paddingTop: spacing.md,
    textAlignVertical: "top"
  },
  segmentWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  segment: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  segmentOn: {
    borderColor: colors.green,
    backgroundColor: colors.greenSoft
  },
  segmentText: { color: colors.muted, fontWeight: "900" },
  segmentTextOn: { color: colors.greenDark },
  confirmRow: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    backgroundColor: colors.surfaceAlt
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.faint,
    backgroundColor: colors.white
  },
  checkboxOn: {
    borderColor: colors.green,
    backgroundColor: colors.green
  },
  cardList: { gap: spacing.sm },
  sideBySide: { gap: spacing.md },
  flexCard: { flex: 1 },
  compactStats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  compactStat: { flexGrow: 1, flexBasis: "30%", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceAlt },
  compactValue: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  compactLabel: { color: colors.faint, fontSize: 12, fontWeight: "900", marginTop: 4 },
  referralBox: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceAlt, gap: spacing.sm },
  referralCode: { color: colors.ink, fontSize: 28, fontWeight: "900", letterSpacing: 1 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  linkText: { color: colors.cyan, fontWeight: "900", flex: 1, minWidth: 0, lineHeight: 20 },
  referralRow: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.white },
  accountGrid: { gap: spacing.sm },
  accountTile: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    backgroundColor: colors.surfaceAlt
  }
});
