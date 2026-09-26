// Web Crypto's randomUUID() exists only in a secure context (HTTPS or localhost): a player who
// joins a self-hosted world over plain HTTP has none, and no terminal could open for them.
// getRandomValues() is exposed in every context, which is why Foundry's own randomID() uses it.
export function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}
