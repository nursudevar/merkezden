"use client";

import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";

const filterConfig = {
  categories: [
    { label: "Otizm", count: 14, value: "otizm" },
    { label: "Down Sendromu", count: 10, value: "down" },
    { label: "Öğrenme Güçlüğü", count: 16, value: "ogrenme" },
    { label: "Fiziksel Engelli", count: 8, value: "fiziksel" },
  ],
};

export default function SpecialEducationPage() {
  return (
    <>
      <CategoryHero />
      <CategoryPageLayout
        categoryName="Özel Eğitim"
        subtitle="Özel eğitim ihtiyaçları için uzman eğitim kurumları. Her çocuğun ihtiyacına özel eğitim çözümleri."
        filterConfig={filterConfig}
      />
    </>
  );
}

