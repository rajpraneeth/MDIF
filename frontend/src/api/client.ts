import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { useAuthStore } from "@/stores/authStore";

/** Standard response envelope (PRD decision 2). */
export interface Envelope<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// VITE_API_BASE_URL may be a bare origin (the documented .env uses
// http://localhost:8000) or already include the /api/v1 prefix — accept both.
function normalizeBaseURL(raw: string | undefined): string {
  const url = (raw || "http://localhost:8000").replace(/\/+$/, "");
  return /\/api\/v\d+$/.test(url) ? url : `${url}/api/v1`;
}

const baseURL = normalizeBaseURL(import.meta.env.VITE_API_BASE_URL);

export const api = axios.create({
  baseURL,
  // Refresh token travels as an httpOnly cookie scoped to /api/v1/auth.
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Single-flight refresh: concurrent 401s share one /auth/refresh call.
 * Uses bare axios so the interceptors don't recurse.
 */
function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= axios
    .post<Envelope<{ access_token: string; user: import("@/types/auth").User }>>(
      `${baseURL}/auth/refresh`,
      undefined,
      { withCredentials: true },
    )
    .then((res) => {
      const { access_token, user } = res.data.data;
      useAuthStore.getState().setAuth(user, access_token);
      return access_token;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetriableConfig | undefined;
  const isAuthEndpoint = config?.url?.startsWith("/auth/") ?? false;

  if (error.response?.status === 401 && config && !config._retried && !isAuthEndpoint) {
    const token = await refreshAccessToken();
    if (token) {
      config._retried = true;
      config.headers.Authorization = `Bearer ${token}`;
      return api(config);
    }
    useAuthStore.getState().clearAuth();
    if (window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  }
  return Promise.reject(error);
});

/** Extracts the envelope `message` from an API error, with a fallback. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as Envelope<unknown> | undefined)?.message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
