/** React Strict Mode / navigasyon iptali — gerçek hata değil. */
export function isAbortLikeError(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  const name = String((error as { name?: unknown }).name ?? "");
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
  return name === "AbortError" || message.includes("aborted");
}
