"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import PublicBreadcrumbNav from "./PublicBreadcrumbNav";
import type { CategoryLocationFilterValue } from "./categoryLocationFilter";
import { EMPTY_CATEGORY_LOCATION_FILTER } from "./categoryLocationFilter";
import {
  assemblePublicBreadcrumbItems,
  getRouteCategoryBreadcrumbLabel,
  toBreadcrumbLabel,
  useLocationBreadcrumbTrail,
  type PublicBreadcrumbItem,
} from "@/lib/publicBreadcrumb";
import type { PublicBreadcrumbVariant } from "./PublicBreadcrumbNav";

export default function CategoryBreadcrumb({
  categoryLabel,
  categoryHref,
  extraItems,
  location = EMPTY_CATEGORY_LOCATION_FILTER,
  applyDefaultCity = false,
  listingPathname,
  currentLabel,
  variant = "category",
}: {
  categoryLabel?: string;
  categoryHref?: string;
  extraItems?: PublicBreadcrumbItem[];
  location?: CategoryLocationFilterValue;
  applyDefaultCity?: boolean;
  listingPathname?: string;
  currentLabel?: string;
  variant?: PublicBreadcrumbVariant;
}) {
  const pathname = usePathname();
  const resolvedListingPath =
    listingPathname !== undefined
      ? String(listingPathname).trim()
      : String(pathname ?? "").trim() || "/";
  const resolvedCategoryLabel =
    categoryLabel !== undefined
      ? toBreadcrumbLabel(categoryLabel)
      : getRouteCategoryBreadcrumbLabel(resolvedListingPath || pathname);
  const trail = useLocationBreadcrumbTrail(location, { applyDefaultCity });

  const items = useMemo(
    () =>
      assemblePublicBreadcrumbItems({
        categoryLabel: resolvedCategoryLabel,
        categoryHref: categoryHref || resolvedListingPath || undefined,
        extraItems,
        trail,
        listingPathname: resolvedListingPath,
        currentLabel,
      }),
    [
      categoryHref,
      currentLabel,
      extraItems,
      resolvedCategoryLabel,
      resolvedListingPath,
      trail,
    ],
  );

  return <PublicBreadcrumbNav items={items} variant={variant} />;
}
