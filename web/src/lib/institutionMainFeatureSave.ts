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
const OKUL_CATEGORY_SLUG = "okul";
const SANAT_CATEGORY_SLUG = "sanat";
const SPOR_CATEGORY_SLUG = "spor";
const YABANCI_DIL_CATEGORY_SLUG = "yabanci-dil";
const SURUCU_KURSU_CATEGORY_SLUG = "surucu-kursu";
const SPOR_PANEL_GROUP_ORDER = [
  "tesis turu",
  "spor turleri",
  "egitim ozellikleri",
  "fiziki imkanlar",
  "hedef/fayda",
  "odeme secenekleri",
] as const;
const OKUL_PANEL_GROUP_ORDER = [
  "yabanci dil",
  "okul imkanlari",
  "fiziki imkanlar",
  "egitim sistemi",
  "aktivite",
  "hedef/fayda",
  "odeme secenekleri",
] as const;
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

function normalizeOkulPanelGroupKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function okulPanelGroupOrderKey(group: { name: string; slug?: string | null }): string | null {
  const slug = String(group.slug ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i");
  if (slug === "okul-yabanci-dil") return "yabanci dil";

  const key = normalizeOkulPanelGroupKey(group.name);
  if (key === "yabanci dil") return "yabanci dil";
  if (key.includes("okul imkan")) return "okul imkanlari";
  if (key === "fiziki imkanlar" || key === "fiziksel imkanlar") return "fiziki imkanlar";
  if (key === "egitim sistemi") return "egitim sistemi";
  if (key === "aktiviteler" || key === "aktivite") return "aktivite";
  if (key.includes("hedef") && key.includes("fayda")) return "hedef/fayda";
  if (key === "odeme secenekleri" || key === "odeme yontemleri") return "odeme secenekleri";
  return null;
}

function orderOkulLowerGroups(
  groups: InstitutionMainFeatureSelectionGroup[],
): InstitutionMainFeatureSelectionGroup[] {
  const orderIndex = new Map<string, number>(
    OKUL_PANEL_GROUP_ORDER.map((key, index) => [key, index]),
  );
  return [...groups].sort((a, b) => {
    const aRank = orderIndex.get(okulPanelGroupOrderKey(a.group) ?? "") ?? Number.MAX_SAFE_INTEGER;
    const bRank = orderIndex.get(okulPanelGroupOrderKey(b.group) ?? "") ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return 0;
  });
}

function isSanatFizikiImkanlarGroup(group: { name: string }): boolean {
  const key = normalizeOkulPanelGroupKey(group.name);
  return key === "fiziki imkanlar" || key === "fiziksel imkanlar";
}

function isSanatHedefFaydaGroup(group: { name: string }): boolean {
  const key = normalizeOkulPanelGroupKey(group.name);
  return key.includes("hedef") && key.includes("fayda");
}

function sporPanelGroupOrderKey(group: { name: string; slug?: string | null }): string | null {
  const keys = [normalizeOkulPanelGroupKey(group.name), normalizeOkulPanelGroupKey(String(group.slug ?? ""))].filter(
    Boolean,
  );
  const has = (predicate: (key: string) => boolean) => keys.some(predicate);

  if (has((key) => key.includes("tesis") && key.includes("tur"))) return "tesis turu";
  if (
    has(
      (key) =>
        key === "spor turleri" ||
        key === "spor turu" ||
        (key.includes("spor") && key.includes("tur") && !key.includes("tesis")),
    )
  ) {
    return "spor turleri";
  }
  if (has((key) => key === "egitim ozellikleri" || key === "kurs ozellikleri" || (key.includes("egitim") && key.includes("ozellik")))) {
    return "egitim ozellikleri";
  }
  if (
    has(
      (key) =>
        key === "fiziki imkanlar" ||
        key === "fiziksel imkanlar" ||
        (key.includes("fizik") && key.includes("imkan")),
    )
  ) {
    return "fiziki imkanlar";
  }
  if (has((key) => key.includes("hedef") && key.includes("fayda"))) return "hedef/fayda";
  if (has((key) => key === "odeme secenekleri" || key === "odeme yontemleri")) return "odeme secenekleri";
  return null;
}

function orderSporLowerGroups(
  groups: InstitutionMainFeatureSelectionGroup[],
): InstitutionMainFeatureSelectionGroup[] {
  const orderIndex = new Map<string, number>(
    SPOR_PANEL_GROUP_ORDER.map((key, index) => [key, index]),
  );
  return [...groups].sort((a, b) => {
    const aRank = orderIndex.get(sporPanelGroupOrderKey(a.group) ?? "") ?? Number.MAX_SAFE_INTEGER;
    const bRank = orderIndex.get(sporPanelGroupOrderKey(b.group) ?? "") ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return 0;
  });
}

function orderSanatLowerGroups(
  groups: InstitutionMainFeatureSelectionGroup[],
): InstitutionMainFeatureSelectionGroup[] {
  const fizikiIndex = groups.findIndex((item) => isSanatFizikiImkanlarGroup(item.group));
  const hedefIndex = groups.findIndex((item) => isSanatHedefFaydaGroup(item.group));
  if (fizikiIndex < 0 || hedefIndex < 0 || hedefIndex === fizikiIndex + 1) return groups;

  const next = [...groups];
  const [hedef] = next.splice(hedefIndex, 1);
  const insertAt = next.findIndex((item) => isSanatFizikiImkanlarGroup(item.group)) + 1;
  next.splice(insertAt, 0, hedef);
  return next;
}

function isYabanciDilFizikiImkanlarGroup(group: { name: string }): boolean {
  const key = normalizeOkulPanelGroupKey(group.name);
  return key === "fiziki imkanlar" || key === "fiziksel imkanlar";
}

function isYabanciDilHedefFaydaGroup(group: { name: string }): boolean {
  const key = normalizeOkulPanelGroupKey(group.name);
  return key.includes("hedef") && key.includes("fayda");
}

const PATILI_PANEL_GROUP_ORDER = [
  "hizmet turu",
  "fiziki imkanlar",
  "egitim ozellikleri",
  "odeme secenekleri",
] as const;

const PATILI_PANEL_BASLICA_FEATURE_ORDER = [
  "evcil hayvan turu",
  "hizmet tipi",
  "hizmet yeri",
  "egitim dili",
] as const;

function patiliPanelTextKey(value: string): string {
  return normalizeOkulPanelGroupKey(value);
}

function patiliPanelGroupOrderKey(group: { name: string; slug?: string | null }): string | null {
  const keys = [patiliPanelTextKey(group.name), patiliPanelTextKey(String(group.slug ?? ""))].filter(Boolean);
  const has = (predicate: (key: string) => boolean) => keys.some(predicate);

  if (
    has(
      (key) =>
        key === "hizmet turu" ||
        key === "hizmet turleri" ||
        (key.includes("hizmet") && key.includes("tur") && !key.includes("tip") && !key.includes("yer")),
    )
  ) {
    return "hizmet turu";
  }
  if (
    has(
      (key) =>
        key === "fiziki imkanlar" ||
        key === "fiziksel imkanlar" ||
        (key.includes("fizik") && key.includes("imkan")),
    )
  ) {
    return "fiziki imkanlar";
  }
  if (has((key) => key === "egitim ozellikleri" || (key.includes("egitim") && key.includes("ozellik")))) {
    return "egitim ozellikleri";
  }
  if (
    has(
      (key) =>
        key === "odeme secenekleri" ||
        key === "odeme yontemleri" ||
        (key.includes("odeme") && (key.includes("secenek") || key.includes("yontem"))),
    )
  ) {
    return "odeme secenekleri";
  }
  return null;
}

function orderPatiliDostlarLowerGroups(
  groups: InstitutionMainFeatureSelectionGroup[],
): InstitutionMainFeatureSelectionGroup[] {
  const orderIndex = new Map<string, number>(
    PATILI_PANEL_GROUP_ORDER.map((key, index) => [key, index]),
  );
  return [...groups].sort((a, b) => {
    const aRank = orderIndex.get(patiliPanelGroupOrderKey(a.group) ?? "") ?? Number.MAX_SAFE_INTEGER;
    const bRank = orderIndex.get(patiliPanelGroupOrderKey(b.group) ?? "") ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return 0;
  });
}

export function patiliDostlarBaslicaFeatureOrderKey(feature: {
  name: string;
  slug?: string | null;
}): string | null {
  const keys = [patiliPanelTextKey(feature.name), patiliPanelTextKey(String(feature.slug ?? ""))].filter(Boolean);
  const has = (predicate: (key: string) => boolean) => keys.some(predicate);

  if (
    has(
      (key) =>
        key === "evcil hayvan turu" ||
        key === "evcil hayvan turleri" ||
        (key.includes("evcil") && key.includes("hayvan") && key.includes("tur")),
    )
  ) {
    return "evcil hayvan turu";
  }
  if (has((key) => key === "hizmet tipi" || key === "hizmet tipleri")) return "hizmet tipi";
  if (has((key) => key === "hizmet yeri")) return "hizmet yeri";
  if (
    has(
      (key) =>
        key === "egitim dili" ||
        (key.includes("egitim") && key.includes("dil") && !key.includes("ozellik")),
    )
  ) {
    return "egitim dili";
  }
  return null;
}

export function orderPatiliDostlarBaslicaFeatures<T extends { name: string; slug?: string | null }>(
  features: T[],
): T[] {
  const orderIndex = new Map<string, number>(
    PATILI_PANEL_BASLICA_FEATURE_ORDER.map((key, index) => [key, index]),
  );
  return [...features].sort((a, b) => {
    const aRank =
      orderIndex.get(patiliDostlarBaslicaFeatureOrderKey(a) ?? "") ?? Number.MAX_SAFE_INTEGER;
    const bRank =
      orderIndex.get(patiliDostlarBaslicaFeatureOrderKey(b) ?? "") ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return 0;
  });
}

function isSurucuKursuFizikiImkanlarGroup(group: { name: string; slug?: string | null }): boolean {
  const keys = [normalizeOkulPanelGroupKey(group.name), normalizeOkulPanelGroupKey(String(group.slug ?? ""))].filter(
    Boolean,
  );
  return keys.some(
    (key) =>
      key === "fiziki imkanlar" ||
      key === "fiziksel imkanlar" ||
      (key.includes("fizik") && key.includes("imkan")),
  );
}

function isSurucuKursuHedefFaydaGroup(group: { name: string; slug?: string | null }): boolean {
  const keys = [normalizeOkulPanelGroupKey(group.name), normalizeOkulPanelGroupKey(String(group.slug ?? ""))].filter(
    Boolean,
  );
  return keys.some((key) => key.includes("hedef") && key.includes("fayda"));
}

function orderSurucuKursuLowerGroups(
  groups: InstitutionMainFeatureSelectionGroup[],
): InstitutionMainFeatureSelectionGroup[] {
  const fizikiIndex = groups.findIndex((item) => isSurucuKursuFizikiImkanlarGroup(item.group));
  const hedefIndex = groups.findIndex((item) => isSurucuKursuHedefFaydaGroup(item.group));
  if (fizikiIndex < 0 || hedefIndex < 0 || hedefIndex === fizikiIndex + 1) return groups;

  const next = [...groups];
  const [hedef] = next.splice(hedefIndex, 1);
  const insertAt = next.findIndex((item) => isSurucuKursuFizikiImkanlarGroup(item.group)) + 1;
  next.splice(insertAt, 0, hedef);
  return next;
}

function orderYabanciDilLowerGroups(
  groups: InstitutionMainFeatureSelectionGroup[],
): InstitutionMainFeatureSelectionGroup[] {
  const fizikiIndex = groups.findIndex((item) => isYabanciDilFizikiImkanlarGroup(item.group));
  const hedefIndex = groups.findIndex((item) => isYabanciDilHedefFaydaGroup(item.group));
  if (fizikiIndex < 0 || hedefIndex < 0 || fizikiIndex < hedefIndex) return groups;

  const next = [...groups];
  const fiziki = next[fizikiIndex];
  next[fizikiIndex] = next[hedefIndex];
  next[hedefIndex] = fiziki;
  return next;
}

export type InstitutionMainFeatureSelectionGroup = {
  group: { id: number; name: string; slug?: string | null; category_slug?: string | null };
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
      ? [
          {
            ...patiliBaslicaOzelliklerGroup,
            features: orderPatiliDostlarBaslicaFeatures(patiliBaslicaOzelliklerGroup.features),
          },
        ]
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
        : selectedCategorySlug === OKUL_CATEGORY_SLUG
          ? orderOkulLowerGroups(lowerGroups)
          : selectedCategorySlug === SANAT_CATEGORY_SLUG
            ? orderSanatLowerGroups(lowerGroups)
            : selectedCategorySlug === SPOR_CATEGORY_SLUG
              ? orderSporLowerGroups(lowerGroups)
              : selectedCategorySlug === YABANCI_DIL_CATEGORY_SLUG
                ? orderYabanciDilLowerGroups(lowerGroups)
                : selectedCategorySlug === PATILI_DOSTLAR_CATEGORY_SLUG
                  ? orderPatiliDostlarLowerGroups(lowerGroups)
                  : selectedCategorySlug === SURUCU_KURSU_CATEGORY_SLUG
                    ? orderSurucuKursuLowerGroups(lowerGroups)
                    : lowerGroups,
  };
}
