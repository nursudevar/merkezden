"use client";

import { PUBLIC_INSTRUCTORS_TABLE } from "@/lib/publicInstructorClient";
import {
  buildProfileSearchVariants,
  escapeProfileLikeValue,
  resolveInstructorIdsByProfileSearch,
} from "@/lib/profileSearch";
import { resolvePublicInstructorProfilePictureUrl } from "@/lib/publicInstructorDetailClient";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const PUBLIC_INSTRUCTOR_LIST_SELECT =
  "id, slug, name, surname, full_name, city, district, address, title, branch, bio, about, school, education_level, lesson_type, service_type, price_range, graduated_university, website, experience_years, profile_picture, category_id, is_approved, is_active, created_at";

const PUBLIC_INSTRUCTOR_SEARCH_COLUMNS = [
  "name",
  "surname",
  "full_name",
  "city",
  "district",
  "address",
  "title",
  "branch",
  "bio",
  "about",
  "school",
  "education_level",
  "lesson_type",
  "service_type",
  "price_range",
  "graduated_university",
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
  city?: string | null;
  district?: string | null;
  address?: string | null;
  title?: string | null;
  branch?: string | null;
  bio?: string | null;
  about?: string | null;
  school?: string | null;
  education_level?: string | null;
  lesson_type?: string | null;
  service_type?: string | null;
  price_range?: string | null;
  graduated_university?: string | null;
  website?: string | null;
  experience_years?: number | null;
  profile_picture?: string | null;
  category_id?: number | null;
  is_approved?: boolean | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

export type FeaturedInstructorItem = {
  id: number;
  name: string;
  imageUrl: string;
  href: string;
  bodyMainCategory: string;
  bodyLocation: string;
  branch?: string;
  title?: string;
  priceRange?: string;
};

export type InstructorListingFilters = {
  educationLevelTerms: string[];
  serviceTypeTerms: string[];
  lessonTypeTerms: string[];
  branchTitleTerms: string[];
  priceRange: { min: number; max: number } | null;
};

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

function applyPublicInstructorSearchFilter<
  T extends { or: (filters: string) => T },
>(query: T, searchTerm: string, relatedInstructorIds: number[] = []): T {
  const variants = buildProfileSearchVariants(searchTerm).map(escapeProfileLikeValue).filter(Boolean);
  if (variants.length === 0) return query;

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
  const city = String(row.city ?? "").trim();
  const district = String(row.district ?? "").trim();
  if (city && district) return `${district} / ${city}`;
  return district || city || "-";
}

function pickInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toLocaleUpperCase("tr-TR") : "E";
}

export async function fetchPublicInstructorsForListing(
  supabase: SupabaseBrowser,
  options?: {
    searchTerm?: string;
    categoryId?: number | null;
    district?: string;
    city?: string;
    priceRange?: { min: number; max: number } | null;
    limit?: number;
  },
): Promise<PublicInstructorListRow[]> {
  const searchTerm = String(options?.searchTerm ?? "").trim();
  const district = String(options?.district ?? "").trim();
  const city = String(options?.city ?? "").trim();
  const categoryId = options?.categoryId;
  const hardLimit = options?.limit ?? 600;
  const rows: PublicInstructorListRow[] = [];
  const relatedInstructorIds = searchTerm
    ? await resolveInstructorIdsByProfileSearch(supabase, searchTerm)
    : [];

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
    if (city) {
      query = query.ilike("city", city);
    }
    if (district) {
      query = query.eq("district", district);
    }
    if (searchTerm) {
      query = applyPublicInstructorSearchFilter(query, searchTerm, relatedInstructorIds);
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
    educationLevelTerms: [],
    serviceTypeTerms: [],
    lessonTypeTerms: [],
    branchTitleTerms: [],
    priceRange: options?.priceRange ?? null,
  });

  return filteredRows.slice(0, hardLimit);
}

export type MappedPublicInstructorListItem = {
  id: string;
  resultType: "instructor";
  name: string;
  description: string;
  location: string;
  price: string;
  ageRange: string;
  rating: number;
  reviewCount: number;
  badges: string[];
  logoInitial: string;
  imageUrl?: string;
  slug?: string;
  detailUrl: string;
  instructorTitle?: string;
  instructorBranch?: string;
  priceRange?: string;
};

