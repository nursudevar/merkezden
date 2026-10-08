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
const KISISEL_GELISIM_CATEGORY_SLUG = "kisisel-gelisim";
const BASLICA_GROUP_NAME_KEY = "başlıca özellikler";
const KISISEL_GELISIM_LOWER_TAIL_KEYS = [
  "egitim ozellikleri",
  "fiziki imkanlar",
  "hedef/fayda",
  "odeme secenekleri",
] as const;

function normalizeKisiselGelisimPanelGroupKey(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function kisiselGelisimLowerTailKey(name: string): string | null {
  const key = normalizeKisiselGelisimPanelGroupKey(name);
  if (key === "egitim ozellikleri" || key === "kurs ozellikleri") return "egitim ozellikleri";
  if (key === "fiziki imkanlar" || key === "fiziksel imkanlar") return "fiziki imkanlar";
  if (key.includes("hedef") && key.includes("fayda")) return "hedef/fayda";
  if (key === "odeme secenekleri" || key === "odeme yontemleri") return "odeme secenekleri";
  return null;
}

function orderKisiselGelisimLowerGroups(
  groups: InstitutionMainFeatureSelectionGroup[],
): InstitutionMainFeatureSelectionGroup[] {
  const tailIndex = new Map<string, number>(
    KISISEL_GELISIM_LOWER_TAIL_KEYS.map((key, index) => [key, index]),
  );
  const head: InstitutionMainFeatureSelectionGroup[] = [];
  const tail: InstitutionMainFeatureSelectionGroup[] = [];
  for (const item of groups) {
    const key = kisiselGelisimLowerTailKey(item.group.name);
    if (key && tailIndex.has(key)) tail.push(item);
    else head.push(item);
  }
  tail.sort((a, b) => {
    const aRank = tailIndex.get(kisiselGelisimLowerTailKey(a.group.name) ?? "") ?? 0;
    const bRank = tailIndex.get(kisiselGelisimLowerTailKey(b.group.name) ?? "") ?? 0;
    return aRank - bRank;
  });
  return [...head, ...tail];
}

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

  return {
    upperGroups,
    lowerGroups:
      selectedCategorySlug === KISISEL_GELISIM_CATEGORY_SLUG
        ? orderKisiselGelisimLowerGroups(lowerGroups)
        : lowerGroups,
  };
}
