"use client";

import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";
import type { InstitutionMapMarker } from "@/lib/institutionMapMarkers";

/** Inline SVG building — avoids broken Leaflet default PNG paths in Next.js bundler */
const BUILDING_MARKER_SVG = `
<div class="institution-map-pin-inner" aria-hidden="true">
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 22V9.5l6-4 6 4V22" />
    <path d="M10 22v-5h4v5" />
    <path d="M9 13h.01" /><path d="M15 13h.01" />
    <path d="M9 17h.01" /><path d="M15 17h.01" />
  </svg>
</div>
`;

function createBuildingMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: "institution-map-marker-leaflet",
    html: BUILDING_MARKER_SVG,
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
    iconCreateFunction?: (cluster: { getChildCount: () => number }) => L.DivIcon;
  },
): LeafletMarkerClusterGroup {
  const MarkerClusterGroupCtor = (
    L as typeof L & {
      MarkerClusterGroup: new (opts?: {
        chunkedLoading?: boolean;
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

function buildMarkerTooltipHtml(item: InstitutionMapMarker): string {
  const phone = item.official_phone
    ? `<p class="institution-locations-tooltip-meta">Tel: ${escapeTooltipHtml(item.official_phone)}</p>`
    : "";
  const email = item.official_email
    ? `<p class="institution-locations-tooltip-meta">E-posta: ${escapeTooltipHtml(item.official_email)}</p>`
    : "";
  return `<div class="institution-locations-tooltip"><p class="institution-locations-tooltip-title">${escapeTooltipHtml(item.institution_name)}</p><p class="institution-locations-tooltip-address">${escapeTooltipHtml(item.address)}</p>${phone}${email}</div>`;
}

function buildMarkerClusterSignature(markers: InstitutionMapMarker[]): string {
  if (markers.length === 0) return "";
  let hash = 2166136261;
  for (const marker of markers) {
    hash ^= marker.id;
    hash = Math.imul(hash, 16777619);
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

function InstitutionMarkerClusterLayer({
  markers,
  markerSignature,
  buildingIcon,
  onNavigate,
}: {
  markers: InstitutionMapMarker[];
  markerSignature: string;
  buildingIcon: L.DivIcon;
  onNavigate: (slug: string) => void;
}) {
  const map = useMap();
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  useEffect(() => {
    if (!markerSignature || !isMapContainerLive(map)) return;

    const cluster = createLeafletMarkerClusterGroup({
      chunkedLoading: true,
      iconCreateFunction: createClusterIcon,
    });

    const leafletMarkers = markersRef.current.map((item) => {
      const marker = L.marker([item.latitude, item.longitude], { icon: buildingIcon });
      marker.on("click", () => {
        onNavigateRef.current(item.slug);
      });
      marker.on("mouseover", () => {
        if (!marker.getTooltip()) {
          marker.bindTooltip(buildMarkerTooltipHtml(item), {
            direction: "top",
            offset: [0, -10],
            opacity: 1,
            className: "institution-locations-tooltip-shell",
          });
        }
        marker.openTooltip();
      });
      marker.on("mouseout", () => {
        marker.closeTooltip();
      });
      return marker;
    });

    cluster.addLayers(leafletMarkers);
    map.addLayer(cluster);

    return () => {
      try {
        if (map.hasLayer(cluster)) {
          map.removeLayer(cluster);
        }
        cluster.clearLayers();
      } catch {
        /* map teardown */
      }
    };
  }, [map, markerSignature, buildingIcon]);

  return null;
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

function MapFocusController({
  focusTarget,
}: {
  focusTarget?: InstitutionMapFocusTarget | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusTarget) return;

    const lat = Number(focusTarget.lat);
    const lng = Number(focusTarget.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const zoom = Number.isFinite(Number(focusTarget.zoom)) ? Number(focusTarget.zoom) : 13;

    let cancelled = false;
    const applyFocus = () => {
      if (cancelled || !isMapContainerLive(map)) return;
      try {
        stopMapAnimations(map);
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
  }, [map, focusTarget?.token, focusTarget?.lat, focusTarget?.lng, focusTarget?.zoom]);

  return null;
}

export type InstitutionMapFocusTarget = {
  lat: number;
  lng: number;
  zoom?: number;
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
};

export default function InstitutionLocationsMap({
  variant = "inline",
  markers,
  loading = false,
  renderEmptyMap = false,
  onBoundsChange,
  focusTarget = null,
}: InstitutionLocationsMapProps) {
  const router = useRouter();
  const mapInstanceId = useId().replace(/:/g, "");
  const canRenderMap = !loading && (markers.length > 0 || renderEmptyMap);

  const center = useMemo<[number, number]>(() => {
    if (markers.length > 0) {
      return [markers[0].latitude, markers[0].longitude];
    }
    return DEFAULT_CENTER;
  }, [markers]);

  const buildingIcon = useMemo(() => createBuildingMarkerIcon(), []);
  const markerSignature = useMemo(() => buildMarkerClusterSignature(markers), [markers]);
  const handleMarkerNavigate = useCallback(
    (slug: string) => {
      router.push(getInstitutionDetailHref({ slug }));
    },
    [router],
  );

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
        <div className="institution-locations-map-state">Konum bilgisi olan kurum bulunamadı.</div>
      ) : (
        <MapContainer
          key={`institution-locations-leaflet-${mapInstanceId}-${variant}`}
          center={center}
          zoom={10}
          scrollWheelZoom
          className={mapClass}
        >
          <MapInvalidateSize />
          <MapBoundsReporter onBoundsChange={onBoundsChange} />
          <MapFocusController focusTarget={focusTarget} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <InstitutionMarkerClusterLayer
            markers={markers}
            markerSignature={markerSignature}
            buildingIcon={buildingIcon}
            onNavigate={handleMarkerNavigate}
          />
        </MapContainer>
      )}
    </div>
  );
}
