"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { INSTRUCTORS_TABLE, type InstructorProfileRow } from "@/lib/instructorProfileClient";
import { institutionTimeToInputHHMM } from "@/lib/institutionHelpers";
import {
  STUDENT_AGE_RANGE_LABEL,
  findStudentAgeRangeDefinitions,
  isLegacyStudentAgeMultiSelectFeature,
  isStudentAgeMaxFeature,
  isStudentAgeMinFeature,
  isStudentAgeRangeNumberFeature,
  parseStudentAgeDecimalInput,
  validateStudentAgeRangeValues,
} from "@/lib/studentAgeRangeFeature";

export const INSTRUCTOR_FEATURE_ENTRIES_TABLE = "instructor_feature_entries" as const;
export const INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE = "instructor_feature_entry_choices" as const;

export const INSTRUCTOR_FEATURES_SAVE_SUCCESS = "Eğitmen özellikleri başarıyla kaydedildi.";
export const INSTRUCTOR_FEATURES_SAVE_ERROR = "Eğitmen özellikleri kaydedilirken bir hata oluştu.";
export const INSTRUCTOR_FEATURES_CATEGORY_REQUIRED = "Lütfen bir kategori seçin.";
export const INSTRUCTOR_FEATURES_INSTRUCTOR_NOT_FOUND = "Eğitmen profiliniz bulunamadı.";
export const INSTRUCTOR_FEATURES_LOAD_ERROR = "Eğitmen özellikleri yüklenirken bir hata oluştu.";

export type InstructorFeatureCategoryRow = {
  id: number;
  name: string;
  slug: string | null;
  display_order: number | null;
};

export type InstructorFeatureGroupRow = {
  id: number;
  name: string;
  slug: string | null;
  display_order: number | null;
  category_slug: string | null;
};

export type InstructorFeatureDefinitionRow = {
  id: number;
  group_id: number;
  name: string;
  slug: string | null;
  input_type: string;
  help_text: string | null;
  placeholder: string | null;
  unit: string | null;
  display_order: number | null;
};

export type InstructorFeatureChoiceRow = {
  id: number;
  feature_definition_id: number;
  name?: string | null;
  display_order?: number | null;
  is_active: boolean;
};

export type InstructorFilterFieldChoice = {
  id: number;
  name: string;
};

export type InstructorFilterField =
  | {
      kind: "boolean";
      definitionId: number;
      name: string;
    }
  | {
      kind: "boolean_group";
      groupId: number;
      name: string;
      options: Array<{ definitionId: number; name: string }>;
    }
  | {
      kind: "single_select";
      definitionId: number;
      name: string;
      placeholder: string;
      choices: InstructorFilterFieldChoice[];
    }
  | {
      kind: "multi_select";
      definitionId: number;
      name: string;
      choices: InstructorFilterFieldChoice[];
    }
  | {
      kind: "number_range";
      definitionId: number;
      name: string;
      unit: string | null;
    }
  | {
      kind: "student_age_range";
      definitionId: number;
      name: string;
    };

function hasSupabaseResponseError(error: unknown): boolean {
  if (error == null) return false;
  if (typeof error !== "object") return true;
  const row = error as { message?: string; code?: string };
  if (row.message || row.code) return true;
  return Object.keys(error as object).length > 0;
}

export type InstructorFeatureEntryRow = {
  id: number;
  instructor_id: number;
  feature_definition_id: number;
  text_answer: string | null;
  number_answer: number | null;
  boolean_answer: boolean | null;
  selected_choice_id: number | null;
};

export type InstructorFeatureEntryChoiceRow = {
  instructor_feature_entry_id: number;
  choice_id: number;
};

export type InstructorFeatureFormState = {
  booleanValues: Record<number, boolean>;
  textValues: Record<number, string>;
  numberValues: Record<number, string>;
  dateValues: Record<number, string>;
  singleSelectValues: Record<number, string>;
  multiSelectValues: Record<number, string[]>;
};

export function getDisplayInstructorFeatureName(name: string): string {
  const trimmed = (name ?? "").trim();
  const key = trimmed.toLocaleLowerCase("tr-TR");
  if (key === "engelliye uygun") return "Engellilere Uygun";
  if (key === "fiyat aralığı") return "Aylık Ortalama Fiyat Aralığı";
  return trimmed;
}

/**
 * Eğitmen tarafında asla gösterilmeyecek tesis/imkan grupları (ad veya slug).
 * Yalnızca global/legacy gruplar (category_slug boş) için geçerlidir.
 * Category-specific Fiziki İmkanlar (ör. patili-dostlar) exclude edilmez.
 */
const INSTRUCTOR_EXCLUDED_FACILITY_GROUP_KEYS = new Set([
  "fiziki_imkanlar",
  "fiziksel_imkanlar",
  "okul_imkanlari",
]);

const INSTRUCTOR_BASLICA_GROUP_NAME_KEY = "başlıca özellikler";

function normalizeInstructorGroupKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeInstructorGroupNameKey(name: string | null | undefined): string {
  return String(name ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function normalizeInstructorGroupCategorySlug(slug: string | null | undefined): string {
  return String(slug ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i");
}

export function isInstructorBaslicaFeatureGroupName(name: string | null | undefined): boolean {
  return normalizeInstructorGroupNameKey(name) === INSTRUCTOR_BASLICA_GROUP_NAME_KEY;
}

export function isInstructorExcludedFacilityGroup(
  group: Pick<InstructorFeatureGroupRow, "name" | "slug" | "category_slug">,
): boolean {
  // Category-specific gruplar legacy tesis exclude'una girmez.
  if (normalizeInstructorGroupCategorySlug(group.category_slug).length > 0) {
    return false;
  }

  const keys = [
    normalizeInstructorGroupKey(String(group.name ?? "")),
    normalizeInstructorGroupKey(String(group.slug ?? "")),
  ].filter(Boolean);
  return keys.some((key) => INSTRUCTOR_EXCLUDED_FACILITY_GROUP_KEYS.has(key));
}

export function resolveInstructorCategorySlug(
  categoryId: number | null | undefined,
  categories: InstructorFeatureCategoryRow[],
): string | null {
  if (categoryId == null || !Number.isFinite(Number(categoryId))) return null;
  const cat = categories.find((c) => c.id === Number(categoryId));
  const slug = (cat?.slug ?? "").trim();
  return slug.length > 0 ? slug : null;
}

export function resolveInstructorCategoryDisplayName(
  categoryId: number | null | undefined,
  categories: InstructorFeatureCategoryRow[],
): string {
  if (categoryId == null || !Number.isFinite(Number(categoryId))) {
    return "Kategori atanmamış";
  }
  const cat = categories.find((c) => c.id === Number(categoryId));
  if (cat?.name?.trim()) return cat.name.trim();
  return `Kategori #${categoryId}`;
}

export function isInstructorFeatureGroupVisibleForCategory(
  group: Pick<InstructorFeatureGroupRow, "name" | "slug" | "category_slug">,
  instructorCategorySlug: string | null,
): boolean {
  if (isInstructorExcludedFacilityGroup(group)) return false;

  const groupCategorySlug = normalizeInstructorGroupCategorySlug(group.category_slug);
  // Genel gruplar (category_slug boş) — hariç tutulanlar dışında herkese
  if (!groupCategorySlug) return true;

  if (instructorCategorySlug == null) return false;
  return (
    groupCategorySlug ===
    normalizeInstructorGroupCategorySlug(instructorCategorySlug)
  );
}

/**
 * Panel / public görünür grupları: visibility + category-specific aynı isimli grup varsa global fallback gizlenir.
 * Örn. Patili Başlıca varken global Başlıca dahil edilmez; category-specific yoksa global kalır.
 */
export function resolveInstructorFeatureGroupsForActiveCategory(
  groups: InstructorFeatureGroupRow[],
  instructorCategorySlug: string | null,
): InstructorFeatureGroupRow[] {
  const visible = groups.filter((group) =>
    isInstructorFeatureGroupVisibleForCategory(group, instructorCategorySlug),
  );

  const activeSlug = normalizeInstructorGroupCategorySlug(instructorCategorySlug);
  if (!activeSlug) return visible;

  const categorySpecificNameKeys = new Set(
    visible
      .filter(
        (group) => normalizeInstructorGroupCategorySlug(group.category_slug) === activeSlug,
      )
      .map((group) => normalizeInstructorGroupNameKey(group.name))
      .filter(Boolean),
  );

  if (categorySpecificNameKeys.size === 0) return visible;

  return visible.filter((group) => {
    const groupSlug = normalizeInstructorGroupCategorySlug(group.category_slug);
    if (groupSlug) return true;
    const nameKey = normalizeInstructorGroupNameKey(group.name);
    return !categorySpecificNameKeys.has(nameKey);
  });
}

/**
 * Public profil Başlıca: aktif kategoriye özel Başlıca varsa onu, yoksa global (category_slug boş) Başlıca.
 */
export function resolveInstructorBaslicaFeatureGroupForCategory(
  groups: InstructorFeatureGroupRow[],
  instructorCategorySlug: string | null,
): InstructorFeatureGroupRow | undefined {
  const categorySlug = normalizeInstructorGroupCategorySlug(instructorCategorySlug);

  const categorySpecificBaslica =
    categorySlug.length > 0
      ? groups.find(
          (group) =>
            isInstructorBaslicaFeatureGroupName(group.name) &&
            normalizeInstructorGroupCategorySlug(group.category_slug) === categorySlug,
        )
      : undefined;

  if (categorySpecificBaslica) return categorySpecificBaslica;

  return groups.find(
    (group) =>
      isInstructorBaslicaFeatureGroupName(group.name) &&
      normalizeInstructorGroupCategorySlug(group.category_slug).length === 0,
  );
}

export function filterInstructorFeatureGroupsForListingFilter(
  groups: InstructorFeatureGroupRow[],
  selectedCategorySlug: string | null | undefined,
): InstructorFeatureGroupRow[] {
  const normalizedSlug = String(selectedCategorySlug ?? "").trim() || null;
  // Listing: visibility + category-specific aynı isimli grup varken global fallback gizlenir.
  return resolveInstructorFeatureGroupsForActiveCategory(groups, normalizedSlug);
}

export function buildInstructorFilterFieldsForListingCategory(
  groups: InstructorFeatureGroupRow[],
  definitions: InstructorFeatureDefinitionRow[],
  choices: InstructorFeatureChoiceRow[],
  selectedCategorySlug: string | null | undefined,
): InstructorFilterField[] {
  const visibleGroups = filterInstructorFeatureGroupsForListingFilter(groups, selectedCategorySlug);
  return buildInstructorFilterFieldsFromSchema(visibleGroups, definitions, choices);
}

function featureNormalizedKeys(feature: Pick<InstructorFeatureDefinitionRow, "name" | "slug">): string[] {
  return [
    normalizeInstructorFeatureText(String(feature.slug ?? "")),
    normalizeInstructorFeatureText(String(feature.name ?? "")),
  ].filter(Boolean);
}

export function isInstructorTimeTextFeature(
  feature: Pick<InstructorFeatureDefinitionRow, "name" | "slug">,
): boolean {
  return featureNormalizedKeys(feature).some(
    (key) =>
      key.includes("musait_saat") ||
      key.includes("available_time") ||
      (key.includes("saat") && (key.includes("baslangic") || key.includes("bitis"))),
  );
}

export function isInstructorTimeStartFeature(
  feature: Pick<InstructorFeatureDefinitionRow, "name" | "slug">,
): boolean {
  return featureNormalizedKeys(feature).some(
    (key) => key.includes("baslangic") || key.includes("start"),
  );
}

export function isInstructorTimeEndFeature(
  feature: Pick<InstructorFeatureDefinitionRow, "name" | "slug">,
): boolean {
  return featureNormalizedKeys(feature).some(
    (key) => key.includes("bitis") || key.includes("end"),
  );
}

export function isInstructorMinPriceFeature(
  feature: Pick<InstructorFeatureDefinitionRow, "name" | "slug">,
): boolean {
  return featureNormalizedKeys(feature).some(
    (key) => key.includes("minimum") && key.includes("ucret"),
  );
}

export function isInstructorMaxPriceFeature(
  feature: Pick<InstructorFeatureDefinitionRow, "name" | "slug">,
): boolean {
  return featureNormalizedKeys(feature).some(
    (key) => key.includes("maksimum") && key.includes("ucret"),
  );
}

/** Eğitmen panelinde gösterilmeyecek (kaldırılmış) özellikler. */
export function isInstructorPanelHiddenFeature(
  feature: Pick<InstructorFeatureDefinitionRow, "name" | "slug" | "input_type">,
): boolean {
  if (feature.input_type !== "number") return false;
  return isInstructorMinPriceFeature(feature) || isInstructorMaxPriceFeature(feature);
}

/**
 * Fiyat aralığı definition tanıma (overlap):
 * - fiyat_araligi / …fiyat_araligi…
 * - Aylık Ortalama Fiyat Aralığı
 * - patili-dostlar-fiyat-araligi
 * Ücret Tipi gibi alanları yakalamaz.
 */
export function isInstructorPriceRangeFeature(
  feature: Pick<InstructorFeatureDefinitionRow, "name" | "slug">,
): boolean {
  return featureNormalizedKeys(feature).some((key) => {
    if (key.includes("ucret_tipi") || key === "ucret_tipi") return false;
    if (key.includes("fiyat_araligi")) return true;
    if (key.includes("aylik_ortalama_fiyat")) return true;
    if (key.includes("ortalama_fiyat_araligi")) return true;
    if (key.includes("patili_dostlar_fiyat")) return true;
    return false;
  });
}

export const INSTRUCTOR_PRICE_RANGE_FEATURE_SLUG = "fiyat_araligi";

export function formatInstructorPriceRangeDisplay(labels: string | string[]): string {
  const list = (Array.isArray(labels) ? labels : [String(labels ?? "")])
    .map((label) => String(label ?? "").trim())
    .filter(Boolean);
  const unique = [...new Set(list)];
  if (unique.length === 0) return "Fiyat belirtilmedi";
  const joined = unique.join(", ");
  if (/\btl\b/i.test(joined) || joined.includes("₺")) return joined;
  return `${joined} TL`;
}

let cachedInstructorPriceRangeDefinitionId: number | null | undefined;
let cachedInstructorPriceRangeDefinitionIds: number[] | undefined;

export async function fetchInstructorPriceRangeDefinitionIdClient(
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<number | null> {
  const ids = await fetchInstructorPriceRangeDefinitionIdsClient(supabaseArg);
  return ids[0] ?? null;
}

/** Tüm fiyat-aralığı definition id'leri (global + category-specific). */
export async function fetchInstructorPriceRangeDefinitionIdsClient(
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<number[]> {
  if (cachedInstructorPriceRangeDefinitionIds !== undefined) {
    return cachedInstructorPriceRangeDefinitionIds;
  }

  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const { data: allDefs, error: allErr } = await supabase
    .from("instructor_feature_definitions")
    .select("id, slug, name");

  if (allErr) {
    cachedInstructorPriceRangeDefinitionId = null;
    cachedInstructorPriceRangeDefinitionIds = [];
    return [];
  }

  const matches = (allDefs ?? []).filter((row) =>
    isInstructorPriceRangeFeature(row as InstructorFeatureDefinitionRow),
  );

  const ids: number[] = [];
  const seen = new Set<number>();
  // Önce klasik slug, sonra diğer eşleşmeler (Patili vb.).
  const preferred = matches.find(
    (row) =>
      normalizeInstructorFeatureText(String(row.slug ?? "")) === INSTRUCTOR_PRICE_RANGE_FEATURE_SLUG,
  );
  if (preferred) {
    const id = Number(preferred.id);
    if (Number.isFinite(id) && id > 0) {
      ids.push(id);
      seen.add(id);
    }
  }
  for (const row of matches) {
    const id = Number(row.id);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    ids.push(id);
    seen.add(id);
  }

  cachedInstructorPriceRangeDefinitionIds = ids;
  cachedInstructorPriceRangeDefinitionId = ids[0] ?? null;
  return ids;
}

export async function fetchInstructorPriceRangeLabelsByInstructorIdsClient(
  instructorIds: number[],
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const uniqueIds = [
    ...new Set(instructorIds.filter((id) => Number.isFinite(id) && id > 0)),
  ];
  if (uniqueIds.length === 0) return result;

  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const definitionIds = await fetchInstructorPriceRangeDefinitionIdsClient(supabase);
  if (definitionIds.length === 0) return result;

  const { data: entriesRaw, error: entriesError } = await supabase
    .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
    .select("id, instructor_id")
    .in("feature_definition_id", definitionIds)
    .in("instructor_id", uniqueIds);

  if (entriesError || !entriesRaw?.length) return result;

  const entryIdToInstructorId = new Map<number, number>();
  for (const entry of entriesRaw as Array<{ id: number; instructor_id: number }>) {
    const entryId = Number(entry.id);
    const instructorId = Number(entry.instructor_id);
    if (Number.isFinite(entryId) && Number.isFinite(instructorId)) {
      entryIdToInstructorId.set(entryId, instructorId);
    }
  }

  const entryIds = Array.from(entryIdToInstructorId.keys());
  if (entryIds.length === 0) return result;

  const { data: linksRaw, error: linksError } = await supabase
    .from(INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE)
    .select("instructor_feature_entry_id, choice_id")
    .in("instructor_feature_entry_id", entryIds);

  if (linksError || !linksRaw?.length) return result;

  const choiceIds = [
    ...new Set(
      (linksRaw as Array<{ choice_id: number }>)
        .map((row) => Number(row.choice_id))
        .filter((id) => Number.isFinite(id)),
    ),
  ];
  if (choiceIds.length === 0) return result;

  const { data: choicesRaw, error: choicesError } = await supabase
    .from("instructor_feature_choices")
    .select("id, name, display_order")
    .in("id", choiceIds)
    .eq("is_active", true);

  if (choicesError) return result;

  const choiceNameById = new Map<number, string>();
  for (const choice of (choicesRaw ?? []) as Array<{
    id: number;
    name?: string | null;
  }>) {
    const choiceId = Number(choice.id);
    const name = String(choice.name ?? "").trim();
    if (Number.isFinite(choiceId) && name) choiceNameById.set(choiceId, name);
  }

  const labelsByInstructorId = new Map<number, string[]>();
  for (const link of linksRaw as Array<{
    instructor_feature_entry_id: number;
    choice_id: number;
  }>) {
    const instructorId = entryIdToInstructorId.get(Number(link.instructor_feature_entry_id));
    const label = choiceNameById.get(Number(link.choice_id));
    if (!instructorId || !label) continue;
    const existing = labelsByInstructorId.get(instructorId) ?? [];
    existing.push(label);
    labelsByInstructorId.set(instructorId, existing);
  }

  for (const [instructorId, labels] of labelsByInstructorId) {
    result.set(instructorId, formatInstructorPriceRangeDisplay(labels));
  }

  return result;
}

export function parseValidTimeHHMM(raw: string): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function timeHHMMToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function validateInstructorFeatureForm(
  definitions: InstructorFeatureDefinitionRow[],
  form: InstructorFeatureFormState,
  featureIdsToSave: number[],
): string | null {
  const saveSet = new Set(featureIdsToSave);
  let minPrice: number | null = null;
  let maxPrice: number | null = null;
  let minAgeRaw = "";
  let maxAgeRaw = "";
  let hasAgeMin = false;
  let hasAgeMax = false;

  for (const feature of definitions) {
    if (!saveSet.has(feature.id)) continue;
    if (isInstructorPanelHiddenFeature(feature)) continue;

    if (feature.input_type === "text" && isInstructorTimeTextFeature(feature)) {
      const raw = (form.textValues[feature.id] ?? "").trim();
      if (raw && !parseValidTimeHHMM(raw)) {
        return `${getDisplayInstructorFeatureName(feature.name)} alanı geçerli bir saat (SS:dd) olmalıdır.`;
      }
    }

    if (feature.input_type === "number" && isInstructorMinPriceFeature(feature)) {
      const raw = (form.numberValues[feature.id] ?? "").trim();
      if (raw) {
        const n = Number(raw.replace(",", "."));
        if (!Number.isFinite(n) || n < 0) {
          return `${getDisplayInstructorFeatureName(feature.name)} alanına yalnızca 0 veya pozitif sayı girilebilir.`;
        }
        minPrice = n;
      }
    }

    if (feature.input_type === "number" && isInstructorMaxPriceFeature(feature)) {
      const raw = (form.numberValues[feature.id] ?? "").trim();
      if (raw) {
        const n = Number(raw.replace(",", "."));
        if (!Number.isFinite(n) || n < 0) {
          return `${getDisplayInstructorFeatureName(feature.name)} alanına yalnızca 0 veya pozitif sayı girilebilir.`;
        }
        maxPrice = n;
      }
    }

    if (feature.input_type === "number" && isStudentAgeMinFeature(feature)) {
      hasAgeMin = true;
      minAgeRaw = form.numberValues[feature.id] ?? "";
    }

    if (feature.input_type === "number" && isStudentAgeMaxFeature(feature)) {
      hasAgeMax = true;
      maxAgeRaw = form.numberValues[feature.id] ?? "";
    }
  }

  if (hasAgeMin && hasAgeMax) {
    const ageError = validateStudentAgeRangeValues(minAgeRaw, maxAgeRaw);
    if (ageError) return ageError;
  }

  const startFeature = definitions.find(
    (f) => saveSet.has(f.id) && f.input_type === "text" && isInstructorTimeStartFeature(f),
  );
  const endFeature = definitions.find(
    (f) => saveSet.has(f.id) && f.input_type === "text" && isInstructorTimeEndFeature(f),
  );
  if (startFeature && endFeature) {
    const start = parseValidTimeHHMM(form.textValues[startFeature.id] ?? "");
    const end = parseValidTimeHHMM(form.textValues[endFeature.id] ?? "");
    if (start && end && timeHHMMToMinutes(end) <= timeHHMMToMinutes(start)) {
      return "Müsait saat bitiş, başlangıç saatinden sonra olmalıdır.";
    }
  }

  if (minPrice != null && maxPrice != null && maxPrice < minPrice) {
    return "Maksimum ücret, minimum ücretten küçük olamaz.";
  }

  return null;
}

export type InstructorRealFeatureDefinitionRow = {
  id: number;
  name: string | null;
  slug: string | null;
  input_type: string | null;
};

type DirectInstructorFeatureKey =
  | "lesson_type"
  | "service_type"
  | "education_level"
  | "working_hours";

type DirectInstructorFeaturePatch = {
  lesson_type?: string | null;
  service_type?: string | null;
  education_level?: string | null;
  working_hours_start?: string | null;
  working_hours_end?: string | null;
  category_id?: number;
};

type InstructorFeatureChoiceLike = {
  id: number;
  feature_definition_id: number;
  name?: string | null;
  is_active?: boolean;
};

function normalizeInstructorFeatureText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveDirectInstructorFeatureKey(
  feature: Pick<InstructorFeatureDefinitionRow, "name" | "slug">,
): DirectInstructorFeatureKey | null {
  const candidates = [
    normalizeInstructorFeatureText(String(feature.slug ?? "")),
    normalizeInstructorFeatureText(String(feature.name ?? "")),
  ].filter(Boolean);

  if (
    candidates.some(
      (key) =>
        key.includes("lesson_type") ||
        key === "ders_turu" ||
        key === "ders_tipi" ||
        key === "ders_sekli",
    )
  ) {
    return "lesson_type";
  }
  if (
    candidates.some(
      (key) =>
        key.includes("service_type") ||
        key === "hizmet_turu" ||
        key === "hizmet_tipi" ||
        key === "servis_tipi" ||
        key === "servis_turu",
    )
  ) {
    return "service_type";
  }
  if (candidates.some((key) => key.includes("education_level") || key === "egitim_seviyesi")) {
    return "education_level";
  }
  if (
    candidates.some(
      (key) =>
        key.includes("working_hours") ||
        key === "okul_saatleri" ||
        key === "calisma_saatleri" ||
        key === "saat",
    )
  ) {
    return "working_hours";
  }
  return null;
}

function getChoiceLabelById(
  featureId: number,
  choiceId: string,
  choices: InstructorFeatureChoiceLike[],
): string {
  return (
    choices.find(
      (choice) =>
        choice.feature_definition_id === featureId &&
        String(choice.id) === choiceId &&
        choice.is_active !== false,
    )?.name?.trim() ?? ""
  );
}

function getFeatureValueAsText(
  feature: InstructorFeatureDefinitionRow,
  form: InstructorFeatureFormState,
  choices: InstructorFeatureChoiceLike[],
): string {
  if (feature.input_type === "text") {
    return (form.textValues[feature.id] ?? "").trim();
  }
  if (feature.input_type === "number") {
    return (form.numberValues[feature.id] ?? "").trim();
  }
  if (feature.input_type === "date") {
    return (form.dateValues[feature.id] ?? "").trim();
  }
  if (feature.input_type === "boolean") {
    return form.booleanValues[feature.id] ? "Evet" : "";
  }

  if (feature.input_type === "single_select") {
    const selected = (form.singleSelectValues[feature.id] ?? "").trim();
    return selected ? getChoiceLabelById(feature.id, selected, choices) : "";
  }

  if (feature.input_type === "multi_select") {
    const selected = form.multiSelectValues[feature.id] ?? [];
    const labels = selected
      .map((choiceId) => getChoiceLabelById(feature.id, choiceId, choices))
      .filter(Boolean);
    return labels.join(", ");
  }

  return "";
}

function parseWorkingHoursFeatureValue(value: string): {
  working_hours_start: string | null;
  working_hours_end: string | null;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return { working_hours_start: null, working_hours_end: null };
  }

  const match = trimmed.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (!match) {
    return { working_hours_start: null, working_hours_end: null };
  }

  const normalizeTime = (raw: string) => {
    const [hour, minute] = raw.split(":");
    return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  };

  return {
    working_hours_start: normalizeTime(match[1]),
    working_hours_end: normalizeTime(match[2]),
  };
}

export function buildInstructorDirectFeatureUpdatePayload(
  definitions: InstructorFeatureDefinitionRow[],
  choices: InstructorFeatureChoiceLike[],
  form: InstructorFeatureFormState,
  featureIdsToSave: number[],
): DirectInstructorFeaturePatch {
  const patch: DirectInstructorFeaturePatch = {};
  const saveSet = new Set(featureIdsToSave);

  for (const feature of definitions) {
    if (!saveSet.has(feature.id)) continue;
    const directKey = resolveDirectInstructorFeatureKey(feature);
    if (!directKey) continue;

    const value = getFeatureValueAsText(feature, form, choices);
    if (directKey === "working_hours") {
      const parsed = parseWorkingHoursFeatureValue(value);
      if (value && !parsed.working_hours_start && !parsed.working_hours_end) {
        console.warn("[instructor-features] okul saatleri değeri parse edilemedi, atlanıyor:", {
          featureId: feature.id,
          featureName: feature.name,
          value,
        });
        continue;
      }
      patch.working_hours_start = parsed.working_hours_start;
      patch.working_hours_end = parsed.working_hours_end;
      continue;
    }

    patch[directKey] = value || null;
  }

  return patch;
}

export function mergeInstructorDirectFeatureValuesIntoForm(
  definitions: InstructorFeatureDefinitionRow[],
  choices: InstructorFeatureChoiceLike[],
  baseForm: InstructorFeatureFormState,
  instructorRow: Pick<
    InstructorProfileRow,
    "lesson_type" | "service_type" | "education_level" | "working_hours_start" | "working_hours_end"
  >,
): InstructorFeatureFormState {
  const next: InstructorFeatureFormState = {
    booleanValues: { ...baseForm.booleanValues },
    textValues: { ...baseForm.textValues },
    numberValues: { ...baseForm.numberValues },
    dateValues: { ...baseForm.dateValues },
    singleSelectValues: { ...baseForm.singleSelectValues },
    multiSelectValues: { ...baseForm.multiSelectValues },
  };

  const directValues: Record<Exclude<DirectInstructorFeatureKey, "working_hours">, string> = {
    lesson_type: String(instructorRow.lesson_type ?? "").trim(),
    service_type: String(instructorRow.service_type ?? "").trim(),
    education_level: String(instructorRow.education_level ?? "").trim(),
  };

  const workingHoursRange =
    instructorRow.working_hours_start && instructorRow.working_hours_end
      ? `${institutionTimeToInputHHMM(instructorRow.working_hours_start)} - ${institutionTimeToInputHHMM(
          instructorRow.working_hours_end,
        )}`
      : "";

  for (const feature of definitions) {
    const directKey = resolveDirectInstructorFeatureKey(feature);
    if (!directKey) continue;

    if (feature.input_type === "multi_select") {
      const existingMulti = baseForm.multiSelectValues[feature.id] ?? [];
      if (existingMulti.length > 0) continue;
    } else if (feature.input_type === "single_select") {
      if ((baseForm.singleSelectValues[feature.id] ?? "").trim()) continue;
    }

    const rawValue = directKey === "working_hours" ? workingHoursRange : directValues[directKey];
    if (!rawValue) continue;

    if (feature.input_type === "text") {
      next.textValues[feature.id] = rawValue;
      continue;
    }

    if (feature.input_type === "number") {
      next.numberValues[feature.id] = rawValue;
      continue;
    }

    const normalizedValue = normalizeInstructorFeatureText(rawValue);
    const matchingChoices = choices.filter(
      (choice) => choice.feature_definition_id === feature.id && choice.is_active !== false,
    );

    if (feature.input_type === "multi_select") {
      const valueParts = rawValue
        .split(",")
        .map((part) => normalizeInstructorFeatureText(part))
        .filter(Boolean);

      next.multiSelectValues[feature.id] = matchingChoices
        .filter((choice) => valueParts.includes(normalizeInstructorFeatureText(String(choice.name ?? ""))))
        .map((choice) => String(choice.id));
      continue;
    }

    const singleChoice = matchingChoices.find((choice) => {
      const choiceKey = normalizeInstructorFeatureText(String(choice.name ?? ""));
      return choiceKey === normalizedValue || normalizedValue.includes(choiceKey) || choiceKey.includes(normalizedValue);
    });

    if (singleChoice) {
      next.singleSelectValues[feature.id] = String(singleChoice.id);
    } else if (feature.input_type === "single_select") {
      next.singleSelectValues[feature.id] = "";
    }
  }

  return next;
}

function logInstructorFeaturesSupabaseError(scope: string, error: unknown) {
  const row = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null;

  console.error(`[instructor-features] ${scope}:`, {
    code: String(row?.code ?? ""),
    message: String(row?.message ?? ""),
    details: String(row?.details ?? ""),
    hint: String(row?.hint ?? ""),
  });
}

export async function fetchInstructorFeatureCategoriesClient(
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ categories: InstructorFeatureCategoryRow[]; error: string | null }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("instructor_categories")
    .select("id, name, slug, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    logInstructorFeaturesSupabaseError("categories", error);
    return { categories: [], error: INSTRUCTOR_FEATURES_LOAD_ERROR };
  }

  return { categories: (data as InstructorFeatureCategoryRow[] | null) ?? [], error: null };
}

export async function fetchInstructorFeatureDefinitionsBundleClient(
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{
  groups: InstructorFeatureGroupRow[];
  definitions: InstructorFeatureDefinitionRow[];
  choices: InstructorFeatureChoiceRow[];
  error: string | null;
}> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();

  const [groupsRes, definitionsRes, choicesRes] = await Promise.all([
    supabase
      .from("instructor_feature_groups")
      .select("id, name, slug, display_order, is_active, category_slug")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("instructor_feature_definitions")
      .select("id, group_id, name, slug, input_type, help_text, placeholder, unit, display_order, is_active")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("instructor_feature_choices")
      .select("id, feature_definition_id, name, display_order, is_active")
      .eq("is_active", true)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true }),
  ]);

  if (
    hasSupabaseResponseError(groupsRes.error) ||
    hasSupabaseResponseError(definitionsRes.error) ||
    hasSupabaseResponseError(choicesRes.error)
  ) {
    logInstructorFeaturesSupabaseError("definitions bundle groups", groupsRes.error);
    logInstructorFeaturesSupabaseError("definitions bundle definitions", definitionsRes.error);
    logInstructorFeaturesSupabaseError("definitions bundle choices", choicesRes.error);
    return { groups: [], definitions: [], choices: [], error: INSTRUCTOR_FEATURES_LOAD_ERROR };
  }

  return {
    groups: (groupsRes.data as InstructorFeatureGroupRow[] | null) ?? [],
    definitions: (definitionsRes.data as InstructorFeatureDefinitionRow[] | null) ?? [],
    choices: (choicesRes.data as InstructorFeatureChoiceRow[] | null) ?? [],
    error: null,
  };
}

function compareDisplayOrder(
  a: { display_order?: number | null },
  b: { display_order?: number | null },
): number {
  const orderA = Number.isFinite(Number(a.display_order)) ? Number(a.display_order) : Number.MAX_SAFE_INTEGER;
  const orderB = Number.isFinite(Number(b.display_order)) ? Number(b.display_order) : Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return 0;
}

function sortInstructorFilterOptionsByLabel<T>(options: T[], getLabel: (option: T) => string): T[] {
  return [...options].sort((a, b) =>
    getLabel(a).localeCompare(getLabel(b), "tr", { sensitivity: "base" }),
  );
}

export async function fetchInstructorFeatureFilterSchemaDataClient(
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{
  groups: InstructorFeatureGroupRow[];
  definitions: InstructorFeatureDefinitionRow[];
  choices: InstructorFeatureChoiceRow[];
  error: string | null;
}> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();

  const [groupsRes, definitionsRes, choicesRes] = await Promise.all([
    supabase
      .from("instructor_feature_groups")
      .select("id, name, slug, display_order, is_active, category_slug")
      .eq("is_active", true)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true }),
    supabase
      .from("instructor_feature_definitions")
      .select(
        "id, group_id, name, slug, input_type, help_text, placeholder, unit, display_order, is_active",
      )
      .eq("is_active", true)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true }),
    supabase
      .from("instructor_feature_choices")
      .select("id, feature_definition_id, name, display_order, is_active")
      .eq("is_active", true)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true }),
  ]);

  if (
    hasSupabaseResponseError(groupsRes.error) ||
    hasSupabaseResponseError(definitionsRes.error) ||
    hasSupabaseResponseError(choicesRes.error)
  ) {
    logInstructorFeaturesSupabaseError("filter schema groups", groupsRes.error);
    logInstructorFeaturesSupabaseError("filter schema definitions", definitionsRes.error);
    logInstructorFeaturesSupabaseError("filter schema choices", choicesRes.error);
    return { groups: [], definitions: [], choices: [], error: INSTRUCTOR_FEATURES_LOAD_ERROR };
  }

  return {
    groups: (groupsRes.data as InstructorFeatureGroupRow[] | null) ?? [],
    definitions: (definitionsRes.data as InstructorFeatureDefinitionRow[] | null) ?? [],
    choices: (choicesRes.data as InstructorFeatureChoiceRow[] | null) ?? [],
    error: null,
  };
}

