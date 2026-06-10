import { create } from "zustand";

import type { User } from "@/types/auth";

interface AuthState {
  user: User | null;
  /** Access token lives in memory only (PRD decision 1) — never persisted. */
  token: string | null;
  /** False until the initial /auth/refresh attempt resolves on app mount. */
  initialized: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setInitialized: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  initialized: false,
  setAuth: (user, token) => set({ user, token, initialized: true }),
  clearAuth: () => set({ user: null, token: null, initialized: true }),
  setInitialized: () => set({ initialized: true }),
}));
