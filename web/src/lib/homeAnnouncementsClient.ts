import type { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  INSTRUCTOR_MEDIA_BUCKET,
  extractStoragePathFromPublicUrl,
} from "@/lib/instructorMediaClient";
import { PUBLIC_INSTRUCTORS_TABLE } from "@/lib/publicInstructorClient";
import { publicInstructorDisplayName } from "@/lib/publicInstructorClient";

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

export type AnnouncementsPageItem = {
  id: string;
  sourceType: HomeAnnouncementSourceType;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string | null;
  ownerName: string;
  ownerCity: string;
  categoryName: string;
  linkUrl: string | null;
};

export const HOME_ANNOUNCEMENTS_CAROUSEL_COUNT = 10;
const INSTRUCTOR_PUBLIC_CATEGORY_NAME = "Bireysel Eğitmen";

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

type PublicInstructorOwnerRow = {
  id: number;
  full_name?: string | null;
  name?: string | null;
  surname?: string | null;
  city?: string | null;
  district?: string | null;
};

type InstructorAnnouncementRow = {
  id: number;
  instructor_id: number;
  title: string | null;
  content: string | null;
  image_url: string | null;
  image_path: string | null;
  link_url: string | null;
  created_at: string | null;
};

type InstitutionAnnouncementRow = {
  id: string | number;
  title: string | null;
  content: string | null;
  announcement_image_url: string | null;
  link_url: string | null;
  created_at: string | null;
  institution:
    | {
        institution_name: string | null;
        city: string | null;
        institution_type?:
          | { category?: { name?: string | null } | Array<{ name?: string | null }> | null }
          | Array<{ category?: { name?: string | null } | Array<{ name?: string | null }> | null }>
          | null;
      }
    | Array<{
        institution_name: string | null;
        city: string | null;
        institution_type?:
          | { category?: { name?: string | null } | Array<{ name?: string | null }> | null }
          | Array<{ category?: { name?: string | null } | Array<{ name?: string | null }> | null }>
          | null;
      }>
    | null;
};

