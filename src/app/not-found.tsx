import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return <main className="mx-auto max-w-xl space-y-5 px-6 py-16"><h1 className="text-2xl font-bold">Page not found</h1><p className="text-sm leading-6 text-secondary-foreground">This address is unavailable. Return to your workspace to choose a page.</p><Link href="/app/overview" className={buttonVariants({variant:"outline"})}>Open workspace</Link></main>;
}
