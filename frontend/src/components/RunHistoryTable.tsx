import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";

import { apiErrorMessage } from "@/api/client";
import { useCancelRun, useRunLogs, useRuns } from "@/api/pipelines";
import { RunStatusBadge } from "@/components/PipelineStatusBadge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { RunRead, RunStatus } from "@/types/pipelines";

const RUN_STATUSES: RunStatus[] = ["queued", "running", "succeeded", "failed", "cancelled"];
const PAGE_SIZE = 10;

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatCount(n: number | null): string {
  return n == null ? "—" : n.toLocaleString();
}

/** Expanded row body — fetches GET /runs/{id}/logs lazily on expand. */
function RunLogs({ run }: { run: RunRead }) {
  const { data: logs, isLoading, isError } = useRunLogs(run.id);

  return (
    <div className="space-y-2 bg-muted/30 px-4 py-3">
      {run.error_message && (
        <p className="text-sm font-medium text-destructive">Error: {run.error_message}</p>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading logs…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load logs.</p>
      ) : !logs || logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No log output for this run.</p>
      ) : (
        <pre className="max-h-72 overflow-auto rounded-md border bg-background p-3 font-mono text-xs leading-5">
          {logs.map((l, i) => (
            <div key={i}>
              <span className="text-muted-foreground">{l.timestamp}</span>{" "}
              <span
                className={
                  l.level.toLowerCase() === "error"
                    ? "font-semibold text-red-600"
                    : l.level.toLowerCase() === "warning"
                      ? "font-semibold text-amber-600"
                      : "text-muted-foreground"
                }
              >
                [{l.level.toUpperCase()}]
              </span>{" "}
              {l.message}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}

export function RunHistoryTable({ pipelineId }: { pipelineId: string }) {
  const [status, setStatus] = useState<RunStatus | "">("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError } = useRuns({
    pipeline_id: pipelineId,
    status,
    page,
    page_size: PAGE_SIZE,
  });
  const cancelRun = useCancelRun();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Select
          aria-label="Filter runs by status"
          className="w-44"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as RunStatus | "");
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {RUN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        {data && (
          <span className="text-xs text-muted-foreground">{data.total} run(s)</span>
        )}
      </div>

      {actionError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {actionError}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading runs…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load run history.</p>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No runs{status ? ` with status "${status}"` : " yet"}. Trigger one with Run.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-8 px-2 py-3" />
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Rows</th>
                <th className="px-4 py-3 font-medium">Bytes</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((run) => {
                const expanded = expandedId === run.id;
                const cancellable = ["queued", "running"].includes(run.status);
                return (
                  <Fragment key={run.id}>
                    <tr
                      className="cursor-pointer border-t transition-colors hover:bg-accent/50"
                      onClick={() => setExpandedId(expanded ? null : run.id)}
                    >
                      <td className="px-2 py-3 text-muted-foreground">
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <RunStatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {run.started_at ? new Date(run.started_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3">{formatDuration(run.duration_seconds)}</td>
                      <td className="px-4 py-3">{formatCount(run.rows_processed)}</td>
                      <td className="px-4 py-3">{formatCount(run.bytes_processed)}</td>
                      <td className="px-4 py-3 text-right">
                        {cancellable && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={cancelRun.isPending}
                            onClick={async (e) => {
                              e.stopPropagation();
                              setActionError(null);
                              try {
                                await cancelRun.mutateAsync({ runId: run.id, pipelineId });
                              } catch (err) {
                                setActionError(apiErrorMessage(err, "Cancel failed."));
                              }
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-t">
                        <td colSpan={7} className="p-0">
                          <RunLogs run={run} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
