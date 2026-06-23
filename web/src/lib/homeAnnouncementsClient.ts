import type { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type HomeAnnouncementSourceType = "institution" | "instructor";

export type HomeAnnouncementItem = {
  id: string;
  sourceType: HomeAnnouncementSourceType;
  title: string;
  content: string;
  linkUrl: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  ownerName: string;
};

export const HOME_ANNOUNCEMENTS_CAROUSEL_COUNT = 10;

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

function resolveInstructorDisplayName(
  instructor:
    | { full_name?: string | null; name?: string | null; surname?: string | null }
    | Array<{ full_name?: string | null; name?: string | null; surname?: string | null }>
    | null,
): string {
  const row = Array.isArray(instructor) ? instructor[0] ?? null : instructor;
  const fullName = String(row?.full_name ?? "").trim();
  if (fullName) return fullName;
  const name = String(row?.name ?? "").trim();
  const surname = String(row?.surname ?? "").trim();
  return [name, surname].filter(Boolean).join(" ");
}

function parseCreatedAtMs(iso: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export async function fetchHomeAnnouncements(
  supabase: SupabaseBrowserClient,
  options?: { limit?: number },
): Promise<{ items: HomeAnnouncementItem[]; error: unknown }> {
  const limit = options?.limit ?? HOME_ANNOUNCEMENTS_CAROUSEL_COUNT;
  const perSourceLimit = limit;

  const [institutionRes, instructorRes] = await Promise.all([
    supabase
      .from("announcements")
      .select(
        "id, title, content, announcement_image_url, link_url, created_at, institution:institutions(institution_name)",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(perSourceLimit),
    supabase
      .from("instructor_announcements")
      .select(
        "id, title, content, image_url, link_url, created_at, instructor:instructors(full_name, name, surname)",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(perSourceLimit),
  ]);

  const error = institutionRes.error ?? instructorRes.error ?? null;

  const institutionItems = ((institutionRes.data ?? []) as Array<{
    id: string | number;
    title: string | null;
    content: string | null;
    announcement_image_url: string | null;
    link_url: string | null;
    created_at: string | null;
    institution:
      | { institution_name: string | null }
      | Array<{ institution_name: string | null }>
      | null;
  }>)
    .map((row): HomeAnnouncementItem | null => {
      const title = String(row.title ?? "").trim();
      if (!title) return null;
      const institution = Array.isArray(row.institution)
        ? row.institution[0] ?? null
        : row.institution ?? null;
      return {
        id: `institution-${String(row.id)}`,
        sourceType: "institution",
        title,
        content: String(row.content ?? "").trim(),
        linkUrl: row.link_url ? String(row.link_url).trim() || null : null,
        imageUrl: row.announcement_image_url
          ? String(row.announcement_image_url).trim() || null
          : null,
        createdAt: row.created_at ? String(row.created_at) : null,
        ownerName: String(institution?.institution_name ?? "").trim(),
      };
    })
    .filter((item): item is HomeAnnouncementItem => item !== null);

  const instructorItems = ((instructorRes.data ?? []) as Array<{
    id: number;
    title: string | null;
    content: string | null;
    image_url: string | null;
    link_url: string | null;
    created_at: string | null;
    instructor:
      | { full_name?: string | null; name?: string | null; surname?: string | null }
      | Array<{ full_name?: string | null; name?: string | null; surname?: string | null }>
      | null;
  }>)
    .map((row): HomeAnnouncementItem | null => {
      const title = String(row.title ?? "").trim();
      if (!title) return null;
      return {
        id: `instructor-${String(row.id)}`,
        sourceType: "instructor",
        title,
        content: String(row.content ?? "").trim(),
        linkUrl: row.link_url ? String(row.link_url).trim() || null : null,
        imageUrl: row.image_url ? String(row.image_url).trim() || null : null,
        createdAt: row.created_at ? String(row.created_at) : null,
        ownerName: resolveInstructorDisplayName(row.instructor),
      };
    })
    .filter((item): item is HomeAnnouncementItem => item !== null);

  const items = [...institutionItems, ...instructorItems]
    .sort((a, b) => parseCreatedAtMs(b.createdAt) - parseCreatedAtMs(a.createdAt))
    .slice(0, limit);

  return { items, error };
}
