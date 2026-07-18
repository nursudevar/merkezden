import type { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  parsePriceRangeFromText,
  rangesOverlap,
} from "@/lib/institutionPriceRangeFilter";

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

/** institution_feature_definitions.id — Öğrenci Yaşı */
export const INSTITUTION_STUDENT_AGE_DEFINITION_ID = 101;

/** instructor_feature_definitions.id — Öğrenci Yaşı */
export const INSTRUCTOR_STUDENT_AGE_DEFINITION_ID = 4;

/** Slider / input sınırları */
export const STUDENT_AGE_FILTER_MIN = 1;
export const STUDENT_AGE_FILTER_MAX = 99;

/** Tam genişliğe yayılan tick noktaları (sıkışmayı önler) */
export const STUDENT_AGE_RANGE_TICKS = [1, 10, 18, 40, 70, 99] as const;

export type StudentAgeChoice = {
  id: number;
  name: string;
  display_order: number | null;
};

export type StudentAgeRangeValue = {
  min: number;
  max: number;
} | null;

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

export function isStudentAgeDefinition(row: {
  id?: number | null;
  name?: string | null;
  slug?: string | null;
}): boolean {
  const id = Number(row.id);
  if (id === INSTITUTION_STUDENT_AGE_DEFINITION_ID || id === INSTRUCTOR_STUDENT_AGE_DEFINITION_ID) {
    return true;
  }
  const t = normalizeFeatureKey(`${row.slug ?? ""} ${row.name ?? ""}`);
  return (
    t.includes("ogrenci yasi") ||
    t.includes("ogrenci_yasi") ||
    t.includes("yas araligi") ||
    t === "yas" ||
    t.endsWith(" yas") ||
    t.startsWith("yas ")
  );
}

export function isInstitutionStudentAgeDefinition(row: {
  id?: number | null;
  name?: string | null;
  slug?: string | null;
}): boolean {
  return isStudentAgeDefinition(row);
}

export function isStudentAgeFieldName(name: string): boolean {
  return isStudentAgeDefinition({ name });
}

/** Sayısal yaş aralığı olmayan özel seçenekler (checkbox olarak kalır). */
export function isStudentAgeSpecialChoice(name: string): boolean {
  const t = normalizeFeatureKey(name);
  if (!t) return false;
  if (t.includes("mezun") || t.includes("sinava hazirlik")) return true;
  if (t.includes("ozel gereksinim")) return true;
  return false;
}

/**
 * Choice etiketini sayısal yaş aralığına çevirir.
 * "18+" → { min: 18, max: Infinity }; özel etiketler → null.
 */
export function parseStudentAgeRangeFromText(raw: string): { min: number; max: number } | null {
  if (isStudentAgeSpecialChoice(raw)) return null;
  const parsed = parsePriceRangeFromText(raw);
  if (!parsed) return null;
  // Yaş için 0–0 veya anlamsız tekil fiyat benzeri sonuçları ele: en az bir sayı yaş aralığında olmalı
  if (!Number.isFinite(parsed.min) && !Number.isFinite(parsed.max)) return null;
  return parsed;
}

export function formatStudentAgeFilterValue(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return String(safe);
}

/** Özel seçenek etiketlerini filterde kısa göster */
export function getStudentAgeSpecialDisplayName(name: string): string {
  const raw = String(name ?? "").trim();
  const key = normalizeFeatureKey(raw);
  if (key.includes("mezun") || key.includes("sinava hazirlik")) return "Mezun / Sınav";
  if (key.includes("ozel gereksinim")) return "Özel Gereksinimli";
  return raw;
}

export function normalizeStudentAgeUserRange(input: {
  min?: number | null;
  max?: number | null;
}): { min: number; max: number } | null {
  const hasMin = input.min != null && Number.isFinite(Number(input.min));
  const hasMax = input.max != null && Number.isFinite(Number(input.max));
  if (!hasMin && !hasMax) return null;
  const min = hasMin ? Number(input.min) : STUDENT_AGE_FILTER_MIN;
  const max = hasMax ? Number(input.max) : STUDENT_AGE_FILTER_MAX;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (lo <= STUDENT_AGE_FILTER_MIN && hi >= STUDENT_AGE_FILTER_MAX) return null;
  return { min: lo, max: hi };
}

