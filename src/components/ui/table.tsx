import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Table({ className, scrollLabel = "Scrollable table", ...props }: ComponentProps<"table"> & { scrollLabel?: string }) {
  return (
    <div role="region" aria-label={scrollLabel} tabIndex={0} className="w-full overflow-x-auto rounded-lg focus-visible:outline-offset-[-3px]">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("bg-secondary [&_tr]:border-b", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("h-[var(--table-row-height)] border-b transition-colors", className)} {...props} />;
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return <th scope="col" className={cn("px-5 py-4 text-left align-middle text-xs leading-5 font-semibold text-secondary-foreground", className)} {...props} />;
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-5 py-4 align-middle", className)} {...props} />;
}
