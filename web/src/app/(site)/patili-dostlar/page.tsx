import type { Metadata } from "next";
import { getCategoryPageMetadata } from "@/lib/seo/categoryPageMetadata";
import PatiliDostlarPageClient from "./PatiliDostlarPageClient";

export const metadata: Metadata = getCategoryPageMetadata("Patili Dostlar");

export default function PatiliDostlarPage() {
  return <PatiliDostlarPageClient />;
}
