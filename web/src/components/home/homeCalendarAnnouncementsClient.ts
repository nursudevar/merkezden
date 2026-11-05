"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { announcementPublicationCutoffIso } from "@/lib/announcementPublication";
import { normalizeAnnouncementTag, type AnnouncementTag } from "@/lib/announcementTags";
import {
  PUBLIC_INSTRUCTORS_TABLE,
  publicInstructorDisplayName,
  type PublicInstructorRow,
} from "@/lib/publicInstructorClient";

export type CalendarAnnouncementSource = "admin" | "institution" | "instructor";

export type CalendarAnnouncementItem = {
  id: string;
  source: CalendarAnnouncementSource;
  title: string;
  content: string;
  linkUrl: string | null;
  publishedAt: string;
  dayKey: string;
  ownerName: string;
  ownerHref: string | null;
  announcementTag: AnnouncementTag | null;
};

const MONTH_ROW_LIMIT = 200;

export function istanbulDateKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return formatted || null;
}

export function istanbulMonthBounds(year: number, monthIndex: number): { startIso: string; endIso: string } {
  const startUtc = Date.UTC(year, monthIndex, 1, 0, 0, 0) - 3 * 60 * 60 * 1000;
  const endUtc = Date.UTC(year, monthIndex + 1, 1, 0, 0, 0) - 3 * 60 * 60 * 1000;
  return {
    startIso: new Date(startUtc).toISOString(),
    endIso: new Date(endUtc).toISOString(),
  };
}

type MonthRow = {
  id: string | number;
  title: string | null;
  content: string | null;
  link_url: string | null;
  announcement_tag: string | null;
  published_at: string | null;
};

function toItem(
  row: MonthRow,
  source: CalendarAnnouncementSource,
  ownerName: string,
  ownerHref: string | null,
): CalendarAnnouncementItem | null {
  const title = String(row.title ?? "").trim();
  const publishedAt = String(row.published_at ?? "").trim();
  const dayKey = istanbulDateKey(publishedAt);
  if (!title || !publishedAt || !dayKey) return null;
  return {
    id: `${source}-${String(row.id)}`,
    source,
    title,
    content: String(row.content ?? "").trim(),
    linkUrl: String(row.link_url ?? "").trim() || null,
    publishedAt,
    dayKey,
    ownerName,
    ownerHref,
    announcementTag: normalizeAnnouncementTag(row.announcement_tag),
  };
}

export async function fetchCalendarMonthAnnouncements(
  year: number,
  monthIndex: number,
): Promise<{ items: CalendarAnnouncementItem[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { startIso, endIso } = istanbulMonthBounds(year, monthIndex);
  const nowIso = new Date().toISOString();
  const cutoffIso = announcementPublicationCutoffIso();
  const windowStart = startIso > cutoffIso ? startIso : cutoffIso;
  const windowEnd = endIso < nowIso ? endIso : nowIso;
  if (windowStart >= windowEnd) return { items: [], error: null };

  const [adminRes, institutionRes, instructorRes] = await Promise.all([
    supabase
      .from("admin_announcements")
      .select("id, title, content, link_url, announcement_tag, published_at")
      .eq("is_active", true)
      .not("published_at", "is", null)
      .gte("published_at", windowStart)
      .lt("published_at", endIso)
      .lte("published_at", nowIso)
      .order("published_at", { ascending: false })
      .limit(MONTH_ROW_LIMIT),
    supabase
      .from("announcements")
      .select(
        "id, title, content, link_url, announcement_tag, published_at, institution:institutions(institution_name, slug)",
      )
      .eq("is_active", true)
      .not("published_at", "is", null)
      .gte("published_at", windowStart)
      .lt("published_at", endIso)
      .lte("published_at", nowIso)
      .order("published_at", { ascending: false })
      .limit(MONTH_ROW_LIMIT),
    supabase
      .from("instructor_announcements")
      .select("id, instructor_id, title, content, link_url, announcement_tag, published_at")
      .eq("is_active", true)
      .not("published_at", "is", null)
      .gte("published_at", windowStart)
      .lt("published_at", endIso)
      .lte("published_at", nowIso)
      .order("published_at", { ascending: false })
      .limit(MONTH_ROW_LIMIT),
  ]);

  if (adminRes.error && institutionRes.error && instructorRes.error) {
    console.warn("[home-calendar] announcements", adminRes.error);
    return { items: [], error: "Duyurular yüklenemedi." };
  }
  if (adminRes.error) console.warn("[home-calendar] admin", adminRes.error);
  if (institutionRes.error) console.warn("[home-calendar] institution", institutionRes.error);
  if (instructorRes.error) console.warn("[home-calendar] instructor", instructorRes.error);

  const items: CalendarAnnouncementItem[] = [];

  for (const row of (adminRes.data ?? []) as MonthRow[]) {
    const item = toItem(row, "admin", "Merkezden", null);
    if (item) items.push(item);
  }

  for (const row of (institutionRes.data ?? []) as Array<
    MonthRow & { institution?: { institution_name?: string | null; slug?: string | null } | { institution_name?: string | null; slug?: string | null }[] | null }
  >) {
    const institution = Array.isArray(row.institution) ? row.institution[0] ?? null : row.institution ?? null;
    const slug = String(institution?.slug ?? "").trim();
    const item = toItem(
      row,
      "institution",
      String(institution?.institution_name ?? "").trim() || "Kurum",
      slug ? `/kurumlar/${slug}` : null,
    );
    if (item) items.push(item);
  }

  const instructorRows = (instructorRes.data ?? []) as Array<MonthRow & { instructor_id?: number | null }>;
  const instructorIds = [...new Set(instructorRows.map((row) => Number(row.instructor_id)).filter((id) => id > 0))];
  const instructorById = new Map<number, PublicInstructorRow>();
  if (instructorIds.length > 0) {
    const { data, error } = await supabase
      .from(PUBLIC_INSTRUCTORS_TABLE)
      .select("id, name, surname, slug")
      .in("id", instructorIds);
    if (error) console.warn("[home-calendar] instructors", error);
    for (const row of (data ?? []) as PublicInstructorRow[]) {
      instructorById.set(Number(row.id), row);
    }
  }

  for (const row of instructorRows) {
    const instructor = instructorById.get(Number(row.instructor_id));
    if (!instructor) continue;
    const slug = String(instructor.slug ?? "").trim();
    const item = toItem(
      row,
      "instructor",
      publicInstructorDisplayName(instructor),
      `/egitmenler/${encodeURIComponent(slug || String(instructor.id))}`,
    );
    if (item) items.push(item);
  }

  items.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0));
  return { items, error: null };
}