export async function fetchInstructorFeatureFilterSchemaClient(
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
  selectedCategorySlug?: string | null,
): Promise<{
  fields: InstructorFilterField[];
  error: string | null;
}> {
  const data = await fetchInstructorFeatureFilterSchemaDataClient(supabaseArg);
  if (data.error) return { fields: [], error: data.error };

  const fields = buildInstructorFilterFieldsForListingCategory(
    data.groups,
    data.definitions,
    data.choices,
    selectedCategorySlug,
  );

  return { fields, error: null };
}

export function buildInstructorFilterFieldsFromSchema(
  groups: InstructorFeatureGroupRow[],
  definitions: InstructorFeatureDefinitionRow[],
  choices: InstructorFeatureChoiceRow[],
): InstructorFilterField[] {
  const choicesByDefinition = new Map<number, InstructorFilterFieldChoice[]>();

  for (const choice of [...choices].sort(compareDisplayOrder)) {
    const definitionId = Number(choice.feature_definition_id);
    if (!Number.isFinite(definitionId)) continue;
    const name = String(choice.name ?? "").trim();
    if (!name) continue;
    const current = choicesByDefinition.get(definitionId) ?? [];
    current.push({ id: Number(choice.id), name });
    choicesByDefinition.set(definitionId, current);
  }

  const definitionsByGroup = new Map<number, InstructorFeatureDefinitionRow[]>();
  for (const definition of definitions) {
    const groupId = Number(definition.group_id);
    if (!Number.isFinite(groupId)) continue;
    const name = String(definition.name ?? "").trim();
    if (!name) continue;
    const current = definitionsByGroup.get(groupId) ?? [];
    current.push(definition);
    definitionsByGroup.set(groupId, current);
  }

  const sortedGroups = [...groups].sort(compareDisplayOrder);
  const fields: InstructorFilterField[] = [];
  const ageDefs = findStudentAgeRangeDefinitions(definitions);
  let ageRangeInserted = false;

  for (const group of sortedGroups) {
    const groupDefinitions = [...(definitionsByGroup.get(group.id) ?? [])].sort(compareDisplayOrder);
    const groupName = getDisplayInstructorFeatureName(String(group.name ?? "").trim());
    const booleanBuffer: Array<{ definitionId: number; name: string }> = [];

    const flushBooleanBuffer = () => {
      if (booleanBuffer.length === 0) return;
      if (booleanBuffer.length >= 2 && groupName) {
        fields.push({
          kind: "boolean_group",
          groupId: group.id,
          name: groupName,
          options: sortInstructorFilterOptionsByLabel(booleanBuffer, (option) => option.name),
        });
      } else {
        for (const option of booleanBuffer) {
          fields.push({
            kind: "boolean",
            definitionId: option.definitionId,
            name: option.name,
          });
        }
      }
      booleanBuffer.length = 0;
    };

    for (const definition of groupDefinitions) {
      const inputType = String(definition.input_type ?? "").trim().toLowerCase();
      const displayName = getDisplayInstructorFeatureName(String(definition.name ?? "").trim());
      if (!displayName) continue;

      // Fiyat aralığı /egitmenler sayfasında range slider ile filtrelenir; checkbox olarak gösterilmez.
      if (isInstructorPriceRangeFeature(definition)) {
        continue;
      }

      if (
        isLegacyStudentAgeMultiSelectFeature({
          slug: definition.slug,
          name: definition.name,
          input_type: inputType,
        })
      ) {
        continue;
      }

      if (isStudentAgeRangeNumberFeature(definition)) {
        flushBooleanBuffer();
        if (ageDefs.min && ageDefs.max && !ageRangeInserted) {
          fields.push({
            kind: "student_age_range",
            definitionId: ageDefs.min.id,
            name: STUDENT_AGE_RANGE_LABEL,
          });
          ageRangeInserted = true;
        }
        continue;
      }

      if (inputType === "boolean") {
        booleanBuffer.push({
          definitionId: definition.id,
          name: displayName,
        });
        continue;
      }

      flushBooleanBuffer();

      if (inputType === "single_select") {
        const definitionChoices = choicesByDefinition.get(definition.id) ?? [];
        if (definitionChoices.length === 0) continue;
        fields.push({
          kind: "single_select",
          definitionId: definition.id,
          name: displayName,
          placeholder: String(definition.placeholder ?? "").trim() || "Seçiniz",
          choices: definitionChoices,
        });
        continue;
      }

      if (inputType === "multi_select") {
        const definitionChoices = choicesByDefinition.get(definition.id) ?? [];
        if (definitionChoices.length === 0) continue;
        fields.push({
          kind: "multi_select",
          definitionId: definition.id,
          name: displayName,
          choices: definitionChoices,
        });
        continue;
      }

      if (inputType === "number") {
        fields.push({
          kind: "number_range",
          definitionId: definition.id,
          name: displayName,
          unit: definition.unit ?? null,
        });
        continue;
      }

      // text ve desteklenmeyen tipler filtre UI'da gösterilmez (part 2'de gerekirse eklenir).
    }

    flushBooleanBuffer();
  }

  return fields;
}

