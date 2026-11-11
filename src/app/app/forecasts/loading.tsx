import { Skeleton } from "@/components/ui/skeleton";
export default function LoadingForecasts(){return <div role="status" aria-label="Loading saved forecasts" className="space-y-6"><Skeleton className="h-16 w-64"/><Skeleton className="h-32 w-full"/><Skeleton className="h-96 w-full"/><span className="sr-only">Loading saved forecasts…</span></div>;}
