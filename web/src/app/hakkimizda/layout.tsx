import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hakkımızda | Merkezden",
  description:
    "Merkezden'in eğitim kurumlarını, kursları ve eğitmenleri kullanıcılarla buluşturan yapısını ve hedeflerini keşfedin.",
};

export default function HakkimizdaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