function parseCreatedAtMs(iso: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function normalizeOptionalUrl(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function resolveInstructorOwnerName(instructor: PublicInstructorOwnerRow | null | undefined): string {
  if (!instructor) return "";
  const fullName = String(instructor.full_name ?? "").trim();
  if (fullName) return fullName;
  return publicInstructorDisplayName(instructor);
}

function resolveInstructorOwnerCity(instructor: PublicInstructorOwnerRow | null | undefined): string {
  if (!instructor) return "";
  const district = String(instructor.district ?? "").trim();
  const city = String(instructor.city ?? "").trim();
  if (district && city) return `${district} / ${city}`;
  return district || city;
}

function resolveInstitutionCategoryName(
  institution: InstitutionAnnouncementRow["institution"],
): string {
  const row = Array.isArray(institution) ? institution[0] ?? null : institution ?? null;
  const typeJoin = row?.institution_type;
  const typeRow = Array.isArray(typeJoin) ? typeJoin[0] : typeJoin;
  const categoryJoin = typeRow?.category;
  const categoryRow = Array.isArray(categoryJoin) ? categoryJoin[0] : categoryJoin;
  return String(categoryRow?.name ?? "").trim();
}

function resolveInstructorAnnouncementImageUrl(
  supabase: SupabaseBrowserClient,
  imageUrl: string | null | undefined,
  imagePath: string | null | undefined,
): string | null {
  const direct = normalizeOptionalUrl(imageUrl);
  if (direct && /^https?:\/\//i.test(direct)) return direct;

  const pathFromColumn = String(imagePath ?? "").trim().replace(/^\/+/, "");
  const pathFromUrl =
    direct && !pathFromColumn
      ? extractStoragePathFromPublicUrl(direct, INSTRUCTOR_MEDIA_BUCKET)
      : null;
  const storagePath = pathFromColumn || pathFromUrl;
  if (storagePath) {
    const publicUrl =
      supabase.storage.from(INSTRUCTOR_MEDIA_BUCKET).getPublicUrl(storagePath).data.publicUrl ?? "";
    if (publicUrl) return publicUrl;
  }

  return direct;
}

async function fetchApprovedPublicInstructorMap(
  supabase: SupabaseBrowserClient,
  instructorIds: number[],
): Promise<{ map: Map<number, PublicInstructorOwnerRow>; error: unknown }> {
  const map = new Map<number, PublicInstructorOwnerRow>();
  const uniqueIds = [...new Set(instructorIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (uniqueIds.length === 0) return { map, error: null };

  const { data, error } = await supabase
    .from(PUBLIC_INSTRUCTORS_TABLE)
    .select("id, full_name, name, surname, city, district")
    .in("id", uniqueIds)
    .eq("is_active", true)
    .eq("is_approved", true);

  if (error) return { map, error };

  for (const row of (data ?? []) as PublicInstructorOwnerRow[]) {
    const id = Number(row.id);
    if (Number.isFinite(id) && id > 0) map.set(id, row);
  }

  return { map, error: null };
}

async function fetchPublicInstructorAnnouncementRows(
  supabase: SupabaseBrowserClient,
  rowLimit: number,
): Promise<{ rows: InstructorAnnouncementRow[]; error: unknown }> {
  const { data, error } = await supabase
    .from("instructor_announcements")
    .select("id, instructor_id, title, content, image_url, image_path, link_url, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(rowLimit);

  if (error) return { rows: [], error };
  return { rows: (data ?? []) as InstructorAnnouncementRow[], error: null };
}

async function fetchPublicInstructorAnnouncementItems(
  supabase: SupabaseBrowserClient,
  options?: { limit?: number },
): Promise<{ items: HomeAnnouncementItem[]; error: unknown }> {
  const limit = options?.limit ?? HOME_ANNOUNCEMENTS_CAROUSEL_COUNT;
  const { rows, error } = await fetchPublicInstructorAnnouncementRows(supabase, Math.max(limit * 4, limit));

  if (error) return { items: [], error };

  const instructorIds = rows.map((row) => Number(row.instructor_id));
  const { map: instructorById, error: instructorError } = await fetchApprovedPublicInstructorMap(
    supabase,
    instructorIds,
  );
  if (instructorError) return { items: [], error: instructorError };

  const items = rows
    .map((row): HomeAnnouncementItem | null => {
      const instructorId = Number(row.instructor_id);
      const instructor = instructorById.get(instructorId);
      if (!instructor) return null;

      const title = String(row.title ?? "").trim();
      if (!title) return null;

      return {
        id: `instructor-${String(row.id)}`,
        sourceType: "instructor",
        title,
        content: String(row.content ?? "").trim(),
        linkUrl: normalizeOptionalUrl(row.link_url),
        imageUrl: resolveInstructorAnnouncementImageUrl(supabase, row.image_url, row.image_path),
        createdAt: row.created_at ? String(row.created_at) : null,
        ownerName: resolveInstructorOwnerName(instructor),
      };
    })
    .filter((item): item is HomeAnnouncementItem => item !== null)
    .slice(0, limit);

  return { items, error: null };
}

async function fetchPublicInstitutionAnnouncementRows(
  supabase: SupabaseBrowserClient,
  rowLimit: number,
  includeCategory: boolean,
): Promise<{ rows: InstitutionAnnouncementRow[]; error: unknown }> {
  const institutionSelect = includeCategory
    ? "institution_name, city, institution_type:institution_types(category:institution_categories(name))"
    : "institution_name";

  const { data, error } = await supabase
    .from("announcements")
    .select(
      `id, title, content, announcement_image_url, link_url, created_at, institution:institutions(${institutionSelect})`,
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(rowLimit);

  if (error) return { rows: [], error };
  return { rows: (data ?? []) as InstitutionAnnouncementRow[], error: null };
}

function mapInstitutionRowToHomeItem(row: InstitutionAnnouncementRow): HomeAnnouncementItem | null {
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
    linkUrl: normalizeOptionalUrl(row.link_url),
    imageUrl: normalizeOptionalUrl(row.announcement_image_url),
    createdAt: row.created_at ? String(row.created_at) : null,
    ownerName: String(institution?.institution_name ?? "").trim(),
  };
}

function mapInstitutionRowToPageItem(row: InstitutionAnnouncementRow): AnnouncementsPageItem | null {
  const homeItem = mapInstitutionRowToHomeItem(row);
  if (!homeItem) return null;

  const institution = Array.isArray(row.institution)
    ? row.institution[0] ?? null
    : row.institution ?? null;

  return {
    ...homeItem,
    ownerCity: String(institution?.city ?? "").trim(),
    categoryName: resolveInstitutionCategoryName(row.institution),
  };
}

async function fetchPublicInstitutionAnnouncementItems(
  supabase: SupabaseBrowserClient,
  options?: { limit?: number },
): Promise<{ items: HomeAnnouncementItem[]; error: unknown }> {
  const limit = options?.limit ?? HOME_ANNOUNCEMENTS_CAROUSEL_COUNT;
  const { rows, error } = await fetchPublicInstitutionAnnouncementRows(supabase, limit, false);
  if (error) return { items: [], error };

  const items = rows
    .map((row) => mapInstitutionRowToHomeItem(row))
    .filter((item): item is HomeAnnouncementItem => item !== null);

  return { items, error: null };
}

export async function fetchHomeAnnouncements(
  supabase: SupabaseBrowserClient,
  options?: { limit?: number },
): Promise<{ items: HomeAnnouncementItem[]; error: unknown }> {
  const limit = options?.limit ?? HOME_ANNOUNCEMENTS_CAROUSEL_COUNT;

  const [institutionResult, instructorResult] = await Promise.all([
    fetchPublicInstitutionAnnouncementItems(supabase, { limit }),
    fetchPublicInstructorAnnouncementItems(supabase, { limit }),
  ]);

  if (instructorResult.error) {
    console.warn("[home-announcements] instructor announcements:", instructorResult.error);
  }

  const items = [...institutionResult.items, ...instructorResult.items]
    .sort((a, b) => parseCreatedAtMs(b.createdAt) - parseCreatedAtMs(a.createdAt))
    .slice(0, limit);

  return {
    items,
    error: institutionResult.error ?? null,
  };
}

export async function fetchAnnouncementsPageItems(
  supabase: SupabaseBrowserClient,
): Promise<{ items: AnnouncementsPageItem[]; error: unknown }> {
  const rowLimit = 200;

  const [institutionRowsResult, instructorRowsResult] = await Promise.all([
    fetchPublicInstitutionAnnouncementRows(supabase, rowLimit, true),
    fetchPublicInstructorAnnouncementRows(supabase, rowLimit),
  ]);

  if (instructorRowsResult.error) {
    console.warn("[announcements-page] instructor announcements:", instructorRowsResult.error);
  }

  if (institutionRowsResult.error) {
    return { items: [], error: institutionRowsResult.error };
  }

  const institutionItems = institutionRowsResult.rows
    .map((row) => mapInstitutionRowToPageItem(row))
    .filter((item): item is AnnouncementsPageItem => item !== null);

  const instructorIds = instructorRowsResult.rows.map((row) => Number(row.instructor_id));
  const { map: instructorById, error: instructorMapError } = await fetchApprovedPublicInstructorMap(
    supabase,
    instructorIds,
  );

  if (instructorMapError) {
    console.warn("[announcements-page] instructor profiles:", instructorMapError);
  }

  const instructorItems = instructorRowsResult.rows
    .map((row): AnnouncementsPageItem | null => {
      const instructorId = Number(row.instructor_id);
      const instructor = instructorById.get(instructorId);
      if (!instructor) return null;

      const title = String(row.title ?? "").trim();
      if (!title) return null;

      return {
        id: `instructor-${String(row.id)}`,
        sourceType: "instructor",
        title,
        content: String(row.content ?? "").trim(),
        imageUrl: resolveInstructorAnnouncementImageUrl(supabase, row.image_url, row.image_path),
        createdAt: row.created_at ? String(row.created_at) : null,
        ownerName: resolveInstructorOwnerName(instructor),
        ownerCity: resolveInstructorOwnerCity(instructor),
        categoryName: INSTRUCTOR_PUBLIC_CATEGORY_NAME,
        linkUrl: normalizeOptionalUrl(row.link_url),
      };
    })
    .filter((item): item is AnnouncementsPageItem => item !== null);

  const items = [...institutionItems, ...instructorItems].sort(
    (a, b) => parseCreatedAtMs(b.createdAt) - parseCreatedAtMs(a.createdAt),
  );

  return { items, error: null };
}
