import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { initAuth } from "@/api/auth";
import { AppShell } from "@/components/AppShell";
import { useAuthStore } from "@/stores/authStore";
import { ADMIN_ONLY, DE_PLUS, type Role } from "@/types/auth";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const PlaceholderPage = lazy(() => import("@/pages/PlaceholderPage"));

function FullScreenSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
    </div>
  );
}

/** Gates protected routes on auth; initAuth has already resolved via InitGate. */
function ProtectedRoutes() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <AppShell />;
}

/** Route-level role gate — insufficient role bounces to /dashboard. */
function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user || !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Blocks rendering until the initial /auth/refresh attempt resolves (PRD decision 1). */
function InitGate({ children }: { children: ReactNode }) {
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    if (!useAuthStore.getState().initialized) {
      void initAuth();
    }
  }, []);

  if (!initialized) return <FullScreenSpinner />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <InitGate>
        <Suspense fallback={<FullScreenSpinner />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/requests" element={<PlaceholderPage title="Requests" />} />
              <Route
                path="/requests/new"
                element={<PlaceholderPage title="New Request" />}
              />
              <Route
                path="/requests/:id"
                element={<PlaceholderPage title="Request Detail" />}
              />
              <Route
                path="/pipelines"
                element={
                  <RequireRole roles={DE_PLUS}>
                    <PlaceholderPage title="Pipelines" />
                  </RequireRole>
                }
              />
              <Route
                path="/pipelines/new"
                element={
                  <RequireRole roles={DE_PLUS}>
                    <PlaceholderPage title="New Pipeline" />
                  </RequireRole>
                }
              />
              <Route
                path="/pipelines/:id"
                element={
                  <RequireRole roles={DE_PLUS}>
                    <PlaceholderPage title="Pipeline Detail" />
                  </RequireRole>
                }
              />
              <Route path="/runs" element={<PlaceholderPage title="Run History" />} />
              <Route
                path="/connections"
                element={
                  <RequireRole roles={DE_PLUS}>
                    <PlaceholderPage title="Connections" />
                  </RequireRole>
                }
              />
              <Route
                path="/environments"
                element={
                  <RequireRole roles={ADMIN_ONLY}>
                    <PlaceholderPage title="Environments" />
                  </RequireRole>
                }
              />
              <Route
                path="/promotions"
                element={
                  <RequireRole roles={ADMIN_ONLY}>
                    <PlaceholderPage title="Promotions" />
                  </RequireRole>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <RequireRole roles={ADMIN_ONLY}>
                    <PlaceholderPage title="Users" />
                  </RequireRole>
                }
              />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </InitGate>
    </BrowserRouter>
  );
}