export async function fetchInstructorFeatureEntriesClient(
  _authUid: string,
  instructorId: number,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{
  entries: InstructorFeatureEntryRow[];
  entryChoices: InstructorFeatureEntryChoiceRow[];
  error: string | null;
}> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const normalizedInstructorId = Number(instructorId);

  if (!Number.isFinite(normalizedInstructorId) || normalizedInstructorId <= 0) {
    return { entries: [], entryChoices: [], error: null };
  }

  const { data: entriesData, error: entriesError } = await supabase
    .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
    .select(
      "id, instructor_id, feature_definition_id, text_answer, number_answer, boolean_answer, selected_choice_id",
    )
    .eq("instructor_id", normalizedInstructorId);

  if (entriesError) {
    logInstructorFeaturesSupabaseError("entries", entriesError);
    return { entries: [], entryChoices: [], error: INSTRUCTOR_FEATURES_LOAD_ERROR };
  }

  const entries = (entriesData as InstructorFeatureEntryRow[] | null) ?? [];
  const entryIds = entries.map((e) => e.id);
  let entryChoices: InstructorFeatureEntryChoiceRow[] = [];

  if (entryIds.length > 0) {
    const { data: choicesData, error: choicesError } = await supabase
      .from(INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE)
      .select("instructor_feature_entry_id, choice_id")
      .in("instructor_feature_entry_id", entryIds);

    if (choicesError) {
      logInstructorFeaturesSupabaseError("entry choices", choicesError);
      return { entries: [], entryChoices: [], error: INSTRUCTOR_FEATURES_LOAD_ERROR };
    }
    entryChoices = (choicesData as InstructorFeatureEntryChoiceRow[] | null) ?? [];
  }

  return { entries, entryChoices, error: null };
}

