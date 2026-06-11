import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Envelope, type Paginated } from "@/api/client";
import type {
  ConnectionRead,
  EnvironmentCreate,
  EnvironmentRead,
  SchemaObjectTree,
} from "@/types/connections";

export function useConnections(envId?: string) {
  return useQuery({
    queryKey: ["connections", "list", envId ?? ""],
    queryFn: async () => {
      const res = await api.get<Envelope<Paginated<ConnectionRead>>>("/connections", {
        params: { env_id: envId || undefined, page_size: 100 },
      });
      return res.data.data;
    },
  });
}

export function useConnectionObjects(connectionId: string | undefined) {
  return useQuery({
    queryKey: ["connections", "objects", connectionId ?? ""],
    enabled: Boolean(connectionId),
    queryFn: async () => {
      const res = await api.get<Envelope<SchemaObjectTree>>(
        `/connections/${connectionId}/objects`,
      );
      return res.data.data;
    },
  });
}

export function useEnvironments() {
  return useQuery({
    queryKey: ["environments", "list"],
    queryFn: async () => {
      const res = await api.get<Envelope<Paginated<EnvironmentRead>>>("/environments", {
        params: { page_size: 100 },
      });
      return res.data.data;
    },
  });
}

export function useCreateEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: EnvironmentCreate) => {
      const res = await api.post<Envelope<EnvironmentRead>>("/environments", body);
      return res.data.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["environments", "list"] }),
  });
}
