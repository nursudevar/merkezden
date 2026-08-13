import type { Metadata } from "next";
import BlogPageClient from "./BlogPageClient";

export const metadata: Metadata = {
  title: "Eğitim ve Gelişim Blogu | Merkezden",
  description:
    "Eğitim, kurslar, özel ders, kişisel gelişim ve aile yaşamına dair güncel içerikleri keşfedin.",
};

export default function BlogPage() {
  return <BlogPageClient />;
}
