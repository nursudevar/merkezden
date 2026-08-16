"use client";

import { useCallback, useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import { useCategoryInstitutions } from "@/components/category/useCategoryInstitutions";
import { useCategoryLocationFilterState } from "@/components/category/categoryLocationFilter";
import {
  EMPTY_SCHOOL_CATEGORY_FILTERS,
  type SchoolCategoryFilterPayload,
} from "@/components/category/schoolCategoryFilterTypes";

export default function CategorySlugPageClient() {
  const params = useParams<{ categorySlug?: string | string[] }>();
  const categorySlugParam = params?.categorySlug;
  const categorySlug = String(
    Array.isArray(categorySlugParam) ? categorySlugParam[0] : categorySlugParam ?? "",
  ).trim();

  const [searchText, setSearchText] = useState("");
  const { location, setLocation, locationReady } = useCategoryLocationFilterState();
  const [categoryFilters, setCategoryFilters] = useState<SchoolCategoryFilterPayload>(
    EMPTY_SCHOOL_CATEGORY_FILTERS,
  );

  useEffect(() => {
    if (!categorySlug) {
      notFound();
    }
  }, [categorySlug]);

  const handleCategoryFilterPayloadChange = useCallback(
    (payload: SchoolCategoryFilterPayload) => {
      setCategoryFilters(payload);
    },
    [],
  );

  const { results, isLoading, error, categoryLabel } = useCategoryInstitutions("", {
    search: searchText,
    ilId: location.ilId,
    ilceId: location.ilceId,
    mahalleId: location.mahalleId,
    locationReady,
    categorySlug,
    schoolFilters: categoryFilters,
  });

  useEffect(() => {
    if (error === "CATEGORY_NOT_FOUND") {
      notFound();
    }
  }, [error]);

  if (!categorySlug) {
    return null;
  }

  return (
    <CategoryPageLayout
      categoryName={categoryLabel || categorySlug}
      categorySlug={categorySlug}
      subtitle="Ankara bölgesinde öne çıkan eğitim kurumlarını inceleyin."
      results={results}
      isLoading={isLoading}
      errorMessage={error === "CATEGORY_NOT_FOUND" ? null : error}
      schoolModeProps={{
        linkedSearch: searchText,
        onLinkedSearchChange: setSearchText,
        linkedLocation: location,
        onLinkedLocationChange: setLocation,
        onSchoolFilterPayloadChange: handleCategoryFilterPayloadChange,
      }}
    />
  );
}
