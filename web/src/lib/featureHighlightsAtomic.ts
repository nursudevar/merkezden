import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { FeatureHighlightRpcItem } from "@/lib/featureHighlights";
import { isStudentAgeRangeNumberFeature, parseStudentAgeDecimalInput } from "@/lib/studentAgeRangeFeature";
import {
  isLessonDurationRangeNumberFeature,
  parseLessonDurationInput,
} from "@/lib/instructorLessonDurationFeature";
import { isInstructorTimeTextFeature, parseValidTimeHHMM } from "@/lib/instructorFeaturesClient";

/**
 * Atomik Kaydet yolu. `false` iken paneller eski çoklu yazmayı kullanır.
 */
export const FEATURE_HIGHLIGHTS_ATOMIC_SAVE_ENABLED = true;

export const INSTITUTION_FEATURES_ATOMIC_RPC = "save_institution_features_atomic";
export const INSTRUCTOR_FEATURES_ATOMIC_RPC = "save_instructor_features_atomic";

export type InstitutionAtomicFeatureRow = {
  definition_id: number;
  input_type: string;
  value?: boolean | number | string | null;
  selected_choice_id?: number | null;
  choices?: number[];
};

export type InstructorAtomicFeatureRow = InstitutionAtomicFeatureRow;

export const FEATURE_HIGHLIGHTS_FOUR_REQUIRED =
  "Öne çıkan özellikler için tam 4 seçim yapın.";

type SnapshotFeature = {
  id: number;
  name?: string | null;
  slug?: string | null;
  input_type: string;
};

type SnapshotForm = {
  booleanValues: Record<number, boolean>;
  textValues: Record<number, string>;
  numberValues: Record<number, string>;
  dateValues?: Record<number, string>;
  singleSelectValues: Record<number, string>;
  multiSelectValues: Record<number, string[]>;
};

function parseNumberAnswer(feature: SnapshotFeature, raw: string): number | null | "skip" {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isStudentAgeRangeNumberFeature(feature)) {
    const parsed = parseStudentAgeDecimalInput(trimmed);
    if (parsed.kind !== "ok") return "skip";
    return parsed.value;
  }
  if (isLessonDurationRangeNumberFeature(feature)) {
    const parsed = parseLessonDurationInput(trimmed);
    if (parsed.kind !== "ok") return "skip";
    return parsed.value;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : "skip";
}

