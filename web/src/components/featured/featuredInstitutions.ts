import type { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FEATURED_ACCOUNTS_TABLE,
  FEATURED_ACCOUNT_TYPE_INSTITUTION,
  FEATURED_ACCOUNT_TYPE_INSTRUCTOR,
} from "@/lib/featuredAccountsClient";
import { resolveInstitutionLogoPublicUrl } from "@/lib/institutionHelpers";
import { fetchInstructorPriceRangeLabelsByInstructorIdsClient } from "@/lib/instructorFeaturesClient";
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

/** Öne çıkanlar sayfasındaki 8 ana kategori bölümü */
export const FEATURED_PAGE_CATEGORY_SECTIONS: ReadonlyArray<{
  heading: string;
  matchKeys: readonly string[];
}> = [
  { heading: "Okul Kategorisinde Öne Çıkanlar", matchKeys: ["okul"] },
  {
    heading: "Kurs & Sınava Hazırlık Kategorisinde Öne Çıkanlar",
    matchKeys: ["kurs sinava hazirlik", "kurs ve sinava hazirlik", "sinava hazirlik"],
  },
  { heading: "Özel Eğitim Kategorisinde Öne Çıkanlar", matchKeys: ["ozel egitim"] },
  { heading: "Kişisel Gelişim Kategorisinde Öne Çıkanlar", matchKeys: ["kisisel gelisim"] },
  { heading: "Mesleki Eğitim Kategorisinde Öne Çıkanlar", matchKeys: ["mesleki egitim"] },
  { heading: "Spor Kategorisinde Öne Çıkanlar", matchKeys: ["spor"] },
  { heading: "Sanat Kategorisinde Öne Çıkanlar", matchKeys: ["sanat"] },
  {
    heading: "Yabancı Dil Kategorisinde Öne Çıkanlar",
    matchKeys: ["yabanci dil", "yabanci diller"],
  },
];

export function normalizeCategoryKeyForFeatured(value: string): string {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function institutionMatchesFeaturedCategory(
  institution: { bodyMainCategory: string },
  matchKeys: readonly string[],
): boolean {
  const nameKey = normalizeCategoryKeyForFeatured(institution.bodyMainCategory);
  return matchKeys.some((k) => {
    const key = normalizeCategoryKeyForFeatured(k);
    if (!key) return false;
    if (nameKey === key) return true;
    if (nameKey.includes(key)) return true;
    if (key.includes(nameKey) && nameKey.length >= 4) return true;
    return false;
  });
}

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
): Promise<FeaturedAccountRow[]> {
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
      console.error("[home-featured] featured_accounts load error:", error.message);
      break;
    }

    const batch = (data ?? []) as FeaturedAccountRow[];
    rows.push(...batch);

    if (batch.length < FEATURED_ACCOUNTS_PAGE_SIZE) break;
  }

  return rows;
}

async function fetchApprovedInstitutionRowsByIds(
  supabase: SupabaseBrowser,
  orderedIds: number[],
): Promise<Map<number, Record<string, unknown>>> {
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
        console.error("[home-featured] institutions load error:", error.message);
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

  return institutionById;
}

async function fetchApprovedInstructorRowsByIds(
  supabase: SupabaseBrowser,
  orderedIds: number[],
): Promise<Map<number, PublicInstructorListRow>> {
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
        console.error("[home-featured] instructors load error:", error.message);
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

  return instructorById;
}

export async function fetchHomeFeaturedAccountsFromFeaturedAccounts(
  supabase: SupabaseBrowser,
): Promise<HomeFeaturedAccountItem[]> {
  const accountRows = await fetchAllActiveFeaturedAccountsOrdered(supabase);
  if (accountRows.length === 0) return [];

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

  const [institutionById, instructorById] = await Promise.all([
    fetchApprovedInstitutionRowsByIds(supabase, Array.from(institutionIds)),
    fetchApprovedInstructorRowsByIds(supabase, Array.from(instructorIds)),
  ]);

  const instructorPriceLabels = await fetchInstructorPriceRangeLabelsByInstructorIdsClient(
    Array.from(instructorIds),
    supabase,
  );

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
      const instructor = mapPublicInstructorToFeaturedItem(
        instructorRow,
        supabase,
        instructorPriceLabels.get(id),
      );
      if (!instructor) continue;
      result.push({ kind: "instructor", instructor });
    }
  }

  return result;
}

/** @deprecated fetchHomeFeaturedAccountsFromFeaturedAccounts kullanın */
export async function fetchHomeFeaturedInstitutionsFromAccounts(
  supabase: SupabaseBrowser,
): Promise<FeaturedInstitution[]> {
  const accounts = await fetchHomeFeaturedAccountsFromFeaturedAccounts(supabase);
  return accounts
    .filter((item): item is { kind: "institution"; institution: FeaturedInstitution } =>
      item.kind === "institution",
    )
    .map((item) => item.institution);
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
