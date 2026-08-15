"use client";

import { useCallback, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import CategoryFilterSidebar, {
  CategoryFilterPanelProvider,
  CategoryFilterConfig,
  SchoolCategoryFilterPanelProvider,
  InstructorCategoryFilterPanelProvider,
  type FilterState,
} from "./CategoryFilterSidebar";
import CategoryHero from "./CategoryHero";
import CategoryResultsList from "./CategoryResultsList";
import { HomeHeroSearchBanner } from "@/components/home/HomeHeroSearchBanner";
import type { CategoryResultItem } from "./useCategoryInstitutions";
import type { SchoolCategoryFilterPayload } from "./schoolCategoryFilterTypes";
import type { InstructorCategoryFilterPayload } from "./instructorCategoryFilterTypes";
import { useCategoryInstitutionMapMarkers } from "@/hooks/useCategoryInstitutionMapMarkers";
import { useListingFavorites } from "@/hooks/useListingFavorites";
import LoginModal from "@/components/LoginModal";
import { AppNoticeBar } from "@/components/AppNoticeBar";
import { NOT_INDIVIDUAL_FAVORITES_MESSAGE } from "@/lib/favorites/favoritesClient";

/**
 * Drawer (mobil/tablet filtre modalı) açıkken yeni gelen payload'da gerçek bir
 * "seçim" olup olmadığını anla. Range input'ları her tuş vuruşunda emit
 * edebileceği için yazma deneyimini bozmamak adına bilerek hariç tutuluyor.
 */
function hasMeaningfulSelectionChange(
  prev: SchoolCategoryFilterPayload | null,
  next: SchoolCategoryFilterPayload,
): boolean {
  if (prev == null) return false;
  if (prev.institutionTypeId !== next.institutionTypeId) return true;
  if (prev.highSchoolType !== next.highSchoolType) return true;
  if (JSON.stringify(prev.commonSingle) !== JSON.stringify(next.commonSingle)) return true;
  if (JSON.stringify(prev.commonMulti) !== JSON.stringify(next.commonMulti)) return true;
  if (JSON.stringify(prev.groupSelections) !== JSON.stringify(next.groupSelections)) return true;
  if (JSON.stringify(prev.studentAgeRange) !== JSON.stringify(next.studentAgeRange)) return true;
  return false;
}

interface CategoryPageLayoutProps {
  categoryName: string;
  subtitle?: string;
  filterConfig?: CategoryFilterConfig;
  results?: CategoryResultItem[];
  isLoading?: boolean;
  errorMessage?: string | null;
  emptyResultsMessage?: string;
  resultsTitle?: string;
  onFilterChange?: (filters: FilterState) => void;
  /**
   * Verildiğinde sidebar mock kategori filtreleri yerine ilgili kategoriye ait
   * gerçek feature_groups verilerini DB'den çekip render eder.
   */
  categorySlug?: string;
  /**
   * Okul/kategori sayfalarında hero arama çubuğu için ilçe listesi.
   */
  districts?: string[];
  /**
   * Yalnızca Okul sayfasında doldurulur: sol panel filtre state'i tek bir
   * Provider üzerinden paylaşılır ve seçimler `onSchoolFilterPayloadChange`
   * ile sayfaya bildirilir. Bu sayede masaüstü + drawer sidebar'ları aynı
   * filtre modelini kullanır ve mükerrer feature fetch'leri olmaz.
   */
  schoolModeProps?: {
    linkedSearch: string;
    onLinkedSearchChange: (value: string) => void;
    linkedDistrict: string;
    onLinkedDistrictChange: (value: string) => void;
    onSchoolFilterPayloadChange: (payload: SchoolCategoryFilterPayload) => void;
  };
  /**
   * Eğitmenler liste sayfası: sol panel filtre şeması instructor_feature_* tablolarından gelir.
   */
  instructorModeProps?: {
    onInstructorFilterPayloadChange: (payload: InstructorCategoryFilterPayload) => void;
  };
}

export default function CategoryPageLayout({
  categoryName,
  subtitle,
  filterConfig,
  results,
  isLoading,
  errorMessage,
  emptyResultsMessage,
  resultsTitle,
  onFilterChange,
  categorySlug,
  districts,
  schoolModeProps,
  instructorModeProps,
}: CategoryPageLayoutProps) {
  const { markers: categoryMapMarkers, loading: categoryMapLoading } =
    useCategoryInstitutionMapMarkers(results, isLoading);
  const {
    user,
    showLoginModal,
    setShowLoginModal,
    favoriteIds,
    favoriteInstructorIds,
    favoritesEnabled,
    favoritesError,
    setFavoritesError,
    favoriteActionLoadingIds,
    favoriteInstructorActionLoadingIds,
    handleFavoriteToggle,
    handleInstructorFavoriteToggle,
  } = useListingFavorites();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const isFilterOpenRef = useRef(false);
  isFilterOpenRef.current = isFilterOpen;

  const resultsScrollRef = useRef<HTMLDivElement>(null);
  const prevPayloadRef = useRef<SchoolCategoryFilterPayload | null>(null);

  /**
   * Parent'tan gelen callback'leri ref üzerinden okuyalım ki sarmalanmış
   * callback'lerin referansı her render'da değişmesin. Aksi halde Provider
   * içindeki effect dependency'leri her render'da yeni referans görür ve
   * sonsuz "Maximum update depth exceeded" döngüsüne girer.
   */
  const schoolModePropsRef = useRef(schoolModeProps);
  schoolModePropsRef.current = schoolModeProps;

  /**
   * Mobil/tablet drawer açıkken bir filtre seçimi yapıldığında çağrılır:
   * drawer'ı kapatır ve listenin başına yumuşak şekilde kaydırır. Drawer kapalı
   * iken (yani desktop akışında veya kullanıcı modalı açmadıysa) hiçbir şey
   * yapmaz; bu sayede ilk sayfa açılışında veya hero search ile yapılan
   * değişikliklerde otomatik scroll tetiklenmez.
   */
  const closeDrawerAndScrollToResults = useCallback(() => {
    if (!isFilterOpenRef.current) return;
    setIsFilterOpen(false);
    /** Drawer kapatma animasyonu için kısa bir gecikme verip ardından kaydır. */
    window.setTimeout(() => {
      const el = resultsScrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const top = Math.max(0, rect.top + window.scrollY - 72);
      window.scrollTo({ top, behavior: "smooth" });
    }, 220);
  }, []);

  /** Hero search input zaten parent state'ine yazıyor — burada sarmalamıyoruz; her tuş vuruşunda drawer kapanmasın. */
  const handleLinkedSearchChange = useCallback((value: string) => {
    schoolModePropsRef.current?.onLinkedSearchChange(value);
  }, []);

  /** İlçe dropdown seçimi → drawer kapat + scroll. */
  const handleLinkedDistrictChange = useCallback(
    (value: string) => {
      schoolModePropsRef.current?.onLinkedDistrictChange(value);
      closeDrawerAndScrollToResults();
    },
    [closeDrawerAndScrollToResults],
  );

  /** Subcategory/dropdown/checkbox seçimleri → drawer kapat + scroll (range hariç). */
  const handleSchoolFilterPayloadChange = useCallback(
    (payload: SchoolCategoryFilterPayload) => {
      schoolModePropsRef.current?.onSchoolFilterPayloadChange(payload);
      const prev = prevPayloadRef.current;
      prevPayloadRef.current = payload;
      if (hasMeaningfulSelectionChange(prev, payload)) {
        closeDrawerAndScrollToResults();
      }
    },
    [closeDrawerAndScrollToResults],
  );

  const layoutContent = (
    <div className="category-page-layout">
      <div className="category-page-layout-container">
        <aside className="category-page-layout-sidebar">
          <CategoryFilterSidebar
            config={filterConfig}
            categorySlug={categorySlug}
            mapMarkers={categorySlug ? categoryMapMarkers : undefined}
            mapLoading={categoryMapLoading}
          />
        </aside>

        <div className="category-page-layout-results">
          <HomeHeroSearchBanner />

          <button
            className="category-page-layout-filter-toggle"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            aria-label="Filtreleri göster/gizle"
          >
            <SlidersHorizontal size={18} />
            Filtreler
          </button>

          <div
            className={`category-page-layout-filter-drawer ${
              isFilterOpen ? "category-page-layout-filter-drawer--open" : ""
            }`}
          >
            <div
              className="category-page-layout-filter-drawer-overlay"
              onClick={() => setIsFilterOpen(false)}
            />
            <div className="category-page-layout-filter-drawer-content">
              <CategoryFilterSidebar
                config={filterConfig}
                categorySlug={categorySlug}
                mapMarkers={categorySlug ? categoryMapMarkers : undefined}
                mapLoading={categoryMapLoading}
              />
            </div>
          </div>

          <div ref={resultsScrollRef}>
            <CategoryResultsList
              categoryName={categoryName}
              subtitle={subtitle}
              title={resultsTitle}
              results={results}
              isLoading={isLoading}
              errorMessage={errorMessage}
              emptyResultsMessage={emptyResultsMessage}
              favoriteIds={favoriteIds}
              favoriteInstructorIds={favoriteInstructorIds}
              favoritesEnabled={favoritesEnabled}
              favoriteActionLoadingIds={favoriteActionLoadingIds}
              favoriteInstructorActionLoadingIds={favoriteInstructorActionLoadingIds}
              isAuthenticated={Boolean(user)}
              onToggleInstitutionFavorite={handleFavoriteToggle}
              onToggleInstructorFavorite={handleInstructorFavoriteToggle}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const heroSection =
    schoolModeProps && categorySlug ? (
      <CategoryHero
        searchValue={schoolModeProps.linkedSearch}
        onSearchChange={handleLinkedSearchChange}
        selectedDistrict={schoolModeProps.linkedDistrict}
        onDistrictChange={handleLinkedDistrictChange}
        districts={districts}
      />
    ) : null;

  const pageBody = (
    <>
      {heroSection}
      {layoutContent}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <AppNoticeBar
        message={favoritesError}
        onDismiss={() => setFavoritesError(null)}
        variant={favoritesError === NOT_INDIVIDUAL_FAVORITES_MESSAGE ? "warning" : "error"}
      />
    </>
  );

  if (schoolModeProps && categorySlug) {
    return (
      <div className="category-page">
        <SchoolCategoryFilterPanelProvider
          categorySlug={categorySlug}
          linkedSearch={schoolModeProps.linkedSearch}
          onLinkedSearchChange={handleLinkedSearchChange}
          linkedDistrict={schoolModeProps.linkedDistrict}
          onLinkedDistrictChange={handleLinkedDistrictChange}
          onSchoolFilterPayloadChange={handleSchoolFilterPayloadChange}
        >
          {pageBody}
        </SchoolCategoryFilterPanelProvider>
      </div>
    );
  }

  if (instructorModeProps && onFilterChange) {
    return (
      <div className="category-page">
        <InstructorCategoryFilterPanelProvider
          config={filterConfig}
          onFilterChange={onFilterChange}
          onInstructorFilterPayloadChange={instructorModeProps.onInstructorFilterPayloadChange}
        >
          {pageBody}
        </InstructorCategoryFilterPanelProvider>
      </div>
    );
  }

  if (onFilterChange) {
    return (
      <div className="category-page">
        <CategoryFilterPanelProvider config={filterConfig} onFilterChange={onFilterChange}>
          {pageBody}
        </CategoryFilterPanelProvider>
      </div>
    );
  }

  return <div className="category-page">{pageBody}</div>;
}
