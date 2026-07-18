"use client";

import { useMemo } from "react";
import { Input, Slider } from "@/components/ui";
import {
  STUDENT_AGE_FILTER_MAX,
  STUDENT_AGE_FILTER_MIN,
  STUDENT_AGE_RANGE_TICKS,
  formatStudentAgeFilterValue,
  type StudentAgeRangeValue,
} from "@/lib/institutionStudentAgeFilter";

type AgeRangeSliderFilterProps = {
  value: StudentAgeRangeValue;
  onChange: (value: StudentAgeRangeValue) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseInputValue(value: string): number | null {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

export function AgeRangeSliderFilter({
  value,
  onChange,
  min = STUDENT_AGE_FILTER_MIN,
  max = STUDENT_AGE_FILTER_MAX,
  step = 1,
  className = "",
}: AgeRangeSliderFilterProps) {
  const normalizedValue = useMemo(() => {
    if (!value) return null;
    const nextMin = clamp(Math.min(value.min, value.max), min, max);
    const nextMax = clamp(Math.max(value.min, value.max), min, max);
    if (nextMin === min && nextMax === max) return null;
    return { min: nextMin, max: nextMax };
  }, [max, min, value]);

  const sliderValue = normalizedValue ? [normalizedValue.min, normalizedValue.max] : [min, max];
  const minInput = normalizedValue ? formatStudentAgeFilterValue(normalizedValue.min) : "";
  const maxInput = normalizedValue ? formatStudentAgeFilterValue(normalizedValue.max) : "";

  const commitRange = (nextMin: number, nextMax: number) => {
    const clampedMin = clamp(Math.min(nextMin, nextMax), min, max);
    const clampedMax = clamp(Math.max(nextMin, nextMax), min, max);
    if (clampedMin === min && clampedMax === max) {
      onChange(null);
      return;
    }
    onChange({ min: clampedMin, max: clampedMax });
  };

  const handleMinInputChange = (rawValue: string) => {
    const parsed = parseInputValue(rawValue);
    const currentMax = parseInputValue(maxInput);
    if (parsed == null && currentMax == null) {
      onChange(null);
      return;
    }
    if (parsed == null) {
      commitRange(min, currentMax ?? max);
      return;
    }
    commitRange(parsed, currentMax ?? max);
  };

  const handleMaxInputChange = (rawValue: string) => {
    const parsed = parseInputValue(rawValue);
    const currentMin = parseInputValue(minInput);
    if (parsed == null && currentMin == null) {
      onChange(null);
      return;
    }
    if (parsed == null) {
      commitRange(currentMin ?? min, max);
      return;
    }
    commitRange(currentMin ?? min, parsed);
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
          <span className="price-range-slider-label">Min</span>
          <Input
            type="text"
            inputMode="numeric"
            value={minInput}
            onChange={(event) => handleMinInputChange(event.target.value)}
            placeholder={formatStudentAgeFilterValue(min)}
            className="price-range-slider-input age-range-slider-input"
          />
        </label>
        <label className="price-range-slider-field">
          <span className="price-range-slider-label">Max</span>
          <Input
            type="text"
            inputMode="numeric"
            value={maxInput}
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