export async function fetchInstructorRealFeatureDefinitionsClient(
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ definitions: InstructorRealFeatureDefinitionRow[]; error: string | null }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("instructor_feature_definitions")
    .select("id, name, slug, input_type");

  if (error) {
    logInstructorFeaturesSupabaseError("real definitions", error);
    return { definitions: [], error: INSTRUCTOR_FEATURES_LOAD_ERROR };
  }

  const definitions = ((data ?? []) as InstructorRealFeatureDefinitionRow[]).filter((row) =>
    Number.isFinite(Number(row.id)),
  );
  return { definitions, error: null };
}

export function buildInstructorUiRealDefinitionMaps(
  uiDefinitions: InstructorFeatureDefinitionRow[],
  realDefinitions: InstructorRealFeatureDefinitionRow[],
): {
  uiFeatureIdToRealDefinition: Map<number, InstructorRealFeatureDefinitionRow>;
  realDefinitionIdToUiFeatureId: Map<number, number>;
} {
  const realDefinitionByNormalizedKey = new Map<string, InstructorRealFeatureDefinitionRow>();
  realDefinitions.forEach((definition) => {
    const slugKey = normalizeInstructorFeatureText(String(definition.slug ?? ""));
    const nameKey = normalizeInstructorFeatureText(String(definition.name ?? ""));
    if (slugKey) realDefinitionByNormalizedKey.set(slugKey, definition);
    if (nameKey && !realDefinitionByNormalizedKey.has(nameKey)) {
      realDefinitionByNormalizedKey.set(nameKey, definition);
    }
  });

  const resolveRealDefinition = (feature: InstructorFeatureDefinitionRow) => {
    const keys = [
      normalizeInstructorFeatureText(String(feature.slug ?? "")),
      normalizeInstructorFeatureText(String(feature.name ?? "")),
    ].filter(Boolean);

    for (const key of keys) {
      const found = realDefinitionByNormalizedKey.get(key);
      if (found) return found;
    }
    return null;
  };

  const uiFeatureIdToRealDefinition = new Map<number, InstructorRealFeatureDefinitionRow>();
  const realDefinitionIdToUiFeatureId = new Map<number, number>();

  uiDefinitions.forEach((feature) => {
    const resolved = resolveRealDefinition(feature);
    if (!resolved) return;
    uiFeatureIdToRealDefinition.set(feature.id, resolved);
    realDefinitionIdToUiFeatureId.set(Number(resolved.id), feature.id);
  });

  return { uiFeatureIdToRealDefinition, realDefinitionIdToUiFeatureId };
}

