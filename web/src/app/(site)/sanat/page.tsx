import type { Metadata } from "next";
import { getCategoryPageMetadata } from "@/lib/seo/categoryPageMetadata";
import ArtsPageClient from "./ArtsPageClient";

export const metadata: Metadata = getCategoryPageMetadata("Sanat");

export default function ArtsPage() {
  return <ArtsPageClient />;
}
