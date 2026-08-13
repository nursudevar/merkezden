"use client";

import { useCallback, useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import { useCategoryInstitutions } from "@/components/category/useCategoryInstitutions";
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
  const [district, setDistrict] = useState("");
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

  const { results, isLoading, error, districts, categoryLabel } = useCategoryInstitutions("", {
    search: searchText,
    district,
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
      districts={districts}
      categoryName={categoryLabel || categorySlug}
      categorySlug={categorySlug}
      subtitle="Ankara bölgesinde öne çıkan eğitim kurumlarını inceleyin."
      results={results}
      isLoading={isLoading}
      errorMessage={error === "CATEGORY_NOT_FOUND" ? null : error}
      schoolModeProps={{
        linkedSearch: searchText,
        onLinkedSearchChange: setSearchText,
        linkedDistrict: district,
        onLinkedDistrictChange: setDistrict,
        onSchoolFilterPayloadChange: handleCategoryFilterPayloadChange,
      }}
    />
  );
}