export function buildUiToInstructorChoiceIdMap(
  uiDefinitions: InstructorFeatureDefinitionRow[],
  uiChoices: Array<{ id: number; feature_definition_id: number; name?: string | null; slug?: string | null }>,
  realDefinitions: InstructorRealFeatureDefinitionRow[],
  realChoices: Array<{ id: number; feature_definition_id: number; name?: string | null; slug?: string | null }>,
): {
  uiFeatureIdToRealDefinition: Map<number, InstructorRealFeatureDefinitionRow>;
  instructorChoiceIdByUiKey: Map<string, number>;
} {
  const { uiFeatureIdToRealDefinition } = buildInstructorUiRealDefinitionMaps(uiDefinitions, realDefinitions);
  const instructorChoiceIdByUiKey = new Map<string, number>();

  const matchChoice = (
    uiChoice: { name?: string | null; slug?: string | null },
    candidate: { name?: string | null; slug?: string | null },
  ): boolean => {
    const uiSlug = normalizeInstructorFeatureText(String(uiChoice.slug ?? ""));
    const realSlug = normalizeInstructorFeatureText(String(candidate.slug ?? ""));
    if (uiSlug && realSlug && uiSlug === realSlug) return true;
    const uiName = normalizeInstructorFeatureText(String(uiChoice.name ?? ""));
    const realName = normalizeInstructorFeatureText(String(candidate.name ?? ""));
    return Boolean(uiName && realName && uiName === realName);
  };

  for (const feature of uiDefinitions) {
    const realDefinition = uiFeatureIdToRealDefinition.get(feature.id);
    if (!realDefinition) continue;

    const uiChoicesForFeature = uiChoices.filter((c) => c.feature_definition_id === feature.id);
    const realChoicesForFeature = realChoices.filter(
      (c) => c.feature_definition_id === Number(realDefinition.id),
    );

    for (const uiChoice of uiChoicesForFeature) {
      const realChoice = realChoicesForFeature.find((c) => matchChoice(uiChoice, c));
      if (realChoice) {
        instructorChoiceIdByUiKey.set(`${feature.id}:${uiChoice.id}`, Number(realChoice.id));
      }
    }
  }

  return { uiFeatureIdToRealDefinition, instructorChoiceIdByUiKey };
}

