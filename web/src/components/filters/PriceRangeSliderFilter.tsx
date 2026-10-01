"use client";

import { Input } from "@/components/ui";
import {
  INSTITUTION_PRICE_FILTER_MAX,
  INSTITUTION_PRICE_FILTER_MIN,
} from "@/lib/institutionPriceRangeFilter";

/**
 * Kısmi aralık destekler:
 * - null → her iki uç boş (filtre yok)
 * - { min: 50, max: null } → yalnız min
 * - { min: null, max: 10000 } → yalnız max
 * - { min: 50, max: 10000 } → ikisi
 *
 * INSTITUTION_PRICE_FILTER_MIN/MAX input state'ine otomatik yazılmaz;
 * yalnızca isteğe bağlı clamp üst/alt sınırı olarak kullanılabilir.
 */
export type PriceRangeSliderValue = {
  min: number | null;
  max: number | null;
} | null;

type PriceRangeSliderFilterProps = {
  value: PriceRangeSliderValue;
  onChange: (value: PriceRangeSliderValue) => void;
  /** Teknik alt sınır (input'a default basılmaz). */
  min?: number;
  /** Teknik üst sınır (input'a default basılmaz). */
  max?: number;
  step?: number;
  className?: string;
};

function parseInputValue(value: string): number | null {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampToBounds(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function emitPartial(
  nextMin: number | null,
  nextMax: number | null,
  onChange: (value: PriceRangeSliderValue) => void,
) {
  if (nextMin == null && nextMax == null) {
    onChange(null);
    return;
  }
  onChange({ min: nextMin, max: nextMax });
}

export function PriceRangeSliderFilter({
  value,
  onChange,
  min = INSTITUTION_PRICE_FILTER_MIN,
  max = INSTITUTION_PRICE_FILTER_MAX,
  className = "",
}: PriceRangeSliderFilterProps) {
  const minDigits = value?.min != null && Number.isFinite(value.min) ? String(value.min) : "";
  const maxDigits = value?.max != null && Number.isFinite(value.max) ? String(value.max) : "";

  const handleMinInputChange = (rawValue: string) => {
    const parsed = parseInputValue(rawValue);
    const nextMin =
      parsed == null ? null : clampToBounds(parsed, min, max);
    const currentMax =
      value?.max != null && Number.isFinite(value.max) ? value.max : null;
    emitPartial(nextMin, currentMax, onChange);
  };

  const handleMaxInputChange = (rawValue: string) => {
    const parsed = parseInputValue(rawValue);
    const nextMax =
      parsed == null ? null : clampToBounds(parsed, min, max);
    const currentMin =
      value?.min != null && Number.isFinite(value.min) ? value.min : null;
    emitPartial(currentMin, nextMax, onChange);
  };

  return (
    <div className={`price-range-slider-filter ${className}`.trim()}>
      <div className="price-range-slider-inputs">
        <label className="price-range-slider-field">
          <span className="price-range-slider-label">Minimum Fiyat</span>
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={minDigits}
            onChange={(event) => handleMinInputChange(event.target.value)}
            placeholder="Min"
            className="price-range-slider-input"
          />
        </label>
        <label className="price-range-slider-field">
          <span className="price-range-slider-label">Maksimum Fiyat</span>
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={maxDigits}
            onChange={(event) => handleMaxInputChange(event.target.value)}
            placeholder="Max"
            className="price-range-slider-input"
          />
        </label>
      </div>
    </div>
  );
}
