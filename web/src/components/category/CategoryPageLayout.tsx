"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import CategoryFilterSidebar, { CategoryFilterConfig } from "./CategoryFilterSidebar";
import CategoryResultsList from "./CategoryResultsList";

interface CategoryPageLayoutProps {
  categoryName: string;
  subtitle?: string;
  filterConfig?: CategoryFilterConfig;
  results?: Array<{
    id: string;
    name: string;
    description: string;
    location: string;
    price: string | number;
    ageRange: string;
    rating: number;
    reviewCount: number;
    badges: string[];
    logoInitial?: string;
    logoColor?: string;
  }>;
}

export default function CategoryPageLayout({
  categoryName,
  subtitle,
  filterConfig,
  results,
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

          <CategoryResultsList categoryName={categoryName} subtitle={subtitle} results={results} />
        </div>
      </div>
    </div>
  );
}

