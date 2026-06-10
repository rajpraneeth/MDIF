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

export interface EnvironmentRead {
  id: string;
  name: string;
  description: string | null;
}
