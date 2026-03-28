"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getInstitutionDetailHref } from "@/lib/institutions/getInstitutionDetailHref";

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

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src,
  iconUrl: markerIcon.src,
  shadowUrl: markerShadow.src,
});

const DEFAULT_CENTER: [number, number] = [39.9334, 32.8597];

export default function InstitutionLocationsMap() {
  const router = useRouter();
  const [markers, setMarkers] = useState<MarkerItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="institution-locations-map-wrapper">
      {loading ? (
        <div className="institution-locations-map-state">Harita yükleniyor...</div>
      ) : markers.length === 0 ? (
        <div className="institution-locations-map-state">Konum bilgisi olan kurum bulunamadı.</div>
      ) : (
        <MapContainer center={center} zoom={10} scrollWheelZoom={false} className="institution-locations-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MarkerClusterGroup chunkedLoading>
            {markers.map((item) => (
              <Marker
                key={item.id}
                position={[item.latitude, item.longitude]}
                eventHandlers={{
                  click: () => {
                    router.push(getInstitutionDetailHref({ slug: item.slug }));
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                  <div className="institution-locations-tooltip">
                    <strong>{item.institution_name}</strong>
                    <span>{item.address}</span>
                    {item.official_phone ? <span>Tel: {item.official_phone}</span> : null}
                    {item.official_email ? <span>E-posta: {item.official_email}</span> : null}
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

