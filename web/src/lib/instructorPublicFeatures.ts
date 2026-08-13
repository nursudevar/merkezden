import {
  getDisplayInstructorFeatureName,
  isInstructorBaslicaFeatureGroupName,
  parseValidTimeHHMM,
  resolveInstructorBaslicaFeatureGroupForCategory,
  resolveInstructorFeatureGroupsForActiveCategory,
  type InstructorFeatureGroupRow,
} from "@/lib/instructorFeaturesClient";
import {
  STUDENT_AGE_RANGE_LABEL,
  findStudentAgeRangeDefinitions,
  formatStudentAgeDisplay,
  isLegacyStudentAgeMultiSelectFeature,
  isStudentAgeRangeNumberFeature,
} from "@/lib/studentAgeRangeFeature";

export type InstructorPublicFeatureDefinition = {
  id: number;
  group_id: number;
  name: string;
  slug: string | null;
  input_type: string;
  unit: string | null;
  display_order: number | null;
};

export type InstructorPublicFeatureEntry = {
  id: number;
  feature_definition_id: number;
  text_answer: string | null;
  number_answer: number | null;
  boolean_answer: boolean | null;
  selected_choice_id: number | null;
};

export type InstructorPublicFeatureChoice = {
  id: number;
  feature_definition_id: number;
  name: string | null;
  display_order?: number | null;
};

export type InstructorPublicFeatureEntryChoice = {
  instructor_feature_entry_id: number;
  choice_id: number;
};

export type PublicInstructorFeatureLine = {
  label: string;
  value: string | string[];
  isBadgeList?: boolean;
};

export type PublicInstructorFeatureSection = {
  id: number;
  name: string;
  badges: string[];
};

export type InstructorPublicFeatureCompareCell =
  | { kind: "empty" }
  | { kind: "boolean"; value: true }
  | { kind: "text"; value: string };

export type InstructorPublicFeatureCompareValue = {
  rowKey: string;
  groupId: number;
  groupTitle: string;
  groupDisplayOrder: number;
  sortIndex: number;
  label: string;
  cell: InstructorPublicFeatureCompareCell;
};

export type InstructorCompareFeatureSection = {
  groupId: number;
  title: string;
  rows: Array<{
    rowKey: string;
    label: string;
    cells: InstructorPublicFeatureCompareCell[];
  }>;
};

const BASLICA_GROUP_NAME_KEY = "başlıca özellikler";
const BASLICA_GROUP_TITLE = "Başlıca Özellikler";

function normalizeFeatureGroupNameKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLocaleLowerCase("tr-TR");
}

