"use client";

import { GraduationCap, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import CategoryResultsCard from "./CategoryResultsCard";

interface CategoryResultsListProps {
  categoryName: string;
  subtitle?: string;
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
    imageUrl?: string;
    slug?: string;
  }>;
}

export default function CategoryResultsList({ categoryName, subtitle, results = [] }: CategoryResultsListProps) {
  return (
    <div className="category-results-list">
      <div className="category-results-header">
        <div className="category-results-header-left">
          <div className="category-results-title-wrapper">
            <GraduationCap size={24} className="category-results-title-icon" />
            <h2 className="category-results-title">Eğitim Kurumları</h2>
          </div>
          <p className="category-results-subtitle">
            {subtitle || "İstanbul bölgesinde öne çıkan en iyi eğitim kurumlarını inceleyin."}
          </p>
        </div>
        <div className="category-results-sort">
          <span className="category-results-sort-label">Sırala:</span>
          <Select defaultValue="recommended">
            <SelectTrigger className="category-results-sort-select">
              <SelectValue placeholder="Önerilenler" />
            </SelectTrigger>
            <SelectContent className="select-content">
              <SelectItem value="recommended" className="select-item">Önerilenler</SelectItem>
              <SelectItem value="rating" className="select-item">En Yüksek Puan</SelectItem>
              <SelectItem value="price-low" className="select-item">Fiyat: Düşükten Yükseğe</SelectItem>
              <SelectItem value="price-high" className="select-item">Fiyat: Yüksekten Düşüğe</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="category-results-cards">
        {results.map((result) => (
          <CategoryResultsCard key={result.id} {...result} />
        ))}
      </div>
    </div>
  );
}

