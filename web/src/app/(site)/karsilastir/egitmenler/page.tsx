import type { Metadata } from "next";
import { Suspense } from "react";
import InstructorComparePageClient from "./InstructorComparePageClient";

export const metadata: Metadata = {
  title: "Eğitmen Karşılaştır | Merkezden",
  description: "Seçtiğiniz eğitmenleri yan yana karşılaştırın.",
};

export default function InstructorComparePage() {
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
      <InstructorComparePageClient />
    </Suspense>
  );
}
