"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

type FilterNumericStepperProps = {
  value: string;
  onValueChange: (value: string) => void;
  step?: number;
  minValue?: number;
  maxValue?: number;
  allowDecimal?: boolean;
  className?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;
  inputMode?: "numeric" | "decimal";
  type?: "text" | "number";
  autoComplete?: string;
  onFocus?: () => void;
  onBlur?: () => void;
};

function formatStepped(value: number, allowDecimal: boolean): string {
  const rounded = Math.round(value * 1000) / 1000;
  if (!allowDecimal) return String(Math.round(rounded));
  return String(rounded);
}

/** Boş değer 0 sayılmaz. Azaltma boşta kalır; artırma ilk adımı yazar. 0 altına inilmez. */
export function stepFilterNumber(
  current: string,
  direction: 1 | -1,
  options: { step: number; min: number; max?: number; allowDecimal: boolean },
): string {
  const raw = String(current ?? "").trim().replace(",", ".");
  if (!raw) {
    if (direction < 0) return "";
    const start = Math.max(options.min, options.step);
    return formatStepped(start, options.allowDecimal);
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return current;
  let next = Math.round((parsed + direction * options.step) * 1000) / 1000;
  if (next < options.min) next = options.min;
  if (options.max != null && next > options.max) next = options.max;
  return formatStepped(next, options.allowDecimal);
}

export function FilterNumericStepper({
  value,
  onValueChange,
  step = 1,
  minValue = 0,
  maxValue,
  allowDecimal = false,
  className = "",
  id,
  name,
  placeholder,
  ariaLabel,
  inputMode,
  type = "text",
  autoComplete = "off",
  onFocus,
  onBlur,
}: FilterNumericStepperProps) {
  const applyStep = (direction: 1 | -1) => {
    onValueChange(
      stepFilterNumber(value, direction, {
        step,
        min: minValue,
        max: maxValue,
        allowDecimal,
      }),
    );
  };

  return (
    <div className="category-filter-number-control">
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode ?? (allowDecimal ? "decimal" : "numeric")}
        autoComplete={autoComplete}
        value={value}
        min={minValue}
        max={maxValue}
        step={allowDecimal ? step : 1}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={className}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(event) => {
          if (event.key === "-" || event.key === "+" || event.key === "e" || event.key === "E") {
            event.preventDefault();
          }
        }}
        onBeforeInput={(event) => {
          const data = event.nativeEvent.data ?? "";
          if (/[-+eE]/.test(data)) event.preventDefault();
        }}
        onChange={(event) => {
          const typed = (event.nativeEvent as InputEvent).data ?? "";
          if (/[-+eE]/.test(typed)) return;
          const raw = event.target.value;
          if (raw.includes("-")) return;
          onValueChange(raw);
        }}
      />
      <span className="category-filter-number-control__steps">
        <button
          type="button"
          className="category-filter-number-control__step"
          aria-label="Artır"
          onClick={() => applyStep(1)}
        >
          <ChevronUp aria-hidden />
        </button>
        <button
          type="button"
          className="category-filter-number-control__step"
          aria-label="Azalt"
          onClick={() => applyStep(-1)}
        >
          <ChevronDown aria-hidden />
        </button>
      </span>
    </div>
  );
}
