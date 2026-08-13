import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Duyurular ve Güncel Haberler | Merkezden",
  description:
    "Merkezden'deki eğitim, kurs, etkinlik ve kurum duyurularını takip edin.",
};

export default function DuyurularLayout({ children }: { children: React.ReactNode }) {
  return children;
}
