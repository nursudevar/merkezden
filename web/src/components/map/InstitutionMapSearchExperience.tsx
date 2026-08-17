"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Building2, GraduationCap, Heart, MapPin, Phone } from "lucide-react";
import {
  getMapMarkerAccountType,
  getMapMarkerKey,
  type InstitutionMapMarker,
} from "@/lib/institutionMapMarkers";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";
import { instructorDetailHref } from "@/lib/instructorMapMarkers";
import type { MapHesapTipi } from "@/lib/mapSearchAccountType";
import type {
  InstitutionMapFocusTarget,
  InstitutionMapViewportBounds,
} from "@/components/map/InstitutionLocationsMap";
import "@/styles/components/institution-locations-map.scss";

const InstitutionLocationsMap = dynamic(
  () => import("@/components/map/InstitutionLocationsMap"),
  { ssr: false },
);

const VISIBLE_INSTITUTION_PAGE_SIZE = 15;

function isMarkerInBounds(marker: InstitutionMapMarker, bounds: InstitutionMapViewportBounds): boolean {
  const lat = Number(marker.latitude);
  const lng = Number(marker.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat <= bounds.north && lat >= bounds.south && lng <= bounds.east && lng >= bounds.west;
}

function dedupeMarkers(markers: InstitutionMapMarker[]): InstitutionMapMarker[] {
  const byKey = new Map<string, InstitutionMapMarker>();
  markers.forEach((marker) => {
    const key = getMapMarkerKey(marker);
    if (!byKey.has(key)) byKey.set(key, marker);
  });
  return Array.from(byKey.values());
}

function formatVisibleCount(count: number): string {
  return count > 100 ? "100+" : String(count);
}

function visibleResultsTitle(hesapTipi: MapHesapTipi): string {
  if (hesapTipi === "kurumlar") return "Görünen Kurumlar";
  if (hesapTipi === "egitmenler") return "Görünen Eğitmenler";
  return "Görünen Sonuçlar";
}

export type InstitutionMapSearchExperienceProps = {
  markers: InstitutionMapMarker[];
  loading?: boolean;
  mapKeyPrefix?: string;
  showViewportInstitutionList?: boolean;
  onToggleFavorite?: (
    id: number,
    e: React.MouseEvent,
    accountType: "institution" | "instructor",
  ) => void;
  favoriteIds?: Set<number>;
  instructorFavoriteIds?: Set<number>;
  favoritesEnabled?: boolean;
  favoriteActionLoadingIds?: Set<number>;
  instructorFavoriteActionLoadingIds?: Set<number>;
  isAuthenticated?: boolean;
  layout?: "page" | "embedded";
  focusTarget?: InstitutionMapFocusTarget | null;
  hesapTipi?: MapHesapTipi;
};

export function InstitutionMapSearchExperience({
  markers,
  loading = false,
  showViewportInstitutionList = true,
  onToggleFavorite,
  favoriteIds,
  instructorFavoriteIds,
  favoritesEnabled = false,
  favoriteActionLoadingIds,
  instructorFavoriteActionLoadingIds,
  isAuthenticated = false,
  layout = "page",
  focusTarget = null,
  hesapTipi = "hepsi",
}: InstitutionMapSearchExperienceProps) {
  const [mapBounds, setMapBounds] = useState<InstitutionMapViewportBounds | null>(null);
  const [visibleInstitutionCount, setVisibleInstitutionCount] = useState(VISIBLE_INSTITUTION_PAGE_SIZE);
  const [brokenLogoKeys, setBrokenLogoKeys] = useState<Set<string>>(() => new Set());

  const visibleMarkers = useMemo(() => {
    const inScope = mapBounds
      ? markers.filter((marker) => isMarkerInBounds(marker, mapBounds))
      : markers;
    return dedupeMarkers(inScope);
  }, [mapBounds, markers]);
  const renderedVisibleMarkers = useMemo(
    () => visibleMarkers.slice(0, visibleInstitutionCount),
    [visibleInstitutionCount, visibleMarkers],
  );
  const hasMoreVisibleMarkers = visibleMarkers.length > visibleInstitutionCount;
  const resultsTitle = visibleResultsTitle(hesapTipi);

  const handleBoundsChange = useCallback((bounds: InstitutionMapViewportBounds) => {
    setMapBounds(bounds);
    setVisibleInstitutionCount(VISIBLE_INSTITUTION_PAGE_SIZE);
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
        <InstitutionLocationsMap
          variant="modal"
          markers={markers}
          loading={loading}
          renderEmptyMap
          onBoundsChange={showViewportInstitutionList ? handleBoundsChange : undefined}
          focusTarget={focusTarget}
          onToggleFavorite={onToggleFavorite}
          favoriteIds={favoriteIds}
          instructorFavoriteIds={instructorFavoriteIds}
          favoritesEnabled={favoritesEnabled}
          favoriteActionLoadingIds={favoriteActionLoadingIds}
          instructorFavoriteActionLoadingIds={instructorFavoriteActionLoadingIds}
          isAuthenticated={isAuthenticated}
        />
        {showViewportInstitutionList ? (
          <section className="map-modal-visible-institutions" aria-label={`${resultsTitle} listesi`}>
            <div className="map-modal-visible-institutions-header">
              <div>
                <h2 className="map-modal-visible-institutions-title">
                  {resultsTitle} <span>{formatVisibleCount(visibleMarkers.length)}</span>
                </h2>
                <p className="map-modal-visible-institutions-subtitle">
                  Haritayı sürükledikçe liste güncellenir
                </p>
              </div>
            </div>
            {loading ? (
              <div className="map-modal-visible-institutions-state">Sonuçlar yükleniyor...</div>
            ) : visibleMarkers.length === 0 ? (
              <div className="map-modal-visible-institutions-state">
                Bu harita alanında gösterilecek sonuç bulunamadı.
              </div>
            ) : (
              <>
                <div className="map-modal-visible-institutions-grid">
                  {renderedVisibleMarkers.map((marker) => {
                    const accountType = getMapMarkerAccountType(marker);
                    const isInstructor = accountType === "instructor";
                    const markerKey = getMapMarkerKey(marker);
                    const isFavorite = isInstructor
                      ? Boolean(instructorFavoriteIds?.has(marker.id))
                      : Boolean(favoriteIds?.has(marker.id));
                    const isActionLoading = isInstructor
                      ? Boolean(instructorFavoriteActionLoadingIds?.has(marker.id))
                      : Boolean(favoriteActionLoadingIds?.has(marker.id));
                    const canRenderLogo = Boolean(marker.logoUrl) && !brokenLogoKeys.has(markerKey);
                    const detailHref = isInstructor
                      ? instructorDetailHref(marker)
                      : getInstitutionDetailHref({ slug: marker.slug });
                    const categoryLabel = marker.categoryName;

                    return (
                      <article
                        key={markerKey}
                        className={`map-modal-institution-card${isInstructor ? " map-modal-institution-card--instructor" : ""}`}
                      >
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
                                setBrokenLogoKeys((prev) => {
                                  const next = new Set(prev);
                                  next.add(markerKey);
                                  return next;
                                })
                              }
                            />
                          ) : (
                            <div className="map-modal-institution-card-placeholder" aria-label="Görsel bulunmuyor">
                              {isInstructor ? <GraduationCap size={24} /> : <Building2 size={24} />}
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
                              onToggleFavorite(marker.id, event, accountType);
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
                          <div className="map-modal-institution-card-labels">
                            <span
                              className={`map-modal-account-type${isInstructor ? " map-modal-account-type--instructor" : ""}`}
                            >
                              {isInstructor ? "Eğitmen" : "Kurum"}
                            </span>
                            {categoryLabel ? (
                              <span className="map-modal-institution-category">{categoryLabel}</span>
                            ) : null}
                          </div>
                          <h3 className="map-modal-institution-name">{marker.institution_name}</h3>
                          {isInstructor && marker.branch ? (
                            <p className="map-modal-instructor-branch">{marker.branch}</p>
                          ) : null}
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
                              {isInstructor ? "Profil" : "Detay"}
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
