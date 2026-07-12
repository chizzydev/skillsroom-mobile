import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppProviders } from "../src/providers/AppProviders";
import { colors } from "../src/constants/theme";

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg }
        }}
      />
    </AppProviders>
  );
}
