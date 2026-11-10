"use client";

import type { ComponentProps } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, presentation = "dialog", side = "right", ...props }: ComponentProps<typeof DialogPrimitive.Content> & { presentation?: "dialog" | "sheet"; side?: "left" | "right" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="modal-overlay fixed inset-0 z-50 bg-black/60" />
      <DialogPrimitive.Content
        data-slot={presentation === "sheet" ? "sheet-content" : "dialog-content"}
        className={cn(
          "fixed z-50 overflow-y-auto border bg-popover text-foreground shadow-xl outline-none",
          presentation === "dialog"
            ? "dialog-panel top-1/2 left-1/2 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl p-6"
            : "sheet-panel inset-y-0 w-[min(320px,calc(100%-3rem))] bg-sidebar",
          presentation === "sheet" && (side === "left" ? "left-0 border-r" : "right-0 border-l"),
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close">
          <X aria-hidden="true" className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mb-6 space-y-2 pr-8", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm leading-6 text-secondary-foreground", className)} {...props} />;
}
