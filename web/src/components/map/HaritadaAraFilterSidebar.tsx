"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { LocateFixed, Loader2, RotateCcw, Search as SearchIcon } from "lucide-react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import type { TurkiyeLocationOption } from "@/lib/turkiyeLocationsClient";

const ALL_CITIES_VALUE = "__all_cities__";
const ALL_DISTRICTS_VALUE = "__all_districts__";
const ALL_NEIGHBORHOODS_VALUE = "__all_neighborhoods__";

export type HaritadaAraFilterSidebarProps = {
  iller: TurkiyeLocationOption[];
  ilceler: TurkiyeLocationOption[];
  mahalleler: TurkiyeLocationOption[];
  selectedIlId: string;
  selectedIlceId: string;
  selectedMahalleId: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  onIlChange: (ilId: string) => void;
  onIlceChange: (ilceId: string) => void;
  onMahalleChange: (mahalleId: string) => void;
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
  iller,
  ilceler,
  mahalleler,
  selectedIlId,
  selectedIlceId,
  selectedMahalleId,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  onIlChange,
  onIlceChange,
  onMahalleChange,
  onNearbyClick,
  nearbyLoading = false,
  nearbyError = null,
  nearbyActive = false,
  showResetFilters = false,
  onResetFilters,
}: HaritadaAraFilterSidebarProps) {
  const selectedIlAd = iller.find((row) => String(row.id) === selectedIlId)?.ad ?? "";
  const selectedIlceAd = ilceler.find((row) => String(row.id) === selectedIlceId)?.ad ?? "";
  const selectedMahalleAd =
    mahalleler.find((row) => String(row.id) === selectedMahalleId)?.ad ?? "";
  const ilLabel = selectedIlAd || "İl Seçin";
  const ilceLabel = selectedIlId
    ? selectedIlceAd || "Tüm İlçeler"
    : "Önce il seçin";
  const mahalleLabel = selectedIlceId
    ? selectedMahalleAd || "Tüm Mahalleler"
    : "Önce ilçe seçin";

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
            <h3 className="category-filter-section-title">İL</h3>
            <div className="category-filter-section-inputs">
              <SelectMountGate label={ilLabel}>
                <Select
                  value={selectedIlId ? selectedIlId : ALL_CITIES_VALUE}
                  onValueChange={(value) =>
                    onIlChange(value === ALL_CITIES_VALUE ? "" : value)
                  }
                >
                  <SelectTrigger className="category-filter-select">
                    <SelectValue placeholder="İl Seçin" />
                  </SelectTrigger>
                  <SelectContent
                    className="select-content home-location-dropdown"
                    side="bottom"
                    avoidCollisions={false}
                  >
                    <SelectItem value={ALL_CITIES_VALUE} className="select-item">
                      Tüm Şehirler
                    </SelectItem>
                    {iller.map((il) => (
                      <SelectItem key={il.id} value={String(il.id)} className="select-item">
                        {il.ad}
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
              <SelectMountGate label={ilceLabel} disabled={!selectedIlId}>
                <Select
                  value={selectedIlceId ? selectedIlceId : ALL_DISTRICTS_VALUE}
                  onValueChange={(value) =>
                    onIlceChange(value === ALL_DISTRICTS_VALUE ? "" : value)
                  }
                  disabled={!selectedIlId}
                >
                  <SelectTrigger className="category-filter-select">
                    <SelectValue
                      placeholder={selectedIlId ? "İlçe Seçin" : "Önce il seçin"}
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
                    {ilceler.map((ilce) => (
                      <SelectItem key={ilce.id} value={String(ilce.id)} className="select-item">
                        {ilce.ad}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SelectMountGate>
            </div>
          </div>

          <div className="category-filter-section">
            <h3 className="category-filter-section-title">MAHALLE</h3>
            <div className="category-filter-section-inputs">
              <SelectMountGate label={mahalleLabel} disabled={!selectedIlceId}>
                <Select
                  value={selectedMahalleId ? selectedMahalleId : ALL_NEIGHBORHOODS_VALUE}
                  onValueChange={(value) =>
                    onMahalleChange(value === ALL_NEIGHBORHOODS_VALUE ? "" : value)
                  }
                  disabled={!selectedIlceId}
                >
                  <SelectTrigger className="category-filter-select">
                    <SelectValue
                      placeholder={selectedIlceId ? "Mahalle Seçin" : "Önce ilçe seçin"}
                    />
                  </SelectTrigger>
                  <SelectContent
                    className="select-content home-location-dropdown"
                    side="bottom"
                    avoidCollisions={false}
                  >
                    <SelectItem value={ALL_NEIGHBORHOODS_VALUE} className="select-item">
                      Tüm Mahalleler
                    </SelectItem>
                    {mahalleler.map((mahalle) => (
                      <SelectItem key={mahalle.id} value={String(mahalle.id)} className="select-item">
                        {mahalle.ad}
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
                className="category-results-reset-btn haritada-ara-reset-filters-btn"
                onClick={onResetFilters}
                aria-label="Tüm filtreleri sıfırla"
              >
                <RotateCcw size={16} aria-hidden="true" />
                <span>Filtreleri Sıfırla</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
