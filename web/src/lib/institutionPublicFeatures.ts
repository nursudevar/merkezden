import {
  STUDENT_AGE_RANGE_LABEL,
  findStudentAgeRangeDefinitions,
  formatStudentAgeDisplay,
  isLegacyStudentAgeMultiSelectFeature,
  isStudentAgeRangeNumberFeature,
} from "@/lib/studentAgeRangeFeature";

export type InstitutionFeatureGroupRow = {
  id: number;
  name: string;
  display_order: number | null;
  is_active: boolean;
  category_slug?: string | null;
};

export type InstitutionFeatureDefinitionRow = {
  id: number;
  group_id: number;
  name: string;
  slug: string | null;
  input_type: "boolean" | "text" | "number" | "single_select" | "multi_select" | string;
  unit: string | null;
  display_order: number | null;
  is_active: boolean;
};

export type InstitutionFeatureChoiceRow = {
  id: number;
  feature_definition_id: number;
  name: string | null;
  display_order: number | null;
  is_active: boolean;
};

export type InstitutionFeatureEntryRow = {
  id: number;
  feature_definition_id: number;
  boolean_answer: boolean | null;
  text_answer: string | null;
  number_answer: number | null;
  selected_choice_id: number | null;
};

export type InstitutionFeatureEntryChoiceRow = {
  institution_feature_entry_id: number;
  choice_id: number;
};

export type PublicFeatureGroupSection = {
  id: number;
  name: string;
  badges: string[];
};

export type AcademicFeatureLine = {
  label: string;
  value: string | string[];
  isBadgeList?: boolean;
};

export type PublicFeatureCompareCell =
  | { kind: "empty" }
  | { kind: "boolean"; value: true }
  | { kind: "text"; value: string };

export type PublicFeatureCompareValue = {
  rowKey: string;
  groupId: number;
  groupTitle: string;
  groupDisplayOrder: number;
  sortIndex: number;
  label: string;
  cell: PublicFeatureCompareCell;
};

export type InstitutionCompareFeatureSection = {
  groupId: number;
  title: string;
  rows: Array<{
    rowKey: string;
    label: string;
    cells: PublicFeatureCompareCell[];
  }>;
};

const BASLICA_GROUP_NAME_KEY = "başlıca özellikler";
const BASLICA_GROUP_TITLE = "Başlıca Özellikler";

