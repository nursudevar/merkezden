"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export type InstructorCategorySelectOption = {
  value: string;
  label: string;
};

type PanelPlacement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const PANEL_MAX_HEIGHT = 320;
const PANEL_GAP = 6;
const VIEWPORT_MARGIN = 12;

function computePanelPlacement(trigger: HTMLElement): PanelPlacement {
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - VIEWPORT_MARGIN;
  const openUp = spaceBelow < PANEL_MAX_HEIGHT && spaceAbove > spaceBelow;
  const available = Math.max(0, openUp ? spaceAbove : spaceBelow);
  const maxHeight = Math.min(PANEL_MAX_HEIGHT, available);
  const top = openUp ? rect.top - PANEL_GAP - maxHeight : rect.bottom + PANEL_GAP;

  return {
    top,
    left: rect.left,
    width: rect.width,
    maxHeight,
  };
}

type InstructorCategorySelectProps = {
  value: string;
  options: readonly InstructorCategorySelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  allLabel?: string;
};

/**
 * Eğitmen kategori seçimi. Radix Select sayfa kaydırmasını kilitlediği ve
 * alta zorlanan listeyi viewport kenarında kestiği için bu kontrol portal
 * kullanır, gövde kaydırmasını kilitlemez.
 */
export function InstructorCategorySelect({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Kategori Seçin",
  allLabel = "Tüm Kategoriler",
}: InstructorCategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<PanelPlacement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedLabel = options.find((option) => option.value === value)?.label;
  const triggerLabel = selectedLabel || (value ? placeholder : allLabel);

  const updatePlacement = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setPlacement(computePanelPlacement(trigger));
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePlacement();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const handleReposition = () => updatePlacement();

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  const panel =
    open && placement && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={listboxId}
            className="instructor-category-select-panel"
            role="listbox"
            aria-label="Kategori"
            style={{
              top: placement.top,
              left: placement.left,
              width: placement.width,
              maxHeight: placement.maxHeight,
            }}
          >
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={`select-item instructor-category-select-option${
                !value ? " instructor-category-select-option--selected" : ""
              }`}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {allLabel}
            </button>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`select-item instructor-category-select-option${
                    selected ? " instructor-category-select-option--selected" : ""
                  }`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={`category-filter-multiselect${open ? " category-filter-multiselect--open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="category-filter-multiselect-trigger category-filter-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="category-filter-multiselect-trigger-label">{triggerLabel}</span>
        <ChevronDown className="category-filter-multiselect-trigger-icon" aria-hidden />
      </button>
      {panel}
    </div>
  );
}
