"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";
import { normalizeCategoryKey } from "@/lib/categoryHelpers";
import {
  buildPublicInstructorLocation,
  fetchFeaturedPublicInstructors,
  getPublicInstructorDetailHref,
  mapPublicInstructorDisplayName,
} from "@/lib/publicInstructorSearch";
import CategoryBreadcrumb from "./CategoryBreadcrumb";
import CategorySearchBar from "./CategorySearchBar";

interface CategoryHeroProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  selectedDistrict?: string;
  onDistrictChange?: (value: string) => void;
  districts?: string[];
}

type CategoryHeroPopularItem = {
  key: string;
  href: string;
  name: string;
  meta: string;
};

const SHOW_CATEGORY_HERO_TITLE = false;
const SHOW_CATEGORY_HERO_SEARCH = false;

const categoryData: Record<string, { title: string }> = {
  school: {
    title: "Okul",
  },
  courses: {
    title: "Kurs & Sınava Hazırlık",
  },
  sports: {
    title: "Spor Eğitim Kurumları",
  },
  arts: {
    title: "Sanat Eğitim Kurumları",
  },
  languages: {
    title: "Yabancı Dil Eğitim Kurumları",
  },
  "personal-development": {
    title: "Kişisel Gelişim",
  },
  "vocational-training": {
    title: "Mesleki Eğitim",
  },
  "special-education": {
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

const CATEGORY_ROUTE_SLUG_FALLBACKS: Record<string, string> = {
  school: "okul",
  courses: "courses",
  sports: "sports",
  arts: "arts",
  languages: "languages",
  "personal-development": "personal-development",
  "vocational-training": "vocational-training",
  "special-education": "special-education",
};

function hasSupabaseResponseError(error: unknown): boolean {
  if (error == null) return false;
  if (typeof error !== "object") return true;
  const row = error as { message?: string; code?: string };
  if (row.message || row.code) return true;
  return Object.keys(error as object).length > 0;
}

function describeSupabaseError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const row = error as { message?: string; code?: string; details?: string };
  return [row.message, row.code, row.details].filter(Boolean).join(" | ") || JSON.stringify(error);
}

function isMissingActiveColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const row = error as { message?: string; details?: string };
  const text = `${String(row.message ?? "")} ${String(row.details ?? "")}`.toLocaleLowerCase("tr-TR");
  return text.includes("is_active") && text.includes("column");
}

