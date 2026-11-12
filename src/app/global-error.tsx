"use client";

import { Button } from "@/components/ui/button";
import { manrope } from "@/lib/fonts";
import "./globals.css";

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return <html lang="en" className={`dark ${manrope.variable}`}><body>
    <title>Temporarily unavailable — ReorderLens</title>
    <main className="mx-auto max-w-xl space-y-5 px-6 py-16">
      <h1 className="text-2xl font-bold">ReorderLens is temporarily unavailable</h1>
      <p className="text-sm leading-6 text-secondary-foreground">Check your connection and try again. If a save was interrupted, review the saved record before repeating it.</p>
      <div className="flex flex-wrap items-center gap-5"><Button type="button" onClick={retry}>Try again</Button><a href="/login" className="inline-flex min-h-11 items-center rounded-sm text-sm text-primary underline">Back to sign in</a></div>
    </main>
  </body></html>;
}
