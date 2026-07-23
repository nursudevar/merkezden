"use client";

import type { KeyboardEvent } from "react";
import {
  STUDENT_AGE_INPUT_MAX,
  STUDENT_AGE_INPUT_MIN,
  STUDENT_AGE_INPUT_STEP,
  STUDENT_AGE_MAX_INPUT_LABEL,
  STUDENT_AGE_MIN_INPUT_LABEL,
  STUDENT_AGE_RANGE_LABEL,
  sanitizeStudentAgeDecimalInput,
} from "@/lib/studentAgeRangeFeature";

type StudentAgeRangeFieldsProps = {
  variant: "institution" | "instructor";
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  error?: string | null;
};

function blockInvalidAgeKeys(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === "-" || e.key === "+" || e.key === "e" || e.key === "E") {
    e.preventDefault();
  }
}

export function StudentAgeRangeFields({
  variant,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  error = null,
}: StudentAgeRangeFieldsProps) {
  const wrapClass =
    variant === "institution"
      ? "panel-institutions-feature-input-wrap"
      : "egitmen-panel-features-feature-input-wrap";
  const nameClass =
    variant === "institution"
      ? "panel-institutions-feature-name"
      : "egitmen-panel-features-feature-name";
  const inputClass =
    variant === "institution"
      ? "panel-institutions-feature-input"
      : "egitmen-panel-features-feature-input";
  const fieldsClass =
    variant === "institution"
      ? "panel-institutions-feature-age-range-fields"
      : "egitmen-panel-features-feature-age-range-fields";
  const errorClass =
    variant === "institution" ? "panel-institution-form-error" : "egitmen-panel-form-error";

  const handleChange = (raw: string, onChange: (value: string) => void) => {
    const next = sanitizeStudentAgeDecimalInput(raw);
    if (next === null) return;
    onChange(next);
  };

  return (
    <div className={wrapClass}>
      <p className={nameClass}>{STUDENT_AGE_RANGE_LABEL}</p>
      <div className={fieldsClass}>
        <input
          id={`student-age-min-${variant}`}
          type="number"
          inputMode="decimal"
          min={STUDENT_AGE_INPUT_MIN}
          max={STUDENT_AGE_INPUT_MAX}
          step={STUDENT_AGE_INPUT_STEP}
          className={inputClass}
          value={minValue}
          aria-label={STUDENT_AGE_MIN_INPUT_LABEL}
          onKeyDown={blockInvalidAgeKeys}
          onChange={(e) => handleChange(e.target.value, onMinChange)}
          placeholder={STUDENT_AGE_MIN_INPUT_LABEL}
        />
        <input
          id={`student-age-max-${variant}`}
          type="number"
          inputMode="decimal"
          min={STUDENT_AGE_INPUT_MIN}
          max={STUDENT_AGE_INPUT_MAX}
          step={STUDENT_AGE_INPUT_STEP}
          className={inputClass}
          value={maxValue}
          aria-label={STUDENT_AGE_MAX_INPUT_LABEL}
          onKeyDown={blockInvalidAgeKeys}
          onChange={(e) => handleChange(e.target.value, onMaxChange)}
          placeholder={STUDENT_AGE_MAX_INPUT_LABEL}
        />
      </div>
      {error ? <p className={errorClass}>{error}</p> : null}
    </div>
  );
}
