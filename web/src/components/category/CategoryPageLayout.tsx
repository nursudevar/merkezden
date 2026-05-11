"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import CategoryFilterSidebar, {
  CategoryFilterConfig,
  SchoolCategoryFilterPanelProvider,
} from "./CategoryFilterSidebar";
import CategoryResultsList from "./CategoryResultsList";
import type { CategoryResultItem } from "./useCategoryInstitutions";
import type { SchoolCategoryFilterPayload } from "./schoolCategoryFilterTypes";

interface CategoryPageLayoutProps {
  categoryName: string;
  subtitle?: string;
  filterConfig?: CategoryFilterConfig;
  results?: CategoryResultItem[];
  isLoading?: boolean;
  errorMessage?: string | null;
  /**
   * Verildiğinde sidebar mock kategori filtreleri yerine ilgili kategoriye ait
   * gerçek feature_groups verilerini DB'den çekip render eder.
   */
  categorySlug?: string;
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
}

export default function CategoryPageLayout({
  categoryName,
  subtitle,
  filterConfig,
  results,
  isLoading,
  errorMessage,
  categorySlug,
  schoolModeProps,
}: CategoryPageLayoutProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const content = (
    <div className="category-page-layout">
      <div className="category-page-layout-container">
        <aside className="category-page-layout-sidebar">
          <CategoryFilterSidebar config={filterConfig} categorySlug={categorySlug} />
        </aside>

        <div className="category-page-layout-results">
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
              <CategoryFilterSidebar config={filterConfig} categorySlug={categorySlug} />
            </div>
          </div>

          <CategoryResultsList
            categoryName={categoryName}
            subtitle={subtitle}
            results={results}
            isLoading={isLoading}
            errorMessage={errorMessage}
          />
        </div>
      </div>
    </div>
  );

  if (schoolModeProps && categorySlug) {
    return (
      <SchoolCategoryFilterPanelProvider
        categorySlug={categorySlug}
        linkedSearch={schoolModeProps.linkedSearch}
        onLinkedSearchChange={schoolModeProps.onLinkedSearchChange}
        linkedDistrict={schoolModeProps.linkedDistrict}
        onLinkedDistrictChange={schoolModeProps.onLinkedDistrictChange}
        onSchoolFilterPayloadChange={schoolModeProps.onSchoolFilterPayloadChange}
      >
        {content}
      </SchoolCategoryFilterPanelProvider>
    );
  }

  return content;
}
