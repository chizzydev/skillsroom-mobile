import { Tabs } from "expo-router";
import { MessageCircle, Trophy, UserRound, Wallet, House, Swords } from "lucide-react-native";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../../src/constants/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const tabBarHeight = (compact ? 64 : 68) + Math.max(insets.bottom, 8);
  const labelSize = compact ? 9 : 10;
  const iconSize = compact ? 22 : 24;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: labelSize,
          fontWeight: "900",
          lineHeight: labelSize + 2,
          marginTop: 2
        },
        tabBarIconStyle: {
          marginTop: 2
        },
        tabBarStyle: {
          height: tabBarHeight,
          paddingTop: compact ? 5 : 6,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopColor: colors.line,
          backgroundColor: colors.white
        },
        tabBarItemStyle: {
          minWidth: 0,
          paddingHorizontal: 0
        }
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color }) => <House color={color} size={iconSize} strokeWidth={2.35} /> }} />
      <Tabs.Screen name="rooms" options={{ title: "Rooms", tabBarIcon: ({ color }) => <Swords color={color} size={iconSize} strokeWidth={2.35} /> }} />
      <Tabs.Screen name="chat" options={{ title: "Chat", tabBarIcon: ({ color }) => <MessageCircle color={color} size={iconSize} strokeWidth={2.35} /> }} />
      <Tabs.Screen name="tournaments" options={{ title: compact ? "Tour." : "Tourneys", tabBarIcon: ({ color }) => <Trophy color={color} size={iconSize} strokeWidth={2.35} /> }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet", tabBarIcon: ({ color }) => <Wallet color={color} size={iconSize} strokeWidth={2.35} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <UserRound color={color} size={iconSize} strokeWidth={2.35} /> }} />
    </Tabs>
  );
}
