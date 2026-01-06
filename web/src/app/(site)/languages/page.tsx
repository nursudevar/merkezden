"use client";

import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";

const filterConfig = {
  categories: [
    { label: "İngilizce", count: 25, value: "ingilizce" },
    { label: "Almanca", count: 10, value: "almanca" },
    { label: "Fransızca", count: 8, value: "fransizca" },
    { label: "İspanyolca", count: 6, value: "ispanyolca" },
  ],
};

export default function LanguagesPage() {
  return (
    <>
      <CategoryHero />
      <CategoryPageLayout
        categoryName="Yabancı Dil"
        subtitle="Yabancı dil öğrenimi için en iyi eğitim kurumları. Global dünyaya açılın ve dil becerilerinizi geliştirin."
        filterConfig={filterConfig}
      />
    </>
  );
}

