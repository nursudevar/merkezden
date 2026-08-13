import type { Metadata } from "next";
import { getCategoryPageMetadata } from "@/lib/seo/categoryPageMetadata";
import SurucuKursuPageClient from "./SurucuKursuPageClient";

export const metadata: Metadata = getCategoryPageMetadata("Sürücü Kursu");

export default function SurucuKursuPage() {
  return <SurucuKursuPageClient />;
}
