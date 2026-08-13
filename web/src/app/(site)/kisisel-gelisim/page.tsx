import type { Metadata } from "next";
import { getCategoryPageMetadata } from "@/lib/seo/categoryPageMetadata";
import PersonalDevelopmentPageClient from "./PersonalDevelopmentPageClient";

export const metadata: Metadata = getCategoryPageMetadata("Kişisel Gelişim");

export default function PersonalDevelopmentPage() {
  return <PersonalDevelopmentPageClient />;
}
