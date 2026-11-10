"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  inputHHMMToDbTimeOrNull,
  resolveInstitutionLogoPublicUrl,
} from "@/lib/institutionHelpers";
import { fetchInstitutionCategoryBySlug } from "@/lib/categoryHelpers";
import type { SchoolCategoryFilterPayload } from "@/components/category/schoolCategoryFilterTypes";
import { resolveCategoryListingIlId } from "@/components/category/categoryLocationFilter";
import { parseLocationId } from "@/lib/turkiyeLocationsClient";
import {
  parsePriceInputToIntOrNull,
  resolveInstitutionIdsByPriceRange,
} from "@/lib/institutionPriceRangeFilter";
import {
  applyInstructorListingFilters,
  buildInstructorListingFiltersFromSchoolPayload,
  fetchPublicInstructorsForListing,
  mapPublicInstructorToListItem,
  resolveInstitutionCategoryIdByName,
  resolveInstructorCategoryIdBySlugOrName,
  resolveInstructorIdsByPriceRange,
} from "@/lib/publicInstructorSearch";
import {
  buildProfileSearchVariants,
  escapeProfileLikeValue,
  resolveInstitutionIdsByProfileSearch,
} from "@/lib/profileSearch";
import { fetchAllPostgrestPages } from "@/lib/postgrestQueryPages";
import {
  fetchActiveFeaturedInstitutionOrderMap,
  sortWithFeaturedPriority,
  type FeaturedOrderMap,
} from "@/lib/featuredAccountsClient";
import {
  extractStudentAgeFilterQueryFromRangePayload,
  isStudentAgeFilterDefinitionId,
  isStudentAgeFilterTextActive,
  resolveInstitutionIdsByStudentAgeFilter,
  resolveStudentAgeFilterFromPayload,
} from "@/lib/institutionStudentAgeFilter";
import { isLegacyStudentAgeMultiSelectFeature } from "@/lib/studentAgeRangeFeature";
import { getHighSchoolTypeLabel, LISE_INSTITUTION_TYPE_ID } from "@/lib/schoolInstitutionTypes";
import { isOkulDurumuDefinition } from "@/lib/institutionSchoolStatusFilter";

export type CategoryResultItem = {
  id: string;
  resultType?: "institution" | "instructor";
  name: string;
  description: string;
  location: string;
  price: string | number;
  ageRange: string;
  badges: string[];
  logoInitial?: string;
  logoColor?: string;
  imageUrl?: string;
  slug?: string;
  source?: string | null;
  subcategoryName?: string;
  detailUrl?: string;
  instructorTitle?: string;
  instructorBranch?: string;
  priceRange?: string;
  /** Gerçek `institutions.id`; presentation `id` alanından bağımsız. */
  institutionId?: number;
  /** Gerçek `instructors.id`; presentation `id` alanından bağımsız. */
  instructorId?: number;
  /** Harita marker birleştirmesi için liste satırından taşınan alanlar */
  mapAddress?: string;
  mapCity?: string;
  mapDistrict?: string;
  officialPhone?: string;
  officialEmail?: string;
  institutionTypeName?: string;
  mapCategoryName?: string;
  mapCategorySlug?: string;
  mapCategoryId?: number | null;
};

type InstitutionTypeJoinRow =
  | {
      name: string | null;
      category?:
        | { id?: number | null; name?: string | null; slug?: string | null }
        | Array<{ id?: number | null; name?: string | null; slug?: string | null }>
        | null;
    }
  | Array<{
      name: string | null;
      category?:
        | { id?: number | null; name?: string | null; slug?: string | null }
        | Array<{ id?: number | null; name?: string | null; slug?: string | null }>
        | null;
    }>
  | null;

type InstitutionRow = {
  id: number;
  slug: string | null;
  institution_name: string | null;
  subheading: string | null;
  about?: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  official_phone: string | null;
  official_email: string | null;
  website: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  x_url?: string | null;
  linkedin_url?: string | null;
  logo: string | null;
  source: string | null;
  high_school_type?: string | null;
  institution_type?: InstitutionTypeJoinRow;
};

const FALLBACK = "-";
const IN_CHUNK = 120;
/** PostgREST varsayılan max_rows (1000) — yalnızca ID çözümleme sayfalaması */
const QUERY_PAGE_SIZE = 1000;
const MAX_QUERY_PAGES = 50;
/** CategoryResultsList sayfa boyutu ile eşleşmeli */
export const CATEGORY_RESULTS_PAGE_SIZE = 30;
/** Aktif sayfanın önünde sırayla prefetch edilecek sayfa sayısı */
const CATEGORY_PREFETCH_AHEAD = 2;
/** Aynı sorgu için önbellekte tutulacak maksimum sayfa (3 × 30 = 90 kayıt) */
const CATEGORY_MAX_CACHED_PAGES = 3;

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

/**
 * Filtreye bağımsız listing metadata (featured / kategori / defs).
 * Filtrelenmiş ID'ler, sayfa sonuçları veya totalCount burada tutulmaz.
 */
const LISTING_METADATA_TTL_MS = 60_000;
type ListingMetadataCacheSlot<T> = { value: T; expiresAt: number };
const listingMetadataCache = new Map<string, ListingMetadataCacheSlot<unknown>>();
const listingMetadataInflight = new Map<string, Promise<unknown>>();

async function getListingMetadataCached<T>(
  key: string,
  loader: () => Promise<T>,
  shouldCache: (value: T) => boolean = () => true,
): Promise<T> {
  const now = Date.now();
  const hit = listingMetadataCache.get(key) as ListingMetadataCacheSlot<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;

  const existing = listingMetadataInflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  let promise!: Promise<T>;
  promise = (async (): Promise<T> => {
    const value = await loader();
    // Yalnızca bu inflight hâlâ geçerliyken ve başarılıysa yaz — stale overwrite yok.
    if (shouldCache(value) && listingMetadataInflight.get(key) === promise) {
      listingMetadataCache.set(key, {
        value,
        expiresAt: Date.now() + LISTING_METADATA_TTL_MS,
      });
    }
    return value;
  })().finally(() => {
    if (listingMetadataInflight.get(key) === promise) {
      listingMetadataInflight.delete(key);
    }
  });

  listingMetadataInflight.set(key, promise);
  return promise;
}

type SchoolFeatureDefinitionMeta = {
  id: number;
  name: string;
  slug: string | null;
  input_type: string | null;
};

async function fetchCachedFeaturedInstitutionOrderMap(
  supabase: SupabaseBrowser,
): Promise<{ orderMap: FeaturedOrderMap; error: string | null }> {
  const cached = await getListingMetadataCached(
    "featured-institution-order:v1",
    async () => {
      const result = await fetchActiveFeaturedInstitutionOrderMap(supabase);
      return {
        orderMap: new Map(result.orderMap),
        error: result.error,
      };
    },
    (result) => result.error == null,
  );
  // Çağıranlar Map'i mutate etmesin diye kopya dön.
  return { orderMap: new Map(cached.orderMap), error: cached.error };
}

async function fetchCachedSchoolFeatureDefinitionMeta(
  supabase: SupabaseBrowser,
): Promise<SchoolFeatureDefinitionMeta[]> {
  return getListingMetadataCached("school-feature-definitions:v1", async () => {
    const { data: defsAll, error: defAllErr } = await supabase
      .from("institution_feature_definitions")
      .select("id, name, slug, input_type")
      .eq("is_active", true);
    if (defAllErr) throw defAllErr;

    const rows: SchoolFeatureDefinitionMeta[] = [];
    for (const d of (defsAll ?? []) as Array<{
      id: number;
      name?: string | null;
      slug?: string | null;
      input_type?: string | null;
    }>) {
      if (!Number.isFinite(d.id)) continue;
      rows.push({
        id: d.id,
        name: String(d.name ?? ""),
        slug: d.slug ?? null,
        input_type: d.input_type ?? null,
      });
    }
    return rows;
  });
}

/** Kart + harita meta; about/sosyal alanlar hariç — sayfa detayı için yeterli */
const LIGHT_INSTITUTION_SELECT =
  "id, slug, institution_name, subheading, address, district, city, official_phone, official_email, logo, source, high_school_type, institution_type:institution_types(id, name, category:institution_categories(id, name, slug))";
/** Sıralama için hafif satır */
const SORT_STUB_SELECT = "id, institution_name";

type InstitutionLocationFilter = {
  ilId: number | null;
  ilceId: number | null;
  mahalleId: number | null;
};

function applyInstitutionLocationFilter<T extends { eq: (column: string, value: number) => T }>(
  query: T,
  location: InstitutionLocationFilter,
): T {
  if (location.ilId != null) query = query.eq("il_id", location.ilId);
  if (location.ilceId != null) query = query.eq("ilce_id", location.ilceId);
  if (location.mahalleId != null) query = query.eq("mahalle_id", location.mahalleId);
  return query;
}

function institutionIdQuerySelect(categoryId: number | null): string {
  if (categoryId != null && Number.isFinite(categoryId) && categoryId > 0) {
    return "id";
  }
  return "id, institution_type:institution_types!inner(category:institution_categories!inner(name))";
}

