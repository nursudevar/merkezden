import type { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  INSTRUCTOR_MEDIA_BUCKET,
  extractStoragePathFromPublicUrl,
} from "@/lib/instructorMediaClient";
import { PUBLIC_INSTRUCTORS_TABLE } from "@/lib/publicInstructorClient";
import { publicInstructorDisplayName } from "@/lib/publicInstructorClient";
import { normalizeAnnouncementTag } from "@/lib/announcementTags";
import {
  buildLocationAdMaps,
  formatAnnouncementLocationLabel,
  lookupLocationAds,
  parseLocationId,
} from "@/lib/turkiyeLocationsClient";

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
  announcementTag: string | null;
  ownerHref: string | null;
};

export type AnnouncementsPageItem = {
  id: string;
  sourceType: HomeAnnouncementSourceType;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string | null;
  ownerName: string;
  locationLabel: string;
  il_id: number | null;
  ilce_id: number | null;
  categoryName: string;
  linkUrl: string | null;
  announcementTag: string | null;
  ownerHref: string | null;
};

export const HOME_ANNOUNCEMENTS_CAROUSEL_COUNT = 10;

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

type PublicInstructorOwnerRow = {
  id: number;
  full_name?: string | null;
  name?: string | null;
  surname?: string | null;
  il_id?: number | null;
  ilce_id?: number | null;
  locationIlAd?: string | null;
  locationIlceAd?: string | null;
  slug?: string | null;
  category_id?: number | null;
  categoryName?: string | null;
};

type InstructorAnnouncementRow = {
  id: number;
  instructor_id: number;
  title: string | null;
  content: string | null;
  image_url: string | null;
  image_path: string | null;
  link_url: string | null;
  announcement_tag: string | null;
  created_at: string | null;
  il_id?: number | null;
  ilce_id?: number | null;
};

type InstitutionCategoryJoin =
  | { name?: string | null }
  | Array<{ name?: string | null }>
  | null;

type InstitutionOwnerJoin = {
  institution_name: string | null;
  slug?: string | null;
  city: string | null;
  il_id?: number | null;
  ilce_id?: number | null;
  category?: InstitutionCategoryJoin;
  institution_type?:
    | { category?: InstitutionCategoryJoin }
    | Array<{ category?: InstitutionCategoryJoin }>
    | null;
};

