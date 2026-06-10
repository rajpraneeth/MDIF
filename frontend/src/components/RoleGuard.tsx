import type { ReactNode } from "react";

import { useAuthStore } from "@/stores/authStore";
import type { Role } from "@/types/auth";

interface RoleGuardProps {
  roles: Role[];
  children: ReactNode;
}

/** Renders children only if the current user's role is allowed — hides, never redirects (spec §3). */
export function RoleGuard({ roles, children }: RoleGuardProps) {
  const user = useAuthStore((s) => s.user);
  if (!user || !roles.includes(user.role)) return null;
  return <>{children}</>;
}
