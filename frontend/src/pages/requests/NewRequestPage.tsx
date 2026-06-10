import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { apiErrorMessage } from "@/api/client";
import { useEnvironments } from "@/api/connections";
import { useCreateRequest, useSubmitRequest } from "@/api/requests";
import { SourceObjectPicker, type PickedObject } from "@/components/SourceObjectPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { IngestionMode, RequestPriority } from "@/types/requests";

const STEPS = ["Request info", "Source objects", "Target config", "Review & submit"];

const stepOneSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  env_id: z.string().min(1, "Environment is required"),
  description: z.string().max(2000).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  ingestion_mode: z.enum(["full", "incremental", "cdc"]),
  schedule_cron: z
    .string()
    .trim()
    .max(120)
    .refine((v) => !v || v.split(/\s+/).length >= 5, "Cron needs at least 5 fields")
    .optional(),
  tags: z.string().optional(),
});

const stepTwoSchema = z
  .array(z.object({ schema_object_id: z.string().min(1) }))
  .min(1, "Select at least one source object");

const stepThreeSchema = z.object({
  target_connection_id: z.string().optional(),
  target_schema: z.string().trim().max(255).optional(),
  target_table_pattern: z.string().trim().max(255).optional(),
});

export default function NewRequestPage() {
  const navigate = useNavigate();
  const environments = useEnvironments();
  const createRequest = useCreateRequest();
  const submitRequest = useSubmitRequest();

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [info, setInfo] = useState({
    title: "",
    env_id: "",
    description: "",
    priority: "medium" as RequestPriority,
    ingestion_mode: "full" as IngestionMode,
    schedule_cron: "",
    tags: "",
  });
  const [picked, setPicked] = useState<PickedObject[]>([]);
  const [target, setTarget] = useState({
    target_connection_id: "",
    target_schema: "",
    target_table_pattern: "",
  });

  const pending = createRequest.isPending || submitRequest.isPending;

  function validateStep(idx: number): boolean {
    setErrors([]);
    const result =
      idx === 0
        ? stepOneSchema.safeParse(info)
        : idx === 1
          ? stepTwoSchema.safeParse(picked)
          : idx === 2
            ? stepThreeSchema.safeParse(target)
            : { success: true as const, error: undefined };
    if (!result.success && result.error) {
      setErrors(result.error.issues.map((i) => i.message));
      return false;
    }
    return true;
  }

  function next() {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function handleSubmit(asDraft: boolean) {
    setSubmitError(null);
    try {
      const created = await createRequest.mutateAsync({
        title: info.title.trim(),
        env_id: info.env_id,
        description: info.description.trim() || undefined,
        priority: info.priority,
        ingestion_mode: info.ingestion_mode,
        schedule_cron: info.schedule_cron.trim() || undefined,
        tags: info.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        source_objects: picked.map(({ schema_object_id, alias, filter_config }) => ({
          schema_object_id,
          alias,
          filter_config,
        })),
        target_connection_id: target.target_connection_id || undefined,
        target_schema: target.target_schema.trim() || undefined,
        target_table_pattern: target.target_table_pattern.trim() || undefined,
      });
      if (!asDraft) await submitRequest.mutateAsync(created.id);
      navigate(`/requests/${created.id}`);
    } catch (e) {
      setSubmitError(apiErrorMessage(e, "Failed to create the request."));
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New ingestion request</h1>
        <p className="text-sm text-muted-foreground">
          Four steps: info, source objects, target, review.
        </p>
      </div>

      <ol className="flex flex-wrap items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-6 bg-border" />}
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-secondary text-secondary-foreground"
                    : "border text-muted-foreground",
              )}
            >
              {i < step && <Check className="h-3 w-3" />}
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm font-medium text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nr-title">Title *</Label>
                <Input
                  id="nr-title"
                  value={info.title}
                  onChange={(e) => setInfo({ ...info, title: e.target.value })}
                  placeholder="Ingest orders from SQL Server"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nr-env">Environment *</Label>
                {environments.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading environments…</p>
                ) : environments.isError ? (
                  <p className="text-sm text-destructive">Failed to load environments.</p>
                ) : (
                  <Select
                    id="nr-env"
                    value={info.env_id}
                    onChange={(e) => setInfo({ ...info, env_id: e.target.value })}
                  >
                    <option value="">Select environment…</option>
                    {environments.data?.items.map((env) => (
                      <option key={env.id} value={env.id}>
                        {env.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nr-desc">Description</Label>
                <Textarea
                  id="nr-desc"
                  value={info.description}
                  onChange={(e) => setInfo({ ...info, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nr-priority">Priority</Label>
                  <Select
                    id="nr-priority"
                    value={info.priority}
                    onChange={(e) =>
                      setInfo({ ...info, priority: e.target.value as RequestPriority })
                    }
                  >
                    {(["low", "medium", "high", "critical"] as const).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nr-mode">Ingestion mode</Label>
                  <Select
                    id="nr-mode"
                    value={info.ingestion_mode}
                    onChange={(e) =>
                      setInfo({ ...info, ingestion_mode: e.target.value as IngestionMode })
                    }
                  >
                    {(["full", "incremental", "cdc"] as const).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nr-cron">Schedule (cron)</Label>
                  <Input
                    id="nr-cron"
                    value={info.schedule_cron}
                    onChange={(e) => setInfo({ ...info, schedule_cron: e.target.value })}
                    placeholder="0 2 * * *"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nr-tags">Tags (comma-separated)</Label>
                  <Input
                    id="nr-tags"
                    value={info.tags}
                    onChange={(e) => setInfo({ ...info, tags: e.target.value })}
                    placeholder="sales, daily"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 &&
            (info.env_id ? (
              <SourceObjectPicker envId={info.env_id} value={picked} onChange={setPicked} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Pick an environment in step 1 first.
              </p>
            ))}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nr-target-schema">Target schema</Label>
                <Input
                  id="nr-target-schema"
                  value={target.target_schema}
                  onChange={(e) => setTarget({ ...target, target_schema: e.target.value })}
                  placeholder="staging"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nr-target-pattern">Target table pattern</Label>
                <Input
                  id="nr-target-pattern"
                  value={target.target_table_pattern}
                  onChange={(e) =>
                    setTarget({ ...target, target_table_pattern: e.target.value })
                  }
                  placeholder="raw_{source_table}"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <p className="text-muted-foreground">Title</p>
                <p>{info.title}</p>
                <p className="text-muted-foreground">Environment</p>
                <p>
                  {environments.data?.items.find((e) => e.id === info.env_id)?.name ??
                    info.env_id}
                </p>
                <p className="text-muted-foreground">Priority / mode</p>
                <p>
                  {info.priority} · {info.ingestion_mode}
                </p>
                <p className="text-muted-foreground">Schedule</p>
                <p>{info.schedule_cron || "—"}</p>
                <p className="text-muted-foreground">Target</p>
                <p>
                  {target.target_schema || target.target_table_pattern
                    ? `${target.target_schema}${target.target_schema && "."}${target.target_table_pattern}`
                    : "—"}
                </p>
                <p className="text-muted-foreground">Tags</p>
                <p>{info.tags || "—"}</p>
              </div>
              <div>
                <p className="mb-1 text-muted-foreground">
                  Source objects ({picked.length})
                </p>
                <ul className="list-inside list-disc">
                  {picked.map((p) => (
                    <li key={p.schema_object_id}>
                      {p.alias || p.object_name}
                      <span className="text-muted-foreground">
                        {" "}
                        · {p.connection_name}
                        {p.filter_config?.watermark_column &&
                          ` · watermark: ${p.filter_config.watermark_column}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {submitError && (
                <p role="alert" className="font-medium text-destructive">
                  {submitError}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={step === 0 || pending}
          onClick={() => setStep((s) => s - 1)}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => void handleSubmit(true)}
            >
              Save as draft
            </Button>
            <Button disabled={pending} onClick={() => void handleSubmit(false)}>
              {pending ? "Submitting…" : "Create & submit"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
