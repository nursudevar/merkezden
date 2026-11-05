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

const PUBLIC_ADMIN_ANNOUNCEMENT_LIMIT = 20;

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
    .map((row) => {
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
    })
    .filter((item): item is PublicAdminAnnouncement => item !== null);

  return { items, error: null };
}