type InstitutionAnnouncementRow = {
  id: string | number;
  title: string | null;
  content: string | null;
  announcement_image_url: string | null;
  link_url: string | null;
  announcement_tag: string | null;
  created_at: string | null;
  il_id?: number | null;
  ilce_id?: number | null;
  institution: InstitutionOwnerJoin | InstitutionOwnerJoin[] | null;
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

async function attachInstructorOwnerLocationAds(
  rows: PublicInstructorOwnerRow[],
): Promise<PublicInstructorOwnerRow[]> {
  const maps = await buildLocationAdMaps(rows);
  return rows.map((row) => {
    const { ilAd, ilceAd } = lookupLocationAds(row.il_id, row.ilce_id, maps);
    return { ...row, locationIlAd: ilAd, locationIlceAd: ilceAd };
  });
}

function firstJoin<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function resolveJoinedCategoryName(join: InstitutionCategoryJoin | undefined): string {
  const row = firstJoin(join ?? null);
  return String(row?.name ?? "").trim();
}

function resolveInstitutionCategoryName(
  institution: InstitutionAnnouncementRow["institution"],
): string {
  const row = firstJoin(institution);
  const directCategoryName = resolveJoinedCategoryName(row?.category);
  if (directCategoryName) return directCategoryName;
  const typeRow = firstJoin(row?.institution_type);
  return resolveJoinedCategoryName(typeRow?.category);
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

async function attachInstructorOwnerCategoryNames(
  supabase: SupabaseBrowserClient,
  rows: PublicInstructorOwnerRow[],
): Promise<PublicInstructorOwnerRow[]> {
  const categoryIds = [
    ...new Set(
      rows
        .map((row) => Number(row.category_id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  if (categoryIds.length === 0) {
    return rows.map((row) => ({ ...row, categoryName: "" }));
  }

  const { data, error } = await supabase
    .from("instructor_categories")
    .select("id, name")
    .in("id", categoryIds)
    .eq("is_active", true);

  if (error) {
    console.warn("[announcements-page] instructor categories:", error);
    return rows.map((row) => ({ ...row, categoryName: "" }));
  }

  const nameById = new Map<number, string>();
  for (const row of data ?? []) {
    const id = Number((row as { id?: unknown }).id);
    const name = String((row as { name?: unknown }).name ?? "").trim();
    if (Number.isFinite(id) && id > 0 && name) nameById.set(id, name);
  }

  return rows.map((row) => {
    const categoryId = Number(row.category_id);
    return {
      ...row,
      categoryName:
        Number.isFinite(categoryId) && categoryId > 0 ? nameById.get(categoryId) ?? "" : "",
    };
  });
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
    .select("id, full_name, name, surname, il_id, ilce_id, slug, category_id")
    .in("id", uniqueIds)
    .eq("is_active", true)
    .eq("is_approved", true);

  if (error) return { map, error };

  const locatedRows = await attachInstructorOwnerLocationAds(
    (data ?? []) as PublicInstructorOwnerRow[],
  );
  const categorizedRows = await attachInstructorOwnerCategoryNames(supabase, locatedRows);
  for (const row of categorizedRows) {
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
    .select("id, instructor_id, title, content, image_url, image_path, link_url, announcement_tag, created_at, il_id, ilce_id")
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
        announcementTag: normalizeAnnouncementTag(row.announcement_tag),
        ownerHref: `/egitmenler/${encodeURIComponent(String(instructor.slug ?? "").trim() || String(instructorId))}`,
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
    ? "institution_name, city, slug, il_id, ilce_id, category:institution_categories(name), institution_type:institution_types(category:institution_categories(name))"
    : "institution_name, slug";

  const { data, error } = await supabase
    .from("announcements")
    .select(
      `id, title, content, announcement_image_url, link_url, announcement_tag, created_at, il_id, ilce_id, institution:institutions(${institutionSelect})`,
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
    announcementTag: normalizeAnnouncementTag(row.announcement_tag),
    ownerHref: String(institution?.slug ?? "").trim()
      ? `/kurumlar/${String(institution?.slug ?? "").trim()}`
      : null,
  };
}

function mapInstitutionRowToPageItem(row: InstitutionAnnouncementRow): AnnouncementsPageItem | null {
  const homeItem = mapInstitutionRowToHomeItem(row);
  if (!homeItem) return null;

  return {
    ...homeItem,
    locationLabel: "",
    il_id: parseLocationId(row.il_id),
    ilce_id: parseLocationId(row.ilce_id),
    categoryName: resolveInstitutionCategoryName(row.institution),
  };
}

async function attachAnnouncementLocationLabels(
  items: AnnouncementsPageItem[],
): Promise<AnnouncementsPageItem[]> {
  const maps = await buildLocationAdMaps(items);
  return items.map((item) => {
    const { ilAd, ilceAd } = lookupLocationAds(item.il_id, item.ilce_id, maps);
    return {
      ...item,
      locationLabel: formatAnnouncementLocationLabel(ilAd, ilceAd),
    };
  });
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
        locationLabel: "",
        il_id: parseLocationId(row.il_id),
        ilce_id: parseLocationId(row.ilce_id),
        categoryName: String(instructor.categoryName ?? "").trim(),
        linkUrl: normalizeOptionalUrl(row.link_url),
        announcementTag: normalizeAnnouncementTag(row.announcement_tag),
        ownerHref: `/egitmenler/${encodeURIComponent(String(instructor.slug ?? "").trim() || String(instructorId))}`,
      };
    })
    .filter((item): item is AnnouncementsPageItem => item !== null);

  const items = await attachAnnouncementLocationLabels(
    [...institutionItems, ...instructorItems].sort(
      (a, b) => parseCreatedAtMs(b.createdAt) - parseCreatedAtMs(a.createdAt),
    ),
  );

  return { items, error: null };
}
