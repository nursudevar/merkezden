"use client";

import { type ReactNode } from "react";
import { useClientMounted } from "@/hooks/useClientMounted";

type SelectMountGateProps = {
  /** SSR/hydration placeholder metni — SelectValue ile aynı görünüm. */
  label: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Radix Select SSR sırasında useId tabanlı aria-controls üretir; sayfada çoklu
 * sidebar kopyası varken hydration'da id sırası kayabilir. Mount sonrasına kadar
 * boyutu koruyan statik placeholder gösterir.
 */
export function SelectMountGate({
  label,
  disabled = false,
  className = "select-trigger-default category-filter-select",
  children,
}: SelectMountGateProps) {
  const mounted = useClientMounted();

  if (!mounted) {
    return (
      <div
        className={className}
        aria-hidden
        data-disabled={disabled ? "" : undefined}
      >
        <span>{label}</span>
      </div>
    );
  }

  return children;
}
