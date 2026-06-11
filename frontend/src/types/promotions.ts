export type PromotionStatus = "pending" | "in_progress" | "completed" | "failed";

/** Secret-free snapshot captured at creation (GLD-8 contract). */
export interface PromotionSnapshot {
  requests?: { title: string; [key: string]: unknown }[];
  pipelines?: { name: string; [key: string]: unknown }[];
}

export interface PromotionRead {
  id: string;
  source_env_id: string;
  target_env_id: string;
  request_ids: string[];
  pipeline_ids: string[];
  snapshot: PromotionSnapshot;
  status: PromotionStatus;
  promoted_by: string | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface PromotionCreate {
  source_env_id: string;
  target_env_id: string;
  request_ids: string[];
  pipeline_ids: string[];
}
