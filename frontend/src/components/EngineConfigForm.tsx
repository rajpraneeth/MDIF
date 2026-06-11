import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Engine, EngineConfig } from "@/types/pipelines";

/**
 * Dynamic engine_config form per spec §4.2. All values are edited as strings
 * (a "draft") and converted to the typed config on submit so JSON fields can
 * be validated with a friendly message instead of crashing mid-keystroke.
 */

interface FieldDef {
  key: string;
  label: string;
  kind: "text" | "json" | "list";
  placeholder?: string;
  hint?: string;
}

const PARAMETERS_FIELD: FieldDef = {
  key: "parameters",
  label: "Parameters",
  kind: "json",
  placeholder: '{ "key": "value" }',
  hint: "JSON object",
};

export const ENGINE_FIELDS: Record<Engine, FieldDef[]> = {
  adf: [
    { key: "subscription_id", label: "Subscription ID", kind: "text" },
    { key: "resource_group", label: "Resource group", kind: "text" },
    { key: "factory_name", label: "Factory name", kind: "text" },
    { key: "pipeline_name", label: "Pipeline name", kind: "text" },
    PARAMETERS_FIELD,
  ],
  databricks: [
    { key: "workspace_url", label: "Workspace URL", kind: "text", placeholder: "https://…" },
    { key: "job_id", label: "Job ID", kind: "text" },
    { key: "cluster_id", label: "Cluster ID", kind: "text" },
    { key: "notebook_path", label: "Notebook path", kind: "text", placeholder: "/Repos/…" },
    PARAMETERS_FIELD,
  ],
  python_script: [
    { key: "script_path", label: "Script path", kind: "text", placeholder: "scripts/ingest.py" },
    { key: "entry_point", label: "Entry point", kind: "text", placeholder: "main" },
    {
      key: "dependencies",
      label: "Dependencies",
      kind: "list",
      placeholder: "pandas, sqlalchemy",
      hint: "comma-separated",
    },
    {
      key: "env_vars",
      label: "Environment variables",
      kind: "json",
      placeholder: '{ "KEY": "value" }',
      hint: "JSON object",
    },
  ],
  pyspark_script: [],
};
// PySpark uses the same Script schema as Python (§4.2); runtime differs.
ENGINE_FIELDS.pyspark_script = ENGINE_FIELDS.python_script;

/** runtime value injected for script engines (not an editable field). */
const SCRIPT_RUNTIME: Partial<Record<Engine, string>> = {
  python_script: "python",
  pyspark_script: "pyspark",
};

export type ConfigDraft = Record<string, string>;

export function emptyDraft(engine: Engine): ConfigDraft {
  return Object.fromEntries(ENGINE_FIELDS[engine].map((f) => [f.key, ""]));
}

/** Turns a stored engine_config back into editable strings. */
export function configToDraft(engine: Engine, config: EngineConfig): ConfigDraft {
  const draft = emptyDraft(engine);
  for (const field of ENGINE_FIELDS[engine]) {
    const value = config[field.key];
    if (value == null) continue;
    if (field.kind === "json") {
      draft[field.key] = JSON.stringify(value, null, 2);
    } else if (field.kind === "list") {
      draft[field.key] = Array.isArray(value) ? value.join(", ") : String(value);
    } else {
      draft[field.key] = String(value);
    }
  }
  return draft;
}

/** Validates and converts the draft; returns errors instead of throwing. */
export function draftToConfig(
  engine: Engine,
  draft: ConfigDraft,
): { config: EngineConfig; errors: string[] } {
  const config: EngineConfig = {};
  const errors: string[] = [];

  for (const field of ENGINE_FIELDS[engine]) {
    const raw = (draft[field.key] ?? "").trim();
    if (field.kind === "json") {
      if (!raw) {
        config[field.key] = {};
        continue;
      }
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          errors.push(`${field.label} must be a JSON object`);
        } else {
          config[field.key] = parsed;
        }
      } catch {
        errors.push(`${field.label} is not valid JSON`);
      }
    } else if (field.kind === "list") {
      config[field.key] = raw
        ? raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    } else {
      config[field.key] = raw;
    }
  }

  const runtime = SCRIPT_RUNTIME[engine];
  if (runtime) config.runtime = runtime;

  return { config, errors };
}

export function EngineConfigFields({
  engine,
  draft,
  onChange,
  disabled,
}: {
  engine: Engine;
  draft: ConfigDraft;
  onChange: (draft: ConfigDraft) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ENGINE_FIELDS[engine].map((field) => (
        <div key={field.key} className={field.kind === "text" ? "space-y-2" : "space-y-2 sm:col-span-2"}>
          <Label htmlFor={`cfg-${field.key}`}>
            {field.label}
            {field.hint && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">{field.hint}</span>
            )}
          </Label>
          {field.kind === "text" ? (
            <Input
              id={`cfg-${field.key}`}
              value={draft[field.key] ?? ""}
              placeholder={field.placeholder}
              disabled={disabled}
              onChange={(e) => onChange({ ...draft, [field.key]: e.target.value })}
            />
          ) : (
            <Textarea
              id={`cfg-${field.key}`}
              value={draft[field.key] ?? ""}
              placeholder={field.placeholder}
              disabled={disabled}
              className={field.kind === "json" ? "font-mono text-xs" : undefined}
              rows={field.kind === "json" ? 4 : 2}
              onChange={(e) => onChange({ ...draft, [field.key]: e.target.value })}
            />
          )}
        </div>
      ))}
    </div>
  );
}
