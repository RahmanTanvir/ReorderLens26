import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AppError, assertSameOrigin, privateHeaders } from "@/lib/auth/errors";

export async function readJson<T>(request: NextRequest, schema: z.ZodType<T>, maxBytes = 8192): Promise<T> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new AppError(400, "INVALID_BODY", "Send a JSON request.");
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "INVALID_BODY", "A request body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { await reader.cancel(); throw new AppError(413, "BODY_TOO_LARGE", "This request is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new AppError(400, "INVALID_JSON", "The request could not be read."); }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Check the highlighted fields.", parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
  return parsed.data;
}

export function endpoint(handler: (request: NextRequest) => Promise<{ data: unknown; isSample?: boolean; status?: number }>, mutation = false) {
  return async (request: NextRequest) => {
    const requestId = crypto.randomUUID();
    try {
      if (mutation) assertSameOrigin(request.headers.get("origin"), request.headers.get("referer"), request.nextUrl.origin);
      const result = await handler(request);
      return NextResponse.json({ data: result.data, meta: { requestId, isSample: result.isSample ?? false } }, { status: result.status ?? 200, headers: { ...privateHeaders, "X-Request-Id": requestId } });
    } catch (error) {
      const failure = error instanceof AppError ? error : new AppError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
      if (failure.status === 500) console.error("Request failed", { requestId, code: failure.code });
      return NextResponse.json({ error: { code: failure.code, message: failure.message, fields: failure.fields, requestId } }, { status: failure.status, headers: { ...privateHeaders, "X-Request-Id": requestId } });
    }
  };
}

export function databaseFailure(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === "42501") throw new AppError(403, "FORBIDDEN", "You do not have permission for this action.");
  if (error.code === "22023") throw new AppError(400, "VALIDATION_ERROR", "Check the workspace name and location.");
  if (error.code === "0A000") throw new AppError(422, "SAMPLE_UNAVAILABLE", "Sample workspaces are not available yet.");
  if (error.code === "P0001" && error.message === "WORKSPACE_LIMIT") throw new AppError(429, "WORKSPACE_LIMIT", "Workspace creation is temporarily limited. Please try again later.");
  throw new AppError(503, "DATABASE_UNAVAILABLE", "Workspace access is unavailable. Please contact your administrator or try again later.");
}
