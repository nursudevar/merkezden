"use client";

import { useState } from "react";
import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import { useCategoryInstitutions } from "@/components/category/useCategoryInstitutions";

const CATEGORY_NAME = "Kurs & Sınava Hazırlık";

const filterConfig = {
  categories: [
    { label: "YKS Hazırlık", count: 15, value: "yks" },
    { label: "LGS Hazırlık", count: 12, value: "lgs" },
    { label: "KPSS", count: 8, value: "kpss" },
    { label: "Dil Kursları", count: 20, value: "dil" },
  ],
};

export default function CoursesExamsPage() {
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
        subtitle="Sınavlara hazırlık ve kişisel gelişim kursları. Başarıya giden yolda size en uygun eğitim programını bulun."
        filterConfig={filterConfig}
        results={results}
        isLoading={isLoading}
        errorMessage={error}
      />
    </>
  );
}
