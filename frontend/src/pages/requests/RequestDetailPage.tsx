import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronDown, ChevronRight, GitBranch, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, apiErrorMessage, type Envelope, type Paginated } from "@/api/client";
import { useApproveRequest, useRejectRequest, useRequest, useSubmitRequest } from "@/api/requests";
import { RequestStatusBadge } from "@/components/RequestStatusBadge";
import { RoleGuard } from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/stores/authStore";
import { ARCHITECT_PLUS, DE_PLUS } from "@/types/auth";
import type { RequestRead, RequestStatus } from "@/types/requests";

interface PipelineSummary {
  id: string;
  name: string;
  engine: string;
  status: string;
}

function useLinkedPipelines(requestId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["pipelines", "byRequest", requestId ?? ""],
    enabled: Boolean(requestId) && enabled,
    queryFn: async () => {
      const res = await api.get<Envelope<Paginated<PipelineSummary>>>("/pipelines", {
        params: { request_id: requestId, page_size: 50 },
      });
      return res.data.data;
    },
  });
}

// Lifecycle order for the timeline; rejected replaces the tail when present.
const TIMELINE: RequestStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "in_progress",
  "completed",
];

function StatusTimeline({ request }: { request: RequestRead }) {
  const isRejected = request.status === "rejected";
  const steps: RequestStatus[] = isRejected
    ? ["draft", "submitted", "under_review", "rejected"]
    : TIMELINE;
  const currentIdx = steps.indexOf(request.status);

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          {i > 0 && <span className="h-px w-6 bg-border" />}
          <span
            className={
              i <= currentIdx
                ? s === "rejected"
                  ? "rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
                  : "rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                : "rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground"
            }
          >
            {s.replace("_", " ")}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isDePlus = Boolean(user && DE_PLUS.includes(user.role));

  const { data: request, isLoading, isError, error } = useRequest(id);
  const pipelines = useLinkedPipelines(id, isDePlus);

  const submit = useSubmitRequest();
  const approve = useApproveRequest();
  const reject = useRejectRequest();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(true);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading request…</p>;
  if (isError || !request) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          {apiErrorMessage(error, "Request not found or you don't have access to it.")}
        </p>
        <Button variant="outline" onClick={() => navigate("/requests")}>
          <ArrowLeft className="h-4 w-4" /> Back to requests
        </Button>
      </div>
    );
  }

  const isOwner = user?.id === request.requested_by;
  const canApprove = ["submitted", "under_review"].includes(request.status);

  async function run(action: () => Promise<unknown>, fallback: string) {
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError(apiErrorMessage(e, fallback));
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/requests"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Requests
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{request.title}</h1>
          <div className="flex items-center gap-2">
            <RequestStatusBadge status={request.status} />
            <span className="text-xs capitalize text-muted-foreground">
              {request.priority} priority · {request.ingestion_mode} mode
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {request.status === "draft" && isOwner && (
            <Button
              size="sm"
              disabled={submit.isPending || request.source_objects.length === 0}
              onClick={() => run(() => submit.mutateAsync(request.id), "Submit failed.")}
            >
              {submit.isPending ? "Submitting…" : "Submit"}
            </Button>
          )}
          {canApprove && (
            <RoleGuard roles={ARCHITECT_PLUS}>
              <Button
                size="sm"
                disabled={approve.isPending}
                onClick={() => run(() => approve.mutateAsync(request.id), "Approve failed.")}
              >
                <Check className="h-4 w-4" />
                {approve.isPending ? "Approving…" : "Approve"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setRejectOpen(true)}
              >
                <X className="h-4 w-4" /> Reject
              </Button>
            </RoleGuard>
          )}
          {request.status === "approved" && (
            <RoleGuard roles={DE_PLUS}>
              <Button
                size="sm"
                onClick={() => navigate(`/pipelines/new?request_id=${request.id}`)}
              >
                <GitBranch className="h-4 w-4" /> Create pipeline
              </Button>
            </RoleGuard>
          )}
        </div>
      </div>

      {actionError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {actionError}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatusTimeline request={request} />
          {request.rejection_reason && (
            <p className="text-sm text-destructive">
              Rejection reason: {request.rejection_reason}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Description</p>
            <p>{request.description || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Schedule</p>
            <p>{request.schedule_cron || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Target</p>
            <p>
              {request.target_schema || request.target_table_pattern
                ? `${request.target_schema ?? ""}${request.target_schema ? "." : ""}${request.target_table_pattern ?? ""}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Tags</p>
            <p>{request.tags.length ? request.tags.join(", ") : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Created</p>
            <p>{new Date(request.created_at).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Requested by</p>
            <p>{isOwner ? "You" : request.requested_by.slice(0, 8)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setSourcesOpen((o) => !o)}
          >
            <CardTitle className="text-base">
              Source objects ({request.source_objects.length})
            </CardTitle>
            {sourcesOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </CardHeader>
        {sourcesOpen && (
          <CardContent>
            {request.source_objects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No source objects.</p>
            ) : (
              <ul className="divide-y text-sm">
                {request.source_objects.map((s) => (
                  <li key={s.schema_object_id} className="flex flex-wrap gap-x-6 py-2">
                    <span className="font-mono text-xs">{s.schema_object_id.slice(0, 8)}</span>
                    <span>{s.alias || <span className="text-muted-foreground">no alias</span>}</span>
                    <span className="text-muted-foreground">
                      watermark: {s.filter_config?.watermark_column || "—"}
                    </span>
                    <span className="text-muted-foreground">
                      filter: {s.filter_config?.filter_expr || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        )}
      </Card>

      {isDePlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked pipelines</CardTitle>
          </CardHeader>
          <CardContent>
            {pipelines.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading pipelines…</p>
            ) : pipelines.isError ? (
              <p className="text-sm text-destructive">Failed to load pipelines.</p>
            ) : !pipelines.data || pipelines.data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pipelines linked yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {pipelines.data.items.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <Link to={`/pipelines/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {p.engine} · {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Reject request</h2>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this request being rejected?"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || reject.isPending}
              onClick={() =>
                run(async () => {
                  await reject.mutateAsync({ id: request.id, reason: reason.trim() });
                  setRejectOpen(false);
                  setReason("");
                }, "Reject failed.")
              }
            >
              {reject.isPending ? "Rejecting…" : "Reject request"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
