"use client";

import { useCallback, useState } from "react";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import { useCategoryInstitutions } from "@/components/category/useCategoryInstitutions";
import {
  EMPTY_SCHOOL_CATEGORY_FILTERS,
  type SchoolCategoryFilterPayload,
} from "@/components/category/schoolCategoryFilterTypes";

const CATEGORY_NAME = "Okul";
/** institution_categories.slug ve institution_feature_groups.category_slug ile eşleşir. */
const CATEGORY_SLUG = "okul";

export default function SchoolPageClient() {
  const [searchText, setSearchText] = useState("");
  const [district, setDistrict] = useState("");
  const [schoolFilters, setSchoolFilters] = useState<SchoolCategoryFilterPayload>(
    EMPTY_SCHOOL_CATEGORY_FILTERS,
  );

  const handleSchoolFilterPayloadChange = useCallback((payload: SchoolCategoryFilterPayload) => {
    setSchoolFilters(payload);
  }, []);

  const { results, isLoading, error, districts } = useCategoryInstitutions(CATEGORY_NAME, {
    search: searchText,
    district,
    categorySlug: CATEGORY_SLUG,
    schoolFilters,
  });

  return (
      <CategoryPageLayout
        districts={districts}
        categoryName={CATEGORY_NAME}
        categorySlug={CATEGORY_SLUG}
        subtitle="Ankara bölgesinde öne çıkan en iyi eğitim kurumlarını inceleyin."
        results={results}
        isLoading={isLoading}
        errorMessage={error}
        schoolModeProps={{
          linkedSearch: searchText,
          onLinkedSearchChange: setSearchText,
          linkedDistrict: district,
          onLinkedDistrictChange: setDistrict,
          onSchoolFilterPayloadChange: handleSchoolFilterPayloadChange,
        }}
      />
  );
}
