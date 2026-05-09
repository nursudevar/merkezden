"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import CategoryFilterSidebar, { CategoryFilterConfig } from "./CategoryFilterSidebar";
import CategoryResultsList from "./CategoryResultsList";
import type { CategoryResultItem } from "./useCategoryInstitutions";

interface CategoryPageLayoutProps {
  categoryName: string;
  subtitle?: string;
  filterConfig?: CategoryFilterConfig;
  results?: CategoryResultItem[];
  isLoading?: boolean;
  errorMessage?: string | null;
}

export default function CategoryPageLayout({
  categoryName,
  subtitle,
  filterConfig,
  results,
  isLoading,
  errorMessage,
}: CategoryPageLayoutProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <div className="category-page-layout">
      <div className="category-page-layout-container">
        <aside className="category-page-layout-sidebar">
          <CategoryFilterSidebar config={filterConfig} />
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

          <div className={`category-page-layout-filter-drawer ${isFilterOpen ? 'category-page-layout-filter-drawer--open' : ''}`}>
            <div className="category-page-layout-filter-drawer-overlay" onClick={() => setIsFilterOpen(false)} />
            <div className="category-page-layout-filter-drawer-content">
              <CategoryFilterSidebar config={filterConfig} />
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
}
