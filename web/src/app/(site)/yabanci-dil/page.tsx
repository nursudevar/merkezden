import type { Metadata } from "next";
import { getCategoryPageMetadata } from "@/lib/seo/categoryPageMetadata";
import LanguagesPageClient from "./LanguagesPageClient";

export const metadata: Metadata = getCategoryPageMetadata("Yabancı Dil");

export default function LanguagesPage() {
  return <LanguagesPageClient />;
}
