import type { Metadata } from "next";
import { AllInstructorsPageClient } from "./AllInstructorsPageClient";

export const metadata: Metadata = {
  title: "Eğitmenler ve Özel Ders Seçenekleri | Merkezden",
  description:
    "Farklı alanlarda hizmet veren eğitmenleri Merkezden'de keşfedin. Uzmanlık, eğitim ve profil bilgilerini inceleyerek size uygun seçenekleri bulun.",
};

export default function InstructorsListPage() {
  return <AllInstructorsPageClient />;
}
