"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input, Slider } from "@/components/ui";
import {
  STUDENT_AGE_FILTER_MAX,
  STUDENT_AGE_FILTER_MIN,
  STUDENT_AGE_RANGE_TICKS,
  formatStudentAgeFilterValue,
  type StudentAgeFilterTextPayload,
} from "@/lib/institutionStudentAgeFilter";
import { STUDENT_AGE_INPUT_STEP } from "@/lib/studentAgeRangeFeature";

type AgeRangeSliderFilterProps = {
  value: StudentAgeFilterTextPayload | null;
  onChange: (value: StudentAgeFilterTextPayload | null) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Yazım sırasında serbest bırakılır; filtre uygulamasında ayrı parse edilir. */
function isEditableDecimalText(raw: string): boolean {
  if (raw === "") return true;
  if (!/^[\d.,]*$/.test(raw)) return false;
  return (raw.match(/[.,]/g)?.length ?? 0) <= 1;
}

/** Slider konumu: yalnızca tamamlanmış sayılar. */
function parseCompleteDecimal(raw: string): number | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed || /[.,]$/.test(trimmed)) return null;
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export function AgeRangeSliderFilter({
  value,
  onChange,
  min = STUDENT_AGE_FILTER_MIN,
  max = STUDENT_AGE_FILTER_MAX,
  step = STUDENT_AGE_INPUT_STEP,
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

  const normalizedValue = useMemo(() => {
    const parsedMin = parseCompleteDecimal(minText);
    const parsedMax = parseCompleteDecimal(maxText);
    if (parsedMin == null || parsedMax == null) return null;
    const nextMin = clamp(Math.min(parsedMin, parsedMax), min, max);
    const nextMax = clamp(Math.max(parsedMin, parsedMax), min, max);
    if (nextMin === min && nextMax === max) return null;
    return { min: nextMin, max: nextMax };
  }, [max, min, minText, maxText]);

  const sliderValue = normalizedValue ? [normalizedValue.min, normalizedValue.max] : [min, max];

  const commitRange = (nextMin: number, nextMax: number) => {
    const clampedMin = clamp(Math.min(nextMin, nextMax), min, max);
    const clampedMax = clamp(Math.max(nextMin, nextMax), min, max);
    if (clampedMin === min && clampedMax === max) {
      setMinText("");
      setMaxText("");
      onChange(null);
      return;
    }
    const nextMinText = formatStudentAgeFilterValue(clampedMin);
    const nextMaxText = formatStudentAgeFilterValue(clampedMax);
    setMinText(nextMinText);
    setMaxText(nextMaxText);
    onChange({ min: nextMinText, max: nextMaxText });
  };

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

  const handleTickClick = (tickValue: number) => {
    const currentMin = normalizedValue?.min ?? min;
    const currentMax = normalizedValue?.max ?? max;
    const minDistance = Math.abs(tickValue - currentMin);
    const maxDistance = Math.abs(tickValue - currentMax);
    const midpoint = (currentMin + currentMax) / 2;
    const shouldUpdateMin =
      minDistance < maxDistance || (minDistance === maxDistance && tickValue <= midpoint);

    if (shouldUpdateMin) {
      commitRange(Math.min(tickValue, currentMax), currentMax);
      return;
    }

    commitRange(currentMin, Math.max(tickValue, currentMin));
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

      <div className="price-range-slider-control">
        <Slider
          value={sliderValue}
          min={min}
          max={max}
          step={step}
          minStepsBetweenThumbs={0}
          className="age-range-slider"
          onValueChange={(nextValue) => {
            const [nextMin = min, nextMax = max] = nextValue;
            commitRange(nextMin, nextMax);
          }}
        />

        <div className="price-range-slider-ticks age-range-slider-ticks">
          {STUDENT_AGE_RANGE_TICKS.filter((tick) => tick >= min && tick <= max).map((tick) => {
            const isInRange = tick >= sliderValue[0] && tick <= sliderValue[1];
            const isEndpoint = tick === sliderValue[0] || tick === sliderValue[1];
            const position = max > min ? ((tick - min) / (max - min)) * 100 : 0;
            return (
              <button
                key={tick}
                type="button"
                className={`price-range-slider-tick age-range-slider-tick${
                  isInRange ? " price-range-slider-tick--active age-range-slider-tick--active" : ""
                }${isEndpoint ? " price-range-slider-tick--endpoint age-range-slider-tick--endpoint" : ""}`}
                style={{ left: `${position}%` }}
                onClick={() => handleTickClick(tick)}
                aria-label={`${formatStudentAgeFilterValue(tick)} yaş değerini seç`}
              >
                <span className="price-range-slider-tick-marker" aria-hidden />
                <span className="price-range-slider-tick-label">
                  {tick >= STUDENT_AGE_FILTER_MAX ? "99" : formatStudentAgeFilterValue(tick)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
