"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getInstitutionDetailHref } from "@/lib/institutions/getInstitutionDetailHref";

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

type InstitutionLocationRow = {
  institution_id: number;
  latitude: number | null;
  longitude: number | null;
  geocode_status: string | null;
};

type InstitutionRow = {
  id: number;
  institution_name: string | null;
  address: string | null;
  official_phone: string | null;
  official_email: string | null;
  slug: string | null;
};

type MarkerItem = {
  id: number;
  slug: string;
  institution_name: string;
  address: string;
  official_phone: string;
  official_email: string;
  latitude: number;
  longitude: number;
};

const DEFAULT_CENTER: [number, number] = [39.9334, 32.8597];

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

export type InstitutionLocationsMapProps = {
  variant?: "inline" | "modal";
};

export default function InstitutionLocationsMap({ variant = "inline" }: InstitutionLocationsMapProps) {
  const router = useRouter();
  const mapInstanceId = useId().replace(/:/g, "");
  const [markers, setMarkers] = useState<MarkerItem[]>([]);
  const [loading, setLoading] = useState(true);
  /** Leaflet tek DOM konteyneri iki kez bağlamasın diye (Strict Mode / modal) haritayı yalnızca mount sonrası çiz */
  const [domReady, setDomReady] = useState(false);
  /** Bir sonraki frame'de MapContainer aç: paneller hazır olsun, appendChild / container reuse hatalarını önler */
  const [leafletMountReady, setLeafletMountReady] = useState(false);

  useLayoutEffect(() => {
    setDomReady(true);
  }, []);

  useEffect(() => {
    if (loading || markers.length === 0 || !domReady) {
      setLeafletMountReady(false);
      return;
    }
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
      setLeafletMountReady(false);
    };
  }, [loading, markers.length, domReady]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();

        const { data: locationData, error: locationError } = await supabase
          .from("institution_locations")
          .select("institution_id, latitude, longitude, geocode_status")
          .eq("geocode_status", "success")
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .limit(5000);

        if (locationError || !Array.isArray(locationData) || cancelled) {
          if (!cancelled) setMarkers([]);
          return;
        }

        const locationRows = locationData as InstitutionLocationRow[];
        const institutionIds = Array.from(
          new Set(
            locationRows
              .map((row) => row.institution_id)
              .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
          )
        );

        if (institutionIds.length === 0) {
          if (!cancelled) setMarkers([]);
          return;
        }

        const { data: institutionData, error: institutionError } = await supabase
          .from("institutions")
          .select("id, institution_name, address, official_phone, official_email, slug")
          .in("id", institutionIds);

        if (institutionError || !Array.isArray(institutionData) || cancelled) {
          if (!cancelled) setMarkers([]);
          return;
        }

        const institutionsById = new Map<number, InstitutionRow>();
        (institutionData as InstitutionRow[]).forEach((row) => {
          institutionsById.set(row.id, row);
        });

        const merged: MarkerItem[] = locationRows
          .map((location) => {
            const institution = institutionsById.get(location.institution_id);
            const lat = Number(location.latitude);
            const lng = Number(location.longitude);
            const slug = String(institution?.slug ?? "").trim();

            if (!institution || !slug || !Number.isFinite(lat) || !Number.isFinite(lng)) {
              return null;
            }

            return {
              id: institution.id,
              slug,
              institution_name: String(institution.institution_name ?? "Kurum").trim() || "Kurum",
              address: String(institution.address ?? "").trim() || "Adres bilgisi bulunamadı",
              official_phone: String(institution.official_phone ?? "").trim(),
              official_email: String(institution.official_email ?? "").trim(),
              latitude: lat,
              longitude: lng,
            };
          })
          .filter((item): item is MarkerItem => Boolean(item));

        if (!cancelled) {
          setMarkers(merged);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
      ) : markers.length === 0 ? (
        <div className="institution-locations-map-state">Konum bilgisi olan kurum bulunamadı.</div>
      ) : !domReady || !leafletMountReady ? (
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

