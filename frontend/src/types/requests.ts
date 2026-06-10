export type RequestStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "in_progress"
  | "completed";

export type RequestPriority = "low" | "medium" | "high" | "critical";

export type IngestionMode = "full" | "incremental" | "cdc";

export interface FilterConfig {
  watermark_column?: string | null;
  filter_expr?: string | null;
}

export interface SourceObjectEntry {
  schema_object_id: string;
  alias?: string | null;
  filter_config?: FilterConfig | null;
}

export interface RequestRead {
  id: string;
  title: string;
  description: string | null;
  priority: RequestPriority;
  status: RequestStatus;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  env_id: string;
  source_objects: SourceObjectEntry[];
  target_connection_id: string | null;
  target_schema: string | null;
  target_table_pattern: string | null;
  ingestion_mode: IngestionMode;
  schedule_cron: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface RequestCreate {
  title: string;
  env_id: string;
  description?: string;
  priority?: RequestPriority;
  source_objects?: SourceObjectEntry[];
  target_connection_id?: string | null;
  target_schema?: string | null;
  target_table_pattern?: string | null;
  ingestion_mode?: IngestionMode;
  schedule_cron?: string | null;
  tags?: string[];
}
