import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";

import { api, type Envelope, type Paginated } from "@/api/client";
import type { PromotionCreate, PromotionRead } from "@/types/promotions";

const keys = {
  list: (page: number) => ["promotions", "list", page] as const,
  detail: (id: string) => ["promotions", "detail", id] as const,
};

export function usePromotions(page: number, pageSize: number) {
  return useQuery({
    queryKey: keys.list(page),
    queryFn: async () => {
      const res = await api.get<Envelope<Paginated<PromotionRead>>>("/promotions", {
        params: { page, page_size: pageSize },
      });
      return res.data.data;
    },
    placeholderData: keepPreviousData,
  });
}

/** Polls while the promotion is executing so the wizard can track progress. */
export function usePromotion(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ""),
    enabled: Boolean(id),
    staleTime: 5_000,
    queryFn: async () => {
      const res = await api.get<Envelope<PromotionRead>>(`/promotions/${id}`);
      return res.data.data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "in_progress" ? 3_000 : false;
    },
  });
}

function useInvalidatePromotions() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: ["promotions", "list"] });
    if (id) void qc.invalidateQueries({ queryKey: keys.detail(id) });
  };
}

export function useCreatePromotion() {
  const invalidate = useInvalidatePromotions();
  return useMutation({
    mutationFn: async (body: PromotionCreate) => {
      const res = await api.post<Envelope<PromotionRead>>("/promotions", body);
      return res.data.data;
    },
    onSuccess: () => invalidate(),
  });
}

export function useExecutePromotion() {
  const invalidate = useInvalidatePromotions();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Envelope<PromotionRead>>(`/promotions/${id}/execute`);
      return res.data.data;
    },
    onSuccess: (p) => invalidate(p.id),
  });
}
