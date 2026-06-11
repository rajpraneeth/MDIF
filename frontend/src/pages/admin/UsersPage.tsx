import { Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { apiErrorMessage } from "@/api/client";
import { useCreateUser, useUpdateUser, useUsers } from "@/api/users";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAuthStore } from "@/stores/authStore";
import { ALL_ROLES, type Role } from "@/types/auth";

const PAGE_SIZE = 20;

const newUserSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().trim().max(255).optional(),
  role: z.enum(["requester", "data_engineer", "architect", "manager", "admin"]),
});

export default function UsersPage() {
  const me = useAuthStore((s) => s.user);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useUsers(page, PAGE_SIZE);
  const updateUser = useUpdateUser();
  const createUser = useCreateUser();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "requester" as Role });
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [rowError, setRowError] = useState<string | null>(null);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  async function changeRole(id: string, role: Role) {
    setRowError(null);
    try {
      await updateUser.mutateAsync({ id, body: { role } });
    } catch (e) {
      setRowError(apiErrorMessage(e, "Failed to update role."));
    }
  }

  async function handleAdd() {
    const parsed = newUserSchema.safeParse({
      ...form,
      full_name: form.full_name || undefined,
    });
    if (!parsed.success) {
      setFormErrors(parsed.error.issues.map((i) => i.message));
      return;
    }
    setFormErrors([]);
    try {
      await createUser.mutateAsync(parsed.data);
      setAddOpen(false);
      setForm({ email: "", password: "", full_name: "", role: "requester" });
    } catch (e) {
      setFormErrors([apiErrorMessage(e, "Failed to create user.")]);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Manage accounts and roles.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add user
        </Button>
      </div>

      {rowError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {rowError}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading users…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load users. Try again.</p>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">No users found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} className="border-t transition-colors hover:bg-accent/50">
                  <td className="px-4 py-3 font-medium">
                    {u.full_name || "—"}
                    {me?.id === u.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      aria-label={`Role for ${u.email}`}
                      className="h-8 w-40"
                      value={u.role}
                      // Changing your own role would saw off the branch you sit on.
                      disabled={updateUser.isPending || me?.id === u.id}
                      onChange={(e) => void changeRole(u.id, e.target.value as Role)}
                    >
                      {ALL_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.replace("_", " ")}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3">{u.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
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

      <Dialog open={addOpen} onClose={() => setAddOpen(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Add user</h2>
          <div className="space-y-2">
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Password</Label>
            <Input
              id="new-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-full-name">Full name</Label>
            <Input
              id="new-full-name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-role">Role</Label>
            <Select
              id="new-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace("_", " ")}
                </option>
              ))}
            </Select>
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
            <Button disabled={createUser.isPending} onClick={handleAdd}>
              {createUser.isPending ? "Creating…" : "Create user"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