export function buildInstructorFeatureFormStateFromEntries(
  definitions: InstructorFeatureDefinitionRow[],
  entries: InstructorFeatureEntryRow[],
  entryChoices: InstructorFeatureEntryChoiceRow[],
): InstructorFeatureFormState {
  const entriesByFeatureId = new Map<number, InstructorFeatureEntryRow>();
  entries.forEach((entry) => {
    entriesByFeatureId.set(entry.feature_definition_id, entry);
  });

  const choiceIdsByEntryId = new Map<number, string[]>();
  entryChoices.forEach((row) => {
    const current = choiceIdsByEntryId.get(row.instructor_feature_entry_id) ?? [];
    const choiceId = String(row.choice_id);
    if (!current.includes(choiceId)) current.push(choiceId);
    choiceIdsByEntryId.set(row.instructor_feature_entry_id, current);
  });

  const booleanValues: Record<number, boolean> = {};
  const textValues: Record<number, string> = {};
  const numberValues: Record<number, string> = {};
  const dateValues: Record<number, string> = {};
  const singleSelectValues: Record<number, string> = {};
  const multiSelectValues: Record<number, string[]> = {};

  definitions.forEach((feature) => {
    const entry = entriesByFeatureId.get(feature.id);
    if (feature.input_type === "boolean") {
      booleanValues[feature.id] = entry?.boolean_answer === true;
    } else if (feature.input_type === "text") {
      const raw = entry?.text_answer ?? "";
      if (isInstructorTimeTextFeature(feature)) {
        textValues[feature.id] = parseValidTimeHHMM(String(raw)) ?? "";
      } else {
        textValues[feature.id] = raw;
      }
    } else if (feature.input_type === "number") {
      numberValues[feature.id] =
        typeof entry?.number_answer === "number" ? String(entry.number_answer) : "";
    } else if (feature.input_type === "date") {
      dateValues[feature.id] = entry?.text_answer ? String(entry.text_answer).slice(0, 10) : "";
    } else if (feature.input_type === "single_select") {
      if (entry?.selected_choice_id != null && Number.isFinite(Number(entry.selected_choice_id))) {
        singleSelectValues[feature.id] = String(entry.selected_choice_id);
      } else {
        const legacyChoiceIds = entry ? choiceIdsByEntryId.get(entry.id) ?? [] : [];
        singleSelectValues[feature.id] = legacyChoiceIds[0] ?? "";
      }
    } else if (feature.input_type === "multi_select") {
      multiSelectValues[feature.id] = entry ? choiceIdsByEntryId.get(entry.id) ?? [] : [];
    }
  });

  return {
    booleanValues,
    textValues,
    numberValues,
    dateValues,
    singleSelectValues,
    multiSelectValues,
  };
}

export type InstructorFeatureDefinitionRef = Pick<
  InstructorFeatureDefinitionRow,
  "id" | "input_type" | "name" | "slug"
>;

export function createEmptyInstructorFeatureFormState(): InstructorFeatureFormState {
  return {
    booleanValues: {},
    textValues: {},
    numberValues: {},
    dateValues: {},
    singleSelectValues: {},
    multiSelectValues: {},
  };
}

/** Panelde görünür gruplardan geçerli definition id set'i. */
export function collectDefinitionIdsFromInstructorFeatureGroups(
  groups: Array<{ features: Array<{ id: number }> }>,
): Set<number> {
  const ids = new Set<number>();
  for (const group of groups) {
    for (const feature of group.features) {
      ids.add(feature.id);
    }
  }
  return ids;
}

/**
 * Form state'te bu feature için kayıt tutulmalı mı?
 * boolean: yalnız true dolu sayılır (mevcut save mantığıyla aynı).
 */
export function isInstructorFeatureFilledInFormState(
  feature: InstructorFeatureDefinitionRef,
  form: InstructorFeatureFormState,
): boolean {
  const inputType = String(feature.input_type ?? "").trim().toLowerCase();

  if (inputType === "boolean") {
    return form.booleanValues[feature.id] === true;
  }
  if (inputType === "text") {
    return String(form.textValues[feature.id] ?? "").trim().length > 0;
  }
  if (inputType === "date") {
    return String(form.dateValues[feature.id] ?? "").trim().length > 0;
  }
  if (inputType === "number") {
    return String(form.numberValues[feature.id] ?? "").trim().length > 0;
  }
  if (inputType === "single_select") {
    return String(form.singleSelectValues[feature.id] ?? "").trim().length > 0;
  }
  if (inputType === "multi_select") {
    if (isLegacyStudentAgeMultiSelectFeature(feature)) return false;
    const selectedIds = form.multiSelectValues[feature.id] ?? [];
    return selectedIds.some((choiceId) => String(choiceId ?? "").trim().length > 0);
  }

  return false;
}

/**
 * Kaydet reconciliation:
 * A) currentValidDefinitionIds dışındaki entry'ler stale
 * B) valid scope içinde form boş olan entry'ler stale
 */
export function collectStaleInstructorFeatureEntryIds(args: {
  dbEntries: Array<{ id: number; feature_definition_id: number }>;
  currentValidDefinitionIds: ReadonlySet<number>;
  definitionsById: ReadonlyMap<number, InstructorFeatureDefinitionRef>;
  form: InstructorFeatureFormState;
}): number[] {
  const staleEntryIds: number[] = [];

  for (const entry of args.dbEntries) {
    const defId = entry.feature_definition_id;
    if (!args.currentValidDefinitionIds.has(defId)) {
      staleEntryIds.push(entry.id);
      continue;
    }

    const definition = args.definitionsById.get(defId);
    if (!definition) {
      staleEntryIds.push(entry.id);
      continue;
    }

    if (!isInstructorFeatureFilledInFormState(definition, args.form)) {
      staleEntryIds.push(entry.id);
    }
  }

  return staleEntryIds;
}

export type SaveInstructorFeaturesParams = {
  authUid: string;
  instructorId: number;
  definitions: InstructorFeatureDefinitionRow[];
  choices: InstructorFeatureChoiceRow[];
  entries: InstructorFeatureEntryRow[];
  form: InstructorFeatureFormState;
  featureIdsToSave: number[];
  /** Yalnızca instructors.can_edit_category === true iken çağırıcı tarafından gönderilir. */
  categoryIdToSave?: number;
};

