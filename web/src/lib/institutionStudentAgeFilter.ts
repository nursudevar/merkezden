import type { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  STUDENT_AGE_INPUT_MAX,
  STUDENT_AGE_INPUT_MIN,
  STUDENT_AGE_MAX_SLUG,
  STUDENT_AGE_MIN_SLUG,
  formatStudentAgeDisplay,
  isStudentAgeMaxFeature,
  isStudentAgeMinFeature,
  isStudentAgeRangeNumberFeature,
  parseStudentAgeDecimalNumber,
} from "@/lib/studentAgeRangeFeature";

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

/** Slider / input sınırları */
export const STUDENT_AGE_FILTER_MIN = STUDENT_AGE_INPUT_MIN;
export const STUDENT_AGE_FILTER_MAX = STUDENT_AGE_INPUT_MAX;

/** Tam genişliğe yayılan tick noktaları (sıkışmayı önler) */
export const STUDENT_AGE_RANGE_TICKS = [0.5, 1, 10, 18, 40, 70, 99] as const;

export type StudentAgeRangeValue = {
  min: number;
  max: number;
} | null;

/** Filtre sorgusu: min/max bağımsız; boş uç otomatik doldurulmaz. */
export type StudentAgeFilterQuery = {
  min: number | null;
  max: number | null;
};

/** Filtre UI ham metin durumu (sayıya yalnızca payload uygulamasında çevrilir). */
export type StudentAgeFilterTextPayload = {
  min: string;
  max: string;
};

export type StudentAgeStoredRange = {
  min: number;
  max: number;
};

