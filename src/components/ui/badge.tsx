import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs leading-4 font-semibold", {
  variants: {
    tone: {
      neutral: "border-border bg-secondary text-secondary-foreground",
      accent: "border-primary/20 bg-primary/10 text-primary",
      critical: "border-destructive/20 bg-destructive/10 text-destructive",
      warning: "border-warning/20 bg-warning/10 text-warning",
      healthy: "border-success/20 bg-success/10 text-success",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone, className }))} {...props} />;
}