function applyInstitutionCategoryScope<
  T extends { eq: (column: string, value: number) => T; ilike: (column: string, pattern: string) => T },
>(query: T, categoryId: number | null, targetName: string): T {
  if (categoryId != null && Number.isFinite(categoryId) && categoryId > 0) {
    return query.eq("category_id", categoryId);
  }
  return query.ilike("institution_type.category.name", targetName);
}

async function resolveInstitutionCategoryForListing(
  supabase: SupabaseBrowser,
  categoryName: string,
  categorySlug?: string,
): Promise<{ id: number | null; name: string }> {
  const targetName = String(categoryName ?? "").trim();
  const slug = String(categorySlug ?? "").trim();
  const cacheKey = `institution-category:v1:name=${targetName.toLocaleLowerCase("tr-TR")}|slug=${slug.toLocaleLowerCase("tr-TR")}`;

  return getListingMetadataCached(cacheKey, async () => {
    if (targetName) {
      const categoryId = await resolveInstitutionCategoryIdByName(supabase, targetName);
      if (categoryId != null) return { id: categoryId, name: targetName };
    }

    if (slug) {
      const category = await fetchInstitutionCategoryBySlug(slug);
      if (category) {
        return {
          id: category.id ?? null,
          name: String(category.name ?? "").trim() || targetName || slug,
        };
      }
    }

    return { id: null, name: targetName || slug };
  });
}

function applyInstitutionSearchFilter<
  T extends { or: (filters: string) => T },
>(query: T, searchTerm: string, relatedInstitutionIds: number[] = [], relatedInstitutionTypeIds: number[] = []): T {
  const variants = buildProfileSearchVariants(searchTerm)
    .map(escapeProfileLikeValue)
    .filter(Boolean);
  if (variants.length === 0) return query;

  const searchColumns = [
    "institution_name",
    "subheading",
    "about",
    "city",
    "district",
    "official_phone",
    "official_email",
    "address",
    "website",
    "facebook_url",
    "instagram_url",
    "x_url",
    "linkedin_url",
  ] as const;
  const orParts = variants.flatMap((term) => {
    const q = `%${term}%`;
    return searchColumns.map((col) => `${col}.ilike.${q}`);
  });
  if (relatedInstitutionIds.length > 0) {
    orParts.push(`id.in.(${relatedInstitutionIds.join(",")})`);
  }
  if (relatedInstitutionTypeIds.length > 0) {
    orParts.push(`institution_type_id.in.(${relatedInstitutionTypeIds.join(",")})`);
  }
  return query.or(orParts.join(","));
}

type RelatedProfileSearch = {
  institutionIds: number[];
  institutionTypeIds: number[];
};

type InstitutionTypeFilter = {
  institutionTypeIds?: number[] | null;
  highSchoolTypes?: string[] | null;
};

function applyInstitutionTypeFilters<
  T extends {
    eq: (column: string, value: number) => T;
    in: (column: string, values: string[] | number[]) => T;
    or: (filters: string) => T;
  },
>(query: T, typeFilter: InstitutionTypeFilter | undefined): T {
  const typeIds = (typeFilter?.institutionTypeIds ?? []).filter(
    (id) => Number.isFinite(id) && id > 0,
  );
  const hsTypes = (typeFilter?.highSchoolTypes ?? [])
    .map((slug) => String(slug ?? "").trim())
    .filter(Boolean);
  if (typeIds.length === 0) return query;

  const hasLise = typeIds.includes(LISE_INSTITUTION_TYPE_ID);
  const nonLiseIds = typeIds.filter((id) => id !== LISE_INSTITUTION_TYPE_ID);

  if (hasLise && hsTypes.length > 0) {
    if (nonLiseIds.length > 0) {
      return query.or(
        `institution_type_id.in.(${nonLiseIds.join(",")}),and(institution_type_id.eq.${LISE_INSTITUTION_TYPE_ID},high_school_type.in.(${hsTypes.join(",")}))`,
      );
    }
    return query
      .eq("institution_type_id", LISE_INSTITUTION_TYPE_ID)
      .in("high_school_type", hsTypes);
  }
  return query.in("institution_type_id", typeIds);
}

// PostgREST builder zinciri; dinamik select string'leri yüzünden any kullanılıyor.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ListingQueryBuilder = any;

function applyListingScopes(
  query: ListingQueryBuilder,
  categoryId: number | null,
  targetName: string,
  location: InstitutionLocationFilter,
  searchTerm: string,
  relatedSearch: RelatedProfileSearch,
  typeFilter?: InstitutionTypeFilter,
): ListingQueryBuilder {
  let next = query;
  next = applyInstitutionCategoryScope(next, categoryId, targetName);
  next = applyInstitutionLocationFilter(next, location);
  if (searchTerm) {
    next = applyInstitutionSearchFilter(
      next,
      searchTerm,
      relatedSearch.institutionIds,
      relatedSearch.institutionTypeIds,
    );
  }
  next = applyInstitutionTypeFilters(next, typeFilter);
  return next;
}

/**
 * Filtreler uygulandıktan sonra toplam eşleşen kurum sayısı (kayıtları yüklemeden).
 */
async function countCategoryInstitutions(
  supabase: SupabaseBrowser,
  categoryId: number | null,
  targetName: string,
  location: InstitutionLocationFilter,
  searchTerm: string,
  relatedSearch: RelatedProfileSearch,
  typeFilter?: InstitutionTypeFilter,
): Promise<number> {
  let query = supabase
    .from("institutions")
    .select(institutionIdQuerySelect(categoryId), { count: "exact", head: true })
    .eq("is_approved", true);

  query = applyListingScopes(
    query,
    categoryId,
    targetName,
    location,
    searchTerm,
    relatedSearch,
    typeFilter,
  );

  const { count, error } = await query;
  if (error) throw error;
  return Number.isFinite(count) ? Number(count) : 0;
}

/**
 * DB sıralı sayfa: institution_name ASC. Featured kayıtlar listenin başına
 * alınır (mevcut sortWithFeaturedPriority semantiği).
 */
async function fetchCategoryInstitutionPageFromDb(
  supabase: SupabaseBrowser,
  categoryId: number | null,
  targetName: string,
  location: InstitutionLocationFilter,
  searchTerm: string,
  relatedSearch: RelatedProfileSearch,
  featuredOrderMap: FeaturedOrderMap,
  page: number,
  pageSize: number,
  typeFilter?: InstitutionTypeFilter,
  knownTotalCount?: number | null,
): Promise<{ rows: InstitutionRow[]; totalCount: number }> {
  const totalCount =
    knownTotalCount != null && Number.isFinite(knownTotalCount) && knownTotalCount >= 0
      ? Number(knownTotalCount)
      : await countCategoryInstitutions(
          supabase,
          categoryId,
          targetName,
          location,
          searchTerm,
          relatedSearch,
          typeFilter,
        );
  if (totalCount === 0) return { rows: [], totalCount: 0 };

  const safePage = Math.max(1, page);
  const pageStart = (safePage - 1) * pageSize;
  if (pageStart >= totalCount) return { rows: [], totalCount };

  const featuredIds = [...featuredOrderMap.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id)
    .filter((id) => Number.isFinite(id) && id > 0);

  let featuredRows: InstitutionRow[] = [];
  if (featuredIds.length > 0) {
    let featuredQuery = supabase
      .from("institutions")
      .select(LIGHT_INSTITUTION_SELECT)
      .eq("is_approved", true)
      .in("id", featuredIds.slice(0, IN_CHUNK));

    featuredQuery = applyListingScopes(
      featuredQuery,
      categoryId,
      targetName,
      location,
      searchTerm,
      relatedSearch,
      typeFilter,
    );

    const { data, error } = await featuredQuery;
    if (error) throw error;
    const matched = ((data as unknown as InstitutionRow[] | null) ?? []).filter((row) =>
      featuredOrderMap.has(Number(row.id)),
    );
    matched.sort(
      (a, b) =>
        (featuredOrderMap.get(Number(a.id)) ?? 0) - (featuredOrderMap.get(Number(b.id)) ?? 0),
    );
    featuredRows = matched;
  }

  const featuredCount = featuredRows.length;
  const pageEnd = pageStart + pageSize;
  const rows: InstitutionRow[] = [];

  if (pageStart < featuredCount) {
    rows.push(...featuredRows.slice(pageStart, Math.min(pageEnd, featuredCount)));
  }

  const nonFeaturedNeeded = pageSize - rows.length;
  if (nonFeaturedNeeded > 0) {
    const nonFeaturedOffset = Math.max(0, pageStart - featuredCount);
    let nonFeaturedQuery = supabase
      .from("institutions")
      .select(LIGHT_INSTITUTION_SELECT)
      .eq("is_approved", true);

    nonFeaturedQuery = applyListingScopes(
      nonFeaturedQuery,
      categoryId,
      targetName,
      location,
      searchTerm,
      relatedSearch,
      typeFilter,
    );

    if (featuredRows.length > 0) {
      const exclude = featuredRows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
      if (exclude.length > 0) {
        nonFeaturedQuery = nonFeaturedQuery.not(
          "id",
          "in",
          `(${exclude.join(",")})`,
        );
      }
    }

    const { data, error } = await nonFeaturedQuery
      .order("institution_name", { ascending: true })
      .range(nonFeaturedOffset, nonFeaturedOffset + nonFeaturedNeeded - 1);
    if (error) throw error;
    rows.push(...((data as unknown as InstitutionRow[] | null) ?? []));
  }

  return { rows, totalCount };
}

