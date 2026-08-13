import { isLegacyStudentAgeMultiSelectFeature } from "@/lib/studentAgeRangeFeature";

export type InstitutionMainFeatureDefinitionRef = {
  id: number;
  input_type: string;
  name?: string | null;
  slug?: string | null;
};

export type InstitutionMainFeatureFormState = {
  booleanValues: Record<number, boolean>;
  textValues: Record<number, string>;
  numberValues: Record<number, string>;
  singleSelectValues: Record<number, string>;
  multiSelectValues: Record<number, string[]>;
};

export function collectDefinitionIdsFromFeatureGroups(
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

export function isMainFeatureFilledInFormState(
  feature: InstitutionMainFeatureDefinitionRef,
  formState: InstitutionMainFeatureFormState,
): boolean {
  const inputType = String(feature.input_type ?? "").trim().toLowerCase();

  if (inputType === "boolean") {
    return Boolean(formState.booleanValues[feature.id]);
  }

  if (inputType === "text") {
    return String(formState.textValues[feature.id] ?? "").trim().length > 0;
  }

  if (inputType === "number") {
    return String(formState.numberValues[feature.id] ?? "").trim().length > 0;
  }

  if (inputType === "single_select") {
    return String(formState.singleSelectValues[feature.id] ?? "").trim().length > 0;
  }

  if (inputType === "multi_select") {
    if (isLegacyStudentAgeMultiSelectFeature(feature)) return false;
    const selectedIds = formState.multiSelectValues[feature.id] ?? [];
    return selectedIds.some((choiceId) => String(choiceId ?? "").trim().length > 0);
  }

  return false;
}

/**
 * Ana kurum özellikleri reconciliation:
 * - current valid scope dışındaki entry'ler stale
 * - reconcile scope içinde form state boş olan entry'ler stale
 * - protected (Ek Branş) entry'ler asla stale sayılmaz
 */
export function collectStaleMainFeatureEntryIds(args: {
  dbEntries: Array<{ id: number; feature_definition_id: number }>;
  currentValidDefinitionIds: ReadonlySet<number>;
  reconcileDefinitionIds: ReadonlySet<number>;
  protectedDefinitionIds: ReadonlySet<number>;
  definitionsById: ReadonlyMap<number, InstitutionMainFeatureDefinitionRef>;
  formState: InstitutionMainFeatureFormState;
}): number[] {
  const staleEntryIds: number[] = [];

  for (const entry of args.dbEntries) {
    const defId = entry.feature_definition_id;
    if (args.protectedDefinitionIds.has(defId)) continue;

    const inValidScope = args.currentValidDefinitionIds.has(defId);
    if (!inValidScope) {
      staleEntryIds.push(entry.id);
      continue;
    }

    if (!args.reconcileDefinitionIds.has(defId)) {
      continue;
    }

    const definition = args.definitionsById.get(defId);
    if (!definition) {
      staleEntryIds.push(entry.id);
      continue;
    }

    if (!isMainFeatureFilledInFormState(definition, args.formState)) {
      staleEntryIds.push(entry.id);
    }
  }

  return staleEntryIds;
}

const PATILI_DOSTLAR_CATEGORY_SLUG = "patili-dostlar";
const BASLICA_GROUP_NAME_KEY = "başlıca özellikler";

export type InstitutionMainFeatureSelectionGroup = {
  group: { id: number; name: string; category_slug?: string | null };
  features: Array<{
    id: number;
    name: string;
    slug: string | null;
    input_type: string;
    help_text: string | null;
    placeholder: string | null;
    unit: string | null;
  }>;
};

export function buildInstitutionMainFeatureSelectionGroups(
  selectionGroups: InstitutionMainFeatureSelectionGroup[],
  selectedCategorySlug: string | null,
): {
  upperGroups: InstitutionMainFeatureSelectionGroup[];
  lowerGroups: InstitutionMainFeatureSelectionGroup[];
} {
  const baslicaOzelliklerGroup = selectionGroups.find(
    ({ group }) => group.name.trim().toLocaleLowerCase("tr-TR") === BASLICA_GROUP_NAME_KEY,
  );
  const isPatiliDostlarCategory = selectedCategorySlug === PATILI_DOSTLAR_CATEGORY_SLUG;
  const patiliBaslicaOzelliklerGroup = isPatiliDostlarCategory
    ? selectionGroups.find(
        ({ group }) =>
          group.name.trim().toLocaleLowerCase("tr-TR") === BASLICA_GROUP_NAME_KEY &&
          (group.category_slug ?? "").trim() === PATILI_DOSTLAR_CATEGORY_SLUG,
      )
    : undefined;
  const okulImkanlariIndex = selectionGroups.findIndex(
    ({ group }) => group.name.trim().toLocaleLowerCase("tr-TR") === "okul imkanları",
  );

  const upperGroups = isPatiliDostlarCategory
    ? patiliBaslicaOzelliklerGroup
      ? [patiliBaslicaOzelliklerGroup]
      : []
    : baslicaOzelliklerGroup
      ? [baslicaOzelliklerGroup]
      : okulImkanlariIndex !== -1
        ? selectionGroups.slice(0, okulImkanlariIndex)
        : selectionGroups;

  const lowerGroupsRaw = baslicaOzelliklerGroup
    ? selectionGroups.filter((item) => item.group.id !== baslicaOzelliklerGroup.group.id)
    : okulImkanlariIndex !== -1
      ? selectionGroups.slice(okulImkanlariIndex)
      : [];

  const lowerGroups =
    selectedCategorySlug === null
      ? []
      : lowerGroupsRaw
          .filter(({ group }) => (group.category_slug ?? "").trim() === selectedCategorySlug)
          .filter(
            (item) =>
              !patiliBaslicaOzelliklerGroup ||
              item.group.id !== patiliBaslicaOzelliklerGroup.group.id,
          );

  return { upperGroups, lowerGroups };
}
