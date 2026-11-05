"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { HomeSectionLoadError } from "@/components/home/HomeSectionLoadError";
import {
  type HomeFeaturedAccountItem,
  invalidateHomeFeaturedAccountsShared,
  loadHomeFeaturedAccountsShared,
} from "./featuredInstitutions";
import { FeaturedInstitutionCardLink } from "./FeaturedInstitutionCardLink";
import { FeaturedInstructorCardLink } from "./FeaturedInstructorCardLink";

/** Desktop: 5 kart × 2 satır — sayfa başına. */
const FEATURED_PAGE_SIZE = 10;

type FeaturedTab = "institutions" | "instructors";

function getVisiblePageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 3) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const startPage = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
  return [startPage, startPage + 1, startPage + 2].filter((page) => page <= totalPages);
}

export function HomeFeaturedInstitutionsList({
  onToggleFavorite,
  onToggleInstructorFavorite,
  favoriteIds,
  favoriteInstructorIds,
  favoritesEnabled,
  favoriteActionLoadingIds,
  favoriteInstructorActionLoadingIds,
  isAuthenticated,
}: {
  onToggleFavorite: (institutionId: number, e: React.MouseEvent) => void;
  onToggleInstructorFavorite: (instructorId: number, e: React.MouseEvent) => void;
  favoriteIds: Set<number>;
  favoriteInstructorIds: Set<number>;
  favoritesEnabled: boolean;
  favoriteActionLoadingIds: Set<number>;
  favoriteInstructorActionLoadingIds: Set<number>;
  isAuthenticated: boolean;
}) {
  const [allFeaturedAccounts, setAllFeaturedAccounts] = useState<HomeFeaturedAccountItem[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredFailed, setFeaturedFailed] = useState(false);
  const [featuredRetryCount, setFeaturedRetryCount] = useState(0);
  const featuredRetryLockRef = useRef(false);
  const [activeTab, setActiveTab] = useState<FeaturedTab>("institutions");
  const [currentPage, setCurrentPage] = useState(1);
  const [brokenInstitutionImageIds, setBrokenInstitutionImageIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [brokenInstructorImageIds, setBrokenInstructorImageIds] = useState<Set<number>>(
    () => new Set(),
  );
  const featuredListRef = useRef<HTMLDivElement>(null);
  const tablistRef = useRef<HTMLDivElement>(null);

  const scrollToFeaturedList = useCallback(() => {
    const listElement = featuredListRef.current;
    if (!listElement) return;

    window.requestAnimationFrame(() => {
      const rect = listElement.getBoundingClientRect();
      const top = Math.max(0, rect.top + window.scrollY - 72);
      window.scrollTo({ top, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFeaturedLoading(true);

    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const featuredAccounts = await loadHomeFeaturedAccountsShared(supabase);
        if (cancelled) return;
        if (featuredAccounts.failed) {
          setAllFeaturedAccounts([]);
          setFeaturedFailed(true);
          return;
        }
        setAllFeaturedAccounts(featuredAccounts.items);
        setCurrentPage(1);
        setFeaturedFailed(false);
      } catch (error) {
        console.error("[home-featured] load error:", error);
        if (!cancelled) {
          setAllFeaturedAccounts([]);
          setFeaturedFailed(true);
        }
      } finally {
        featuredRetryLockRef.current = false;
        if (!cancelled) setFeaturedLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [featuredRetryCount]);

  const retryFeaturedAccounts = useCallback(() => {
    if (featuredRetryLockRef.current || featuredLoading) return;
    featuredRetryLockRef.current = true;
    invalidateHomeFeaturedAccountsShared();
    setFeaturedRetryCount((count) => count + 1);
  }, [featuredLoading]);

  const filteredAccounts = useMemo(() => {
    const kind = activeTab === "institutions" ? "institution" : "instructor";
    return allFeaturedAccounts.filter((entry) => entry.kind === kind);
  }, [activeTab, allFeaturedAccounts]);

  const totalItems = filteredAccounts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / FEATURED_PAGE_SIZE));
  const showPagination = totalItems > FEATURED_PAGE_SIZE;
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const handleTabChange = useCallback((nextTab: FeaturedTab) => {
    setActiveTab(nextTab);
    setCurrentPage(1);
  }, []);

  const handleFeaturedPageChange = useCallback(
    (nextPage: number) => {
      if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) return;
      setCurrentPage(nextPage);
      scrollToFeaturedList();
    },
    [currentPage, scrollToFeaturedList, totalPages],
  );

  const visiblePageNumbers = useMemo(
    () => (showPagination ? getVisiblePageNumbers(currentPage, totalPages) : []),
    [showPagination, currentPage, totalPages],
  );

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedFeaturedAccounts = useMemo(() => {
    const safePage = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1));
    const start = (safePage - 1) * FEATURED_PAGE_SIZE;
    return filteredAccounts.slice(start, start + FEATURED_PAGE_SIZE);
  }, [filteredAccounts, currentPage, totalPages]);

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, tab: FeaturedTab) => {
      const tabs: FeaturedTab[] = ["institutions", "instructors"];
      const currentIndex = tabs.indexOf(tab);
      let nextIndex = currentIndex;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        event.preventDefault();
        nextIndex = 0;
      } else if (event.key === "End") {
        event.preventDefault();
        nextIndex = tabs.length - 1;
      } else {
        return;
      }

      const nextTab = tabs[nextIndex];
      handleTabChange(nextTab);
      const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>("[role='tab']");
      buttons?.[nextIndex]?.focus();
    },
    [handleTabChange],
  );

  if (featuredFailed) {
    return (
      <section
        className="featured-institutions-list-section featured-institutions-section"
        aria-labelledby="home-featured-institutions-list-heading"
      >
        <div className="featured-institutions-header">
          <div className="featured-institutions-header-left">
            <h2 className="featured-institutions-title" id="home-featured-institutions-list-heading">
              Öne Çıkanlar
            </h2>
          </div>
        </div>
        <HomeSectionLoadError
          message="Öne çıkanlar yüklenemedi. Lütfen tekrar deneyin."
          loading={featuredLoading}
          onRetry={retryFeaturedAccounts}
        />
      </section>
    );
  }

  if (featuredLoading || allFeaturedAccounts.length === 0) return null;

  return (
    <section
      className="featured-institutions-list-section featured-institutions-section"
      aria-labelledby="home-featured-institutions-list-heading"
    >
      <div className="featured-institutions-header">
        <div className="featured-institutions-header-left">
          <h2 className="featured-institutions-title" id="home-featured-institutions-list-heading">
            Öne Çıkanlar
          </h2>
        </div>
      </div>

      <div
        className="home-featured-tabs"
        role="tablist"
        aria-label="Öne çıkan içerik türü"
        ref={tablistRef}
      >
        <button
          type="button"
          role="tab"
          id="home-featured-tab-institutions"
          className={`home-featured-tab${
            activeTab === "institutions" ? " home-featured-tab--active" : ""
          }`}
          aria-selected={activeTab === "institutions"}
          aria-controls="home-featured-panel-institutions"
          tabIndex={activeTab === "institutions" ? 0 : -1}
          onClick={() => handleTabChange("institutions")}
          onKeyDown={(event) => handleTabKeyDown(event, "institutions")}
        >
          Öne Çıkan Kurumlar
        </button>
        <button
          type="button"
          role="tab"
          id="home-featured-tab-instructors"
          className={`home-featured-tab${
            activeTab === "instructors" ? " home-featured-tab--active" : ""
          }`}
          aria-selected={activeTab === "instructors"}
          aria-controls="home-featured-panel-instructors"
          tabIndex={activeTab === "instructors" ? 0 : -1}
          onClick={() => handleTabChange("instructors")}
          onKeyDown={(event) => handleTabKeyDown(event, "instructors")}
        >
          Öne Çıkan Eğitmenler
        </button>
      </div>

      <div
        className="featured-institutions-body"
        role="tabpanel"
        id={
          activeTab === "institutions"
            ? "home-featured-panel-institutions"
            : "home-featured-panel-instructors"
        }
        aria-labelledby={
          activeTab === "institutions"
            ? "home-featured-tab-institutions"
            : "home-featured-tab-instructors"
        }
      >
        {paginatedFeaturedAccounts.length === 0 ? (
          <p className="home-featured-empty">
            {activeTab === "institutions"
              ? "Öne çıkan kurum bulunamadı."
              : "Öne çıkan eğitmen bulunamadı."}
          </p>
        ) : (
          <div ref={featuredListRef} id="home-featured-grid" className="featured-institutions-list">
            {paginatedFeaturedAccounts.map((entry) => {
              if (entry.kind === "institution") {
                const institution = entry.institution;
                const canRenderImage =
                  Boolean(institution.imageUrl) && !brokenInstitutionImageIds.has(institution.id);
                const isFavorite = favoriteIds.has(institution.id);
                const isActionLoading = favoriteActionLoadingIds.has(institution.id);

                return (
                  <FeaturedInstitutionCardLink
                    key={`institution-${institution.id}`}
                    institution={institution}
                    isFavorite={isFavorite}
                    isActionLoading={isActionLoading}
                    favoritesEnabled={favoritesEnabled}
                    isAuthenticated={isAuthenticated}
                    canRenderImage={canRenderImage}
                    onToggleFavorite={onToggleFavorite}
                    onImageError={() =>
                      setBrokenInstitutionImageIds((prev) => {
                        const next = new Set(prev);
                        next.add(institution.id);
                        return next;
                      })
                    }
                  />
                );
              }

              const instructor = entry.instructor;
              const canRenderImage =
                Boolean(instructor.imageUrl) && !brokenInstructorImageIds.has(instructor.id);
              const isFavorite = favoriteInstructorIds.has(instructor.id);
              const isActionLoading = favoriteInstructorActionLoadingIds.has(instructor.id);

              return (
                <FeaturedInstructorCardLink
                  key={`instructor-${instructor.id}`}
                  instructor={instructor}
                  isFavorite={isFavorite}
                  isActionLoading={isActionLoading}
                  favoritesEnabled={favoritesEnabled}
                  isAuthenticated={isAuthenticated}
                  canRenderImage={canRenderImage}
                  onToggleFavorite={onToggleInstructorFavorite}
                  onImageError={() =>
                    setBrokenInstructorImageIds((prev) => {
                      const next = new Set(prev);
                      next.add(instructor.id);
                      return next;
                    })
                  }
                />
              );
            })}
          </div>
        )}

        {showPagination ? (
          <nav className="featured-institutions-pagination" aria-label="Öne çıkanlar sayfalama">
            <div className="featured-institutions-pagination-info">
              Toplam <strong>{totalItems}</strong> öne çıkan hesap görüntüleniyor.
              <span className="featured-institutions-pagination-page-nums">
                Sayfa {currentPage} / {totalPages}
              </span>
            </div>
            <div className="featured-institutions-pagination-controls">
              <button
                type="button"
                className="featured-institutions-pagination-btn"
                onClick={() => handleFeaturedPageChange(currentPage - 1)}
                disabled={!hasPrev}
                aria-label="Önceki sayfa"
              >
                ‹
              </button>
              {visiblePageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={`featured-institutions-pagination-num${
                    pageNumber === currentPage ? " featured-institutions-pagination-num--active" : ""
                  }`}
                  onClick={() => handleFeaturedPageChange(pageNumber)}
                  aria-label={`Sayfa ${pageNumber}`}
                  aria-current={pageNumber === currentPage ? "page" : undefined}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                className="featured-institutions-pagination-btn"
                onClick={() => handleFeaturedPageChange(currentPage + 1)}
                disabled={!hasNext}
                aria-label="Sonraki sayfa"
              >
                ›
              </button>
            </div>
          </nav>
        ) : null}
      </div>
    </section>
  );
}
