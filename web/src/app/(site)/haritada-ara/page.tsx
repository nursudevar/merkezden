import type { Metadata } from "next";
import { HaritadaAraPageClient } from "./HaritadaAraPageClient";

export const metadata: Metadata = {
  title: "Haritada Ara | Merkezden",
  description:
    "Ankara'daki eğitim kurumlarını harita üzerinde keşfedin. Kategori filtreleri ve görünen kurum listesi ile arayın.",
};

export default function HaritadaAraPage() {
  return <HaritadaAraPageClient />;
}
