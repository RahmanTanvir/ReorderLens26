import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-[18px] md:h-10",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary-hover",
        outline: "border-border bg-transparent text-foreground hover:bg-accent",
        secondary: "border-transparent bg-secondary text-foreground hover:bg-accent",
        ghost: "border-transparent bg-transparent text-secondary-foreground hover:bg-accent hover:text-foreground",
        destructive: "border-destructive/35 bg-destructive/10 text-destructive hover:bg-destructive/20",
      },
      size: {
        default: "px-4",
        sm: "px-3 text-xs",
        icon: "size-11 px-0 md:size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = "button",
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return <Component data-slot="button" type={asChild ? undefined : type} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
