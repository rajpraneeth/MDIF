import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";

import { api, type Envelope, type Paginated } from "@/api/client";
import type {
  PipelineCreate,
  PipelineLiveStatus,
  PipelineRead,
  PipelineStatus,
  PipelineUpdate,
  RunLogEntry,
  RunRead,
  RunStatus,
} from "@/types/pipelines";

export interface PipelineListParams {
  env_id?: string;
  request_id?: string;
  status?: PipelineStatus | "";
  page?: number;
  page_size?: number;
}

export interface RunListParams {
  pipeline_id?: string;
  status?: RunStatus | "";
  page?: number;
  page_size?: number;
}

const keys = {
  list: (params: PipelineListParams) => ["pipelines", "list", params] as const,
  detail: (id: string) => ["pipelines", "detail", id] as const,
  status: (id: string) => ["pipelines", "status", id] as const,
  runs: (params: RunListParams) => ["runs", "list", params] as const,
  logs: (runId: string) => ["runs", "logs", runId] as const,
};

export function usePipelines(params: PipelineListParams) {
  return useQuery({
    queryKey: keys.list(params),
    queryFn: async () => {
      const res = await api.get<Envelope<Paginated<PipelineRead>>>("/pipelines", {
        params: {
          env_id: params.env_id || undefined,
          request_id: params.request_id || undefined,
          status: params.status || undefined,
          page: params.page,
          page_size: params.page_size,
        },
      });
      return res.data.data;
    },
    placeholderData: keepPreviousData,
  });
}

export function usePipeline(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get<Envelope<PipelineRead>>(`/pipelines/${id}`);
      return res.data.data;
    },
  });
}

/**
 * Live engine status. Polls every 15s (spec §7.2) while the latest run is
 * active; otherwise fetches once and stays cached for 5s (spec §7.3).
 */
export function usePipelineStatus(id: string | undefined) {
  return useQuery({
    queryKey: keys.status(id ?? ""),
    enabled: Boolean(id),
    staleTime: 5_000,
    queryFn: async () => {
      const res = await api.get<Envelope<PipelineLiveStatus>>(`/pipelines/${id}/status`);
      return res.data.data;
    },
    refetchInterval: (query) => {
      const run = query.state.data?.latest_run;
      return run && ["queued", "running"].includes(run.status) ? 15_000 : false;
    },
  });
}

export function useRuns(params: RunListParams, enabled = true) {
  return useQuery({
    queryKey: keys.runs(params),
    enabled,
    staleTime: 5_000,
    queryFn: async () => {
      const res = await api.get<Envelope<Paginated<RunRead>>>("/runs", {
        params: {
          pipeline_id: params.pipeline_id || undefined,
          status: params.status || undefined,
          page: params.page,
          page_size: params.page_size,
        },
      });
      return res.data.data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useRunLogs(runId: string | undefined) {
  return useQuery({
    queryKey: keys.logs(runId ?? ""),
    enabled: Boolean(runId),
    queryFn: async () => {
      const res = await api.get<Envelope<RunLogEntry[]>>(`/runs/${runId}/logs`);
      return res.data.data;
    },
  });
}

function useInvalidatePipeline() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: ["pipelines", "list"] });
    if (id) {
      void qc.invalidateQueries({ queryKey: keys.detail(id) });
      void qc.invalidateQueries({ queryKey: keys.status(id) });
      void qc.invalidateQueries({ queryKey: ["runs", "list"] });
    }
  };
}

export function useCreatePipeline() {
  const invalidate = useInvalidatePipeline();
  return useMutation({
    mutationFn: async (body: PipelineCreate) => {
      const res = await api.post<Envelope<PipelineRead>>("/pipelines", body);
      return res.data.data;
    },
    onSuccess: () => invalidate(),
  });
}

export function useUpdatePipeline() {
  const invalidate = useInvalidatePipeline();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: PipelineUpdate }) => {
      const res = await api.patch<Envelope<PipelineRead>>(`/pipelines/${id}`, body);
      return res.data.data;
    },
    onSuccess: (p) => invalidate(p.id),
  });
}

export function useDeletePipeline() {
  const invalidate = useInvalidatePipeline();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pipelines/${id}`);
      return id;
    },
    onSuccess: (id) => invalidate(id),
  });
}

export function useRunPipeline() {
  const invalidate = useInvalidatePipeline();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Envelope<RunRead>>(`/pipelines/${id}/run`);
      return res.data.data;
    },
    onSuccess: (run) => invalidate(run.pipeline_id),
  });
}

export function usePausePipeline() {
  const invalidate = useInvalidatePipeline();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Envelope<PipelineRead>>(`/pipelines/${id}/pause`);
      return res.data.data;
    },
    onSuccess: (p) => invalidate(p.id),
  });
}

export function useResumePipeline() {
  const invalidate = useInvalidatePipeline();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Envelope<PipelineRead>>(`/pipelines/${id}/resume`);
      return res.data.data;
    },
    onSuccess: (p) => invalidate(p.id),
  });
}

export function useCancelRun() {
  const invalidate = useInvalidatePipeline();
  return useMutation({
    mutationFn: async ({ runId }: { runId: string; pipelineId: string }) => {
      const res = await api.post<Envelope<RunRead>>(`/runs/${runId}/cancel`);
      return res.data.data;
    },
    onSuccess: (_run, vars) => invalidate(vars.pipelineId),
  });
}
