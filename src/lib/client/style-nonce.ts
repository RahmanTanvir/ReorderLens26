import { setNonce } from "get-nonce";

export function initializeStyleNonce(document: Document) {
  // Read the actual server-rendered script nonce; getAttribute is masked by browsers.
  const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
  if (nonce) setNonce(nonce);
}

// Runs before any dialog can mount its scroll-lock style. One nonce per document;
// client navigation keeps the original document policy, not a new RSC response's.
if (typeof document !== "undefined") initializeStyleNonce(document);
