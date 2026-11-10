import { z } from "zod";

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), fields: z.array(z.object({ path: z.string(), message: z.string() })).optional() }) });
export class RequestError extends Error {
  constructor(message: string, public code: string, public fields: { path: string; message: string }[] = []) { super(message); }
}

export async function requestJson<T>(url: string, method: "POST" | "PATCH", body: unknown, schema: z.ZodType<T>): Promise<T> {
  let response: Response;
  const multipart = body instanceof FormData;
  try { response = await fetch(url, { method, credentials: "same-origin", headers: multipart ? undefined : { "Content-Type": "application/json" }, body: multipart ? body : JSON.stringify(body), signal: AbortSignal.timeout(multipart ? 60000 : 30000) }); }
  catch { throw new RequestError("Unable to connect. Check your connection and try again.", "NETWORK_ERROR"); }
  let value: unknown;
  try { value = await response.json(); } catch { throw new RequestError("The server response could not be read. Please try again.", "INVALID_RESPONSE"); }
  if (!response.ok) {
    const parsed = errorSchema.safeParse(value);
    throw parsed.success ? new RequestError(parsed.data.error.message, parsed.data.error.code, parsed.data.error.fields) : new RequestError("This request could not be completed. Please try again.", "REQUEST_FAILED");
  }
  const parsed = z.object({ data: schema }).safeParse(value);
  if (!parsed.success) throw new RequestError("The server response could not be verified. Please try again.", "INVALID_RESPONSE");
  return parsed.data.data;
}
