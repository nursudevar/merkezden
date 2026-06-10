"use client";

import { useEffect, useState } from "react";
import { GraduationCap, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { CategoryFilterResetButton } from "./CategoryFilterSidebar";
import CategoryResultsCard from "./CategoryResultsCard";
import type { CategoryResultItem } from "./useCategoryInstitutions";

interface CategoryResultsListProps {
  categoryName: string;
  /**
   * Bu sürümde kategori detay sayfalarında başlık altında açıklama
   * gösterilmiyor; prop API geriye uyum için korunuyor.
   */
  subtitle?: string;
  results?: CategoryResultItem[];
  isLoading?: boolean;
  errorMessage?: string | null;
}

type ViewMode = "recommended" | "two";

const INITIAL_VISIBLE_COUNT = 20;
const LOAD_MORE_STEP = 10;

export default function CategoryResultsList({
  categoryName,
  subtitle,
  results = [],
  isLoading = false,
  errorMessage = null,
}: CategoryResultsListProps) {
  void categoryName;
  void subtitle;

  const [viewMode, setViewMode] = useState<ViewMode>("recommended");
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_VISIBLE_COUNT);

  /** Sonuç listesi değiştiğinde (arama, filtre veya kategori değişimi) görünür sayıyı 20'ye sıfırla. */
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [results]);

  const cardsClassName =
    viewMode === "two"
      ? "category-results-cards category-results-cards--two"
      : "category-results-cards";

  const totalCount = results.length;
  const visibleResults = results.slice(0, visibleCount);
  const hasMore = totalCount > visibleResults.length;
  const nextStep = Math.min(LOAD_MORE_STEP, totalCount - visibleResults.length);

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, totalCount));
  };

  return (
    <div className="category-results-list">
      <div className="category-results-header">
        <div className="category-results-header-left">
          <div className="category-results-title-wrapper">
            <GraduationCap size={24} className="category-results-title-icon" />
            <h2 className="category-results-title">Listelenen Kurumlar</h2>
          </div>
        </div>
        <div className="category-results-header-actions">
          <CategoryFilterResetButton />
          <div className="category-results-sort">
            <span className="category-results-sort-label">Sırala:</span>
            <Select
              value={viewMode}
              onValueChange={(next) => setViewMode(next as ViewMode)}
            >
              <SelectTrigger className="category-results-sort-select">
                <SelectValue placeholder="Önerilenler" />
              </SelectTrigger>
              <SelectContent className="select-content">
                <SelectItem value="recommended" className="select-item">Önerilenler</SelectItem>
                <SelectItem value="two" className="select-item">2&apos;li Görünüm</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className={cardsClassName}>
        {isLoading ? (
          <p className="category-results-empty">Yükleniyor…</p>
        ) : errorMessage ? (
          <p className="category-results-empty">{errorMessage}</p>
        ) : totalCount === 0 ? (
          <p className="category-results-empty">Bu kategoriye ait kurum veya eğitmen bulunmuyor.</p>
        ) : (
          visibleResults.map((result) => <CategoryResultsCard key={result.id} {...result} />)
        )}
      </div>

      {!isLoading && !errorMessage && hasMore ? (
        <div className="category-results-load-more">
          <button
            type="button"
            className="category-results-load-more-btn"
            onClick={handleLoadMore}
            aria-label={`${nextStep} kurum daha göster`}
          >
            <span>Daha Fazla Görüntüle</span>
            <span className="category-results-load-more-count">+{nextStep}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
