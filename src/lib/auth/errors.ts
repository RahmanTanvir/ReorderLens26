export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: { path: string; message: string }[]) { super(message); }
}

export function assertSameOrigin(origin: string | null, referer: string | null, expectedOrigin: string) {
  try {
    if (origin ? origin === expectedOrigin : new URL(referer ?? "").origin === expectedOrigin) return;
  } catch { /* Missing/malformed origin is rejected below. */ }
  throw new AppError(403, "ORIGIN_DENIED", "This request could not be verified. Reload the page and try again.");
}

export const privateHeaders = { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" };
