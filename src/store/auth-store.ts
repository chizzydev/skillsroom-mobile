import { create } from "zustand";
import type { AuthUser } from "../types/api";
import * as authApi from "../api/auth";
import { ApiError, setAuthFailureHandler } from "../api/client";
import { clearStoredTokens, getStoredTokens } from "../api/session";
import { unregisterCurrentPushDevice } from "../features/notifications/pushRegistration";
import { queryClient } from "../providers/query-client";

type AuthState = {
  user: AuthUser | null;
  isBootstrapping: boolean;
  isSignedIn: boolean;
  bootstrapError: string | null;
  bootstrap: () => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signUp: (input: { email: string; username: string; password: string; password_confirm: string }) => Promise<{ signedIn: boolean }>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isBootstrapping: true,
  isSignedIn: false,
  bootstrapError: null,

  bootstrap: async () => {
    try {
      set({ isBootstrapping: true, bootstrapError: null });
      const { accessToken } = await getStoredTokens();
      if (!accessToken) {
        set({ user: null, isSignedIn: false, isBootstrapping: false });
        return;
      }

      const user = await authApi.me();
      set({ user, isSignedIn: true, isBootstrapping: false });
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        set({
          user: null,
          isSignedIn: false,
          isBootstrapping: false,
          bootstrapError: "Skillsroom is not reachable right now. Check your connection and try again."
        });
        return;
      }

      await clearStoredTokens();
      queryClient.clear();
      set({ user: null, isSignedIn: false, isBootstrapping: false, bootstrapError: null });
    }
  },

  signIn: async (identifier, password) => {
    const session = await authApi.login(identifier, password);
    const user = session.user ?? (await authApi.me());
    set({ user, isSignedIn: true, bootstrapError: null });
  },

  signInWithGoogle: async (idToken) => {
    const session = await authApi.googleLogin(idToken);
    const user = session.user ?? (await authApi.me());
    set({ user, isSignedIn: true, bootstrapError: null });
  },

  signUp: async (input) => {
    const session = await authApi.register(input);
    const hasAccessToken = Boolean(session.access_token ?? session.accessToken);

    if (!hasAccessToken) {
      set({ user: null, isSignedIn: false, bootstrapError: null });
      return { signedIn: false };
    }

    const user = session.user ?? (await authApi.me());
    set({ user, isSignedIn: true, bootstrapError: null });
    return { signedIn: true };
  },

  signOut: async () => {
    try {
      await unregisterCurrentPushDevice();
      await authApi.logout();
    } catch {
      // Local sign-out must still succeed if the API is unavailable.
    }
    queryClient.clear();
    set({ user: null, isSignedIn: false, bootstrapError: null });
  }
}));

setAuthFailureHandler(() => {
  void clearStoredTokens();
  queryClient.clear();
  useAuthStore.setState({ user: null, isSignedIn: false, isBootstrapping: false, bootstrapError: null });
});
