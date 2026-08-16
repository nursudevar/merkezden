"use client";

import Link from "next/link";
import type { PublicBreadcrumbItem } from "@/lib/publicBreadcrumb";

export type PublicBreadcrumbVariant = "category" | "institution" | "instructor";

const CLASS_PREFIX: Record<PublicBreadcrumbVariant, string> = {
  category: "category-breadcrumb",
  institution: "institution-breadcrumb",
  instructor: "instructor-breadcrumb",
};

export default function PublicBreadcrumbNav({
  items,
  variant = "category",
}: {
  items: PublicBreadcrumbItem[];
  variant?: PublicBreadcrumbVariant;
}) {
  const visibleItems = items.filter((item) => String(item.label ?? "").trim().length > 0);
  if (visibleItems.length === 0) return null;

  const prefix = CLASS_PREFIX[variant];

  return (
    <nav className={prefix} aria-label="Breadcrumb">
      <div className={`${prefix}-container`}>
        {visibleItems.map((item, index) => {
          const isLast = index === visibleItems.length - 1;
          const label = item.label.trim();
          return (
            <span key={`${label}-${index}`} className={`${prefix}-item`}>
              {index > 0 ? (
                <span className={`${prefix}-separator`} aria-hidden="true">
                  &gt;
                </span>
              ) : null}
              {!isLast && item.href ? (
                <Link href={item.href} className={`${prefix}-link`}>
                  {label}
                </Link>
              ) : (
                <span className={isLast ? `${prefix}-current` : `${prefix}-link`}>
                  {label}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </nav>
  );
}
