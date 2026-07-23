"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { LocateFixed, Loader2, Search as SearchIcon } from "lucide-react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

const ALL_CITIES_VALUE = "__all_cities__";
const ALL_DISTRICTS_VALUE = "__all_districts__";

export type HaritadaAraFilterSidebarProps = {
  cities: string[];
  districts: string[];
  selectedCity: string;
  selectedDistrict: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  onCityChange: (city: string) => void;
  onDistrictChange: (district: string) => void;
  onNearbyClick: () => void;
  nearbyLoading?: boolean;
  nearbyError?: string | null;
  nearbyActive?: boolean;
  showResetFilters?: boolean;
  onResetFilters?: () => void;
};

/** SSR ile istemci useId çakışmasını önlemek için Select'i mount sonrası açar. */
function SelectMountGate({
  label,
  disabled = false,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="select-trigger-default category-filter-select"
        aria-hidden
        data-disabled={disabled ? "" : undefined}
        style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
      >
        <span>{label}</span>
      </div>
    );
  }

  return children;
}

export function HaritadaAraFilterSidebar({
  cities,
  districts,
  selectedCity,
  selectedDistrict,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  onCityChange,
  onDistrictChange,
  onNearbyClick,
  nearbyLoading = false,
  nearbyError = null,
  nearbyActive = false,
  showResetFilters = false,
  onResetFilters,
}: HaritadaAraFilterSidebarProps) {
  const cityLabel = selectedCity || "Şehir Seçin";
  const districtLabel = selectedCity
    ? selectedDistrict || "İlçe Seçin"
    : "Önce şehir seçin";

  return (
    <div className="category-filter-sidebar haritada-ara-filter-sidebar">
      <div className="category-filter-sidebar-card">
        <div className="category-filter-sidebar-header">
          <div className="category-filter-sidebar-header-content">
            <Image
              src="/images/filter.svg"
              alt="Filtreler"
              width={20}
              height={20}
              className="category-filter-sidebar-header-icon"
            />
            <h2 className="category-filter-sidebar-header-title">Filtreler</h2>
          </div>
        </div>

        <div className="category-filter-sidebar-content">
          <div className="category-filter-section">
            <h3 className="category-filter-section-title">ARANACAK KELİME</h3>
            <div className="category-filter-section-inputs">
              <div className="search-container">
                <Input
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSearchSubmit();
                    }
                  }}
                  placeholder="Hizmet adı, kategori..."
                  className="search-field"
                />
                <Button
                  type="button"
                  className="search-button"
                  onClick={onSearchSubmit}
                  aria-label="Ara"
                >
                  <SearchIcon className="icon-md" />
                </Button>
              </div>
            </div>
          </div>

          <div className="category-filter-section">
            <h3 className="category-filter-section-title">YAKINIMDAKİ OKULLAR</h3>
            <div className="category-filter-section-inputs">
              <button
                type="button"
                className={`haritada-ara-nearby-btn${nearbyActive ? " haritada-ara-nearby-btn--active" : ""}`}
                onClick={(event) => {
                  event.preventDefault();
                  onNearbyClick();
                }}
                disabled={nearbyLoading}
                aria-pressed={nearbyActive}
              >
                {nearbyLoading ? (
                  <Loader2 className="haritada-ara-nearby-btn-icon haritada-ara-nearby-btn-icon--spin" aria-hidden />
                ) : (
                  <LocateFixed className="haritada-ara-nearby-btn-icon" aria-hidden />
                )}
                <span>{nearbyLoading ? "Konum alınıyor..." : "Yakınımdaki Okullar"}</span>
              </button>
              {nearbyError ? (
                <p className="haritada-ara-nearby-error" role="alert">
                  {nearbyError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="category-filter-section">
            <h3 className="category-filter-section-title">ŞEHİR</h3>
            <div className="category-filter-section-inputs">
              <SelectMountGate label={cityLabel}>
                <Select
                  value={selectedCity ? selectedCity : ALL_CITIES_VALUE}
                  onValueChange={(value) =>
                    onCityChange(value === ALL_CITIES_VALUE ? "" : value)
                  }
                >
                  <SelectTrigger className="category-filter-select">
                    <SelectValue placeholder="Şehir Seçin" />
                  </SelectTrigger>
                  <SelectContent
                    className="select-content home-location-dropdown"
                    side="bottom"
                    avoidCollisions={false}
                  >
                    <SelectItem value={ALL_CITIES_VALUE} className="select-item">
                      Tüm Şehirler
                    </SelectItem>
                    {cities.map((city) => (
                      <SelectItem key={city} value={city} className="select-item">
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SelectMountGate>
            </div>
          </div>

          <div className="category-filter-section">
            <h3 className="category-filter-section-title">İLÇE</h3>
            <div className="category-filter-section-inputs">
              <SelectMountGate label={districtLabel} disabled={!selectedCity}>
                <Select
                  value={selectedDistrict ? selectedDistrict : ALL_DISTRICTS_VALUE}
                  onValueChange={(value) =>
                    onDistrictChange(value === ALL_DISTRICTS_VALUE ? "" : value)
                  }
                  disabled={!selectedCity}
                >
                  <SelectTrigger className="category-filter-select">
                    <SelectValue
                      placeholder={selectedCity ? "İlçe Seçin" : "Önce şehir seçin"}
                    />
                  </SelectTrigger>
                  <SelectContent
                    className="select-content home-location-dropdown"
                    side="bottom"
                    avoidCollisions={false}
                  >
                    <SelectItem value={ALL_DISTRICTS_VALUE} className="select-item">
                      Tüm İlçeler
                    </SelectItem>
                    {districts.map((district) => (
                      <SelectItem key={district} value={district} className="select-item">
                        {district}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SelectMountGate>
            </div>
          </div>

          {showResetFilters && onResetFilters ? (
            <div className="category-filter-section haritada-ara-reset-filters-section">
              <button
                type="button"
                className="haritada-ara-reset-filters-btn"
                onClick={onResetFilters}
              >
                Filtreleri Sıfırla
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
