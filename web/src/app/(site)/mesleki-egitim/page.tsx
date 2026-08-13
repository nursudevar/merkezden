import type { Metadata } from "next";
import { getCategoryPageMetadata } from "@/lib/seo/categoryPageMetadata";
import VocationalTrainingPageClient from "./VocationalTrainingPageClient";

export const metadata: Metadata = getCategoryPageMetadata("Mesleki Eğitim");

export default function VocationalTrainingPage() {
  return <VocationalTrainingPageClient />;
}
