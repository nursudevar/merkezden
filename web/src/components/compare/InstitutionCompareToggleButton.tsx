"use client";

import { ArrowLeftRight } from "lucide-react";
import { INSTITUTION_COMPARE_MAX } from "@/lib/institutionCompare";
import type { InstitutionCompareItem } from "@/lib/institutionCompare";
import { useInstitutionCompare } from "./InstitutionCompareProvider";

export function InstitutionCompareToggleButton({
  item,
  className = "",
}: {
  item: InstitutionCompareItem;
  className?: string;
}) {
  const { items, toggle } = useInstitutionCompare();
  const selected = items.some((current) => current.id === item.id);
  const disabled = !selected && items.length >= INSTITUTION_COMPARE_MAX;

  return (
    <button
      type="button"
      className={`institution-compare-toggle${
        selected ? " institution-compare-toggle--selected" : ""
      }${className ? ` ${className}` : ""}`}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={selected ? "Karşılaştırmadan çıkar" : "Karşılaştırmaya ekle"}
      title={selected ? "Karşılaştırmadan çıkar" : "Karşılaştır"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled) return;
        toggle(item);
      }}
    >
      <ArrowLeftRight size={16} aria-hidden />
    </button>
  );
}
