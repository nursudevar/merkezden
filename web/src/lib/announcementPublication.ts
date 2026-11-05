const ANNOUNCEMENT_PUBLICATION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function announcementPublicationCutoffIso(now = Date.now()): string {
  return new Date(now - ANNOUNCEMENT_PUBLICATION_WINDOW_MS).toISOString();
}

export function isAnnouncementPublicationCurrent(
  publishedAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!publishedAt) return false;
  const publishedMs = new Date(publishedAt).getTime();
  return Number.isFinite(publishedMs) && publishedMs > now - ANNOUNCEMENT_PUBLICATION_WINDOW_MS;
}

/** Cron `is_active` alanını henüz kapatmamış olsa da yayın penceresi kapanmış kayıt. */
export function isAnnouncementExpiredWhileActive(
  isActive: boolean,
  publishedAt: string | null | undefined,
  now = Date.now(),
): boolean {
  return isActive && !isAnnouncementPublicationCurrent(publishedAt, now);
}
