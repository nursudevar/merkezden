import type { Metadata } from "next";
import { Suspense } from "react";
import InstitutionComparePageClient from "./InstitutionComparePageClient";

export const metadata: Metadata = {
  title: "Kurum Karşılaştır | Merkezden",
  description: "Seçtiğiniz eğitim kurumlarını yan yana karşılaştırın.",
};

export default function InstitutionComparePage() {
  return (
    <Suspense
      fallback={
        <div className="institution-compare-page">
          <div className="institution-compare-container">
            <p className="institution-compare-status">Yükleniyor...</p>
          </div>
        </div>
      }
    >
      <InstitutionComparePageClient />
    </Suspense>
  );
}
