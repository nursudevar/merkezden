"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import LoginModal from "@/components/LoginModal";
import { AppNoticeBar } from "@/components/AppNoticeBar";
import {
  InstitutionMapMarkerPopupActions,
  type MapPopupFavoriteHandlers,
} from "@/components/map/InstitutionMapMarkerPopupActions";
import { useListingFavorites } from "@/hooks/useListingFavorites";
import { NOT_INDIVIDUAL_FAVORITES_MESSAGE } from "@/lib/favorites/favoritesClient";
import {
  getMapMarkerAccountType,
  getMapMarkerKey,
  type InstitutionMapMarker,
} from "@/lib/institutionMapMarkers";
import type { DistrictBoundaryGeoJson } from "@/lib/districtMapView";

/** Lucide MapPin path as inline SVG — Leaflet divIcon cannot host the React icon. */
const INSTITUTION_MAPPIN_SVG = `
<div class="institution-map-mappin" aria-hidden="true">
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none">
    <path fill="currentColor" d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
    <circle class="institution-map-mappin-hole" cx="12" cy="10" r="3"/>
  </svg>
</div>
`;

const INSTRUCTOR_MARKER_SVG = `
<div class="institution-map-pin-inner institution-map-pin-inner--instructor" aria-hidden="true">
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
</div>
`;

function createBuildingMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: "institution-map-marker-leaflet",
    html: INSTITUTION_MAPPIN_SVG,
    iconSize: [32, 32],
    iconAnchor: [16, 30],
    tooltipAnchor: [0, -28],
  });
}

function createInstructorMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: "institution-map-marker-leaflet institution-map-marker-leaflet--instructor",
    html: INSTRUCTOR_MARKER_SVG,
    iconSize: [40, 40],
    iconAnchor: [20, 38],
    tooltipAnchor: [0, -34],
  });
}

function createClusterIcon(cluster: { getChildCount: () => number }): L.DivIcon {
  const count = cluster.getChildCount();
  return L.divIcon({
    className: "institution-map-cluster-leaflet",
    html: `<div class="institution-map-cluster-inner"><span class="institution-map-cluster-count">${count}</span></div>`,
    iconSize: [44, 44],
  });
}

type LeafletMarkerClusterGroup = L.Layer & {
  addLayers: (layers: L.Layer[]) => void;
  clearLayers: () => void;
};

function createLeafletMarkerClusterGroup(
  options: {
    chunkedLoading?: boolean;
    showCoverageOnHover?: boolean;
    iconCreateFunction?: (cluster: { getChildCount: () => number }) => L.DivIcon;
  },
): LeafletMarkerClusterGroup {
  const MarkerClusterGroupCtor = (
    L as typeof L & {
      MarkerClusterGroup: new (opts?: {
        chunkedLoading?: boolean;
        showCoverageOnHover?: boolean;
        iconCreateFunction?: (cluster: { getChildCount: () => number }) => L.DivIcon;
      }) => LeafletMarkerClusterGroup;
    }
  ).MarkerClusterGroup;
  return new MarkerClusterGroupCtor(options);
}

function escapeTooltipHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MARKER_POPUP_HOVER_CLOSE_MS = 200;

