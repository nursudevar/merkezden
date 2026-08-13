import type { Metadata } from "next";
import { getCategoryPageMetadata } from "@/lib/seo/categoryPageMetadata";
import SchoolPageClient from "./SchoolPageClient";

export const metadata: Metadata = getCategoryPageMetadata("Okul");

export default function SchoolPage() {
  return <SchoolPageClient />;
}