async function fetchSortStubsByIds(
  supabase: SupabaseBrowser,
  ids: number[],
): Promise<Array<{ id: number; institution_name: string | null }>> {
  if (ids.length === 0) return [];
  const out: Array<{ id: number; institution_name: string | null }> = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from("institutions")
      .select(SORT_STUB_SELECT)
      .in("id", chunk)
      .eq("is_approved", true);
    if (error) throw error;
    out.push(
      ...((data as unknown as Array<{ id: number; institution_name: string | null }> | null) ?? []),
    );
  }
  return out;
}

/**
 * ID kümesini mevcut liste semantiğiyle sıralar: isim ASC (tr) + featured öncelik.
 * Stub fetch hata verirse throw eder; kısmi sonuç dönülmez.
 */
async function orderInstitutionIdsByNameAndFeatured(
  supabase: SupabaseBrowser,
  ids: number[],
  featuredOrderMap: FeaturedOrderMap,
): Promise<{ orderedIds: number[]; totalCount: number }> {
  const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  const totalCount = uniqueIds.length;
  if (totalCount === 0) return { orderedIds: [], totalCount: 0 };

  const stubs = await fetchSortStubsByIds(supabase, uniqueIds);
  stubs.sort((a, b) =>
    String(a.institution_name ?? "").localeCompare(String(b.institution_name ?? ""), "tr", {
      sensitivity: "base",
    }),
  );

  const orderedIds = sortWithFeaturedPriority(
    stubs.map((s) => s.id),
    (id) => id,
    featuredOrderMap,
  );
  return { orderedIds, totalCount };
}

/**
 * Önceden sıralanmış ID listesinden yalnızca istenen sayfayı hydrate eder.
 * Stub / sıralama tekrarlanmaz.
 */
async function fetchInstitutionPageForIdSet(
  supabase: SupabaseBrowser,
  orderedIds: number[],
  page: number,
  pageSize: number,
): Promise<{ rows: InstitutionRow[]; totalCount: number }> {
  const totalCount = orderedIds.length;
  if (totalCount === 0) return { rows: [], totalCount: 0 };

  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  const pageIds = orderedIds.slice(start, start + pageSize);
  if (pageIds.length === 0) return { rows: [], totalCount };

  const rows = await fetchRowsByIdsChunked(supabase, pageIds, LIGHT_INSTITUTION_SELECT);
  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  const orderedRows = pageIds
    .map((id) => byId.get(id))
    .filter((row): row is InstitutionRow => Boolean(row));

  return { rows: orderedRows, totalCount };
}

async function fetchAllCategoryInstitutionIds(
  supabase: SupabaseBrowser,
  categoryId: number | null,
  targetName: string,
  location: InstitutionLocationFilter,
  searchTerm: string,
  institutionTypeIds?: number[] | null,
  highSchoolTypes?: string[] | null,
): Promise<number[]> {
  const ids: number[] = [];
  const relatedSearch = searchTerm
    ? await resolveInstitutionIdsByProfileSearch(supabase, searchTerm)
    : { institutionIds: [], institutionTypeIds: [] };

  for (let page = 0; page < MAX_QUERY_PAGES; page += 1) {
    const from = page * QUERY_PAGE_SIZE;
    const to = from + QUERY_PAGE_SIZE - 1;

    let query = supabase
      .from("institutions")
      .select(institutionIdQuerySelect(categoryId))
      .eq("is_approved", true);

    query = applyInstitutionCategoryScope(query, categoryId, targetName);
    query = applyInstitutionLocationFilter(query, location);

    if (searchTerm) {
      query = applyInstitutionSearchFilter(
        query,
        searchTerm,
        relatedSearch.institutionIds,
        relatedSearch.institutionTypeIds,
      );
    }

    query = applyInstitutionTypeFilters(query, {
      institutionTypeIds,
      highSchoolTypes,
    });

    const { data, error } = await query.order("id", { ascending: true }).range(from, to);
    if (error) throw error;

    const batch = ((data as unknown as Array<{ id: number }> | null) ?? []);
    ids.push(
      ...batch
        .map((row) => Number(row.id))
        .filter((id) => Number.isFinite(id)),
    );
    if (batch.length < QUERY_PAGE_SIZE) break;
  }

  return ids;
}

/**
 * PostgrestError / Error nesnelerini console.error'da `{}` olarak değil,
 * okunabilir alanlarla birlikte göstermek için düzleştirir.
 */
function describeSupabaseError(err: unknown): {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
  name?: string;
} {
  if (err == null) return { message: "unknown" };
  if (typeof err === "string") return { message: err };
  const e = err as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
    status?: number;
    name?: string;
  };
  return {
    message: String(e.message ?? "unknown"),
    code: e.code,
    details: e.details,
    hint: e.hint,
    status: e.status,
    name: e.name,
  };
}

function pickInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "M";
  const first = trimmed.charAt(0).toUpperCase();
  return first || "M";
}

function toTitleCaseTr(value: string): string {
  return value
    .split(/(\s+|-)/u)
    .map((segment) => {
      if (!segment || /^\s+$/.test(segment) || segment === "-") return segment;
      const first = segment.charAt(0).toLocaleUpperCase("tr-TR");
      const rest = segment.slice(1).toLocaleLowerCase("tr-TR");
      return `${first}${rest}`;
    })
    .join("");
}

function buildLocation(district?: string | null, city?: string | null): string {
  const parts = [district, city]
    .map((part) => String(part ?? "").trim())
    .filter((part) => Boolean(part))
    .map((part) => toTitleCaseTr(part));
  if (parts.length === 0) return FALLBACK;
  return parts.join(", ");
}

function intersectSets(a: Set<number>, b: Set<number>): Set<number> {
  const out = new Set<number>();
  for (const id of a) {
    if (b.has(id)) out.add(id);
  }
  return out;
}

function parseOptionalNumber(raw: string): number | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function isWorkingHoursFilterActive(payload: SchoolCategoryFilterPayload | undefined): boolean {
  if (!payload) return false;
  return (
    String(payload.workingHoursStart ?? "").trim() !== "" ||
    String(payload.workingHoursEnd ?? "").trim() !== ""
  );
}

function isPriceFilterActive(payload: SchoolCategoryFilterPayload | undefined): boolean {
  if (!payload) return false;
  return (
    String(payload.priceMin ?? "").trim() !== "" || String(payload.priceMax ?? "").trim() !== ""
  );
}

function hasAnySchoolPayloadFilters(payload: SchoolCategoryFilterPayload | undefined): boolean {
  if (!payload) return false;
  if (isStudentAgeFilterTextActive(payload.studentAgeRange)) return true;
  if (isWorkingHoursFilterActive(payload)) return true;
  if (isPriceFilterActive(payload)) return true;
  if ((payload.institutionTypeIds ?? []).some((id) => Number.isFinite(id) && id > 0)) return true;
  if ((payload.highSchoolTypes ?? []).some((slug) => String(slug ?? "").trim())) return true;
  if (Object.keys(payload.commonSingle).some((k) => String(payload.commonSingle[Number(k)] ?? "").trim()))
    return true;
  if (Object.keys(payload.commonMulti).some((k) => (payload.commonMulti[Number(k)] ?? []).length > 0))
    return true;
  if (
    Object.keys(payload.commonRange).some((k) => {
      const r = payload.commonRange[Number(k)] ?? { min: "", max: "" };
      return String(r.min ?? "").trim() !== "" || String(r.max ?? "").trim() !== "";
    })
  )
    return true;
  if (Object.keys(payload.groupSelections).some((k) => (payload.groupSelections[Number(k)] ?? []).length > 0))
    return true;
  return false;
}

/** Kurum kolonları: working_hours_start / working_hours_end (feature tabloları yok). */
async function resolveInstitutionIdsByWorkingHoursFilter(
  supabase: SupabaseBrowser,
  params: { start: string; end: string },
): Promise<Set<number>> {
  const startDb = params.start ? inputHHMMToDbTimeOrNull(params.start) : null;
  const endDb = params.end ? inputHHMMToDbTimeOrNull(params.end) : null;
  if (!startDb && !endDb) return new Set();

  const rows = await fetchAllPostgrestPages<{ id: number }>((from, to) => {
    let query = supabase.from("institutions").select("id");
    if (startDb) {
      query = query.not("working_hours_start", "is", null).lte("working_hours_start", startDb);
    }
    if (endDb) {
      query = query.not("working_hours_end", "is", null).gte("working_hours_end", endDb);
    }
    return query.order("id", { ascending: true }).range(from, to);
  });

  const out = new Set<number>();
  for (const row of rows) {
    const id = Number(row.id);
    if (Number.isFinite(id) && id > 0) out.add(id);
  }
  return out;
}

