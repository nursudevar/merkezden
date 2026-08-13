import type { Metadata } from "next";
import HomePageClient from "./HomePageClient";

export const metadata: Metadata = {
  title: "Merkezden | Eğitim, Kurs ve Özel Ders Platformu",
  description:
    "Ankara'daki okulları, kursları, eğitim kurumlarını ve özel ders eğitmenlerini keşfedin ve karşılaştırın.",
};

export default function HomePage() {
  return <HomePageClient />;
}
