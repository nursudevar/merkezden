import type { Metadata } from "next";
import { AllInstructorsPageClient } from "./AllInstructorsPageClient";

export const metadata: Metadata = {
  title: "Tüm Eğitmenler | Merkezden",
  description: "Merkezden üzerindeki bireysel eğitmenleri listeleyin ve profillerini inceleyin.",
};

export default function InstructorsListPage() {
  return <AllInstructorsPageClient />;
}