function canHoverOpenMarkerPopup(): boolean {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function createMarkerPopupHoverController() {
  let closeTimer: number | null = null;
  const bindings = new Map<
    L.Marker,
    { element: HTMLElement; onEnter: () => void; onLeave: () => void }
  >();

  const clearCloseTimer = () => {
    if (closeTimer == null) return;
    window.clearTimeout(closeTimer);
    closeTimer = null;
  };

  const unbindPopupElement = (marker: L.Marker) => {
    const binding = bindings.get(marker);
    if (!binding) return;
    binding.element.removeEventListener("mouseenter", binding.onEnter);
    binding.element.removeEventListener("mouseleave", binding.onLeave);
    bindings.delete(marker);
  };

  const scheduleClose = (marker: L.Marker) => {
    if (!canHoverOpenMarkerPopup()) return;
    clearCloseTimer();
    closeTimer = window.setTimeout(() => {
      closeTimer = null;
      marker.closePopup();
    }, MARKER_POPUP_HOVER_CLOSE_MS);
  };

  return {
    clearCloseTimer,
    unbindPopupElement,
    dispose() {
      clearCloseTimer();
      for (const marker of [...bindings.keys()]) {
        unbindPopupElement(marker);
      }
    },
    onMarkerMouseOver(marker: L.Marker) {
      if (!canHoverOpenMarkerPopup()) return;
      clearCloseTimer();
      if (!marker.isPopupOpen()) {
        marker.openPopup();
      }
    },
    onMarkerMouseOut(marker: L.Marker) {
      scheduleClose(marker);
    },
    bindPopupElement(marker: L.Marker, popupEl: HTMLElement) {
      unbindPopupElement(marker);
      if (!canHoverOpenMarkerPopup()) return;
      const onEnter = () => {
        clearCloseTimer();
      };
      const onLeave = () => {
        scheduleClose(marker);
      };
      popupEl.addEventListener("mouseenter", onEnter);
      popupEl.addEventListener("mouseleave", onLeave);
      bindings.set(marker, { element: popupEl, onEnter, onLeave });
    },
  };
}

function buildMarkerPopupHtml(item: InstitutionMapMarker): string {
  const isInstructor = getMapMarkerAccountType(item) === "instructor";
  const kind = isInstructor ? `<p class="institution-locations-tooltip-kind">Eğitmen</p>` : "";
  const phone = item.official_phone
    ? `<p class="institution-locations-tooltip-meta">Tel: ${escapeTooltipHtml(item.official_phone)}</p>`
    : "";
  const email = !isInstructor && item.official_email
    ? `<p class="institution-locations-tooltip-meta">E-posta: ${escapeTooltipHtml(item.official_email)}</p>`
    : "";
  const category = isInstructor && item.categoryName
    ? `<p class="institution-locations-tooltip-meta">${escapeTooltipHtml(item.categoryName)}</p>`
    : "";
  const branch = isInstructor && item.branch
    ? `<p class="institution-locations-tooltip-meta">${escapeTooltipHtml(item.branch)}</p>`
    : "";
  return `<div class="institution-locations-tooltip institution-locations-popup-card">${kind}<p class="institution-locations-tooltip-title">${escapeTooltipHtml(item.institution_name)}</p>${category}${branch}<p class="institution-locations-tooltip-address">${escapeTooltipHtml(item.address)}</p>${phone}${email}<div class="institution-locations-popup-actions-slot" data-map-popup-actions></div></div>`;
}

function buildMarkerPopupContent(item: InstitutionMapMarker): {
  content: HTMLElement;
  actionsSlot: HTMLElement;
} | null {
  const holder = document.createElement("div");
  holder.innerHTML = buildMarkerPopupHtml(item);
  const content = holder.firstElementChild;
  const actionsSlot = content?.querySelector("[data-map-popup-actions]");
  if (!(content instanceof HTMLElement) || !(actionsSlot instanceof HTMLElement)) {
    return null;
  }
  return { content, actionsSlot };
}

function buildMarkerClusterSignature(markers: InstitutionMapMarker[]): string {
  if (markers.length === 0) return "";
  let hash = 2166136261;
  for (const marker of markers) {
    const key = getMapMarkerKey(marker);
    for (let i = 0; i < key.length; i += 1) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `${markers.length}:${hash >>> 0}`;
}

const DEFAULT_CENTER: [number, number] = [39.9334, 32.8597];

export type InstitutionMapViewportBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

function toViewportBounds(bounds: L.LatLngBounds): InstitutionMapViewportBounds {
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  };
}

/** Leaflet rAF/zoom animasyonları unmount sonrası _leaflet_pos hatasına yol açmasın diye. */
function isMapContainerLive(map: L.Map): boolean {
  try {
    const container = map.getContainer?.();
    return Boolean(container?.isConnected);
  } catch {
    return false;
  }
}

function stopMapAnimations(map: L.Map): void {
  try {
    map.stop();
  } catch {
    /* map teardown */
  }
}

function MapInvalidateSize() {
  const map = useMap();
  useEffect(() => {
    let cancelled = false;
    const runInvalidate = () => {
      if (cancelled || !isMapContainerLive(map)) return;
      try {
        map.invalidateSize();
      } catch {
        /* map teardown */
      }
    };
    const raf = window.requestAnimationFrame(runInvalidate);
    const t = window.setTimeout(runInvalidate, 120);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
      stopMapAnimations(map);
    };
  }, [map]);
  return null;
}

