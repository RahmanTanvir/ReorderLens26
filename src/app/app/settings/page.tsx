import Link from "next/link";

import { SettingsForm } from "@/components/settings/settings-form";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { readOwnProfile, requirePageWorkspace } from "@/server/auth/context";

export const metadata = { title: "Settings — ReorderLens" };
export default async function SettingsPage() {
  const context = await requirePageWorkspace();
  const profile = await readOwnProfile(context);
  return <div className="space-y-8"><PageHeader title="Settings" description="Manage your workspace information and account preferences." actions={<Link href="/setup?new=1" className={buttonVariants({ variant: "outline" })}>Create workspace</Link>} /><SettingsForm workspace={context.workspace} displayName={profile?.display_name ?? ""} /></div>;
}
