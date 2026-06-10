import { api, type Envelope } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/auth";

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export async function login(email: string, password: string): Promise<User> {
  const res = await api.post<Envelope<LoginResponse>>("/auth/login", {
    email,
    password,
  });
  const { access_token, user } = res.data.data;
  useAuthStore.getState().setAuth(user, access_token);
  return user;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } finally {
    useAuthStore.getState().clearAuth();
  }
}

/**
 * Restores the session from the httpOnly refresh cookie on app mount —
 * the access token lives in memory only, so a hard refresh loses it
 * (PRD decision: initAuth() must run before rendering protected routes).
 */
export async function initAuth(): Promise<void> {
  const store = useAuthStore.getState();
  try {
    const res = await api.post<Envelope<{ access_token: string; user: User }>>(
      "/auth/refresh",
    );
    const { access_token, user } = res.data.data;
    store.setAuth(user, access_token);
  } catch {
    store.clearAuth();
  } finally {
    useAuthStore.getState().setInitialized();
  }
}
