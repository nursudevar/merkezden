import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FEATURE_HIGHLIGHT_PROFILE_KEYS,
  FEATURE_HIGHLIGHT_RANGE_KEYS,
  type FeatureHighlightKind,
  type FeatureHighlightRow,
} from "@/lib/featureHighlights";
import { getDisplayFeatureName } from "@/lib/institutionPublicFeatures";
import { formatWorkingHoursRange } from "@/lib/institutionHelpers";
import { formatInstitutionPriceRangeDisplay } from "@/lib/institutionPriceRangeFilter";
import {
  STUDENT_AGE_RANGE_LABEL,
  findStudentAgeRangeDefinitions,
  formatStudentAgeDisplay,
} from "@/lib/studentAgeRangeFeature";
import {
  LESSON_DURATION_LABEL,
  findLessonDurationRangeDefinitions,
  formatLessonDurationDisplay,
} from "@/lib/instructorLessonDurationFeature";
import { getDisplayInstructorFeatureName } from "@/lib/instructorFeaturesClient";

export type PublicHighlightDisplayItem = {
  identity: string;
  label: string;
  value: string | null;
};

type EntryLike = {
  id: number;
  feature_definition_id: number;
  boolean_answer?: boolean | null;
  text_answer?: string | null;
  number_answer?: number | null;
  selected_choice_id?: number | null;
};

type DefinitionLike = {
  id: number;
  name: string;
  slug?: string | null;
  input_type: string;
  unit?: string | null;
};

type ChoiceLike = {
  id: number;
  feature_definition_id: number;
  name?: string | null;
};

type EntryChoiceLike = {
  choice_id: number;
  institution_feature_entry_id?: number;
  instructor_feature_entry_id?: number;
};

export async function fetchInstitutionHighlightRowsClient(
  institutionId: number,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<FeatureHighlightRow[]> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("institution_highlights")
    .select("kind, feature_definition_id, choice_id, range_key, profile_key, position")
    .eq("institution_id", institutionId)
    .order("position", { ascending: true });
  if (error) return [];
  return (data as FeatureHighlightRow[] | null) ?? [];
}

export async function fetchInstructorHighlightRowsClient(
  instructorId: number,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<FeatureHighlightRow[]> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("instructor_highlights")
    .select("kind, feature_definition_id, choice_id, range_key, profile_key, position")
    .eq("instructor_id", instructorId)
    .order("position", { ascending: true });
  if (error) return [];
  return (data as FeatureHighlightRow[] | null) ?? [];
}

