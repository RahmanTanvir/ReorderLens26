import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Alert({ className, tone = "neutral", ...props }: ComponentProps<"div"> & { tone?: "neutral" | "error" | "success" }) {
  return <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-lg border px-4 py-3 text-sm leading-6", tone === "error" ? "border-destructive/25 bg-destructive/5 text-destructive" : tone === "success" ? "border-success/25 bg-success/5 text-success" : "border-border bg-card text-secondary-foreground", className)} {...props} />;
}
