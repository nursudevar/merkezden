"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveInstitutionLogoPublicUrl } from "@/lib/institutionHelpers";
import { fetchInstitutionCategoryBySlug } from "@/lib/categoryHelpers";
import { ANKARA_DISTRICTS } from "@/constants/districts";
import type { SchoolCategoryFilterPayload } from "@/components/category/schoolCategoryFilterTypes";
import { fetchInstructorPriceRangeLabelsByInstructorIdsClient } from "@/lib/instructorFeaturesClient";
import {
  applyInstructorListingFilters,
  buildInstructorListingFiltersFromSchoolPayload,
  fetchPublicInstructorsForListing,
  mapPublicInstructorToListItem,
  resolveInstitutionCategoryIdByName,
  resolveInstructorCategoryIdBySlugOrName,
} from "@/lib/publicInstructorSearch";
import {
  buildProfileSearchVariants,
  escapeProfileLikeValue,
  resolveInstitutionIdsByProfileSearch,
} from "@/lib/profileSearch";
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

export type CategoryResultItem = {
  id: string;
  resultType?: "institution" | "instructor";
  name: string;
  description: string;
  location: string;
  price: string | number;
  ageRange: string;
  rating: number;
  reviewCount: number;
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
};

type InstitutionTypeJoinRow =
  | { name: string | null }
  | Array<{ name: string | null }>
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
  institution_type?: InstitutionTypeJoinRow;
};

const FALLBACK = "-";
const FIXED_CITY = "Ankara";
const IN_CHUNK = 120;
/** PostgREST varsayılan max_rows (1000) */
const QUERY_PAGE_SIZE = 1000;
const MAX_QUERY_PAGES = 50;

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

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

