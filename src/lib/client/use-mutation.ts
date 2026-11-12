"use client";

import { useRef, useState } from "react";
import { z } from "@/lib/validation/zod";

import { RequestError } from "@/lib/client/request";

export function useMutation() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RequestError | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  async function run<T>(operation: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false }> {
    if (running.current) return { ok: false };
    running.current = true; setBusy(true); setError(null); setSucceeded(false);
    try { const data = await operation(); setSucceeded(true); return { ok: true, data }; }
    catch (failure) {
      setError(failure instanceof RequestError ? failure : failure instanceof z.ZodError
        ? new RequestError("Check the highlighted fields.", "VALIDATION_ERROR", failure.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })))
        : new RequestError("This request could not be completed. Please try again.", "REQUEST_FAILED"));
      return { ok: false };
    } finally { running.current = false; setBusy(false); }
  }
  return { busy, error, succeeded, run, clear: () => { if (!running.current) { setError(null); setSucceeded(false); } }, fieldError: (path: string) => error?.fields.find((field) => field.path === path)?.message };
}
