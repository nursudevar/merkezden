import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sıkça Sorulan Sorular | Merkezden",
  description:
    "Merkezden'in kullanımı, üyelik, kurum ve eğitmen profilleri hakkındaki sıkça sorulan soruların yanıtlarını inceleyin.",
};

export default function SikcaSorulanSorularLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
