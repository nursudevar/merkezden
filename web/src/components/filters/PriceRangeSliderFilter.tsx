"use client";

import { useMemo } from "react";
import { Input, Slider } from "@/components/ui";
import {
  INSTITUTION_PRICE_FILTER_MAX,
  INSTITUTION_PRICE_FILTER_MIN,
  formatPriceFilterValue,
} from "@/lib/institutionPriceRangeFilter";

export type PriceRangeSliderValue = {
  min: number;
  max: number;
} | null;

const PRICE_RANGE_TICKS = [0, 100_000, 200_000, 300_000];

type PriceRangeSliderFilterProps = {
  value: PriceRangeSliderValue;
  onChange: (value: PriceRangeSliderValue) => void;
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

export function PriceRangeSliderFilter({
  value,
  onChange,
  min = INSTITUTION_PRICE_FILTER_MIN,
  max = INSTITUTION_PRICE_FILTER_MAX,
  step = 1000,
  className = "",
}: PriceRangeSliderFilterProps) {
  const normalizedValue = useMemo(() => {
    if (!value) return null;
    const nextMin = clamp(Math.min(value.min, value.max), min, max);
    const nextMax = clamp(Math.max(value.min, value.max), min, max);
    return { min: nextMin, max: nextMax };
  }, [max, min, value]);

  const sliderValue = normalizedValue ? [normalizedValue.min, normalizedValue.max] : [min, max];
  const minInput = normalizedValue ? formatPriceFilterValue(normalizedValue.min) : "";
  const maxInput = normalizedValue ? formatPriceFilterValue(normalizedValue.max) : "";

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
    const currentMax = parseInputValue(maxInput) ?? normalizedValue?.max ?? max;
    if (parsed == null) {
      onChange(null);
      return;
    }
    commitRange(parsed, currentMax);
  };

  const handleMaxInputChange = (rawValue: string) => {
    const parsed = parseInputValue(rawValue);
    const currentMin = parseInputValue(minInput) ?? normalizedValue?.min ?? min;
    if (parsed == null) {
      onChange(null);
      return;
    }
    commitRange(currentMin, parsed);
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
    <div className={`price-range-slider-filter ${className}`.trim()}>
      <div className="price-range-slider-inputs">
        <label className="price-range-slider-field">
          <span className="price-range-slider-label">Min</span>
          <Input
            type="text"
            inputMode="numeric"
            value={minInput}
            onChange={(event) => handleMinInputChange(event.target.value)}
            placeholder={formatPriceFilterValue(min)}
            className="price-range-slider-input"
          />
        </label>
        <label className="price-range-slider-field">
          <span className="price-range-slider-label">Max</span>
          <Input
            type="text"
            inputMode="numeric"
            value={maxInput}
            onChange={(event) => handleMaxInputChange(event.target.value)}
            placeholder={formatPriceFilterValue(max)}
            className="price-range-slider-input"
          />
        </label>
      </div>

      <div className="price-range-slider-control">
        <Slider
          value={sliderValue}
          min={min}
          max={max}
          step={step}
          minStepsBetweenThumbs={1}
          onValueChange={(nextValue) => {
            const [nextMin = min, nextMax = max] = nextValue;
            commitRange(nextMin, nextMax);
          }}
        />

        <div className="price-range-slider-ticks">
          {PRICE_RANGE_TICKS.filter((tick) => tick >= min && tick <= max).map((tick) => {
            const isInRange = tick >= sliderValue[0] && tick <= sliderValue[1];
            const isEndpoint = tick === sliderValue[0] || tick === sliderValue[1];
            const position = max > min ? ((tick - min) / (max - min)) * 100 : 0;
            return (
              <button
                key={tick}
                type="button"
                className={`price-range-slider-tick${
                  isInRange ? " price-range-slider-tick--active" : ""
                }${isEndpoint ? " price-range-slider-tick--endpoint" : ""}`}
                style={{ left: `${position}%` }}
                onClick={() => handleTickClick(tick)}
                aria-label={`${formatPriceFilterValue(tick)} fiyat değerini seç`}
              >
                <span className="price-range-slider-tick-marker" aria-hidden />
                <span className="price-range-slider-tick-label">
                  {formatPriceFilterValue(tick)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