function normalizeFeatureSlug(slug: string | null | undefined): string {
  return String(slug ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

/** Filtre input/gösterim: yuvarlama yok. */
export function formatStudentAgeFilterValue(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(value);
}

export { formatStudentAgeDisplay };

/**
 * Kullanıcı aralığını normalize eder (slider / tam aralık UI).
 * Tek uç girildiyse nokta sorgusu (min=max); eksik uç 0.5/99 ile doldurulmaz.
 */
export function normalizeStudentAgeUserRange(input: {
  min?: number | null;
  max?: number | null;
}): { min: number; max: number } | null {
  const hasMin = input.min != null && Number.isFinite(Number(input.min));
  const hasMax = input.max != null && Number.isFinite(Number(input.max));
  if (!hasMin && !hasMax) return null;

  let min: number;
  let max: number;
  if (hasMin && hasMax) {
    min = Number(input.min);
    max = Number(input.max);
  } else if (hasMin) {
    min = Number(input.min);
    max = min;
  } else {
    max = Number(input.max);
    min = max;
  }

  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (lo <= STUDENT_AGE_FILTER_MIN && hi >= STUDENT_AGE_FILTER_MAX) return null;
  return { min: lo, max: hi };
}

/** Payload string'lerinden filtre sorgusu; boş uçlar korunur. */
export function parseStudentAgeFilterQueryFromStrings(
  minRaw: string | null | undefined,
  maxRaw: string | null | undefined,
): StudentAgeFilterQuery | null {
  const minS = String(minRaw ?? "").trim();
  const maxS = String(maxRaw ?? "").trim();
  if (!minS && !maxS) return null;

  const min = minS ? parseStudentAgeDecimalNumber(minS) : null;
  const max = maxS ? parseStudentAgeDecimalNumber(maxS) : null;
  if (min == null && max == null) return null;
  return { min, max };
}

export function isStudentAgeFilterQueryActive(
  query: StudentAgeFilterQuery | null | undefined,
): boolean {
  if (!query) return false;
  return query.min != null || query.max != null;
}

export function isStudentAgeFilterTextActive(
  payload: StudentAgeFilterTextPayload | null | undefined,
): boolean {
  if (!payload) return false;
  return Boolean(String(payload.min ?? "").trim() || String(payload.max ?? "").trim());
}

/**
 * Payload uygulaması: `Number(value.replace(",", "."))`, parseInt yok.
 * Ara durum ("1.") → null.
 */
export function parseStudentAgeFilterNumber(raw: string): number | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed || /[.,]$/.test(trimmed)) return null;
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export function studentAgeFilterQueryFromTextPayload(
  payload: StudentAgeFilterTextPayload | null | undefined,
): StudentAgeFilterQuery | null {
  if (!payload) return null;
  return parseStudentAgeFilterQueryFromStrings(payload.min, payload.max);
}

/** Önce dedicated studentAgeRange, yoksa legacy commonRange/numberRange. */
export function resolveStudentAgeFilterFromPayload(
  payload:
    | {
        studentAgeRange?: StudentAgeFilterTextPayload | null;
        commonRange?: Record<number, { min?: string; max?: string } | undefined>;
        numberRange?: Record<number, { min?: string; max?: string } | undefined>;
      }
    | null
    | undefined,
  definitions?: Array<{ id: number; slug?: string | null }>,
): StudentAgeFilterQuery | null {
  const fromDedicated = studentAgeFilterQueryFromTextPayload(payload?.studentAgeRange);
  if (fromDedicated) return fromDedicated;

  const rangePayload = payload?.commonRange ?? payload?.numberRange;
  if (rangePayload && definitions) {
    return extractStudentAgeFilterQueryFromRangePayload(rangePayload, definitions);
  }
  return null;
}

/** Filtre payload string'lerinden slider değeri (tek uç → nokta sorgusu). */
export function parseStudentAgeFilterRangeFromStrings(
  minRaw: string | null | undefined,
  maxRaw: string | null | undefined,
): StudentAgeRangeValue {
  const query = parseStudentAgeFilterQueryFromStrings(minRaw, maxRaw);
  if (!query) return null;
  return normalizeStudentAgeUserRange(query);
}

export function studentAgeFilterQueryFromUserRange(
  userRange: StudentAgeRangeValue | { min?: number | null; max?: number | null } | null | undefined,
): StudentAgeFilterQuery | null {
  if (!userRange) return null;
  const min =
    userRange.min != null && Number.isFinite(Number(userRange.min))
      ? Number(userRange.min)
      : null;
  const max =
    userRange.max != null && Number.isFinite(Number(userRange.max))
      ? Number(userRange.max)
      : null;
  if (min == null && max == null) return null;
  return { min, max };
}

/**
 * Filtre kuralları (ondalık güvenli):
 * - yalnız min → selectedMin kurum aralığında
 * - yalnız max → selectedMax kurum aralığında
 * - ikisi → aralık kesişimi
 */
export function storedStudentAgeMatchesFilter(
  stored: { min: number; max: number },
  filter: StudentAgeFilterQuery,
): boolean {
  const storedMin = Math.min(stored.min, stored.max);
  const storedMax = Math.max(stored.min, stored.max);
  const selectedMin = filter.min;
  const selectedMax = filter.max;

  const hasMin = selectedMin != null && Number.isFinite(selectedMin);
  const hasMax = selectedMax != null && Number.isFinite(selectedMax);
  if (!hasMin && !hasMax) return false;

  if (hasMin && hasMax) {
    const lo = Math.min(selectedMin, selectedMax);
    const hi = Math.max(selectedMin, selectedMax);
    return studentAgeRangesIntersect({ min: storedMin, max: storedMax }, { min: lo, max: hi });
  }
  if (hasMin) {
    return storedMin <= selectedMin! && selectedMin! <= storedMax;
  }
  return storedMin <= selectedMax! && selectedMax! <= storedMax;
}

/** @deprecated storedStudentAgeMatchesFilter kullanın. */
export function storedStudentAgeRangeMatchesUserQuery(
  stored: { min: number; max: number },
  userQuery: { min?: number | null; max?: number | null } | null | undefined,
): boolean {
  const filter = studentAgeFilterQueryFromUserRange(userQuery);
  if (!filter) return false;
  return storedStudentAgeMatchesFilter(stored, filter);
}

/** storedMin <= selectedMax AND storedMax >= selectedMin (ondalık, yuvarlamasız) */
export function studentAgeRangesIntersect(
  stored: { min: number; max: number },
  selected: { min: number; max: number },
): boolean {
  return stored.min <= selected.max && stored.max >= selected.min;
}

export function parseStudentAgeNumberAnswer(value: unknown): number | null {
  return parseStudentAgeDecimalNumber(value);
}

/**
 * commonRange / numberRange payload içinden öğrenci yaşı aralığını çıkarır.
 * Min slug tanım id'si tercih edilir; yoksa max id veya slug eşleşen herhangi bir kayıt.
 */
export function extractStudentAgeFilterQueryFromRangePayload(
  rangePayload: Record<number, { min?: string; max?: string } | undefined>,
  definitions: Array<{ id: number; slug?: string | null }>,
): StudentAgeFilterQuery | null {
  const minDef = definitions.find((d) => isStudentAgeMinFeature(d));
  const maxDef = definitions.find((d) => isStudentAgeMaxFeature(d));
  const candidates = [minDef?.id, maxDef?.id].filter(
    (id): id is number => id != null && Number.isFinite(id),
  );

  for (const id of candidates) {
    const raw = rangePayload[id];
    if (!raw) continue;
    const parsed = parseStudentAgeFilterQueryFromStrings(raw.min, raw.max);
    if (parsed) return parsed;
  }

  return null;
}

/** @deprecated extractStudentAgeFilterQueryFromRangePayload kullanın. */
export function extractStudentAgeUserRangeFromRangePayload(
  rangePayload: Record<number, { min?: string; max?: string } | undefined>,
  definitions: Array<{ id: number; slug?: string | null }>,
): StudentAgeRangeValue {
  const query = extractStudentAgeFilterQueryFromRangePayload(rangePayload, definitions);
  if (!query) return null;
  return normalizeStudentAgeUserRange(query);
}

export function isStudentAgeFilterDefinitionId(
  definitionId: number,
  definitions: Array<{ id: number; slug?: string | null }>,
): boolean {
  const def = definitions.find((d) => d.id === definitionId);
  return def ? isStudentAgeRangeNumberFeature(def) : false;
}

async function resolveStudentAgeDefinitionIds(
  supabase: SupabaseBrowser,
  table: "institution_feature_definitions" | "instructor_feature_definitions",
): Promise<{ minId: number | null; maxId: number | null }> {
  const { data, error } = await supabase
    .from(table)
    .select("id, slug, is_active")
    .eq("is_active", true)
    .in("slug", [STUDENT_AGE_MIN_SLUG, STUDENT_AGE_MAX_SLUG]);
  if (error) throw error;

  let minId: number | null = null;
  let maxId: number | null = null;
  for (const row of (data ?? []) as Array<{ id: number; slug?: string | null }>) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    const slug = normalizeFeatureSlug(row.slug);
    if (slug === STUDENT_AGE_MIN_SLUG) minId = id;
    if (slug === STUDENT_AGE_MAX_SLUG) maxId = id;
  }
  return { minId, maxId };
}

