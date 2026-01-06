"use client";

import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";

const filterConfig = {
  categories: [
    { label: "Futbol", count: 18, value: "futbol" },
    { label: "Basketbol", count: 14, value: "basketbol" },
    { label: "Yüzme", count: 22, value: "yuzme" },
    { label: "Tenis", count: 10, value: "tenis" },
  ],
};

export default function SportsPage() {
  return (
    <>
      <CategoryHero />
      <CategoryPageLayout
        categoryName="Spor"
        subtitle="Spor ve fiziksel aktivite odaklı eğitim kurumları. Sağlıklı yaşam ve spor becerileri için ideal seçenekler."
        filterConfig={filterConfig}
      />
    </>
  );
}

