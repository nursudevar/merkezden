"use client";

import { useEffect, useMemo, useState } from "react";
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
  emptyResultsMessage?: string;
  title?: string;
  favoriteIds?: Set<number>;
  favoriteInstructorIds?: Set<number>;
  favoritesEnabled?: boolean;
  favoriteActionLoadingIds?: Set<number>;
  favoriteInstructorActionLoadingIds?: Set<number>;
  isAuthenticated?: boolean;
  onToggleInstitutionFavorite?: (institutionId: number, e: React.MouseEvent) => void;
  onToggleInstructorFavorite?: (instructorId: number, e: React.MouseEvent) => void;
}

type ViewMode = "single" | "two";

const INITIAL_VISIBLE_COUNT = 20;
const LOAD_MORE_STEP = 10;

export default function CategoryResultsList({
  categoryName,
  subtitle,
  results = [],
  isLoading = false,
  errorMessage = null,
  emptyResultsMessage = "Bu kategoriye ait kurum veya eğitmen bulunmuyor.",
  title = "Listelenen Kurumlar",
  favoriteIds,
  favoriteInstructorIds,
  favoritesEnabled = false,
  favoriteActionLoadingIds,
  favoriteInstructorActionLoadingIds,
  isAuthenticated = false,
  onToggleInstitutionFavorite,
  onToggleInstructorFavorite,
}: CategoryResultsListProps) {
  void categoryName;
  void subtitle;

  const [viewMode, setViewMode] = useState<ViewMode>("two");
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_VISIBLE_COUNT);

  /** Arama/filtre değişiminde sıfırla; background hydrate aynı id setinde kalır. */
  const resultsIdentityKey = useMemo(
    () => results.map((result) => result.id).join(","),
    [results],
  );

  /** Sonuç listesi değiştiğinde (arama, filtre veya kategori değişimi) görünür sayıyı 20'ye sıfırla. */
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [resultsIdentityKey]);

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
            <h2 className="category-results-title">{title}</h2>
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
                <SelectValue placeholder="2'li Görünüm" />
              </SelectTrigger>
              <SelectContent className="select-content">
                <SelectItem value="two" className="select-item">2&apos;li Görünüm</SelectItem>
                <SelectItem value="single" className="select-item">Tekli Görünüm</SelectItem>
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
          <p className="category-results-empty">{emptyResultsMessage}</p>
        ) : (
          visibleResults.map((result) => {
            const isInstructor = result.resultType === "instructor";
            const targetId = isInstructor ? result.instructorId : result.institutionId;
            const canFavorite =
              typeof targetId === "number" && Number.isInteger(targetId) && targetId > 0;
            const isFavorite = canFavorite
              ? Boolean(
                  isInstructor ? favoriteInstructorIds?.has(targetId) : favoriteIds?.has(targetId),
                )
              : false;
            const isFavoriteActionLoading = canFavorite
              ? Boolean(
                  isInstructor
                    ? favoriteInstructorActionLoadingIds?.has(targetId)
                    : favoriteActionLoadingIds?.has(targetId),
                )
              : false;

            return (
              <CategoryResultsCard
                key={result.id}
                {...result}
                isFavorite={isFavorite}
                isFavoriteActionLoading={isFavoriteActionLoading}
                favoritesEnabled={favoritesEnabled}
                isAuthenticated={isAuthenticated}
                onToggleFavorite={
                  canFavorite
                    ? (e) => {
                        if (isInstructor) onToggleInstructorFavorite?.(targetId, e);
                        else onToggleInstitutionFavorite?.(targetId, e);
                      }
                    : undefined
                }
              />
            );
          })
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