type EntityResolveConfig = {
  definitionsTable: "institution_feature_definitions" | "instructor_feature_definitions";
  entriesTable: "institution_feature_entries" | "instructor_feature_entries";
  entityIdColumn: "institution_id" | "instructor_id";
};

async function resolveEntityIdsByStudentAgeNumberRange(
  supabase: SupabaseBrowser,
  config: EntityResolveConfig,
  userFilter: StudentAgeFilterQuery | null | undefined,
): Promise<number[]> {
  if (!userFilter || !isStudentAgeFilterQueryActive(userFilter)) return [];

  const { minId, maxId } = await resolveStudentAgeDefinitionIds(supabase, config.definitionsTable);
  if (minId == null || maxId == null) return [];

  const { data: entriesRaw, error: entriesErr } = await supabase
    .from(config.entriesTable)
    .select(`id, ${config.entityIdColumn}, feature_definition_id, number_answer`)
    .in("feature_definition_id", [minId, maxId]);
  if (entriesErr) throw entriesErr;

  const byEntity = new Map<number, { min?: number; max?: number }>();
  for (const row of (entriesRaw ?? []) as Array<Record<string, unknown>>) {
    const entityId = Number(row[config.entityIdColumn]);
    const defId = Number(row.feature_definition_id);
    const answer = parseStudentAgeNumberAnswer(row.number_answer);
    if (!Number.isFinite(entityId) || answer == null) continue;
    const current = byEntity.get(entityId) ?? {};
    if (defId === minId) current.min = answer;
    if (defId === maxId) current.max = answer;
    byEntity.set(entityId, current);
  }

  const matched: number[] = [];
  for (const [entityId, range] of byEntity.entries()) {
    if (range.min == null || range.max == null) continue;
    const storedMin = Math.min(range.min, range.max);
    const storedMax = Math.max(range.min, range.max);
    if (storedStudentAgeMatchesFilter({ min: storedMin, max: storedMax }, userFilter)) {
      matched.push(entityId);
    }
  }
  return matched;
}

export async function resolveInstitutionIdsByStudentAgeFilter(
  supabase: SupabaseBrowser,
  params: {
    userFilter?: StudentAgeFilterQuery | null;
    /** @deprecated use userFilter */
    userRange?: { min: number; max: number } | null;
    /** @deprecated Eski choice tabanlı filtre kaldırıldı; yok sayılır. */
    specialChoiceIds?: number[];
    /** @deprecated Eski choice tabanlı filtre kaldırıldı; yok sayılır. */
    specialChoiceNames?: string[];
  },
): Promise<number[]> {
  const userFilter =
    params.userFilter ?? studentAgeFilterQueryFromUserRange(params.userRange);
  return resolveEntityIdsByStudentAgeNumberRange(
    supabase,
    {
      definitionsTable: "institution_feature_definitions",
      entriesTable: "institution_feature_entries",
      entityIdColumn: "institution_id",
    },
    userFilter,
  );
}

export async function resolveInstructorIdsByStudentAgeFilter(
  supabase: SupabaseBrowser,
  params: {
    userFilter?: StudentAgeFilterQuery | null;
    /** @deprecated use userFilter */
    userRange?: { min: number; max: number } | null;
    /** @deprecated Eski choice tabanlı filtre kaldırıldı; yok sayılır. */
    specialChoiceIds?: number[];
    /** @deprecated Eski choice tabanlı filtre kaldırıldı; yok sayılır. */
    specialChoiceNames?: string[];
  },
): Promise<number[]> {
  const userFilter =
    params.userFilter ?? studentAgeFilterQueryFromUserRange(params.userRange);
  return resolveEntityIdsByStudentAgeNumberRange(
    supabase,
    {
      definitionsTable: "instructor_feature_definitions",
      entriesTable: "instructor_feature_entries",
      entityIdColumn: "instructor_id",
    },
    userFilter,
  );
}

/** @deprecated Choice-id filtre kaldırıldı. */
export async function resolveInstitutionIdsByStudentAgeChoiceIds(
  _supabase: SupabaseBrowser,
  _choiceIds: number[],
): Promise<number[]> {
  return [];
}
