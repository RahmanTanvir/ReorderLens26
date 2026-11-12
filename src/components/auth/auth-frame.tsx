import type { ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import { Brand } from "@/components/shared/brand";

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col border-r bg-sidebar px-[10%] py-10 lg:flex" aria-label="About ReorderLens">
        <Link href="/login" className="w-fit rounded-md"><Brand /></Link>
        <div className="my-auto py-20"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Better inventory decisions</p><h2 className="mt-5 max-w-lg text-[38px] leading-tight font-bold tracking-tight">Know what to reorder.<br /><span className="text-primary">Before it runs out.</span></h2><p className="mt-6 max-w-md text-sm leading-7 text-secondary-foreground">A focused workspace for stock visibility, demand estimates, and purchasing decisions within your budget.</p><ul className="mt-8 space-y-4 text-sm text-secondary-foreground">{["Understand stockout exposure", "Plan purchases within a budget", "Keep every order under your review"].map((text) => <li key={text} className="flex items-center gap-3"><Check aria-hidden="true" className="size-4 text-primary" />{text}</li>)}</ul></div>
        <p className="text-xs text-muted-foreground">Inventory intelligence for independent retailers</p>
      </section>
      <section className="flex flex-col items-center justify-center gap-7 px-5 py-10 sm:px-10">
        <Link href="/login" className="rounded-md lg:hidden"><Brand /></Link>
        {children}
      </section>
    </main>
  );
}