function normalizeFeatureDisplayNameKey(name: string): string {
  return (name ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getDisplayFeatureName(name: string): string {
  const trimmed = (name ?? "").trim();
  const key = normalizeFeatureDisplayNameKey(trimmed);
  if (key === "fiyat araligi") return "Aylık Ortalama Fiyat Aralığı";
  if (key === "okul durumu" || key === "okul turu" || key === "kurum turu") return "Kurum Türü";
  if (key === "okul saatleri" || key === "kurum saatleri") return "Kurum Saatleri";
  return trimmed;
}

function normalizeFeatureGroupNameKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLocaleLowerCase("tr-TR");
}

function normalizeFeatureGroupCategorySlug(slug: string | null | undefined): string {
  return String(slug ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i");
}

function isEmptyFeatureGroupCategorySlug(slug: string | null | undefined): boolean {
  return normalizeFeatureGroupCategorySlug(slug).length === 0;
}

/** Category-specific Başlıca → global Başlıca fallback (name-only ilk eşleşme yok). */
export function resolveBaslicaFeatureGroupForCategory(
  groups: InstitutionFeatureGroupRow[],
  institutionCategorySlug: string,
): InstitutionFeatureGroupRow | undefined {
  const categorySlug = normalizeFeatureGroupCategorySlug(institutionCategorySlug);

  const categorySpecificBaslica =
    categorySlug.length > 0
      ? groups.find(
          (group) =>
            normalizeFeatureGroupNameKey(group.name) === BASLICA_GROUP_NAME_KEY &&
            normalizeFeatureGroupCategorySlug(group.category_slug) === categorySlug,
        )
      : undefined;

  const globalBaslica = groups.find(
    (group) =>
      normalizeFeatureGroupNameKey(group.name) === BASLICA_GROUP_NAME_KEY &&
      isEmptyFeatureGroupCategorySlug(group.category_slug),
  );

  return categorySpecificBaslica ?? globalBaslica;
}

function toCompareCell(
  feature: InstitutionFeatureDefinitionRow,
  value: string | string[],
): PublicFeatureCompareCell {
  if (feature.input_type === "boolean") {
    return { kind: "boolean", value: true };
  }
  if (Array.isArray(value)) {
    const labels = value.map((item) => item.trim()).filter(Boolean);
    if (labels.length === 0) return { kind: "empty" };
    return { kind: "text", value: labels.join(", ") };
  }
  const text = value.trim();
  return text ? { kind: "text", value: text } : { kind: "empty" };
}

export function isPublicFeatureCompareCellEmpty(
  cell: PublicFeatureCompareCell | undefined,
): boolean {
  if (!cell || cell.kind === "empty") return true;
  if (cell.kind === "boolean") return false;
  return !cell.value.trim();
}

export function formatPublicFeatureCompareCell(cell: PublicFeatureCompareCell): string {
  if (cell.kind === "boolean") return "✓";
  if (cell.kind === "text") return cell.value;
  return "—";
}

/**
 * Public kurum profilindeki feature görünümünü üretir.
 * entriesByFeatureId: aynı definition için son görülen entry kazanır (mevcut detay davranışı).
 * selected_choice_id kullanılmaz; seçimler institution_feature_entry_choices üzerinden okunur.
 */
export function mapPublicInstitutionFeatures(args: {
  groups: InstitutionFeatureGroupRow[];
  definitions: InstitutionFeatureDefinitionRow[];
  choices: InstitutionFeatureChoiceRow[];
  entries: InstitutionFeatureEntryRow[];
  entryChoices: InstitutionFeatureEntryChoiceRow[];
  categorySlug: string;
}): {
  academicLines: AcademicFeatureLine[];
  badgeSections: PublicFeatureGroupSection[];
  compareValues: PublicFeatureCompareValue[];
} {
  const { groups, definitions, choices, entries, entryChoices, categorySlug } = args;
  const selectedCategorySlug = (categorySlug ?? "").trim();
  const compareValues: PublicFeatureCompareValue[] = [];

  const entriesByFeatureId = new Map<number, InstitutionFeatureEntryRow>();
  entries.forEach((entry) => entriesByFeatureId.set(entry.feature_definition_id, entry));

  const choiceNameById = new Map<number, string>();
  choices.forEach((choice) => {
    const label = (choice.name ?? "").trim();
    if (label) choiceNameById.set(choice.id, label);
  });

  const selectedChoiceIdsByEntryId = new Map<number, number[]>();
  entryChoices.forEach((rowChoice) => {
    const current = selectedChoiceIdsByEntryId.get(rowChoice.institution_feature_entry_id) ?? [];
    if (!current.includes(rowChoice.choice_id)) current.push(rowChoice.choice_id);
    selectedChoiceIdsByEntryId.set(rowChoice.institution_feature_entry_id, current);
  });

  const normalize = (v: string) =>
    v
      .toLowerCase()
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/ç/g, "c");

  const extractFeatureValue = (feature: InstitutionFeatureDefinitionRow): string | string[] | null => {
    const entry = entriesByFeatureId.get(feature.id);
    if (!entry) return null;
    if (feature.input_type === "boolean") return entry.boolean_answer === true ? "Evet" : null;
    if (feature.input_type === "single_select") {
      const selectedIds = selectedChoiceIdsByEntryId.get(entry.id) ?? [];
      const labels = selectedIds
        .map((id) => choiceNameById.get(id) ?? "")
        .filter((label) => Boolean(label));
      if (labels.length === 0) return null;
      return labels.length === 1 ? labels[0] : labels;
    }
    if (feature.input_type === "multi_select") {
      const selectedIds = selectedChoiceIdsByEntryId.get(entry.id) ?? [];
      const labels = selectedIds
        .map((id) => choiceNameById.get(id) ?? "")
        .filter((label) => Boolean(label));
      return labels.length > 0 ? labels : null;
    }
    if (feature.input_type === "number") {
      if (typeof entry.number_answer !== "number" || !Number.isFinite(entry.number_answer)) return null;
      return `${entry.number_answer}${feature.unit ? ` ${feature.unit}` : ""}`.trim();
    }
    if (feature.input_type === "text") {
      const value = (entry.text_answer ?? "").trim();
      return value || null;
    }
    return null;
  };

  const pushCompareValue = (
    feature: InstitutionFeatureDefinitionRow,
    group: InstitutionFeatureGroupRow,
    groupTitle: string,
    label: string,
    value: string | string[],
    sortIndex: number,
  ) => {
    const cell = toCompareCell(feature, value);
    if (isPublicFeatureCompareCellEmpty(cell)) return;
    compareValues.push({
      rowKey: `def:${feature.id}`,
      groupId: group.id,
      groupTitle,
      groupDisplayOrder: group.display_order ?? 9999,
      sortIndex,
      label,
      cell,
    });
  };

  const baslicaGroup = resolveBaslicaFeatureGroupForCategory(groups, selectedCategorySlug);
  const akademikGroupFallback = groups.find(
    (group) => normalize((group.name ?? "").trim()) === normalize("Akademik İmkanlar"),
  );
  const primaryStructuredGroup = baslicaGroup ?? akademikGroupFallback;

  const badgeGroups =
    selectedCategorySlug.length > 0
      ? groups.filter((group) => {
          if (baslicaGroup && group.id === baslicaGroup.id) return false;
          if (normalizeFeatureGroupNameKey(group.name) === BASLICA_GROUP_NAME_KEY) return false;
          return (group.category_slug ?? "").trim() === selectedCategorySlug;
        })
      : [];

  const buildBadgesForGroup = (group: InstitutionFeatureGroupRow): string[] => {
    const groupFeatures = definitions
      .filter((feature) => feature.group_id === group.id)
      .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999));
    const badges: string[] = [];
    groupFeatures.forEach((feature) => {
      const entry = entriesByFeatureId.get(feature.id);
      if (!entry) return;

      if (feature.input_type === "boolean") {
        if (entry.boolean_answer === true) badges.push(getDisplayFeatureName(feature.name));
        return;
      }

      if (feature.input_type === "single_select") {
        const selectedIds = selectedChoiceIdsByEntryId.get(entry.id) ?? [];
        selectedIds.forEach((choiceId) => {
          const label = choiceNameById.get(choiceId);
          if (label) badges.push(label);
        });
        return;
      }

      if (feature.input_type === "multi_select") {
        if (isLegacyStudentAgeMultiSelectFeature(feature)) return;
        const selectedIds = selectedChoiceIdsByEntryId.get(entry.id) ?? [];
        selectedIds.forEach((choiceId) => {
          const label = choiceNameById.get(choiceId);
          if (label) badges.push(label);
        });
        return;
      }

      if (feature.input_type === "text") {
        const value = (entry.text_answer ?? "").trim();
        if (!value) return;
        badges.push(`${getDisplayFeatureName(feature.name)}: ${value}`);
        return;
      }

      if (feature.input_type === "number") {
        if (isStudentAgeRangeNumberFeature(feature)) return;
        if (typeof entry.number_answer !== "number" || !Number.isFinite(entry.number_answer)) return;
        const unit = (feature.unit ?? "").trim();
        badges.push(`${getDisplayFeatureName(feature.name)}: ${entry.number_answer}${unit ? ` ${unit}` : ""}`);
      }
    });
    return Array.from(new Set(badges));
  };

  const badgeSections: PublicFeatureGroupSection[] = badgeGroups
    .map((group) => ({
      id: group.id,
      name: group.name,
      badges: buildBadgesForGroup(group),
    }))
    .filter((section) => section.badges.length > 0);

  badgeGroups.forEach((group) => {
    const groupFeatures = definitions
      .filter((feature) => feature.group_id === group.id)
      .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999));
    groupFeatures.forEach((feature) => {
      if (isLegacyStudentAgeMultiSelectFeature(feature)) return;
      if (isStudentAgeRangeNumberFeature(feature)) return;
      const value = extractFeatureValue(feature);
      if (!value || (Array.isArray(value) && value.length === 0)) return;
      const label = getDisplayFeatureName(feature.name ?? "");
      if (!label) return;
      pushCompareValue(feature, group, group.name, label, value, feature.display_order ?? 9999);
    });
  });

  const hasAny = (...needles: string[]) => (text: string) =>
    needles.some((needle) => text.includes(needle));
  const academicLines: AcademicFeatureLine[] = [];
  if (primaryStructuredGroup) {
    const academicFeatures = definitions.filter(
      (feature) => feature.group_id === primaryStructuredGroup.id,
    );
    const findBy = (matcher: (text: string) => boolean) =>
      academicFeatures.find((feature) => {
        const text = normalize(`${feature.slug ?? ""} ${feature.name ?? ""}`);
        return matcher(text);
      });
    const usedFeatureIds = new Set<number>();
    const pull = (label: string, matcher: (text: string) => boolean, isBadgeList?: boolean) => {
      const feature = findBy(matcher);
      if (!feature) return;
      const value = extractFeatureValue(feature);
      if (!value || (Array.isArray(value) && value.length === 0)) return;
      usedFeatureIds.add(feature.id);
      academicLines.push({ label, value, isBadgeList });
      pushCompareValue(
        feature,
        primaryStructuredGroup,
        BASLICA_GROUP_TITLE,
        label,
        value,
        academicLines.length,
      );
    };
    pull(
      "Kurum Türü",
      hasAny("okul durumu", "okul turu", "okul_turu", "okul-turu", "kurum turu", "kurum-turu", "kurum_turu"),
    );
    pull("Eğitim Türü", hasAny("egitim turu", "egitim_turu"));
    pull("Eğitim Dili", hasAny("egitim dili", "egitim_dili"));
    pull(
      "Kurum Saatleri",
      hasAny(
        "okul saatleri",
        "okul_saatleri",
        "okul-saatleri",
        "kurum saatleri",
        "kurum_saatleri",
        "kurum-saatleri",
        "saat",
      ),
    );
    {
      const ageDefs = findStudentAgeRangeDefinitions(academicFeatures);
      if (ageDefs.min && ageDefs.max) {
        const minEntry = entriesByFeatureId.get(ageDefs.min.id);
        const maxEntry = entriesByFeatureId.get(ageDefs.max.id);
        const minVal =
          typeof minEntry?.number_answer === "number" && Number.isFinite(minEntry.number_answer)
            ? minEntry.number_answer
            : null;
        const maxVal =
          typeof maxEntry?.number_answer === "number" && Number.isFinite(maxEntry.number_answer)
            ? maxEntry.number_answer
            : null;
        if (minVal != null && maxVal != null) {
          usedFeatureIds.add(ageDefs.min.id);
          usedFeatureIds.add(ageDefs.max.id);
          const ageLabel = STUDENT_AGE_RANGE_LABEL;
          const ageValue = formatStudentAgeDisplay(minVal, maxVal);
          academicLines.push({
            label: ageLabel,
            value: ageValue,
          });
          compareValues.push({
            rowKey: `student-age:${primaryStructuredGroup.id}`,
            groupId: primaryStructuredGroup.id,
            groupTitle: BASLICA_GROUP_TITLE,
            groupDisplayOrder: primaryStructuredGroup.display_order ?? 9999,
            sortIndex: academicLines.length,
            label: ageLabel,
            cell: { kind: "text", value: ageValue },
          });
        }
      }
    }
    pull("Ortalama Sınıf Mevcudu", hasAny("ortalama sinif mevcudu", "sinif mevcudu", "mevcud"));
    pull("Hizmet Tipi", hasAny("hizmet tipi", "hizmet_tipi", "servis tipi", "service_type", "service type"));
    pull(
      "Aylık Ortalama Fiyat Aralığı",
      hasAny(
        "fiyat araligi",
        "fiyat_araligi",
        "aylik ortalama fiyat",
        "ortalama fiyat",
        "price_range",
        "monthly price",
      ),
    );

    const orderedRest = [...academicFeatures].sort(
      (a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999),
    );
    for (const feature of orderedRest) {
      if (usedFeatureIds.has(feature.id)) continue;
      if (isStudentAgeRangeNumberFeature(feature)) continue;
      if (isLegacyStudentAgeMultiSelectFeature(feature)) continue;
      const value = extractFeatureValue(feature);
      if (!value || (Array.isArray(value) && value.length === 0)) continue;
      const label = getDisplayFeatureName(feature.name ?? "");
      if (!label) continue;
      usedFeatureIds.add(feature.id);
      academicLines.push({
        label,
        value,
        ...(feature.input_type === "multi_select" && Array.isArray(value) ? { isBadgeList: true } : {}),
        ...(feature.input_type === "single_select" && Array.isArray(value) ? { isBadgeList: true } : {}),
      });
      pushCompareValue(
        feature,
        primaryStructuredGroup,
        BASLICA_GROUP_TITLE,
        label,
        value,
        1000 + (feature.display_order ?? 9999),
      );
    }
  }

  return { academicLines, badgeSections, compareValues };
}