/** Leaflet varsayılan "Leaflet" önek metnini kaldırır; tile katmanı atıfı korunur. */
function MapAttributionPrefix() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl.setPrefix("");
  }, [map]);
  return null;
}

type MapPopupPortalTarget = {
  node: HTMLElement;
  marker: InstitutionMapMarker;
  popup: L.Popup;
};

function InstitutionMarkerClusterLayer({
  markers,
  markerSignature,
  buildingIcon,
  instructorIcon,
  favorites,
}: {
  markers: InstitutionMapMarker[];
  markerSignature: string;
  buildingIcon: L.DivIcon;
  instructorIcon: L.DivIcon;
  favorites: MapPopupFavoriteHandlers;
}) {
  const map = useMap();
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const [popupTarget, setPopupTarget] = useState<MapPopupPortalTarget | null>(null);

  useEffect(() => {
    if (!markerSignature || !isMapContainerLive(map)) return;

    const cluster = createLeafletMarkerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      iconCreateFunction: createClusterIcon,
    });
    const popupHover = createMarkerPopupHoverController();

    const leafletMarkers = markersRef.current.map((item) => {
      const isInstructor = getMapMarkerAccountType(item) === "instructor";
      const marker = L.marker([item.latitude, item.longitude], {
        icon: isInstructor ? instructorIcon : buildingIcon,
      });
      const popupContent = buildMarkerPopupContent(item);
      if (popupContent) {
        marker.bindPopup(popupContent.content, {
          closeButton: true,
          className: "institution-locations-popup-shell",
          maxWidth: 280,
          minWidth: 228,
          autoPanPadding: [16, 16],
        });
        marker.on("popupopen", () => {
          popupHover.clearCloseTimer();
          const popup = marker.getPopup();
          if (!popup) return;
          const popupEl = popup.getElement();
          if (popupEl) {
            L.DomEvent.disableClickPropagation(popupEl);
            L.DomEvent.disableScrollPropagation(popupEl);
            popupHover.bindPopupElement(marker, popupEl);
          }
          setPopupTarget({
            node: popupContent.actionsSlot,
            marker: item,
            popup,
          });
        });
        marker.on("popupclose", () => {
          popupHover.unbindPopupElement(marker);
          setPopupTarget((current) =>
            current && getMapMarkerKey(current.marker) === getMapMarkerKey(item) ? null : current,
          );
        });
        marker.on("mouseover", () => {
          popupHover.onMarkerMouseOver(marker);
        });
        marker.on("mouseout", () => {
          popupHover.onMarkerMouseOut(marker);
        });
      }
      return marker;
    });

    cluster.addLayers(leafletMarkers);
    map.addLayer(cluster);

    return () => {
      popupHover.dispose();
      setPopupTarget(null);
      try {
        if (map.hasLayer(cluster)) {
          map.removeLayer(cluster);
        }
        cluster.clearLayers();
      } catch {
        /* map teardown */
      }
    };
  }, [map, markerSignature, buildingIcon, instructorIcon]);

  return popupTarget
    ? createPortal(
        <InstitutionMapMarkerPopupActions
          marker={popupTarget.marker}
          favorites={favorites}
          popup={popupTarget.popup}
        />,
        popupTarget.node,
      )
    : null;
}

