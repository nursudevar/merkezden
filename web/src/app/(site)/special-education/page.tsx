"use client";

import { useState } from "react";
import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import { useCategoryInstitutions } from "@/components/category/useCategoryInstitutions";

const CATEGORY_NAME = "Özel Eğitim";

const filterConfig = {
  categories: [
    { label: "Otizm", count: 14, value: "otizm" },
    { label: "Down Sendromu", count: 10, value: "down" },
    { label: "Öğrenme Güçlüğü", count: 16, value: "ogrenme" },
    { label: "Fiziksel Engelli", count: 8, value: "fiziksel" },
  ],
};

export default function SpecialEducationPage() {
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
        subtitle="Özel eğitim ihtiyaçları için uzman eğitim kurumları. Her çocuğun ihtiyacına özel eğitim çözümleri."
        filterConfig={filterConfig}
        results={results}
        isLoading={isLoading}
        errorMessage={error}
      />
    </>
  );
}
