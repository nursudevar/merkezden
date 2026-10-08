"use client";

import { ArrowLeftRight } from "lucide-react";
import { INSTITUTION_COMPARE_MAX } from "@/lib/institutionCompare";
import type { InstitutionCompareItem } from "@/lib/institutionCompare";
import { useInstitutionCompare } from "./InstitutionCompareProvider";
import { useInstructorCompare } from "./InstructorCompareProvider";
import {
  COMPARE_CONFLICT_INSTITUTION_BLOCKED_MESSAGE,
  useCompareConflictNotice,
} from "./CompareConflictNotice";

export function InstitutionCompareToggleButton({
  item,
  className = "",
  labeled = false,
}: {
  item: InstitutionCompareItem;
  className?: string;
  labeled?: boolean;
}) {
  const { items, toggle } = useInstitutionCompare();
  const { items: instructorItems } = useInstructorCompare();
  const { showCompareConflictNotice } = useCompareConflictNotice();
  const selected = items.some((current) => current.id === item.id);
  const disabled = !selected && items.length >= INSTITUTION_COMPARE_MAX;
  const label = selected ? "Karşılaştırmadan çıkar" : "Karşılaştır";

  return (
    <button
      type="button"
      className={`institution-compare-toggle${
        selected ? " institution-compare-toggle--selected" : ""
      }${className ? ` ${className}` : ""}`}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled) return;
        if (selected) {
          toggle(item);
          return;
        }
        if (instructorItems.length > 0) {
          showCompareConflictNotice(COMPARE_CONFLICT_INSTITUTION_BLOCKED_MESSAGE);
          return;
        }
        toggle(item);
      }}
    >
      <ArrowLeftRight size={16} aria-hidden />
      {labeled ? <span>{label}</span> : null}
    </button>
  );
}
