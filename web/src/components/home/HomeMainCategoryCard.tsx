"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

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

type HomeMainCategoryCardProps = {
  category: HomeMainCategoryCardData;
  categoryHref: string | null;
  categoryLogoSrc: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCardClick: () => void;
};

function checkTitleWrapped(titleEl: HTMLHeadingElement): boolean {
  const styles = window.getComputedStyle(titleEl);
  let lineHeight = parseFloat(styles.lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
    const fontSize = parseFloat(styles.fontSize);
    lineHeight = Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.25 : 1;
  }
  const lines = Math.round(titleEl.scrollHeight / lineHeight);
  return lines > 1;
}

export function HomeMainCategoryCard({
  category,
  categoryHref,
  categoryLogoSrc,
  isExpanded,
  onToggleExpand,
  onCardClick,
}: HomeMainCategoryCardProps) {
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [isTitleWrapped, setIsTitleWrapped] = useState(false);

  const titleText = category.name.toLocaleUpperCase("tr-TR");

  const sortedSubcategories = useMemo(
    () =>
      [...category.subcategories].sort(
        (a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name, "tr"),
      ),
    [category.subcategories],
  );

  const collapsedVisibleCount = isTitleWrapped ? 1 : 2;
  const visibleSubcategories = isExpanded
    ? sortedSubcategories
    : sortedSubcategories.slice(0, collapsedVisibleCount);
  const hasMoreThanVisibleCount = sortedSubcategories.length > collapsedVisibleCount;

  useEffect(() => {
    const checkTitleWrap = () => {
      const el = titleRef.current;
      if (!el) return;
      setIsTitleWrapped(checkTitleWrapped(el));
    };

    checkTitleWrap();
    const rafId = window.requestAnimationFrame(checkTitleWrap);

    window.addEventListener("resize", checkTitleWrap);

    const el = titleRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(checkTitleWrap);
      resizeObserver.observe(el);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", checkTitleWrap);
      resizeObserver?.disconnect();
    };
  }, [titleText]);

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
      <h3 ref={titleRef} className="home-main-category-card-title">
        {titleText}
      </h3>
      {category.subcategories.length > 0 ? (
        <div
          className={`home-main-category-card-list-wrap ${isExpanded ? "is-expanded" : ""} ${
            !isExpanded && isTitleWrapped ? "is-single-item" : ""
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
      {hasMoreThanVisibleCount ? (
        <button
          type="button"
          className="home-main-category-card-more-btn"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleExpand();
          }}
        >
          {isExpanded ? "Daha Az Göster" : "Daha Fazla Gör"}
        </button>
      ) : null}
    </article>
  );
}
