"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { INSTRUCTORS_TABLE } from "@/lib/instructorProfileClient";

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
  owner_auth_id: string;
  feature_definition_id: number;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
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
    console.error("[instructor-features] categories:", error);
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
    console.error("[instructor-features] definitions bundle:", groupsRes.error, definitionsRes.error, choicesRes.error);
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
  authUid: string,
  instructorId: number,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{
  entries: InstructorFeatureEntryRow[];
  entryChoices: InstructorFeatureEntryChoiceRow[];
  error: string | null;
}> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();

  const { data: entriesData, error: entriesError } = await supabase
    .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
    .select(
      "id, instructor_id, owner_auth_id, feature_definition_id, value_text, value_number, value_boolean, value_date, selected_choice_id",
    )
    .eq("instructor_id", instructorId)
    .eq("owner_auth_id", authUid);

  if (entriesError) {
    console.error("[instructor-features] entries:", entriesError);
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
      console.error("[instructor-features] entry choices:", choicesError);
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
      booleanValues[feature.id] = Boolean(entry?.value_boolean);
    } else if (feature.input_type === "text") {
      textValues[feature.id] = entry?.value_text ?? "";
    } else if (feature.input_type === "number") {
      numberValues[feature.id] =
        typeof entry?.value_number === "number" ? String(entry.value_number) : "";
    } else if (feature.input_type === "date") {
      dateValues[feature.id] = entry?.value_date ? String(entry.value_date).slice(0, 10) : "";
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
    entries,
    form,
    featureIdsToSave,
  } = params;

  const saveSet = new Set(featureIdsToSave);
  const shouldPersist = (featureId: number) => saveSet.has(featureId);

  const { error: categoryError } = await supabase
    .from(INSTRUCTORS_TABLE)
    .update({ category_id: categoryId })
    .eq("id", instructorId)
    .eq("owner_auth_id", authUid);

  if (categoryError) {
    console.error("[instructor-features] category save:", categoryError);
    return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
  }

  const findEntry = (featureId: number) =>
    entries.find((e) => e.feature_definition_id === featureId);

  for (const feature of definitions.filter((f) => f.input_type === "boolean" && shouldPersist(f.id))) {
    const value = Boolean(form.booleanValues[feature.id]);
    const existing = findEntry(feature.id);
    if (existing) {
      const { error } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
        .update({ value_boolean: value })
        .eq("id", existing.id)
        .eq("instructor_id", instructorId)
        .eq("owner_auth_id", authUid);
      if (error) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    } else {
      const { error } = await supabase.from(INSTRUCTOR_FEATURE_ENTRIES_TABLE).insert({
        instructor_id: instructorId,
        owner_auth_id: authUid,
        feature_definition_id: feature.id,
        value_boolean: value,
      });
      if (error) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    }
  }

  for (const feature of definitions.filter((f) => f.input_type === "text" && shouldPersist(f.id))) {
    const value = (form.textValues[feature.id] ?? "").trim();
    const existing = findEntry(feature.id);
    if (!value) {
      if (existing) {
        const { error } = await supabase
          .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
          .delete()
          .eq("id", existing.id)
          .eq("instructor_id", instructorId)
          .eq("owner_auth_id", authUid);
        if (error) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
      continue;
    }
    if (existing) {
      const { error } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
        .update({ value_text: value })
        .eq("id", existing.id);
      if (error) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    } else {
      const { error } = await supabase.from(INSTRUCTOR_FEATURE_ENTRIES_TABLE).insert({
        instructor_id: instructorId,
        owner_auth_id: authUid,
        feature_definition_id: feature.id,
        value_text: value,
      });
      if (error) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    }
  }

  for (const feature of definitions.filter((f) => f.input_type === "number" && shouldPersist(f.id))) {
    const raw = (form.numberValues[feature.id] ?? "").trim();
    const existing = findEntry(feature.id);
    if (!raw) {
      if (existing) {
        const { error } = await supabase
          .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
          .delete()
          .eq("id", existing.id);
        if (error) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
      continue;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) continue;
    if (existing) {
      const { error } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
        .update({ value_number: parsed })
        .eq("id", existing.id);
      if (error) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    } else {
      const { error } = await supabase.from(INSTRUCTOR_FEATURE_ENTRIES_TABLE).insert({
        instructor_id: instructorId,
        owner_auth_id: authUid,
        feature_definition_id: feature.id,
        value_number: parsed,
      });
      if (error) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    }
  }

  for (const feature of definitions.filter((f) => f.input_type === "date" && shouldPersist(f.id))) {
    const value = (form.dateValues[feature.id] ?? "").trim();
    const existing = findEntry(feature.id);
    if (!value) {
      if (existing) {
        const { error } = await supabase
          .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
          .delete()
          .eq("id", existing.id);
        if (error) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
      continue;
    }
    if (existing) {
      const { error } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
        .update({ value_date: value })
        .eq("id", existing.id);
      if (error) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    } else {
      const { error } = await supabase.from(INSTRUCTOR_FEATURE_ENTRIES_TABLE).insert({
        instructor_id: instructorId,
        owner_auth_id: authUid,
        feature_definition_id: feature.id,
        value_date: value,
      });
      if (error) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    }
  }

  const singleSelectFeatures = definitions.filter(
    (f) =>
      (f.input_type === "single_select" || isSchoolHoursInstructorFeature(f)) && shouldPersist(f.id),
  );

  for (const feature of singleSelectFeatures) {
    const raw = (form.singleSelectValues[feature.id] ?? "").trim();
    const existing = findEntry(feature.id);
    if (!raw) {
      if (existing) {
        const { error } = await supabase
          .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
          .delete()
          .eq("id", existing.id);
        if (error) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
      continue;
    }
    const choiceId = Number(raw);
    if (!Number.isFinite(choiceId)) continue;
    if (existing) {
      const { error } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
        .update({ selected_choice_id: choiceId })
        .eq("id", existing.id);
      if (error) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    } else {
      const { error } = await supabase.from(INSTRUCTOR_FEATURE_ENTRIES_TABLE).insert({
        instructor_id: instructorId,
        owner_auth_id: authUid,
        feature_definition_id: feature.id,
        selected_choice_id: choiceId,
      });
      if (error) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    }
  }

  const multiSelectFeatures = definitions.filter(
    (f) => f.input_type === "multi_select" && !isSchoolHoursInstructorFeature(f) && shouldPersist(f.id),
  );

  for (const feature of multiSelectFeatures) {
    const selectedIds = Array.from(
      new Set(
        (form.multiSelectValues[feature.id] ?? [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id)),
      ),
    );
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
          .eq("id", existing.id);
        if (error) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      }
      continue;
    }

    if (!existing) {
      const { data: inserted, error: insertError } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
        .insert({
          instructor_id: instructorId,
          owner_auth_id: authUid,
          feature_definition_id: feature.id,
        })
        .select("id")
        .single();
      if (insertError || !inserted) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
      existing = {
        id: inserted.id as number,
        instructor_id: instructorId,
        owner_auth_id: authUid,
        feature_definition_id: feature.id,
        value_text: null,
        value_number: null,
        value_boolean: null,
        value_date: null,
        selected_choice_id: null,
      };
    }

    const { error: clearError } = await supabase
      .from(INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE)
      .delete()
      .eq("instructor_feature_entry_id", existing.id);
    if (clearError) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };

    const rows = selectedIds.map((choiceId) => ({
      instructor_feature_entry_id: existing!.id,
      choice_id: choiceId,
    }));
    if (rows.length > 0) {
      const { error: insertChoicesError } = await supabase
        .from(INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE)
        .insert(rows);
      if (insertChoicesError) return { error: INSTRUCTOR_FEATURES_SAVE_ERROR };
    }
  }

  return { error: null };
}
