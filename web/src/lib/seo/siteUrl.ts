/** metadataBase için yalnızca ortam değişkeninde tanımlı canlı domain kullanılır. */
export function resolveSiteUrl(): URL | undefined {
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  if (!raw) return undefined;
  try {
    const normalized = raw.endsWith("/") ? raw.slice(0, -1) : raw;
    return new URL(normalized);
  } catch {
    return undefined;
  }
}
