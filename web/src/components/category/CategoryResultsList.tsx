"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraduationCap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectMountGate } from "@/components/ui";
import { CategoryFilterResetButton } from "./CategoryFilterSidebar";
import CategoryResultsCard from "./CategoryResultsCard";
import { CATEGORY_RESULTS_PAGE_SIZE } from "./useCategoryInstitutions";
import type { CategoryResultItem } from "./useCategoryInstitutions";

function getCategoryResultsVisiblePageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 3) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const startPage = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
  return [startPage, startPage + 1, startPage + 2].filter((page) => page <= totalPages);
}

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
  const [currentPage, setCurrentPage] = useState(1);
  const [goToPageInput, setGoToPageInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  /** Arama/filtre değişiminde sıfırla; background hydrate aynı id setinde kalır. */
  const resultsIdentityKey = useMemo(
    () => results.map((result) => result.id).join(","),
    [results],
  );

  /** Sonuç listesi değiştiğinde (arama, filtre veya kategori değişimi) sayfayı 1'e sıfırla. */
  useEffect(() => {
    setCurrentPage(1);
  }, [resultsIdentityKey]);

  /** Pagination butonları / filtre reset / clamp sonrası input currentPage ile senkron kalsın. */
  useEffect(() => {
    setGoToPageInput(String(currentPage));
  }, [currentPage]);

  const scrollToList = useCallback(() => {
    const listElement = listRef.current;
    if (!listElement) return;

    window.requestAnimationFrame(() => {
      const rect = listElement.getBoundingClientRect();
      const top = Math.max(0, rect.top + window.scrollY - 72);
      window.scrollTo({ top, behavior: "smooth" });
    });
  }, []);

  const cardsClassName =
    viewMode === "two"
      ? "category-results-cards category-results-cards--two"
      : "category-results-cards";

  const totalCount = results.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / CATEGORY_RESULTS_PAGE_SIZE));
  const showPagination = totalCount > CATEGORY_RESULTS_PAGE_SIZE;
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) return;
      setCurrentPage(nextPage);
      scrollToList();
    },
    [currentPage, scrollToList, totalPages],
  );

  const visiblePageNumbers = useMemo(
    () => (showPagination ? getCategoryResultsVisiblePageNumbers(currentPage, totalPages) : []),
    [showPagination, currentPage, totalPages],
  );

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1));

  const visibleResults = useMemo(() => {
    const start = (safeCurrentPage - 1) * CATEGORY_RESULTS_PAGE_SIZE;
    return results.slice(start, start + CATEGORY_RESULTS_PAGE_SIZE);
  }, [results, safeCurrentPage]);

  const visibleRangeStart = (safeCurrentPage - 1) * CATEGORY_RESULTS_PAGE_SIZE + 1;
  const visibleRangeEnd = Math.min(safeCurrentPage * CATEGORY_RESULTS_PAGE_SIZE, totalCount);
  const paginationEntityLabel = title.toLowerCase().includes("eğitmen") ? "eğitmen" : "kurum";
  const paginationEntityLabelPlural = paginationEntityLabel === "eğitmen" ? "eğitmenler" : "kurumlar";
  const showVisibleRange = !isLoading && !errorMessage && showPagination;

  const commitGoToPage = useCallback(() => {
    const raw = goToPageInput.trim();
    if (!raw) return;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setGoToPageInput("");
      return;
    }
    const nextPage = Math.min(parsed, totalPages);
    handlePageChange(nextPage);
    setGoToPageInput(String(nextPage));
  }, [goToPageInput, handlePageChange, totalPages]);

  const handleGoToPageInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    if (nextValue === "") {
      setGoToPageInput("");
      return;
    }
    if (/^\d+$/.test(nextValue)) {
      setGoToPageInput(nextValue);
    }
  }, []);

  const sortLabel = viewMode === "two" ? "2'li Görünüm" : "Tekli Görünüm";

  return (
    <div className="category-results-list">
      <div className="category-results-header">
        <div className="category-results-header-left">
          <div className="category-results-title-wrapper">
            <GraduationCap size={24} className="category-results-title-icon" />
            <h2 className="category-results-title">{title}</h2>
            {showVisibleRange ? (
              <span className="category-results-visible-range">
                {visibleRangeStart}–{visibleRangeEnd}. {paginationEntityLabelPlural} gösteriliyor.
              </span>
            ) : null}
          </div>
        </div>
        <div className="category-results-header-actions">
          <CategoryFilterResetButton />
          <div className="category-results-sort">
            <span className="category-results-sort-label">Sırala:</span>
            <SelectMountGate
              label={sortLabel}
              className="select-trigger-default category-results-sort-select"
            >
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
            </SelectMountGate>
          </div>
        </div>
      </div>

      <div ref={listRef} className={cardsClassName}>
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

      {!isLoading && !errorMessage && showPagination ? (
        <nav className="category-results-pagination" aria-label="Kategori sonuçları sayfalama">
          <div className="category-results-pagination-info">
            Toplam <strong>{totalCount}</strong> sonuç görüntüleniyor.
            <span className="category-results-pagination-page-nums">
              Sayfa {currentPage} / {totalPages}
            </span>
          </div>
          <div className="category-results-pagination-controls">
            <button
              type="button"
              className="category-results-pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!hasPrev}
              aria-label="Önceki sayfa"
            >
              ‹
            </button>
            {visiblePageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={`category-results-pagination-num${
                  pageNumber === currentPage ? " category-results-pagination-num--active" : ""
                }`}
                onClick={() => handlePageChange(pageNumber)}
                aria-label={`Sayfa ${pageNumber}`}
                aria-current={pageNumber === currentPage ? "page" : undefined}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              className="category-results-pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!hasNext}
              aria-label="Sonraki sayfa"
            >
              ›
            </button>
            <div className="category-results-pagination-goto">
              <label htmlFor="category-results-goto-page-input">Sayfaya git:</label>
              <input
                id="category-results-goto-page-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={totalPages}
                className="category-results-pagination-goto-input"
                value={goToPageInput}
                onChange={handleGoToPageInputChange}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitGoToPage();
                  }
                }}
                onBlur={commitGoToPage}
                aria-label={`Sayfaya git, 1 ile ${totalPages} arasında`}
              />
              <button
                type="button"
                className="category-results-pagination-goto-btn"
                onClick={commitGoToPage}
              >
                Git
              </button>
            </div>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
