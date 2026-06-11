export type PipelineStatus = "draft" | "active" | "paused" | "deleted";

export type Engine = "adf" | "databricks" | "python_script" | "pyspark_script";

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export const ENGINES: Engine[] = ["adf", "databricks", "python_script", "pyspark_script"];

export const ENGINE_LABELS: Record<Engine, string> = {
  adf: "ADF",
  databricks: "Databricks",
  python_script: "Python Script",
  pyspark_script: "PySpark Script",
};

/** engine_config shapes per spec §4.2 — documented, not enforced by the backend. */
export type EngineConfig = Record<string, unknown>;

export interface PipelineRead {
  id: string;
  name: string;
  description: string | null;
  request_id: string | null;
  engine: Engine;
  engine_config: EngineConfig;
  status: PipelineStatus;
  created_by: string;
  env_id: string;
  created_at: string;
  updated_at: string;
}

export interface PipelineCreate {
  name: string;
  engine: Engine;
  env_id: string;
  description?: string;
  request_id?: string;
  engine_config?: EngineConfig;
}

export interface PipelineUpdate {
  name?: string;
  description?: string | null;
  engine_config?: EngineConfig;
}

export interface RunRead {
  id: string;
  pipeline_id: string;
  triggered_by: string;
  status: RunStatus;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  rows_processed: number | null;
  bytes_processed: number | null;
  error_message: string | null;
  run_metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface RunLogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export interface PipelineLiveStatus {
  pipeline_id: string;
  status: PipelineStatus;
  latest_run: RunRead | null;
}
