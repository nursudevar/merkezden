"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { fetchInstitutionCategoryBySlug } from "@/lib/categoryHelpers";
import CategoryBreadcrumb from "./CategoryBreadcrumb";
import CategorySearchBar from "./CategorySearchBar";
import {
  EMPTY_CATEGORY_LOCATION_FILTER,
  type CategoryLocationFilterValue,
} from "./categoryLocationFilter";
import type { PublicBreadcrumbItem } from "@/lib/publicBreadcrumb";

interface CategoryHeroProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  categoryLabel?: string;
  location?: CategoryLocationFilterValue;
  extraBreadcrumbItems?: PublicBreadcrumbItem[];
}

const SHOW_CATEGORY_HERO_TITLE = false;
const SHOW_CATEGORY_HERO_SEARCH = false;

const categoryData: Record<string, { title: string }> = {
  okul: {
    title: "Okul",
  },
  "kurs-ve-sinava-hazirlik": {
    title: "Kurs & Sınava Hazırlık",
  },
  "surucu-kursu": {
    title: "Sürücü Kursu",
  },
  spor: {
    title: "Spor Eğitim Kurumları",
  },
  sanat: {
    title: "Sanat Eğitim Kurumları",
  },
  "yabanci-dil": {
    title: "Yabancı Dil Eğitim Kurumları",
  },
  "kisisel-gelisim": {
    title: "Kişisel Gelişim",
  },
  "mesleki-egitim": {
    title: "Mesleki Eğitim",
  },
  "ozel-egitim": {
    title: "Özel Eğitim",
  },
  "patili-dostlar": {
    title: "Patili Dostlar",
  },
};

function getCategoryData(pathname: string): { title: string } {
  const slug = pathname.split("/").pop() || "";

  if (categoryData[slug]) {
    return categoryData[slug];
  }

  const fallbackTitle = slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return {
    title: `${fallbackTitle} Eğitim Kurumları`,
  };
}

export default function CategoryHero({
  searchValue,
  onSearchChange,
  categoryLabel,
  location = EMPTY_CATEGORY_LOCATION_FILTER,
  extraBreadcrumbItems,
}: CategoryHeroProps) {
  const pathname = usePathname();
  const pathSegments = pathname.split("/").filter(Boolean);
  const routeSlug = pathSegments[pathSegments.length - 1] || "";
  const isDynamicCategoryRoute =
    pathSegments.length >= 2 && pathSegments[pathSegments.length - 2] === "kategori";
  const { title: staticTitle } = getCategoryData(pathname);
  const [dynamicTitle, setDynamicTitle] = useState<string | null>(null);
  const title = dynamicTitle ?? staticTitle;

  useEffect(() => {
    if (!isDynamicCategoryRoute || !routeSlug) {
      setDynamicTitle(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const category = await fetchInstitutionCategoryBySlug(routeSlug);
      if (cancelled) return;
      if (category?.name) {
        setDynamicTitle(`${category.name} Eğitim Kurumları`);
      } else {
        setDynamicTitle(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDynamicCategoryRoute, routeSlug]);

  return (
    <section className="category-hero">
      <div className="category-hero-container">
        <div className="category-hero-breadcrumb-wrapper">
          <CategoryBreadcrumb
            categoryLabel={categoryLabel}
            location={location}
            applyDefaultCity
            extraItems={extraBreadcrumbItems}
          />
        </div>
        {SHOW_CATEGORY_HERO_TITLE ? (
          <div className="category-hero-content">
            <div className="category-hero-heading">
              <div className="category-hero-badge">
                <GraduationCap size={20} />
              </div>
              <h1 className="category-hero-title">{title}</h1>
            </div>
          </div>
        ) : null}
        {SHOW_CATEGORY_HERO_SEARCH ? (
          <div className="category-hero-search-wrapper">
            <CategorySearchBar
              searchValue={searchValue}
              onSearchChange={onSearchChange}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
