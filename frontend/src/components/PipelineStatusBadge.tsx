import { usePipelineStatus } from "@/api/pipelines";
import { cn } from "@/lib/utils";
import type { PipelineStatus, RunStatus } from "@/types/pipelines";

const PIPELINE_STYLES: Record<PipelineStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  deleted: "bg-red-100 text-red-700",
};

const RUN_STYLES: Record<RunStatus, string> = {
  queued: "bg-gray-100 text-gray-700",
  running: "bg-blue-100 text-blue-700",
  succeeded: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-amber-100 text-amber-700",
};

const badgeBase = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

export function PipelineStatusBadge({ status }: { status: PipelineStatus }) {
  return <span className={cn(badgeBase, PIPELINE_STYLES[status])}>{status}</span>;
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return (
    <span className={cn(badgeBase, RUN_STYLES[status])}>
      {status === "running" && (
        <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />
      )}
      {status}
    </span>
  );
}

/**
 * Live badge for the detail page — GET /pipelines/{id}/status, polling every
 * 15s while a run is active (spec §7.2). Shows pipeline status plus the
 * latest run's status when one exists.
 */
export function LivePipelineStatusBadge({
  pipelineId,
  fallback,
}: {
  pipelineId: string;
  fallback: PipelineStatus;
}) {
  const { data } = usePipelineStatus(pipelineId);
  const status = data?.status ?? fallback;

  return (
    <span className="inline-flex items-center gap-2">
      <PipelineStatusBadge status={status} />
      {data?.latest_run && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          latest run: <RunStatusBadge status={data.latest_run.status} />
        </span>
      )}
    </span>
  );
}
