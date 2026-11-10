"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { announcementPublicationCutoffIso } from "@/lib/announcementPublication";

export type PublicAdminAnnouncement = {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  linkUrl: string | null;
  announcementTag: string | null;
  publishedAt: string;
};

export type PublicAdminAnnouncementMeta = {
  id: string;
  publishedAt: string;
};

/** announcement_id → last_read_published_at (ISO) */
export type AdminAnnouncementReadMap = Record<string, string>;

const PUBLIC_ADMIN_ANNOUNCEMENT_LIMIT = 20;
const GUEST_READS_STORAGE_KEY = "merkezden.admin_announcement_reads.v1";

type ReadChangeListener = () => void;
const readChangeListeners = new Set<ReadChangeListener>();

/** Eşzamanlı metas isteklerini tek ağ çağrısında birleştir (kalıcı cache yok). */
let publishedMetasInflight: Promise<{
  items: PublicAdminAnnouncementMeta[];
  error: string | null;
}> | null = null;

type AnnouncementReadsFetchResult = {
  reads: AdminAnnouncementReadMap;
  authenticated: boolean;
  error: string | null;
};

/**
 * Okuma durumu in-flight dedupe: yalnızca aynı auth kullanıcı (veya guest) için.
 * Mark-as-read sonrası invalidate edilir; eski promise yeni çağrılara paylaşılmaz.
 */
let announcementReadsInflight: Promise<AnnouncementReadsFetchResult> | null = null;
let announcementReadsInflightKey: string | null = null;

/**
 * Pasif (focus/visibility) yenileme: tüm HeaderAnnouncementBell örnekleri arasında
 * paylaşılan minimum aralık. Auth / mutation / kullanıcı aksiyonu bu kapıdan geçmez.
 */
const PASSIVE_ANNOUNCEMENT_REFRESH_MIN_INTERVAL_MS = 60_000;
let lastAnnouncementRefreshAt = 0;
let passiveAnnouncementRefreshScheduled = false;
const passiveAnnouncementRefreshListeners = new Set<() => void>();

function invalidateAdminAnnouncementReadInflight(): void {
  announcementReadsInflight = null;
  announcementReadsInflightKey = null;
}

/** Her gerçek metas/reads yenilemesinden sonra çağrılır (pasif aralığı hizalar). */
export function markAnnouncementRefreshCompleted(): void {
  lastAnnouncementRefreshAt = Date.now();
}

/**
 * Pasif yenileme tetikleyicisine abone ol.
 * `requestPassiveAnnouncementRefresh` kabul edildiğinde tüm ziller bir kez bilgilendirilir;
 * ağ çağrıları mevcut in-flight dedupe ile birleşir.
 */
export function subscribePassiveAnnouncementRefresh(
  listener: () => void,
): () => void {
  passiveAnnouncementRefreshListeners.add(listener);
  return () => {
    passiveAnnouncementRefreshListeners.delete(listener);
  };
}

/**
 * Focus/visibility kaynaklı yenilemeyi dedupe + 60sn minimum aralık ile sınırlar.
 * Kabul edilirse tüm abone ziller refresh çalıştırır; aksi halde no-op.
 */
export function requestPassiveAnnouncementRefresh(): void {
  const now = Date.now();
  if (
    lastAnnouncementRefreshAt > 0 &&
    now - lastAnnouncementRefreshAt < PASSIVE_ANNOUNCEMENT_REFRESH_MIN_INTERVAL_MS
  ) {
    return;
  }
  if (passiveAnnouncementRefreshScheduled) return;

  // Kapıyı hemen kilitle: focus+visibility ve çift zil aynı turda iki kez tetiklemesin.
  lastAnnouncementRefreshAt = now;
  passiveAnnouncementRefreshScheduled = true;
  queueMicrotask(() => {
    passiveAnnouncementRefreshScheduled = false;
    passiveAnnouncementRefreshListeners.forEach((listener) => {
      try {
        listener();
      } catch {
        /* ignore listener errors */
      }
    });
  });
}

