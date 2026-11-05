import type { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FEATURED_ACCOUNTS_TABLE,
  FEATURED_ACCOUNT_TYPE_INSTITUTION,
  FEATURED_ACCOUNT_TYPE_INSTRUCTOR,
} from "@/lib/featuredAccountsClient";
import { resolveInstitutionLogoPublicUrl } from "@/lib/institutionHelpers";
import { isAbortLikeError } from "@/lib/isAbortLikeError";
import { PUBLIC_INSTRUCTORS_TABLE } from "@/lib/publicInstructorClient";
import {
  PUBLIC_INSTRUCTOR_LIST_SELECT,
  enrichPublicInstructorListRows,
  mapPublicInstructorToFeaturedItem,
  type FeaturedInstructorItem,
  type PublicInstructorListRow,
} from "@/lib/publicInstructorSearch";

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

export type FeaturedInstitution = {
  id: number;
  name: string;
  imageUrl: string;
  slug: string;
  source: string;
  bodyMainCategory: string;
  bodyLocation: string;
};

export type HomeFeaturedAccountItem =
  | { kind: "institution"; institution: FeaturedInstitution }
  | { kind: "instructor"; instructor: FeaturedInstructorItem };

function resolveInstitutionCategoryName(row: Record<string, unknown>): string {
  const typeJoin = row.institution_type;
  const typeRow = Array.isArray(typeJoin) ? typeJoin[0] : typeJoin;
  if (!typeRow || typeof typeRow !== "object") return "";

  const categoryJoin = (typeRow as { category?: unknown }).category;
  const categoryRow = Array.isArray(categoryJoin) ? categoryJoin[0] : categoryJoin;
  if (!categoryRow || typeof categoryRow !== "object") return "";

  return String((categoryRow as { name?: unknown }).name ?? "").trim();
}

export function mapInstitutionRowToFeatured(
  supabase: SupabaseBrowser,
  row: Record<string, unknown>,
): FeaturedInstitution | null {
  const id = Number(row.id);
  const name = String(row.institution_name ?? "").trim();
  if (!Number.isFinite(id) || !name) return null;

  const mainCategory = resolveInstitutionCategoryName(row);
  const city = String(row.city ?? "").trim();
  const district = String(row.district ?? "").trim();
  const location = [district, city].filter(Boolean).join(", ");
  const logoUrl = resolveInstitutionLogoPublicUrl(supabase, String(row.logo ?? ""));

  return {
    id,
    name,
    imageUrl: logoUrl,
    slug: String(row.slug ?? "").trim(),
    source: String(row.source ?? "").trim(),
    bodyMainCategory: mainCategory,
    bodyLocation: location || "Konum bilgisi yok",
  };
}

/** Ana sayfa Öne Çıkanlar — sabit kurumlar (Deneme hariç ID ile) */
export const HOME_FEATURED_PINNED_IDS = [104, 200] as const;

/** ID ile bulunamazsa isimle yedek arama */
export const HOME_FEATURED_PINNED_NAME_BY_ID: Record<number, readonly string[]> = {
  104: ["ODTÜ GELİŞTİRME VAKFI ÖZEL LİSESİ"],
  200: ["ÖZEL BİLFEN ÇAYYOLU FEN LİSESİ"],
};

/** Ana sayfa Öne Çıkanlar grid — sabit bireysel eğitmen (1 tabanlı 4. sıra) */
export const HOME_FEATURED_PINNED_INSTRUCTOR_SLUG = "nur-sude-var-1";
export const HOME_FEATURED_PINNED_INSTRUCTOR_POSITION = 3;

export const HOME_FEATURED_PINNED_ROW_SELECT =
  "id, slug, source, institution_name, type, city, district, logo, institution_type:institution_types(name, category:institution_categories(name))";

const FEATURED_ACCOUNTS_PAGE_SIZE = 1000;
const ENTITY_ID_CHUNK_SIZE = 120;

type FeaturedAccountRow = {
  id: number;
  account_type: string;
  institution_id: number | string | null;
  instructor_id: number | string | null;
  display_order: number | null;
  is_active: boolean;
};

function rowId(row: Record<string, unknown>): number {
  return Number(row.id);
}