async function resolveInstitutionCategoryIdForListing(
  supabase: SupabaseBrowser,
  categoryName: string,
  categorySlug?: string,
): Promise<number | null> {
  const categoryId = await resolveInstitutionCategoryIdByName(supabase, categoryName);
  if (categoryId != null) return categoryId;

  const slug = String(categorySlug ?? "").trim();
  if (!slug) return null;

  const category = await fetchInstitutionCategoryBySlug(slug);
  return category?.id ?? null;
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

async function fetchAllCategoryInstitutionRows(
  supabase: SupabaseBrowser,
  fullSelect: string,
  targetName: string,
  categoryId: number | null,
  district: string,
  searchTerm: string,
): Promise<InstitutionRow[]> {
  const rows: InstitutionRow[] = [];
  const relatedSearch = searchTerm
    ? await resolveInstitutionIdsByProfileSearch(supabase, searchTerm)
    : { institutionIds: [], institutionTypeIds: [] };

  for (let page = 0; page < MAX_QUERY_PAGES; page += 1) {
    const from = page * QUERY_PAGE_SIZE;
    const to = from + QUERY_PAGE_SIZE - 1;

    let query = supabase
      .from("institutions")
      .select(fullSelect)
      .ilike("city", FIXED_CITY)
      .eq("is_approved", true);

    query = applyInstitutionCategoryScope(query, categoryId, targetName);

    if (district) query = query.eq("district", district);
    if (searchTerm) {
      query = applyInstitutionSearchFilter(
        query,
        searchTerm,
        relatedSearch.institutionIds,
        relatedSearch.institutionTypeIds,
      );
    }

    const { data, error } = await query.order("id", { ascending: true }).range(from, to);
    if (error) throw error;

    const batch = ((data as unknown as InstitutionRow[] | null) ?? []);
    rows.push(...batch);
    if (batch.length < QUERY_PAGE_SIZE) break;
  }

  rows.sort((a, b) =>
    String(a.institution_name ?? "").localeCompare(String(b.institution_name ?? ""), "tr", {
      sensitivity: "base",
    }),
  );
  return rows;
}

async function fetchAllCategoryInstitutionIds(
  supabase: SupabaseBrowser,
  categoryId: number | null,
  targetName: string,
  district: string,
  searchTerm: string,
  institutionTypeId?: number | null,
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
      .ilike("city", FIXED_CITY)
      .eq("is_approved", true);

    query = applyInstitutionCategoryScope(query, categoryId, targetName);

    if (district) query = query.eq("district", district);
    if (searchTerm) {
      query = applyInstitutionSearchFilter(
        query,
        searchTerm,
        relatedSearch.institutionIds,
        relatedSearch.institutionTypeIds,
      );
    }
    if (
      institutionTypeId != null &&
      Number.isFinite(institutionTypeId) &&
      institutionTypeId > 0
    ) {
      query = query.eq("institution_type_id", institutionTypeId);
    }

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

function normalizeFeatureKey(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isFiyatAraligiDefinition(row: { name?: string | null; slug?: string | null }): boolean {
  const t = normalizeFeatureKey(`${row.slug ?? ""} ${row.name ?? ""}`);
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

function parsePriceRangeFromText(raw: string): { min: number; max: number } | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const lower = text.toLocaleLowerCase("tr-TR");
  const norm = normalizeFeatureKey(text);

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

function hasAnySchoolPayloadFilters(payload: SchoolCategoryFilterPayload | undefined): boolean {
  if (!payload) return false;
  if (isStudentAgeFilterTextActive(payload.studentAgeRange)) return true;
  if (payload.institutionTypeId != null && Number.isFinite(payload.institutionTypeId) && payload.institutionTypeId > 0)
    return true;
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

async function resolveInstitutionIdsForSingleSelectChoice(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  definitionId: number,
  choiceId: number,
): Promise<Set<number>> {
  return resolveInstitutionIdsForMultiSelectChoice(supabase, definitionId, choiceId);
}

async function resolveInstitutionIdsForMultiSelectChoice(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  definitionId: number,
  choiceId: number,
): Promise<Set<number>> {
  const out = new Set<number>();
  const { data: entries, error: e1 } = await supabase
    .from("institution_feature_entries")
    .select("id, institution_id")
    .eq("feature_definition_id", definitionId);
  if (e1) throw e1;
  const rows = (entries ?? []) as Array<{ id: number; institution_id: number }>;
  const entryIds = rows.map((r) => r.id).filter((id) => Number.isFinite(id));
  const entryToInst = new Map<number, number>();
  rows.forEach((r) => entryToInst.set(Number(r.id), Number(r.institution_id)));

  if (entryIds.length === 0) return out;

  const { data: links, error: e2 } = await supabase
    .from("institution_feature_entry_choices")
    .select("institution_feature_entry_id, choice_id")
    .in("institution_feature_entry_id", entryIds)
    .eq("choice_id", choiceId);
  if (e2) throw e2;
  for (const row of (links ?? []) as Array<{ institution_feature_entry_id: number }>) {
    const iid = entryToInst.get(Number(row.institution_feature_entry_id));
    if (Number.isFinite(iid)) out.add(iid!);
  }
  return out;
}

async function resolveInstitutionIdsForBooleanDefinition(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  definitionId: number,
): Promise<Set<number>> {
  const out = new Set<number>();
  const { data, error } = await supabase
    .from("institution_feature_entries")
    .select("institution_id")
    .eq("feature_definition_id", definitionId)
    .eq("boolean_answer", true);
  if (error) throw error;
  for (const row of (data ?? []) as Array<{ institution_id: number }>) {
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

async function resolveInstitutionIdsForChoiceKey(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  inputTypeByDefId: Map<number, string>,
  key: string,
): Promise<Set<number>> {
  if (key.startsWith("def:")) {
    const defId = Number(key.slice(4));
    if (!Number.isFinite(defId)) return new Set();
    return resolveInstitutionIdsForBooleanDefinition(supabase, defId);
  }
  if (key.startsWith("choice:")) {
    const { choiceId, definitionId: embeddedDefId } = parseChoiceKey(key);
    if (choiceId == null) return new Set();

    let defId = embeddedDefId;
    if (defId == null) {
      defId = await resolveDefinitionIdForChoiceId(supabase, choiceId);
    }
    if (defId == null) return new Set();

    return resolveInstitutionIdsForMultiSelectChoice(supabase, defId, choiceId);
  }
  return new Set();
}

async function resolveInstitutionIdsNumberRangeForDefinition(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  definitionId: number,
  minBound: number | null,
  maxBound: number | null,
): Promise<Set<number>> {
  const out = new Set<number>();
  const { data, error } = await supabase
    .from("institution_feature_entries")
    .select("institution_id, number_answer, text_answer")
    .eq("feature_definition_id", definitionId);
  if (error) throw error;
  for (const row of (data ?? []) as Array<{
    institution_id: number;
    number_answer: number | null;
    text_answer: string | null;
  }>) {
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

async function resolveInstitutionIdsPriceRangeForDefinitionIds(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  definitionIds: number[],
  userRange: { min: number; max: number },
): Promise<Set<number>> {
  const idSet = new Set<number>();
  if (definitionIds.length === 0) return idSet;

  const { data: defsRaw, error: defErr } = await supabase
    .from("institution_feature_definitions")
    .select("id, name, slug, input_type")
    .in("id", definitionIds)
    .eq("is_active", true);
  if (defErr) throw defErr;
  const defs = ((defsRaw ?? []) as Array<{
    id: number;
    name?: string | null;
    slug?: string | null;
    input_type?: string | null;
  }>).filter((d) => Number.isFinite(d.id) && isFiyatAraligiDefinition(d));
  if (defs.length === 0) return idSet;

  const defIds = defs.map((d) => d.id);
  const inputTypeByDefId = new Map<number, string>();
  for (const d of defs) inputTypeByDefId.set(d.id, String(d.input_type ?? ""));

  const choiceRangeById = new Map<number, { min: number; max: number }>();
  const { data: choicesRaw, error: chErr } = await supabase
    .from("institution_feature_choices")
    .select("id, feature_definition_id, name")
    .in("feature_definition_id", defIds)
    .eq("is_active", true);
  if (!chErr) {
    for (const c of (choicesRaw ?? []) as Array<{ id: number; name?: string | null }>) {
      const cid = Number(c.id);
      if (!Number.isFinite(cid)) continue;
      const r = parsePriceRangeFromText(String(c.name ?? ""));
      if (r) choiceRangeById.set(cid, r);
    }
  }

  const { data: entriesRaw, error: entErr } = await supabase
    .from("institution_feature_entries")
    .select("id, institution_id, feature_definition_id, number_answer, text_answer")
    .in("feature_definition_id", defIds);
  if (entErr) throw entErr;

  const entries = (entriesRaw ?? []) as Array<{
    id: number;
    institution_id: number;
    feature_definition_id: number;
    number_answer: number | null;
    text_answer: string | null;
  }>;

  const choiceEntryIdToInstitution = new Map<number, number>();
  for (const e of entries) {
    const iid = Number(e.institution_id);
    if (!Number.isFinite(iid)) continue;
    const inputType = inputTypeByDefId.get(Number(e.feature_definition_id)) ?? "";

    if (inputType === "single_select" || inputType === "multi_select") {
      choiceEntryIdToInstitution.set(Number(e.id), iid);
    } else if (inputType === "number") {
      const n = Number(e.number_answer);
      if (!Number.isFinite(n)) continue;
      if (rangesOverlap({ min: n, max: n }, userRange)) idSet.add(iid);
    } else if (inputType === "text") {
      const r = parsePriceRangeFromText(String(e.text_answer ?? ""));
      if (r && rangesOverlap(r, userRange)) idSet.add(iid);
    }
  }

  if (choiceEntryIdToInstitution.size > 0 && choiceRangeById.size > 0) {
    const matchingChoiceIds = Array.from(choiceRangeById.entries())
      .filter(([, r]) => rangesOverlap(r, userRange))
      .map(([cid]) => cid);
    if (matchingChoiceIds.length > 0) {
      const { data: links, error: linkErr } = await supabase
        .from("institution_feature_entry_choices")
        .select("institution_feature_entry_id, choice_id")
        .in("institution_feature_entry_id", Array.from(choiceEntryIdToInstitution.keys()))
        .in("choice_id", matchingChoiceIds);
      if (linkErr) throw linkErr;
      for (const row of (links ?? []) as Array<{ institution_feature_entry_id: number }>) {
        const iid = choiceEntryIdToInstitution.get(Number(row.institution_feature_entry_id));
        if (Number.isFinite(iid)) idSet.add(iid!);
      }
    }
  }

  return idSet;
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
    district: string;
    searchTerm: string;
    schoolFilters?: SchoolCategoryFilterPayload;
  },
): Promise<CategoryResultItem[]> {
  const {
    institutionCategoryId,
    categoryName,
    categorySlug,
    district,
    searchTerm,
    schoolFilters,
  } = options;

  // instructors.category_id → instructor_categories (kurum kategori id'si değil)
  const instructorCategoryId = await resolveInstructorCategoryIdBySlugOrName(supabase, {
    slug: categorySlug,
    name: categoryName,
  });

  if (instructorCategoryId == null || !Number.isFinite(instructorCategoryId)) {
    if (institutionCategoryId != null) {
      console.info("[category][instructors] instructor kategorisi bulunamadı:", {
        categoryName,
        categorySlug: categorySlug || null,
        institutionCategoryId,
      });
    }
    return [];
  }

  const instructorFilters = await buildInstructorListingFiltersFromSchoolPayload(
    supabase,
    schoolFilters,
  );

  const rows = await fetchPublicInstructorsForListing(supabase, {
    categoryId: instructorCategoryId,
    district,
    city: FIXED_CITY,
    searchTerm,
    allowedInstructorIds:
      instructorFilters.featureFilterIds !== null ? instructorFilters.featureFilterIds : undefined,
  });

  const filteredRows = applyInstructorListingFilters(rows, {
    featureFilterIds: null,
    branchTitleTerms: instructorFilters.branchTitleTerms,
    priceRange: null,
  });

  const instructorIds = filteredRows
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  const priceLabelsByInstructorId = await fetchInstructorPriceRangeLabelsByInstructorIdsClient(
    instructorIds,
    supabase,
  );

  return filteredRows
    .map((row) =>
      mapPublicInstructorToListItem(
        row,
        supabase,
        priceLabelsByInstructorId.get(Number(row.id)),
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

export function useCategoryInstitutions(
  categoryName: string,
  options?: {
    search?: string;
    district?: string;
    /** institution_categories.slug — id çözümlemesi ve debug log için. */
    categorySlug?: string;
    /** Yalnızca Okul kategori sayfası doldurur. */
    schoolFilters?: SchoolCategoryFilterPayload;
  },
): {
  results: CategoryResultItem[];
  isLoading: boolean;
  error: string | null;
  districts: string[];
} {
  const rawSearch = options?.search ?? "";
  const district = (options?.district ?? "").trim();
  const categorySlug = String(options?.categorySlug ?? "").trim();
  const schoolFilters = options?.schoolFilters;

  const [results, setResults] = useState<CategoryResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const districts = ANKARA_DISTRICTS;
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(rawSearch);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [rawSearch]);

  const schoolFiltersKey = useMemo(() => JSON.stringify(schoolFilters ?? null), [schoolFilters]);

  useEffect(() => {
    const targetName = String(categoryName ?? "").trim();
    if (!targetName) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const featuredOrderPromise = fetchActiveFeaturedInstitutionOrderMap(supabase);

      const fullSelect =
        "id, slug, institution_name, subheading, about, address, district, city, official_phone, official_email, website, facebook_url, instagram_url, x_url, linkedin_url, logo, source, category_id, institution_type:institution_types(id, name, category:institution_categories(id, name))";

        const useSchoolPipeline = hasAnySchoolPayloadFilters(schoolFilters ?? undefined);

      try {
        const searchTerm = debouncedSearch.trim();
        const categoryId = await resolveInstitutionCategoryIdForListing(
          supabase,
          targetName,
          categorySlug,
        );
        if (cancelled) return;

        if (categoryId == null) {
          console.warn("[category][institutions] kategori bulunamadı:", {
            categoryName: targetName,
            categorySlug: categorySlug || null,
          });
        } else {
          console.info("[category][institutions] kategori çözüldü:", {
            categoryName: targetName,
            categorySlug: categorySlug || null,
            categoryId,
          });
        }

        if (!useSchoolPipeline) {
          const [rows, instructorResults, featuredOrderResult] = await Promise.all([
            fetchAllCategoryInstitutionRows(
              supabase,
              fullSelect,
              targetName,
              categoryId,
              district,
              searchTerm,
            ),
            fetchCategoryInstructorResults(supabase, {
              institutionCategoryId: categoryId,
              categoryName: targetName,
              categorySlug,
              district,
              searchTerm,
              schoolFilters,
            }),
            featuredOrderPromise,
          ]);

          if (cancelled) return;

          console.info("[category][institutions] liste sonucu:", {
            categoryName: targetName,
            categorySlug: categorySlug || null,
            categoryId,
            institutionCount: rows.length,
            instructorCount: instructorResults.length,
          });

          const mapped = rows.map((row): CategoryResultItem => mapRow(supabase, row));
          setResults(
            finalizeCategoryResults(mapped, instructorResults, featuredOrderResult.orderMap),
          );
          setIsLoading(false);
          return;
        }

        const payload = schoolFilters!;
        const baseIds = await fetchAllCategoryInstitutionIds(
          supabase,
          categoryId,
          targetName,
          district,
          searchTerm,
          payload.institutionTypeId,
        );
        if (cancelled) return;

        let current = new Set<number>(baseIds);

        if (current.size === 0) {
          const instructorOnly = await fetchCategoryInstructorResults(supabase, {
            institutionCategoryId: categoryId,
            categoryName: targetName,
            categorySlug,
            district,
            searchTerm,
            schoolFilters: payload,
          });
          if (cancelled) return;
          setResults(instructorOnly);
          setIsLoading(false);
          return;
        }

        const { data: defsAll, error: defAllErr } = await supabase
          .from("institution_feature_definitions")
          .select("id, name, slug, input_type")
          .eq("is_active", true);
        if (defAllErr) throw defAllErr;
        const inputTypeByDefId = new Map<number, string>();
        const defMetaById = new Map<number, { name: string; slug: string | null }>();
        for (const d of (defsAll ?? []) as Array<{
          id: number;
          name?: string | null;
          slug?: string | null;
          input_type?: string | null;
        }>) {
          if (!Number.isFinite(d.id)) continue;
          inputTypeByDefId.set(d.id, String(d.input_type ?? ""));
          defMetaById.set(d.id, { name: String(d.name ?? ""), slug: d.slug ?? null });
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
        if (cancelled) return;

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
        if (cancelled) return;

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
          const union = new Set<number>();
          for (const cidStr of choiceIds) {
            const cid = Number(String(cidStr).trim());
            if (!Number.isFinite(cid)) continue;
            const s = await resolveInstitutionIdsForMultiSelectChoice(supabase, defId, cid);
            s.forEach((id) => union.add(id));
          }
          current = intersectSets(current, union);
          if (current.size === 0) break;
        }
        if (cancelled) return;

        for (const [defIdStr, range] of Object.entries(payload.commonRange)) {
          const defId = Number(defIdStr);
          if (!Number.isFinite(defId)) continue;
          if (isStudentAgeFilterDefinitionId(defId, defMetaList)) continue;
          const minS = String(range?.min ?? "").trim();
          const maxS = String(range?.max ?? "").trim();
          if (!minS && !maxS) continue;

          const meta = defMetaById.get(defId);
          const isPrice = meta ? isFiyatAraligiDefinition({ name: meta.name, slug: meta.slug }) : false;

          if (isPrice) {
            const minN = parseOptionalNumber(minS) ?? 0;
            const maxN = parseOptionalNumber(maxS) ?? Number.POSITIVE_INFINITY;
            const userRange = {
              min: Math.min(minN, maxN),
              max: Math.max(minN, maxN),
            };
            const set = await resolveInstitutionIdsPriceRangeForDefinitionIds(supabase, [defId], userRange);
            current = intersectSets(current, set);
          } else {
            const minBound = minS ? parseOptionalNumber(minS) : null;
            const maxBound = maxS ? parseOptionalNumber(maxS) : null;
            const set = await resolveInstitutionIdsNumberRangeForDefinition(supabase, defId, minBound, maxBound);
            current = intersectSets(current, set);
          }
          if (current.size === 0) break;
        }
        if (cancelled) return;

        for (const [groupIdStr, keys] of Object.entries(payload.groupSelections)) {
          const groupId = Number(groupIdStr);
          if (!Number.isFinite(groupId) || !Array.isArray(keys) || keys.length === 0) continue;
          const union = new Set<number>();
          for (const key of keys) {
            const s = await resolveInstitutionIdsForChoiceKey(supabase, inputTypeByDefId, String(key));
            s.forEach((id) => union.add(id));
          }
          current = intersectSets(current, union);
          if (current.size === 0) break;
        }
        if (cancelled) return;

        const finalIds = Array.from(current);
        const rows = await fetchRowsByIdsChunked(supabase, finalIds, fullSelect);
        if (cancelled) return;

        const mapped = rows.map((row): CategoryResultItem => mapRow(supabase, row));
        const instructorResults = await fetchCategoryInstructorResults(supabase, {
          institutionCategoryId: categoryId,
          categoryName: targetName,
          categorySlug,
          district,
          searchTerm,
          schoolFilters: payload,
        });
        const featuredOrderResult = await featuredOrderPromise;
        if (cancelled) return;
        console.info("[category][institutions] filtreli liste sonucu:", {
          categoryName: targetName,
          categorySlug: categorySlug || null,
          categoryId,
          institutionCount: mapped.length,
          instructorCount: instructorResults.length,
        });
        setResults(
          finalizeCategoryResults(mapped, instructorResults, featuredOrderResult.orderMap),
        );
        setIsLoading(false);
      } catch (e) {
        console.error(
          "[category][institutions][school-filter-error]",
          describeSupabaseError(e),
        );
        if (!cancelled) {
          setResults([]);
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
  }, [categoryName, categorySlug, debouncedSearch, district, schoolFiltersKey]);

  return { results, isLoading, error, districts };
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
  const categoryJoin = (typeRow as { category?: { name?: string | null } | { name?: string | null }[] | null } | null)
    ?.category;
  const categoryRow = Array.isArray(categoryJoin) ? categoryJoin[0] ?? null : categoryJoin ?? null;
  const categoryName = String(categoryRow?.name ?? "").trim();

  return {
    id: String(row.id),
    resultType: "institution",
    name,
    description,
    location,
    price: FALLBACK,
    ageRange: FALLBACK,
    rating: 0,
    reviewCount: 0,
    badges: [],
    logoInitial: pickInitial(name),
    imageUrl,
    slug: slug || undefined,
    source: row.source ?? null,
    subcategoryName: categoryName || undefined,
  };
}