function MapBoundsReporter({
  onBoundsChange,
}: {
  onBoundsChange?: (bounds: InstitutionMapViewportBounds) => void;
}) {
  const map = useMap();

  const reportBounds = useCallback(() => {
    if (!onBoundsChange || !isMapContainerLive(map)) return;
    try {
      onBoundsChange(toViewportBounds(map.getBounds()));
    } catch {
      /* map teardown */
    }
  }, [map, onBoundsChange]);

  useMapEvents({
    moveend: reportBounds,
    zoomend: reportBounds,
  });

  useEffect(() => {
    if (!onBoundsChange) return;
    let cancelled = false;
    const raf = window.requestAnimationFrame(() => {
      if (!cancelled) reportBounds();
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [onBoundsChange, reportBounds]);

  return null;
}

function MapDistrictBoundary({
  geoJson,
}: {
  geoJson?: InstitutionMapFocusTarget["boundaryGeoJson"];
}) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (layerRef.current) {
      try {
        map.removeLayer(layerRef.current);
      } catch {
        /* map teardown */
      }
      layerRef.current = null;
    }

    if (!geoJson) return;

    const layer = L.geoJSON(geoJson as GeoJSON.GeoJsonObject, {
      style: {
        color: "#6d5dfc",
        weight: 2,
        opacity: 0.85,
        fillColor: "#6d5dfc",
        fillOpacity: 0.1,
      },
      interactive: false,
    });
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (!layerRef.current) return;
      try {
        map.removeLayer(layerRef.current);
      } catch {
        /* map teardown */
      }
      layerRef.current = null;
    };
  }, [map, geoJson]);

  return null;
}

function MapFocusController({
  focusTarget,
}: {
  focusTarget?: InstitutionMapFocusTarget | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusTarget) return;

    let cancelled = false;

    const applyFocus = () => {
      if (cancelled || !isMapContainerLive(map)) return;
      try {
        stopMapAnimations(map);

        if (focusTarget.bounds) {
          const [[south, west], [north, east]] = focusTarget.bounds;
          if (
            Number.isFinite(south) &&
            Number.isFinite(west) &&
            Number.isFinite(north) &&
            Number.isFinite(east) &&
            south < north &&
            west < east
          ) {
            map.fitBounds(
              [
                [south, west],
                [north, east],
              ],
              { padding: [28, 28], maxZoom: 14, animate: true },
            );
            return;
          }
        }

        const lat = Number(focusTarget.lat);
        const lng = Number(focusTarget.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const zoom = Number.isFinite(Number(focusTarget.zoom)) ? Number(focusTarget.zoom) : 13;
        map.setView([lat, lng], zoom, { animate: false });
      } catch {
        /* map teardown */
      }
    };

    const raf = window.requestAnimationFrame(applyFocus);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      stopMapAnimations(map);
    };
  }, [
    map,
    focusTarget?.token,
    focusTarget?.lat,
    focusTarget?.lng,
    focusTarget?.zoom,
    focusTarget?.bounds,
  ]);

  return null;
}

export type InstitutionMapFocusTarget = {
  lat?: number;
  lng?: number;
  zoom?: number;
  bounds?: [[number, number], [number, number]];
  boundaryGeoJson?: DistrictBoundaryGeoJson | null;
  /** Aynı konuma tekrar odaklanmayı tetiklemek için */
  token: number;
};

export type InstitutionLocationsMapProps = {
  variant?: "inline" | "modal";
  markers: InstitutionMapMarker[];
  loading?: boolean;
  renderEmptyMap?: boolean;
  onBoundsChange?: (bounds: InstitutionMapViewportBounds) => void;
  focusTarget?: InstitutionMapFocusTarget | null;
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
};

