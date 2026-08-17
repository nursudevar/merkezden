"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ActiveInstitutionCategory } from "@/lib/categoryHelpers";

type HaritadaAraCategoryMultiSelectProps = {
  categories: readonly ActiveInstitutionCategory[];
  selectedSlugs: readonly string[];
  onSelectAll: () => void;
  onToggleSlug: (slug: string) => void;
};

function buildTriggerLabel(
  selectedSlugs: readonly string[],
  categories: readonly ActiveInstitutionCategory[],
): string {
  if (selectedSlugs.length === 0) return "Hepsi";
  if (selectedSlugs.length === 1) {
    const match = categories.find(
      (category) => category.slug.trim().toLowerCase() === selectedSlugs[0],
    );
    return match?.name ?? "1 kategori seçildi";
  }
  return `${selectedSlugs.length} kategori seçildi`;
}

export function HaritadaAraCategoryMultiSelect({
  categories,
  selectedSlugs,
  onSelectAll,
  onToggleSlug,
}: HaritadaAraCategoryMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const isAllSelected = selectedSlugs.length === 0;
  const triggerLabel = buildTriggerLabel(selectedSlugs, categories);

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
      className={`haritada-ara-category-multiselect${open ? " haritada-ara-category-multiselect--open" : ""}`}
    >
      <button
        type="button"
        className="haritada-ara-category-multiselect-trigger category-filter-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="haritada-ara-category-multiselect-trigger-label">{triggerLabel}</span>
        <ChevronDown className="haritada-ara-category-multiselect-trigger-icon" aria-hidden />
      </button>

      {open ? (
        <div
          id={listboxId}
          className="haritada-ara-category-multiselect-panel"
          role="listbox"
          aria-label="Kategori seçimi"
          aria-multiselectable="true"
        >
          <label
            className={`category-filter-checkbox-option haritada-ara-category-multiselect-option${
              isAllSelected ? " category-filter-checkbox-option--selected" : ""
            }`}
          >
            <input
              type="checkbox"
              className="category-filter-checkbox-input"
              checked={isAllSelected}
              onChange={() => {
                if (!isAllSelected) onSelectAll();
              }}
            />
            <span className="category-filter-checkbox-label">Hepsi</span>
          </label>

          {categories.map((category) => {
            const slug = category.slug.trim().toLowerCase();
            const isChecked = selectedSlugs.includes(slug);
            return (
              <label
                key={category.id}
                className={`category-filter-checkbox-option haritada-ara-category-multiselect-option${
                  isChecked ? " category-filter-checkbox-option--selected" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="category-filter-checkbox-input"
                  checked={isChecked}
                  onChange={() => onToggleSlug(slug)}
                />
                <span className="category-filter-checkbox-label">{category.name}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
