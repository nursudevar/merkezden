"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Fragment, useEffect, useRef, useState } from "react";
import { Building, Building2, CreditCard, Info, List, Star } from "lucide-react";
import { StudentAgeRangeFields } from "@/components/features/StudentAgeRangeFields";
import {
  isInstructorBaslicaFeatureGroupName,
  compareInstructorDersSeviyesiOptions,
  compareInstructorEgitmenProfiliChoices,
  compareInstructorHizmetYeriOptions,
  instructorEgitmenProfiliChoiceKey,
  isInstructorDenemeDersiFeature,
  isInstructorDersSeviyesiBooleanOption,
  isInstructorEgitimDiliFeature,
  isInstructorEgitmenProfiliFeature,
  isInstructorHizmetTipiFeature,
  isInstructorHizmetYeriBooleanOption,
  isInstructorPriceRangeFeature,
  isInstructorTimeTextFeature,
  resolveInstructorEgitmenProfiliSelectedChoiceId,
  INSTRUCTOR_EGITMEN_PROFILI_LABEL,
} from "@/lib/instructorFeaturesClient";
import {
  isLegacyStudentAgeMultiSelectFeature,
  isStudentAgeMaxFeature,
  isStudentAgeMinFeature,
  isStudentAgeRangeNumberFeature,
  validateStudentAgeRangeValues,
} from "@/lib/studentAgeRangeFeature";
import {
  LESSON_DURATION_LABEL,
  LESSON_DURATION_MAX_INPUT_LABEL,
  LESSON_DURATION_MIN_INPUT_LABEL,
  LESSON_DURATION_PANEL_FORMAT_ERROR,
  LESSON_DURATION_PANEL_LABEL,
  LESSON_DURATION_PANEL_PLACEHOLDER,
  LESSON_DURATION_UNIT_LABEL,
  formatLessonDurationPanelInput,
  isLessonDurationMaxFeature,
  isLessonDurationMinFeature,
  isLessonDurationRangeNumberFeature,
  parseLessonDurationPanelInput,
  sanitizeLessonDurationInput,
  validateLessonDurationRangeValues,
} from "@/lib/instructorLessonDurationFeature";

function sortPanelOptionItemsByLabel<T>(items: T[], getLabel: (item: T) => string): T[] {
  return [...items].sort((a, b) =>
    getLabel(a).localeCompare(getLabel(b), "tr", { sensitivity: "base" }),
  );
}

/**
 * Global Başlıca görünüm sırası. 20 = Fiyat Aralığı, 60 = Müsait Saat Aralığı
 * (kolon alanları; definition listesinde yok).
 */
function globalBaslicaCommonFieldSlot(feature: {
  name?: string | null;
  slug?: string | null;
  input_type?: string | null;
}): number | null {
  if (isInstructorHizmetTipiFeature(feature)) return 10;
  if (isInstructorHizmetYeriBooleanOption(feature)) return 30;
  if (isInstructorEgitimDiliFeature(feature)) return 40;
  if (isStudentAgeRangeNumberFeature(feature)) return 50;
  if (isInstructorDersSeviyesiBooleanOption(feature)) return 70;
  if (isLessonDurationRangeNumberFeature(feature)) return 80;
  if (isInstructorEgitmenProfiliFeature(feature)) return 90;
  if (isInstructorDenemeDersiFeature(feature)) return 100;
  return null;
}

function sortGlobalBaslicaPanelFeatures<
  T extends { name?: string | null; slug?: string | null; input_type?: string | null },
>(features: T[]): T[] {
  return features
    .map((feature, index) => ({
      feature,
      index,
      slot: globalBaslicaCommonFieldSlot(feature) ?? 1000,
    }))
    .sort((a, b) => a.slot - b.slot || a.index - b.index)
    .map((item) => item.feature);
}

function lastIndexWithGlobalBaslicaSlotAtMost(
  features: Array<{ name?: string | null; slug?: string | null; input_type?: string | null }>,
  maxSlot: number,
): number {
  let found = -1;
  features.forEach((feature, index) => {
    const slot = globalBaslicaCommonFieldSlot(feature);
    if (slot != null && slot <= maxSlot) found = index;
  });
  return found;
}

function firstIndexOfHighestGlobalBaslicaSlotAtMost(
  features: Array<{ name?: string | null; slug?: string | null; input_type?: string | null }>,
  maxSlot: number,
): number {
  let bestSlot = -1;
  let bestIndex = -1;
  features.forEach((feature, index) => {
    const slot = globalBaslicaCommonFieldSlot(feature);
    if (slot == null || slot > maxSlot || slot <= bestSlot) return;
    bestSlot = slot;
    bestIndex = index;
  });
  return bestIndex;
}

type InstructorFeatureChoiceRow = {
  id: number;
  feature_definition_id: number;
  name?: string | null;
  display_order?: number | null;
  is_active: boolean;
};

export type InstructorFeatureSelectionGroup = {
  group: {
    id: number;
    name: string;
    slug?: string | null;
    category_slug?: string | null;
    display_order?: number | null;
  };
  features: InstructorFeatureDefinitionForSelection[];
};

export type InstructorFeatureDefinitionForSelection = {
  id: number;
  name: string;
  slug: string | null;
  input_type: string;
  help_text: string | null;
  placeholder: string | null;
  unit: string | null;
};

