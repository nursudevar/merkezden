export const FEATURE_HIGHLIGHTS_REQUIRED_COUNT = 4;

export const FEATURE_HIGHLIGHT_RANGE_KEYS = {
  studentAge: "student-age",
  lessonDuration: "lesson-duration",
} as const;

export const FEATURE_HIGHLIGHT_PROFILE_KEYS = {
  workingHours: "working_hours",
  priceRange: "price_range",
} as const;

export type FeatureHighlightKind = "definition" | "choice" | "range" | "profile";

export type FeatureHighlightRow = {
  kind: string | null;
  feature_definition_id: number | null;
  choice_id: number | null;
  range_key: string | null;
  profile_key: string | null;
  position: number | null;
};

export type FeatureHighlightSelection = {
  identity: string;
  kind: FeatureHighlightKind;
  feature_definition_id?: number;
  choice_id?: number;
  range_key?: string;
  profile_key?: string;
  label: string;
  groupName: string;
  valueLabel?: string;
};

export type FeatureHighlightCandidate = FeatureHighlightSelection;

export type FeatureHighlightRpcItem = {
  kind: FeatureHighlightKind;
  position: number;
  feature_definition_id?: number;
  choice_id?: number;
  range_key?: string;
  profile_key?: string;
};

type FillableFeature = {
  id: number;
  name: string;
  slug?: string | null;
  input_type: string;
};

type FillableForm = {
  booleanValues: Record<number, boolean>;
  textValues: Record<number, string>;
  numberValues: Record<number, string>;
  dateValues?: Record<number, string>;
  singleSelectValues: Record<number, string>;
  multiSelectValues: Record<number, string[]>;
};

type FillableChoice = {
  id: number;
  feature_definition_id: number;
  name?: string | null;
};

export function highlightIdentity(selection: {
  kind: FeatureHighlightKind;
  feature_definition_id?: number;
  choice_id?: number;
  range_key?: string;
  profile_key?: string;
}): string {
  if (selection.kind === "definition") return `definition:${selection.feature_definition_id}`;
  if (selection.kind === "choice") {
    return `choice:${selection.feature_definition_id}:${selection.choice_id}`;
  }
  if (selection.kind === "range") return `range:${selection.range_key}`;
  return `profile:${selection.profile_key}`;
}

export function toFeatureHighlightRpcItem(
  selection: FeatureHighlightSelection,
  position: number,
): FeatureHighlightRpcItem {
  if (selection.kind === "definition") {
    return {
      kind: "definition",
      position,
      feature_definition_id: selection.feature_definition_id,
    };
  }
  if (selection.kind === "choice") {
    return {
      kind: "choice",
      position,
      feature_definition_id: selection.feature_definition_id,
      choice_id: selection.choice_id,
    };
  }
  if (selection.kind === "range") {
    return { kind: "range", position, range_key: selection.range_key };
  }
  return { kind: "profile", position, profile_key: selection.profile_key };
}

export function highlightRowToSelection(
  row: FeatureHighlightRow,
  candidates: FeatureHighlightCandidate[],
): FeatureHighlightSelection | null {
  const kind = String(row.kind ?? "").trim() as FeatureHighlightKind;
  if (kind !== "definition" && kind !== "choice" && kind !== "range" && kind !== "profile") {
    return null;
  }
  const identity = highlightIdentity({
    kind,
    feature_definition_id: row.feature_definition_id ?? undefined,
    choice_id: row.choice_id ?? undefined,
    range_key: row.range_key ?? undefined,
    profile_key: row.profile_key ?? undefined,
  });
  return candidates.find((candidate) => candidate.identity === identity) ?? null;
}

export function pruneFeatureHighlightSelections(
  selected: FeatureHighlightSelection[],
  candidates: FeatureHighlightCandidate[],
): { next: FeatureHighlightSelection[]; removed: FeatureHighlightSelection[] } {
  const candidateIds = new Set(candidates.map((candidate) => candidate.identity));
  const kept: FeatureHighlightSelection[] = [];
  const removed: FeatureHighlightSelection[] = [];
  for (const item of selected) {
    const live = candidates.find((candidate) => candidate.identity === item.identity);
    if (!live || !candidateIds.has(item.identity)) {
      removed.push(item);
      continue;
    }
    kept.push({ ...live });
  }
  return { next: kept, removed };
}

