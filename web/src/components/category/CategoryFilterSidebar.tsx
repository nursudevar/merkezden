"use client";

import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { Button } from "@/components/ui";

export interface CategoryFilterConfig {
  categories?: Array<{ label: string; count: number; value: string }>;
}

interface CategoryFilterSidebarProps {
  config?: CategoryFilterConfig;
  onFilterChange?: (filters: FilterState) => void;
}

interface FilterState {
  search: string;
  city: string;
  district: string;
  category: string;
  priceRange: [number, number];
}

const defaultCategories = [
  { label: "Anaokulu / Kreş", count: 12, value: "anaokulu" },
  { label: "İlkokul", count: 8, value: "ilkokul" },
  { label: "Ortaokul", count: 5, value: "ortaokul" },
  { label: "Lise", count: 9, value: "lise" },
];

export default function CategoryFilterSidebar({ config, onFilterChange }: CategoryFilterSidebarProps) {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 50000]);

  const categories = config?.categories || defaultCategories;

  const handleFilterChange = (updates: Partial<FilterState>) => {
    const newFilters = {
      search,
      city,
      district,
      category: selectedCategory,
      priceRange,
      ...updates,
    };
    
    if (updates.search !== undefined) setSearch(updates.search);
    if (updates.city !== undefined) setCity(updates.city);
    if (updates.district !== undefined) setDistrict(updates.district);
    if (updates.category !== undefined) setSelectedCategory(updates.category);
    if (updates.priceRange !== undefined) setPriceRange(updates.priceRange);
    
    onFilterChange?.(newFilters);
  };

  const handlePriceInput = (index: 0 | 1, value: string) => {
    if (value === "") {
      const newRange: [number, number] = [...priceRange];
      newRange[index] = index === 0 ? 0 : 50000;
      handleFilterChange({ priceRange: newRange });
      return;
    }
    
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) return;
    
    const newRange: [number, number] = [...priceRange];
    newRange[index] = numValue;
    
    if (index === 0 && newRange[0] > newRange[1]) {
      newRange[1] = newRange[0];
    } else if (index === 1 && newRange[1] < newRange[0]) {
      newRange[0] = newRange[1];
    }
    
    handleFilterChange({ priceRange: newRange });
  };

  return (
    <aside className="category-filter-sidebar">
      <div className="category-filter-sidebar-card">
        <div className="category-filter-sidebar-header">
          <div className="category-filter-sidebar-header-content">
            <Image 
              src="/images/filter.svg" 
              alt="Filtreleme" 
              width={20} 
              height={20}
              className="category-filter-sidebar-header-icon"
            />
            <h2 className="category-filter-sidebar-header-title">Filtreleme</h2>
          </div>
        </div>

        <div className="category-filter-sidebar-content">
          <Button
            variant="outline"
            className="category-filter-map-button"
            onClick={() => {}}
          >
            <MapPin size={18} />
            Haritada Göster
          </Button>

          <div className="category-filter-section">
            <h3 className="category-filter-section-title">ARAMA</h3>
            <div className="category-filter-section-inputs">
              <div className="category-filter-search-wrapper">
                <Search size={18} className="category-filter-search-icon" />
                <Input
                  type="text"
                  placeholder="Kurum adı ara..."
                  value={search}
                  onChange={(e) => handleFilterChange({ search: e.target.value })}
                  className="category-filter-search-input"
                />
              </div>
            </div>
          </div>

          <div className="category-filter-section">
            <h3 className="category-filter-section-title">KONUM</h3>
            <div className="category-filter-section-inputs">
              <Select value={city} onValueChange={(value) => handleFilterChange({ city: value })}>
                <SelectTrigger className="category-filter-select">
                  <SelectValue placeholder="Şehir Seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="istanbul">İstanbul</SelectItem>
                  <SelectItem value="ankara">Ankara</SelectItem>
                  <SelectItem value="izmir">İzmir</SelectItem>
                </SelectContent>
              </Select>
              <Select value={district} onValueChange={(value) => handleFilterChange({ district: value })}>
                <SelectTrigger className="category-filter-select">
                  <SelectValue placeholder="İlçe Seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kadikoy">Kadıköy</SelectItem>
                  <SelectItem value="besiktas">Beşiktaş</SelectItem>
                  <SelectItem value="beyoglu">Beyoğlu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="category-filter-section">
            <h3 className="category-filter-section-title">KATEGORİLER</h3>
            <div className="category-filter-section-options">
              {categories.map((cat) => (
                <label
                  key={cat.value}
                  className={`category-filter-radio-option ${selectedCategory === cat.value ? 'category-filter-radio-option--selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={cat.value}
                    checked={selectedCategory === cat.value}
                    onChange={(e) => handleFilterChange({ category: e.target.value })}
                    className="category-filter-radio-input"
                  />
                  <span className="category-filter-radio-label">{cat.label}</span>
                  <span className="category-filter-radio-count">{cat.count}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="category-filter-section">
            <h3 className="category-filter-section-title">AYLIK ÜCRET</h3>
            <div className="category-filter-price-inputs">
              <Input
                type="number"
                value={priceRange[0] === 0 ? "" : priceRange[0]}
                onChange={(e) => handlePriceInput(0, e.target.value)}
                placeholder="0"
                min="0"
                className="category-filter-price-input"
              />
              <span className="category-filter-price-separator">-</span>
              <Input
                type="number"
                value={priceRange[1] === 50000 ? "" : priceRange[1]}
                onChange={(e) => handlePriceInput(1, e.target.value)}
                placeholder="50000"
                min="0"
                className="category-filter-price-input"
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