export function subscribeAdminAnnouncementReadChanges(listener: ReadChangeListener): () => void {
  readChangeListeners.add(listener);
  return () => {
    readChangeListeners.delete(listener);
  };
}

export function notifyAdminAnnouncementReadChanges(): void {
  // Yeni refresh'ler mark öncesi in-flight yanıtı paylaşmasın.
  invalidateAdminAnnouncementReadInflight();
  readChangeListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore listener errors */
    }
  });
}

export function isAdminAnnouncementUnread(
  publishedAt: string,
  lastReadPublishedAt: string | null | undefined,
): boolean {
  if (!lastReadPublishedAt) return true;
  const publishedMs = Date.parse(publishedAt);
  const readMs = Date.parse(lastReadPublishedAt);
  if (!Number.isFinite(publishedMs)) return true;
  if (!Number.isFinite(readMs)) return true;
  return publishedMs > readMs;
}

export function countUnreadAdminAnnouncements(
  metas: PublicAdminAnnouncementMeta[],
  reads: AdminAnnouncementReadMap,
): number {
  return metas.reduce((count, item) => {
    return count + (isAdminAnnouncementUnread(item.publishedAt, reads[item.id]) ? 1 : 0);
  }, 0);
}

function mapAnnouncementRow(row: {
  id: string | number;
  title: string | null;
  content: string | null;
  announcement_image_url: string | null;
  link_url: string | null;
  announcement_tag: string | null;
  published_at: string | null;
}): PublicAdminAnnouncement | null {
  const title = String(row.title ?? "").trim();
  const publishedAt = String(row.published_at ?? "").trim();
  if (!title || !publishedAt) return null;
  return {
    id: String(row.id),
    title,
    content: String(row.content ?? "").trim(),
    imageUrl: String(row.announcement_image_url ?? "").trim() || null,
    linkUrl: String(row.link_url ?? "").trim() || null,
    announcementTag: String(row.announcement_tag ?? "").trim() || null,
    publishedAt,
  };
}

function readGuestReadsFromStorage(): AdminAnnouncementReadMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(GUEST_READS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const next: AdminAnnouncementReadMap = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!id || typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed || !Number.isFinite(Date.parse(trimmed))) continue;
      next[id] = trimmed;
    }
    return next;
  } catch {
    return {};
  }
}

function writeGuestReadsToStorage(reads: AdminAnnouncementReadMap): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(GUEST_READS_STORAGE_KEY, JSON.stringify(reads));
    return true;
  } catch {
    return false;
  }
}

export async function fetchPublicAdminAnnouncements(): Promise<{
  items: PublicAdminAnnouncement[];
  error: string | null;
}> {
  const supabase = createSupabaseBrowserClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("admin_announcements")
    .select("id, title, content, announcement_image_url, link_url, announcement_tag, published_at")
    .eq("is_active", true)
    .not("published_at", "is", null)
    .lte("published_at", nowIso)
    .gt("published_at", announcementPublicationCutoffIso())
    .order("published_at", { ascending: false })
    .limit(PUBLIC_ADMIN_ANNOUNCEMENT_LIMIT);

  if (error) {
    console.warn("[header-announcements] admin announcements:", error);
    return { items: [], error: "Duyurular yüklenemedi." };
  }

  const items = ((data ?? []) as Array<{
    id: string | number;
    title: string | null;
    content: string | null;
    announcement_image_url: string | null;
    link_url: string | null;
    announcement_tag: string | null;
    published_at: string | null;
  }>)
    .map(mapAnnouncementRow)
    .filter((item): item is PublicAdminAnnouncement => item !== null);

  return { items, error: null };
}

