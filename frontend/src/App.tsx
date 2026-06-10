import { cn } from "@/lib/utils";

/**
 * Scaffold placeholder. Routing, AppShell, and pages land in Phase 8+ (GLD-9).
 */
export default function App() {
  const env = import.meta.env.VITE_ENVIRONMENT_NAME ?? "dev";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-semibold">MDIF</h1>
      <p className="text-muted-foreground">Metadata-Driven Ingestion Framework</p>
      <span
        className={cn(
          "rounded-md border px-2 py-0.5 text-xs uppercase tracking-wide",
        )}
      >
        env: {env}
      </span>
    </main>
  );
}
