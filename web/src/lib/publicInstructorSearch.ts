"use client";

import {
  buildUiToInstructorChoiceIdMap,
  fetchInstructorRealFeatureDefinitionsClient,
  INSTRUCTOR_FEATURE_ENTRIES_TABLE,
  INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE,
  isInstructorPriceRangeFeature,
  isInstructorHizmetYeriBooleanOption,
  isInstructorHizmetYeriFeatureName,
  resolveInstructorHizmetYeriBooleanDefinitionId,
  type InstructorFeatureDefinitionRow,
} from "@/lib/instructorFeaturesClient";
import { PUBLIC_INSTRUCTORS_TABLE } from "@/lib/publicInstructorClient";
import {
  buildProfileSearchVariants,
  escapeProfileLikeValue,
  resolveInstructorIdsByProfileSearch,
} from "@/lib/profileSearch";
import { resolvePublicInstructorProfilePictureUrl } from "@/lib/publicInstructorDetailClient";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildLocationAdMaps,
  formatInstructorLocationLabel,
  lookupLocationAds,
} from "@/lib/turkiyeLocationsClient";
import type { SchoolCategoryFilterPayload } from "@/components/category/schoolCategoryFilterTypes";
import type { InstructorCategoryFilterPayload } from "@/components/category/instructorCategoryFilterTypes";
import { formatInstitutionPriceRangeDisplay } from "@/lib/institutionPriceRangeFilter";
import { inputHHMMToDbTimeOrNull } from "@/lib/institutionHelpers";
import {
  extractStudentAgeFilterQueryFromRangePayload,
  isStudentAgeFilterDefinitionId,
  isStudentAgeFilterTextActive,
  resolveInstructorIdsByStudentAgeFilter,
  resolveStudentAgeFilterFromPayload,
} from "@/lib/institutionStudentAgeFilter";
import {
  isLegacyStudentAgeMultiSelectFeature,
  isStudentAgeRangeNumberFeature,
} from "@/lib/studentAgeRangeFeature";
import {
  LESSON_DURATION_MAX_SLUG,
  LESSON_DURATION_MIN_SLUG,
  isLessonDurationMinFeature,
  isLessonDurationRangeNumberFeature,
  lessonDurationStoredOverlapsSelected,
  parseLessonDurationInput,
} from "@/lib/instructorLessonDurationFeature";

export const PUBLIC_INSTRUCTOR_LIST_SELECT =
  "id, slug, name, surname, full_name, address, branch, bio, about, school, department, lesson_type, service_type, website, experience_years, profile_picture, category_id, is_approved, is_active, created_at, il_id, ilce_id, min_fiyat, max_fiyat";

const PUBLIC_INSTRUCTOR_SEARCH_COLUMNS = [
  "name",
  "surname",
  "full_name",
  "address",
  "branch",
  "bio",
  "about",
  "school",
  "department",
  "lesson_type",
  "service_type",
  "website",
] as const;

const QUERY_PAGE_SIZE = 1000;
const MAX_QUERY_PAGES = 10;

export type PublicInstructorListRow = {
  id: number;
  slug?: string | null;
  name?: string | null;
  surname?: string | null;
  full_name?: string | null;
  address?: string | null;
  branch?: string | null;
  bio?: string | null;
  about?: string | null;
  school?: string | null;
  department?: string | null;
  lesson_type?: string | null;
  service_type?: string | null;
  website?: string | null;
  experience_years?: number | null;
  profile_picture?: string | null;
  category_id?: number | null;
  is_approved?: boolean | null;
  is_active?: boolean | null;
  created_at?: string | null;
  il_id?: number | null;
  ilce_id?: number | null;
  min_fiyat?: number | null;
  max_fiyat?: number | null;
  locationIlAd?: string | null;
  locationIlceAd?: string | null;
  category_name?: string | null;
};

export type FeaturedInstructorItem = {
  id: number;
  name: string;
  slug: string;
  imageUrl: string;
  href: string;
  bodyMainCategory: string;
  bodyLocation: string;
  branch?: string;
  priceRange?: string;
};

export type InstructorListingFilters = {
  /** null = feature filtresi yok; boş Set = eşleşme yok */
  featureFilterIds: Set<number> | null;
  branchTitleTerms: string[];
  /** Liste fiyat slider'ı. Aktif runtime filtresi instructors.min_fiyat / max_fiyat kolonlarındadır. */
  priceRange: { min: number; max: number } | null;
};

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

async function resolveInstructorLocationIdsByName(
  supabase: SupabaseBrowser,
  searchTerm: string,
): Promise<{ ilIds: number[]; ilceIds: number[] }> {
  const needle = `%${escapeProfileLikeValue(searchTerm.trim())}%`;
  if (needle === "%%") return { ilIds: [], ilceIds: [] };

  const [{ data: matchingIller }, { data: matchingIlceler }] = await Promise.all([
    supabase.from("iller").select("id").ilike("ad", needle),
    supabase.from("ilceler").select("id").ilike("ad", needle),
  ]);

  const toIds = (rows: unknown): number[] =>
    ((rows ?? []) as Array<{ id: number }>)
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id) && id > 0);

  return {
    ilIds: toIds(matchingIller),
    ilceIds: toIds(matchingIlceler),
  };
}

function applyPublicInstructorSearchFilter<
  T extends { or: (filters: string) => T },
>(
  query: T,
  searchTerm: string,
  relatedInstructorIds: number[] = [],
  locationIds: { ilIds: number[]; ilceIds: number[] } = { ilIds: [], ilceIds: [] },
): T {
  const variants = buildProfileSearchVariants(searchTerm).map(escapeProfileLikeValue).filter(Boolean);
  if (variants.length === 0 && locationIds.ilIds.length === 0 && locationIds.ilceIds.length === 0) {
    return query;
  }

  const orParts = variants.flatMap((term) => {
    const q = `%${term}%`;
    return PUBLIC_INSTRUCTOR_SEARCH_COLUMNS.map((col) => `${col}.ilike.${q}`);
  });
  const numericSearch = Number(searchTerm.replace(",", "."));
  if (Number.isFinite(numericSearch)) {
    orParts.push(`experience_years.eq.${numericSearch}`);
  }
  if (relatedInstructorIds.length > 0) {
    orParts.push(`id.in.(${relatedInstructorIds.join(",")})`);
  }
  if (locationIds.ilIds.length > 0) {
    orParts.push(`il_id.in.(${locationIds.ilIds.join(",")})`);
  }
  if (locationIds.ilceIds.length > 0) {
    orParts.push(`ilce_id.in.(${locationIds.ilceIds.join(",")})`);
  }
  if (orParts.length === 0) return query;
  return query.or(orParts.join(","));
}

export function getPublicInstructorDetailHref(
  slug: string | null | undefined,
  id: number,
): string {
  const hrefKey = String(slug ?? "").trim() || String(id);
  return `/egitmenler/${encodeURIComponent(hrefKey)}`;
}

export function mapPublicInstructorDisplayName(row: PublicInstructorListRow): string {
  const fullName = String(row.full_name ?? "").trim();
  if (fullName) return fullName;
  return `${String(row.name ?? "").trim()} ${String(row.surname ?? "").trim()}`.trim() || "Eğitmen";
}

