import { ChevronDown, ChevronRight, Database, Settings2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useConnectionObjects, useConnections } from "@/api/connections";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SchemaTreeObject } from "@/types/connections";
import type { SourceObjectEntry } from "@/types/requests";

/** Picker state keeps display info alongside the API entry for chips/review. */
export interface PickedObject extends SourceObjectEntry {
  object_name: string;
  connection_name: string;
}

interface SourceObjectPickerProps {
  envId: string;
  value: PickedObject[];
  onChange: (next: PickedObject[]) => void;
}

export function SourceObjectPicker({ envId, value, onChange }: SourceObjectPickerProps) {
  const [connectionId, setConnectionId] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [configFor, setConfigFor] = useState<PickedObject | null>(null);

  const connections = useConnections(envId);
  const tree = useConnectionObjects(connectionId || undefined);

  const selectedIds = useMemo(
    () => new Set(value.map((v) => v.schema_object_id)),
    [value],
  );
  const connectionName =
    connections.data?.items.find((c) => c.id === connectionId)?.name ?? "";

  function toggleObject(obj: SchemaTreeObject) {
    if (selectedIds.has(obj.id)) {
      onChange(value.filter((v) => v.schema_object_id !== obj.id));
    } else {
      onChange([
        ...value,
        {
          schema_object_id: obj.id,
          object_name: obj.object_name,
          connection_name: connectionName,
          alias: null,
          filter_config: null,
        },
      ]);
    }
  }

  function updatePicked(id: string, patch: Partial<PickedObject>) {
    onChange(value.map((v) => (v.schema_object_id === id ? { ...v, ...patch } : v)));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sop-connection">Connection</Label>
        {connections.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading connections…</p>
        ) : connections.isError ? (
          <p className="text-sm text-destructive">Failed to load connections.</p>
        ) : connections.data && connections.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No connections in this environment yet.
          </p>
        ) : (
          <Select
            id="sop-connection"
            value={connectionId}
            onChange={(e) => setConnectionId(e.target.value)}
          >
            <option value="">Select a connection…</option>
            {connections.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </Select>
        )}
      </div>

      {connectionId && (
        <div className="rounded-md border">
          {tree.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading schema tree…</p>
          ) : tree.isError ? (
            <p className="p-4 text-sm text-destructive">
              Failed to load objects for this connection.
            </p>
          ) : tree.data && tree.data.databases.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No discovered objects. Run discovery on the connection first.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto p-2">
              {tree.data?.databases.map((db, di) => {
                const dbKey = `${connectionId}:${db.database_name ?? di}`;
                return (
                  <div key={dbKey}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm font-medium hover:bg-accent"
                      onClick={() =>
                        setCollapsed((c) => ({ ...c, [dbKey]: !c[dbKey] }))
                      }
                    >
                      {collapsed[dbKey] ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      <Database className="h-4 w-4 text-muted-foreground" />
                      {db.database_name ?? "(default)"}
                    </button>
                    {!collapsed[dbKey] &&
                      db.schemas.map((schema, si) => {
                        const sKey = `${dbKey}:${schema.schema_name ?? si}`;
                        return (
                          <div key={sKey} className="ml-5">
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent"
                              onClick={() =>
                                setCollapsed((c) => ({ ...c, [sKey]: !c[sKey] }))
                              }
                            >
                              {collapsed[sKey] ? (
                                <ChevronRight className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                              {schema.schema_name ?? "(no schema)"}
                            </button>
                            {!collapsed[sKey] &&
                              schema.objects.map((obj) => (
                                <label
                                  key={obj.id}
                                  className={cn(
                                    "ml-6 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent",
                                    selectedIds.has(obj.id) && "bg-secondary",
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-input"
                                    checked={selectedIds.has(obj.id)}
                                    onChange={() => toggleObject(obj)}
                                  />
                                  <span>{obj.object_name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {obj.object_type}
                                    {obj.row_count != null &&
                                      ` · ${obj.row_count.toLocaleString()} rows`}
                                  </span>
                                </label>
                              ))}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {connectionId && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setConnectionId("")}
        >
          Add another connection
        </Button>
      )}

      {value.length > 0 && (
        <div className="space-y-2">
          <Label>Selected objects ({value.length})</Label>
          <div className="flex flex-wrap gap-2">
            {value.map((v) => (
              <span
                key={v.schema_object_id}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
              >
                {v.alias || v.object_name}
                <span className="text-muted-foreground">· {v.connection_name}</span>
                <button
                  type="button"
                  aria-label={`Configure ${v.object_name}`}
                  onClick={() => setConfigFor(v)}
                  className="hover:text-foreground"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${v.object_name}`}
                  onClick={() =>
                    onChange(value.filter((x) => x.schema_object_id !== v.schema_object_id))
                  }
                  className="hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <Dialog open={Boolean(configFor)} onClose={() => setConfigFor(null)} variant="drawer">
        {configFor && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Configure {configFor.object_name}</h2>
              <p className="text-sm text-muted-foreground">{configFor.connection_name}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-alias">Alias</Label>
              <Input
                id="cfg-alias"
                value={configFor.alias ?? ""}
                placeholder={configFor.object_name}
                onChange={(e) => {
                  const alias = e.target.value || null;
                  setConfigFor({ ...configFor, alias });
                  updatePicked(configFor.schema_object_id, { alias });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-watermark">Watermark column</Label>
              <Input
                id="cfg-watermark"
                value={configFor.filter_config?.watermark_column ?? ""}
                placeholder="updated_at"
                onChange={(e) => {
                  const filter_config = {
                    ...configFor.filter_config,
                    watermark_column: e.target.value || null,
                  };
                  setConfigFor({ ...configFor, filter_config });
                  updatePicked(configFor.schema_object_id, { filter_config });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-filter">Filter expression</Label>
              <Input
                id="cfg-filter"
                value={configFor.filter_config?.filter_expr ?? ""}
                placeholder="status = 'active'"
                onChange={(e) => {
                  const filter_config = {
                    ...configFor.filter_config,
                    filter_expr: e.target.value || null,
                  };
                  setConfigFor({ ...configFor, filter_config });
                  updatePicked(configFor.schema_object_id, { filter_config });
                }}
              />
            </div>
            <Button type="button" className="w-full" onClick={() => setConfigFor(null)}>
              Done
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
