"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const categoryMap: Record<string, string> = {
  school: "OKUL",
  courses: "KURS & SINAVA HAZIRLIK",
  sports: "SPOR",
  arts: "SANAT",
  languages: "YABANCI DİL",
  "personal-development": "KİŞİSEL GELİŞİM",
  "vocational-training": "MESLEKİ EĞİTİM",
  "special-education": "ÖZEL EĞİTİM",
};

function getCategoryLabel(pathname: string): string {
  const slug = pathname.split("/").pop() || "";
  
  if (categoryMap[slug]) {
    return categoryMap[slug];
  }
  
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .toUpperCase();
}

export default function CategoryBreadcrumb() {
  const pathname = usePathname();
  const categoryLabel = getCategoryLabel(pathname);

  return (
    <nav className="category-breadcrumb" aria-label="Breadcrumb">
      <div className="category-breadcrumb-container">
        <Link href="/" className="category-breadcrumb-link">
          ANA SAYFA
        </Link>
        <span className="category-breadcrumb-separator"> &gt; </span>
        <span className="category-breadcrumb-current">{categoryLabel}</span>
      </div>
    </nav>
  );
}

