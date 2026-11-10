import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
      <div>
        <h1 className="text-[28px] leading-9 font-bold tracking-[-0.035em]">{title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-secondary-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3 lg:pt-1">{actions}</div> : null}
    </header>
  );
}
