import { AlertTriangle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useState } from "react";

import { apiErrorMessage } from "@/api/client";
import { useEnvironments } from "@/api/connections";
import { usePipelines } from "@/api/pipelines";
import { useCreatePromotion, useExecutePromotion, usePromotion } from "@/api/promotions";
import { useRequests } from "@/api/requests";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STEPS = ["Source env", "Requests", "Pipelines", "Target env", "Preview & execute"];

function SelectableTable<T extends { id: string }>({
  items,
  columns,
  selected,
  onToggle,
  emptyText,
}: {
  items: T[];
  columns: { header: string; cell: (item: T) => React.ReactNode }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  emptyText: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="w-10 px-3 py-2" />
            {columns.map((c) => (
              <th key={c.header} className="px-3 py-2 font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="cursor-pointer border-t transition-colors hover:bg-accent/50"
              onClick={() => onToggle(item.id)}
            >
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={selected.has(item.id)}
                  onChange={() => onToggle(item.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </td>
              {columns.map((c) => (
                <td key={c.header} className="px-3 py-2">
                  {c.cell(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PromotionWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const environments = useEnvironments();
  const createPromotion = useCreatePromotion();
  const executePromotion = useExecutePromotion();

  const [step, setStep] = useState(0);
  const [sourceEnvId, setSourceEnvId] = useState("");
  const [targetEnvId, setTargetEnvId] = useState("");
  const [requestIds, setRequestIds] = useState<Set<string>>(new Set());
  const [pipelineIds, setPipelineIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // Set once Execute fires; the detail poll drives the progress indicator.
  const [executedId, setExecutedId] = useState<string | null>(null);
  const executed = usePromotion(executedId ?? undefined);

  const requests = useRequests({ env_id: sourceEnvId, page_size: 100 });
  const pipelines = usePipelines({ env_id: sourceEnvId, page_size: 100 });

  const envName = (id: string) =>
    environments.data?.items.find((e) => e.id === id)?.name ?? id.slice(0, 8);

  function toggle(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  function reset() {
    setStep(0);
    setSourceEnvId("");
    setTargetEnvId("");
    setRequestIds(new Set());
    setPipelineIds(new Set());
    setError(null);
    setExecutedId(null);
  }

  function close() {
    // Don't lose the progress view mid-execution by accident.
    if (executedId && executed.data?.status === "in_progress") return;
    reset();
    onClose();
  }

  function next() {
    setError(null);
    if (step === 0 && !sourceEnvId) return setError("Pick a source environment.");
    if (step === 2 && requestIds.size === 0 && pipelineIds.size === 0)
      return setError("Select at least one request or pipeline to promote.");
    if (step === 3) {
      if (!targetEnvId) return setError("Pick a target environment.");
      if (targetEnvId === sourceEnvId)
        return setError("Target environment must differ from the source.");
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function handleExecute() {
    setError(null);
    try {
      const created = await createPromotion.mutateAsync({
        source_env_id: sourceEnvId,
        target_env_id: targetEnvId,
        request_ids: [...requestIds],
        pipeline_ids: [...pipelineIds],
      });
      await executePromotion.mutateAsync(created.id);
      setExecutedId(created.id);
    } catch (e) {
      setError(apiErrorMessage(e, "Promotion failed."));
    }
  }

  const executing = createPromotion.isPending || executePromotion.isPending;
  const finalStatus = executed.data?.status;

  return (
    <Dialog open={open} onClose={close} className="max-w-2xl">
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Promote to environment</h2>
          <p className="text-sm text-muted-foreground">
            Snapshot requests and pipelines from one environment into another.
          </p>
        </div>

        <ol className="flex flex-wrap items-center gap-2 text-xs">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-4 bg-border" />}
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 font-medium",
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : i < step
                      ? "bg-secondary text-secondary-foreground"
                      : "border text-muted-foreground",
                )}
              >
                {i + 1}. {label}
              </span>
            </li>
          ))}
        </ol>

        {executedId ? (
          /* Post-execute progress / result view. */
          <div className="space-y-3">
            {executed.isLoading || !executed.data ? (
              <p className="text-sm text-muted-foreground">Loading promotion status…</p>
            ) : finalStatus === "completed" ? (
              <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                <Check className="h-4 w-4" /> Promotion completed —{" "}
                {executed.data.request_ids.length} request(s) and{" "}
                {executed.data.pipeline_ids.length} pipeline(s) upserted into{" "}
                {envName(executed.data.target_env_id)}.
              </p>
            ) : finalStatus === "failed" ? (
              <p className="text-sm font-medium text-destructive">
                Promotion failed{executed.data.error_message ? `: ${executed.data.error_message}` : "."}
              </p>
            ) : (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                Executing promotion ({finalStatus})…
              </p>
            )}
            <div className="flex justify-end">
              <Button
                variant="outline"
                disabled={finalStatus === "in_progress"}
                onClick={() => {
                  reset();
                  onClose();
                }}
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            {step === 0 && (
              <div className="space-y-2">
                {environments.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading environments…</p>
                ) : environments.isError ? (
                  <p className="text-sm text-destructive">Failed to load environments.</p>
                ) : (
                  <Select
                    aria-label="Source environment"
                    value={sourceEnvId}
                    onChange={(e) => {
                      setSourceEnvId(e.target.value);
                      // Selections belong to the source env — clear on change.
                      setRequestIds(new Set());
                      setPipelineIds(new Set());
                    }}
                  >
                    <option value="">Select source environment</option>
                    {environments.data?.items.map((env) => (
                      <option key={env.id} value={env.id}>
                        {env.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            )}

            {step === 1 &&
              (requests.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading requests…</p>
              ) : requests.isError ? (
                <p className="text-sm text-destructive">Failed to load requests.</p>
              ) : (
                <SelectableTable
                  items={requests.data?.items ?? []}
                  selected={requestIds}
                  onToggle={(id) => setRequestIds((s) => toggle(s, id))}
                  emptyText={`No requests in ${envName(sourceEnvId)}.`}
                  columns={[
                    { header: "Title", cell: (r) => <span className="font-medium">{r.title}</span> },
                    { header: "Status", cell: (r) => r.status.replace("_", " ") },
                    { header: "Sources", cell: (r) => r.source_objects.length },
                  ]}
                />
              ))}

            {step === 2 &&
              (pipelines.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading pipelines…</p>
              ) : pipelines.isError ? (
                <p className="text-sm text-destructive">Failed to load pipelines.</p>
              ) : (
                <SelectableTable
                  items={pipelines.data?.items ?? []}
                  selected={pipelineIds}
                  onToggle={(id) => setPipelineIds((s) => toggle(s, id))}
                  emptyText={`No pipelines in ${envName(sourceEnvId)}.`}
                  columns={[
                    { header: "Name", cell: (p) => <span className="font-medium">{p.name}</span> },
                    { header: "Engine", cell: (p) => p.engine },
                    { header: "Status", cell: (p) => p.status },
                  ]}
                />
              ))}

            {step === 3 && (
              <Select
                aria-label="Target environment"
                value={targetEnvId}
                onChange={(e) => setTargetEnvId(e.target.value)}
              >
                <option value="">Select target environment</option>
                {environments.data?.items
                  .filter((env) => env.id !== sourceEnvId)
                  .map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name}
                    </option>
                  ))}
              </Select>
            )}

            {step === 4 && (
              <div className="space-y-3 text-sm">
                <p>
                  Promote from <span className="font-medium">{envName(sourceEnvId)}</span> to{" "}
                  <span className="font-medium">{envName(targetEnvId)}</span>:
                </p>
                <ul className="list-inside list-disc space-y-1">
                  <li>
                    {requestIds.size} request(s):{" "}
                    <span className="text-muted-foreground">
                      {requests.data?.items
                        .filter((r) => requestIds.has(r.id))
                        .map((r) => r.title)
                        .join(", ") || "none"}
                    </span>
                  </li>
                  <li>
                    {pipelineIds.size} pipeline(s):{" "}
                    <span className="text-muted-foreground">
                      {pipelines.data?.items
                        .filter((p) => pipelineIds.has(p.id))
                        .map((p) => p.name)
                        .join(", ") || "none"}
                    </span>
                  </li>
                </ul>
                <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Secrets are excluded from the snapshot: target connections and
                  secret-bearing engine config values are nulled and must be re-configured in
                  the target environment.
                </p>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <div className="flex justify-between">
              <Button variant="outline" disabled={step === 0 || executing} onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={next}>
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button disabled={executing} onClick={handleExecute}>
                  {executing ? "Executing…" : "Execute promotion"}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
