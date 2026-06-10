import { QueryClient } from "@tanstack/react-query";

/** Shared React Query client. Default 30s stale time per spec §7.3. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
