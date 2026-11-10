"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return <div className="space-y-5"><Alert tone="error">Your workspace could not be loaded. Check your connection and try again.</Alert><Button onClick={reset}>Try again</Button></div>;
}