export async function fetchHomeFeaturedPinnedRows(
  supabase: SupabaseBrowser,
): Promise<Record<string, unknown>[]> {
  const ordered: Record<string, unknown>[] = [];
  const foundIds = new Set<number>();

  const pushRow = (row: Record<string, unknown> | null | undefined) => {
    if (!row) return;
    const id = rowId(row);
    if (!Number.isFinite(id) || foundIds.has(id)) return;
    const name = String(row.institution_name ?? "").trim();
    if (!name) return;
    ordered.push(row);
    foundIds.add(id);
  };

  const denemeResult = await supabase
    .from("institutions")
    .select(HOME_FEATURED_PINNED_ROW_SELECT)
    .eq("institution_name", "Deneme")
    .eq("is_approved", true)
    .maybeSingle();

  if (denemeResult.error) {
    console.warn("[home-featured] Deneme pinned load error:", denemeResult.error.message);
  } else {
    pushRow(denemeResult.data as Record<string, unknown> | null);
  }

  const byIdResult = await supabase
    .from("institutions")
    .select(HOME_FEATURED_PINNED_ROW_SELECT)
    .in("id", [...HOME_FEATURED_PINNED_IDS])
    .eq("is_approved", true);

  if (byIdResult.error) {
    console.warn("[home-featured] Pinned IDs load error:", byIdResult.error.message);
  } else {
    const byIdRows = (byIdResult.data ?? []) as Array<Record<string, unknown>>;
    for (const pinnedId of HOME_FEATURED_PINNED_IDS) {
      const row = byIdRows.find((r) => rowId(r) === pinnedId);
      pushRow(row);
    }
  }

  for (const pinnedId of HOME_FEATURED_PINNED_IDS) {
    if (foundIds.has(pinnedId)) continue;
    const names = HOME_FEATURED_PINNED_NAME_BY_ID[pinnedId];
    if (!names?.length) continue;

    const byNameResult = await supabase
      .from("institutions")
      .select(HOME_FEATURED_PINNED_ROW_SELECT)
      .in("institution_name", [...names])
      .eq("is_approved", true)
      .limit(1);

    if (byNameResult.error) {
      console.warn(
        `[home-featured] Pinned name fallback (${pinnedId}) error:`,
        byNameResult.error.message,
      );
      continue;
    }

    const first = (byNameResult.data ?? [])[0] as Record<string, unknown> | undefined;
    pushRow(first);
  }

  return ordered;
}

async function fetchAllActiveFeaturedAccountsOrdered(
  supabase: SupabaseBrowser,
): Promise<{ rows: FeaturedAccountRow[]; failed: boolean }> {
  const rows: FeaturedAccountRow[] = [];

  for (let page = 0; page < 50; page += 1) {
    const from = page * FEATURED_ACCOUNTS_PAGE_SIZE;
    const to = from + FEATURED_ACCOUNTS_PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from(FEATURED_ACCOUNTS_TABLE)
      .select("id, account_type, institution_id, instructor_id, display_order, is_active")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .range(from, to);

    if (error) {
      if (!isAbortLikeError(error)) {
        console.error("[home-featured] featured_accounts load error:", error.message);
        return { rows, failed: true };
      }
      break;
    }

    const batch = (data ?? []) as FeaturedAccountRow[];
    rows.push(...batch);

    if (batch.length < FEATURED_ACCOUNTS_PAGE_SIZE) break;
  }

  return { rows, failed: false };
}

async function fetchApprovedInstitutionRowsByIds(
  supabase: SupabaseBrowser,
  orderedIds: number[],
): Promise<{ rows: Map<number, Record<string, unknown>>; failed: boolean }> {
  const institutionById = new Map<number, Record<string, unknown>>();

  for (let index = 0; index < orderedIds.length; index += ENTITY_ID_CHUNK_SIZE) {
    const chunk = orderedIds.slice(index, index + ENTITY_ID_CHUNK_SIZE);

    for (let page = 0; page < 50; page += 1) {
      const from = page * ENTITY_ID_CHUNK_SIZE;
      const to = from + ENTITY_ID_CHUNK_SIZE - 1;

      const { data, error } = await supabase
        .from("institutions")
        .select(HOME_FEATURED_PINNED_ROW_SELECT)
        .in("id", chunk)
        .eq("is_approved", true)
        .range(from, to);

      if (error) {
        if (!isAbortLikeError(error)) {
          console.error("[home-featured] institutions load error:", error.message);
          return { rows: institutionById, failed: true };
        }
        break;
      }

      const batch = (data ?? []) as Array<Record<string, unknown>>;
      for (const row of batch) {
        const id = Number(row.id);
        if (Number.isFinite(id)) institutionById.set(id, row);
      }

      if (batch.length < ENTITY_ID_CHUNK_SIZE) break;
    }
  }

  return { rows: institutionById, failed: false };
}

async function fetchApprovedInstructorRowsByIds(
  supabase: SupabaseBrowser,
  orderedIds: number[],
): Promise<{ rows: Map<number, PublicInstructorListRow>; failed: boolean }> {
  const instructorById = new Map<number, PublicInstructorListRow>();

  for (let index = 0; index < orderedIds.length; index += ENTITY_ID_CHUNK_SIZE) {
    const chunk = orderedIds.slice(index, index + ENTITY_ID_CHUNK_SIZE);

    for (let page = 0; page < 50; page += 1) {
      const from = page * ENTITY_ID_CHUNK_SIZE;
      const to = from + ENTITY_ID_CHUNK_SIZE - 1;

      const { data, error } = await supabase
        .from(PUBLIC_INSTRUCTORS_TABLE)
        .select(PUBLIC_INSTRUCTOR_LIST_SELECT)
        .in("id", chunk)
        .eq("is_active", true)
        .eq("is_approved", true)
        .range(from, to);

      if (error) {
        if (!isAbortLikeError(error)) {
          console.error("[home-featured] instructors load error:", error.message);
          return { rows: instructorById, failed: true };
        }
        break;
      }

      const batch = (data ?? []) as PublicInstructorListRow[];
      for (const row of batch) {
        const id = Number(row.id);
        if (Number.isFinite(id)) instructorById.set(id, row);
      }

      if (batch.length < ENTITY_ID_CHUNK_SIZE) break;
    }
  }

  const enrichedRows = await enrichPublicInstructorListRows(
    Array.from(instructorById.values()),
    supabase,
  );
  instructorById.clear();
  for (const row of enrichedRows) {
    const id = Number(row.id);
    if (Number.isFinite(id)) instructorById.set(id, row);
  }

  return { rows: instructorById, failed: false };
}

