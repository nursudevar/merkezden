import type { Metadata } from "next";
import { getCategoryPageMetadata } from "@/lib/seo/categoryPageMetadata";
import CoursesPageClient from "./CoursesPageClient";

export const metadata: Metadata = getCategoryPageMetadata("Kurs & Sınava Hazırlık");

export default function CoursesPage() {
  return <CoursesPageClient />;
}
