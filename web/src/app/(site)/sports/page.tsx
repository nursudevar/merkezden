"use client";

import { useState } from "react";
import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import { useCategoryInstitutions } from "@/components/category/useCategoryInstitutions";

const CATEGORY_NAME = "Spor";

const filterConfig = {
  categories: [
    { label: "Futbol", count: 18, value: "futbol" },
    { label: "Basketbol", count: 14, value: "basketbol" },
    { label: "Yüzme", count: 22, value: "yuzme" },
    { label: "Tenis", count: 10, value: "tenis" },
  ],
};

export default function SportsPage() {
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
        subtitle="Spor ve fiziksel aktivite odaklı eğitim kurumları. Sağlıklı yaşam ve spor becerileri için ideal seçenekler."
        filterConfig={filterConfig}
        results={results}
        isLoading={isLoading}
        errorMessage={error}
      />
    </>
  );
}