export function alignInstitutionCompareFeatureRows(
  columns: Array<{ compareValues: PublicFeatureCompareValue[] }>,
): InstitutionCompareFeatureSection[] {
  type SectionAcc = {
    groupId: number;
    title: string;
    displayOrder: number;
    isBaslica: boolean;
    rows: Map<
      string,
      {
        rowKey: string;
        label: string;
        sortIndex: number;
      }
    >;
  };

  const sections = new Map<number, SectionAcc>();

  columns.forEach((column) => {
    column.compareValues.forEach((value) => {
      const isBaslica = normalizeFeatureGroupNameKey(value.groupTitle) === BASLICA_GROUP_NAME_KEY;
      const existing = sections.get(value.groupId);
      if (!existing) {
        sections.set(value.groupId, {
          groupId: value.groupId,
          title: value.groupTitle,
          displayOrder: value.groupDisplayOrder,
          isBaslica,
          rows: new Map([
            [
              value.rowKey,
              {
                rowKey: value.rowKey,
                label: value.label,
                sortIndex: value.sortIndex,
              },
            ],
          ]),
        });
        return;
      }
      existing.displayOrder = Math.min(existing.displayOrder, value.groupDisplayOrder);
      const row = existing.rows.get(value.rowKey);
      if (!row) {
        existing.rows.set(value.rowKey, {
          rowKey: value.rowKey,
          label: value.label,
          sortIndex: value.sortIndex,
        });
        return;
      }
      row.sortIndex = Math.min(row.sortIndex, value.sortIndex);
    });
  });

  const valueMaps = columns.map((column) => {
    const map = new Map<string, PublicFeatureCompareCell>();
    column.compareValues.forEach((value) => {
      map.set(value.rowKey, value.cell);
    });
    return map;
  });

  return Array.from(sections.values())
    .sort((a, b) => {
      if (a.isBaslica !== b.isBaslica) return a.isBaslica ? -1 : 1;
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return a.groupId - b.groupId;
    })
    .map((section) => {
      const rows = Array.from(section.rows.values())
        .sort((a, b) => a.sortIndex - b.sortIndex || a.rowKey.localeCompare(b.rowKey))
        .map((row) => {
          const cells = valueMaps.map((map) => map.get(row.rowKey) ?? { kind: "empty" as const });
          return {
            rowKey: row.rowKey,
            label: row.label,
            cells,
          };
        })
        .filter((row) => row.cells.some((cell) => !isPublicFeatureCompareCellEmpty(cell)));

      return {
        groupId: section.groupId,
        title: section.title,
        rows,
      };
    })
    .filter((section) => section.rows.length > 0);
}
