import type { Metadata } from "next";
import BlogPageClient from "./BlogPageClient";

export const metadata: Metadata = {
  title: "Merkezden Blog: Eğitim ve Rehber Yazıları | Merkezden",
  description:
    "Eğitim, okul ve kurs seçimi, sınav hazırlığı, yabancı dil ve kişisel gelişime dair rehber içerikleri Merkezden Blog'da keşfedin.",
};

export default function BlogPage() {
  return <BlogPageClient />;
}
