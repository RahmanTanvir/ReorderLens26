import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

// Native selection retains platform keyboard and screen-reader behavior.
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative block min-w-0">
      <select data-slot="select" className={cn("h-11 w-full appearance-none rounded-md border bg-card py-2 pr-10 pl-3 text-sm disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-destructive md:h-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </span>
  );
}
