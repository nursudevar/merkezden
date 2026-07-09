"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Building2, Heart, MapPin, Phone, X } from "lucide-react";
import { Separator } from "@/components/ui";
import type { InstitutionMapMarker } from "@/lib/institutionMapMarkers";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";
import type { InstitutionMapViewportBounds } from "@/components/map/InstitutionLocationsMap";
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

export type InstitutionMapSearchSectionProps = {
  markers: InstitutionMapMarker[];
  loading?: boolean;
  mapKeyPrefix?: string;
  /** Ana sayfa sol panelde harita ile sonraki filtre arasında ayırıcı */
  showSeparatorAfter?: boolean;
  showViewportInstitutionList?: boolean;
  onToggleFavorite?: (institutionId: number, e: React.MouseEvent) => void;
  favoriteIds?: Set<number>;
  favoritesEnabled?: boolean;
  favoriteActionLoadingIds?: Set<number>;
  isAuthenticated?: boolean;
};

export function InstitutionMapSearchSection({
  markers,
  loading = false,
  mapKeyPrefix = "institution-map",
  showSeparatorAfter = false,
  showViewportInstitutionList = false,
  onToggleFavorite,
  favoriteIds,
  favoritesEnabled = false,
  favoriteActionLoadingIds,
  isAuthenticated = false,
}: InstitutionMapSearchSectionProps) {
  const [showInstitutionMapModal, setShowInstitutionMapModal] = useState(false);
  const [selectedMapCategory, setSelectedMapCategory] = useState("Hepsi");
  const [mapCategoryFilters, setMapCategoryFilters] = useState<string[]>([
    ...MAP_CATEGORY_FILTERS_FALLBACK,
  ]);
  const [modalBounds, setModalBounds] = useState<InstitutionMapViewportBounds | null>(null);
  const [visibleInstitutionCount, setVisibleInstitutionCount] = useState(VISIBLE_INSTITUTION_PAGE_SIZE);
  const [brokenLogoIds, setBrokenLogoIds] = useState<Set<number>>(() => new Set());

  const modalMarkers = useMemo(
    () => markers.filter((marker) => markerMatchesCategory(marker, selectedMapCategory)),
    [markers, selectedMapCategory],
  );
  const visibleModalMarkers = useMemo(() => {
    const inScope = modalBounds
      ? modalMarkers.filter((marker) => isMarkerInBounds(marker, modalBounds))
      : modalMarkers;
    return dedupeMarkers(inScope);
  }, [modalBounds, modalMarkers]);
  const renderedVisibleMarkers = useMemo(
    () => visibleModalMarkers.slice(0, visibleInstitutionCount),
    [visibleInstitutionCount, visibleModalMarkers],
  );
  const hasMoreVisibleMarkers = visibleModalMarkers.length > visibleInstitutionCount;

  const resetVisibleInstitutionCount = useCallback(() => {
    setVisibleInstitutionCount(VISIBLE_INSTITUTION_PAGE_SIZE);
  }, []);

  const handleModalBoundsChange = useCallback((bounds: InstitutionMapViewportBounds) => {
    setModalBounds(bounds);
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

  useEffect(() => {
    if (!showInstitutionMapModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowInstitutionMapModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [showInstitutionMapModal]);

  return (
    <>
      <div className="filter-section filter-section-map">
        <div className="filter-section-map-heading">
          <div className="filter-section-title filter-section-title--map-row">
            <Image src="/images/map.svg" alt="Kurum Haritası" width={20} height={20} />
            <span>Kurum Haritası</span>
          </div>
          <button
            type="button"
            className="institution-map-detail-link"
            onClick={() => {
              setSelectedMapCategory("Hepsi");
              setModalBounds(null);
              resetVisibleInstitutionCount();
              setShowInstitutionMapModal(true);
            }}
          >
            Haritada Ara
          </button>
        </div>
        <InstitutionLocationsMap
          key={`${mapKeyPrefix}-sidebar`}
          markers={markers}
          loading={loading}
        />
      </div>
      {showSeparatorAfter ? <Separator /> : null}

      {showInstitutionMapModal ? (
        <div className="institution-map-modal-root" role="presentation">
          <button
            type="button"
            className="institution-map-modal-backdrop"
            aria-label="Haritayı kapat"
            onClick={() => setShowInstitutionMapModal(false)}
          />
          <div
            className="institution-map-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="institution-map-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="institution-map-modal-header">
              <h2 id="institution-map-modal-title" className="institution-map-modal-title">
                Kurum Haritası
              </h2>
              <button
                type="button"
                className="institution-map-modal-close"
                onClick={() => setShowInstitutionMapModal(false)}
                aria-label="Kapat"
              >
                <X size={22} strokeWidth={2} />
              </button>
            </div>
            <div className={`institution-map-modal-body${showViewportInstitutionList ? " institution-map-modal-body--with-list" : ""}`}>
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
                        setModalBounds(null);
                        resetVisibleInstitutionCount();
                      }}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
              {!loading && selectedMapCategory !== "Hepsi" && modalMarkers.length === 0 ? (
                <p className="map-modal-empty-message">
                  Bu kategoride haritada gösterilecek kurum bulunamadı.
                </p>
              ) : null}
              <InstitutionLocationsMap
                key={`${mapKeyPrefix}-modal-${selectedMapCategory}`}
                variant="modal"
                markers={modalMarkers}
                loading={loading}
                renderEmptyMap
                onBoundsChange={showViewportInstitutionList ? handleModalBoundsChange : undefined}
              />
              {showViewportInstitutionList ? (
                <section className="map-modal-visible-institutions" aria-label="Görünen kurumlar listesi">
                  <div className="map-modal-visible-institutions-header">
                    <div>
                      <h3 className="map-modal-visible-institutions-title">
                        Görünen Kurumlar <span>{formatVisibleCount(visibleModalMarkers.length)}</span>
                      </h3>
                      <p className="map-modal-visible-institutions-subtitle">
                        Haritayı sürükledikçe liste güncellenir
                      </p>
                    </div>
                  </div>
                  {loading ? (
                    <div className="map-modal-visible-institutions-state">Kurumlar yükleniyor...</div>
                  ) : visibleModalMarkers.length === 0 ? (
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
                              <h4 className="map-modal-institution-name">{marker.institution_name}</h4>
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
        </div>
      ) : null}
    </>
  );
}
