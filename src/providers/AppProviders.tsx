import { QueryClientProvider } from "@tanstack/react-query";
import * as NavigationBar from "expo-navigation-bar";
import { usePathname } from "expo-router";
import { ReactNode, useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { queryClient } from "./query-client";
import { useAuthStore } from "../store/auth-store";
import { LiveUpdatesProvider } from "./LiveUpdatesProvider";
import { PushNotificationsProvider } from "./PushNotificationsProvider";

function AndroidNavigationBarController() {
  const pathname = usePathname();

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const darkRoute = pathname.startsWith("/chat/");
    void NavigationBar.setButtonStyleAsync(darkRoute ? "light" : "dark").catch(() => undefined);
  }, [pathname]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AndroidNavigationBarController />
          <PushNotificationsProvider>
            <LiveUpdatesProvider>{children}</LiveUpdatesProvider>
          </PushNotificationsProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
