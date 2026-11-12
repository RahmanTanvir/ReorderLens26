// High-confidence credential patterns only. Findings contain locations, never values.
export function secretFindings(text: string) {
  const rules = [
    ["OpenRouter credential", /sk-or-v1-[a-zA-Z0-9]{32,}/g],
    ["Supabase secret credential", /sb_secret_[a-zA-Z0-9_-]{20,}/g],
    ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ["JWT credential", /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g],
  ] as const;
  return rules.flatMap(([kind, pattern]) => [...text.matchAll(pattern)].map(match => ({ kind, line: text.slice(0, match.index).split("\n").length })));
}
