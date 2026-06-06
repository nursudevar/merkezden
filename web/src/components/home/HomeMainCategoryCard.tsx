"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";

export type HomeMainCategoryCardSubcategory = {
  id: number;
  name: string;
};

export type HomeMainCategoryCardData = {
  id: number;
  name: string;
  slug: string;
  subcategories: HomeMainCategoryCardSubcategory[];
};

const VISIBLE_SUBCATEGORY_COUNT = 2;

const SCHOOL_HOME_DISPLAY_ITEMS: HomeMainCategoryCardSubcategory[] = [
  { id: -1, name: "Anaokul / İlkokul" },
  { id: -2, name: "Ortaokul / Lise" },
];

const EXAM_PREP_HOME_DISPLAY_ITEMS: HomeMainCategoryCardSubcategory[] = [
  { id: -3, name: "YKS / KPSS / ALES" },
];

const SPORTS_HOME_DISPLAY_ITEMS: HomeMainCategoryCardSubcategory[] = [
  { id: -4, name: "Tenis / Basketbol" },
  { id: -5, name: "Yüzme / Futbol" },
];

const ARTS_HOME_DISPLAY_ITEMS: HomeMainCategoryCardSubcategory[] = [
  { id: -6, name: "Dans / Tiyatro" },
  { id: -7, name: "Seramik / Müzik" },
];

const VOCATIONAL_HOME_DISPLAY_ITEMS: HomeMainCategoryCardSubcategory[] = [
  { id: -8, name: "Pastacılık / Aşçılık" },
  { id: -9, name: "Yazılım / Muhasebe" },
];

const PERSONAL_DEV_HOME_DISPLAY_ITEMS: HomeMainCategoryCardSubcategory[] = [
  { id: -10, name: "Diksiyon / Yaşam Koçluğu" },
  { id: -11, name: "Zaman Yönetimi / Meditasyon" },
];

const LANGUAGE_HOME_DISPLAY_ITEMS: HomeMainCategoryCardSubcategory[] = [
  { id: -12, name: "İngilizce / Rusça" },
  { id: -13, name: "Almanca / Fransızca" },
];

const SPECIAL_ED_HOME_DISPLAY_ITEMS: HomeMainCategoryCardSubcategory[] = [
  { id: -14, name: "Oyun Terapisi / Disleksi Eğitimi" },
  { id: -15, name: "Duyu Bütünleme / ABA Terapisi" },
];

function normalizeMainCategoryKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSchoolMainCategory(category: HomeMainCategoryCardData): boolean {
  const name = category.name.trim().toLocaleLowerCase("tr-TR");
  const slug = category.slug.trim().toLocaleLowerCase("tr-TR");
  return name === "okul" || slug === "okul";
}

function isExamPrepMainCategory(category: HomeMainCategoryCardData): boolean {
  const key = normalizeMainCategoryKey(`${category.name} ${category.slug}`);
  return (
    key.includes("kurs") &&
    (key.includes("sinav") || key.includes("sinava") || key.includes("hazirlik"))
  );
}

function isSportsMainCategory(category: HomeMainCategoryCardData): boolean {
  const key = normalizeMainCategoryKey(`${category.name} ${category.slug}`);
  return key.includes("spor");
}

function isArtsMainCategory(category: HomeMainCategoryCardData): boolean {
  const key = normalizeMainCategoryKey(`${category.name} ${category.slug}`);
  return key.includes("sanat");
}

function isVocationalMainCategory(category: HomeMainCategoryCardData): boolean {
  const key = normalizeMainCategoryKey(`${category.name} ${category.slug}`);
  return key.includes("mesleki") && key.includes("egitim");
}

function isPersonalDevMainCategory(category: HomeMainCategoryCardData): boolean {
  const key = normalizeMainCategoryKey(`${category.name} ${category.slug}`);
  return key.includes("kisisel") && key.includes("gelisim");
}

function isLanguageMainCategory(category: HomeMainCategoryCardData): boolean {
  const key = normalizeMainCategoryKey(`${category.name} ${category.slug}`);
  return key.includes("yabanci") && key.includes("dil");
}