function choiceIdsFromForm(feature: SnapshotFeature, form: SnapshotForm): number[] {
  const raw =
    String(feature.input_type).trim().toLowerCase() === "multi_select"
      ? form.multiSelectValues[feature.id] ?? []
      : [(form.singleSelectValues[feature.id] ?? "").trim()].filter(Boolean);
  return Array.from(
    new Set(
      raw
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  );
}

export function buildInstitutionAtomicFeatureRows(
  definitions: SnapshotFeature[],
  persistIds: ReadonlySet<number>,
  form: SnapshotForm,
): InstitutionAtomicFeatureRow[] {
  const rows: InstitutionAtomicFeatureRow[] = [];
  for (const feature of definitions) {
    if (!persistIds.has(feature.id)) continue;
    const inputType = String(feature.input_type ?? "").trim().toLowerCase();
    if (inputType === "boolean") {
      rows.push({
        definition_id: feature.id,
        input_type: inputType,
        value: form.booleanValues[feature.id] === true,
      });
      continue;
    }
    if (inputType === "text") {
      const text = String(form.textValues[feature.id] ?? "").trim() || null;
      rows.push({ definition_id: feature.id, input_type: inputType, value: text });
      continue;
    }
    if (inputType === "number") {
      const parsed = parseNumberAnswer(feature, form.numberValues[feature.id] ?? "");
      if (parsed === "skip") continue;
      rows.push({
        definition_id: feature.id,
        input_type: inputType,
        value: parsed,
      });
      continue;
    }
    if (inputType === "single_select" || inputType === "multi_select") {
      rows.push({
        definition_id: feature.id,
        input_type: inputType,
        choices: choiceIdsFromForm(feature, form),
      });
    }
  }
  return rows;
}

export function buildInstructorAtomicFeatureRows(
  definitions: SnapshotFeature[],
  persistIds: ReadonlySet<number>,
  form: SnapshotForm,
): InstructorAtomicFeatureRow[] {
  const rows: InstructorAtomicFeatureRow[] = [];
  for (const feature of definitions) {
    if (!persistIds.has(feature.id)) continue;
    const inputType = String(feature.input_type ?? "").trim().toLowerCase();
    if (inputType === "boolean") {
      rows.push({
        definition_id: feature.id,
        input_type: inputType,
        value: form.booleanValues[feature.id] === true,
      });
      continue;
    }
    if (inputType === "text") {
      const raw = String(form.textValues[feature.id] ?? "").trim();
      const value =
        raw && isInstructorTimeTextFeature({ name: feature.name ?? "", slug: feature.slug ?? null })
          ? parseValidTimeHHMM(raw) ?? ""
          : raw;
      rows.push({
        definition_id: feature.id,
        input_type: inputType,
        value: value || null,
      });
      continue;
    }
    if (inputType === "date") {
      const value = String(form.dateValues?.[feature.id] ?? "").trim() || null;
      rows.push({
        definition_id: feature.id,
        input_type: inputType,
        value,
      });
      continue;
    }
    if (inputType === "number") {
      const parsed = parseNumberAnswer(feature, form.numberValues[feature.id] ?? "");
      if (parsed === "skip") continue;
      rows.push({
        definition_id: feature.id,
        input_type: inputType,
        value: parsed,
      });
      continue;
    }
    if (inputType === "single_select") {
      const ids = choiceIdsFromForm(feature, form);
      rows.push({
        definition_id: feature.id,
        input_type: inputType,
        selected_choice_id: ids[0] ?? null,
        choices: ids,
      });
      continue;
    }
    if (inputType === "multi_select") {
      rows.push({
        definition_id: feature.id,
        input_type: inputType,
        selected_choice_id: null,
        choices: choiceIdsFromForm(feature, form),
      });
    }
  }
  return rows;
}

export type InstitutionAtomicSavePayload = {
  institution_id: number;
  category_id: number | null;
  institution_type_id: number | null;
  high_school_type: string | null;
  min_fiyat: number | null;
  max_fiyat: number | null;
  working_hours_start: string | null;
  working_hours_end: string | null;
  features: InstitutionAtomicFeatureRow[];
  highlights: FeatureHighlightRpcItem[];
};

export type InstructorAtomicSavePayload = {
  instructor_id: number;
  category_id: number | null;
  lesson_type: string | null;
  service_type: string | null;
  min_fiyat: number | null;
  max_fiyat: number | null;
  working_hours_start: string | null;
  working_hours_end: string | null;
  features: InstructorAtomicFeatureRow[];
  highlights: FeatureHighlightRpcItem[];
};

function rpcErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const record = error as { message?: string; code?: string };
    const message = String(record.message ?? "").trim();
    if (message) return message;
  }
  return fallback;
}

export async function saveInstitutionFeaturesAtomicClient(
  payload: InstitutionAtomicSavePayload,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ error: string | null }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const { error } = await supabase.rpc(INSTITUTION_FEATURES_ATOMIC_RPC, {
    p_payload: payload,
  });
  if (error) {
    return { error: rpcErrorMessage(error, "Kurum özellikleri kaydedilirken bir hata oluştu.") };
  }
  return { error: null };
}

export async function saveInstructorFeaturesAtomicClient(
  payload: InstructorAtomicSavePayload,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ error: string | null }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const { error } = await supabase.rpc(INSTRUCTOR_FEATURES_ATOMIC_RPC, {
    p_payload: payload,
  });
  if (error) {
    return { error: rpcErrorMessage(error, "Eğitmen özellikleri kaydedilirken bir hata oluştu.") };
  }
  return { error: null };
}
