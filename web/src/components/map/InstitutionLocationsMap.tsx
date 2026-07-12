"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
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

function MapInvalidateSize() {
  const map = useMap();
  useEffect(() => {
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        try {
          map.invalidateSize();
        } catch {
          /* map teardown */
        }
      });
    });
    const t = window.setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {
        /* map teardown */
      }
    }, 150);
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(t);
    };
  }, [map]);
  return null;
}

function MapBoundsReporter({
  onBoundsChange,
}: {
  onBoundsChange?: (bounds: InstitutionMapViewportBounds) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      onBoundsChange?.(toViewportBounds(map.getBounds()));
    },
    zoomend: () => {
      onBoundsChange?.(toViewportBounds(map.getBounds()));
    },
  });

  useEffect(() => {
    if (!onBoundsChange) return;
    const raf = window.requestAnimationFrame(() => {
      onBoundsChange(toViewportBounds(map.getBounds()));
    });
    return () => window.cancelAnimationFrame(raf);
  }, [map, onBoundsChange]);

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
    try {
      map.flyTo([lat, lng], zoom, { duration: 0.85 });
    } catch {
      /* map teardown */
    }
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
  /** Bir sonraki frame'de MapContainer aç: paneller hazır olsun, appendChild / container reuse hatalarını önler */
  const [leafletMountReady, setLeafletMountReady] = useState(false);
  const canRenderMap = !loading && (markers.length > 0 || renderEmptyMap);

  useEffect(() => {
    if (!canRenderMap) return;
    let cancelled = false;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        if (!cancelled) setLeafletMountReady(true);
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [canRenderMap]);

  const center = useMemo<[number, number]>(() => {
    if (markers.length > 0) {
      return [markers[0].latitude, markers[0].longitude];
    }
    return DEFAULT_CENTER;
  }, [markers]);

  const buildingIcon = useMemo(() => createBuildingMarkerIcon(), []);

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
      ) : !leafletMountReady ? (
        <div className="institution-locations-map-state">Harita yükleniyor...</div>
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
          <MarkerClusterGroup chunkedLoading iconCreateFunction={createClusterIcon}>
            {markers.map((item) => (
              <Marker
                key={item.id}
                position={[item.latitude, item.longitude]}
                icon={buildingIcon}
                eventHandlers={{
                  click: () => {
                    router.push(getInstitutionDetailHref({ slug: item.slug }));
                  },
                }}
              >
                <Tooltip
                  direction="top"
                  offset={[0, -10]}
                  opacity={1}
                  className="institution-locations-tooltip-shell"
                >
                  <div className="institution-locations-tooltip">
                    <p className="institution-locations-tooltip-title">{item.institution_name}</p>
                    <p className="institution-locations-tooltip-address">{item.address}</p>
                    {item.official_phone ? (
                      <p className="institution-locations-tooltip-meta">Tel: {item.official_phone}</p>
                    ) : null}
                    {item.official_email ? (
                      <p className="institution-locations-tooltip-meta">E-posta: {item.official_email}</p>
                    ) : null}
                  </div>
                </Tooltip>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      )}
    </div>
  );
}
