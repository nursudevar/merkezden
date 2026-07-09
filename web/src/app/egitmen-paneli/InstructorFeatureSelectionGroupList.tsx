"use client";

import type { Dispatch, SetStateAction } from "react";
import { Building, Building2, CreditCard, Info, List, Star } from "lucide-react";
import {
  isInstructorTimeTextFeature,
} from "@/lib/instructorFeaturesClient";

type InstructorFeatureChoiceRow = {
  id: number;
  feature_definition_id: number;
  name?: string | null;
  is_active: boolean;
};

export type InstructorFeatureSelectionGroup = {
  group: { id: number; name: string; category_slug?: string | null };
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
}: InstructorFeatureSelectionGroupListProps) {
  return (
    <>
      {groups.map(({ group, features }) => {
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
          if (groupNameKey === "ödeme seçenekleri") {
            return {
              titleClass: "egitmen-panel-features-group-title--physical",
              iconClass: "egitmen-panel-features-group-title-icon--physical",
              Icon: CreditCard,
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
              {features.map((feature) => (
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
                            {instructorFeatureChoices
                              .filter((choice) => choice.feature_definition_id === feature.id && choice.is_active)
                              .map((choice) => (
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
                        {instructorFeatureChoices
                          .filter((choice) => choice.feature_definition_id === feature.id && choice.is_active)
                          .map((choice) => {
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
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
