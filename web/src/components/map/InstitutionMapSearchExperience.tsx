"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Building2, Heart, MapPin, Phone } from "lucide-react";
import type { InstitutionMapMarker } from "@/lib/institutionMapMarkers";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";
import type {
  InstitutionMapFocusTarget,
  InstitutionMapViewportBounds,
} from "@/components/map/InstitutionLocationsMap";
import {
  buildCategoryTabNames,
  fetchActiveInstitutionCategories,
} from "@/lib/categoryHelpers";
import "@/styles/components/institution-locations-map.scss";

const InstitutionLocationsMap = dynamic(
  () => import("@/components/map/InstitutionLocationsMap"),
  { ssr: false },
);

const VISIBLE_INSTITUTION_PAGE_SIZE = 15;

const MAP_CATEGORY_FILTERS_FALLBACK = [
  "Hepsi",
  "Okul",
  "Kurs & Sınava Hazırlık",
  "Spor",
  "Sanat",
  "Yabancı Dil",
  "Kişisel Gelişim",
  "Mesleki Eğitim",
  "Özel Eğitim",
  "Sürücü Kursu",
  "Patili Dostlar",
] as const;

function normalizeMapCategory(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/&/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function markerMatchesCategory(marker: InstitutionMapMarker, selectedCategory: string): boolean {
  if (selectedCategory === "Hepsi") return true;
  const selectedKey = normalizeMapCategory(selectedCategory);
  const markerNameKey = normalizeMapCategory(marker.categoryName);
  const markerSlugKey = normalizeMapCategory(marker.categorySlug);
  if (markerNameKey === selectedKey || markerSlugKey === selectedKey) return true;
  if (selectedKey === "kurs sinava hazirlik") {
    return (
      markerNameKey === "kurs sinav" ||
      markerNameKey === "kurs ve sinav" ||
      markerNameKey === "sinava hazirlik" ||
      markerSlugKey === "kurs sinav" ||
      markerSlugKey === "kurs ve sinav" ||
      markerSlugKey === "sinava hazirlik"
    );
  }
  return false;
}

function isMarkerInBounds(marker: InstitutionMapMarker, bounds: InstitutionMapViewportBounds): boolean {
  const lat = Number(marker.latitude);
  const lng = Number(marker.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat <= bounds.north && lat >= bounds.south && lng <= bounds.east && lng >= bounds.west;
}

function dedupeMarkers(markers: InstitutionMapMarker[]): InstitutionMapMarker[] {
  const byId = new Map<number, InstitutionMapMarker>();
  markers.forEach((marker) => {
    if (Number.isFinite(marker.id) && !byId.has(marker.id)) {
      byId.set(marker.id, marker);
    }
  });
  return Array.from(byId.values());
}

function formatVisibleCount(count: number): string {
  return count > 100 ? "100+" : String(count);
}

export type InstitutionMapSearchExperienceProps = {
  markers: InstitutionMapMarker[];
  loading?: boolean;
  mapKeyPrefix?: string;
  showViewportInstitutionList?: boolean;
  onToggleFavorite?: (institutionId: number, e: React.MouseEvent) => void;
  favoriteIds?: Set<number>;
  favoritesEnabled?: boolean;
  favoriteActionLoadingIds?: Set<number>;
  isAuthenticated?: boolean;
  /** `page`: tam sayfa yerleşimi. Varsayılan modal gövde sınıflarını kullanır. */
  layout?: "page" | "embedded";
  focusTarget?: InstitutionMapFocusTarget | null;
};

export function InstitutionMapSearchExperience({
  markers,
  loading = false,
  mapKeyPrefix = "institution-map",
  showViewportInstitutionList = true,
  onToggleFavorite,
  favoriteIds,
  favoritesEnabled = false,
  favoriteActionLoadingIds,
  isAuthenticated = false,
  layout = "page",
  focusTarget = null,
}: InstitutionMapSearchExperienceProps) {
  const [selectedMapCategory, setSelectedMapCategory] = useState("Hepsi");
  const [mapCategoryFilters, setMapCategoryFilters] = useState<string[]>([
    ...MAP_CATEGORY_FILTERS_FALLBACK,
  ]);
  const [mapBounds, setMapBounds] = useState<InstitutionMapViewportBounds | null>(null);
  const [visibleInstitutionCount, setVisibleInstitutionCount] = useState(VISIBLE_INSTITUTION_PAGE_SIZE);
  const [brokenLogoIds, setBrokenLogoIds] = useState<Set<number>>(() => new Set());

  const categoryMarkers = useMemo(
    () => markers.filter((marker) => markerMatchesCategory(marker, selectedMapCategory)),
    [markers, selectedMapCategory],
  );
  const visibleMarkers = useMemo(() => {
    const inScope = mapBounds
      ? categoryMarkers.filter((marker) => isMarkerInBounds(marker, mapBounds))
      : categoryMarkers;
    return dedupeMarkers(inScope);
  }, [mapBounds, categoryMarkers]);
  const renderedVisibleMarkers = useMemo(
    () => visibleMarkers.slice(0, visibleInstitutionCount),
    [visibleInstitutionCount, visibleMarkers],
  );
  const hasMoreVisibleMarkers = visibleMarkers.length > visibleInstitutionCount;

  const resetVisibleInstitutionCount = useCallback(() => {
    setVisibleInstitutionCount(VISIBLE_INSTITUTION_PAGE_SIZE);
  }, []);

  const handleBoundsChange = useCallback((bounds: InstitutionMapViewportBounds) => {
    setMapBounds(bounds);
    setVisibleInstitutionCount(VISIBLE_INSTITUTION_PAGE_SIZE);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const categories = await fetchActiveInstitutionCategories();
      if (cancelled) return;
      setMapCategoryFilters(buildCategoryTabNames(categories, MAP_CATEGORY_FILTERS_FALLBACK));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const bodyClassName = [
    "institution-map-modal-body",
    showViewportInstitutionList ? "institution-map-modal-body--with-list" : "",
    layout === "page" ? "institution-map-modal-body--page" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={
        layout === "page"
          ? "institution-map-page-panel"
          : "institution-map-modal-panel"
      }
    >
      <div className="institution-map-modal-header">
        <h1 id="institution-map-search-title" className="institution-map-modal-title">
          Kurum Haritası
        </h1>
      </div>
      <div className={bodyClassName}>
        <div className="map-modal-category-filters" aria-label="Harita kategori filtreleri">
          {mapCategoryFilters.map((category) => {
            const isActive = selectedMapCategory === category;
            return (
              <button
                key={category}
                type="button"
                className={`map-modal-category-chip${isActive ? " map-modal-category-chip--active" : ""}`}
                aria-pressed={isActive}
                onClick={() => {
                  setSelectedMapCategory(category);
                  setMapBounds(null);
                  resetVisibleInstitutionCount();
                }}
              >
                {category}
              </button>
            );
          })}
        </div>
        {!loading && selectedMapCategory !== "Hepsi" && categoryMarkers.length === 0 ? (
          <p className="map-modal-empty-message">
            Bu kategoride haritada gösterilecek kurum bulunamadı.
          </p>
        ) : null}
        <InstitutionLocationsMap
          variant="modal"
          markers={categoryMarkers}
          loading={loading}
          renderEmptyMap
          onBoundsChange={showViewportInstitutionList ? handleBoundsChange : undefined}
          focusTarget={focusTarget}
        />
        {showViewportInstitutionList ? (
          <section className="map-modal-visible-institutions" aria-label="Görünen kurumlar listesi">
            <div className="map-modal-visible-institutions-header">
              <div>
                <h2 className="map-modal-visible-institutions-title">
                  Görünen Kurumlar <span>{formatVisibleCount(visibleMarkers.length)}</span>
                </h2>
                <p className="map-modal-visible-institutions-subtitle">
                  Haritayı sürükledikçe liste güncellenir
                </p>
              </div>
            </div>
            {loading ? (
              <div className="map-modal-visible-institutions-state">Kurumlar yükleniyor...</div>
            ) : visibleMarkers.length === 0 ? (
              <div className="map-modal-visible-institutions-state">
                Bu harita alanında gösterilecek kurum bulunamadı.
              </div>
            ) : (
              <>
                <div className="map-modal-visible-institutions-grid">
                  {renderedVisibleMarkers.map((marker) => {
                    const isFavorite = Boolean(favoriteIds?.has(marker.id));
                    const isActionLoading = Boolean(favoriteActionLoadingIds?.has(marker.id));
                    const canRenderLogo = Boolean(marker.logoUrl) && !brokenLogoIds.has(marker.id);
                    const detailHref = getInstitutionDetailHref({ slug: marker.slug });
                    const categoryLabel = marker.categoryName;

                    return (
                      <article key={marker.id} className="map-modal-institution-card">
                        <div className="map-modal-institution-card-media">
                          {canRenderLogo ? (
                            <Image
                              src={marker.logoUrl}
                              alt={marker.institution_name}
                              fill
                              className="map-modal-institution-card-logo"
                              sizes="96px"
                              unoptimized
                              onError={() =>
                                setBrokenLogoIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(marker.id);
                                  return next;
                                })
                              }
                            />
                          ) : (
                            <div className="map-modal-institution-card-placeholder" aria-label="Logo bulunmuyor">
                              <Building2 size={24} />
                            </div>
                          )}
                          <button
                            type="button"
                            className="map-modal-institution-favorite"
                            aria-label={isFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}
                            disabled={isActionLoading || (isAuthenticated && !favoritesEnabled)}
                            onClick={(event) => {
                              if (!onToggleFavorite) {
                                event.preventDefault();
                                event.stopPropagation();
                                return;
                              }
                              onToggleFavorite(marker.id, event);
                            }}
                          >
                            <Heart
                              className={
                                isFavorite
                                  ? "map-modal-institution-heart map-modal-institution-heart--active"
                                  : "map-modal-institution-heart"
                              }
                            />
                          </button>
                        </div>
                        <div className="map-modal-institution-card-content">
                          {categoryLabel ? (
                            <span className="map-modal-institution-category">{categoryLabel}</span>
                          ) : null}
                          <h3 className="map-modal-institution-name">{marker.institution_name}</h3>
                          <div className="map-modal-institution-location">
                            <MapPin size={14} aria-hidden />
                            <span>{marker.address}</span>
                          </div>
                          <div className="map-modal-institution-actions">
                            {marker.official_phone ? (
                              <a
                                href={`tel:${marker.official_phone.replace(/\s+/g, "")}`}
                                className="map-modal-institution-call"
                              >
                                <Phone size={14} aria-hidden />
                                Ara
                              </a>
                            ) : null}
                            <Link href={detailHref} className="map-modal-institution-detail">
                              Detay
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {hasMoreVisibleMarkers ? (
                  <div className="map-modal-visible-institutions-more-wrap">
                    <button
                      type="button"
                      className="map-modal-visible-institutions-more"
                      onClick={() =>
                        setVisibleInstitutionCount((count) => count + VISIBLE_INSTITUTION_PAGE_SIZE)
                      }
                    >
                      Daha Fazla Gör
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