export async function fetchHomeFeaturedAccountsFromFeaturedAccounts(
  supabase: SupabaseBrowser,
): Promise<{ items: HomeFeaturedAccountItem[]; failed: boolean }> {
  const accounts = await fetchAllActiveFeaturedAccountsOrdered(supabase);
  if (accounts.failed) return { items: [], failed: true };
  const accountRows = accounts.rows;
  if (accountRows.length === 0) return { items: [], failed: false };

  const institutionIds = new Set<number>();
  const instructorIds = new Set<number>();

  for (const row of accountRows) {
    if (row.account_type === FEATURED_ACCOUNT_TYPE_INSTITUTION) {
      const id = Number(row.institution_id);
      if (Number.isFinite(id) && id > 0) institutionIds.add(id);
      continue;
    }
    if (row.account_type === FEATURED_ACCOUNT_TYPE_INSTRUCTOR) {
      const id = Number(row.instructor_id);
      if (Number.isFinite(id) && id > 0) instructorIds.add(id);
    }
  }

  const [institutions, instructors] = await Promise.all([
    fetchApprovedInstitutionRowsByIds(supabase, Array.from(institutionIds)),
    fetchApprovedInstructorRowsByIds(supabase, Array.from(instructorIds)),
  ]);
  if (institutions.failed || instructors.failed) return { items: [], failed: true };
  const institutionById = institutions.rows;
  const instructorById = instructors.rows;

  const result: HomeFeaturedAccountItem[] = [];

  for (const row of accountRows) {
    if (row.account_type === FEATURED_ACCOUNT_TYPE_INSTITUTION) {
      const id = Number(row.institution_id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const institutionRow = institutionById.get(id);
      if (!institutionRow) continue;
      const institution = mapInstitutionRowToFeatured(supabase, institutionRow);
      if (!institution) continue;
      result.push({ kind: "institution", institution });
      continue;
    }

    if (row.account_type === FEATURED_ACCOUNT_TYPE_INSTRUCTOR) {
      const id = Number(row.instructor_id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const instructorRow = instructorById.get(id);
      if (!instructorRow) continue;
      const instructor = mapPublicInstructorToFeaturedItem(instructorRow, supabase);
      if (!instructor) continue;
      result.push({ kind: "instructor", instructor });
    }
  }

  return { items: result, failed: false };
}

type HomeFeaturedAccountsLoadResult = {
  items: HomeFeaturedAccountItem[];
  failed: boolean;
};

/** Ana sayfa oturumu boyunca tek fetch — panel aç/kapa yeni Supabase sorgusu üretmez. */
let homeFeaturedAccountsShared: Promise<HomeFeaturedAccountsLoadResult> | null = null;
let homeFeaturedAccountsResolved: HomeFeaturedAccountsLoadResult | null = null;

export function loadHomeFeaturedAccountsShared(
  supabase: SupabaseBrowser,
): Promise<HomeFeaturedAccountsLoadResult> {
  if (homeFeaturedAccountsResolved) {
    return Promise.resolve(homeFeaturedAccountsResolved);
  }
  if (!homeFeaturedAccountsShared) {
    homeFeaturedAccountsShared = fetchHomeFeaturedAccountsFromFeaturedAccounts(supabase)
      .then((result) => {
        homeFeaturedAccountsResolved = result;
        return result;
      })
      .finally(() => {
        homeFeaturedAccountsShared = null;
      });
  }
  return homeFeaturedAccountsShared;
}

/** Öne çıkanlar listesi retry öncesi paylaşılan sonucu geçersiz kılar. */
export function invalidateHomeFeaturedAccountsShared(): void {
  homeFeaturedAccountsShared = null;
  homeFeaturedAccountsResolved = null;
}

export async function fetchHomeFeaturedPinnedInstructorRow(
  supabase: SupabaseBrowser,
): Promise<PublicInstructorListRow | null> {
  const { data, error } = await supabase
    .from(PUBLIC_INSTRUCTORS_TABLE)
    .select(PUBLIC_INSTRUCTOR_LIST_SELECT)
    .eq("slug", HOME_FEATURED_PINNED_INSTRUCTOR_SLUG)
    .eq("is_active", true)
    .eq("is_approved", true)
    .maybeSingle();

  if (error) {
    console.warn("[home-featured] Pinned instructor load error:", error.message);
    return null;
  }

  const row = data as PublicInstructorListRow | null;
  if (!row || !Number.isFinite(Number(row.id)) || Number(row.id) <= 0) return null;
  return row;
}
