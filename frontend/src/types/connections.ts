export type ConnectionType =
  | "sql_server"
  | "adls_gen2"
  | "s3"
  | "snowflake"
  | "kafka"
  | "rest_api"
  | "databricks_catalog";

export type SchemaObjectType = "table" | "view" | "topic" | "endpoint" | "file_path";

export interface ConnectionRead {
  id: string;
  name: string;
  type: ConnectionType;
  env_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchemaTreeObject {
  id: string;
  object_name: string;
  object_type: SchemaObjectType;
  row_count: number | null;
}

export interface SchemaTreeSchema {
  schema_name: string | null;
  objects: SchemaTreeObject[];
}

export interface SchemaTreeDatabase {
  database_name: string | null;
  schemas: SchemaTreeSchema[];
}

export interface SchemaObjectTree {
  connection_id: string;
  databases: SchemaTreeDatabase[];
}

export interface SchemaObjectColumn {
  name: string;
  type?: string | null;
}

/** Full object detail from GET /schema-objects/{id} (columns JSONB + profiling). */
export interface SchemaObjectDetail {
  id: string;
  connection_id: string;
  database_name: string | null;
  schema_name: string | null;
  object_name: string;
  object_type: SchemaObjectType;
  columns: SchemaObjectColumn[] | null;
  row_count: number | null;
  last_profiled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentRead {
  id: string;
  name: string;
  base_url: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface EnvironmentCreate {
  name: string;
  base_url?: string;
  description?: string;
}
