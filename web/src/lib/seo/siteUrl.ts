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

/**
 * Sitemap / robots için canonical origin (trailing slash yok).
 * Öncelik: NEXT_PUBLIC_SITE_URL → Vercel production/preview host.
 */
export function resolveCanonicalOrigin(): string {
  const fromEnv = resolveSiteUrl();
  if (fromEnv) return fromEnv.origin;

  const vercelProduction = String(process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "").trim();
  if (vercelProduction) {
    const host = vercelProduction.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (host) return `https://${host}`;
  }

  const vercelUrl = String(process.env.VERCEL_URL ?? "").trim();
  if (vercelUrl) {
    const host = vercelUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (host) return `https://${host}`;
  }

  return "http://localhost:3000";
}

export function joinCanonicalUrl(origin: string, pathname: string): string {
  const base = origin.replace(/\/+$/, "");
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${path}`;
}
