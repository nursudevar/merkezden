"use client";

import { useState } from "react";
import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import { useCategoryInstitutions } from "@/components/category/useCategoryInstitutions";

const CATEGORY_NAME = "Yabancı Dil";

const filterConfig = {
  categories: [
    { label: "İngilizce", count: 25, value: "ingilizce" },
    { label: "Almanca", count: 10, value: "almanca" },
    { label: "Fransızca", count: 8, value: "fransizca" },
    { label: "İspanyolca", count: 6, value: "ispanyolca" },
  ],
};

export default function LanguagesPage() {
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
        subtitle="Yabancı dil öğrenimi için en iyi eğitim kurumları. Global dünyaya açılın ve dil becerilerinizi geliştirin."
        filterConfig={filterConfig}
        results={results}
        isLoading={isLoading}
        errorMessage={error}
      />
    </>
  );
}