/** Tüm aktif/yayındaki admin duyurularının id + published_at listesi (okunmamış sayısı için). */
export async function fetchPublishedAdminAnnouncementMetas(): Promise<{
  items: PublicAdminAnnouncementMeta[];
  error: string | null;
}> {
  if (publishedMetasInflight) return publishedMetasInflight;

  const promise = (async () => {
    const supabase = createSupabaseBrowserClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("admin_announcements")
      .select("id, published_at")
      .eq("is_active", true)
      .not("published_at", "is", null)
      .lte("published_at", nowIso)
      .gt("published_at", announcementPublicationCutoffIso())
      .order("published_at", { ascending: false });

    if (error) {
      console.warn("[header-announcements] admin announcement metas:", error);
      return { items: [], error: "Duyurular yüklenemedi." };
    }

    const items = ((data ?? []) as Array<{ id: string | number; published_at: string | null }>)
      .map((row) => {
        const id = String(row.id ?? "").trim();
        const publishedAt = String(row.published_at ?? "").trim();
        if (!id || !publishedAt) return null;
        return { id, publishedAt };
      })
      .filter((item): item is PublicAdminAnnouncementMeta => item !== null);

    return { items, error: null };
  })().finally(() => {
    if (publishedMetasInflight === promise) {
      publishedMetasInflight = null;
    }
  });

  publishedMetasInflight = promise;
  return promise;
}

export async function fetchAdminAnnouncementReads(): Promise<AnnouncementReadsFetchResult> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const inflightKey = session?.user?.id ? `user:${session.user.id}` : "guest";

  if (announcementReadsInflight && announcementReadsInflightKey === inflightKey) {
    return announcementReadsInflight;
  }

  const promise = (async (): Promise<AnnouncementReadsFetchResult> => {
    if (!session?.user) {
      return { reads: readGuestReadsFromStorage(), authenticated: false, error: null };
    }

    const { data, error } = await supabase
      .from("admin_announcement_reads")
      .select("announcement_id, last_read_published_at");

    if (error) {
      console.warn("[header-announcements] admin announcement reads:", error);
      return { reads: {}, authenticated: true, error: "Okuma durumu yüklenemedi." };
    }

    const reads: AdminAnnouncementReadMap = {};
    for (const row of (data ?? []) as Array<{
      announcement_id: string | null;
      last_read_published_at: string | null;
    }>) {
      const id = String(row.announcement_id ?? "").trim();
      const publishedAt = String(row.last_read_published_at ?? "").trim();
      if (!id || !publishedAt) continue;
      reads[id] = publishedAt;
    }

    return { reads, authenticated: true, error: null };
  })().finally(() => {
    if (announcementReadsInflight === promise) {
      announcementReadsInflight = null;
      announcementReadsInflightKey = null;
    }
  });

  announcementReadsInflight = promise;
  announcementReadsInflightKey = inflightKey;
  return promise;
}

/**
 * Duyuruları okundu işaretler.
 * `publishedById` misafir localStorage için zorunlu; auth için RPC sunucu tarafında published_at yazar.
 */
export async function markAdminAnnouncementsRead(
  announcementIds: string[],
  publishedById: Record<string, string>,
): Promise<{ ok: boolean; error: string | null }> {
  const uniqueIds = [...new Set(announcementIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return { ok: true, error: null };

  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    const current = readGuestReadsFromStorage();
    const next = { ...current };
    for (const id of uniqueIds) {
      const publishedAt = publishedById[id]?.trim();
      if (!publishedAt || !Number.isFinite(Date.parse(publishedAt))) continue;
      next[id] = publishedAt;
    }
    const saved = writeGuestReadsToStorage(next);
    if (!saved) return { ok: false, error: "Okuma durumu kaydedilemedi." };
    notifyAdminAnnouncementReadChanges();
    return { ok: true, error: null };
  }

  const { error } = await supabase.rpc("mark_admin_announcements_read", {
    p_announcement_ids: uniqueIds,
  });

  if (error) {
    console.warn("[header-announcements] mark_admin_announcements_read:", error);
    return { ok: false, error: "Okuma durumu kaydedilemedi." };
  }

  notifyAdminAnnouncementReadChanges();
  return { ok: true, error: null };
}
