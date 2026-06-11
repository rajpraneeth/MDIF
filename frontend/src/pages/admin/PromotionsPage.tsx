import { Plus } from "lucide-react";
import { useState } from "react";

import { useEnvironments } from "@/api/connections";
import { usePromotions } from "@/api/promotions";
import { PromotionWizard } from "@/components/PromotionWizard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PromotionStatus } from "@/types/promotions";

const STATUS_STYLES: Record<PromotionStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

const PAGE_SIZE = 20;

export default function PromotionsPage() {
  const [page, setPage] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data, isLoading, isError } = usePromotions(page, PAGE_SIZE);
  const environments = useEnvironments();

  const envName = (id: string) =>
    environments.data?.items.find((e) => e.id === id)?.name ?? id.slice(0, 8);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Promotions</h1>
          <p className="text-sm text-muted-foreground">
            Environment-to-environment promotions of requests and pipelines.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4" />
          New promotion
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading promotions…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load promotions. Try again.</p>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">No promotions yet.</p>
          <Button variant="outline" className="mt-4" onClick={() => setWizardOpen(true)}>
            Run your first promotion
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Promotion</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Promoted by</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Completed</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className="border-t transition-colors hover:bg-accent/50">
                  <td className="px-4 py-3 font-medium">
                    {envName(p.source_env_id)} → {envName(p.target_env_id)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        STATUS_STYLES[p.status],
                      )}
                    >
                      {p.status.replace("_", " ")}
                    </span>
                    {p.error_message && (
                      <p className="mt-1 text-xs text-destructive">{p.error_message}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.request_ids.length} req · {p.pipeline_ids.length} pipe
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {p.promoted_by ? p.promoted_by.slice(0, 8) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.completed_at ? new Date(p.completed_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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

      <PromotionWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
