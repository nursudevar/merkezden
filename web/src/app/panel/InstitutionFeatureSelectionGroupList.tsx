"use client";

import type { Dispatch, SetStateAction } from "react";
import { Building, Building2, CreditCard, Info, List, Star } from "lucide-react";
import { StudentAgeRangeFields } from "@/components/features/StudentAgeRangeFields";
import { isAverageClassSizeInstitutionFeature } from "@/lib/institutionHelpers";
import {
  isLegacyStudentAgeMultiSelectFeature,
  isStudentAgeMaxFeature,
  isStudentAgeMinFeature,
  isStudentAgeRangeNumberFeature,
  validateStudentAgeRangeValues,
} from "@/lib/studentAgeRangeFeature";

type InstitutionFeatureChoiceRow = {
  id: number;
  feature_definition_id: number;
  name?: string | null;
  label?: string | null;
  value?: string | null;
  display_order?: number | null;
  is_active: boolean;
};

export type InstitutionFeatureSelectionGroup = {
  group: { id: number; name: string };
  features: InstitutionFeatureDefinitionForSelection[];
};

export type InstitutionFeatureDefinitionForSelection = {
  id: number;
  name: string;
  slug: string | null;
  input_type: "boolean" | "text" | "number" | "single_select" | "multi_select" | string;
  help_text: string | null;
  placeholder: string | null;
  unit: string | null;
};

type InstitutionFeatureSelectionGroupListProps = {
  groups: InstitutionFeatureSelectionGroup[];
  getDisplayFeatureName: (name: string) => string;
  institutionTextFeatureValues: Record<number, string>;
  setInstitutionTextFeatureValues: Dispatch<SetStateAction<Record<number, string>>>;
  institutionNumberFeatureValues: Record<number, string>;
  setInstitutionNumberFeatureValues: Dispatch<SetStateAction<Record<number, string>>>;
  institutionBooleanFeatureValues: Record<number, boolean>;
  setInstitutionBooleanFeatureValues: Dispatch<SetStateAction<Record<number, boolean>>>;
  institutionSingleSelectValues: Record<number, string>;
  setInstitutionSingleSelectValues: Dispatch<SetStateAction<Record<number, string>>>;
  institutionMultiSelectValues: Record<number, string[]>;
  setInstitutionMultiSelectValues: Dispatch<SetStateAction<Record<number, string[]>>>;
  institutionFeatureChoices: InstitutionFeatureChoiceRow[];
  openInstitutionSelectId: number | null;
  setOpenInstitutionSelectId: Dispatch<SetStateAction<number | null>>;
  studentAgeRangeError?: string | null;
  setStudentAgeRangeError?: Dispatch<SetStateAction<string | null>>;
};