function choiceIdsForEntry(
  entry: EntryLike,
  entryChoices: EntryChoiceLike[],
  entity: "institution" | "instructor",
): number[] {
  const fromJunction = entryChoices
    .filter((row) =>
      entity === "institution"
        ? row.institution_feature_entry_id === entry.id
        : row.instructor_feature_entry_id === entry.id,
    )
    .map((row) => Number(row.choice_id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (fromJunction.length > 0) return fromJunction;
  const selected = Number(entry.selected_choice_id);
  return Number.isFinite(selected) && selected > 0 ? [selected] : [];
}

function definitionValue(args: {
  definition: DefinitionLike;
  entry: EntryLike | undefined;
  choices: ChoiceLike[];
  selectedChoiceIds: number[];
  displayName: (name: string) => string;
}): { label: string; value: string | null } | null {
  const { definition, entry, choices, selectedChoiceIds, displayName } = args;
  const label = displayName(definition.name);
  const inputType = String(definition.input_type ?? "").trim().toLowerCase();
  if (!entry) return null;
  if (inputType === "boolean") {
    return entry.boolean_answer === true ? { label, value: null } : null;
  }
  if (inputType === "text" || inputType === "date") {
    const text = String(entry.text_answer ?? "").trim();
    return text ? { label, value: text } : null;
  }
  if (inputType === "number") {
    if (typeof entry.number_answer !== "number" || !Number.isFinite(entry.number_answer)) return null;
    const unit = String(definition.unit ?? "").trim();
    return { label, value: unit ? `${entry.number_answer} ${unit}` : String(entry.number_answer) };
  }
  if (inputType === "single_select" || inputType === "multi_select") {
    const names = selectedChoiceIds
      .map((id) => choices.find((choice) => choice.id === id)?.name?.trim() ?? "")
      .filter(Boolean);
    if (names.length === 0) return null;
    return { label, value: names.join(", ") };
  }
  return null;
}

export function resolvePublicHighlightItems(args: {
  rows: FeatureHighlightRow[];
  definitions: DefinitionLike[];
  choices: ChoiceLike[];
  entries: EntryLike[];
  entryChoices: EntryChoiceLike[];
  entity: "institution" | "instructor";
  minFiyat?: number | null;
  maxFiyat?: number | null;
  workingHoursStart?: string | null;
  workingHoursEnd?: string | null;
}): PublicHighlightDisplayItem[] {
  const displayName =
    args.entity === "institution" ? getDisplayFeatureName : getDisplayInstructorFeatureName;
  const entriesByDefinitionId = new Map(args.entries.map((entry) => [entry.feature_definition_id, entry]));
  const ageDefs = findStudentAgeRangeDefinitions(args.definitions);
  const durationDefs = findLessonDurationRangeDefinitions(args.definitions);
  const ordered = [...args.rows].sort(
    (a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER),
  );
  const items: PublicHighlightDisplayItem[] = [];

  for (const row of ordered) {
    const kind = String(row.kind ?? "").trim() as FeatureHighlightKind;
    if (kind === "range" && row.range_key === FEATURE_HIGHLIGHT_RANGE_KEYS.studentAge) {
      const minEntry = ageDefs.min ? entriesByDefinitionId.get(ageDefs.min.id) : undefined;
      const maxEntry = ageDefs.max ? entriesByDefinitionId.get(ageDefs.max.id) : undefined;
      const min = typeof minEntry?.number_answer === "number" ? minEntry.number_answer : null;
      const max = typeof maxEntry?.number_answer === "number" ? maxEntry.number_answer : null;
      if (min == null || max == null) continue;
      items.push({
        identity: `range:${row.range_key}`,
        label: STUDENT_AGE_RANGE_LABEL,
        value: formatStudentAgeDisplay(min, max),
      });
      continue;
    }
    if (kind === "range" && row.range_key === FEATURE_HIGHLIGHT_RANGE_KEYS.lessonDuration) {
      if (args.entity !== "instructor") continue;
      const minEntry = durationDefs.min ? entriesByDefinitionId.get(durationDefs.min.id) : undefined;
      const maxEntry = durationDefs.max ? entriesByDefinitionId.get(durationDefs.max.id) : undefined;
      const min = typeof minEntry?.number_answer === "number" ? minEntry.number_answer : null;
      const max = typeof maxEntry?.number_answer === "number" ? maxEntry.number_answer : null;
      const value = formatLessonDurationDisplay(min, max);
      if (!value) continue;
      items.push({
        identity: `range:${row.range_key}`,
        label: LESSON_DURATION_LABEL,
        value,
      });
      continue;
    }
    if (kind === "profile" && row.profile_key === FEATURE_HIGHLIGHT_PROFILE_KEYS.workingHours) {
      const value = formatWorkingHoursRange(args.workingHoursStart, args.workingHoursEnd);
      if (!value) continue;
      items.push({
        identity: `profile:${row.profile_key}`,
        label: args.entity === "instructor" ? "Müsait Saat Aralığı" : "Eğitim Saatleri",
        value,
      });
      continue;
    }
    if (kind === "profile" && row.profile_key === FEATURE_HIGHLIGHT_PROFILE_KEYS.priceRange) {
      const value = formatInstitutionPriceRangeDisplay(args.minFiyat, args.maxFiyat);
      if (!value) continue;
      items.push({
        identity: `profile:${row.profile_key}`,
        label: args.entity === "instructor" ? "Fiyat Aralığı" : "Aylık Fiyat Aralığı",
        value,
      });
      continue;
    }
    if (kind === "choice") {
      const definition = args.definitions.find((item) => item.id === row.feature_definition_id);
      const entry = definition ? entriesByDefinitionId.get(definition.id) : undefined;
      if (!definition || !entry || row.choice_id == null) continue;
      const selectedIds = choiceIdsForEntry(entry, args.entryChoices, args.entity);
      if (!selectedIds.includes(Number(row.choice_id))) continue;
      const choice = args.choices.find((item) => item.id === row.choice_id);
      const choiceLabel = String(choice?.name ?? "").trim();
      if (!choiceLabel) continue;
      items.push({
        identity: `choice:${definition.id}:${row.choice_id}`,
        label: choiceLabel,
        value: displayName(definition.name),
      });
      continue;
    }
    if (kind === "definition") {
      const definition = args.definitions.find((item) => item.id === row.feature_definition_id);
      const entry = definition ? entriesByDefinitionId.get(definition.id) : undefined;
      if (!definition) continue;
      const selectedIds = entry ? choiceIdsForEntry(entry, args.entryChoices, args.entity) : [];
      const resolved = definitionValue({
        definition,
        entry,
        choices: args.choices,
        selectedChoiceIds: selectedIds,
        displayName,
      });
      if (!resolved) continue;
      items.push({
        identity: `definition:${definition.id}`,
        label: resolved.label,
        value: resolved.value,
      });
    }
  }

  return items;
}
