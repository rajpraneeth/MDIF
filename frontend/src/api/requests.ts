import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";

import { api, type Envelope, type Paginated } from "@/api/client";
import type { RequestCreate, RequestRead, RequestStatus } from "@/types/requests";

export interface RequestListParams {
  status?: RequestStatus | "";
  env_id?: string;
  page?: number;
  page_size?: number;
}

const keys = {
  list: (params: RequestListParams) => ["requests", "list", params] as const,
  detail: (id: string) => ["requests", "detail", id] as const,
};

export function useRequests(params: RequestListParams) {
  return useQuery({
    queryKey: keys.list(params),
    queryFn: async () => {
      const res = await api.get<Envelope<Paginated<RequestRead>>>("/requests", {
        params: {
          status: params.status || undefined,
          env_id: params.env_id || undefined,
          page: params.page,
          page_size: params.page_size,
        },
      });
      return res.data.data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get<Envelope<RequestRead>>(`/requests/${id}`);
      return res.data.data;
    },
  });
}

function useInvalidateRequests() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: ["requests", "list"] });
    if (id) void qc.invalidateQueries({ queryKey: keys.detail(id) });
  };
}

export function useCreateRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: async (body: RequestCreate) => {
      const res = await api.post<Envelope<RequestRead>>("/requests", body);
      return res.data.data;
    },
    onSuccess: () => invalidate(),
  });
}

export function useSubmitRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Envelope<RequestRead>>(`/requests/${id}/submit`);
      return res.data.data;
    },
    onSuccess: (req) => invalidate(req.id),
  });
}

export function useApproveRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Envelope<RequestRead>>(`/requests/${id}/approve`);
      return res.data.data;
    },
    onSuccess: (req) => invalidate(req.id),
  });
}

export function useRejectRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await api.post<Envelope<RequestRead>>(`/requests/${id}/reject`, {
        reason,
      });
      return res.data.data;
    },
    onSuccess: (req) => invalidate(req.id),
  });
}
