import { Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { usePipelines } from "@/api/pipelines";
import { PipelineStatusBadge } from "@/components/PipelineStatusBadge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ENGINE_LABELS, type PipelineStatus } from "@/types/pipelines";

const STATUSES: PipelineStatus[] = ["draft", "active", "paused", "deleted"];
const PAGE_SIZE = 20;

export default function PipelinesListPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<PipelineStatus | "">("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = usePipelines({ status, page, page_size: PAGE_SIZE });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipelines</h1>
          <p className="text-sm text-muted-foreground">
            Ingestion pipelines and their run status.
          </p>
        </div>
        <Button onClick={() => navigate("/pipelines/new")}>
          <Plus className="h-4 w-4" />
          New pipeline
        </Button>
      </div>

      <Select
        aria-label="Filter by status"
        className="w-48"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value as PipelineStatus | "");
          setPage(1);
        }}
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading pipelines…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load pipelines. Try again.</p>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No pipelines{status ? ` with status "${status}"` : ""} yet.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/pipelines/new")}>
            Create your first pipeline
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Engine</th>
                <th className="px-4 py-3 font-medium">Linked request</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className="border-t transition-colors hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <Link to={`/pipelines/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <PipelineStatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3">{ENGINE_LABELS[p.engine]}</td>
                  <td className="px-4 py-3">
                    {p.request_id ? (
                      <Link
                        to={`/requests/${p.request_id}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {p.request_id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
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
