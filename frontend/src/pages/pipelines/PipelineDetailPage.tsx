import { ArrowLeft, Pause, Pencil, Play, RotateCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { apiErrorMessage } from "@/api/client";
import {
  useDeletePipeline,
  usePausePipeline,
  usePipeline,
  useResumePipeline,
  useRunPipeline,
  useUpdatePipeline,
} from "@/api/pipelines";
import {
  EngineConfigFields,
  configToDraft,
  draftToConfig,
  type ConfigDraft,
} from "@/components/EngineConfigForm";
import { LivePipelineStatusBadge } from "@/components/PipelineStatusBadge";
import { RunHistoryTable } from "@/components/RunHistoryTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ENGINE_LABELS, type PipelineRead } from "@/types/pipelines";

/** Read-only engine_config rendering — raw values, monospace for objects. */
function ConfigReadout({ pipeline }: { pipeline: PipelineRead }) {
  const entries = Object.entries(pipeline.engine_config ?? {});
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No engine configuration set.</p>;
  }
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {entries.map(([key, value]) => {
        const isObject = typeof value === "object" && value !== null;
        return (
          <div key={key} className={isObject ? "sm:col-span-2" : undefined}>
            <dt className="text-muted-foreground">{key}</dt>
            <dd>
              {isObject ? (
                <pre className="mt-1 overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-xs">
                  {JSON.stringify(value, null, 2)}
                </pre>
              ) : (
                String(value) || "—"
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function ConfigPanel({ pipeline }: { pipeline: PipelineRead }) {
  const updatePipeline = useUpdatePipeline();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ConfigDraft>({});
  const [errors, setErrors] = useState<string[]>([]);

  function startEdit() {
    setDraft(configToDraft(pipeline.engine, pipeline.engine_config ?? {}));
    setErrors([]);
    setEditing(true);
  }

  async function save() {
    const { config, errors: configErrors } = draftToConfig(pipeline.engine, draft);
    setErrors(configErrors);
    if (configErrors.length > 0) return;
    try {
      await updatePipeline.mutateAsync({ id: pipeline.id, body: { engine_config: config } });
      setEditing(false);
    } catch (e) {
      setErrors([apiErrorMessage(e, "Failed to update configuration.")]);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Engine configuration</CardTitle>
          {!editing && pipeline.status !== "deleted" && (
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <>
            <EngineConfigFields
              engine={pipeline.engine}
              draft={draft}
              onChange={setDraft}
              disabled={updatePipeline.isPending}
            />
            {errors.length > 0 && (
              <ul role="alert" className="space-y-1 text-sm font-medium text-destructive">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={updatePipeline.isPending}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button size="sm" disabled={updatePipeline.isPending} onClick={save}>
                {updatePipeline.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </>
        ) : (
          <ConfigReadout pipeline={pipeline} />
        )}
      </CardContent>
    </Card>
  );
}

export default function PipelineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: pipeline, isLoading, isError, error } = usePipeline(id);
  const runPipeline = useRunPipeline();
  const pausePipeline = usePausePipeline();
  const resumePipeline = useResumePipeline();
  const deletePipeline = useDeletePipeline();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading pipeline…</p>;
  if (isError || !pipeline) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          {apiErrorMessage(error, "Pipeline not found or you don't have access to it.")}
        </p>
        <Button variant="outline" onClick={() => navigate("/pipelines")}>
          <ArrowLeft className="h-4 w-4" /> Back to pipelines
        </Button>
      </div>
    );
  }

  const anyPending =
    runPipeline.isPending ||
    pausePipeline.isPending ||
    resumePipeline.isPending ||
    deletePipeline.isPending;
  const isDeleted = pipeline.status === "deleted";

  async function run(action: () => Promise<unknown>, fallback: string) {
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError(apiErrorMessage(e, fallback));
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/pipelines"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Pipelines
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{pipeline.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <LivePipelineStatusBadge pipelineId={pipeline.id} fallback={pipeline.status} />
            <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium">
              {ENGINE_LABELS[pipeline.engine]}
            </span>
            {pipeline.request_id && (
              <Link
                to={`/requests/${pipeline.request_id}`}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Linked request {pipeline.request_id.slice(0, 8)}
              </Link>
            )}
          </div>
        </div>

        {/* Action bar — status-aware disabled states per Prompt 11. */}
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            disabled={anyPending || isDeleted || pipeline.status === "paused"}
            onClick={() => run(() => runPipeline.mutateAsync(pipeline.id), "Run failed.")}
          >
            <Play className="h-4 w-4" />
            {runPipeline.isPending ? "Triggering…" : "Run"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={anyPending || pipeline.status !== "active"}
            onClick={() => run(() => pausePipeline.mutateAsync(pipeline.id), "Pause failed.")}
          >
            <Pause className="h-4 w-4" /> Pause
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={anyPending || pipeline.status !== "paused"}
            onClick={() => run(() => resumePipeline.mutateAsync(pipeline.id), "Resume failed.")}
          >
            <RotateCw className="h-4 w-4" /> Resume
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={anyPending || isDeleted}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {actionError}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Description</p>
            <p>{pipeline.description || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Created</p>
            <p>{new Date(pipeline.created_at).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Last updated</p>
            <p>{new Date(pipeline.updated_at).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Created by</p>
            <p className="font-mono text-xs">{pipeline.created_by.slice(0, 8)}</p>
          </div>
        </CardContent>
      </Card>

      <ConfigPanel pipeline={pipeline} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run history</CardTitle>
        </CardHeader>
        <CardContent>
          <RunHistoryTable pipelineId={pipeline.id} />
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Delete pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Soft-deletes “{pipeline.name}”. Run history is kept, but the pipeline can no longer
            be triggered.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deletePipeline.isPending}
              onClick={() =>
                run(async () => {
                  await deletePipeline.mutateAsync(pipeline.id);
                  setDeleteOpen(false);
                  navigate("/pipelines");
                }, "Delete failed.")
              }
            >
              {deletePipeline.isPending ? "Deleting…" : "Delete pipeline"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