function sortInstructorPanelFeatureChoices(
  choices: InstructorFeatureChoiceRow[],
  feature: Pick<InstructorFeatureDefinitionForSelection, "id" | "name" | "slug">,
): InstructorFeatureChoiceRow[] {
  const filtered = choices.filter(
    (choice) => choice.feature_definition_id === feature.id && choice.is_active,
  );
  if (isInstructorPriceRangeFeature(feature)) {
    return [...filtered].sort((a, b) => {
      const orderA = Number.isFinite(Number(a.display_order))
        ? Number(a.display_order)
        : Number.MAX_SAFE_INTEGER;
      const orderB = Number.isFinite(Number(b.display_order))
        ? Number(b.display_order)
        : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.id - b.id;
    });
  }
  return sortPanelOptionItemsByLabel(filtered, (choice) => choice.name?.trim() || "");
}

function normalizeInstructorPanelFeatureKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

const BASLICA_PRICE_ANCHOR_KEYS = new Set([
  "hizmet tipi",
  "hizmet tipleri",
  "ders tipi",
  "ders tipleri",
  "egitmen seviyesi",
  "egitmenin seviyesi",
  "egitmen duzeyi",
]);

function isBaslicaPriceAnchorFeature(feature: { name: string; slug: string | null }): boolean {
  return [feature.name, feature.slug ?? ""].some((value) =>
    BASLICA_PRICE_ANCHOR_KEYS.has(normalizeInstructorPanelFeatureKey(value)),
  );
}

function findLastBaslicaPriceAnchorIndex(
  features: Array<{ name: string; slug: string | null }>,
): number {
  for (let index = features.length - 1; index >= 0; index -= 1) {
    const feature = features[index];
    if (isInstructorPriceRangeFeature(feature)) continue;
    if (isBaslicaPriceAnchorFeature(feature)) return index;
  }
  return -1;
}

type InstructorFeatureSelectionGroupListProps = {
  groups: InstructorFeatureSelectionGroup[];
  getDisplayFeatureName: (name: string) => string;
  instructorTextFeatureValues: Record<number, string>;
  setInstructorTextFeatureValues: Dispatch<SetStateAction<Record<number, string>>>;
  instructorNumberFeatureValues: Record<number, string>;
  setInstructorNumberFeatureValues: Dispatch<SetStateAction<Record<number, string>>>;
  instructorDateFeatureValues: Record<number, string>;
  setInstructorDateFeatureValues: Dispatch<SetStateAction<Record<number, string>>>;
  instructorBooleanFeatureValues: Record<number, boolean>;
  setInstructorBooleanFeatureValues: Dispatch<SetStateAction<Record<number, boolean>>>;
  instructorSingleSelectValues: Record<number, string>;
  setInstructorSingleSelectValues: Dispatch<SetStateAction<Record<number, string>>>;
  instructorMultiSelectValues: Record<number, string[]>;
  setInstructorMultiSelectValues: Dispatch<SetStateAction<Record<number, string[]>>>;
  instructorFeatureChoices: InstructorFeatureChoiceRow[];
  openInstructorSelectId: number | null;
  setOpenInstructorSelectId: Dispatch<SetStateAction<number | null>>;
  studentAgeRangeError?: string | null;
  setStudentAgeRangeError?: Dispatch<SetStateAction<string | null>>;
  baslicaPriceRange?: ReactNode;
  baslicaAvailableHours?: ReactNode;
  onLessonDurationPanelError?: (message: string | null) => void;
};

