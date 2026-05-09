"use client";

import { useState } from "react";
import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import { useCategoryInstitutions } from "@/components/category/useCategoryInstitutions";

const CATEGORY_NAME = "Okul";

const filterConfig = {
  categories: [
    { label: "Anaokulu / Kreş", count: 12, value: "anaokulu" },
    { label: "İlkokul", count: 8, value: "ilkokul" },
    { label: "Ortaokul", count: 5, value: "ortaokul" },
    { label: "Lise", count: 9, value: "lise" },
  ],
};

export default function SchoolPage() {
  const [searchText, setSearchText] = useState("");
  const [district, setDistrict] = useState("");
  const { results, isLoading, error, districts } = useCategoryInstitutions(CATEGORY_NAME, {
    search: searchText,
    district,
  });

  return (
    <>
      <CategoryHero
        searchValue={searchText}
        onSearchChange={setSearchText}
        selectedDistrict={district}
        onDistrictChange={setDistrict}
        districts={districts}
      />
      <CategoryPageLayout
        categoryName={CATEGORY_NAME}
        subtitle="İstanbul bölgesinde öne çıkan en iyi eğitim kurumlarını inceleyin."
        filterConfig={filterConfig}
        results={results}
        isLoading={isLoading}
        errorMessage={error}
      />
    </>
  );
}
