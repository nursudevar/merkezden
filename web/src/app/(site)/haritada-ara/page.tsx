import type { Metadata } from "next";
import { Suspense } from "react";
import { HaritadaAraPageClient } from "./HaritadaAraPageClient";

export const metadata: Metadata = {
  title: "Haritada Ara | Merkezden",
  description:
    "Ankara'daki eğitim kurumlarını ve eğitmenleri harita üzerinde keşfedin. Kategori filtreleri ve görünen sonuç listesi ile arayın.",
};

export default function HaritadaAraPage() {
  return (
    <Suspense fallback={<main className="category-page-layout haritada-ara-page" />}>
      <HaritadaAraPageClient />
    </Suspense>
  );
}
