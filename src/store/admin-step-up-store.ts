import { create } from "zustand";

type AdminStepUpState = {
  token: string | null;
  expiresAt: string | null;
  userId: string | null;
  setStepUp: (token: string, expiresAt?: string | null, userId?: string | null) => void;
  clearStepUp: () => void;
};

export type AdminStepUpSnapshot = Pick<AdminStepUpState, "token" | "expiresAt" | "userId">;

export function isAdminStepUpActive(stepUp: AdminStepUpSnapshot, currentUserId?: string | null) {
  if (!stepUp.token) return false;
  if (stepUp.userId && currentUserId && stepUp.userId !== currentUserId) return false;
  if (!stepUp.expiresAt) return true;
  const expiresAt = new Date(stepUp.expiresAt).getTime();
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt > Date.now() + 5_000;
}

export const useAdminStepUpStore = create<AdminStepUpState>((set) => ({
  token: null,
  expiresAt: null,
  userId: null,
  setStepUp: (token, expiresAt = null, userId = null) => set({ token, expiresAt, userId }),
  clearStepUp: () => set({ token: null, expiresAt: null, userId: null })
}));