export async function saveInstructorFeaturesClient(
  params: SaveInstructorFeaturesParams,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ error: string | null }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const {
    authUid,
    instructorId,
    definitions,
    choices,
    form,
    featureIdsToSave,
    categoryIdToSave,
  } = params;

  const currentValidDefinitionIds = new Set(featureIdsToSave);
  const shouldPersist = (featureId: number) => currentValidDefinitionIds.has(featureId);

  const categoryPatch: DirectInstructorFeaturePatch = {};
  if (
    typeof categoryIdToSave === "number" &&
    Number.isFinite(categoryIdToSave) &&
    categoryIdToSave > 0
  ) {
    categoryPatch.category_id = categoryIdToSave;
  }

  if (Object.keys(categoryPatch).length > 0) {
    const { error: categoryError } = await supabase
      .from(INSTRUCTORS_TABLE)
      .update(categoryPatch)
      .eq("id", instructorId)
      .eq("owner_auth_id", authUid);

    if (categoryError) {
      logInstructorFeaturesSupabaseError("category save", categoryError);
      return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    }
  }

  const freshEntriesResult = await fetchInstructorFeatureEntriesClient(
    authUid,
    instructorId,
    supabase,
  );
  if (freshEntriesResult.error) {
    return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
  }

  let workingEntries = freshEntriesResult.entries;

  const definitionsById = new Map<number, InstructorFeatureDefinitionRef>(
    definitions.map((definition) => [definition.id, definition]),
  );

  const staleEntryIds = collectStaleInstructorFeatureEntryIds({
    dbEntries: workingEntries,
    currentValidDefinitionIds,
    definitionsById,
    form,
  });

  if (staleEntryIds.length > 0) {
    const { error: deleteChoicesError } = await supabase
      .from(INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE)
      .delete()
      .in("instructor_feature_entry_id", staleEntryIds);
    if (deleteChoicesError) {
      logInstructorFeaturesSupabaseError("stale choices delete", deleteChoicesError);
      return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    }

    const { error: deleteEntriesError } = await supabase
      .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
      .delete()
      .in("id", staleEntryIds)
      .eq("instructor_id", instructorId);
    if (deleteEntriesError) {
      logInstructorFeaturesSupabaseError("stale entries delete", deleteEntriesError);
      return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    }

    const staleEntryIdSet = new Set(staleEntryIds);
    workingEntries = workingEntries.filter((entry) => !staleEntryIdSet.has(entry.id));
  }

  const findEntry = (featureId: number) =>
    workingEntries.find((e) => e.feature_definition_id === featureId);

  const persistableDefinitions = definitions.filter((feature) => shouldPersist(feature.id));

  const clearEntryChoices = async (entryId: number) => {
    const { error } = await supabase
      .from(INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE)
      .delete()
      .eq("instructor_feature_entry_id", entryId);
    if (error) throw error;
  };

  const deleteEntry = async (entryId: number) => {
    await clearEntryChoices(entryId);
    const { error } = await supabase
      .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
      .delete()
      .eq("id", entryId)
      .eq("instructor_id", instructorId);
    if (error) throw error;
    workingEntries = workingEntries.filter((entry) => entry.id !== entryId);
  };

  for (const feature of persistableDefinitions.filter((f) => f.input_type === "boolean")) {
    const value = form.booleanValues[feature.id] === true;
    const existing = findEntry(feature.id);
    if (!value) {
      if (existing) {
        try {
          await deleteEntry(existing.id);
        } catch (error) {
          logInstructorFeaturesSupabaseError("boolean delete", error);
          return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
        }
      }
      continue;
    }
    if (existing) {
      const { error } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
        .update({ boolean_answer: true })
        .eq("id", existing.id)
        .eq("instructor_id", instructorId);
      if (error) {
        logInstructorFeaturesSupabaseError("boolean update", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    } else {
      const { error } = await supabase.from(INSTRUCTOR_FEATURE_ENTRIES_TABLE).insert({
        instructor_id: instructorId,
        feature_definition_id: feature.id,
        boolean_answer: true,
      });
      if (error) {
        logInstructorFeaturesSupabaseError("boolean insert", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    }
  }

  for (const feature of persistableDefinitions.filter((f) => f.input_type === "text")) {
    const raw = (form.textValues[feature.id] ?? "").trim();
    const value =
      raw && isInstructorTimeTextFeature(feature) ? (parseValidTimeHHMM(raw) ?? "") : raw;
    const existing = findEntry(feature.id);
    if (!value) {
      if (existing) {
        try {
          await deleteEntry(existing.id);
        } catch (error) {
          logInstructorFeaturesSupabaseError("text delete", error);
          return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
        }
      }
      continue;
    }
    if (existing) {
      const { error } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
        .update({ text_answer: value })
        .eq("id", existing.id)
        .eq("instructor_id", instructorId);
      if (error) {
        logInstructorFeaturesSupabaseError("text update", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    } else {
      const { error } = await supabase.from(INSTRUCTOR_FEATURE_ENTRIES_TABLE).insert({
        instructor_id: instructorId,
        feature_definition_id: feature.id,
        text_answer: value,
      });
      if (error) {
        logInstructorFeaturesSupabaseError("text insert", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    }
  }

  for (const feature of persistableDefinitions.filter((f) => f.input_type === "number")) {
    const raw = (form.numberValues[feature.id] ?? "").trim();
    const existing = findEntry(feature.id);
    if (!raw) {
      if (existing) {
        try {
          await deleteEntry(existing.id);
        } catch (error) {
          logInstructorFeaturesSupabaseError("number delete", error);
          return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
        }
      }
      continue;
    }
    let parsed: number;
    if (isStudentAgeRangeNumberFeature(feature)) {
      const ageParsed = parseStudentAgeDecimalInput(raw);
      if (ageParsed.kind !== "ok") continue;
      parsed = ageParsed.value;
    } else {
      parsed = Number(raw);
      if (!Number.isFinite(parsed)) continue;
    }
    if (existing) {
      const { error } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
        .update({ number_answer: parsed })
        .eq("id", existing.id)
        .eq("instructor_id", instructorId);
      if (error) {
        logInstructorFeaturesSupabaseError("number update", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    } else {
      const { error } = await supabase.from(INSTRUCTOR_FEATURE_ENTRIES_TABLE).insert({
        instructor_id: instructorId,
        feature_definition_id: feature.id,
        number_answer: parsed,
      });
      if (error) {
        logInstructorFeaturesSupabaseError("number insert", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    }
  }

  for (const feature of persistableDefinitions.filter((f) => f.input_type === "date")) {
    const value = (form.dateValues[feature.id] ?? "").trim();
    const existing = findEntry(feature.id);
    if (!value) {
      if (existing) {
        try {
          await deleteEntry(existing.id);
        } catch (error) {
          logInstructorFeaturesSupabaseError("date delete", error);
          return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
        }
      }
      continue;
    }
    if (existing) {
      const { error } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
        .update({ text_answer: value })
        .eq("id", existing.id)
        .eq("instructor_id", instructorId);
      if (error) {
        logInstructorFeaturesSupabaseError("date update", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    } else {
      const { error } = await supabase.from(INSTRUCTOR_FEATURE_ENTRIES_TABLE).insert({
        instructor_id: instructorId,
        feature_definition_id: feature.id,
        text_answer: value,
      });
      if (error) {
        logInstructorFeaturesSupabaseError("date insert", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    }
  }

  for (const feature of persistableDefinitions.filter((f) => f.input_type === "single_select")) {
    const raw = (form.singleSelectValues[feature.id] ?? "").trim();
    const selectedChoiceId = raw ? Number(raw) : Number.NaN;
    const hasValidChoice = Number.isFinite(selectedChoiceId) && selectedChoiceId > 0;
    let existing = findEntry(feature.id);

    if (!hasValidChoice) {
      if (existing) {
        try {
          await deleteEntry(existing.id);
        } catch (error) {
          logInstructorFeaturesSupabaseError("single_select delete", error);
          return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
        }
      }
      continue;
    }

    if (existing) {
      try {
        await clearEntryChoices(existing.id);
      } catch (error) {
        logInstructorFeaturesSupabaseError("single_select clear choices", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
      const { error } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
        .update({ selected_choice_id: selectedChoiceId })
        .eq("id", existing.id)
        .eq("instructor_id", instructorId);
      if (error) {
        logInstructorFeaturesSupabaseError("single_select update", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    } else {
      const { error } = await supabase.from(INSTRUCTOR_FEATURE_ENTRIES_TABLE).insert({
        instructor_id: instructorId,
        feature_definition_id: feature.id,
        selected_choice_id: selectedChoiceId,
      });
      if (error) {
        logInstructorFeaturesSupabaseError("single_select insert", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    }
  }

  for (const feature of persistableDefinitions.filter((f) => f.input_type === "multi_select")) {
    const uiSelectedIds = form.multiSelectValues[feature.id] ?? [];
    const selectedIds = Array.from(
      new Set(
        uiSelectedIds
          .map((choiceId) => Number(String(choiceId).trim()))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );
    let existing = findEntry(feature.id);

    if (selectedIds.length === 0) {
      if (existing) {
        try {
          await deleteEntry(existing.id);
        } catch (error) {
          logInstructorFeaturesSupabaseError("multi_select delete", error);
          return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
        }
      }
      continue;
    }

    if (!existing) {
      const { data: inserted, error: insertError } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
        .insert({
          instructor_id: instructorId,
          feature_definition_id: feature.id,
          selected_choice_id: null,
        })
        .select("id")
        .single();
      if (insertError || !inserted) {
        logInstructorFeaturesSupabaseError("multi_select insert entry", insertError);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
      existing = {
        id: inserted.id as number,
        instructor_id: instructorId,
        feature_definition_id: feature.id,
        text_answer: null,
        number_answer: null,
        boolean_answer: null,
        selected_choice_id: null,
      };
    } else {
      try {
        await clearEntryChoices(existing.id);
      } catch (error) {
        logInstructorFeaturesSupabaseError("multi_select clear choices", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
      const { error: updateError } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
        .update({ selected_choice_id: null })
        .eq("id", existing.id)
        .eq("instructor_id", instructorId);
      if (updateError) {
        logInstructorFeaturesSupabaseError("multi_select update entry", updateError);
      return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    }

    const rows = selectedIds.map((choiceId) => ({
      instructor_feature_entry_id: existing!.id,
      choice_id: choiceId,
    }));
      const { error: insertChoicesError } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE)
        .insert(rows);
      if (insertChoicesError) {
      logInstructorFeaturesSupabaseError("multi_select insert choices", insertChoicesError);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
  }

  const legacySyncPatch = buildInstructorDirectFeatureUpdatePayload(
    definitions,
    choices,
    form,
    featureIdsToSave,
  );
  if (Object.keys(legacySyncPatch).length > 0) {
    const { error: legacySyncError } = await supabase
      .from(INSTRUCTORS_TABLE)
      .update(legacySyncPatch)
      .eq("id", instructorId)
      .eq("owner_auth_id", authUid);

    if (legacySyncError) {
      logInstructorFeaturesSupabaseError("legacy sync", legacySyncError);
      return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    }
  }

  return { error: null };
}