export function isFeatureHighlightFilled(
  feature: FillableFeature,
  form: FillableForm,
): boolean {
  const inputType = String(feature.input_type ?? "").trim().toLowerCase();
  if (inputType === "boolean") return form.booleanValues[feature.id] === true;
  if (inputType === "text") return String(form.textValues[feature.id] ?? "").trim().length > 0;
  if (inputType === "date") return String(form.dateValues?.[feature.id] ?? "").trim().length > 0;
  if (inputType === "number") return String(form.numberValues[feature.id] ?? "").trim().length > 0;
  if (inputType === "single_select") {
    return String(form.singleSelectValues[feature.id] ?? "").trim().length > 0;
  }
  if (inputType === "multi_select") {
    return (form.multiSelectValues[feature.id] ?? []).some((id) => String(id ?? "").trim().length > 0);
  }
  return false;
}

export function collectFilledFeatureHighlightCandidates(args: {
  groups: Array<{ group: { name: string }; features: FillableFeature[] }>;
  form: FillableForm;
  choices: FillableChoice[];
  displayName: (name: string) => string;
  skipFeature?: (feature: FillableFeature) => boolean;
}): FeatureHighlightCandidate[] {
  const candidates: FeatureHighlightCandidate[] = [];
  for (const { group, features } of args.groups) {
    for (const feature of features) {
      if (args.skipFeature?.(feature)) continue;
      const inputType = String(feature.input_type ?? "").trim().toLowerCase();
      const groupName = group.name;
      const featureLabel = args.displayName(feature.name);

      if (inputType === "multi_select") {
        const selectedIds = args.form.multiSelectValues[feature.id] ?? [];
        for (const rawId of selectedIds) {
          const choiceId = Number(rawId);
          if (!Number.isFinite(choiceId) || choiceId <= 0) continue;
          const choice = args.choices.find((item) => item.id === choiceId);
          const choiceLabel = String(choice?.name ?? "").trim() || String(choiceId);
          const selection = {
            kind: "choice" as const,
            feature_definition_id: feature.id,
            choice_id: choiceId,
            label: choiceLabel,
            groupName,
            valueLabel: featureLabel,
          };
          candidates.push({ ...selection, identity: highlightIdentity(selection) });
        }
        continue;
      }

      if (inputType === "single_select") {
        const rawId = String(args.form.singleSelectValues[feature.id] ?? "").trim();
        const choiceId = Number(rawId);
        if (!Number.isFinite(choiceId) || choiceId <= 0) continue;
        const choice = args.choices.find((item) => item.id === choiceId);
        const choiceLabel = String(choice?.name ?? "").trim() || rawId;
        const selection = {
          kind: "choice" as const,
          feature_definition_id: feature.id,
          choice_id: choiceId,
          label: choiceLabel,
          groupName,
          valueLabel: featureLabel,
        };
        candidates.push({ ...selection, identity: highlightIdentity(selection) });
        continue;
      }

      if (!isFeatureHighlightFilled(feature, args.form)) continue;
      const valueLabel =
        inputType === "boolean"
          ? undefined
          : inputType === "date"
            ? String(args.form.dateValues?.[feature.id] ?? "").trim()
            : inputType === "number"
              ? String(args.form.numberValues[feature.id] ?? "").trim()
              : String(args.form.textValues[feature.id] ?? "").trim();
      const selection = {
        kind: "definition" as const,
        feature_definition_id: feature.id,
        label: featureLabel,
        groupName,
        valueLabel: valueLabel || undefined,
      };
      candidates.push({ ...selection, identity: highlightIdentity(selection) });
    }
  }
  return candidates;
}

export function combinedHighlightCandidate(args: {
  kind: "range" | "profile";
  range_key?: string;
  profile_key?: string;
  label: string;
  groupName: string;
  valueLabel?: string;
}): FeatureHighlightCandidate {
  const selection = {
    kind: args.kind,
    range_key: args.range_key,
    profile_key: args.profile_key,
    label: args.label,
    groupName: args.groupName,
    valueLabel: args.valueLabel,
  };
  return { ...selection, identity: highlightIdentity(selection) };
}

export function hasTextValue(value: string | null | undefined): boolean {
  return String(value ?? "").trim().length > 0;
}