export function InstructorFeatureSelectionGroupList({
  groups,
  getDisplayFeatureName,
  instructorTextFeatureValues,
  setInstructorTextFeatureValues,
  instructorNumberFeatureValues,
  setInstructorNumberFeatureValues,
  instructorDateFeatureValues,
  setInstructorDateFeatureValues,
  instructorBooleanFeatureValues,
  setInstructorBooleanFeatureValues,
  instructorSingleSelectValues,
  setInstructorSingleSelectValues,
  instructorMultiSelectValues,
  setInstructorMultiSelectValues,
  instructorFeatureChoices,
  openInstructorSelectId,
  setOpenInstructorSelectId,
  studentAgeRangeError = null,
  setStudentAgeRangeError,
  baslicaPriceRange = null,
  baslicaAvailableHours = null,
  onLessonDurationPanelError,
}: InstructorFeatureSelectionGroupListProps) {
  const [lessonDurationDraft, setLessonDurationDraft] = useState<string | null>(null);
  const lessonDurationSourceKeyRef = useRef<string | null>(null);
  const globalLessonDuration = (() => {
    for (const item of groups) {
      if (!isInstructorBaslicaFeatureGroupName(item.group.name)) continue;
      if (String(item.group.category_slug ?? "").trim()) continue;
      const minFeature = item.features.find((feature) => isLessonDurationMinFeature(feature));
      const maxFeature = item.features.find((feature) => isLessonDurationMaxFeature(feature));
      if (!minFeature || !maxFeature) continue;
      return { minFeature, maxFeature };
    }
    return null;
  })();
  const lessonDurationSourceKey = globalLessonDuration
    ? `${globalLessonDuration.minFeature.id}:${instructorNumberFeatureValues[globalLessonDuration.minFeature.id] ?? ""}|${globalLessonDuration.maxFeature.id}:${instructorNumberFeatureValues[globalLessonDuration.maxFeature.id] ?? ""}`
    : "";
  const lessonDurationCanonical = globalLessonDuration
    ? formatLessonDurationPanelInput(
        instructorNumberFeatureValues[globalLessonDuration.minFeature.id] ?? "",
        instructorNumberFeatureValues[globalLessonDuration.maxFeature.id] ?? "",
      )
    : "";
  const lessonDurationShown = lessonDurationDraft ?? lessonDurationCanonical;

  useEffect(() => {
    if (lessonDurationSourceKeyRef.current === null) {
      lessonDurationSourceKeyRef.current = lessonDurationSourceKey;
      return;
    }
    if (lessonDurationSourceKeyRef.current === lessonDurationSourceKey) return;
    lessonDurationSourceKeyRef.current = lessonDurationSourceKey;
    setLessonDurationDraft(null);
  }, [lessonDurationSourceKey]);

  useEffect(() => {
    if (!onLessonDurationPanelError) return;
    if (!lessonDurationSourceKey) {
      onLessonDurationPanelError(null);
      return;
    }
    const parsed = parseLessonDurationPanelInput(lessonDurationShown);
    onLessonDurationPanelError(
      parsed.kind === "invalid" ? LESSON_DURATION_PANEL_FORMAT_ERROR : null,
    );
  }, [lessonDurationShown, lessonDurationSourceKey, onLessonDurationPanelError]);

  const baslicaPresentationGroupId = (() => {
    if (!baslicaPriceRange && !baslicaAvailableHours) return null;
    const baslicaGroups = groups.filter((item) =>
      isInstructorBaslicaFeatureGroupName(item.group.name),
    );
    const categorySpecific = baslicaGroups.find((item) =>
      String(item.group.category_slug ?? "").trim(),
    );
    const globalGroup = baslicaGroups.find(
      (item) => !String(item.group.category_slug ?? "").trim(),
    );
    return (categorySpecific ?? globalGroup)?.group.id ?? null;
  })();

  const renderBaslicaBooleanPills = (
    options: Array<{ id: number; name: string }>,
  ) => (
    <div className="egitmen-panel-features-feature-multi">
      {options.map((option) => {
        const isSelected = Boolean(instructorBooleanFeatureValues[option.id]);
        return (
          <button
            key={option.id}
            type="button"
            className={`egitmen-panel-features-feature-chip${isSelected ? " is-selected" : ""}`}
            aria-pressed={isSelected}
            onClick={() =>
              setInstructorBooleanFeatureValues((prev) => ({
                ...prev,
                [option.id]: !Boolean(prev[option.id]),
              }))
            }
          >
            <span className="egitmen-panel-features-feature-chip-check" aria-hidden>
              {isSelected ? "✓" : ""}
            </span>
            <span>{getDisplayFeatureName(option.name)}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {groups.map(({ group, features }) => {
        const visibleFeatures = features.filter((feature) => !isLegacyStudentAgeMultiSelectFeature(feature));
        const isGlobalBaslicaOrder =
          isInstructorBaslicaFeatureGroupName(group.name) &&
          !String(group.category_slug ?? "").trim();
        const hasSpecialNonOptionFeature = visibleFeatures.some(
          (feature) =>
            isStudentAgeRangeNumberFeature(feature) ||
            feature.input_type === "number" ||
            feature.input_type === "text" ||
            feature.input_type === "date",
        );
        const groupCategorySlug = String(group.category_slug ?? "")
          .trim()
          .toLocaleLowerCase("tr-TR");
        const keepDefinitionOrder =
          groupCategorySlug === "surucu-kursu" || groupCategorySlug === "ozel-egitim";
        const featuresToRender = isGlobalBaslicaOrder
          ? sortGlobalBaslicaPanelFeatures(visibleFeatures)
          : hasSpecialNonOptionFeature || keepDefinitionOrder
            ? visibleFeatures
            : sortPanelOptionItemsByLabel(visibleFeatures, (feature) =>
                getDisplayFeatureName(feature.name),
              );
        const ageMinFeature = visibleFeatures.find((f) => isStudentAgeMinFeature(f));
        const ageMaxFeature = visibleFeatures.find((f) => isStudentAgeMaxFeature(f));
        const durationMinFeature = featuresToRender.find((feature) =>
          isLessonDurationMinFeature(feature),
        );
        const durationMaxFeature = featuresToRender.find((feature) =>
          isLessonDurationMaxFeature(feature),
        );
        let ageRangeRendered = false;
        let lessonDurationRendered = false;
        let hizmetYeriRendered = false;
        let dersSeviyesiRendered = false;
        const hizmetYeriFeatures = featuresToRender
          .filter((feature) => isInstructorHizmetYeriBooleanOption(feature))
          .sort(compareInstructorHizmetYeriOptions);
        const dersSeviyesiFeatures = featuresToRender
          .filter((feature) => isInstructorDersSeviyesiBooleanOption(feature))
          .sort(compareInstructorDersSeviyesiOptions);
        const placePriceHere = baslicaPriceRange != null && group.id === baslicaPresentationGroupId;
        const priceAnchorIndex = !placePriceHere
          ? -1
          : isGlobalBaslicaOrder
            ? lastIndexWithGlobalBaslicaSlotAtMost(featuresToRender, 10)
            : findLastBaslicaPriceAnchorIndex(featuresToRender);
        const placeHoursInOrder =
          isGlobalBaslicaOrder &&
          baslicaAvailableHours != null &&
          group.id === baslicaPresentationGroupId;
        const hoursAnchorIndex = placeHoursInOrder
          ? firstIndexOfHighestGlobalBaslicaSlotAtMost(featuresToRender, 50)
          : -1;
        let pricePlaced = false;
        let hoursPlaced = false;
        const prependGlobalPrice = placePriceHere && isGlobalBaslicaOrder && priceAnchorIndex < 0;
        const prependGlobalHours = placeHoursInOrder && hoursAnchorIndex < 0;
        if (prependGlobalPrice) pricePlaced = true;
        if (prependGlobalHours) hoursPlaced = true;
        const renderWithPrice = (node: ReactNode, index: number) => {
          const withPrice = placePriceHere && priceAnchorIndex >= 0 && index === priceAnchorIndex;
          const withHours = placeHoursInOrder && hoursAnchorIndex >= 0 && index === hoursAnchorIndex;
          if (withPrice) pricePlaced = true;
          if (withHours) hoursPlaced = true;
          if (!withPrice && !withHours) return node;
          return (
            <Fragment key={`baslica-order-${group.id}-${index}`}>
              {node}
              {withPrice ? baslicaPriceRange : null}
              {withHours ? baslicaAvailableHours : null}
            </Fragment>
          );
        };

        const updateAgeNumber = (featureId: number, value: string) => {
          const nextMin =
            ageMinFeature && featureId === ageMinFeature.id
              ? value
              : (instructorNumberFeatureValues[ageMinFeature?.id ?? -1] ?? "");
          const nextMax =
            ageMaxFeature && featureId === ageMaxFeature.id
              ? value
              : (instructorNumberFeatureValues[ageMaxFeature?.id ?? -1] ?? "");
          setInstructorNumberFeatureValues((prev) => ({ ...prev, [featureId]: value }));
          if (setStudentAgeRangeError && ageMinFeature && ageMaxFeature) {
            setStudentAgeRangeError(validateStudentAgeRangeValues(nextMin, nextMax));
          }
        };

        const groupNameKey = group.name.trim().toLocaleLowerCase("tr-TR");
        const groupHeaderMeta = (() => {
          if (groupNameKey === "başlıca özellikler") {
            return {
              titleClass: "egitmen-panel-features-group-title--academic",
              iconClass: "egitmen-panel-features-group-title-icon--academic",
              Icon: Info,
            };
          }
          if (groupNameKey === "okul imkanları") {
            return {
              titleClass: "egitmen-panel-features-group-title--school",
              iconClass: "egitmen-panel-features-group-title-icon--school",
              Icon: Building,
            };
          }
          if (groupNameKey === "fiziki imkanlar") {
            return {
              titleClass: "egitmen-panel-features-group-title--physical",
              iconClass: "egitmen-panel-features-group-title-icon--physical",
              Icon: Building2,
            };
          }
          if (groupNameKey === "eğitim sistemi") {
            return {
              titleClass: "egitmen-panel-features-group-title--academic",
              iconClass: "egitmen-panel-features-group-title-icon--academic",
              Icon: List,
            };
          }
          if (groupNameKey === "aktiviteler") {
            return {
              titleClass: "egitmen-panel-features-group-title--school",
              iconClass: "egitmen-panel-features-group-title-icon--school",
              Icon: Star,
            };
          }
          if (groupNameKey === "ödeme seçenekleri" || groupNameKey === "ödeme yöntemleri") {
            return {
              titleClass: "egitmen-panel-features-group-title--physical",
              iconClass: "egitmen-panel-features-group-title-icon--physical",
              Icon: CreditCard,
            };
          }
          if (
            groupNameKey === "sürücü kursu imkanları" ||
            groupNameKey === "sürücü kursu özellikleri"
          ) {
            return {
              titleClass: "egitmen-panel-features-group-title--school",
              iconClass: "egitmen-panel-features-group-title-icon--school",
              Icon: Building,
            };
          }
          return {
            titleClass: "egitmen-panel-features-group-title--physical",
            iconClass: "egitmen-panel-features-group-title-icon--physical",
            Icon: Building2,
          };
        })();

        return (
          <section key={group.id} className="egitmen-panel-features-group-item">
            <h4 className={`egitmen-panel-features-group-title ${groupHeaderMeta.titleClass}`}>
              <groupHeaderMeta.Icon
                className={`egitmen-panel-features-group-title-icon ${groupHeaderMeta.iconClass}`}
                aria-hidden
              />
              {group.name}
            </h4>
            <div className="egitmen-panel-features-features-grid egitmen-panel-features-features-grid--selection">
              {prependGlobalPrice ? baslicaPriceRange : null}
              {prependGlobalHours ? baslicaAvailableHours : null}
              {featuresToRender.map((feature, index) => {
                if (isInstructorPriceRangeFeature(feature)) {
                  return null;
                }

                if (isInstructorDersSeviyesiBooleanOption(feature)) {
                  if (dersSeviyesiRendered) return null;
                  dersSeviyesiRendered = true;
                  return renderWithPrice(
                    <div
                      key="instructor-ders-seviyesi"
                      className="egitmen-panel-features-selection-item egitmen-panel-features-feature-item--full"
                    >
                      <div className="egitmen-panel-features-feature-input-wrap">
                        <p className="egitmen-panel-features-feature-name">Ders Seviyesi</p>
                        {isGlobalBaslicaOrder ? (
                          renderBaslicaBooleanPills(dersSeviyesiFeatures)
                        ) : (
                          <div className="egitmen-panel-features-feature-multi">
                            {dersSeviyesiFeatures.map((option) => (
                              <label
                                key={option.id}
                                className="egitmen-panel-features-selection-check"
                              >
                                <input
                                  type="checkbox"
                                  checked={Boolean(instructorBooleanFeatureValues[option.id])}
                                  onChange={(event) =>
                                    setInstructorBooleanFeatureValues((prev) => ({
                                      ...prev,
                                      [option.id]: event.target.checked,
                                    }))
                                  }
                                />
                                <span>{getDisplayFeatureName(option.name)}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>,
                    index,
                  );
                }

                if (isInstructorHizmetYeriBooleanOption(feature)) {
                  if (hizmetYeriRendered) return null;
                  hizmetYeriRendered = true;
                  return renderWithPrice(
                    <div
                      key="instructor-hizmet-yeri"
                      className="egitmen-panel-features-selection-item egitmen-panel-features-feature-item--full"
                    >
                      <div className="egitmen-panel-features-feature-input-wrap">
                        <p className="egitmen-panel-features-feature-name">Hizmet Yeri</p>
                        {isGlobalBaslicaOrder ? (
                          renderBaslicaBooleanPills(hizmetYeriFeatures)
                        ) : (
                          <div className="egitmen-panel-features-feature-multi">
                            {hizmetYeriFeatures.map((option) => (
                              <label
                                key={option.id}
                                className="egitmen-panel-features-selection-check"
                              >
                                <input
                                  type="checkbox"
                                  checked={Boolean(instructorBooleanFeatureValues[option.id])}
                                  onChange={(event) =>
                                    setInstructorBooleanFeatureValues((prev) => ({
                                      ...prev,
                                      [option.id]: event.target.checked,
                                    }))
                                  }
                                />
                                <span>{getDisplayFeatureName(option.name)}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>,
                    index,
                  );
                }

                if (isInstructorEgitmenProfiliFeature(feature)) {
                  const profileChoices = instructorFeatureChoices
                    .filter(
                      (choice) =>
                        choice.feature_definition_id === feature.id &&
                        choice.is_active &&
                        instructorEgitmenProfiliChoiceKey(choice.name),
                    )
                    .sort(compareInstructorEgitmenProfiliChoices);
                  const selectedChoiceId = resolveInstructorEgitmenProfiliSelectedChoiceId(
                    feature.id,
                    instructorMultiSelectValues[feature.id] ?? [],
                    instructorFeatureChoices,
                  );
                  const selectedProfileName =
                    profileChoices.find((choice) => String(choice.id) === selectedChoiceId)?.name?.trim() ||
                    "";
                  const profileSelectLabel = selectedProfileName || "Seçiniz";
                  return renderWithPrice(
                    <div
                      key={`instructor-egitmen-profili-${feature.id}`}
                      className="egitmen-panel-features-selection-item egitmen-panel-features-feature-item--full"
                    >
                      <div className="egitmen-panel-features-feature-input-wrap">
                        <p className="egitmen-panel-features-feature-name">
                          {INSTRUCTOR_EGITMEN_PROFILI_LABEL}
                        </p>
                        {isGlobalBaslicaOrder ? (
                          <div className="egitmen-panel-features-single-select-dropdown">
                            <button
                              type="button"
                              className={`egitmen-panel-features-feature-select egitmen-panel-features-feature-select--button ${
                                openInstructorSelectId === feature.id
                                  ? "egitmen-panel-features-feature-select--open"
                                  : ""
                              }`}
                              onClick={() =>
                                setOpenInstructorSelectId((prev) =>
                                  prev === feature.id ? null : feature.id,
                                )
                              }
                              aria-haspopup="listbox"
                              aria-expanded={openInstructorSelectId === feature.id}
                              aria-label={INSTRUCTOR_EGITMEN_PROFILI_LABEL}
                            >
                              <span
                                className="egitmen-panel-features-feature-select-label"
                                title={profileSelectLabel}
                              >
                                {profileSelectLabel}
                              </span>
                            </button>
                            {openInstructorSelectId === feature.id ? (
                              <div className="egitmen-panel-features-feature-select-menu" role="listbox">
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={selectedChoiceId === ""}
                                  className={`egitmen-panel-features-feature-select-option ${
                                    selectedChoiceId === ""
                                      ? "egitmen-panel-features-feature-select-option--selected"
                                      : ""
                                  }`}
                                  onClick={() => {
                                    setInstructorMultiSelectValues((prev) => ({
                                      ...prev,
                                      [feature.id]: [],
                                    }));
                                    setOpenInstructorSelectId(null);
                                  }}
                                >
                                  Seçiniz
                                </button>
                                {profileChoices.map((choice) => {
                                  const choiceId = String(choice.id);
                                  const isSelected = selectedChoiceId === choiceId;
                                  return (
                                    <button
                                      key={choice.id}
                                      type="button"
                                      role="option"
                                      aria-selected={isSelected}
                                      className={`egitmen-panel-features-feature-select-option ${
                                        isSelected
                                          ? "egitmen-panel-features-feature-select-option--selected"
                                          : ""
                                      }`}
                                      onClick={() => {
                                        setInstructorMultiSelectValues((prev) => ({
                                          ...prev,
                                          [feature.id]: [choiceId],
                                        }));
                                        setOpenInstructorSelectId(null);
                                      }}
                                      title={choice.name?.trim() || undefined}
                                    >
                                      {choice.name?.trim() || ""}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div
                            className="egitmen-panel-features-feature-multi"
                            role="radiogroup"
                            aria-label={INSTRUCTOR_EGITMEN_PROFILI_LABEL}
                          >
                            {profileChoices.map((choice) => {
                              const choiceId = String(choice.id);
                              return (
                                <label
                                  key={choice.id}
                                  className="egitmen-panel-features-selection-check"
                                >
                                  <input
                                    type="radio"
                                    name={`egitmen-profili-${feature.id}`}
                                    checked={selectedChoiceId === choiceId}
                                    onChange={() =>
                                      setInstructorMultiSelectValues((prev) => ({
                                        ...prev,
                                        [feature.id]: [choiceId],
                                      }))
                                    }
                                  />
                                  <span>{choice.name?.trim() || ""}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>,
                    index,
                  );
                }

                if (isLessonDurationRangeNumberFeature(feature)) {
                  if (!durationMinFeature || !durationMaxFeature) return null;
                  if (lessonDurationRendered) return null;
                  lessonDurationRendered = true;
                  const minValue = instructorNumberFeatureValues[durationMinFeature.id] ?? "";
                  const maxValue = instructorNumberFeatureValues[durationMaxFeature.id] ?? "";
                  if (isGlobalBaslicaOrder) {
                    const durationPanelError =
                      parseLessonDurationPanelInput(lessonDurationShown).kind === "invalid"
                        ? LESSON_DURATION_PANEL_FORMAT_ERROR
                        : null;
                    return renderWithPrice(
                      <div
                        key={`lesson-duration-${durationMinFeature.id}-${durationMaxFeature.id}`}
                        className="egitmen-panel-features-selection-item egitmen-panel-features-feature-item--full"
                      >
                        <div className="egitmen-panel-features-feature-input-wrap">
                          <p className="egitmen-panel-features-feature-name">{LESSON_DURATION_PANEL_LABEL}</p>
                          <input
                            id="egitmen-lesson-duration"
                            type="text"
                            inputMode="text"
                            autoComplete="off"
                            className="egitmen-panel-features-feature-input egitmen-panel-features-feature-input--duration"
                            value={lessonDurationShown}
                            aria-label={LESSON_DURATION_PANEL_LABEL}
                            placeholder={LESSON_DURATION_PANEL_PLACEHOLDER}
                            onChange={(event) => {
                              const next = event.target.value;
                              setLessonDurationDraft(next);
                              const parsed = parseLessonDurationPanelInput(next);
                              if (parsed.kind === "invalid") return;
                              const nextMin =
                                parsed.kind === "empty"
                                  ? ""
                                  : String(parsed.kind === "exact" ? parsed.value : parsed.min);
                              const nextMax =
                                parsed.kind === "empty"
                                  ? ""
                                  : String(parsed.kind === "exact" ? parsed.value : parsed.max);
                              setInstructorNumberFeatureValues((prev) => ({
                                ...prev,
                                [durationMinFeature.id]: nextMin,
                                [durationMaxFeature.id]: nextMax,
                              }));
                            }}
                          />
                          {durationPanelError ? (
                            <p className="egitmen-panel-form-error">{durationPanelError}</p>
                          ) : null}
                        </div>
                      </div>,
                      index,
                    );
                  }
                  const durationError = validateLessonDurationRangeValues(minValue, maxValue);
                  return renderWithPrice(
                    <div
                      key={`lesson-duration-${durationMinFeature.id}-${durationMaxFeature.id}`}
                      className="egitmen-panel-features-selection-item egitmen-panel-features-feature-item--full"
                    >
                      <div className="egitmen-panel-features-feature-input-wrap">
                        <p className="egitmen-panel-features-feature-name">{LESSON_DURATION_LABEL}</p>
                        <div className="egitmen-panel-features-feature-age-range-fields">
                          <input
                            id="egitmen-lesson-duration-min"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            className="egitmen-panel-features-feature-input"
                            value={minValue}
                            aria-label="Minimum ders süresi"
                            placeholder={LESSON_DURATION_MIN_INPUT_LABEL}
                            onKeyDown={(event) => {
                              if (
                                event.key === "-" ||
                                event.key === "+" ||
                                event.key === "e" ||
                                event.key === "E" ||
                                event.key === "." ||
                                event.key === ","
                              ) {
                                event.preventDefault();
                              }
                            }}
                            onChange={(event) =>
                              setInstructorNumberFeatureValues((prev) => ({
                                ...prev,
                                [durationMinFeature.id]: sanitizeLessonDurationInput(event.target.value),
                              }))
                            }
                          />
                          <span className="egitmen-panel-features-hours-range-sep" aria-hidden>
                            —
                          </span>
                          <input
                            id="egitmen-lesson-duration-max"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            className="egitmen-panel-features-feature-input"
                            value={maxValue}
                            aria-label="Maksimum ders süresi"
                            placeholder={LESSON_DURATION_MAX_INPUT_LABEL}
                            onKeyDown={(event) => {
                              if (
                                event.key === "-" ||
                                event.key === "+" ||
                                event.key === "e" ||
                                event.key === "E" ||
                                event.key === "." ||
                                event.key === ","
                              ) {
                                event.preventDefault();
                              }
                            }}
                            onChange={(event) =>
                              setInstructorNumberFeatureValues((prev) => ({
                                ...prev,
                                [durationMaxFeature.id]: sanitizeLessonDurationInput(event.target.value),
                              }))
                            }
                          />
                          <span className="egitmen-panel-features-feature-unit">
                            {LESSON_DURATION_UNIT_LABEL}
                          </span>
                        </div>
                        {durationError ? (
                          <p className="egitmen-panel-form-error">{durationError}</p>
                        ) : null}
                      </div>
                    </div>,
                    index,
                  );
                }

                if (
                  isStudentAgeRangeNumberFeature(feature) &&
                  ageMinFeature &&
                  ageMaxFeature
                ) {
                  if (ageRangeRendered) return null;
                  ageRangeRendered = true;
                  return renderWithPrice(
                    <div
                      key={`student-age-range-${ageMinFeature.id}-${ageMaxFeature.id}`}
                      className="egitmen-panel-features-selection-item egitmen-panel-features-feature-item--full"
                    >
                      <StudentAgeRangeFields
                        variant="instructor"
                        minValue={instructorNumberFeatureValues[ageMinFeature.id] ?? ""}
                        maxValue={instructorNumberFeatureValues[ageMaxFeature.id] ?? ""}
                        onMinChange={(value) => updateAgeNumber(ageMinFeature.id, value)}
                        onMaxChange={(value) => updateAgeNumber(ageMaxFeature.id, value)}
                        error={studentAgeRangeError}
                      />
                    </div>,
                    index,
                  );
                }

                if (
                  isGlobalBaslicaOrder &&
                  feature.input_type === "boolean" &&
                  isInstructorDenemeDersiFeature(feature)
                ) {
                  return renderWithPrice(
                    <div key={feature.id} className="egitmen-panel-features-selection-item">
                      {renderBaslicaBooleanPills([
                        { id: feature.id, name: feature.name },
                      ])}
                    </div>,
                    index,
                  );
                }

                return renderWithPrice(
                <div
                  key={feature.id}
                  className={`egitmen-panel-features-selection-item ${
                    feature.input_type === "text" ||
                    feature.input_type === "number" ||
                    feature.input_type === "date" ||
                    feature.input_type === "multi_select"
                      ? "egitmen-panel-features-feature-item--full"
                      : ""
                  }`}
                >
                  {feature.input_type === "text" ? (
                    <div className="egitmen-panel-features-feature-input-wrap">
                      <p className="egitmen-panel-features-feature-name">{getDisplayFeatureName(feature.name)}</p>
                      {isInstructorTimeTextFeature(feature) ? (
                        <input
                          type="time"
                          className="egitmen-panel-features-feature-input"
                          value={instructorTextFeatureValues[feature.id] ?? ""}
                          onChange={(e) =>
                            setInstructorTextFeatureValues((prev) => ({
                              ...prev,
                              [feature.id]: e.target.value,
                            }))
                          }
                        />
                      ) : (feature.help_text ?? "").length > 120 || (feature.placeholder ?? "").length > 70 ? (
                        <textarea
                          className="egitmen-panel-features-feature-textarea"
                          value={instructorTextFeatureValues[feature.id] ?? ""}
                          onChange={(e) =>
                            setInstructorTextFeatureValues((prev) => ({
                              ...prev,
                              [feature.id]: e.target.value,
                            }))
                          }
                          placeholder={feature.placeholder || "Bilgi giriniz"}
                          rows={3}
                        />
                      ) : (
                        <input
                          type="text"
                          className="egitmen-panel-features-feature-input"
                          value={instructorTextFeatureValues[feature.id] ?? ""}
                          onChange={(e) =>
                            setInstructorTextFeatureValues((prev) => ({
                              ...prev,
                              [feature.id]: e.target.value,
                            }))
                          }
                          placeholder={feature.placeholder || "Bilgi giriniz"}
                        />
                      )}
                    </div>
                  ) : feature.input_type === "number" ? (
                    <div className="egitmen-panel-features-feature-input-wrap">
                      <p className="egitmen-panel-features-feature-name">{getDisplayFeatureName(feature.name)}</p>
                      <div className="egitmen-panel-features-feature-number-row">
                        <input
                          type="number"
                          step="any"
                          className="egitmen-panel-features-feature-input"
                          value={instructorNumberFeatureValues[feature.id] ?? ""}
                          onChange={(e) => {
                            setInstructorNumberFeatureValues((prev) => ({
                              ...prev,
                              [feature.id]: e.target.value,
                            }));
                          }}
                          placeholder={feature.placeholder || "Sayı giriniz"}
                        />
                        {feature.unit ? (
                          <span className="egitmen-panel-features-feature-unit">{feature.unit}</span>
                        ) : null}
                      </div>
                    </div>
                  ) : feature.input_type === "date" ? (
                    <div className="egitmen-panel-features-feature-input-wrap">
                      <p className="egitmen-panel-features-feature-name">{getDisplayFeatureName(feature.name)}</p>
                      <input
                        type="date"
                        className="egitmen-panel-features-feature-input"
                        value={instructorDateFeatureValues[feature.id] ?? ""}
                        onChange={(e) =>
                          setInstructorDateFeatureValues((prev) => ({
                            ...prev,
                            [feature.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ) : feature.input_type === "boolean" ? (
                    <label className="egitmen-panel-features-selection-check">
                      <input
                        type="checkbox"
                        checked={Boolean(instructorBooleanFeatureValues[feature.id])}
                        onChange={(e) =>
                          setInstructorBooleanFeatureValues((prev) => ({
                            ...prev,
                            [feature.id]: e.target.checked,
                          }))
                        }
                      />
                      <span>{getDisplayFeatureName(feature.name)}</span>
                    </label>
                  ) : feature.input_type === "single_select" ? (
                    <div className="egitmen-panel-features-feature-input-wrap">
                      <p className="egitmen-panel-features-feature-name">{getDisplayFeatureName(feature.name)}</p>
                      <div className="egitmen-panel-features-single-select-dropdown">
                        <button
                          type="button"
                          className={`egitmen-panel-features-feature-select egitmen-panel-features-feature-select--button ${
                            openInstructorSelectId === feature.id ? "egitmen-panel-features-feature-select--open" : ""
                          }`}
                          onClick={() =>
                            setOpenInstructorSelectId((prev) => (prev === feature.id ? null : feature.id))
                          }
                          aria-haspopup="listbox"
                          aria-expanded={openInstructorSelectId === feature.id}
                        >
                          <span
                            className="egitmen-panel-features-feature-select-label"
                            title={
                              instructorFeatureChoices.find(
                                (choice) =>
                                  String(choice.id) === (instructorSingleSelectValues[feature.id] ?? "") &&
                                  choice.feature_definition_id === feature.id &&
                                  choice.is_active,
                              )?.name ||
                              feature.placeholder ||
                              "Seçiniz"
                            }
                          >
                            {instructorFeatureChoices.find(
                              (choice) =>
                                String(choice.id) === (instructorSingleSelectValues[feature.id] ?? "") &&
                                choice.feature_definition_id === feature.id &&
                                choice.is_active,
                            )?.name ||
                              feature.placeholder ||
                              "Seçiniz"}
                          </span>
                        </button>
                        {openInstructorSelectId === feature.id ? (
                          <div className="egitmen-panel-features-feature-select-menu" role="listbox">
                            <button
                              type="button"
                              role="option"
                              aria-selected={(instructorSingleSelectValues[feature.id] ?? "") === ""}
                              className={`egitmen-panel-features-feature-select-option ${
                                (instructorSingleSelectValues[feature.id] ?? "") === ""
                                  ? "egitmen-panel-features-feature-select-option--selected"
                                  : ""
                              }`}
                              onClick={() => {
                                setInstructorSingleSelectValues((prev) => ({
                                  ...prev,
                                  [feature.id]: "",
                                }));
                                setOpenInstructorSelectId(null);
                              }}
                            >
                              {feature.placeholder || "Seçiniz"}
                            </button>
                            {sortInstructorPanelFeatureChoices(instructorFeatureChoices, feature).map(
                              (choice) => (
                                <button
                                  key={choice.id}
                                  type="button"
                                  role="option"
                                  aria-selected={
                                    (instructorSingleSelectValues[feature.id] ?? "") === String(choice.id)
                                  }
                                  className={`egitmen-panel-features-feature-select-option ${
                                    (instructorSingleSelectValues[feature.id] ?? "") === String(choice.id)
                                      ? "egitmen-panel-features-feature-select-option--selected"
                                      : ""
                                  }`}
                                  onClick={() => {
                                    setInstructorSingleSelectValues((prev) => ({
                                      ...prev,
                                      [feature.id]: String(choice.id),
                                    }));
                                    setOpenInstructorSelectId(null);
                                  }}
                                  title={choice.name || undefined}
                                >
                                  {choice.name?.trim() || ""}
                                </button>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="egitmen-panel-features-feature-input-wrap">
                      <p className="egitmen-panel-features-feature-name">{getDisplayFeatureName(feature.name)}</p>
                      <div className="egitmen-panel-features-feature-multi">
                        {sortInstructorPanelFeatureChoices(instructorFeatureChoices, feature).map(
                          (choice) => {
                            const choiceId = String(choice.id);
                            const selectedValues = instructorMultiSelectValues[feature.id] ?? [];
                            const isSelected = selectedValues.includes(choiceId);
                            return (
                              <button
                                key={choice.id}
                                type="button"
                                className={`egitmen-panel-features-feature-chip ${isSelected ? "is-selected" : ""}`}
                                onClick={() =>
                                  setInstructorMultiSelectValues((prev) => {
                                    const current = prev[feature.id] ?? [];
                                    const next = isSelected
                                      ? current.filter((id) => id !== choiceId)
                                      : [...current, choiceId];
                                    return { ...prev, [feature.id]: next };
                                  })
                                }
                              >
                                <span className="egitmen-panel-features-feature-chip-check" aria-hidden>
                                  {isSelected ? "✓" : ""}
                                </span>
                                <span>{choice.name?.trim() || ""}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>,
                index,
                );
              })}
              {!isGlobalBaslicaOrder && group.id === baslicaPresentationGroupId
                ? baslicaAvailableHours
                : null}
              {isGlobalBaslicaOrder && placeHoursInOrder && !hoursPlaced ? baslicaAvailableHours : null}
              {placePriceHere && !pricePlaced ? baslicaPriceRange : null}
            </div>
          </section>
        );
      })}
    </>
  );
}