export default function InstitutionLocationsMap({
  variant = "inline",
  markers,
  loading = false,
  renderEmptyMap = false,
  onBoundsChange,
  focusTarget = null,
  onToggleFavorite,
  favoriteIds,
  instructorFavoriteIds,
  favoritesEnabled,
  favoriteActionLoadingIds,
  instructorFavoriteActionLoadingIds,
  isAuthenticated,
}: InstitutionLocationsMapProps) {
  const mapInstanceId = useId().replace(/:/g, "");
  const localFavorites = useListingFavorites();

  const resolvedFavorites = useMemo<MapPopupFavoriteHandlers>(() => {
    const authenticated = isAuthenticated ?? Boolean(localFavorites.user);
    return {
      favoriteIds: favoriteIds ?? localFavorites.favoriteIds,
      instructorFavoriteIds: instructorFavoriteIds ?? localFavorites.favoriteInstructorIds,
      favoritesEnabled: favoritesEnabled ?? localFavorites.favoritesEnabled,
      isAuthenticated: authenticated,
      favoriteActionLoadingIds: favoriteActionLoadingIds ?? localFavorites.favoriteActionLoadingIds,
      instructorFavoriteActionLoadingIds:
        instructorFavoriteActionLoadingIds ?? localFavorites.favoriteInstructorActionLoadingIds,
      onToggleFavorite: (id, event, accountType) => {
        if (!authenticated) {
          localFavorites.setShowLoginModal(true);
          return;
        }
        if (onToggleFavorite) {
          onToggleFavorite(id, event, accountType);
          return;
        }
        if (accountType === "instructor") {
          void localFavorites.handleInstructorFavoriteToggle(id, event);
          return;
        }
        void localFavorites.handleFavoriteToggle(id, event);
      },
    };
  }, [
    favoriteActionLoadingIds,
    favoriteIds,
    favoritesEnabled,
    instructorFavoriteActionLoadingIds,
    instructorFavoriteIds,
    isAuthenticated,
    localFavorites,
    onToggleFavorite,
  ]);

  const center = useMemo<[number, number]>(() => {
    if (markers.length > 0) {
      return [markers[0].latitude, markers[0].longitude];
    }
    return DEFAULT_CENTER;
  }, [markers]);

  const buildingIcon = useMemo(() => createBuildingMarkerIcon(), []);
  const instructorIcon = useMemo(() => createInstructorMarkerIcon(), []);
  const markerSignature = useMemo(() => buildMarkerClusterSignature(markers), [markers]);

  const wrapperClass =
    variant === "modal"
      ? "institution-locations-map-wrapper institution-locations-map-wrapper--modal"
      : "institution-locations-map-wrapper";
  const mapClass =
    variant === "modal"
      ? "institution-locations-map institution-locations-map--modal"
      : "institution-locations-map";

  return (
    <div className={wrapperClass}>
      {loading ? (
        <div className="institution-locations-map-state">Harita yükleniyor...</div>
      ) : markers.length === 0 && !renderEmptyMap ? (
        <div className="institution-locations-map-state">Konum bilgisi olan sonuç bulunamadı.</div>
      ) : (
        <MapContainer
          key={`institution-locations-leaflet-${mapInstanceId}-${variant}`}
          center={center}
          zoom={10}
          scrollWheelZoom
          className={mapClass}
        >
          <MapInvalidateSize />
          <MapAttributionPrefix />
          <MapBoundsReporter onBoundsChange={onBoundsChange} />
          <MapFocusController focusTarget={focusTarget} />
          <MapDistrictBoundary geoJson={focusTarget?.boundaryGeoJson} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <InstitutionMarkerClusterLayer
            markers={markers}
            markerSignature={markerSignature}
            buildingIcon={buildingIcon}
            instructorIcon={instructorIcon}
            favorites={resolvedFavorites}
          />
        </MapContainer>
      )}
      <LoginModal
        isOpen={localFavorites.showLoginModal}
        onClose={() => localFavorites.setShowLoginModal(false)}
      />
      <AppNoticeBar
        message={localFavorites.favoritesError}
        onDismiss={() => localFavorites.setFavoritesError(null)}
        variant={localFavorites.favoritesError === NOT_INDIVIDUAL_FAVORITES_MESSAGE ? "warning" : "error"}
      />
    </div>
  );
}
