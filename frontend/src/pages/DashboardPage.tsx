import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/stores/authStore";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back{user ? `, ${user.full_name}` : ""}.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Getting started</CardTitle>
          <CardDescription>
            Use the sidebar to browse ingestion requests, pipelines, and run history.
            Sections you don&apos;t have access to are hidden.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Dashboard widgets (request/pipeline summaries) arrive in a later phase.
        </CardContent>
      </Card>
    </div>
  );
}
