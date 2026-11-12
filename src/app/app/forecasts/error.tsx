"use client";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
export default function ForecastError({retry}:{retry:()=>void}) {
  return <div className="space-y-5"><Alert tone="error">Forecasts could not be loaded. Check your connection, then try again. An interrupted response does not prove generation failed.</Alert><div className="flex flex-wrap items-center gap-5"><Button onClick={retry}>Retry loading forecasts</Button><Link className="inline-flex min-h-11 items-center rounded-sm text-primary underline" href="/app/forecasts">Check latest saved runs</Link></div></div>;
}
