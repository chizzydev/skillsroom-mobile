import { create } from "zustand";
import type { AuthUser } from "../types/api";
import * as authApi from "../api/auth";
import { ApiError, setAuthFailureHandler } from "../api/client";
import { clearStoredTokens, getStoredTokens, getStoredUser, setStoredUser } from "../api/session";
import { unregisterCurrentPushDevice } from "../features/notifications/pushRegistration";
import { queryClient } from "../providers/query-client";
import { useAdminStepUpStore } from "./admin-step-up-store";

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
  updateUserIdentity: (identity: Partial<Pick<AuthUser, "username" | "display_name" | "email" | "role" | "status">>) => void;
};

function cleanIdentityValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mergeIdentity(user: AuthUser | null, identity: Partial<Pick<AuthUser, "username" | "display_name" | "email" | "role" | "status">>) {
  if (!user) return user;
  const next: AuthUser = { ...user };
  let changed = false;
  const username = cleanIdentityValue(identity.username);
  const displayName = cleanIdentityValue(identity.display_name);
  const email = cleanIdentityValue(identity.email);
  if (username && username !== user.username) {
    next.username = username;
    changed = true;
  }
  if (displayName && displayName !== user.display_name) {
    next.display_name = displayName;
    changed = true;
  }
  if (email && email !== user.email) {
    next.email = email;
    changed = true;
  }
  if (identity.role && identity.role !== user.role) {
    next.role = identity.role;
    changed = true;
  }
  if (identity.status && identity.status !== user.status) {
    next.status = identity.status;
    changed = true;
  }
  return changed ? next : user;
}

function preferCachedIdentity(user: AuthUser, cached: AuthUser | null) {
  if (!cached || cached.id !== user.id) return user;
  return {
    ...user,
    username: cleanIdentityValue(cached.username) ?? user.username,
    display_name: cleanIdentityValue(cached.display_name) ?? user.display_name
  };
}

function setSignedInUser(set: (state: Partial<AuthState>) => void, user: AuthUser) {
  const stepUp = useAdminStepUpStore.getState();
  if (stepUp.userId && stepUp.userId !== user.id) stepUp.clearStepUp();
  set({ user, isSignedIn: true, bootstrapError: null });
  void setStoredUser(user);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isBootstrapping: true,
  isSignedIn: false,
  bootstrapError: null,

  bootstrap: async () => {
    try {
      set({ isBootstrapping: true, bootstrapError: null });
      const { accessToken } = await getStoredTokens();
      if (!accessToken) {
        useAdminStepUpStore.getState().clearStepUp();
        set({ user: null, isSignedIn: false, isBootstrapping: false });
        return;
      }

      const cachedUser = await getStoredUser();
      if (cachedUser) {
        set({ user: cachedUser, isSignedIn: true, isBootstrapping: true });
      }

      const user = preferCachedIdentity(await authApi.me(), cachedUser);
      set({ user, isSignedIn: true, isBootstrapping: false });
      void setStoredUser(user);
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
      useAdminStepUpStore.getState().clearStepUp();
      queryClient.clear();
      set({ user: null, isSignedIn: false, isBootstrapping: false, bootstrapError: null });
    }
  },

  signIn: async (identifier, password) => {
    const session = await authApi.login(identifier, password);
    const user = session.user ?? (await authApi.me());
    setSignedInUser(set, user);
  },

  signInWithGoogle: async (idToken) => {
    const session = await authApi.googleLogin(idToken);
    const user = session.user ?? (await authApi.me());
    setSignedInUser(set, user);
  },

  signUp: async (input) => {
    const session = await authApi.register(input);
    const hasAccessToken = Boolean(session.access_token ?? session.accessToken);

    if (!hasAccessToken) {
      set({ user: null, isSignedIn: false, bootstrapError: null });
      return { signedIn: false };
    }

    const user = session.user ?? (await authApi.me());
    setSignedInUser(set, user);
    return { signedIn: true };
  },

  signOut: async () => {
    try {
      await unregisterCurrentPushDevice();
      await authApi.logout();
    } catch {
      // Local sign-out must still succeed if the API is unavailable.
    }
    useAdminStepUpStore.getState().clearStepUp();
    queryClient.clear();
    set({ user: null, isSignedIn: false, bootstrapError: null });
  },

  updateUserIdentity: (identity) => {
    const current = get().user;
    const user = mergeIdentity(current, identity);
    if (!user || user === current) return;
    set({ user });
    void setStoredUser(user);
  }
}));

setAuthFailureHandler(() => {
  void clearStoredTokens();
  useAdminStepUpStore.getState().clearStepUp();
  queryClient.clear();
  useAuthStore.setState({ user: null, isSignedIn: false, isBootstrapping: false, bootstrapError: null });
});
