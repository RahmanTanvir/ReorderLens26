import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Brand } from "@/components/shared/brand";
import { WorkspaceForm } from "@/components/workspace/workspace-form";
import { WorkspacePicker } from "@/components/workspace/workspace-picker";
import { listMembershipWorkspaces, requirePageUser } from "@/server/auth/context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workspace setup — ReorderLens" };
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const context = await requirePageUser();
  const workspaces = await listMembershipWorkspaces(context);
  const createNew = (await searchParams).new === "1" || !workspaces.length;
  return <div className="min-h-dvh"><header className="flex h-[var(--shell-topbar-height)] items-center justify-between gap-4 border-b px-5 sm:px-10"><Link href="/app/overview" aria-label="ReorderLens" className="rounded-md"><Brand /></Link><SignOutButton /></header><main className="mx-auto max-w-[1160px] px-5 py-10 sm:px-[var(--shell-gutter)] sm:py-12"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Get started</p><h1 className="mt-3 text-[28px] font-bold tracking-tight">{createNew ? "Set up your workspace." : "Welcome to your workspace."}</h1><p className="mt-3 mb-8 text-sm leading-6 text-secondary-foreground">{createNew ? "A few essentials help ReorderLens use the right store, currency, and data context." : "Choose the workspace you want to access."}</p>{createNew ? <WorkspaceForm /> : <><WorkspacePicker workspaces={workspaces} /><Link href="/setup?new=1" className="mt-6 inline-block rounded-sm text-sm text-primary hover:underline">Create another workspace</Link></>}{createNew && workspaces.length ? <Link href="/setup" className="mt-6 inline-block rounded-sm text-sm text-primary hover:underline">Back to workspace selection</Link> : null}</main></div>;
}
