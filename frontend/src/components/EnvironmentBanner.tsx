import { cn } from "@/lib/utils";

/** Persistent top bar showing the current environment — dev=yellow, prod=red (spec §7.2). */
export function EnvironmentBanner() {
  const env = (import.meta.env.VITE_ENVIRONMENT_NAME || "dev").toLowerCase();
  const isProd = env === "prod" || env === "production";

  return (
    <div
      className={cn(
        "w-full px-4 py-1 text-center text-xs font-semibold uppercase tracking-wider",
        isProd ? "bg-red-600 text-white" : "bg-yellow-400 text-yellow-950",
      )}
    >
      {env} environment
    </div>
  );
}
