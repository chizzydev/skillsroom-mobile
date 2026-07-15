import { QueryClientProvider } from "@tanstack/react-query";
import * as NavigationBar from "expo-navigation-bar";
import { usePathname } from "expo-router";
import { ReactNode, useEffect } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { queryClient } from "./query-client";
import { useAuthStore } from "../store/auth-store";
import { LiveUpdatesProvider } from "./LiveUpdatesProvider";
import { PushNotificationsProvider } from "./PushNotificationsProvider";

const RESUME_SESSION_CHECK_AFTER_MS = 30_000;
const MIN_SESSION_CHECK_INTERVAL_MS = 30_000;

function AndroidNavigationBarController() {
  const pathname = usePathname();

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const darkRoute = pathname.startsWith("/chat/");
    void NavigationBar.setButtonStyleAsync(darkRoute ? "light" : "dark").catch(() => undefined);
  }, [pathname]);

  return null;
}

function SessionResumeController() {
  const validateSession = useAuthStore((state) => state.validateSession);

  useEffect(() => {
    let previousState = AppState.currentState;
    let backgroundedAt = Date.now();
    let lastCheckedAt = 0;

    function handleAppStateChange(nextState: AppStateStatus) {
      const wasAway = previousState === "background" || previousState === "inactive";

      if (nextState === "background" || nextState === "inactive") {
        backgroundedAt = Date.now();
      }

      previousState = nextState;

      if (nextState !== "active" || !wasAway) return;

      const now = Date.now();
      if (now - backgroundedAt < RESUME_SESSION_CHECK_AFTER_MS) return;
      if (now - lastCheckedAt < MIN_SESSION_CHECK_INTERVAL_MS) return;

      const { isSignedIn, isBootstrapping } = useAuthStore.getState();
      if (!isSignedIn || isBootstrapping) return;

      lastCheckedAt = now;
      void validateSession();
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [validateSession]);

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
          <SessionResumeController />
          <PushNotificationsProvider>
            <LiveUpdatesProvider>{children}</LiveUpdatesProvider>
          </PushNotificationsProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
