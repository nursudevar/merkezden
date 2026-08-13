"use client";

import { ArrowLeftRight } from "lucide-react";
import { INSTRUCTOR_COMPARE_MAX } from "@/lib/instructorCompare";
import type { InstructorCompareItem } from "@/lib/instructorCompare";
import { useInstructorCompare } from "./InstructorCompareProvider";
import { useInstitutionCompare } from "./InstitutionCompareProvider";
import {
  COMPARE_CONFLICT_INSTRUCTOR_BLOCKED_MESSAGE,
  useCompareConflictNotice,
} from "./CompareConflictNotice";

export function InstructorCompareToggleButton({
  item,
  className = "",
}: {
  item: InstructorCompareItem;
  className?: string;
}) {
  const { items, toggle } = useInstructorCompare();
  const { items: institutionItems } = useInstitutionCompare();
  const { showCompareConflictNotice } = useCompareConflictNotice();
  const selected = items.some((current) => current.id === item.id);
  const disabled = !selected && items.length >= INSTRUCTOR_COMPARE_MAX;

  return (
    <button
      type="button"
      className={`instructor-compare-toggle${
        selected ? " instructor-compare-toggle--selected" : ""
      }${className ? ` ${className}` : ""}`}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={selected ? "Karşılaştırmadan çıkar" : "Karşılaştır"}
      title={selected ? "Karşılaştırmadan çıkar" : "Karşılaştır"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled) return;
        if (selected) {
          toggle(item);
          return;
        }
        if (institutionItems.length > 0) {
          showCompareConflictNotice(COMPARE_CONFLICT_INSTRUCTOR_BLOCKED_MESSAGE);
          return;
        }
        toggle(item);
      }}
    >
      <ArrowLeftRight size={16} aria-hidden />
    </button>
  );
}
