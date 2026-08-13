import type { Metadata } from "next";
import { getCategoryPageMetadata } from "@/lib/seo/categoryPageMetadata";
import SportsPageClient from "./SportsPageClient";

export const metadata: Metadata = getCategoryPageMetadata("Spor");

export default function SportsPage() {
  return <SportsPageClient />;
}
