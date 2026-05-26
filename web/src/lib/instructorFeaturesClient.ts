"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { INSTRUCTORS_TABLE, type InstructorProfileRow } from "@/lib/instructorProfileClient";
import { institutionTimeToInputHHMM } from "@/lib/institutionWorkingHours";

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
  is_active: boolean;
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

export function isSchoolHoursInstructorFeature(feature: InstructorFeatureDefinitionRow): boolean {
  return (feature.name ?? "").trim().toLocaleLowerCase("tr-TR") === "okul saatleri";
}

type DirectInstructorFeatureKey =
  | "lesson_type"
  | "service_type"
  | "education_level"
  | "price_range"
  | "working_hours";

type DirectInstructorFeaturePatch = {
  lesson_type?: string | null;
  service_type?: string | null;
  education_level?: string | null;
  price_range?: string | null;
  working_hours_start?: string | null;
  working_hours_end?: string | null;
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

  if (candidates.some((key) => key.includes("price_range") || key === "fiyat_araligi")) {
    return "price_range";
  }
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

  if (feature.input_type === "single_select" || isSchoolHoursInstructorFeature(feature)) {
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
    "lesson_type" | "service_type" | "education_level" | "price_range" | "working_hours_start" | "working_hours_end"
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
    price_range: String(instructorRow.price_range ?? "").trim(),
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
    } else if (feature.input_type === "single_select" || isSchoolHoursInstructorFeature(feature)) {
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
    .from("institution_categories")
    .select("id, name, slug, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

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
      .from("institution_feature_groups")
      .select("id, name, slug, display_order, is_active, category_slug")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("institution_feature_definitions")
      .select("id, group_id, name, slug, input_type, help_text, display_order, is_active")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("institution_feature_choices")
      .select("id, feature_definition_id, name, is_active")
      .eq("is_active", true)
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

export function buildInstructorFeatureFormStateFromEntries(
  definitions: InstructorFeatureDefinitionRow[],
  entries: InstructorFeatureEntryRow[],
  entryChoices: InstructorFeatureEntryChoiceRow[],
): InstructorFeatureFormState {
  const entriesByFeatureId = new Map<number, InstructorFeatureEntryRow>();
  entries.forEach((entry) => entriesByFeatureId.set(entry.feature_definition_id, entry));

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
      booleanValues[feature.id] = Boolean(entry?.boolean_answer);
    } else if (feature.input_type === "text") {
      textValues[feature.id] = entry?.text_answer ?? "";
    } else if (feature.input_type === "number") {
      numberValues[feature.id] =
        typeof entry?.number_answer === "number" ? String(entry.number_answer) : "";
    } else if (feature.input_type === "date") {
      dateValues[feature.id] = entry?.text_answer ? String(entry.text_answer).slice(0, 10) : "";
    } else if (feature.input_type === "single_select" || isSchoolHoursInstructorFeature(feature)) {
      singleSelectValues[feature.id] =
        typeof entry?.selected_choice_id === "number" ? String(entry.selected_choice_id) : "";
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

export type SaveInstructorFeaturesParams = {
  authUid: string;
  instructorId: number;
  categoryId: number;
  definitions: InstructorFeatureDefinitionRow[];
  choices: InstructorFeatureChoiceRow[];
  entries: InstructorFeatureEntryRow[];
  form: InstructorFeatureFormState;
  featureIdsToSave: number[];
};

export async function saveInstructorFeaturesClient(
  params: SaveInstructorFeaturesParams,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ error: string | null }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const {
    authUid,
    instructorId,
    categoryId,
    definitions,
    choices,
    entries,
    form,
    featureIdsToSave,
  } = params;

  const saveSet = new Set(featureIdsToSave);
  const shouldPersist = (featureId: number) => saveSet.has(featureId);
  const directInstructorPatch = buildInstructorDirectFeatureUpdatePayload(
    definitions,
    choices,
    form,
    featureIdsToSave,
  );

  const { error: categoryError } = await supabase
    .from(INSTRUCTORS_TABLE)
    .update({ category_id: categoryId, ...directInstructorPatch })
    .eq("id", instructorId)
    .eq("owner_auth_id", authUid);

  if (categoryError) {
    logInstructorFeaturesSupabaseError("category save", categoryError);
    return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
  }

  const { data: realDefinitionsData, error: realDefinitionsError } = await supabase
    .from("instructor_feature_definitions")
    .select("id, name, slug, input_type");

  if (realDefinitionsError) {
    logInstructorFeaturesSupabaseError("real definitions load", realDefinitionsError);
    return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
  }

  const realDefinitions = ((realDefinitionsData ?? []) as Array<{
    id: number;
    name: string | null;
    slug: string | null;
    input_type: string | null;
  }>).filter((row) => Number.isFinite(Number(row.id)));

  if (realDefinitions.length === 0) {
    console.warn(
      "[instructor-features] instructor_feature_definitions tablosu boş; feature_entries kaydı atlanıyor.",
    );
    return { error: null };
  }

  const { data: realChoicesData, error: realChoicesError } = await supabase
    .from("instructor_feature_choices")
    .select("id, feature_definition_id, name, is_active")
    .in(
      "feature_definition_id",
      realDefinitions.map((row) => Number(row.id)),
    );

  if (realChoicesError) {
    logInstructorFeaturesSupabaseError("real choices load", realChoicesError);
    return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
  }

  const realChoices = ((realChoicesData ?? []) as InstructorFeatureChoiceRow[]).filter((row) => row.is_active);

  const realDefinitionByNormalizedKey = new Map<string, (typeof realDefinitions)[number]>();
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

    console.warn("[instructor-features] gerçek feature_definition_id bulunamadı, atlanıyor:", {
      featureId: feature.id,
      slug: feature.slug ?? "",
      name: feature.name,
    });
    return null;
  };

  const uiFeatureIdToRealDefinition = new Map<number, (typeof realDefinitions)[number]>();
  definitions.forEach((feature) => {
    const directKey = resolveDirectInstructorFeatureKey(feature);
    if (directKey) return;
    const resolved = resolveRealDefinition(feature);
    if (resolved) uiFeatureIdToRealDefinition.set(feature.id, resolved);
  });

  const realChoiceIdByUiFeatureIdAndChoiceId = new Map<string, number>();
  for (const feature of definitions) {
    const realDefinition = uiFeatureIdToRealDefinition.get(feature.id);
    if (!realDefinition) continue;

    const uiChoices = choices.filter(
      (choice) => choice.feature_definition_id === feature.id && choice.is_active,
    );
    const candidateRealChoices = realChoices.filter(
      (choice) => choice.feature_definition_id === Number(realDefinition.id),
    );

    for (const uiChoice of uiChoices) {
      const uiChoiceKey = normalizeInstructorFeatureText(String(uiChoice.name ?? ""));
      if (!uiChoiceKey) continue;
      const realChoice = candidateRealChoices.find(
        (choice) => normalizeInstructorFeatureText(String(choice.name ?? "")) === uiChoiceKey,
      );
      if (realChoice) {
        realChoiceIdByUiFeatureIdAndChoiceId.set(`${feature.id}:${uiChoice.id}`, Number(realChoice.id));
      }
    }
  }

  const findEntry = (uiFeatureId: number) => {
    const realDefinition = uiFeatureIdToRealDefinition.get(uiFeatureId);
    if (!realDefinition) return undefined;
    return entries.find((e) => e.feature_definition_id === Number(realDefinition.id));
  };

  const persistableDefinitions = definitions.filter(
    (feature) =>
      shouldPersist(feature.id) &&
      !resolveDirectInstructorFeatureKey(feature) &&
      uiFeatureIdToRealDefinition.has(feature.id),
  );

  for (const feature of persistableDefinitions.filter((f) => f.input_type === "boolean")) {
    const realDefinition = uiFeatureIdToRealDefinition.get(feature.id);
    if (!realDefinition) continue;
    const value = Boolean(form.booleanValues[feature.id]);
    const existing = findEntry(feature.id);
    if (existing) {
      const { error } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
        .update({ boolean_answer: value })
        .eq("id", existing.id)
        .eq("instructor_id", instructorId);
      if (error) {
        logInstructorFeaturesSupabaseError("boolean update", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    } else {
      const { error } = await supabase.from(INSTRUCTOR_FEATURE_ENTRIES_TABLE).insert({
        instructor_id: instructorId,
        feature_definition_id: Number(realDefinition.id),
        boolean_answer: value,
      });
      if (error) {
        logInstructorFeaturesSupabaseError("boolean insert", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    }
  }

  for (const feature of persistableDefinitions.filter((f) => f.input_type === "text")) {
    const realDefinition = uiFeatureIdToRealDefinition.get(feature.id);
    if (!realDefinition) continue;
    const value = (form.textValues[feature.id] ?? "").trim();
    const existing = findEntry(feature.id);
    if (!value) {
      if (existing) {
        const { error } = await supabase
          .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
          .delete()
          .eq("id", existing.id)
          .eq("instructor_id", instructorId);
        if (error) {
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
        feature_definition_id: Number(realDefinition.id),
        text_answer: value,
      });
      if (error) {
        logInstructorFeaturesSupabaseError("text insert", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    }
  }

  for (const feature of persistableDefinitions.filter((f) => f.input_type === "number")) {
    const realDefinition = uiFeatureIdToRealDefinition.get(feature.id);
    if (!realDefinition) continue;
    const raw = (form.numberValues[feature.id] ?? "").trim();
    const existing = findEntry(feature.id);
    if (!raw) {
      if (existing) {
        const { error } = await supabase
          .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
          .delete()
          .eq("id", existing.id)
          .eq("instructor_id", instructorId);
        if (error) {
          logInstructorFeaturesSupabaseError("number delete", error);
          return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
        }
      }
      continue;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) continue;
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
        feature_definition_id: Number(realDefinition.id),
        number_answer: parsed,
      });
      if (error) {
        logInstructorFeaturesSupabaseError("number insert", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    }
  }

  for (const feature of persistableDefinitions.filter((f) => f.input_type === "date")) {
    const realDefinition = uiFeatureIdToRealDefinition.get(feature.id);
    if (!realDefinition) continue;
    const value = (form.dateValues[feature.id] ?? "").trim();
    const existing = findEntry(feature.id);
    if (!value) {
      if (existing) {
        const { error } = await supabase
          .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
          .delete()
          .eq("id", existing.id)
          .eq("instructor_id", instructorId);
        if (error) {
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
        feature_definition_id: Number(realDefinition.id),
        text_answer: value,
      });
      if (error) {
        logInstructorFeaturesSupabaseError("date insert", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    }
  }

  const singleSelectFeatures = persistableDefinitions.filter(
    (f) => f.input_type === "single_select" || isSchoolHoursInstructorFeature(f),
  );

  for (const feature of singleSelectFeatures) {
    const realDefinition = uiFeatureIdToRealDefinition.get(feature.id);
    if (!realDefinition) continue;
    const raw = (form.singleSelectValues[feature.id] ?? "").trim();
    const existing = findEntry(feature.id);
    if (!raw) {
      if (existing) {
        const { error } = await supabase
          .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
          .delete()
          .eq("id", existing.id)
          .eq("instructor_id", instructorId);
        if (error) {
          logInstructorFeaturesSupabaseError("single select delete", error);
          return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
        }
      }
      continue;
    }
    const choiceId = realChoiceIdByUiFeatureIdAndChoiceId.get(`${feature.id}:${raw}`);
    if (!Number.isFinite(choiceId)) {
      console.warn("[instructor-features] gerçek single_select choice id bulunamadı, atlanıyor:", {
        featureId: feature.id,
        selectedChoiceId: raw,
        featureName: feature.name,
      });
      continue;
    }
    if (existing) {
      const { error } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
        .update({ selected_choice_id: choiceId })
        .eq("id", existing.id)
        .eq("instructor_id", instructorId);
      if (error) {
        logInstructorFeaturesSupabaseError("single select update", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    } else {
      const { error } = await supabase.from(INSTRUCTOR_FEATURE_ENTRIES_TABLE).insert({
        instructor_id: instructorId,
        feature_definition_id: Number(realDefinition.id),
        selected_choice_id: choiceId,
      });
      if (error) {
        logInstructorFeaturesSupabaseError("single select insert", error);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    }
  }

  const multiSelectFeatures = persistableDefinitions.filter(
    (f) => f.input_type === "multi_select" && !isSchoolHoursInstructorFeature(f),
  );

  for (const feature of multiSelectFeatures) {
    const realDefinition = uiFeatureIdToRealDefinition.get(feature.id);
    if (!realDefinition) continue;

    const uiSelectedIds = form.multiSelectValues[feature.id] ?? [];
    const selectedIds = Array.from(
      new Set(
        uiSelectedIds
          .map((choiceId) =>
            realChoiceIdByUiFeatureIdAndChoiceId.get(`${feature.id}:${choiceId}`) ?? null,
          )
          .filter((id): id is number => Number.isFinite(id ?? NaN)),
      ),
    );
    if (uiSelectedIds.length > 0 && selectedIds.length === 0) {
      console.warn("[instructor-features] gerçek multi_select choice id bulunamadı, atlanıyor:", {
        featureId: feature.id,
        featureName: feature.name,
        selectedChoiceIds: uiSelectedIds,
      });
    }
    let existing = findEntry(feature.id);

    if (selectedIds.length === 0) {
      if (existing) {
        await supabase
          .from(INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE)
          .delete()
          .eq("instructor_feature_entry_id", existing.id);
        const { error } = await supabase
          .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
          .delete()
          .eq("id", existing.id)
          .eq("instructor_id", instructorId);
        if (error) {
          logInstructorFeaturesSupabaseError("multi select delete", error);
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
          feature_definition_id: Number(realDefinition.id),
        })
        .select("id")
        .single();
      if (insertError || !inserted) {
        logInstructorFeaturesSupabaseError("multi select insert entry", insertError);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
      existing = {
        id: inserted.id as number,
        instructor_id: instructorId,
        feature_definition_id: Number(realDefinition.id),
        text_answer: null,
        number_answer: null,
        boolean_answer: null,
        selected_choice_id: null,
      };
    }

    const { error: clearError } = await supabase
      .from(INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE)
      .delete()
      .eq("instructor_feature_entry_id", existing.id);
    if (clearError) {
      logInstructorFeaturesSupabaseError("multi select clear choices", clearError);
      return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    }

    const rows = selectedIds.map((choiceId) => ({
      instructor_feature_entry_id: existing!.id,
      choice_id: choiceId,
    }));
    if (rows.length > 0) {
      const { error: insertChoicesError } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE)
        .insert(rows);
      if (insertChoicesError) {
        logInstructorFeaturesSupabaseError("multi select insert choices", insertChoicesError);
        return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
    }
  }

  return { error: null };
}
