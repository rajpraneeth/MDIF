import { Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useRequests } from "@/api/requests";
import { RequestStatusBadge } from "@/components/RequestStatusBadge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuthStore } from "@/stores/authStore";
import { DE_PLUS } from "@/types/auth";
import type { RequestStatus } from "@/types/requests";

const STATUSES: RequestStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "in_progress",
  "completed",
];

const PAGE_SIZE = 20;

export default function RequestsListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isDePlus = Boolean(user && DE_PLUS.includes(user.role));
  const [status, setStatus] = useState<RequestStatus | "">("");
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useRequests({ status, page, page_size: PAGE_SIZE });

  // Backend already scopes requesters to their own; the toggle is client-side for DE+.
  const items =
    mineOnly && user ? data?.items.filter((r) => r.requested_by === user.id) : data?.items;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
          <p className="text-sm text-muted-foreground">
            Ingestion requests{isDePlus ? " across the team" : " you created"}.
          </p>
        </div>
        <Button onClick={() => navigate("/requests/new")}>
          <Plus className="h-4 w-4" />
          New request
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select
          aria-label="Filter by status"
          className="w-48"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as RequestStatus | "");
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </Select>
        {isDePlus && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
            />
            My requests only
          </label>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading requests…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load requests. Try again.</p>
      ) : !items || items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No requests{status ? ` with status "${status.replace("_", " ")}"` : ""} yet.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/requests/new")}>
            Create your first request
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sources</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Requested by</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t transition-colors hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <Link to={`/requests/${r.id}`} className="font-medium hover:underline">
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <RequestStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">{r.source_objects.length}</td>
                  <td className="px-4 py-3 capitalize">{r.priority}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user && r.requested_by === user.id
                      ? "You"
                      : r.requested_by.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
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
