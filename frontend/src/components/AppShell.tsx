import {
  ArrowUpDown,
  Cable,
  GitBranch,
  Globe,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { logout } from "@/api/auth";
import { EnvironmentBanner } from "@/components/EnvironmentBanner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { ADMIN_ONLY, ALL_ROLES, DE_PLUS, type Role } from "@/types/auth";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
}

// Visibility per spec §7.1 route table.
const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL_ROLES },
  { to: "/requests", label: "Requests", icon: Inbox, roles: ALL_ROLES },
  { to: "/pipelines", label: "Pipelines", icon: GitBranch, roles: DE_PLUS },
  { to: "/runs", label: "Run History", icon: History, roles: ALL_ROLES },
  { to: "/connections", label: "Connections", icon: Cable, roles: DE_PLUS },
  { to: "/environments", label: "Environments", icon: Globe, roles: ADMIN_ONLY },
  { to: "/promotions", label: "Promotions", icon: ArrowUpDown, roles: ADMIN_ONLY },
  { to: "/admin/users", label: "Users", icon: Users, roles: ADMIN_ONLY },
];

const ROLE_LABELS: Record<Role, string> = {
  requester: "Requester",
  data_engineer: "Data Engineer",
  architect: "Architect",
  manager: "Manager",
  admin: "Admin",
};

export function AppShell() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex min-h-screen flex-col">
      <EnvironmentBanner />
      <div className="flex flex-1">
        <aside className="flex w-60 flex-col border-r bg-card">
          <div className="flex h-14 items-center border-b px-4">
            <span className="text-lg font-semibold tracking-tight">MDIF</span>
          </div>
          <nav className="flex-1 space-y-1 p-2">
            {NAV_ITEMS.filter((item) => user && item.roles.includes(user.role)).map(
              (item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>
        </aside>
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center justify-end gap-3 border-b px-6">
            {user && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{user.full_name}</span>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void logout();
              }}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </header>
          <main className="flex-1 bg-background p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