function toCompareCell(
  feature: InstructorPublicFeatureDefinition,
  value: string | string[],
): InstructorPublicFeatureCompareCell {
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

export function isInstructorPublicFeatureCompareCellEmpty(
  cell: InstructorPublicFeatureCompareCell | undefined,
): boolean {
  if (!cell || cell.kind === "empty") return true;
  if (cell.kind === "boolean") return false;
  return !cell.value.trim();
}

export function formatInstructorPublicFeatureCompareCell(
  cell: InstructorPublicFeatureCompareCell,
): string {
  if (cell.kind === "boolean") return "✓";
  if (cell.kind === "text") return cell.value;
  return "—";
}

/**
 * Public eğitmen profilindeki feature görünümünü üretir.
 * Karşılaştırma sayfası da aynı mapping’i kullanır (compareValues).
 */
export function mapPublicInstructorFeatures(args: {
  groups: InstructorFeatureGroupRow[];
  definitions: InstructorPublicFeatureDefinition[];
  choices: InstructorPublicFeatureChoice[];
  entries: InstructorPublicFeatureEntry[];
  entryChoices: InstructorPublicFeatureEntryChoice[];
  categorySlug: string | null;
}): {
  academicLines: PublicInstructorFeatureLine[];
  sections: PublicInstructorFeatureSection[];
  compareValues: InstructorPublicFeatureCompareValue[];
} {
  const { groups: rawGroups, definitions, choices, entries, entryChoices, categorySlug } = args;
  const instructorCategorySlug = String(categorySlug ?? "").trim() || null;
  const compareValues: InstructorPublicFeatureCompareValue[] = [];

  const groups = resolveInstructorFeatureGroupsForActiveCategory(
    rawGroups,
    instructorCategorySlug,
  ).sort(
    (a, b) =>
      (Number.isFinite(Number(a.display_order)) ? Number(a.display_order) : Number.MAX_SAFE_INTEGER) -
      (Number.isFinite(Number(b.display_order)) ? Number(b.display_order) : Number.MAX_SAFE_INTEGER),
  );

  const visibleGroupIds = new Set(groups.map((g) => g.id));
  const visibleDefinitions = definitions.filter((d) => visibleGroupIds.has(d.group_id));

  const entriesByFeatureId = new Map(entries.map((e) => [e.feature_definition_id, e]));
  const choiceNameById = new Map<number, string>();
  const choiceOrderById = new Map<number, number>();
  choices.forEach((c) => {
    const label = String(c.name ?? "").trim();
    if (label) choiceNameById.set(c.id, label);
    choiceOrderById.set(
      c.id,
      Number.isFinite(Number(c.display_order)) ? Number(c.display_order) : Number.MAX_SAFE_INTEGER,
    );
  });
  const choiceIdsByEntryId = new Map<number, number[]>();
  entryChoices.forEach((row) => {
    const current = choiceIdsByEntryId.get(row.instructor_feature_entry_id) ?? [];
    if (!current.includes(row.choice_id)) current.push(row.choice_id);
    choiceIdsByEntryId.set(row.instructor_feature_entry_id, current);
  });

  const orderedChoiceLabels = (choiceIds: number[]): string[] => {
    return [...choiceIds]
      .sort(
        (a, b) =>
          (choiceOrderById.get(a) ?? Number.MAX_SAFE_INTEGER) -
          (choiceOrderById.get(b) ?? Number.MAX_SAFE_INTEGER),
      )
      .map((id) => choiceNameById.get(id) ?? "")
      .filter(Boolean);
  };

  const extractValue = (feature: InstructorPublicFeatureDefinition): string | string[] | null => {
    const entry = entriesByFeatureId.get(feature.id);
    if (!entry) return null;

    if (feature.input_type === "boolean") {
      return entry.boolean_answer === true ? "Evet" : null;
    }

    if (feature.input_type === "single_select") {
      if (entry.selected_choice_id != null) {
        const label = choiceNameById.get(Number(entry.selected_choice_id));
        return label ?? null;
      }
      const labels = orderedChoiceLabels(choiceIdsByEntryId.get(entry.id) ?? []);
      return labels[0] ?? null;
    }

    if (feature.input_type === "multi_select") {
      const labels = orderedChoiceLabels(choiceIdsByEntryId.get(entry.id) ?? []);
      return labels.length > 0 ? labels : null;
    }

    if (feature.input_type === "number") {
      if (typeof entry.number_answer !== "number" || !Number.isFinite(entry.number_answer)) return null;
      const unit = String(feature.unit ?? "").trim();
      return `${entry.number_answer}${unit ? ` ${unit}` : ""}`.trim();
    }

    if (feature.input_type === "date") {
      const d = entry.text_answer ? String(entry.text_answer).slice(0, 10) : "";
      return d || null;
    }

    const text = String(entry.text_answer ?? "").trim();
    if (!text) return null;
    const validTime = parseValidTimeHHMM(text);
    if (validTime) return validTime;
    return text;
  };

  const pushCompareValue = (
    feature: InstructorPublicFeatureDefinition,
    group: InstructorFeatureGroupRow,
    groupTitle: string,
    label: string,
    value: string | string[],
    sortIndex: number,
  ) => {
    const cell = toCompareCell(feature, value);
    if (isInstructorPublicFeatureCompareCellEmpty(cell)) return;
    compareValues.push({
      rowKey: `def:${feature.id}`,
      groupId: group.id,
      groupTitle,
      groupDisplayOrder: Number.isFinite(Number(group.display_order))
        ? Number(group.display_order)
        : 9999,
      sortIndex,
      label,
      cell,
    });
  };

  const buildLinesForGroup = (group: InstructorFeatureGroupRow): PublicInstructorFeatureLine[] => {
    const groupId = group.id;
    const lines: PublicInstructorFeatureLine[] = [];
    const features = visibleDefinitions
      .filter((f) => f.group_id === groupId)
      .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999));

    const usedIds = new Set<number>();
    const ageDefs = findStudentAgeRangeDefinitions(visibleDefinitions);
    const ageInThisGroup =
      ageDefs.min &&
      ageDefs.max &&
      (ageDefs.min.group_id === groupId || ageDefs.max.group_id === groupId);
    if (ageInThisGroup && ageDefs.min && ageDefs.max) {
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
        usedIds.add(ageDefs.min.id);
        usedIds.add(ageDefs.max.id);
        if (ageDefs.min.group_id === groupId) {
          const ageLabel = STUDENT_AGE_RANGE_LABEL;
          const ageValue = formatStudentAgeDisplay(minVal, maxVal);
          lines.push({
            label: ageLabel,
            value: ageValue,
          });
          compareValues.push({
            rowKey: `student-age:${groupId}`,
            groupId,
            groupTitle: BASLICA_GROUP_TITLE,
            groupDisplayOrder: Number.isFinite(Number(group.display_order))
              ? Number(group.display_order)
              : 9999,
            sortIndex: lines.length,
            label: ageLabel,
            cell: { kind: "text", value: ageValue },
          });
        }
      }
    }

    for (const feature of features) {
      if (usedIds.has(feature.id)) continue;
      if (isStudentAgeRangeNumberFeature(feature)) continue;
      if (isLegacyStudentAgeMultiSelectFeature(feature)) continue;
      const value = extractValue(feature);
      if (!value || (Array.isArray(value) && value.length === 0)) continue;
      const label = getDisplayInstructorFeatureName(String(feature.name ?? "").trim());
      if (!label) continue;
      lines.push({
        label,
        value,
        ...(feature.input_type === "multi_select" && Array.isArray(value) ? { isBadgeList: true } : {}),
      });
      pushCompareValue(
        feature,
        group,
        BASLICA_GROUP_TITLE,
        label,
        value,
        1000 + (feature.display_order ?? 9999),
      );
    }
    return lines;
  };

  const buildBadgesForGroup = (groupId: number): string[] => {
    const badges: string[] = [];
    const features = visibleDefinitions
      .filter((f) => f.group_id === groupId)
      .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999));

    const ageDefs = findStudentAgeRangeDefinitions(features);
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
        badges.push(`${STUDENT_AGE_RANGE_LABEL}: ${formatStudentAgeDisplay(minVal, maxVal)}`);
      }
    }

    for (const feature of features) {
      if (isStudentAgeRangeNumberFeature(feature)) continue;
      if (isLegacyStudentAgeMultiSelectFeature(feature)) continue;
      const entry = entriesByFeatureId.get(feature.id);
      if (!entry) continue;
      const label = getDisplayInstructorFeatureName(String(feature.name ?? "").trim());

      if (feature.input_type === "boolean") {
        if (entry.boolean_answer === true) badges.push(label);
        continue;
      }

      if (feature.input_type === "single_select") {
        if (entry.selected_choice_id != null) {
          const choiceLabel = choiceNameById.get(Number(entry.selected_choice_id));
          if (choiceLabel) badges.push(choiceLabel);
        } else {
          orderedChoiceLabels(choiceIdsByEntryId.get(entry.id) ?? []).forEach((choiceLabel) => {
            badges.push(choiceLabel);
          });
        }
        continue;
      }

      if (feature.input_type === "multi_select") {
        orderedChoiceLabels(choiceIdsByEntryId.get(entry.id) ?? []).forEach((choiceLabel) => {
          badges.push(choiceLabel);
        });
        continue;
      }

      const value = extractValue(feature);
      if (!value) continue;
      if (Array.isArray(value)) {
        value.forEach((v) => badges.push(v));
      } else if (
        feature.input_type === "text" ||
        feature.input_type === "number" ||
        feature.input_type === "date"
      ) {
        badges.push(`${label}: ${value}`);
      }
    }

    return Array.from(new Set(badges));
  };

  const baslicaGroup = resolveInstructorBaslicaFeatureGroupForCategory(
    groups,
    instructorCategorySlug,
  );

  const academicLines: PublicInstructorFeatureLine[] = baslicaGroup
    ? buildLinesForGroup(baslicaGroup)
    : [];

  const badgeGroups = groups.filter((group) => {
    if (baslicaGroup && group.id === baslicaGroup.id) return false;
    if (isInstructorBaslicaFeatureGroupName(group.name)) return false;
    return true;
  });

  badgeGroups.forEach((group) => {
    const features = visibleDefinitions
      .filter((f) => f.group_id === group.id)
      .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999));

    const ageDefs = findStudentAgeRangeDefinitions(features);
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
        compareValues.push({
          rowKey: `student-age:${group.id}`,
          groupId: group.id,
          groupTitle: group.name,
          groupDisplayOrder: Number.isFinite(Number(group.display_order))
            ? Number(group.display_order)
            : 9999,
          sortIndex: 0,
          label: STUDENT_AGE_RANGE_LABEL,
          cell: { kind: "text", value: formatStudentAgeDisplay(minVal, maxVal) },
        });
      }
    }

    for (const feature of features) {
      if (isStudentAgeRangeNumberFeature(feature)) continue;
      if (isLegacyStudentAgeMultiSelectFeature(feature)) continue;
      const value = extractValue(feature);
      if (!value || (Array.isArray(value) && value.length === 0)) continue;
      const label = getDisplayInstructorFeatureName(String(feature.name ?? "").trim());
      if (!label) continue;
      pushCompareValue(feature, group, group.name, label, value, feature.display_order ?? 9999);
    }
  });

  const sections: PublicInstructorFeatureSection[] = badgeGroups
    .map((group) => ({
      id: group.id,
      name: group.name,
      badges: buildBadgesForGroup(group.id),
    }))
    .filter((s) => s.badges.length > 0);

  return { academicLines, sections, compareValues };
}

export function alignInstructorCompareFeatureRows(
  columns: Array<{ compareValues: InstructorPublicFeatureCompareValue[] }>,
): InstructorCompareFeatureSection[] {
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
    const map = new Map<string, InstructorPublicFeatureCompareCell>();
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
        .filter((row) =>
          row.cells.some((cell) => !isInstructorPublicFeatureCompareCellEmpty(cell)),
        );

      return {
        groupId: section.groupId,
        title: section.title,
        rows,
      };
    })
    .filter((section) => section.rows.length > 0);
}