export function splitStudentAgeChoices(choices: StudentAgeChoice[]): {
  numeric: Array<StudentAgeChoice & { range: { min: number; max: number } }>;
  special: StudentAgeChoice[];
} {
  const numeric: Array<StudentAgeChoice & { range: { min: number; max: number } }> = [];
  const special: StudentAgeChoice[] = [];
  for (const choice of choices) {
    const range = parseStudentAgeRangeFromText(choice.name);
    if (range) {
      numeric.push({ ...choice, range });
    } else if (isStudentAgeSpecialChoice(choice.name) || !/\d/.test(choice.name)) {
      special.push(choice);
    } else {
      special.push(choice);
    }
  }
  return { numeric, special };
}

async function fetchChoicesForDefinition(
  supabase: SupabaseBrowser,
  table: "institution_feature_choices" | "instructor_feature_choices",
  definitionId: number
): Promise<StudentAgeChoice[]> {
  const { data, error } = await supabase
    .from(table)
    .select("id, feature_definition_id, name, display_order, is_active")
    .eq("feature_definition_id", definitionId)
    .eq("is_active", true)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as Array<{
    id: number;
    name?: string | null;
    display_order?: number | null;
  }>)
    .map((c) => ({
      id: Number(c.id),
      name: String(c.name ?? "").trim(),
      display_order: c.display_order ?? null,
    }))
    .filter((c) => Number.isFinite(c.id) && c.name.length > 0)
    .sort((a, b) => {
      const orderA = Number.isFinite(Number(a.display_order))
        ? Number(a.display_order)
        : Number.MAX_SAFE_INTEGER;
      const orderB = Number.isFinite(Number(b.display_order))
        ? Number(b.display_order)
        : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.id - b.id;
    });
}

async function resolveActiveStudentAgeDefinitionId(
  supabase: SupabaseBrowser,
  table: "institution_feature_definitions" | "instructor_feature_definitions",
  preferredId: number
): Promise<number | null> {
  const { data: byId, error: byIdErr } = await supabase
    .from(table)
    .select("id, name, slug, is_active")
    .eq("id", preferredId)
    .eq("is_active", true)
    .maybeSingle();
  if (byIdErr) throw byIdErr;
  if (byId && Number.isFinite(Number((byId as { id: number }).id))) {
    return Number((byId as { id: number }).id);
  }

  const { data: defs, error } = await supabase
    .from(table)
    .select("id, name, slug")
    .eq("is_active", true);
  if (error) throw error;
  const match = ((defs ?? []) as Array<{ id: number; name?: string | null; slug?: string | null }>).find(
    (d) => Number.isFinite(d.id) && isStudentAgeDefinition(d)
  );
  return match?.id ?? null;
}

export async function fetchInstitutionStudentAgeChoices(
  supabase: SupabaseBrowser
): Promise<StudentAgeChoice[]> {
  const definitionId = await resolveActiveStudentAgeDefinitionId(
    supabase,
    "institution_feature_definitions",
    INSTITUTION_STUDENT_AGE_DEFINITION_ID
  );
  if (definitionId == null) return [];
  return fetchChoicesForDefinition(supabase, "institution_feature_choices", definitionId);
}

export async function fetchInstructorStudentAgeChoices(
  supabase: SupabaseBrowser
): Promise<StudentAgeChoice[]> {
  const definitionId = await resolveActiveStudentAgeDefinitionId(
    supabase,
    "instructor_feature_definitions",
    INSTRUCTOR_STUDENT_AGE_DEFINITION_ID
  );
  if (definitionId == null) return [];
  return fetchChoicesForDefinition(supabase, "instructor_feature_choices", definitionId);
}

type EntityResolveConfig = {
  definitionsTable: "institution_feature_definitions" | "instructor_feature_definitions";
  choicesTable: "institution_feature_choices" | "instructor_feature_choices";
  entriesTable: "institution_feature_entries" | "instructor_feature_entries";
  entryChoicesTable: "institution_feature_entry_choices" | "instructor_feature_entry_choices";
  entryIdColumn: "institution_feature_entry_id" | "instructor_feature_entry_id";
  entityIdColumn: "institution_id" | "instructor_id";
  preferredDefinitionId: number;
};