async function resolveInstitutionIdsForSingleSelectChoice(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  definitionId: number,
  choiceId: number,
): Promise<Set<number>> {
  return resolveInstitutionIdsForMultiSelectChoices(supabase, definitionId, [choiceId]);
}

/**
 * Junction-only choice eşleşmesi (selected_choice_id kullanılmaz).
 * Önce choice_id ile dar junction sorgusu, sonra yalnızca eşleşen entry'ler
 * definition filtresiyle kurum id'sine çözülür — tüm definition entry taraması yok.
 * Aynı definition altındaki birden fazla choice OR birleşimi tek turda yapılır.
 */
async function resolveInstitutionIdsForMultiSelectChoices(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  definitionId: number,
  choiceIds: number[],
): Promise<Set<number>> {
  const out = new Set<number>();
  if (!Number.isFinite(definitionId) || definitionId <= 0) return out;

  const uniqueChoiceIds = [
    ...new Set(
      choiceIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  if (uniqueChoiceIds.length === 0) return out;
  const choiceIdSet = new Set(uniqueChoiceIds);

  const linkEntryIds = new Set<number>();
  for (let i = 0; i < uniqueChoiceIds.length; i += IN_CHUNK) {
    const choiceChunk = uniqueChoiceIds.slice(i, i + IN_CHUNK);
    const links = await fetchAllPostgrestPages<{
      institution_feature_entry_id: number;
      choice_id: number;
    }>((from, to) =>
      supabase
        .from("institution_feature_entry_choices")
        .select("institution_feature_entry_id, choice_id")
        .in("choice_id", choiceChunk)
        .order("institution_feature_entry_id", { ascending: true })
        .order("choice_id", { ascending: true })
        .range(from, to),
    );
    for (const row of links) {
      const choiceId = Number(row.choice_id);
      const entryId = Number(row.institution_feature_entry_id);
      if (!choiceIdSet.has(choiceId)) continue;
      if (Number.isFinite(entryId) && entryId > 0) linkEntryIds.add(entryId);
    }
  }
  if (linkEntryIds.size === 0) return out;

  const entryIdList = Array.from(linkEntryIds);
  for (let i = 0; i < entryIdList.length; i += IN_CHUNK) {
    const { data: entries, error: entryErr } = await supabase
      .from("institution_feature_entries")
      .select("id, institution_id")
      .eq("feature_definition_id", definitionId)
      .in("id", entryIdList.slice(i, i + IN_CHUNK));
    if (entryErr) throw entryErr;
    for (const row of (entries ?? []) as Array<{ id: number; institution_id: number }>) {
      const iid = Number(row.institution_id);
      if (Number.isFinite(iid) && iid > 0) out.add(iid);
    }
  }
  return out;
}

async function resolveInstitutionIdsForMultiSelectChoice(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  definitionId: number,
  choiceId: number,
): Promise<Set<number>> {
  return resolveInstitutionIdsForMultiSelectChoices(supabase, definitionId, [choiceId]);
}

async function resolveInstitutionIdsForBooleanDefinition(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  definitionId: number,
): Promise<Set<number>> {
  const out = new Set<number>();
  const rows = await fetchAllPostgrestPages<{ id: number; institution_id: number }>((from, to) =>
    supabase
      .from("institution_feature_entries")
      .select("id, institution_id")
      .eq("feature_definition_id", definitionId)
      .eq("boolean_answer", true)
      .order("id", { ascending: true })
      .range(from, to),
  );
  for (const row of rows) {
    const iid = Number(row.institution_id);
    if (Number.isFinite(iid)) out.add(iid);
  }
  return out;
}

async function resolveDefinitionIdForChoiceId(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  choiceId: number,
): Promise<number | null> {
  const { data: entryLinks, error: linkErr } = await supabase
    .from("institution_feature_entry_choices")
    .select("institution_feature_entry_id")
    .eq("choice_id", choiceId)
    .limit(1);
  if (linkErr) throw linkErr;

  const entryId = Number(
    (entryLinks?.[0] as { institution_feature_entry_id?: number } | undefined)?.institution_feature_entry_id,
  );
  if (Number.isFinite(entryId)) {
    const { data: entryRow, error: entryErr } = await supabase
      .from("institution_feature_entries")
      .select("feature_definition_id")
      .eq("id", entryId)
      .maybeSingle();
    if (entryErr) throw entryErr;
    const defId = Number((entryRow as { feature_definition_id?: number } | null)?.feature_definition_id);
    if (Number.isFinite(defId)) return defId;
  }

  return null;
}

function parseChoiceKey(key: string): { choiceId: number | null; definitionId: number | null } {
  const trimmed = String(key ?? "").trim();
  if (!trimmed.startsWith("choice:")) return { choiceId: null, definitionId: null };

  const parts = trimmed.split(":");
  const choiceId = Number(parts[1]);
  const defMarkerIndex = parts.indexOf("def");
  const definitionId =
    defMarkerIndex >= 0 ? Number(parts[defMarkerIndex + 1]) : Number.NaN;

  return {
    choiceId: Number.isFinite(choiceId) ? choiceId : null,
    definitionId: Number.isFinite(definitionId) ? definitionId : null,
  };
}

async function resolveInstitutionIdsNumberRangeForDefinition(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  definitionId: number,
  minBound: number | null,
  maxBound: number | null,
): Promise<Set<number>> {
  const out = new Set<number>();
  const rows = await fetchAllPostgrestPages<{
    id: number;
    institution_id: number;
    number_answer: number | null;
    text_answer: string | null;
  }>((from, to) =>
    supabase
      .from("institution_feature_entries")
      .select("id, institution_id, number_answer, text_answer")
      .eq("feature_definition_id", definitionId)
      .order("id", { ascending: true })
      .range(from, to),
  );
  for (const row of rows) {
    const iid = Number(row.institution_id);
    if (!Number.isFinite(iid)) continue;
    let n: number | null = null;
    if (row.number_answer != null && Number.isFinite(Number(row.number_answer))) {
      n = Number(row.number_answer);
    } else {
      const t = String(row.text_answer ?? "").trim();
      if (t) {
        const parsed = Number(t.replace(",", "."));
        if (Number.isFinite(parsed)) n = parsed;
      }
    }
    if (n == null || !Number.isFinite(n)) continue;
    if (minBound != null && n < minBound) continue;
    if (maxBound != null && n > maxBound) continue;
    out.add(iid);
  }
  return out;
}

async function fetchRowsByIdsChunked(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  ids: number[],
  select: string,
): Promise<InstitutionRow[]> {
  if (ids.length === 0) return [];
  const out: InstitutionRow[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from("institutions")
      .select(select)
      .in("id", chunk)
      .eq("is_approved", true)
      .order("institution_name", { ascending: true });
    if (error) throw error;
    out.push(...((data as unknown as InstitutionRow[] | null) ?? []));
  }
  out.sort((a, b) =>
    String(a.institution_name ?? "").localeCompare(String(b.institution_name ?? ""), "tr", {
      sensitivity: "base",
    }),
  );
  return out;
}

async function fetchCategoryInstructorResults(
  supabase: SupabaseBrowser,
  options: {
    institutionCategoryId: number | null;
    categoryName: string;
    categorySlug?: string;
    location: InstitutionLocationFilter;
    searchTerm: string;
    schoolFilters?: SchoolCategoryFilterPayload;
  },
): Promise<CategoryResultItem[]> {
  const {
    institutionCategoryId,
    categoryName,
    categorySlug,
    location,
    searchTerm,
    schoolFilters,
  } = options;

  // instructors.category_id → instructor_categories (kurum kategori id'si değil)
  const slugKey = String(categorySlug ?? "").trim().toLocaleLowerCase("tr-TR");
  const nameKey = String(categoryName ?? "").trim().toLocaleLowerCase("tr-TR");
  const instructorCategoryId = await getListingMetadataCached(
    `instructor-category:v1:slug=${slugKey}|name=${nameKey}`,
    () =>
      resolveInstructorCategoryIdBySlugOrName(supabase, {
        slug: categorySlug,
        name: categoryName,
      }),
  );

  if (instructorCategoryId == null || !Number.isFinite(instructorCategoryId)) {
    return [];
  }

  const instructorFilters = await buildInstructorListingFiltersFromSchoolPayload(
    supabase,
    schoolFilters,
  );

  let allowedInstructorIds =
    instructorFilters.featureFilterIds !== null ? instructorFilters.featureFilterIds : undefined;

  const priceMinRaw = String(schoolFilters?.priceMin ?? "").trim();
  const priceMaxRaw = String(schoolFilters?.priceMax ?? "").trim();
  if (priceMinRaw || priceMaxRaw) {
    const matchedPriceIds = new Set(
      await resolveInstructorIdsByPriceRange(supabase, {
        min: parsePriceInputToIntOrNull(priceMinRaw),
        max: parsePriceInputToIntOrNull(priceMaxRaw),
      }),
    );
    allowedInstructorIds =
      allowedInstructorIds !== undefined
        ? intersectSets(allowedInstructorIds, matchedPriceIds)
        : matchedPriceIds;
  }

  const rows = await fetchPublicInstructorsForListing(supabase, {
    categoryId: instructorCategoryId,
    ilId: location.ilId,
    ilceId: location.ilceId,
    mahalleId: location.mahalleId,
    searchTerm,
    allowedInstructorIds,
  });

  const filteredRows = applyInstructorListingFilters(rows, {
    featureFilterIds: null,
    branchTitleTerms: instructorFilters.branchTitleTerms,
    priceRange: null,
  });

  return filteredRows
    .map((row) =>
      mapPublicInstructorToListItem(
        row,
        supabase,
      ),
    )
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

function mergeCategoryResults(
  institutions: CategoryResultItem[],
  instructors: CategoryResultItem[],
): CategoryResultItem[] {
  return [...institutions, ...instructors].sort((a, b) =>
    a.name.localeCompare(b.name, "tr", { sensitivity: "base" }),
  );
}

function applyFeaturedInstitutionPriority(
  items: CategoryResultItem[],
  featuredOrderMap: FeaturedOrderMap,
): CategoryResultItem[] {
  return sortWithFeaturedPriority(
    items,
    (item) => {
      if (item.resultType !== "institution") return null;
      const id = Number(item.id);
      return Number.isFinite(id) && id > 0 ? id : null;
    },
    featuredOrderMap,
  );
}

function finalizeCategoryResults(
  institutions: CategoryResultItem[],
  instructors: CategoryResultItem[],
  featuredOrderMap: FeaturedOrderMap,
): CategoryResultItem[] {
  return applyFeaturedInstitutionPriority(
    mergeCategoryResults(institutions, instructors),
    featuredOrderMap,
  );
}

function sortInstitutionRowsByName(rows: InstitutionRow[]): InstitutionRow[] {
  return [...rows].sort((a, b) =>
    String(a.institution_name ?? "").localeCompare(String(b.institution_name ?? ""), "tr", {
      sensitivity: "base",
    }),
  );
}

type CategoryListingPageResult = {
  results: CategoryResultItem[];
  totalCount: number;
  categoryLabel: string;
  error: string | null;
};

type CategoryListingContext =
  | {
      kind: "not_found";
      listingName: string;
    }
  | {
      kind: "db_range";
      supabase: SupabaseBrowser;
      categoryId: number | null;
      listingName: string;
      listingLocation: InstitutionLocationFilter;
      searchTerm: string;
      relatedSearch: RelatedProfileSearch;
      featuredOrderMap: FeaturedOrderMap;
    }
  | {
      kind: "merged_order";
      supabase: SupabaseBrowser;
      listingName: string;
      mergedOrder: CategoryResultItem[];
      totalCount: number;
    }
  | {
      kind: "id_set";
      supabase: SupabaseBrowser;
      listingName: string;
      /** Filtre bağlamında bir kez üretilmiş isim+featured sıralı kurum id'leri */
      orderedIds: number[];
      totalCount: number;
    }
  | {
      kind: "instructors_only";
      listingName: string;
      instructorOnly: CategoryResultItem[];
      totalCount: number;
    };

type CategoryListingCache = {
  queryKey: string;
  generation: number;
  context: CategoryListingContext | null;
  totalCount: number | null;
  categoryLabel: string;
  pages: Map<number, CategoryResultItem[]>;
  inflight: Map<number, Promise<CategoryListingPageResult>>;
};

function createCategoryListingCache(queryKey: string, generation: number): CategoryListingCache {
  return {
    queryKey,
    generation,
    context: null,
    totalCount: null,
    categoryLabel: "",
    pages: new Map(),
    inflight: new Map(),
  };
}

function evictionScore(pageNumber: number, activePage: number): number {
  if (pageNumber === activePage) return Number.NEGATIVE_INFINITY;
  if (pageNumber === activePage + 1 || pageNumber === activePage + 2) {
    return Math.abs(pageNumber - activePage);
  }
  if (pageNumber === activePage - 1) return 50 + Math.abs(pageNumber - activePage);
  return 100 + Math.abs(pageNumber - activePage);
}

function trimCategoryListingCache(cache: CategoryListingCache, activePage: number): void {
  while (cache.pages.size > CATEGORY_MAX_CACHED_PAGES) {
    let victim: number | null = null;
    let best = Number.NEGATIVE_INFINITY;
    for (const pageNumber of cache.pages.keys()) {
      const score = evictionScore(pageNumber, activePage);
      if (score > best) {
        best = score;
        victim = pageNumber;
      }
    }
    if (victim == null || victim === activePage) break;
    cache.pages.delete(victim);
  }
}

async function hydrateMergedOrderPage(
  supabase: SupabaseBrowser,
  mergedOrder: CategoryResultItem[],
  page: number,
  pageSize: number,
): Promise<CategoryResultItem[]> {
  const start = (Math.max(1, page) - 1) * pageSize;
  const pageOrder = mergedOrder.slice(start, start + pageSize);
  const pageInstitutionIds = pageOrder
    .filter((item) => item.resultType !== "instructor")
    .map((item) => Number(item.institutionId ?? item.id))
    .filter((id) => Number.isFinite(id));
  const [pageRows, kurumTuru] = await Promise.all([
    fetchRowsByIdsChunked(supabase, pageInstitutionIds, LIGHT_INSTITUTION_SELECT),
    loadKurumTuruLabelByInstitutionId(supabase, pageInstitutionIds),
  ]);
  const detailById = new Map(
    applyKurumTuruLabels(
      pageRows.map((row) => mapRow(supabase, row)),
      kurumTuru,
    ).map((item) => [Number(item.institutionId ?? item.id), item]),
  );
  return pageOrder.map((item) => {
    if (item.resultType === "instructor") return item;
    return detailById.get(Number(item.institutionId ?? item.id)) ?? item;
  });
}

async function buildCategoryListingContext(input: {
  categoryName: string;
  categorySlug: string;
  debouncedSearch: string;
  ilId: string;
  ilceId: string;
  mahalleId: string;
  schoolFilters: SchoolCategoryFilterPayload | undefined;
  isCurrent: () => boolean;
}): Promise<CategoryListingContext> {
  const supabase = createSupabaseBrowserClient();
  const featuredOrderPromise = fetchCachedFeaturedInstitutionOrderMap(supabase);
  const useSchoolPipeline = hasAnySchoolPayloadFilters(input.schoolFilters ?? undefined);
  const searchTerm = input.debouncedSearch.trim();
  const targetName = String(input.categoryName ?? "").trim();
  const slug = input.categorySlug;

  const resolvedCategory = await resolveInstitutionCategoryForListing(supabase, targetName, slug);
  if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");

  const listingName = resolvedCategory.name;
  const categoryId = resolvedCategory.id;

  if (categoryId == null && slug && !targetName) {
    return { kind: "not_found", listingName };
  }

  if (categoryId == null) {
    console.warn("[category][institutions] kategori bulunamadı:", {
      categoryName: listingName,
      categorySlug: slug || null,
    });
  }

  const listingLocation: InstitutionLocationFilter = {
    ilId: await resolveCategoryListingIlId(input.ilId),
    ilceId: parseLocationId(input.ilceId),
    mahalleId: parseLocationId(input.ilceId) != null ? parseLocationId(input.mahalleId) : null,
  };
  if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");

  const relatedSearch = searchTerm
    ? await resolveInstitutionIdsByProfileSearch(supabase, searchTerm)
    : { institutionIds: [], institutionTypeIds: [] };
  if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");

  const instructorPromise = fetchCategoryInstructorResults(supabase, {
    institutionCategoryId: categoryId,
    categoryName: listingName,
    categorySlug: slug,
    location: listingLocation,
    searchTerm,
    schoolFilters: input.schoolFilters,
  });

  if (!useSchoolPipeline) {
    const [instructorResults, featuredOrderResult] = await Promise.all([
      instructorPromise,
      featuredOrderPromise,
    ]);
    if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");
    const featuredOrderMap = featuredOrderResult.orderMap;

    if (instructorResults.length === 0) {
      return {
        kind: "db_range",
        supabase,
        categoryId,
        listingName,
        listingLocation,
        searchTerm,
        relatedSearch,
        featuredOrderMap,
      };
    }

    const institutionIds = await fetchAllCategoryInstitutionIds(
      supabase,
      categoryId,
      listingName,
      listingLocation,
      searchTerm,
    );
    if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");
    const stubs = await fetchSortStubsByIds(supabase, institutionIds);
    if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");
    stubs.sort((a, b) =>
      String(a.institution_name ?? "").localeCompare(String(b.institution_name ?? ""), "tr", {
        sensitivity: "base",
      }),
    );
    const institutionStubs: CategoryResultItem[] = stubs.map((stub) => ({
      id: String(stub.id),
      resultType: "institution" as const,
      name: String(stub.institution_name ?? "").trim() || FALLBACK,
      description: "",
      location: FALLBACK,
      price: FALLBACK,
      ageRange: FALLBACK,
      badges: [],
      institutionId: stub.id,
    }));
    const mergedOrder = finalizeCategoryResults(
      institutionStubs,
      instructorResults,
      featuredOrderMap,
    );
    return {
      kind: "merged_order",
      supabase,
      listingName,
      mergedOrder,
      totalCount: mergedOrder.length,
    };
  }

  const payload = input.schoolFilters!;
  const baseIds = await fetchAllCategoryInstitutionIds(
    supabase,
    categoryId,
    listingName,
    listingLocation,
    searchTerm,
    payload.institutionTypeIds,
    payload.highSchoolTypes,
  );
  if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");

  let current = new Set<number>(baseIds);

  if (current.size === 0) {
    const instructorOnly = await instructorPromise;
    if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");
    return {
      kind: "instructors_only",
      listingName,
      instructorOnly,
      totalCount: instructorOnly.length,
    };
  }

  const defsAll = await fetchCachedSchoolFeatureDefinitionMeta(supabase);
  const inputTypeByDefId = new Map<number, string>();
  const defMetaById = new Map<number, { name: string; slug: string | null }>();
  for (const d of defsAll) {
    inputTypeByDefId.set(d.id, String(d.input_type ?? ""));
    defMetaById.set(d.id, { name: d.name, slug: d.slug });
  }

  for (const [defIdStr, choiceIdStr] of Object.entries(payload.commonSingle)) {
    const defId = Number(defIdStr);
    const choiceId = Number(String(choiceIdStr ?? "").trim());
    if (!Number.isFinite(defId) || !Number.isFinite(choiceId)) continue;
    const it = String(inputTypeByDefId.get(defId) ?? "").toLowerCase();
    let set: Set<number>;
    if (it === "multi_select") {
      set = await resolveInstitutionIdsForMultiSelectChoice(supabase, defId, choiceId);
    } else {
      set = await resolveInstitutionIdsForSingleSelectChoice(supabase, defId, choiceId);
    }
    current = intersectSets(current, set);
    if (current.size === 0) break;
  }
  if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");

  const defMetaList = Array.from(defMetaById.entries()).map(([id, meta]) => ({
    id,
    name: meta.name,
    slug: meta.slug,
    input_type: inputTypeByDefId.get(id) ?? null,
  }));

  const studentAgeFilter = resolveStudentAgeFilterFromPayload(payload, defMetaList);
  if (studentAgeFilter) {
    const matchedIds = await resolveInstitutionIdsByStudentAgeFilter(supabase, {
      userFilter: studentAgeFilter,
    });
    current = intersectSets(current, new Set(matchedIds));
  }
  if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");

  const workingHoursStart = String(payload.workingHoursStart ?? "").trim();
  const workingHoursEnd = String(payload.workingHoursEnd ?? "").trim();
  if (workingHoursStart || workingHoursEnd) {
    const matchedIds = await resolveInstitutionIdsByWorkingHoursFilter(supabase, {
      start: workingHoursStart,
      end: workingHoursEnd,
    });
    current = intersectSets(current, matchedIds);
  }
  if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");

  const priceMinRaw = String(payload.priceMin ?? "").trim();
  const priceMaxRaw = String(payload.priceMax ?? "").trim();
  if (priceMinRaw || priceMaxRaw) {
    const matchedIds = await resolveInstitutionIdsByPriceRange(supabase, {
      min: parsePriceInputToIntOrNull(priceMinRaw),
      max: parsePriceInputToIntOrNull(priceMaxRaw),
    });
    current = intersectSets(current, new Set(matchedIds));
  }
  if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");

  for (const [defIdStr, choiceIds] of Object.entries(payload.commonMulti)) {
    const defId = Number(defIdStr);
    if (!Number.isFinite(defId) || !Array.isArray(choiceIds) || choiceIds.length === 0) continue;
    const meta = defMetaById.get(defId);
    if (
      meta &&
      isLegacyStudentAgeMultiSelectFeature({
        slug: meta.slug,
        name: meta.name,
        input_type: inputTypeByDefId.get(defId) ?? "multi_select",
      })
    ) {
      continue;
    }
    if (isStudentAgeFilterDefinitionId(defId, defMetaList)) continue;
    const parsedChoiceIds = choiceIds
      .map((cidStr) => Number(String(cidStr).trim()))
      .filter((cid) => Number.isFinite(cid));
    if (parsedChoiceIds.length === 0) continue;
    // Aynı definition altındaki choice'lar OR — tek batch sorgu
    const union = await resolveInstitutionIdsForMultiSelectChoices(
      supabase,
      defId,
      parsedChoiceIds,
    );
    current = intersectSets(current, union);
    if (current.size === 0) break;
  }
  if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");

  for (const [defIdStr, range] of Object.entries(payload.commonRange)) {
    const defId = Number(defIdStr);
    if (!Number.isFinite(defId)) continue;
    if (isStudentAgeFilterDefinitionId(defId, defMetaList)) continue;
    const minS = String(range?.min ?? "").trim();
    const maxS = String(range?.max ?? "").trim();
    if (!minS && !maxS) continue;

    const minBound = minS ? parseOptionalNumber(minS) : null;
    const maxBound = maxS ? parseOptionalNumber(maxS) : null;
    const set = await resolveInstitutionIdsNumberRangeForDefinition(supabase, defId, minBound, maxBound);
    current = intersectSets(current, set);
    if (current.size === 0) break;
  }
  if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");

  for (const [groupIdStr, keys] of Object.entries(payload.groupSelections)) {
    const groupId = Number(groupIdStr);
    if (!Number.isFinite(groupId) || !Array.isArray(keys) || keys.length === 0) continue;
    const union = new Set<number>();
    const choiceIdsByDef = new Map<number, number[]>();
    const booleanDefIds: number[] = [];

    for (const key of keys) {
      const raw = String(key ?? "").trim();
      if (!raw) continue;
      if (raw.startsWith("def:")) {
        const defId = Number(raw.slice(4));
        if (Number.isFinite(defId)) booleanDefIds.push(defId);
        continue;
      }
      if (!raw.startsWith("choice:")) continue;
      const { choiceId, definitionId: embeddedDefId } = parseChoiceKey(raw);
      if (choiceId == null) continue;
      let defId = embeddedDefId;
      if (defId == null) {
        defId = await resolveDefinitionIdForChoiceId(supabase, choiceId);
      }
      if (defId == null) continue;
      const list = choiceIdsByDef.get(defId) ?? [];
      list.push(choiceId);
      choiceIdsByDef.set(defId, list);
    }

    for (const defId of booleanDefIds) {
      const s = await resolveInstitutionIdsForBooleanDefinition(supabase, defId);
      s.forEach((id) => union.add(id));
    }
    for (const [defId, cids] of choiceIdsByDef) {
      const s = await resolveInstitutionIdsForMultiSelectChoices(supabase, defId, cids);
      s.forEach((id) => union.add(id));
    }
    current = intersectSets(current, union);
    if (current.size === 0) break;
  }
  if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");

  const finalIds = Array.from(current);
  const [featuredOrderResult, instructorResults] = await Promise.all([
    featuredOrderPromise,
    instructorPromise,
  ]);
  if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");

  const featuredOrderMap = featuredOrderResult.orderMap;

  if (instructorResults.length === 0) {
    const ordered = await orderInstitutionIdsByNameAndFeatured(
      supabase,
      finalIds,
      featuredOrderMap,
    );
    if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");
    return {
      kind: "id_set",
      supabase,
      listingName,
      orderedIds: ordered.orderedIds,
      totalCount: ordered.totalCount,
    };
  }

  const stubs = await fetchSortStubsByIds(supabase, finalIds);
  if (!input.isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");
  stubs.sort((a, b) =>
    String(a.institution_name ?? "").localeCompare(String(b.institution_name ?? ""), "tr", {
      sensitivity: "base",
    }),
  );
  const institutionStubs: CategoryResultItem[] = stubs.map((stub) => ({
    id: String(stub.id),
    resultType: "institution" as const,
    name: String(stub.institution_name ?? "").trim() || FALLBACK,
    description: "",
    location: FALLBACK,
    price: FALLBACK,
    ageRange: FALLBACK,
    badges: [],
    institutionId: stub.id,
  }));
  const mergedOrder = finalizeCategoryResults(
    institutionStubs,
    instructorResults,
    featuredOrderMap,
  );
  return {
    kind: "merged_order",
    supabase,
    listingName,
    mergedOrder,
    totalCount: mergedOrder.length,
  };
}

async function hydrateCategoryListingPage(
  context: CategoryListingContext,
  page: number,
  knownTotalCount: number | null,
  isCurrent: () => boolean,
): Promise<CategoryListingPageResult> {
  const pageSize = CATEGORY_RESULTS_PAGE_SIZE;

  if (context.kind === "not_found") {
    return {
      results: [],
      totalCount: 0,
      categoryLabel: context.listingName,
      error: "CATEGORY_NOT_FOUND",
    };
  }

  if (context.kind === "db_range") {
    const pageResult = await fetchCategoryInstitutionPageFromDb(
      context.supabase,
      context.categoryId,
      context.listingName,
      context.listingLocation,
      context.searchTerm,
      context.relatedSearch,
      context.featuredOrderMap,
      page,
      pageSize,
      undefined,
      knownTotalCount,
    );
    if (!isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");
    const pageIds = pageResult.rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
    const kurumTuru = await loadKurumTuruLabelByInstitutionId(context.supabase, pageIds);
    if (!isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");
    return {
      results: applyKurumTuruLabels(
        pageResult.rows.map((row) => mapRow(context.supabase, row)),
        kurumTuru,
      ),
      totalCount: pageResult.totalCount,
      categoryLabel: context.listingName,
      error: null,
    };
  }

  if (context.kind === "id_set") {
    const pageResult = await fetchInstitutionPageForIdSet(
      context.supabase,
      context.orderedIds,
      page,
      pageSize,
    );
    if (!isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");
    const pageIds = pageResult.rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
    const kurumTuru = await loadKurumTuruLabelByInstitutionId(context.supabase, pageIds);
    if (!isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");
    return {
      results: applyKurumTuruLabels(
        pageResult.rows.map((row) => mapRow(context.supabase, row)),
        kurumTuru,
      ),
      totalCount: context.totalCount,
      categoryLabel: context.listingName,
      error: null,
    };
  }

  if (context.kind === "instructors_only") {
    const start = (Math.max(1, page) - 1) * pageSize;
    return {
      results: context.instructorOnly.slice(start, start + pageSize),
      totalCount: context.totalCount,
      categoryLabel: context.listingName,
      error: null,
    };
  }

  const results = await hydrateMergedOrderPage(
    context.supabase,
    context.mergedOrder,
    page,
    pageSize,
  );
  if (!isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");
  return {
    results,
    totalCount: context.totalCount,
    categoryLabel: context.listingName,
    error: null,
  };
}

export function useCategoryInstitutions(
  categoryName: string,
  options?: {
    search?: string;
    /** Eski metin ilçe; konum filtresi ID kolonları üzerinden gider. */
    district?: string;
    ilId?: string;
    ilceId?: string;
    mahalleId?: string;
    /** URL/searchParams okunana kadar kurum sorgusunu beklet. */
    locationReady?: boolean;
    /** institution_categories.slug — id çözümlemesi ve debug log için. */
    categorySlug?: string;
    /** Yalnızca Okul kategori sayfası doldurur. */
    schoolFilters?: SchoolCategoryFilterPayload;
    /** 1 tabanlı sayfa; verilmezse dahili state kullanılır. */
    page?: number;
    onPageChange?: (page: number) => void;
  },
): {
  results: CategoryResultItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  isLoading: boolean;
  error: string | null;
  categoryLabel: string;
} {
  const rawSearch = options?.search ?? "";
  const ilId = String(options?.ilId ?? "").trim();
  const ilceId = String(options?.ilceId ?? "").trim();
  const mahalleId = String(options?.mahalleId ?? "").trim();
  const locationReady = options?.locationReady !== false;
  const categorySlug = String(options?.categorySlug ?? "").trim();
  const schoolFilters = options?.schoolFilters;
  const controlledPage = options?.page;
  const onPageChange = options?.onPageChange;

  const [results, setResults] = useState<CategoryResultItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [internalPage, setInternalPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryLabel, setCategoryLabel] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const generationRef = useRef(0);
  const cacheRef = useRef<CategoryListingCache>(createCategoryListingCache("", 0));
  const activePageRef = useRef(1);

  const setPage = (next: number) => {
    const safe = Math.max(1, Math.floor(next) || 1);
    if (controlledPage == null) setInternalPage(safe);
    onPageChange?.(safe);
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(rawSearch);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [rawSearch]);

  const schoolFiltersKey = useMemo(() => JSON.stringify(schoolFilters ?? null), [schoolFilters]);
  // Sıralama sabit (isim + featured); key'e açıkça dahil — gelecekteki sort parametreleri için.
  const sortKey = "name_asc_featured";
  const filtersIdentityKey = `${categoryName}|${categorySlug}|${debouncedSearch}|${ilId}|${ilceId}|${mahalleId}|${schoolFiltersKey}|${sortKey}`;

  // Filtre değişince sayfayı aynı render'da 1'e çek — ayrı effect ile çift fetch önlenir.
  const [filtersPageKey, setFiltersPageKey] = useState(filtersIdentityKey);
  if (filtersIdentityKey !== filtersPageKey) {
    setFiltersPageKey(filtersIdentityKey);
    if (controlledPage == null && internalPage !== 1) {
      setInternalPage(1);
    }
  }
  const page =
    filtersIdentityKey !== filtersPageKey
      ? 1
      : controlledPage != null && controlledPage > 0
        ? controlledPage
        : internalPage;
  activePageRef.current = page;

  useEffect(() => {
    generationRef.current += 1;
    cacheRef.current = createCategoryListingCache(filtersIdentityKey, generationRef.current);
  }, [filtersIdentityKey]);

  useEffect(() => {
    const targetName = String(categoryName ?? "").trim();
    const slug = categorySlug;

    if (!locationReady) {
      setIsLoading(true);
      return;
    }

    if (!targetName && !slug) {
      setResults([]);
      setTotalCount(0);
      setIsLoading(false);
      setError(null);
      setCategoryLabel("");
      return;
    }

    const generation = generationRef.current;
    const isCurrent = () => generationRef.current === generation;
    let cancelled = false;
    const cache = cacheRef.current;

    const applyPageResult = (pageResult: CategoryListingPageResult, pageNumber: number) => {
      if (!isCurrent() || cancelled) return;
      cache.pages.set(pageNumber, pageResult.results);
      cache.totalCount = pageResult.totalCount;
      cache.categoryLabel = pageResult.categoryLabel;
      trimCategoryListingCache(cache, activePageRef.current);
      if (pageNumber === activePageRef.current) {
        setResults(pageResult.results);
        setTotalCount(pageResult.totalCount);
        setCategoryLabel(pageResult.categoryLabel);
        setError(pageResult.error);
        setIsLoading(false);
      }
    };

    const loadPage = (pageNumber: number): Promise<CategoryListingPageResult> => {
      const cached = cache.pages.get(pageNumber);
      if (cached) {
        return Promise.resolve({
          results: cached,
          totalCount: cache.totalCount ?? cached.length,
          categoryLabel: cache.categoryLabel,
          error: null,
        });
      }

      const inflight = cache.inflight.get(pageNumber);
      if (inflight) return inflight;

      const promise = (async (): Promise<CategoryListingPageResult> => {
        if (!isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");

        if (!cache.context) {
          cache.context = await buildCategoryListingContext({
            categoryName,
            categorySlug: slug,
            debouncedSearch,
            ilId,
            ilceId,
            mahalleId,
            schoolFilters,
            isCurrent,
          });
          if (!isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");
          if (cache.context.kind === "not_found") {
            cache.totalCount = 0;
            cache.categoryLabel = cache.context.listingName;
          } else if (cache.context.kind === "db_range") {
            cache.categoryLabel = cache.context.listingName;
          } else {
            cache.totalCount = cache.context.totalCount;
            cache.categoryLabel = cache.context.listingName;
          }
        }

        const pageResult = await hydrateCategoryListingPage(
          cache.context,
          pageNumber,
          cache.totalCount,
          isCurrent,
        );
        if (!isCurrent()) throw new Error("CATEGORY_LISTING_CANCELLED");
        cache.pages.set(pageNumber, pageResult.results);
        cache.totalCount = pageResult.totalCount;
        cache.categoryLabel = pageResult.categoryLabel;
        trimCategoryListingCache(cache, activePageRef.current);
        return pageResult;
      })();

      cache.inflight.set(pageNumber, promise);
      return promise.finally(() => {
        if (cache.inflight.get(pageNumber) === promise) {
          cache.inflight.delete(pageNumber);
        }
      });
    };

    const prefetchAhead = async (activePageNumber: number) => {
      const total = cache.totalCount;
      if (total == null) return;
      const totalPages = Math.max(1, Math.ceil(total / CATEGORY_RESULTS_PAGE_SIZE));
      for (let delta = 1; delta <= CATEGORY_PREFETCH_AHEAD; delta += 1) {
        if (!isCurrent() || cancelled) return;
        const nextPage = activePageNumber + delta;
        if (nextPage > totalPages) break;
        if (cache.pages.has(nextPage)) continue;
        try {
          await loadPage(nextPage);
          if (!isCurrent() || cancelled) return;
          trimCategoryListingCache(cache, activePageRef.current);
        } catch (e) {
          if (String((e as Error)?.message ?? "") === "CATEGORY_LISTING_CANCELLED") return;
          console.error(
            "[category][institutions][prefetch-error]",
            describeSupabaseError(e),
          );
          return;
        }
      }
    };

    // Önbellek hit: UI'yı hemen güncelle, prefetch arka planda
    const cachedActive = cache.pages.get(page);
    if (cachedActive && cache.queryKey === filtersIdentityKey) {
      setResults(cachedActive);
      setTotalCount(cache.totalCount ?? cachedActive.length);
      setCategoryLabel(cache.categoryLabel);
      setError(null);
      setIsLoading(false);
      void prefetchAhead(page);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const pageResult = await loadPage(page);
        if (!isCurrent() || cancelled) return;
        applyPageResult(pageResult, page);
        // Prefetch aktif sayfayı bloklamaz
        void prefetchAhead(page);
      } catch (e) {
        if (String((e as Error)?.message ?? "") === "CATEGORY_LISTING_CANCELLED") return;
        console.error(
          "[category][institutions][school-filter-error]",
          describeSupabaseError(e),
        );
        if (!cancelled && isCurrent()) {
          setResults([]);
          setTotalCount(0);
          setError("Kurumlar yüklenirken bir hata oluştu.");
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // schoolFilters için kararlı JSON anahtarı kullanılıyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    categoryName,
    categorySlug,
    debouncedSearch,
    ilId,
    ilceId,
    mahalleId,
    locationReady,
    schoolFiltersKey,
    filtersIdentityKey,
    page,
  ]);

  return {
    results,
    totalCount,
    page,
    pageSize: CATEGORY_RESULTS_PAGE_SIZE,
    setPage,
    isLoading,
    error,
    categoryLabel,
  };
}

function applyKurumTuruLabels(
  items: CategoryResultItem[],
  labels: Map<number, string>,
): CategoryResultItem[] {
  return items.map((item) => {
    if (item.resultType === "instructor") return item;
    const id = Number(item.institutionId ?? item.id);
    const label = Number.isFinite(id) ? String(labels.get(id) ?? "").trim() : "";
    const subcategoryName = label || String(item.subcategoryName ?? "").trim();
    return { ...item, subcategoryName: subcategoryName || undefined };
  });
}

/**
 * Kurum Türü tanım ID'leri kategori/filtreye bağlı değildir (global is_active + Okul Durumu).
 * Prefetch sırasında aynı definitions sorgusunu sayfa başına tekrarlamamak için
 * kısa ömürlü cache + in-flight dedupe.
 */
const KURUM_TURU_DEFS_TTL_MS = 60_000;
let kurumTuruDefIdsCache: { defIds: number[]; expiresAt: number } | null = null;
let kurumTuruDefIdsInflight: Promise<number[]> | null = null;

async function loadKurumTuruDefinitionIds(supabase: SupabaseBrowser): Promise<number[]> {
  const now = Date.now();
  if (kurumTuruDefIdsCache && kurumTuruDefIdsCache.expiresAt > now) {
    return kurumTuruDefIdsCache.defIds;
  }
  if (kurumTuruDefIdsInflight) return kurumTuruDefIdsInflight;

  const promise = (async (): Promise<number[]> => {
    const { data: defsRaw, error: defErr } = await supabase
      .from("institution_feature_definitions")
      .select("id, name, slug")
      .eq("is_active", true);
    if (defErr) throw defErr;

    const defIds = (
      (defsRaw ?? []) as Array<{ id: number; name?: string | null; slug?: string | null }>
    )
      .filter((row) => Number.isFinite(row.id) && isOkulDurumuDefinition(row))
      .map((row) => row.id);

    kurumTuruDefIdsCache = {
      defIds,
      expiresAt: Date.now() + KURUM_TURU_DEFS_TTL_MS,
    };
    return defIds;
  })().finally(() => {
    if (kurumTuruDefIdsInflight === promise) {
      kurumTuruDefIdsInflight = null;
    }
  });

  kurumTuruDefIdsInflight = promise;
  return promise;
}

async function loadKurumTuruLabelByInstitutionId(
  supabase: SupabaseBrowser,
  institutionIds: number[],
): Promise<Map<number, string>> {
  const labels = new Map<number, string>();
  const ids = [...new Set(institutionIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return labels;

  try {
    const defIds = await loadKurumTuruDefinitionIds(supabase);
    if (defIds.length === 0) return labels;

    const entries: Array<{ id: number; institution_id: number }> = [];
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
      const { data, error } = await supabase
        .from("institution_feature_entries")
        .select("id, institution_id")
        .in("feature_definition_id", defIds)
        .in("institution_id", ids.slice(i, i + IN_CHUNK));
      if (error) throw error;
      for (const row of (data ?? []) as Array<{ id: number; institution_id: number }>) {
        if (Number.isFinite(row.id) && Number.isFinite(row.institution_id)) entries.push(row);
      }
    }
    if (entries.length === 0) return labels;

    const institutionIdByEntryId = new Map(entries.map((row) => [row.id, row.institution_id]));
    const choiceIdsByInstitution = new Map<number, number[]>();
    for (let i = 0; i < entries.length; i += IN_CHUNK) {
      const entryIds = entries.slice(i, i + IN_CHUNK).map((row) => row.id);
      const { data, error } = await supabase
        .from("institution_feature_entry_choices")
        .select("institution_feature_entry_id, choice_id")
        .in("institution_feature_entry_id", entryIds);
      if (error) throw error;
      for (const row of (data ?? []) as Array<{
        institution_feature_entry_id: number;
        choice_id: number;
      }>) {
        const institutionId = institutionIdByEntryId.get(Number(row.institution_feature_entry_id));
        const choiceId = Number(row.choice_id);
        if (institutionId == null || !Number.isFinite(choiceId)) continue;
        const current = choiceIdsByInstitution.get(institutionId) ?? [];
        if (!current.includes(choiceId)) current.push(choiceId);
        choiceIdsByInstitution.set(institutionId, current);
      }
    }

    const choiceIds = [...new Set([...choiceIdsByInstitution.values()].flat())];
    const choiceNameById = new Map<number, string>();
    for (let i = 0; i < choiceIds.length; i += IN_CHUNK) {
      const { data, error } = await supabase
        .from("institution_feature_choices")
        .select("id, name")
        .in("id", choiceIds.slice(i, i + IN_CHUNK));
      if (error) throw error;
      for (const row of (data ?? []) as Array<{ id: number; name?: string | null }>) {
        const name = String(row.name ?? "").trim();
        if (name) choiceNameById.set(Number(row.id), name);
      }
    }

    for (const [institutionId, selectedIds] of choiceIdsByInstitution) {
      const names = selectedIds
        .map((choiceId) => choiceNameById.get(choiceId) ?? "")
        .filter(Boolean);
      if (names.length > 0) labels.set(institutionId, names.join(", "));
    }
  } catch (error) {
    console.error("[category][institutions][kurum-turu]", error);
  }

  return labels;
}

function mapRow(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  row: InstitutionRow,
): CategoryResultItem {
  const imageUrl =
    resolveInstitutionLogoPublicUrl(supabase, row.logo) || undefined;
  const name = String(row.institution_name ?? "").trim() || FALLBACK;
  const description = String(row.subheading ?? "").trim();
  const location = buildLocation(row.district, row.city);
  const slug = String(row.slug ?? "").trim();
  const typeJoin = row.institution_type;
  const typeRow = Array.isArray(typeJoin) ? typeJoin[0] ?? null : typeJoin ?? null;
  const typeName = String(typeRow?.name ?? "").trim();
  const categoryJoin = typeRow?.category;
  const categoryRow = Array.isArray(categoryJoin) ? categoryJoin[0] ?? null : categoryJoin ?? null;
  const highSchoolLabel = getHighSchoolTypeLabel(row.high_school_type);
  const subcategoryParts = [typeName, highSchoolLabel].filter(Boolean);
  const subcategoryName = subcategoryParts.length > 0 ? subcategoryParts.join(" · ") : undefined;
  const mapAddress = String(row.address ?? "").trim();
  const mapCity = String(row.city ?? "").trim();
  const mapDistrict = String(row.district ?? "").trim();
  const officialPhone = String(row.official_phone ?? "").trim();
  const officialEmail = String(row.official_email ?? "").trim();
  const mapCategoryName = String(categoryRow?.name ?? "").trim();
  const mapCategorySlug = String(categoryRow?.slug ?? "").trim();
  const mapCategoryIdRaw = Number(categoryRow?.id);
  const mapCategoryId = Number.isFinite(mapCategoryIdRaw) ? mapCategoryIdRaw : null;

  return {
    id: String(row.id),
    resultType: "institution",
    name,
    description,
    location,
    price: FALLBACK,
    ageRange: FALLBACK,
    badges: [],
    logoInitial: pickInitial(name),
    imageUrl,
    slug: slug || undefined,
    source: row.source ?? null,
    subcategoryName,
    institutionId: Number.isInteger(row.id) && row.id > 0 ? row.id : undefined,
    mapAddress: mapAddress || undefined,
    mapCity: mapCity || undefined,
    mapDistrict: mapDistrict || undefined,
    officialPhone: officialPhone || undefined,
    officialEmail: officialEmail || undefined,
    institutionTypeName: typeName || undefined,
    mapCategoryName: mapCategoryName || undefined,
    mapCategorySlug: mapCategorySlug || undefined,
    mapCategoryId,
  };
}
