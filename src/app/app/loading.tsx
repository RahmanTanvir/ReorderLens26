import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceLoading() {
  return <div role="status" aria-label="Loading workspace" className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72 max-w-full" /><Skeleton className="h-72 w-full" /><span className="sr-only">Loading your authorized workspace…</span></div>;
}
