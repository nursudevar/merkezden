"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type CategoryFilterMultiSelectOption = {
  value: string;
  label: string;
};

type CategoryFilterMultiSelectProps = {
  options: readonly CategoryFilterMultiSelectOption[];
  selectedValues: readonly string[];
  onToggleValue: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  selectedCountNoun?: string;
};

function buildTriggerLabel(
  selectedValues: readonly string[],
  options: readonly CategoryFilterMultiSelectOption[],
  placeholder: string,
  selectedCountNoun: string,
): string {
  if (selectedValues.length === 0) return placeholder;

  const labels = selectedValues
    .map((value) => options.find((option) => option.value === value)?.label ?? value)
    .filter(Boolean);

  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]}, ${labels[1]}`;
  return `${labels.length} ${selectedCountNoun} seçildi`;
}

/**
 * Haritada Ara kategori multi-select ile aynı UX:
 * kapalı trigger + açık panelde checkbox seçenekleri.
 */
export function CategoryFilterMultiSelect({
  options,
  selectedValues,
  onToggleValue,
  placeholder = "Seçin",
  ariaLabel = "Çoklu seçim",
  selectedCountNoun = "tür",
}: CategoryFilterMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const triggerLabel = buildTriggerLabel(
    selectedValues,
    options,
    placeholder,
    selectedCountNoun,
  );

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!containerRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`category-filter-multiselect${open ? " category-filter-multiselect--open" : ""}`}
    >
      <button
        type="button"
        className="category-filter-multiselect-trigger category-filter-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="category-filter-multiselect-trigger-label">{triggerLabel}</span>
        <ChevronDown className="category-filter-multiselect-trigger-icon" aria-hidden />
      </button>

      {open ? (
        <div
          id={listboxId}
          className="category-filter-multiselect-panel"
          role="listbox"
          aria-label={ariaLabel}
          aria-multiselectable="true"
        >
          {options.map((option) => {
            const isChecked = selectedValues.includes(option.value);
            return (
              <label
                key={option.value}
                className={`category-filter-checkbox-option category-filter-multiselect-option${
                  isChecked ? " category-filter-checkbox-option--selected" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="category-filter-checkbox-input"
                  checked={isChecked}
                  onChange={() => onToggleValue(option.value)}
                />
                <span className="category-filter-checkbox-label">{option.label}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
