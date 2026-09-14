"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui";
import {
  STUDENT_AGE_FILTER_MAX,
  STUDENT_AGE_FILTER_MIN,
  formatStudentAgeFilterValue,
  type StudentAgeFilterTextPayload,
} from "@/lib/institutionStudentAgeFilter";

type AgeRangeSliderFilterProps = {
  value: StudentAgeFilterTextPayload | null;
  onChange: (value: StudentAgeFilterTextPayload | null) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

/** Yazım sırasında serbest bırakılır; filtre uygulamasında ayrı parse edilir. */
function isEditableDecimalText(raw: string): boolean {
  if (raw === "") return true;
  if (!/^[\d.,]*$/.test(raw)) return false;
  return (raw.match(/[.,]/g)?.length ?? 0) <= 1;
}

export function AgeRangeSliderFilter({
  value,
  onChange,
  min = STUDENT_AGE_FILTER_MIN,
  max = STUDENT_AGE_FILTER_MAX,
  className = "",
}: AgeRangeSliderFilterProps) {
  const [minText, setMinText] = useState(value?.min ?? "");
  const [maxText, setMaxText] = useState(value?.max ?? "");
  const minFocusedRef = useRef(false);
  const maxFocusedRef = useRef(false);

  useEffect(() => {
    if (minFocusedRef.current || maxFocusedRef.current) return;
    setMinText(value?.min ?? "");
    setMaxText(value?.max ?? "");
  }, [value]);

  const emitTexts = useCallback(
    (nextMin: string, nextMax: string) => {
      if (!nextMin.trim() && !nextMax.trim()) {
        onChange(null);
        return;
      }
      onChange({ min: nextMin, max: nextMax });
    },
    [onChange],
  );

  const handleMinInputChange = (rawValue: string) => {
    if (!isEditableDecimalText(rawValue)) return;
    setMinText(rawValue);
    emitTexts(rawValue, maxText);
  };

  const handleMaxInputChange = (rawValue: string) => {
    if (!isEditableDecimalText(rawValue)) return;
    setMaxText(rawValue);
    emitTexts(minText, rawValue);
  };

  return (
    <div className={`price-range-slider-filter age-range-slider-filter ${className}`.trim()}>
      <div className="price-range-slider-inputs">
        <label className="price-range-slider-field">
          <span className="price-range-slider-label">Minimum Yaş</span>
          <Input
            type="text"
            inputMode="decimal"
            value={minText}
            onFocus={() => {
              minFocusedRef.current = true;
            }}
            onBlur={() => {
              minFocusedRef.current = false;
            }}
            onChange={(event) => handleMinInputChange(event.target.value)}
            placeholder={formatStudentAgeFilterValue(min)}
            className="price-range-slider-input age-range-slider-input"
          />
        </label>
        <label className="price-range-slider-field">
          <span className="price-range-slider-label">Maksimum Yaş</span>
          <Input
            type="text"
            inputMode="decimal"
            value={maxText}
            onFocus={() => {
              maxFocusedRef.current = true;
            }}
            onBlur={() => {
              maxFocusedRef.current = false;
            }}
            onChange={(event) => handleMaxInputChange(event.target.value)}
            placeholder={formatStudentAgeFilterValue(max)}
            className="price-range-slider-input age-range-slider-input"
          />
        </label>
      </div>
    </div>
  );
}