export function mapPublicInstructorToListItem(
  row: PublicInstructorListRow,
  supabase: SupabaseBrowser,
): MappedPublicInstructorListItem | null {
  const numericId = Number(row.id);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  const name = mapPublicInstructorDisplayName(row);
  const title = String(row.title ?? "").trim();
  const branch = String(row.branch ?? "").trim();
  const about = String(row.about ?? "").trim();
  const bio = String(row.bio ?? "").trim();
  const description = about || bio || title || branch;
  const priceRange = String(row.price_range ?? "").trim();
  const imageUrl =
    resolvePublicInstructorProfilePictureUrl(String(row.profile_picture ?? "").trim(), supabase) ||
    undefined;

  return {
    id: `instructor-${numericId}`,
    resultType: "instructor",
    name,
    description,
    location: buildPublicInstructorLocation(row),
    price: priceRange || "-",
    ageRange: "-",
    rating: 0,
    reviewCount: 0,
    badges: [],
    logoInitial: pickInitial(name),
    imageUrl,
    slug: String(row.slug ?? "").trim() || undefined,
    detailUrl: getPublicInstructorDetailHref(row.slug, numericId),
    instructorTitle: title || undefined,
    instructorBranch: branch || undefined,
    priceRange: priceRange || undefined,
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

function isPriceRangeDefinition(row: { name?: string | null; slug?: string | null }): boolean {
  const t = normalizeFilterKey(`${row.slug ?? ""} ${row.name ?? ""}`);
  return (
    t.includes("fiyat araligi") ||
    t.includes("aylik ortalama fiyat") ||
    t.includes("ortalama fiyat") ||
    t.includes("price range") ||
    t.includes("monthly price") ||
    t === "fiyat" ||
    t.startsWith("fiyat ") ||
    t.endsWith(" fiyat") ||
    t.includes(" fiyat ") ||
    t.includes("ucret")
  );
}

function isEducationLevelDefinition(row: { name?: string | null; slug?: string | null }): boolean {
  const t = normalizeFilterKey(`${row.slug ?? ""} ${row.name ?? ""}`);
  return t.includes("egitim seviyesi") || t.includes("education level");
}

function isServiceTypeDefinition(row: { name?: string | null; slug?: string | null }): boolean {
  const t = normalizeFilterKey(`${row.slug ?? ""} ${row.name ?? ""}`);
  return t.includes("hizmet tipi") || t.includes("servis tipi") || t.includes("service type");
}

function isLessonTypeDefinition(row: { name?: string | null; slug?: string | null }): boolean {
  const t = normalizeFilterKey(`${row.slug ?? ""} ${row.name ?? ""}`);
  return t.includes("ders tipi") || t.includes("lesson type");
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

function parsePriceRangeFromText(raw: string): { min: number; max: number } | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const lower = text.toLocaleLowerCase("tr-TR");
  const norm = normalizeFilterKey(text);

  const isFree =
    lower.includes("ücretsiz") || norm.includes("ucretsiz") || lower === "0" || lower === "0 tl" || lower === "0₺";
  if (isFree) return { min: 0, max: 0 };

  const compact = text.replace(/\s+/g, "");
  const numericTokens = compact.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const numbers = numericTokens
    .map((tok) => Number(tok.replace(/[.,]/g, "")))
    .filter((n) => Number.isFinite(n));
  if (numbers.length === 0) return null;

  const isUpperOpen =
    /\+/.test(text) ||
    /üzeri/i.test(text) ||
    norm.includes("uzeri") ||
    norm.includes("ve ustu") ||
    norm.includes("ustu") ||
    norm.includes("yukari") ||
    norm.includes("more");
  const isLowerOpen =
    /alt[ıi]/i.test(text) ||
    norm.includes("alti") ||
    norm.includes("altinda") ||
    norm.includes("kadar") ||
    norm.includes("less") ||
    norm.includes("under");

  if (numbers.length >= 2) {
    const min = Math.min(numbers[0], numbers[1]);
    const max = Math.max(numbers[0], numbers[1]);
    return { min, max };
  }

  const single = numbers[0];
  if (isUpperOpen) return { min: single, max: Number.POSITIVE_INFINITY };
  if (isLowerOpen) return { min: 0, max: single };
  return { min: single, max: single };
}

function rangesOverlap(a: { min: number; max: number }, b: { min: number; max: number }): boolean {
  return a.min <= b.max && b.min <= a.max;
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

function hasInstructorListingFilters(filters: InstructorListingFilters): boolean {
  return (
    filters.educationLevelTerms.length > 0 ||
    filters.serviceTypeTerms.length > 0 ||
    filters.lessonTypeTerms.length > 0 ||
    filters.branchTitleTerms.length > 0 ||
    filters.priceRange != null
  );
}

export function applyInstructorListingFilters(
  rows: PublicInstructorListRow[],
  filters: InstructorListingFilters,
): PublicInstructorListRow[] {
  if (!hasInstructorListingFilters(filters)) return rows;

  return rows.filter((row) => {
    if (
      filters.educationLevelTerms.length > 0 &&
      !fieldMatchesAnyTerm(row.education_level, filters.educationLevelTerms)
    ) {
      return false;
    }
    if (
      filters.serviceTypeTerms.length > 0 &&
      !fieldMatchesAnyTerm(row.service_type, filters.serviceTypeTerms)
    ) {
      return false;
    }
    if (
      filters.lessonTypeTerms.length > 0 &&
      !fieldMatchesAnyTerm(row.lesson_type, filters.lessonTypeTerms)
    ) {
      return false;
    }
    if (filters.branchTitleTerms.length > 0) {
      const branchMatch = fieldMatchesAnyTerm(row.branch, filters.branchTitleTerms);
      const titleMatch = fieldMatchesAnyTerm(row.title, filters.branchTitleTerms);
      if (!branchMatch && !titleMatch) return false;
    }
    if (filters.priceRange) {
      const rowRange = parsePriceRangeFromText(String(row.price_range ?? ""));
      if (!rowRange || !rangesOverlap(rowRange, filters.priceRange)) return false;
    }
    return true;
  });
}

type SchoolCategoryFilterPayload = {
  institutionTypeId: number | null;
  commonSingle: Record<number, string>;
  commonMulti: Record<number, string[]>;
  commonRange: Record<number, { min: string; max: string }>;
  groupSelections: Record<number, string[]>;
};

export async function buildInstructorListingFiltersFromSchoolPayload(
  supabase: SupabaseBrowser,
  payload: SchoolCategoryFilterPayload | undefined,
): Promise<InstructorListingFilters> {
  const empty: InstructorListingFilters = {
    educationLevelTerms: [],
    serviceTypeTerms: [],
    lessonTypeTerms: [],
    branchTitleTerms: [],
    priceRange: null,
  };
  if (!payload) return empty;

  const definitionIds = new Set<number>();
  const choiceIds = new Set<number>();

  for (const [defIdStr, choiceIdStr] of Object.entries(payload.commonSingle)) {
    const defId = Number(defIdStr);
    const choiceId = Number(String(choiceIdStr ?? "").trim());
    if (Number.isFinite(defId)) definitionIds.add(defId);
    if (Number.isFinite(choiceId)) choiceIds.add(choiceId);
  }

  for (const [defIdStr, choiceIdList] of Object.entries(payload.commonMulti)) {
    const defId = Number(defIdStr);
    if (Number.isFinite(defId)) definitionIds.add(defId);
    for (const choiceIdStr of choiceIdList ?? []) {
      const choiceId = Number(String(choiceIdStr).trim());
      if (Number.isFinite(choiceId)) choiceIds.add(choiceId);
    }
  }

  for (const defIdStr of Object.keys(payload.commonRange)) {
    const defId = Number(defIdStr);
    if (Number.isFinite(defId)) definitionIds.add(defId);
  }

  for (const keys of Object.values(payload.groupSelections)) {
    for (const key of keys ?? []) {
      if (String(key).startsWith("def:")) {
        const defId = Number(String(key).slice(4));
        if (Number.isFinite(defId)) definitionIds.add(defId);
        continue;
      }
      const { choiceId, definitionId } = parseChoiceKey(String(key));
      if (choiceId != null) choiceIds.add(choiceId);
      if (definitionId != null) definitionIds.add(definitionId);
    }
  }

  if (definitionIds.size === 0 && choiceIds.size === 0) return empty;

  const defIdList = Array.from(definitionIds);
  const choiceIdList = Array.from(choiceIds);

  const [defsResult, choicesResult] = await Promise.all([
    defIdList.length > 0
      ? supabase
          .from("institution_feature_definitions")
          .select("id, name, slug")
          .in("id", defIdList)
      : Promise.resolve({ data: [], error: null }),
    choiceIdList.length > 0
      ? supabase
          .from("institution_feature_choices")
          .select("id, name, feature_definition_id")
          .in("id", choiceIdList)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (defsResult.error) throw defsResult.error;
  if (choicesResult.error) throw choicesResult.error;

  const defMetaById = new Map<number, { name: string; slug: string | null }>();
  for (const row of (defsResult.data ?? []) as Array<{
    id: number;
    name?: string | null;
    slug?: string | null;
  }>) {
    if (!Number.isFinite(row.id)) continue;
    defMetaById.set(row.id, { name: String(row.name ?? ""), slug: row.slug ?? null });
  }

  const choiceMetaById = new Map<number, { name: string; definitionId: number | null }>();
  for (const row of (choicesResult.data ?? []) as Array<{
    id: number;
    name?: string | null;
    feature_definition_id?: number | null;
  }>) {
    if (!Number.isFinite(row.id)) continue;
    choiceMetaById.set(row.id, {
      name: String(row.name ?? "").trim(),
      definitionId:
        row.feature_definition_id != null && Number.isFinite(Number(row.feature_definition_id))
          ? Number(row.feature_definition_id)
          : null,
    });
  }

  const filters: InstructorListingFilters = {
    educationLevelTerms: [],
    serviceTypeTerms: [],
    lessonTypeTerms: [],
    branchTitleTerms: [],
    priceRange: null,
  };

  const pushChoiceTerm = (definitionId: number, choiceName: string) => {
    const label = String(choiceName ?? "").trim();
    if (!label) return;
    const meta = defMetaById.get(definitionId);
    if (!meta) return;
    if (isEducationLevelDefinition(meta)) filters.educationLevelTerms.push(label);
    else if (isServiceTypeDefinition(meta)) filters.serviceTypeTerms.push(label);
    else if (isLessonTypeDefinition(meta)) filters.lessonTypeTerms.push(label);
    else if (isBranchOrTitleDefinition(meta)) filters.branchTitleTerms.push(label);
  };

  for (const [defIdStr, choiceIdStr] of Object.entries(payload.commonSingle)) {
    const defId = Number(defIdStr);
    const choiceId = Number(String(choiceIdStr ?? "").trim());
    if (!Number.isFinite(defId) || !Number.isFinite(choiceId)) continue;
    const choice = choiceMetaById.get(choiceId);
    pushChoiceTerm(defId, choice?.name ?? "");
  }

  for (const [defIdStr, choiceIdList] of Object.entries(payload.commonMulti)) {
    const defId = Number(defIdStr);
    if (!Number.isFinite(defId)) continue;
    for (const choiceIdStr of choiceIdList ?? []) {
      const choiceId = Number(String(choiceIdStr).trim());
      if (!Number.isFinite(choiceId)) continue;
      const choice = choiceMetaById.get(choiceId);
      pushChoiceTerm(defId, choice?.name ?? "");
    }
  }

  for (const [defIdStr, range] of Object.entries(payload.commonRange)) {
    const defId = Number(defIdStr);
    if (!Number.isFinite(defId)) continue;
    const meta = defMetaById.get(defId);
    if (!meta || !isPriceRangeDefinition(meta)) continue;
    const minS = String(range?.min ?? "").trim();
    const maxS = String(range?.max ?? "").trim();
    if (!minS && !maxS) continue;
    const minN = parseOptionalNumber(minS) ?? 0;
    const maxN = parseOptionalNumber(maxS) ?? Number.POSITIVE_INFINITY;
    filters.priceRange = {
      min: Math.min(minN, maxN),
      max: Math.max(minN, maxN),
    };
  }

  for (const keys of Object.values(payload.groupSelections)) {
    for (const key of keys ?? []) {
      const keyStr = String(key);
      if (keyStr.startsWith("def:")) continue;
      const { choiceId, definitionId } = parseChoiceKey(keyStr);
      if (choiceId == null) continue;
      const choice = choiceMetaById.get(choiceId);
      const defId = definitionId ?? choice?.definitionId;
      if (defId == null) continue;
      pushChoiceTerm(defId, choice?.name ?? "");
    }
  }

  return filters;
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

  return ((data ?? []) as PublicInstructorListRow[]).filter(
    (row) => Number.isFinite(Number(row.id)) && Number(row.id) > 0,
  );
}

export function mapPublicInstructorToFeaturedItem(
  row: PublicInstructorListRow,
  supabase: SupabaseBrowser,
): FeaturedInstructorItem | null {
  const numericId = Number(row.id);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  const name = mapPublicInstructorDisplayName(row);
  const branch = String(row.branch ?? "").trim();
  const title = String(row.title ?? "").trim();
  const priceRange = String(row.price_range ?? "").trim();
  const imageUrl =
    resolvePublicInstructorProfilePictureUrl(String(row.profile_picture ?? "").trim(), supabase) || "";

  return {
    id: numericId,
    name,
    imageUrl,
    href: getPublicInstructorDetailHref(row.slug, numericId),
    bodyMainCategory: branch || title || "Bireysel Eğitmen",
    bodyLocation: buildPublicInstructorLocation(row),
    branch: branch || undefined,
    title: title || undefined,
    priceRange: priceRange || undefined,
  };
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