async function resolveEntityIdsByStudentAgeFilter(
  supabase: SupabaseBrowser,
  config: EntityResolveConfig,
  params: {
    userRange?: { min: number; max: number } | null;
    specialChoiceIds?: number[];
    specialChoiceNames?: string[];
  }
): Promise<number[]> {
  const userRange = params.userRange
    ? normalizeStudentAgeUserRange(params.userRange)
    : null;
  const specialIds = Array.from(
    new Set((params.specialChoiceIds ?? []).map(Number).filter((id) => Number.isFinite(id)))
  );
  const specialNames = new Set(
    (params.specialChoiceNames ?? [])
      .map((n) => normalizeFeatureKey(String(n ?? "")))
      .filter(Boolean)
  );
  if (!userRange && specialIds.length === 0 && specialNames.size === 0) return [];

  const definitionId = await resolveActiveStudentAgeDefinitionId(
    supabase,
    config.definitionsTable,
    config.preferredDefinitionId
  );
  if (definitionId == null) return [];

  const choices = await fetchChoicesForDefinition(supabase, config.choicesTable, definitionId);
  const { numeric, special } = splitStudentAgeChoices(choices);

  const matchingChoiceIds = new Set<number>();
  if (userRange) {
    for (const choice of numeric) {
      if (rangesOverlap(choice.range, userRange)) {
        matchingChoiceIds.add(choice.id);
      }
    }
  }
  for (const id of specialIds) matchingChoiceIds.add(id);
  if (specialNames.size > 0) {
    for (const choice of special) {
      if (specialNames.has(normalizeFeatureKey(choice.name))) {
        matchingChoiceIds.add(choice.id);
      }
    }
  }
  if (matchingChoiceIds.size === 0) return [];

  const targetChoiceIds = Array.from(matchingChoiceIds);

  const { data: entriesRaw, error: entriesErr } = await supabase
    .from(config.entriesTable)
    .select(`id, ${config.entityIdColumn}`)
    .eq("feature_definition_id", definitionId);
  if (entriesErr) throw entriesErr;

  const entries = (entriesRaw ?? []) as Array<Record<string, number>>;
  const entryIds = entries.map((e) => Number(e.id)).filter((id) => Number.isFinite(id));
  const entryToEntity = new Map<number, number>();
  for (const e of entries) {
    const eid = Number(e.id);
    const entityId = Number(e[config.entityIdColumn]);
    if (Number.isFinite(eid) && Number.isFinite(entityId)) {
      entryToEntity.set(eid, entityId);
    }
  }
  if (entryIds.length === 0) return [];

  const { data: links, error: linksErr } = await supabase
    .from(config.entryChoicesTable)
    .select(`${config.entryIdColumn}, choice_id`)
    .in(config.entryIdColumn, entryIds)
    .in("choice_id", targetChoiceIds);
  if (linksErr) throw linksErr;

  const idSet = new Set<number>();
  for (const row of (links ?? []) as Array<Record<string, number>>) {
    const choiceId = Number(row.choice_id);
    if (!matchingChoiceIds.has(choiceId)) continue;
    const entityId = entryToEntity.get(Number(row[config.entryIdColumn]));
    if (Number.isFinite(entityId)) idSet.add(entityId!);
  }
  return Array.from(idSet);
}

export async function resolveInstitutionIdsByStudentAgeFilter(
  supabase: SupabaseBrowser,
  params: {
    userRange?: { min: number; max: number } | null;
    specialChoiceIds?: number[];
    specialChoiceNames?: string[];
  }
): Promise<number[]> {
  return resolveEntityIdsByStudentAgeFilter(
    supabase,
    {
      definitionsTable: "institution_feature_definitions",
      choicesTable: "institution_feature_choices",
      entriesTable: "institution_feature_entries",
      entryChoicesTable: "institution_feature_entry_choices",
      entryIdColumn: "institution_feature_entry_id",
      entityIdColumn: "institution_id",
      preferredDefinitionId: INSTITUTION_STUDENT_AGE_DEFINITION_ID,
    },
    params
  );
}

/** @deprecated Choice-id only filtre; kesişim mantığı için `resolveInstitutionIdsByStudentAgeFilter` kullanın. */
export async function resolveInstitutionIdsByStudentAgeChoiceIds(
  supabase: SupabaseBrowser,
  choiceIds: number[]
): Promise<number[]> {
  return resolveInstitutionIdsByStudentAgeFilter(supabase, {
    specialChoiceIds: choiceIds,
  });
}

export async function resolveInstructorIdsByStudentAgeFilter(
  supabase: SupabaseBrowser,
  params: {
    userRange?: { min: number; max: number } | null;
    specialChoiceIds?: number[];
    specialChoiceNames?: string[];
  }
): Promise<number[]> {
  return resolveEntityIdsByStudentAgeFilter(
    supabase,
    {
      definitionsTable: "instructor_feature_definitions",
      choicesTable: "instructor_feature_choices",
      entriesTable: "instructor_feature_entries",
      entryChoicesTable: "instructor_feature_entry_choices",
      entryIdColumn: "instructor_feature_entry_id",
      entityIdColumn: "instructor_id",
      preferredDefinitionId: INSTRUCTOR_STUDENT_AGE_DEFINITION_ID,
    },
    params
  );
}

export type InstitutionStudentAgeChoice = StudentAgeChoice;
