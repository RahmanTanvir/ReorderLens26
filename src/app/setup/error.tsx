"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function SetupError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl space-y-5 px-6 py-16"><h1 className="text-2xl font-bold">Workspace setup is unavailable</h1><Alert tone="error">Your workspace access could not be loaded. Please retry, or ask your administrator to finish the secure workspace setup.</Alert><Button onClick={reset}>Try again</Button></main>;
}
