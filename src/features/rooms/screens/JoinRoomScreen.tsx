import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { CheckCircle2, DoorOpen, KeyRound, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { plainApiError } from "../../../api/errors";
import { profileOverview } from "../../../api/profile";
import { joinRoom } from "../../../api/rooms";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { colors, radius, spacing } from "../../../constants/theme";

type Notice = { tone: "error" | "success" | "info"; message: string } | null;

function missingText(key: string) {
  if (key === "username") return "Choose a username in Profile.";
  if (key === "age_confirmation") return "Confirm your age in Profile.";
  if (key === "primary_game_account") return "Add your main in-game handle in Profile.";
  return key.replaceAll("_", " ");
}

export function JoinRoomScreen() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: profileOverview });
  const [joinCode, setJoinCode] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  const profileReady = Boolean(profileQuery.data?.completion?.complete);
  const missing = profileQuery.data?.completion?.missing ?? [];

  const joinMutation = useMutation({
    mutationFn: () => {
      const roomCode = joinCode.trim().toUpperCase();
      if (!profileReady) throw new Error("Finish your Profile setup before joining rooms with entry fees.");
      if (roomCode.length < 4) throw new Error("Enter the room code your opponent shared.");
      return joinRoom(roomCode);
    },
    onSuccess: async (result) => {
      setJoinCode("");
      setNotice({ tone: "success", message: `Joined ${result.room?.room_code ?? "the room"}. Complete your entry when the room asks for it.` });
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      if (result.room?.id) router.push(`/(app)/rooms/${result.room.id}`);
    },
    onError: (error) => setNotice({ tone: "error", message: plainApiError(error, "Could not join room.") })
  });

  return (
    <AppScreen>
      <SurfaceCard dark>
        <Badge tone="dark">Join code</Badge>
        <Text style={styles.heroTitle}>Enter a private room.</Text>
        <Text style={styles.heroCopy}>Paste the code your opponent shared. Skillsroom confirms the room is open and that your player profile is ready.</Text>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.rowBetween}>
          <View style={styles.fill}>
            <Badge tone={profileReady ? "green" : "amber"}>{profileReady ? "Ready" : "Setup needed"}</Badge>
            <Text style={styles.sectionTitle}>Player setup</Text>
            <Text style={styles.copy}>Rooms with entry fees use the same player identity checks for everyone.</Text>
          </View>
          <CheckCircle2 size={36} color={profileReady ? colors.greenDark : colors.amber} />
        </View>
        {profileQuery.isLoading ? <Text style={styles.copy}>Checking your profile...</Text> : null}
        {profileQuery.isError ? <FeedbackState tone="error" title="Profile check failed" body="We could not confirm your player setup." actionLabel="Retry" onAction={() => void profileQuery.refetch()} /> : null}
        {!profileQuery.isLoading && !profileReady ? (
          <>
            <FormNotice tone="info" message={missing.length ? missing.map(missingText).join(" ") : "Finish your Profile setup before joining rooms with entry fees."} />
            <AppButton variant="secondary" onPress={() => router.push("/(app)/(tabs)/profile")}>Open Profile</AppButton>
          </>
        ) : null}
      </SurfaceCard>

      <SurfaceCard>
        <Badge>Room code</Badge>
        <Text style={styles.sectionTitle}>Paste the code</Text>
        <View style={styles.codeShell}>
          <KeyRound size={24} color={colors.cyan} />
          <TextInput
            value={joinCode}
            onChangeText={(value) => setJoinCode(value.replace(/\s+/g, "").toUpperCase())}
            autoCapitalize="characters"
            placeholder="SR8K21"
            placeholderTextColor={colors.faint}
            style={styles.input}
          />
        </View>
        <FormNotice tone="info" message="Joining only adds you to the room. The match opens after both players complete their entry." />
        {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
        <AppButton loading={joinMutation.isPending} disabled={!profileReady || !joinCode.trim()} onPress={() => joinMutation.mutate()}>Join room</AppButton>
        <AppButton variant="secondary" onPress={() => router.back()}>Back to rooms</AppButton>
      </SurfaceCard>

      <View style={styles.infoGrid}>
        <InfoTile icon={DoorOpen} title="Open rooms only" detail="Closed, full, or completed rooms cannot be joined." />
        <InfoTile icon={ShieldCheck} title="Profile checked" detail="Your room identity and game handle must be ready." />
      </View>
    </AppScreen>
  );
}

function InfoTile({ icon: Icon, title, detail }: { icon: typeof DoorOpen; title: string; detail: string }) {
  return (
    <SurfaceCard style={styles.infoTile}>
      <Icon size={24} color={colors.cyan} />
      <Text style={styles.itemTitle}>{title}</Text>
      <Text style={styles.copy}>{detail}</Text>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  heroTitle: { color: colors.white, fontSize: 38, lineHeight: 44, fontWeight: "900" },
  heroCopy: { color: "#c8d4e1", fontSize: 16, lineHeight: 24 },
  sectionTitle: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  itemTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  fill: { flex: 1 },
  rowBetween: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  codeShell: {
    minHeight: 74,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt
  },
  input: {
    flex: 1,
    minHeight: 70,
    fontSize: 28,
    letterSpacing: 3,
    fontWeight: "900",
    color: colors.ink
  },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  infoTile: { flexBasis: "47%", flexGrow: 1, padding: spacing.md }
});
