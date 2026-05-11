"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import CategoryResultsCard from "./CategoryResultsCard";
import type { CategoryResultItem } from "./useCategoryInstitutions";

interface CategoryResultsListProps {
  categoryName: string;
  subtitle?: string;
  results?: CategoryResultItem[];
  isLoading?: boolean;
  errorMessage?: string | null;
}

type ViewMode = "recommended" | "two";

export default function CategoryResultsList({
  categoryName,
  subtitle,
  results = [],
  isLoading = false,
  errorMessage = null,
}: CategoryResultsListProps) {
  void categoryName;

  const [viewMode, setViewMode] = useState<ViewMode>("recommended");

  const cardsClassName =
    viewMode === "two"
      ? "category-results-cards category-results-cards--two"
      : "category-results-cards";

  return (
    <div className="category-results-list">
      <div className="category-results-header">
        <div className="category-results-header-left">
          <div className="category-results-title-wrapper">
            <GraduationCap size={24} className="category-results-title-icon" />
            <h2 className="category-results-title">Eğitim Kurumları</h2>
          </div>
          <p className="category-results-subtitle">
            {subtitle || "Ankara bölgesinde öne çıkan en iyi eğitim kurumlarını inceleyin."}
          </p>
        </div>
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

      <div className={cardsClassName}>
        {isLoading ? (
          <p className="category-results-empty">Yükleniyor…</p>
        ) : errorMessage ? (
          <p className="category-results-empty">{errorMessage}</p>
        ) : results.length === 0 ? (
          <p className="category-results-empty">Bu kategoriye ait kurum bulunmuyor.</p>
        ) : (
          results.map((result) => <CategoryResultsCard key={result.id} {...result} />)
        )}
      </div>
    </div>
  );
}
