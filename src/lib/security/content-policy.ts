// Browser calls stay same-origin; Supabase/OpenRouter connections are server-only.
export function contentPolicy(nonce: string, development: boolean, https: boolean) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // Radix positioning, chart sizes and budget bars use React style attributes.
    "style-src-attr 'unsafe-inline'",
    `connect-src 'self'${development ? " ws: wss:" : ""}`,
    "img-src 'self' data: blob:", "font-src 'self'", "object-src 'none'",
    "frame-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
