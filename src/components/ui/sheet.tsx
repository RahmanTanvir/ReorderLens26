"use client";

import type { ComponentProps } from "react";

import { DialogContent } from "@/components/ui/dialog";

export { Dialog as Sheet, DialogTrigger as SheetTrigger, DialogClose as SheetClose, DialogHeader as SheetHeader, DialogTitle as SheetTitle, DialogDescription as SheetDescription } from "@/components/ui/dialog";

export function SheetContent({ side = "right", ...props }: Omit<ComponentProps<typeof DialogContent>, "presentation">) {
  return <DialogContent presentation="sheet" side={side} {...props} />;
}
