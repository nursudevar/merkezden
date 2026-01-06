"use client";

import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";

const filterConfig = {
  categories: [
    { label: "Anaokulu / Kreş", count: 12, value: "anaokulu" },
    { label: "İlkokul", count: 8, value: "ilkokul" },
    { label: "Ortaokul", count: 5, value: "ortaokul" },
    { label: "Lise", count: 9, value: "lise" },
  ],
};

export default function SchoolPage() {
  return (
    <>
      <CategoryHero />
      <CategoryPageLayout
        categoryName="Okul"
        subtitle="İstanbul bölgesinde öne çıkan en iyi eğitim kurumlarını inceleyin."
        filterConfig={filterConfig}
      />
    </>
  );
}

