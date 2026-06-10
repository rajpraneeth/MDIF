export type Role =
  | "requester"
  | "data_engineer"
  | "architect"
  | "manager"
  | "admin";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  env_id: string | null;
  created_at: string;
  updated_at: string;
}

export const ALL_ROLES: Role[] = [
  "requester",
  "data_engineer",
  "architect",
  "manager",
  "admin",
];

/** DE+ = data_engineer, architect, manager, admin (requester excluded). */
export const DE_PLUS: Role[] = ["data_engineer", "architect", "manager", "admin"];

export const ARCHITECT_PLUS: Role[] = ["architect", "manager", "admin"];

export const ADMIN_ONLY: Role[] = ["admin"];
