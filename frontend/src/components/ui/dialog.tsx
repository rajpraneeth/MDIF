import { type ReactNode, useEffect } from "react";

import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** "modal" centers; "drawer" slides in from the right. */
  variant?: "modal" | "drawer";
  /** Extra classes for the panel — e.g. a wider max-w for wizards. */
  className?: string;
}

/** Lightweight dialog/drawer on the shadcn token palette (no portal deps). */
export function Dialog({ open, onClose, children, variant = "modal", className }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex bg-black/50",
        variant === "modal" ? "items-center justify-center p-4" : "justify-end",
      )}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "bg-background shadow-lg",
          variant === "modal"
            ? "max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border p-6"
            : "h-full w-full max-w-md overflow-y-auto border-l p-6",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
