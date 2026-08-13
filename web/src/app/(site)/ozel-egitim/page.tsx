import type { Metadata } from "next";
import { getCategoryPageMetadata } from "@/lib/seo/categoryPageMetadata";
import SpecialEducationPageClient from "./SpecialEducationPageClient";

export const metadata: Metadata = getCategoryPageMetadata("Özel Eğitim");

export default function SpecialEducationPage() {
  return <SpecialEducationPageClient />;
}
