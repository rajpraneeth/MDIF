import { Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { apiErrorMessage } from "@/api/client";
import { useCreateEnvironment, useEnvironments } from "@/api/connections";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const newEnvSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  base_url: z.string().trim().max(500).optional(),
  description: z.string().trim().max(1000).optional(),
});

export default function EnvironmentsPage() {
  const { data, isLoading, isError } = useEnvironments();
  const createEnvironment = useCreateEnvironment();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", base_url: "", description: "" });
  const [formErrors, setFormErrors] = useState<string[]>([]);

  async function handleCreate() {
    const parsed = newEnvSchema.safeParse({
      name: form.name,
      base_url: form.base_url || undefined,
      description: form.description || undefined,
    });
    if (!parsed.success) {
      setFormErrors(parsed.error.issues.map((i) => i.message));
      return;
    }
    setFormErrors([]);
    try {
      await createEnvironment.mutateAsync(parsed.data);
      setAddOpen(false);
      setForm({ name: "", base_url: "", description: "" });
    } catch (e) {
      setFormErrors([apiErrorMessage(e, "Failed to create environment.")]);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Environments</h1>
          <p className="text-sm text-muted-foreground">
            Deployment environments for connections, requests, and pipelines.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          New environment
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading environments…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load environments. Try again.</p>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">No environments yet.</p>
          <Button variant="outline" className="mt-4" onClick={() => setAddOpen(true)}>
            Create your first environment
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Base URL</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((env) => (
                <tr key={env.id} className="border-t transition-colors hover:bg-accent/50">
                  <td className="px-4 py-3 font-medium">{env.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{env.base_url || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{env.description || "—"}</td>
                  <td className="px-4 py-3">{env.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(env.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">New environment</h2>
          <div className="space-y-2">
            <Label htmlFor="env-name">Name</Label>
            <Input
              id="env-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="staging"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="env-base-url">Base URL</Label>
            <Input
              id="env-base-url"
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder="https://staging.example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="env-description">Description</Label>
            <Textarea
              id="env-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>
          {formErrors.length > 0 && (
            <ul role="alert" className="space-y-1 text-sm font-medium text-destructive">
              {formErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createEnvironment.isPending} onClick={handleCreate}>
              {createEnvironment.isPending ? "Creating…" : "Create environment"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