export function InstitutionFeatureSelectionGroupList({
  groups,
  getDisplayFeatureName,
  institutionTextFeatureValues,
  setInstitutionTextFeatureValues,
  institutionNumberFeatureValues,
  setInstitutionNumberFeatureValues,
  institutionBooleanFeatureValues,
  setInstitutionBooleanFeatureValues,
  institutionSingleSelectValues,
  setInstitutionSingleSelectValues,
  institutionMultiSelectValues,
  setInstitutionMultiSelectValues,
  institutionFeatureChoices,
  openInstitutionSelectId,
  setOpenInstitutionSelectId,
  studentAgeRangeError = null,
  setStudentAgeRangeError,
}: InstitutionFeatureSelectionGroupListProps) {
  return (
    <>
      {groups.map(({ group, features }) => {
        const visibleFeatures = features.filter((feature) => !isLegacyStudentAgeMultiSelectFeature(feature));
        const ageMinFeature = visibleFeatures.find((f) => isStudentAgeMinFeature(f));
        const ageMaxFeature = visibleFeatures.find((f) => isStudentAgeMaxFeature(f));
        let ageRangeRendered = false;

        const updateAgeNumber = (featureId: number, value: string) => {
          const nextMin =
            ageMinFeature && featureId === ageMinFeature.id
              ? value
              : (institutionNumberFeatureValues[ageMinFeature?.id ?? -1] ?? "");
          const nextMax =
            ageMaxFeature && featureId === ageMaxFeature.id
              ? value
              : (institutionNumberFeatureValues[ageMaxFeature?.id ?? -1] ?? "");
          setInstitutionNumberFeatureValues((prev) => ({ ...prev, [featureId]: value }));
          if (setStudentAgeRangeError && ageMinFeature && ageMaxFeature) {
            setStudentAgeRangeError(validateStudentAgeRangeValues(nextMin, nextMax));
          }
        };
        const groupNameKey = group.name.trim().toLocaleLowerCase("tr-TR");
        const groupHeaderMeta = (() => {
          if (groupNameKey === "başlıca özellikler") {
            return {
              titleClass: "panel-institutions-group-title--academic",
              iconClass: "panel-institutions-group-title-icon--academic",
              Icon: Info,
            };
          }
          if (groupNameKey === "okul imkanları") {
            return {
              titleClass: "panel-institutions-group-title--school",
              iconClass: "panel-institutions-group-title-icon--school",
              Icon: Building,
            };
          }
          if (groupNameKey === "fiziki imkanlar") {
            return {
              titleClass: "panel-institutions-group-title--physical",
              iconClass: "panel-institutions-group-title-icon--physical",
              Icon: Building2,
            };
          }
          if (groupNameKey === "eğitim sistemi") {
            return {
              titleClass: "panel-institutions-group-title--academic",
              iconClass: "panel-institutions-group-title-icon--academic",
              Icon: List,
            };
          }
          if (groupNameKey === "aktiviteler") {
            return {
              titleClass: "panel-institutions-group-title--school",
              iconClass: "panel-institutions-group-title-icon--school",
              Icon: Star,
            };
          }
          if (groupNameKey === "ödeme seçenekleri" || groupNameKey === "ödeme yöntemleri") {
            return {
              titleClass: "panel-institutions-group-title--physical",
              iconClass: "panel-institutions-group-title-icon--physical",
              Icon: CreditCard,
            };
          }
          if (
            groupNameKey === "sürücü kursu imkanları" ||
            groupNameKey === "sürücü kursu özellikleri"
          ) {
            return {
              titleClass: "panel-institutions-group-title--school",
              iconClass: "panel-institutions-group-title-icon--school",
              Icon: Building,
            };
          }
          return {
            titleClass: "panel-institutions-group-title--physical",
            iconClass: "panel-institutions-group-title-icon--physical",
            Icon: Building2,
          };
        })();

        return (
          <section key={group.id} className="panel-institutions-group-item">
            <h4 className={`panel-institutions-group-title ${groupHeaderMeta.titleClass}`}>
              <groupHeaderMeta.Icon
                className={`panel-institutions-group-title-icon ${groupHeaderMeta.iconClass}`}
                aria-hidden
              />
              {group.name}
            </h4>
            <div className="panel-institutions-features-grid panel-institutions-features-grid--selection">
              {visibleFeatures.map((feature) => {
                if (
                  isStudentAgeRangeNumberFeature(feature) &&
                  ageMinFeature &&
                  ageMaxFeature
                ) {
                  if (ageRangeRendered) return null;
                  ageRangeRendered = true;
                  return (
                    <div
                      key={`student-age-range-${ageMinFeature.id}-${ageMaxFeature.id}`}
                      className="panel-institutions-selection-item panel-institutions-feature-item--full"
                    >
                      <StudentAgeRangeFields
                        variant="institution"
                        minValue={institutionNumberFeatureValues[ageMinFeature.id] ?? ""}
                        maxValue={institutionNumberFeatureValues[ageMaxFeature.id] ?? ""}
                        onMinChange={(value) => updateAgeNumber(ageMinFeature.id, value)}
                        onMaxChange={(value) => updateAgeNumber(ageMaxFeature.id, value)}
                        error={studentAgeRangeError}
                      />
                    </div>
                  );
                }

                return (
                <div
                  key={feature.id}
                  className={`panel-institutions-selection-item ${
                    feature.input_type === "text" ||
                    feature.input_type === "number" ||
                    feature.input_type === "multi_select"
                      ? "panel-institutions-feature-item--full"
                      : ""
                  }`}
                >
                  {feature.input_type === "text" ? (
                    <div className="panel-institutions-feature-input-wrap">
                      <p className="panel-institutions-feature-name">{getDisplayFeatureName(feature.name)}</p>
                      {(feature.help_text ?? "").length > 120 || (feature.placeholder ?? "").length > 70 ? (
                        <textarea
                          className="panel-institutions-feature-textarea"
                          value={institutionTextFeatureValues[feature.id] ?? ""}
                          onChange={(e) =>
                            setInstitutionTextFeatureValues((prev) => ({
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
                          className="panel-institutions-feature-input"
                          value={institutionTextFeatureValues[feature.id] ?? ""}
                          onChange={(e) =>
                            setInstitutionTextFeatureValues((prev) => ({
                              ...prev,
                              [feature.id]: e.target.value,
                            }))
                          }
                          placeholder={feature.placeholder || "Bilgi giriniz"}
                        />
                      )}
                    </div>
                  ) : feature.input_type === "number" ? (
                    <div className="panel-institutions-feature-input-wrap">
                      <p className="panel-institutions-feature-name">{getDisplayFeatureName(feature.name)}</p>
                      <div className="panel-institutions-feature-number-row">
                        <input
                          type="number"
                          className="panel-institutions-feature-input"
                          value={institutionNumberFeatureValues[feature.id] ?? ""}
                          min={isAverageClassSizeInstitutionFeature(feature.name) ? 0 : undefined}
                          step={isAverageClassSizeInstitutionFeature(feature.name) ? 1 : undefined}
                          onKeyDown={(e) => {
                            if (!isAverageClassSizeInstitutionFeature(feature.name)) return;
                            if (e.key === "-" || e.key === "+" || e.key === "e" || e.key === "E") {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (isAverageClassSizeInstitutionFeature(feature.name)) {
                              if (raw === "" || raw === "-") {
                                setInstitutionNumberFeatureValues((prev) => ({
                                  ...prev,
                                  [feature.id]: raw === "-" ? "" : raw,
                                }));
                                return;
                              }
                              const parsed = Number(raw);
                              if (!Number.isFinite(parsed) || parsed < 0) return;
                            }
                            setInstitutionNumberFeatureValues((prev) => ({
                              ...prev,
                              [feature.id]: raw,
                            }));
                          }}
                          placeholder={feature.placeholder || "Sayı giriniz"}
                        />
                        {feature.unit ? (
                          <span className="panel-institutions-feature-unit">{feature.unit}</span>
                        ) : null}
                      </div>
                    </div>
                  ) : feature.input_type === "boolean" ? (
                    <label className="panel-institutions-selection-check">
                      <input
                        type="checkbox"
                        checked={Boolean(institutionBooleanFeatureValues[feature.id])}
                        onChange={(e) =>
                          setInstitutionBooleanFeatureValues((prev) => ({
                            ...prev,
                            [feature.id]: e.target.checked,
                          }))
                        }
                      />
                      <span>{getDisplayFeatureName(feature.name)}</span>
                    </label>
                  ) : feature.input_type === "single_select" ? (
                    <div className="panel-institutions-feature-input-wrap">
                      <p className="panel-institutions-feature-name">{getDisplayFeatureName(feature.name)}</p>
                      <div className="panel-institutions-single-select-dropdown">
                        <button
                          type="button"
                          className={`panel-institutions-feature-select panel-institutions-feature-select--button ${
                            openInstitutionSelectId === feature.id ? "panel-institutions-feature-select--open" : ""
                          }`}
                          onClick={() =>
                            setOpenInstitutionSelectId((prev) => (prev === feature.id ? null : feature.id))
                          }
                          aria-haspopup="listbox"
                          aria-expanded={openInstitutionSelectId === feature.id}
                        >
                          <span
                            className="panel-institutions-feature-select-label"
                            title={
                              institutionFeatureChoices.find(
                                (choice) =>
                                  String(choice.id) === (institutionSingleSelectValues[feature.id] ?? "") &&
                                  choice.feature_definition_id === feature.id &&
                                  choice.is_active
                              )?.name || feature.placeholder || "Seçiniz"
                            }
                          >
                            {institutionFeatureChoices.find(
                              (choice) =>
                                String(choice.id) === (institutionSingleSelectValues[feature.id] ?? "") &&
                                choice.feature_definition_id === feature.id &&
                                choice.is_active
                            )?.name || feature.placeholder || "Seçiniz"}
                          </span>
                        </button>
                        {openInstitutionSelectId === feature.id && (
                          <div className="panel-institutions-feature-select-menu" role="listbox">
                            <button
                              type="button"
                              role="option"
                              aria-selected={(institutionSingleSelectValues[feature.id] ?? "") === ""}
                              className={`panel-institutions-feature-select-option ${
                                (institutionSingleSelectValues[feature.id] ?? "") === ""
                                  ? "panel-institutions-feature-select-option--selected"
                                  : ""
                              }`}
                              onClick={() => {
                                setInstitutionSingleSelectValues((prev) => ({
                                  ...prev,
                                  [feature.id]: "",
                                }));
                                setOpenInstitutionSelectId(null);
                              }}
                            >
                              {feature.placeholder || "Seçiniz"}
                            </button>
                            {institutionFeatureChoices
                              .filter((choice) => choice.feature_definition_id === feature.id && choice.is_active)
                              .slice()
                              .sort((a, b) => {
                                const orderA = Number.isFinite(Number(a.display_order))
                                  ? Number(a.display_order)
                                  : Number.MAX_SAFE_INTEGER;
                                const orderB = Number.isFinite(Number(b.display_order))
                                  ? Number(b.display_order)
                                  : Number.MAX_SAFE_INTEGER;
                                if (orderA !== orderB) return orderA - orderB;
                                return a.id - b.id;
                              })
                              .map((choice) => (
                                <button
                                  key={choice.id}
                                  type="button"
                                  role="option"
                                  aria-selected={
                                    (institutionSingleSelectValues[feature.id] ?? "") === String(choice.id)
                                  }
                                  className={`panel-institutions-feature-select-option ${
                                    (institutionSingleSelectValues[feature.id] ?? "") === String(choice.id)
                                      ? "panel-institutions-feature-select-option--selected"
                                      : ""
                                  }`}
                                  onClick={() => {
                                    setInstitutionSingleSelectValues((prev) => ({
                                      ...prev,
                                      [feature.id]: String(choice.id),
                                    }));
                                    setOpenInstitutionSelectId(null);
                                  }}
                                  title={choice.name || undefined}
                                >
                                  {choice.name?.trim() || ""}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="panel-institutions-feature-input-wrap">
                      <p className="panel-institutions-feature-name">{getDisplayFeatureName(feature.name)}</p>
                      <div className="panel-institutions-feature-multi">
                        {institutionFeatureChoices
                          .filter((choice) => choice.feature_definition_id === feature.id && choice.is_active)
                          .slice()
                          .sort((a, b) => {
                            const orderA = Number.isFinite(Number(a.display_order))
                              ? Number(a.display_order)
                              : Number.MAX_SAFE_INTEGER;
                            const orderB = Number.isFinite(Number(b.display_order))
                              ? Number(b.display_order)
                              : Number.MAX_SAFE_INTEGER;
                            if (orderA !== orderB) return orderA - orderB;
                            return a.id - b.id;
                          })
                          .map((choice) => {
                            const choiceId = String(choice.id);
                            const selectedValues = institutionMultiSelectValues[feature.id] ?? [];
                            const isSelected = selectedValues.includes(choiceId);
                            return (
                              <button
                                key={choice.id}
                                type="button"
                                className={`panel-institutions-feature-chip ${isSelected ? "is-selected" : ""}`}
                                onClick={() =>
                                  setInstitutionMultiSelectValues((prev) => {
                                    const current = prev[feature.id] ?? [];
                                    const next = isSelected
                                      ? current.filter((id) => id !== choiceId)
                                      : [...current, choiceId];
                                    return {
                                      ...prev,
                                      [feature.id]: next,
                                    };
                                  })
                                }
                              >
                                <span className="panel-institutions-feature-chip-check" aria-hidden>
                                  {isSelected ? "✓" : ""}
                                </span>
                                <span>{choice.name?.trim() || ""}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