export function buildPublicInstructorLocation(row: PublicInstructorListRow): string {
  return formatInstructorLocationLabel(
    String(row.locationIlAd ?? "").trim(),
    String(row.locationIlceAd ?? "").trim(),
  );
}

/** Kart/liste görünümü — il, ilçe; boşsa fallback yok. */
export function buildPublicInstructorCardLocation(row: PublicInstructorListRow): string {
  return [String(row.locationIlAd ?? "").trim(), String(row.locationIlceAd ?? "").trim()]
    .filter(Boolean)
    .join(", ");
}

export function resolvePublicInstructorFeaturedCardLabels(row: PublicInstructorListRow): {
  categoryLabel: string;
  branch: string;
  location: string;
} {
  return {
    categoryLabel: String(row.category_name ?? "").trim(),
    branch: String(row.branch ?? "").trim(),
    location: buildPublicInstructorCardLocation(row),
  };
}

export async function attachPublicInstructorCategoryNames(
  rows: PublicInstructorListRow[],
  supabaseArg?: SupabaseBrowser,
): Promise<PublicInstructorListRow[]> {
  if (rows.length === 0) return rows;

  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const categoryIds = [
    ...new Set(
      rows
        .map((row) => Number(row.category_id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  if (categoryIds.length === 0) return rows;

  const { data, error } = await supabase
    .from("instructor_categories")
    .select("id, name")
    .in("id", categoryIds)
    .eq("is_active", true);

  if (error || !data?.length) return rows;

  const nameById = new Map<number, string>();
  for (const item of data as Array<{ id: number; name: string | null }>) {
    const id = Number(item.id);
    const name = String(item.name ?? "").trim();
    if (Number.isFinite(id) && name) nameById.set(id, name);
  }

  return rows.map((row) => {
    const categoryId = Number(row.category_id);
    if (!Number.isFinite(categoryId) || categoryId <= 0) return row;
    const categoryName = nameById.get(categoryId);
    if (!categoryName) return row;
    return { ...row, category_name: categoryName };
  });
}

export async function enrichPublicInstructorListRows(
  rows: PublicInstructorListRow[],
  supabaseArg?: SupabaseBrowser,
): Promise<PublicInstructorListRow[]> {
  const withLocation = await attachPublicInstructorLocationAds(rows);
  return attachPublicInstructorCategoryNames(withLocation, supabaseArg);
}

export async function attachPublicInstructorLocationAds(
  rows: PublicInstructorListRow[],
): Promise<PublicInstructorListRow[]> {
  if (rows.length === 0) return rows;
  const maps = await buildLocationAdMaps(rows);
  return rows.map((row) => {
    const { ilAd, ilceAd } = lookupLocationAds(row.il_id, row.ilce_id, maps);
    return { ...row, locationIlAd: ilAd, locationIlceAd: ilceAd };
  });
}

function pickInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toLocaleUpperCase("tr-TR") : "E";
}

function intersectInstructorIdSets(a: Set<number>, b: Set<number>): Set<number> {
  const out = new Set<number>();
  for (const id of a) {
    if (b.has(id)) out.add(id);
  }
  return out;
}

/**
 * Kategori eğitmen fiyat filtresi — instructors.min_fiyat / max_fiyat.
 * Kurum resolveInstitutionIdsByPriceRange ile aynı overlap ve NULL kuralı:
 * ikisi dolu: min_fiyat <= selectedMax AND max_fiyat >= selectedMin (ikisi de NOT NULL);
 * yalnız min: max_fiyat >= selectedMin (NOT NULL);
 * yalnız max: min_fiyat <= selectedMax (NOT NULL).
 */
export async function resolveInstructorIdsByPriceRange(
  supabase: SupabaseBrowser,
  range: { min?: number | null; max?: number | null },
): Promise<number[]> {
  const minRaw = range.min;
  const maxRaw = range.max;
  const hasMin = minRaw != null && Number.isFinite(Number(minRaw));
  const hasMax = maxRaw != null && Number.isFinite(Number(maxRaw));
  if (!hasMin && !hasMax) return [];

  const selectedMin = hasMin ? Math.max(0, Math.floor(Number(minRaw))) : null;
  const selectedMax = hasMax ? Math.max(0, Math.floor(Number(maxRaw))) : null;

  const rows: Array<{ id: number }> = [];
  let from = 0;
  for (;;) {
    const to = from + QUERY_PAGE_SIZE - 1;

    let query = supabase.from("instructors").select("id");
    if (selectedMin != null && selectedMax != null) {
      query = query
        .not("min_fiyat", "is", null)
        .not("max_fiyat", "is", null)
        .lte("min_fiyat", selectedMax)
        .gte("max_fiyat", selectedMin);
    } else if (selectedMin != null) {
      query = query.not("max_fiyat", "is", null).gte("max_fiyat", selectedMin);
    } else if (selectedMax != null) {
      query = query.not("min_fiyat", "is", null).lte("min_fiyat", selectedMax);
    }

    const { data, error } = await query.range(from, to);
    if (error) throw error;
    const batch = (data ?? []) as Array<{ id: number }>;
    rows.push(...batch);
    if (batch.length < QUERY_PAGE_SIZE) break;
    from += QUERY_PAGE_SIZE;
  }

  const out: number[] = [];
  for (const row of rows) {
    const id = Number(row.id);
    if (Number.isFinite(id) && id > 0) out.push(id);
  }
  return out;
}

/** Aynı overlap ve NULL kuralı; /egitmenler istemci filtresi için. */
export function instructorStoredPriceOverlapsSelectedRange(
  minFiyat: number | null | undefined,
  maxFiyat: number | null | undefined,
  selected: { min?: number | null; max?: number | null } | null | undefined,
): boolean {
  if (!selected) return true;
  const hasMin = selected.min != null && Number.isFinite(Number(selected.min));
  const hasMax = selected.max != null && Number.isFinite(Number(selected.max));
  if (!hasMin && !hasMax) return true;

  const selectedMin = hasMin ? Math.max(0, Math.floor(Number(selected.min))) : null;
  const selectedMax = hasMax ? Math.max(0, Math.floor(Number(selected.max))) : null;
  const storedMin =
    minFiyat == null || !Number.isFinite(Number(minFiyat)) ? null : Number(minFiyat);
  const storedMax =
    maxFiyat == null || !Number.isFinite(Number(maxFiyat)) ? null : Number(maxFiyat);

  if (selectedMin != null && selectedMax != null) {
    return (
      storedMin != null &&
      storedMax != null &&
      storedMin <= selectedMax &&
      storedMax >= selectedMin
    );
  }
  if (selectedMin != null) return storedMax != null && storedMax >= selectedMin;
  return storedMin != null && selectedMax != null && storedMin <= selectedMax;
}

export async function fetchPublicInstructorsForListing(
  supabase: SupabaseBrowser,
  options?: {
    searchTerm?: string;
    categoryId?: number | null;
    ilId?: number | null;
    ilceId?: number | null;
    mahalleId?: number | null;
    priceRange?: { min?: number | null; max?: number | null } | null;
    limit?: number;
    allowedInstructorIds?: Set<number>;
  },
): Promise<PublicInstructorListRow[]> {
  const searchTerm = String(options?.searchTerm ?? "").trim();
  const ilId =
    typeof options?.ilId === "number" && Number.isFinite(options.ilId) && options.ilId > 0
      ? options.ilId
      : null;
  const ilceId =
    typeof options?.ilceId === "number" && Number.isFinite(options.ilceId) && options.ilceId > 0
      ? options.ilceId
      : null;
  const mahalleId =
    typeof options?.mahalleId === "number" && Number.isFinite(options.mahalleId) && options.mahalleId > 0
      ? options.mahalleId
      : null;
  const categoryId = options?.categoryId;
  const hardLimit = options?.limit ?? 600;
  let allowedInstructorIds = options?.allowedInstructorIds;

  const priceRange = options?.priceRange;
  const hasPriceMin = priceRange?.min != null && Number.isFinite(Number(priceRange.min));
  const hasPriceMax = priceRange?.max != null && Number.isFinite(Number(priceRange.max));
  if (priceRange && (hasPriceMin || hasPriceMax)) {
    const priceFilterIds = await resolveInstructorIdsByPriceRange(supabase, priceRange);
    if (priceFilterIds.length === 0) return [];
    const priceFilterIdSet = new Set(priceFilterIds);
    allowedInstructorIds =
      allowedInstructorIds !== undefined
        ? intersectInstructorIdSets(allowedInstructorIds, priceFilterIdSet)
        : priceFilterIdSet;
  }

  if (allowedInstructorIds !== undefined && allowedInstructorIds.size === 0) {
    return [];
  }

  const rows: PublicInstructorListRow[] = [];
  const relatedInstructorIds = searchTerm
    ? await resolveInstructorIdsByProfileSearch(supabase, searchTerm)
    : [];
  const locationIds = searchTerm
    ? await resolveInstructorLocationIdsByName(supabase, searchTerm)
    : { ilIds: [], ilceIds: [] };

  for (let page = 0; page < MAX_QUERY_PAGES; page += 1) {
    const from = page * QUERY_PAGE_SIZE;
    const to = from + QUERY_PAGE_SIZE - 1;

    let query = supabase
      .from(PUBLIC_INSTRUCTORS_TABLE)
      .select(PUBLIC_INSTRUCTOR_LIST_SELECT)
      .eq("is_active", true)
      .eq("is_approved", true);

    if (categoryId != null && Number.isFinite(categoryId)) {
      query = query.eq("category_id", categoryId);
    }
    if (ilId != null) {
      query = query.eq("il_id", ilId);
    }
    if (ilceId != null) {
      query = query.eq("ilce_id", ilceId);
    }
    if (mahalleId != null) {
      query = query.eq("mahalle_id", mahalleId);
    }
    if (allowedInstructorIds !== undefined && allowedInstructorIds.size > 0) {
      query = query.in("id", Array.from(allowedInstructorIds));
    }
    if (searchTerm) {
      query = applyPublicInstructorSearchFilter(query, searchTerm, relatedInstructorIds, locationIds);
    }

    const { data, error } = await query
      .order("full_name", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })
      .order("surname", { ascending: true })
      .range(from, to);

    if (error) throw error;

    const batch = ((data ?? []) as PublicInstructorListRow[]).filter(
      (row) => Number.isFinite(Number(row.id)) && Number(row.id) > 0,
    );
    rows.push(...batch);
    if (batch.length < QUERY_PAGE_SIZE || rows.length >= hardLimit) break;
  }

  rows.sort((a, b) =>
    mapPublicInstructorDisplayName(a).localeCompare(mapPublicInstructorDisplayName(b), "tr", {
      sensitivity: "base",
    }),
  );

  const filteredRows = applyInstructorListingFilters(rows, {
    featureFilterIds: null,
    branchTitleTerms: [],
    priceRange: null,
  });

  return attachPublicInstructorLocationAds(filteredRows.slice(0, hardLimit));
}

export type MappedPublicInstructorListItem = {
  id: string;
  resultType: "instructor";
  name: string;
  description: string;
  location: string;
  price: string;
  ageRange: string;
  badges: string[];
  logoInitial: string;
  imageUrl?: string;
  slug?: string;
  detailUrl: string;
  instructorTitle?: string;
  instructorBranch?: string;
  priceRange?: string;
  /** Gerçek `instructors.id`; presentation `id` alanından bağımsız. */
  instructorId?: number;
};

export function mapPublicInstructorToListItem(
  row: PublicInstructorListRow,
  supabase: SupabaseBrowser,
): MappedPublicInstructorListItem | null {
  const numericId = Number(row.id);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  const name = mapPublicInstructorDisplayName(row);
  const branch = String(row.branch ?? "").trim();
  const school = String(row.school ?? "").trim();
  const about = String(row.about ?? "").trim();
  const bio = String(row.bio ?? "").trim();
  const description = about || bio || branch || school;
  const priceRange = formatInstitutionPriceRangeDisplay(row.min_fiyat, row.max_fiyat) ?? "";
  const imageUrl =
    resolvePublicInstructorProfilePictureUrl(String(row.profile_picture ?? "").trim(), supabase) ||
    undefined;

  const slug = String(row.slug ?? "").trim() || String(numericId);

  return {
    id: `instructor-${numericId}`,
    resultType: "instructor",
    name,
    description,
    location: buildPublicInstructorLocation(row),
    price: priceRange || "-",
    ageRange: "-",
    badges: [],
    logoInitial: pickInitial(name),
    imageUrl,
    slug,
    detailUrl: getPublicInstructorDetailHref(row.slug, numericId),
    instructorTitle: school || undefined,
    instructorBranch: branch || undefined,
    priceRange: priceRange || undefined,
    instructorId: numericId,
  };
}

function normalizeFilterKey(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isBranchOrTitleDefinition(row: { name?: string | null; slug?: string | null }): boolean {
  const t = normalizeFilterKey(`${row.slug ?? ""} ${row.name ?? ""}`);
  return (
    t.includes("brans") ||
    t.includes("branch") ||
    t === "unvan" ||
    t.includes(" title") ||
    t.startsWith("title ")
  );
}

function parseOptionalNumber(raw: string): number | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseChoiceKey(key: string): { choiceId: number | null; definitionId: number | null } {
  const trimmed = String(key ?? "").trim();
  if (!trimmed.startsWith("choice:")) return { choiceId: null, definitionId: null };

  const parts = trimmed.split(":");
  const choiceId = Number(parts[1]);
  const defMarkerIndex = parts.indexOf("def");
  const definitionId = defMarkerIndex >= 0 ? Number(parts[defMarkerIndex + 1]) : Number.NaN;

  return {
    choiceId: Number.isFinite(choiceId) ? choiceId : null,
    definitionId: Number.isFinite(definitionId) ? definitionId : null,
  };
}

function fieldMatchesAnyTerm(value: string | null | undefined, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const hay = normalizeFilterKey(String(value ?? ""));
  if (!hay) return false;
  return terms.some((term) => {
    const needle = normalizeFilterKey(term);
    return Boolean(needle) && hay.includes(needle);
  });
}

function intersectSets(a: Set<number>, b: Set<number>): Set<number> {
  const out = new Set<number>();
  for (const id of a) {
    if (b.has(id)) out.add(id);
  }
  return out;
}

function applyIntersect(
  accumulated: Set<number> | null,
  next: Set<number>,
): Set<number> {
  return accumulated === null ? new Set<number>(next) : intersectSets(accumulated, next);
}

function isFilterIdSetEmpty(allowedIds: Set<number> | null): boolean {
  return allowedIds !== null && allowedIds.size === 0;
}

function hasAnySchoolPayloadFilters(payload: SchoolCategoryFilterPayload | undefined): boolean {
  if (!payload) return false;
  if (isStudentAgeFilterTextActive(payload.studentAgeRange)) return true;
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

async function resolveInstructorIdsForInstructorChoice(
  supabase: SupabaseBrowser,
  definitionId: number,
  choiceId: number,
): Promise<Set<number>> {
  const out = new Set<number>();
  const { data: entries, error: e1 } = await supabase
    .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
    .select("id, instructor_id")
    .eq("feature_definition_id", definitionId);
  if (e1) throw e1;

  const rows = (entries ?? []) as Array<{ id: number; instructor_id: number }>;
  const entryToInstructor = new Map<number, number>();
  rows.forEach((r) => entryToInstructor.set(Number(r.id), Number(r.instructor_id)));
  const entryIds = rows.map((r) => r.id).filter((id) => Number.isFinite(id));
  if (entryIds.length === 0) return out;

  const { data: links, error: e2 } = await supabase
    .from(INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE)
    .select("instructor_feature_entry_id, choice_id")
    .in("instructor_feature_entry_id", entryIds)
    .eq("choice_id", choiceId);
  if (e2) throw e2;

  for (const row of (links ?? []) as Array<{ instructor_feature_entry_id: number }>) {
    const iid = entryToInstructor.get(Number(row.instructor_feature_entry_id));
    if (Number.isFinite(iid)) out.add(iid!);
  }
  return out;
}

async function resolveInstructorIdsForBooleanDefinition(
  supabase: SupabaseBrowser,
  definitionId: number,
): Promise<Set<number>> {
  const out = new Set<number>();
  const { data, error } = await supabase
    .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
    .select("instructor_id")
    .eq("feature_definition_id", definitionId)
    .eq("boolean_answer", true);
  if (error) throw error;
  for (const row of (data ?? []) as Array<{ instructor_id: number }>) {
    const iid = Number(row.instructor_id);
    if (Number.isFinite(iid)) out.add(iid);
  }
  return out;
}

async function resolveInstructorIdsNumberRangeForDefinition(
  supabase: SupabaseBrowser,
  definitionId: number,
  minBound: number | null,
  maxBound: number | null,
): Promise<Set<number>> {
  const out = new Set<number>();
  const { data, error } = await supabase
    .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
    .select("instructor_id, number_answer, text_answer")
    .eq("feature_definition_id", definitionId);
  if (error) throw error;

  for (const row of (data ?? []) as Array<{
    instructor_id: number;
    number_answer: number | null;
    text_answer: string | null;
  }>) {
    const iid = Number(row.instructor_id);
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

async function resolveInstructorIdsByLessonDurationOverlap(
  supabase: SupabaseBrowser,
  selected: { min: number | null; max: number | null },
): Promise<Set<number>> {
  const out = new Set<number>();
  const { data: defs, error: defsError } = await supabase
    .from("instructor_feature_definitions")
    .select("id, slug, is_active")
    .eq("is_active", true)
    .in("slug", [LESSON_DURATION_MIN_SLUG, LESSON_DURATION_MAX_SLUG]);
  if (defsError) throw defsError;

  let minId: number | null = null;
  let maxId: number | null = null;
  for (const row of (defs ?? []) as Array<{ id: number; slug?: string | null }>) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    if (isLessonDurationMinFeature(row)) minId = id;
    else maxId = id;
  }
  if (minId == null || maxId == null) return out;

  const { data: entries, error: entriesError } = await supabase
    .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
    .select("instructor_id, feature_definition_id, number_answer")
    .in("feature_definition_id", [minId, maxId]);
  if (entriesError) throw entriesError;

  const byInstructor = new Map<number, { min: number | null; max: number | null }>();
  for (const row of (entries ?? []) as Array<{
    instructor_id: number;
    feature_definition_id: number;
    number_answer: number | null;
  }>) {
    const instructorId = Number(row.instructor_id);
    const definitionId = Number(row.feature_definition_id);
    const answer =
      row.number_answer != null && Number.isFinite(Number(row.number_answer))
        ? Number(row.number_answer)
        : null;
    if (!Number.isFinite(instructorId) || answer == null || answer < 0) continue;
    const current = byInstructor.get(instructorId) ?? { min: null, max: null };
    if (definitionId === minId) current.min = answer;
    if (definitionId === maxId) current.max = answer;
    byInstructor.set(instructorId, current);
  }

  for (const [instructorId, stored] of byInstructor) {
    if (
      lessonDurationStoredOverlapsSelected({
        storedMin: stored.min,
        storedMax: stored.max,
        selectedMin: selected.min,
        selectedMax: selected.max,
      })
    ) {
      out.add(instructorId);
    }
  }
  return out;
}

/**
 * Eğitmen müsait saat aralığı — public_instructors.working_hours_start / working_hours_end.
 * Kurum Eğitim Saatleri ile aynı kapsam kuralı:
 * yalnız başlangıç: start NOT NULL ve start <= selectedStart;
 * yalnız bitiş: end NOT NULL ve end >= selectedEnd;
 * ikisi: her iki koşul.
 */
async function resolveInstructorIdsByWorkingHoursFilter(
  supabase: SupabaseBrowser,
  params: { start: string; end: string },
): Promise<Set<number>> {
  const startDb = params.start ? inputHHMMToDbTimeOrNull(params.start) : null;
  const endDb = params.end ? inputHHMMToDbTimeOrNull(params.end) : null;
  if (!startDb && !endDb) return new Set();

  const rows: Array<{ id: number }> = [];
  let from = 0;
  for (;;) {
    const to = from + QUERY_PAGE_SIZE - 1;
    let query = supabase.from(PUBLIC_INSTRUCTORS_TABLE).select("id");
    if (startDb) {
      query = query.not("working_hours_start", "is", null).lte("working_hours_start", startDb);
    }
    if (endDb) {
      query = query.not("working_hours_end", "is", null).gte("working_hours_end", endDb);
    }
    const { data, error } = await query.range(from, to);
    if (error) throw error;
    const batch = (data ?? []) as Array<{ id: number }>;
    rows.push(...batch);
    if (batch.length < QUERY_PAGE_SIZE) break;
    from += QUERY_PAGE_SIZE;
    if (from / QUERY_PAGE_SIZE >= MAX_QUERY_PAGES) break;
  }

  const out = new Set<number>();
  for (const row of rows) {
    const id = Number(row.id);
    if (Number.isFinite(id) && id > 0) out.add(id);
  }
  return out;
}

function hasInstructorListingFilters(filters: InstructorListingFilters): boolean {
  return (
    filters.featureFilterIds !== null ||
    filters.branchTitleTerms.length > 0 ||
    filters.priceRange != null
  );
}

function applyInstructorBranchTitleFilter(
  rows: PublicInstructorListRow[],
  branchTitleTerms: string[],
): PublicInstructorListRow[] {
  if (branchTitleTerms.length === 0) return rows;
  return rows.filter((row) => {
    const branchMatch = fieldMatchesAnyTerm(row.branch, branchTitleTerms);
    const schoolMatch = fieldMatchesAnyTerm(row.school, branchTitleTerms);
    const departmentMatch = fieldMatchesAnyTerm(row.department, branchTitleTerms);
    return branchMatch || schoolMatch || departmentMatch;
  });
}

export function applyInstructorListingFilters(
  rows: PublicInstructorListRow[],
  filters: InstructorListingFilters,
): PublicInstructorListRow[] {
  if (!hasInstructorListingFilters(filters)) return rows;

  let filtered = rows;

  if (filters.featureFilterIds !== null) {
    if (filters.featureFilterIds.size === 0) return [];
    filtered = filtered.filter((row) => filters.featureFilterIds!.has(Number(row.id)));
  }

  if (filters.branchTitleTerms.length > 0) {
    filtered = applyInstructorBranchTitleFilter(filtered, filters.branchTitleTerms);
  }

  return filtered;
}

export async function buildInstructorListingFiltersFromSchoolPayload(
  supabase: SupabaseBrowser,
  payload: SchoolCategoryFilterPayload | undefined,
): Promise<InstructorListingFilters> {
  const empty: InstructorListingFilters = {
    featureFilterIds: null,
    branchTitleTerms: [],
    priceRange: null,
  };
  if (!payload || !hasAnySchoolPayloadFilters(payload)) return empty;

  const uiDefinitionIds = new Set<number>();
  const uiChoiceIds = new Set<number>();

  for (const [defIdStr, choiceIdStr] of Object.entries(payload.commonSingle)) {
    const defId = Number(defIdStr);
    const choiceId = Number(String(choiceIdStr ?? "").trim());
    if (Number.isFinite(defId)) uiDefinitionIds.add(defId);
    if (Number.isFinite(choiceId)) uiChoiceIds.add(choiceId);
  }

  for (const [defIdStr, choiceIdList] of Object.entries(payload.commonMulti)) {
    const defId = Number(defIdStr);
    if (Number.isFinite(defId)) uiDefinitionIds.add(defId);
    for (const choiceIdStr of choiceIdList ?? []) {
      const choiceId = Number(String(choiceIdStr).trim());
      if (Number.isFinite(choiceId)) uiChoiceIds.add(choiceId);
    }
  }

  for (const defIdStr of Object.keys(payload.commonRange)) {
    const defId = Number(defIdStr);
    if (Number.isFinite(defId)) uiDefinitionIds.add(defId);
  }

  for (const keys of Object.values(payload.groupSelections)) {
    for (const key of keys ?? []) {
      if (String(key).startsWith("def:")) {
        const defId = Number(String(key).slice(4));
        if (Number.isFinite(defId)) uiDefinitionIds.add(defId);
        continue;
      }
      const { choiceId, definitionId } = parseChoiceKey(String(key));
      if (choiceId != null) uiChoiceIds.add(choiceId);
      if (definitionId != null) uiDefinitionIds.add(definitionId);
    }
  }

  const defIdList = Array.from(uiDefinitionIds);
  const choiceIdList = Array.from(uiChoiceIds);

  const [defsResult, choicesResult, realDefsResult, realChoicesResult, institutionGroupsResult, instructorGroupsResult] =
    await Promise.all([
      defIdList.length > 0
        ? supabase
            .from("institution_feature_definitions")
            .select("id, group_id, name, slug, input_type, help_text, placeholder, unit, display_order")
            .in("id", defIdList)
        : Promise.resolve({ data: [], error: null }),
      choiceIdList.length > 0
        ? supabase
            .from("institution_feature_choices")
            .select("id, feature_definition_id, name, slug, is_active")
            .in("id", choiceIdList)
        : Promise.resolve({ data: [], error: null }),
      fetchInstructorRealFeatureDefinitionsClient(supabase),
      supabase
        .from("instructor_feature_choices")
        .select("id, feature_definition_id, name, slug, is_active")
        .eq("is_active", true),
      supabase.from("institution_feature_groups").select("id, name, slug, category_slug"),
      supabase.from("instructor_feature_groups").select("id, name, slug, category_slug"),
    ]);

  if (defsResult.error) throw defsResult.error;
  if (choicesResult.error) throw choicesResult.error;
  if (realDefsResult.error) throw realDefsResult.error;
  if (realChoicesResult.error) throw realChoicesResult.error;
  if (institutionGroupsResult.error) throw institutionGroupsResult.error;
  if (instructorGroupsResult.error) throw instructorGroupsResult.error;

  const uiDefinitions = ((defsResult.data ?? []) as InstructorFeatureDefinitionRow[]).filter((d) =>
    Number.isFinite(d.id),
  );
  const uiChoices = ((choicesResult.data ?? []) as Array<{
    id: number;
    feature_definition_id: number;
    name?: string | null;
    slug?: string | null;
    is_active?: boolean;
  }>).filter((c) => c.is_active !== false);

  const institutionGroups = (institutionGroupsResult.data ?? []) as Array<{
    id: number;
    name: string | null;
    slug: string | null;
    category_slug: string | null;
  }>;
  const instructorGroups = (instructorGroupsResult.data ?? []) as Array<{
    id: number;
    name: string | null;
    slug: string | null;
    category_slug: string | null;
  }>;

  const { uiFeatureIdToRealDefinition, instructorChoiceIdByUiKey } = buildUiToInstructorChoiceIdMap(
    uiDefinitions,
    uiChoices,
    realDefsResult.definitions,
    ((realChoicesResult.data ?? []) as Array<{
      id: number;
      feature_definition_id: number;
      name?: string | null;
      slug?: string | null;
      is_active?: boolean;
    }>).filter((c) => c.is_active !== false),
    {
      institutionGroups,
      instructorGroups,
    },
  );

  const defMetaById = new Map<number, { name: string; slug: string | null; inputType: string }>();
  for (const row of uiDefinitions) {
    defMetaById.set(row.id, {
      name: String(row.name ?? ""),
      slug: row.slug ?? null,
      inputType: String(row.input_type ?? ""),
    });
  }

  const choiceMetaById = new Map<number, { name: string; definitionId: number | null }>();
  for (const row of uiChoices) {
    choiceMetaById.set(row.id, {
      name: String(row.name ?? "").trim(),
      definitionId: Number.isFinite(row.feature_definition_id) ? row.feature_definition_id : null,
    });
  }

  const institutionGroupCategoryById = new Map<number, string | null>();
  for (const group of institutionGroups) {
    institutionGroupCategoryById.set(Number(group.id), group.category_slug ?? null);
  }
  const uiDefinitionById = new Map(uiDefinitions.map((definition) => [definition.id, definition]));
  const hizmetYeriBooleanIdForLabel = (label: string, uiDefId: number): number | null => {
    const definition = uiDefinitionById.get(uiDefId);
    const categorySlug = definition
      ? (institutionGroupCategoryById.get(Number(definition.group_id)) ?? null)
      : null;
    return resolveInstructorHizmetYeriBooleanDefinitionId(
      realDefsResult.definitions,
      instructorGroups,
      label,
      categorySlug,
    );
  };

  const branchTitleTerms: string[] = [];
  let current: Set<number> | null = null;

  const resolveMappedChoiceSet = async (
    uiDefId: number,
    uiChoiceId: number,
  ): Promise<Set<number> | null> => {
    const meta = defMetaById.get(uiDefId);
    if (meta && isBranchOrTitleDefinition(meta)) {
      const label = choiceMetaById.get(uiChoiceId)?.name ?? "";
      if (label) branchTitleTerms.push(label);
      return null;
    }
    if (meta && isInstructorPriceRangeFeature({ name: meta.name, slug: meta.slug })) {
      return null;
    }
    if (meta && isInstructorHizmetYeriFeatureName(meta.name, meta.slug)) {
      const label = choiceMetaById.get(uiChoiceId)?.name ?? "";
      const booleanId = hizmetYeriBooleanIdForLabel(label, uiDefId);
      if (booleanId != null) {
        return resolveInstructorIdsForBooleanDefinition(supabase, booleanId);
      }
    }

    const realDef = uiFeatureIdToRealDefinition.get(uiDefId);
    if (
      realDef &&
      isInstructorPriceRangeFeature({ name: realDef.name ?? "", slug: realDef.slug })
    ) {
      return null;
    }
    const instructorChoiceId = instructorChoiceIdByUiKey.get(`${uiDefId}:${uiChoiceId}`);
    // Kurum tarafında olup eğitmen şemasında karşılığı olmayan tanımları atla (AND'i bozma).
    if (!realDef) return null;
    if (!Number.isFinite(instructorChoiceId)) {
      console.warn("[instructor-filter] choice map bulunamadı:", {
        uiDefId,
        uiChoiceId,
        uiChoiceName: choiceMetaById.get(uiChoiceId)?.name ?? null,
      });
      return new Set<number>();
    }

    return resolveInstructorIdsForInstructorChoice(
      supabase,
      Number(realDef.id),
      instructorChoiceId!,
    );
  };

  for (const [defIdStr, choiceIdStr] of Object.entries(payload.commonSingle)) {
    const uiDefId = Number(defIdStr);
    const uiChoiceId = Number(String(choiceIdStr ?? "").trim());
    if (!Number.isFinite(uiDefId) || !Number.isFinite(uiChoiceId)) continue;
    const set = await resolveMappedChoiceSet(uiDefId, uiChoiceId);
    if (set === null) continue;
    current = applyIntersect(current, set);
    if (isFilterIdSetEmpty(current)) break;
  }

  for (const [defIdStr, choiceIdList] of Object.entries(payload.commonMulti)) {
    const uiDefId = Number(defIdStr);
    if (!Number.isFinite(uiDefId) || !Array.isArray(choiceIdList) || choiceIdList.length === 0) continue;
    const uiMeta = defMetaById.get(uiDefId);
    if (
      uiMeta != null &&
      (isStudentAgeRangeNumberFeature(uiMeta) ||
        isLegacyStudentAgeMultiSelectFeature({
          slug: uiMeta.slug,
          name: uiMeta.name,
          input_type: uiMeta.inputType,
        }))
    ) {
      continue;
    }
    const union = new Set<number>();
    let skippedFeatureGroup = true;
    for (const cidStr of choiceIdList) {
      const uiChoiceId = Number(String(cidStr).trim());
      if (!Number.isFinite(uiChoiceId)) continue;
      const set = await resolveMappedChoiceSet(uiDefId, uiChoiceId);
      if (set === null) continue;
      skippedFeatureGroup = false;
      set.forEach((id) => union.add(id));
    }
    if (skippedFeatureGroup) continue;
    current = applyIntersect(current, union);
    if (isFilterIdSetEmpty(current)) break;
  }

  const defMetaList = Array.from(defMetaById.entries()).map(([id, meta]) => ({
    id,
    name: meta.name,
    slug: meta.slug,
  }));
  const studentAgeFilter = resolveStudentAgeFilterFromPayload(payload, defMetaList);
  if (studentAgeFilter) {
    const matched = await resolveInstructorIdsByStudentAgeFilter(supabase, {
      userFilter: studentAgeFilter,
    });
    current = applyIntersect(current, new Set(matched));
    if (isFilterIdSetEmpty(current)) {
      /* empty */
    }
  }

  for (const [defIdStr, range] of Object.entries(payload.commonRange)) {
    const uiDefId = Number(defIdStr);
    if (!Number.isFinite(uiDefId)) continue;
    if (isStudentAgeFilterDefinitionId(uiDefId, defMetaList)) continue;
    const meta = defMetaById.get(uiDefId);
    if (!meta) continue;

    const minS = String(range?.min ?? "").trim();
    const maxS = String(range?.max ?? "").trim();
    if (!minS && !maxS) continue;
    if (isInstructorPriceRangeFeature({ name: meta.name, slug: meta.slug })) continue;

    const realDef = uiFeatureIdToRealDefinition.get(uiDefId);
    if (
      realDef &&
      isInstructorPriceRangeFeature({ name: realDef.name ?? "", slug: realDef.slug })
    ) {
      continue;
    }
    if (!realDef) {
      current = applyIntersect(current, new Set<number>());
      if (isFilterIdSetEmpty(current)) break;
      continue;
    }

    const minBound = minS ? parseOptionalNumber(minS) : null;
    const maxBound = maxS ? parseOptionalNumber(maxS) : null;
    current = applyIntersect(
      current,
      await resolveInstructorIdsNumberRangeForDefinition(
        supabase,
        Number(realDef.id),
        minBound,
        maxBound,
      ),
    );
    if (isFilterIdSetEmpty(current)) break;
  }

  for (const keys of Object.values(payload.groupSelections)) {
    if (!Array.isArray(keys) || keys.length === 0) continue;
    const union = new Set<number>();
    for (const key of keys) {
      const keyStr = String(key);
      if (keyStr.startsWith("def:")) {
        const uiDefId = Number(keyStr.slice(4));
        if (!Number.isFinite(uiDefId)) continue;
        const meta = defMetaById.get(uiDefId);
        if (
          meta &&
          isInstructorHizmetYeriBooleanOption({
            name: meta.name,
            slug: meta.slug,
            input_type: meta.inputType,
          })
        ) {
          const booleanId = hizmetYeriBooleanIdForLabel(meta.name, uiDefId);
          if (booleanId != null) {
            const set = await resolveInstructorIdsForBooleanDefinition(supabase, booleanId);
            set.forEach((id) => union.add(id));
            continue;
          }
        }
        const realDef = uiFeatureIdToRealDefinition.get(uiDefId);
        if (!realDef) continue;
        const set = await resolveInstructorIdsForBooleanDefinition(supabase, Number(realDef.id));
        set.forEach((id) => union.add(id));
        continue;
      }
      if (keyStr.startsWith("choice:")) {
        const { choiceId, definitionId } = parseChoiceKey(keyStr);
        if (choiceId == null || definitionId == null) continue;
        const set = await resolveMappedChoiceSet(definitionId, choiceId);
        if (set === null) continue;
        set.forEach((id) => union.add(id));
      }
    }
    current = applyIntersect(current, union);
    if (isFilterIdSetEmpty(current)) break;
  }

  return {
    featureFilterIds: current,
    branchTitleTerms: Array.from(new Set(branchTitleTerms)),
    priceRange: null,
  };
}

export async function fetchFeaturedPublicInstructors(
  supabase: SupabaseBrowser,
  options?: {
    categoryId?: number | null;
    limit?: number;
  },
): Promise<PublicInstructorListRow[]> {
  const limit = options?.limit ?? 10;
  const categoryId = options?.categoryId;

  let query = supabase
    .from(PUBLIC_INSTRUCTORS_TABLE)
    .select(PUBLIC_INSTRUCTOR_LIST_SELECT)
    .eq("is_active", true)
    .eq("is_approved", true);

  if (categoryId != null && Number.isFinite(categoryId)) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return enrichPublicInstructorListRows(
    ((data ?? []) as PublicInstructorListRow[]).filter(
      (row) => Number.isFinite(Number(row.id)) && Number(row.id) > 0,
    ),
    supabase,
  );
}

export function mapPublicInstructorToFeaturedItem(
  row: PublicInstructorListRow,
  supabase: SupabaseBrowser,
): FeaturedInstructorItem | null {
  const numericId = Number(row.id);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  const name = mapPublicInstructorDisplayName(row);
  const { categoryLabel, branch, location } = resolvePublicInstructorFeaturedCardLabels(row);
  const priceRange = formatInstitutionPriceRangeDisplay(row.min_fiyat, row.max_fiyat) ?? "";
  const imageUrl =
    resolvePublicInstructorProfilePictureUrl(String(row.profile_picture ?? "").trim(), supabase) || "";

  return {
    id: numericId,
    name,
    slug: String(row.slug ?? "").trim() || String(numericId),
    imageUrl,
    href: getPublicInstructorDetailHref(row.slug, numericId),
    bodyMainCategory: categoryLabel,
    bodyLocation: location,
    branch: branch || undefined,
    priceRange: priceRange || undefined,
  };
}

async function resolveInstructorIdsForSingleSelectChoice(
  supabase: SupabaseBrowser,
  definitionId: number,
  choiceId: number,
): Promise<Set<number>> {
  const fromEntryChoices = await resolveInstructorIdsForInstructorChoice(
    supabase,
    definitionId,
    choiceId,
  );
  if (fromEntryChoices.size > 0) return fromEntryChoices;

  const out = new Set<number>();
  const { data, error } = await supabase
    .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
    .select("instructor_id")
    .eq("feature_definition_id", definitionId)
    .eq("selected_choice_id", choiceId);
  if (error) throw error;

  for (const row of (data ?? []) as Array<{ instructor_id: number }>) {
    const instructorId = Number(row.instructor_id);
    if (Number.isFinite(instructorId)) out.add(instructorId);
  }
  return out;
}

function unionInstructorIdSets(sets: Array<Set<number>>): Set<number> {
  const out = new Set<number>();
  for (const set of sets) {
    for (const instructorId of set) out.add(instructorId);
  }
  return out;
}

export function hasInstructorCategoryFilterPayload(
  payload: InstructorCategoryFilterPayload | undefined,
): boolean {
  if (!payload) return false;
  if (isStudentAgeFilterTextActive(payload.studentAgeRange)) return true;
  if (Object.values(payload.booleanValues).some(Boolean)) return true;
  if (
    Object.keys(payload.singleSelect).some((definitionId) =>
      String(payload.singleSelect[Number(definitionId)] ?? "").trim(),
    )
  ) {
    return true;
  }
  if (
    Object.keys(payload.multiSelect).some(
      (definitionId) => (payload.multiSelect[Number(definitionId)] ?? []).length > 0,
    )
  ) {
    return true;
  }
  if (
    Object.keys(payload.numberRange).some((definitionId) => {
      const range = payload.numberRange[Number(definitionId)] ?? { min: "", max: "" };
      return String(range.min ?? "").trim() !== "" || String(range.max ?? "").trim() !== "";
    })
  ) {
    return true;
  }
  if (String(payload.workingHoursStart ?? "").trim() || String(payload.workingHoursEnd ?? "").trim()) {
    return true;
  }
  return false;
}

/**
 * Eğitmenler liste sayfası feature filtreleri.
 * Aynı definition / boolean group içinde OR (union), farklı filtreler arasında AND (intersection).
 * Aktif filtre yoksa null döner (kısıtlama uygulanmaz).
 */
export async function resolveInstructorIdsFromInstructorCategoryFilterPayload(
  supabase: SupabaseBrowser,
  payload: InstructorCategoryFilterPayload | undefined,
): Promise<Set<number> | null> {
  if (!hasInstructorCategoryFilterPayload(payload)) return null;

  let accumulated: Set<number> | null = null;
  const groupMembership = payload!.booleanDefinitionGroupIds ?? {};
  const selectedBooleanDefinitionIds = Object.entries(payload!.booleanValues)
    .filter(([, isSelected]) => Boolean(isSelected))
    .map(([definitionIdStr]) => Number(definitionIdStr))
    .filter((definitionId) => Number.isFinite(definitionId));

  const booleanSelectionsByGroup = new Map<number, number[]>();
  const standaloneBooleanDefinitionIds: number[] = [];

  for (const definitionId of selectedBooleanDefinitionIds) {
    const groupId = Number(groupMembership[definitionId]);
    if (Number.isFinite(groupId) && groupId !== 0) {
      const current = booleanSelectionsByGroup.get(groupId) ?? [];
      current.push(definitionId);
      booleanSelectionsByGroup.set(groupId, current);
      continue;
    }
    standaloneBooleanDefinitionIds.push(definitionId);
  }

  for (const definitionIds of booleanSelectionsByGroup.values()) {
    const perDefinitionSets: Set<number>[] = [];
    for (const definitionId of definitionIds) {
      perDefinitionSets.push(await resolveInstructorIdsForBooleanDefinition(supabase, definitionId));
    }
    if (perDefinitionSets.length === 0) continue;
    accumulated = applyIntersect(accumulated, unionInstructorIdSets(perDefinitionSets));
    if (isFilterIdSetEmpty(accumulated)) return accumulated;
  }

  for (const definitionId of standaloneBooleanDefinitionIds) {
    const matchingIds = await resolveInstructorIdsForBooleanDefinition(supabase, definitionId);
    accumulated = applyIntersect(accumulated, matchingIds);
    if (isFilterIdSetEmpty(accumulated)) return accumulated;
  }

  for (const [definitionIdStr, choiceIdStr] of Object.entries(payload!.singleSelect)) {
    const definitionId = Number(definitionIdStr);
    const choiceId = Number(String(choiceIdStr ?? "").trim());
    if (!Number.isFinite(definitionId) || !Number.isFinite(choiceId)) continue;
    const matchingIds = await resolveInstructorIdsForSingleSelectChoice(
      supabase,
      definitionId,
      choiceId,
    );
    accumulated = applyIntersect(accumulated, matchingIds);
    if (isFilterIdSetEmpty(accumulated)) return accumulated;
  }

  for (const [definitionIdStr, choiceIdList] of Object.entries(payload!.multiSelect)) {
    const definitionId = Number(definitionIdStr);
    if (!Number.isFinite(definitionId) || !Array.isArray(choiceIdList) || choiceIdList.length === 0) {
      continue;
    }

    // Eski öğrenci yaşı multi_select choice filtreleri kullanılmaz
    // (slug bilgisini numberRange defs ile birlikte aşağıda ele alıyoruz; burada id ile atlama yok)

    const perChoiceSets: Set<number>[] = [];
    for (const choiceIdStr of choiceIdList) {
      const choiceId = Number(String(choiceIdStr ?? "").trim());
      if (!Number.isFinite(choiceId)) continue;
      perChoiceSets.push(
        await resolveInstructorIdsForSingleSelectChoice(supabase, definitionId, choiceId),
      );
    }

    if (perChoiceSets.length === 0) continue;
    accumulated = applyIntersect(accumulated, unionInstructorIdSets(perChoiceSets));
    if (isFilterIdSetEmpty(accumulated)) return accumulated;
  }

  const numberRangeDefIds = Object.keys(payload!.numberRange)
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  let numberRangeDefs: Array<{ id: number; slug: string | null }> = [];
  if (numberRangeDefIds.length > 0) {
    const { data: ageDefsData, error: ageDefsError } = await supabase
      .from("instructor_feature_definitions")
      .select("id, slug")
      .in("id", numberRangeDefIds);
    if (ageDefsError) throw ageDefsError;
    numberRangeDefs = ((ageDefsData ?? []) as Array<{ id: number; slug?: string | null }>).map(
      (d) => ({ id: Number(d.id), slug: d.slug ?? null }),
    );
  }

  const studentAgeFilter = resolveStudentAgeFilterFromPayload(
    { studentAgeRange: payload!.studentAgeRange, numberRange: payload!.numberRange },
    numberRangeDefs,
  );
  if (studentAgeFilter) {
    const matched = await resolveInstructorIdsByStudentAgeFilter(supabase, {
      userFilter: studentAgeFilter,
    });
    accumulated = applyIntersect(accumulated, new Set(matched));
    if (isFilterIdSetEmpty(accumulated)) return accumulated;
  }

  const durationMinDef = numberRangeDefs.find((definition) => isLessonDurationMinFeature(definition));
  if (durationMinDef) {
    const durationRange = payload!.numberRange[durationMinDef.id];
    const minParsed = parseLessonDurationInput(String(durationRange?.min ?? ""));
    const maxParsed = parseLessonDurationInput(String(durationRange?.max ?? ""));
    const selectedMin = minParsed.kind === "ok" ? minParsed.value : null;
    const selectedMax = maxParsed.kind === "ok" ? maxParsed.value : null;
    if (selectedMin != null || selectedMax != null) {
      const matched = await resolveInstructorIdsByLessonDurationOverlap(supabase, {
        min: selectedMin,
        max: selectedMax,
      });
      accumulated = applyIntersect(accumulated, matched);
      if (isFilterIdSetEmpty(accumulated)) return accumulated;
    }
  }

  for (const [definitionIdStr, range] of Object.entries(payload!.numberRange)) {
    const definitionId = Number(definitionIdStr);
    if (!Number.isFinite(definitionId)) continue;
    if (isStudentAgeFilterDefinitionId(definitionId, numberRangeDefs)) continue;
    const rangeDef = numberRangeDefs.find((definition) => definition.id === definitionId);
    if (rangeDef && isLessonDurationRangeNumberFeature(rangeDef)) continue;
    const minText = String(range?.min ?? "").trim();
    const maxText = String(range?.max ?? "").trim();
    if (!minText && !maxText) continue;

    const minBound = minText ? parseOptionalNumber(minText) : null;
    const maxBound = maxText ? parseOptionalNumber(maxText) : null;
    const matchingIds = await resolveInstructorIdsNumberRangeForDefinition(
      supabase,
      definitionId,
      minBound,
      maxBound,
    );
    accumulated = applyIntersect(accumulated, matchingIds);
    if (isFilterIdSetEmpty(accumulated)) return accumulated;
  }

  const selectedHoursStart = String(payload!.workingHoursStart ?? "").trim();
  const selectedHoursEnd = String(payload!.workingHoursEnd ?? "").trim();
  if (selectedHoursStart || selectedHoursEnd) {
    const matched = await resolveInstructorIdsByWorkingHoursFilter(supabase, {
      start: selectedHoursStart,
      end: selectedHoursEnd,
    });
    accumulated = applyIntersect(accumulated, matched);
    if (isFilterIdSetEmpty(accumulated)) return accumulated;
  }

  return accumulated ?? new Set<number>();
}

export async function resolveInstitutionCategoryIdByName(
  supabase: SupabaseBrowser,
  categoryName: string,
): Promise<number | null> {
  const target = String(categoryName ?? "").trim();
  if (!target) return null;

  const { data, error } = await supabase
    .from("institution_categories")
    .select("id, name")
    .eq("is_active", true);

  if (error || !data?.length) return null;

  const normalizedTarget = target.toLocaleLowerCase("tr-TR");
  const row = (data as Array<{ id: number; name: string | null }>).find(
    (item) => String(item.name ?? "").trim().toLocaleLowerCase("tr-TR") === normalizedTarget,
  );

  return row && Number.isFinite(row.id) ? row.id : null;
}

/**
 * Kategori sayfalarında eğitmen listesi için instructor_categories.id çözer.
 * institution_categories.id ile instructors.category_id karıştırılmamalı.
 */
export async function resolveInstructorCategoryIdBySlugOrName(
  supabase: SupabaseBrowser,
  options: { slug?: string | null; name?: string | null },
): Promise<number | null> {
  const slug = String(options.slug ?? "").trim();
  if (slug) {
    const { data, error } = await supabase
      .from("instructor_categories")
      .select("id")
      .eq("is_active", true)
      .eq("slug", slug)
      .maybeSingle();
    if (!error && data && Number.isFinite(Number((data as { id: number }).id))) {
      return Number((data as { id: number }).id);
    }
  }

  const name = String(options.name ?? "").trim();
  if (!name) return null;

  const { data, error } = await supabase
    .from("instructor_categories")
    .select("id, name, slug")
    .eq("is_active", true);

  if (error || !data?.length) return null;

  const normalizedTarget = name.toLocaleLowerCase("tr-TR");
  const rows = data as Array<{ id: number; name: string | null; slug: string | null }>;
  const exact = rows.find(
    (item) => String(item.name ?? "").trim().toLocaleLowerCase("tr-TR") === normalizedTarget,
  );
  if (exact && Number.isFinite(exact.id)) return exact.id;

  const fuzzy = rows.find((item) => {
    const key = `${item.name ?? ""} ${item.slug ?? ""}`.toLocaleLowerCase("tr-TR");
    return key.includes(normalizedTarget) || normalizedTarget.includes(String(item.name ?? "").trim().toLocaleLowerCase("tr-TR"));
  });
  return fuzzy && Number.isFinite(fuzzy.id) ? fuzzy.id : null;
}
