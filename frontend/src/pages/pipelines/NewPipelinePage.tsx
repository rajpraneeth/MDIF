import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { apiErrorMessage } from "@/api/client";
import { useEnvironments } from "@/api/connections";
import { useCreatePipeline } from "@/api/pipelines";
import { useRequest, useRequests } from "@/api/requests";
import {
  EngineConfigFields,
  draftToConfig,
  emptyDraft,
  type ConfigDraft,
} from "@/components/EngineConfigForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ENGINES, ENGINE_LABELS, type Engine } from "@/types/pipelines";

const baseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  env_id: z.string().min(1, "Environment is required"),
  description: z.string().max(2000).optional(),
});

export default function NewPipelinePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createPipeline = useCreatePipeline();
  const environments = useEnvironments();
  // Pipelines may only link to approved requests (GLD-7 contract).
  const approvedRequests = useRequests({ status: "approved", page_size: 100 });

  const [requestId, setRequestId] = useState(searchParams.get("request_id") ?? "");
  const linkedRequest = useRequest(requestId || undefined);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [envId, setEnvId] = useState("");
  const [engine, setEngine] = useState<Engine>("adf");
  // One draft per engine so switching tabs doesn't wipe entered values.
  const [drafts, setDrafts] = useState<Record<Engine, ConfigDraft>>(() => ({
    adf: emptyDraft("adf"),
    databricks: emptyDraft("databricks"),
    python_script: emptyDraft("python_script"),
    pyspark_script: emptyDraft("pyspark_script"),
  }));
  const [errors, setErrors] = useState<string[]>([]);

  // A linked request pins the environment; otherwise the user picks one.
  const effectiveEnvId = requestId ? (linkedRequest.data?.env_id ?? "") : envId;
  const envName = (id: string) =>
    environments.data?.items.find((e) => e.id === id)?.name ?? id.slice(0, 8);

  async function handleCreate() {
    const base = baseSchema.safeParse({ name, env_id: effectiveEnvId, description });
    const { config, errors: configErrors } = draftToConfig(engine, drafts[engine]);
    const allErrors = [
      ...(base.success ? [] : base.error.issues.map((i) => i.message)),
      ...configErrors,
    ];
    setErrors(allErrors);
    if (allErrors.length > 0) return;

    try {
      const created = await createPipeline.mutateAsync({
        name: name.trim(),
        engine,
        env_id: effectiveEnvId,
        description: description.trim() || undefined,
        request_id: requestId || undefined,
        engine_config: config,
      });
      navigate(`/pipelines/${created.id}`);
    } catch (e) {
      setErrors([apiErrorMessage(e, "Failed to create pipeline.")]);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/pipelines"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Pipelines
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Link an approved ingestion request and configure the execution engine.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {approvedRequests.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading approved requests…</p>
          ) : approvedRequests.isError ? (
            <p className="text-sm text-destructive">Failed to load requests.</p>
          ) : (
            <Select
              aria-label="Linked request"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
            >
              <option value="">No linked request</option>
              {approvedRequests.data?.items.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </Select>
          )}

          {requestId &&
            (linkedRequest.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading request…</p>
            ) : linkedRequest.isError || !linkedRequest.data ? (
              <p className="text-sm text-destructive">
                Couldn&apos;t load the linked request. Pick another or continue without one.
              </p>
            ) : (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                <p>
                  <Link
                    to={`/requests/${linkedRequest.data.id}`}
                    className="font-medium hover:underline"
                  >
                    {linkedRequest.data.title}
                  </Link>{" "}
                  <span className="text-muted-foreground">
                    · {envName(linkedRequest.data.env_id)} · {linkedRequest.data.ingestion_mode}{" "}
                    mode
                  </span>
                </p>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Source objects ({linkedRequest.data.source_objects.length})
                </p>
                {linkedRequest.data.source_objects.length === 0 ? (
                  <p className="text-muted-foreground">No source objects on this request.</p>
                ) : (
                  <ul className="divide-y">
                    {linkedRequest.data.source_objects.map((s) => (
                      <li key={s.schema_object_id} className="flex flex-wrap gap-x-4 py-1.5">
                        <span className="font-mono text-xs">
                          {s.schema_object_id.slice(0, 8)}
                        </span>
                        <span>
                          {s.alias || <span className="text-muted-foreground">no alias</span>}
                        </span>
                        <span className="text-muted-foreground">
                          watermark: {s.filter_config?.watermark_column || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pipeline-name">Name</Label>
            <Input
              id="pipeline-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="orders-daily-ingest"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pipeline-env">Environment</Label>
            {requestId ? (
              <p className="text-sm">
                {linkedRequest.data ? envName(linkedRequest.data.env_id) : "—"}{" "}
                <span className="text-xs text-muted-foreground">(from linked request)</span>
              </p>
            ) : environments.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading environments…</p>
            ) : environments.isError ? (
              <p className="text-sm text-destructive">Failed to load environments.</p>
            ) : (
              <Select
                id="pipeline-env"
                value={envId}
                onChange={(e) => setEnvId(e.target.value)}
              >
                <option value="">Select environment</option>
                {environments.data?.items.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pipeline-description">Description</Label>
            <Textarea
              id="pipeline-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this pipeline ingests and when."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Engine</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist">
            {ENGINES.map((e) => (
              <button
                key={e}
                type="button"
                role="tab"
                aria-selected={engine === e}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  engine === e
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setEngine(e)}
              >
                {ENGINE_LABELS[e]}
              </button>
            ))}
          </div>
          <EngineConfigFields
            engine={engine}
            draft={drafts[engine]}
            onChange={(d) => setDrafts((prev) => ({ ...prev, [engine]: d }))}
          />
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm font-medium text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/pipelines")}>
          Cancel
        </Button>
        <Button disabled={createPipeline.isPending} onClick={handleCreate}>
          {createPipeline.isPending ? "Creating…" : "Create pipeline"}
        </Button>
      </div>
    </div>
  );
}