function isSpecialEdMainCategory(category: HomeMainCategoryCardData): boolean {
  const key = normalizeMainCategoryKey(`${category.name} ${category.slug}`);
  return key.includes("ozel") && key.includes("egitim");
}

type HomeMainCategoryCardProps = {
  category: HomeMainCategoryCardData;
  categoryHref: string | null;
  categoryLogoSrc: string | null;
  onCardClick: () => void;
};

export function HomeMainCategoryCard({
  category,
  categoryHref,
  categoryLogoSrc,
  onCardClick,
}: HomeMainCategoryCardProps) {
  const titleText = category.name.toLocaleUpperCase("tr-TR");

  const isSchoolCategory = isSchoolMainCategory(category);
  const isExamPrepCategory = isExamPrepMainCategory(category);
  const isSportsCategory = isSportsMainCategory(category);
  const isArtsCategory = isArtsMainCategory(category);
  const isVocationalCategory = isVocationalMainCategory(category);
  const isPersonalDevCategory = isPersonalDevMainCategory(category);
  const isLanguageCategory = isLanguageMainCategory(category);
  const isSpecialEdCategory = isSpecialEdMainCategory(category);

  const visibleSubcategories = useMemo(() => {
    if (isSchoolCategory) {
      return SCHOOL_HOME_DISPLAY_ITEMS;
    }
    if (isExamPrepCategory) {
      return EXAM_PREP_HOME_DISPLAY_ITEMS;
    }
    if (isSportsCategory) {
      return SPORTS_HOME_DISPLAY_ITEMS;
    }
    if (isArtsCategory) {
      return ARTS_HOME_DISPLAY_ITEMS;
    }
    if (isVocationalCategory) {
      return VOCATIONAL_HOME_DISPLAY_ITEMS;
    }
    if (isPersonalDevCategory) {
      return PERSONAL_DEV_HOME_DISPLAY_ITEMS;
    }
    if (isLanguageCategory) {
      return LANGUAGE_HOME_DISPLAY_ITEMS;
    }
    if (isSpecialEdCategory) {
      return SPECIAL_ED_HOME_DISPLAY_ITEMS;
    }
    return [...category.subcategories]
      .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name, "tr"))
      .slice(0, VISIBLE_SUBCATEGORY_COUNT);
  }, [
    category.subcategories,
    isArtsCategory,
    isExamPrepCategory,
    isLanguageCategory,
    isPersonalDevCategory,
    isSchoolCategory,
    isSpecialEdCategory,
    isSportsCategory,
    isVocationalCategory,
  ]);

  const showMoreLink = Boolean(categoryHref) && (
    isExamPrepCategory
      ? category.subcategories.length > EXAM_PREP_HOME_DISPLAY_ITEMS.length
      : category.subcategories.length > VISIBLE_SUBCATEGORY_COUNT
  );

  return (
    <article
      className={`home-main-category-card ${categoryHref ? "home-main-category-card--clickable" : ""}`}
      onClick={onCardClick}
    >
      {categoryLogoSrc ? (
        <span className="home-main-category-card-icon" aria-hidden>
          <Image
            src={categoryLogoSrc}
            alt=""
            width={88}
            height={40}
            className="home-main-category-card-logo"
          />
        </span>
      ) : null}
      <h3 className="home-main-category-card-title">{titleText}</h3>
      {visibleSubcategories.length > 0 ? (
        <div
          className={`home-main-category-card-list-wrap${
            visibleSubcategories.length === 1 ? " home-main-category-card-list-wrap--single" : ""
          }`}
        >
          <ul className="home-main-category-card-list">
            {visibleSubcategories.map((subcategory) => (
              <li key={`${category.id}-${subcategory.id}`} className="home-main-category-card-item">
                <span>{subcategory.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {showMoreLink ? (
        <Link
          href={categoryHref!}
          className="home-main-category-card-more-btn"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          Daha Fazla Gör
        </Link>
      ) : null}
    </article>
  );
}