function shuffleRows<T>(rows: T[]): T[] {
  const next = [...rows];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildCategoryMatchPredicate(routeSlug: string, title: string) {
  const normalizedTitle = normalizeCategoryKey(title);
  const normalizedRoute = normalizeCategoryKey(routeSlug);

  return (row: { slug?: string | null; name?: string | null }) => {
    const key = normalizeCategoryKey(`${row.name ?? ""} ${row.slug ?? ""}`);
    if (!key) return false;
    if (normalizedTitle && key.includes(normalizedTitle)) return true;

    if (normalizedRoute === "school") return key.includes("okul");
    if (normalizedRoute === "courses") {
      return key.includes("kurs") && (key.includes("sinav") || key.includes("hazirlik"));
    }
    if (normalizedRoute === "sports") return key.includes("spor");
    if (normalizedRoute === "arts") return key.includes("sanat");
    if (normalizedRoute === "languages") return key.includes("yabanci dil") || /\bdil\b/.test(key);
    if (normalizedRoute === "personal development") return key.includes("kisisel gelisim");
    if (normalizedRoute === "vocational training") return key.includes("mesleki egitim");
    if (normalizedRoute === "special education") return key.includes("ozel egitim");

    return key.includes(normalizedRoute);
  };
}

async function resolveCategorySlugForRoute(
  routeSlug: string,
  title: string,
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<string> {
  const fallback = CATEGORY_ROUTE_SLUG_FALLBACKS[routeSlug] ?? routeSlug;

  const { data, error } = await supabase
    .from("institution_categories")
    .select("slug, name")
    .eq("is_active", true);

  if (error || !Array.isArray(data) || data.length === 0) {
    return fallback;
  }

  const rows = data as Array<{ slug?: string | null; name?: string | null }>;
  const exactName = rows.find((row) => String(row.name ?? "").trim() === title.trim());
  const matched = exactName ?? rows.find(buildCategoryMatchPredicate(routeSlug, title));
  const resolved = String(matched?.slug ?? "").trim();
  return resolved || fallback;
}

async function fetchCategoryPopularItems(
  routeSlug: string,
  title: string,
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<CategoryHeroPopularItem[]> {
  const categorySlug = await resolveCategorySlugForRoute(routeSlug, title, supabase);

  const { data: categoryDataRows, error: categoryError } = await supabase
    .from("institution_categories")
    .select("id, slug")
    .eq("slug", categorySlug)
    .limit(1);

  if (categoryError || !Array.isArray(categoryDataRows) || categoryDataRows.length === 0) {
    if (categoryError) {
      console.warn("[category-hero] category resolve:", describeSupabaseError(categoryError));
    }
    return [];
  }

  const categoryId = Number((categoryDataRows[0] as { id?: number | null }).id);
  if (!Number.isFinite(categoryId) || categoryId <= 0) return [];

  const { data: typeRows, error: typeError } = await supabase
    .from("institution_types")
    .select("id")
    .eq("is_active", true)
    .eq("category_id", categoryId);

  if (typeError || !Array.isArray(typeRows) || typeRows.length === 0) {
    if (typeError) {
      console.warn("[category-hero] type resolve:", describeSupabaseError(typeError));
    }
    return [];
  }

  const typeIds = typeRows
    .map((row) => Number((row as { id?: number | null }).id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (typeIds.length === 0) return [];

  const queryInstitutions = async (filterActive: boolean) => {
    let query = supabase
      .from("institutions")
      .select("id, slug, source, institution_name, city, district, institution_type_id")
      .in("institution_type_id", typeIds)
      .limit(120);

    if (filterActive) {
      query = query.eq("is_active", true);
    }

    return query;
  };

  let { data: institutionRows, error: institutionsError } = await queryInstitutions(true);
  if (hasSupabaseResponseError(institutionsError) && isMissingActiveColumnError(institutionsError)) {
    const fallback = await queryInstitutions(false);
    institutionRows = fallback.data;
    institutionsError = fallback.error;
  }

  if (institutionsError || !Array.isArray(institutionRows)) {
    if (institutionsError) {
      console.warn("[category-hero] institutions:", describeSupabaseError(institutionsError));
    }
    return [];
  }

  const institutionItems = shuffleRows(institutionRows as Array<Record<string, unknown>>)
    .map((row) => {
      const id = Number(row.id);
      const name = String(row.institution_name ?? "").trim();
      const slug = String(row.slug ?? "").trim();
      if (!Number.isFinite(id) || id <= 0 || !name || !slug) return null;

      const district = String(row.district ?? "").trim();
      const city = String(row.city ?? "").trim();
      const meta = [district, city].filter(Boolean).join(" / ");

      return {
        key: `institution-${id}`,
        href: getInstitutionDetailHref({
          id,
          slug,
          source: String(row.source ?? "").trim() || null,
        }),
        name,
        meta,
      };
    })
    .filter((item): item is CategoryHeroPopularItem => item !== null);

  let instructorItems: CategoryHeroPopularItem[] = [];
  try {
    const instructorRows = await fetchFeaturedPublicInstructors(supabase, {
      categoryId,
      limit: 10,
    });
    instructorItems = instructorRows
      .map((row) => {
        const id = Number(row.id);
        if (!Number.isFinite(id) || id <= 0) return null;
        const name = mapPublicInstructorDisplayName(row);
        if (!name) return null;

        const branch = String(row.branch ?? "").trim();
        const titleLabel = String(row.title ?? "").trim();
        const location = buildPublicInstructorLocation(row);
        const priceRange = String(row.price_range ?? "").trim();
        const meta = [branch || titleLabel, location, priceRange].filter(Boolean).join(" · ");

        return {
          key: `instructor-${id}`,
          href: getPublicInstructorDetailHref(row.slug, id),
          name,
          meta,
        };
      })
      .filter((item): item is CategoryHeroPopularItem => item !== null);
  } catch (error) {
    console.warn("[category-hero] instructors:", describeSupabaseError(error));
  }

  return shuffleRows([...institutionItems, ...instructorItems]).slice(0, 10);
}

export default function CategoryHero({
  searchValue,
  onSearchChange,
  selectedDistrict,
  onDistrictChange,
  districts,
}: CategoryHeroProps) {
  const pathname = usePathname();
  const routeSlug = pathname.split("/").filter(Boolean).pop() || "";
  const { title } = getCategoryData(pathname);
  const [popularItems, setPopularItems] = useState<CategoryHeroPopularItem[]>([]);
  const [popularItemsLoading, setPopularItemsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setPopularItemsLoading(true);
      const supabase = createSupabaseBrowserClient();
      const items = await fetchCategoryPopularItems(routeSlug, title, supabase);
      if (cancelled) return;
      setPopularItems(items);
      setPopularItemsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [routeSlug, title]);

  return (
    <section className="category-hero">
      <div className="category-hero-container">
        <div className="category-hero-breadcrumb-wrapper">
          <CategoryBreadcrumb />
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
              selectedDistrict={selectedDistrict}
              onDistrictChange={onDistrictChange}
              districts={districts}
            />
          </div>
        ) : null}
        <div className="category-hero-popular">
          <div className="category-hero-popular-header">
            <h2 className="category-hero-popular-title">Popüler Kurumlar</h2>
          </div>
          {popularItemsLoading ? (
            <p className="category-hero-popular-empty">Yükleniyor...</p>
          ) : popularItems.length === 0 ? (
            <p className="category-hero-popular-empty">Henüz öne çıkan içerik bulunmuyor.</p>
          ) : (
            <div className="category-hero-popular-scroller">
              {popularItems.map((item) => (
                <Link key={item.key} href={item.href} className="category-hero-popular-card">
                  <span className="category-hero-popular-badge">Popüler</span>
                  <div className="category-hero-popular-card-body">
                    <div className="category-hero-popular-card-title-wrap">
                      <p className="category-hero-popular-card-name" data-tooltip-text={item.name}>
                        {item.name}
                      </p>
                    </div>
                    {item.meta ? (
                      <p className="category-hero-popular-card-meta">{item.meta}</p>
                    ) : null}
                    <span className="category-hero-popular-card-button">İncele</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
