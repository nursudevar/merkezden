"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Separator } from "@/components/ui";
import type { InstitutionMapMarker } from "@/lib/institutionMapMarkers";
import "@/styles/components/institution-locations-map.scss";

function InstitutionMapLoadingPlaceholder() {
  return (
    <div className="institution-locations-map-wrapper">
      <div className="institution-locations-map-state">Harita yükleniyor...</div>
    </div>
  );
}

const InstitutionLocationsMap = dynamic(
  () => import("@/components/map/InstitutionLocationsMap"),
  {
    ssr: false,
    loading: () => <InstitutionMapLoadingPlaceholder />,
  },
);

export type InstitutionMapSearchSectionProps = {
  markers: InstitutionMapMarker[];
  loading?: boolean;
  mapKeyPrefix?: string;
  /** Ana sayfa sol panelde harita ile sonraki filtre arasında ayırıcı */
  showSeparatorAfter?: boolean;
};

export function InstitutionMapSearchSection({
  markers,
  loading = false,
  mapKeyPrefix = "institution-map",
  showSeparatorAfter = false,
}: InstitutionMapSearchSectionProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="filter-section filter-section-map">
        <div className="filter-section-map-heading">
          <div className="filter-section-title filter-section-title--map-row">
            <Image src="/images/map.svg" alt="Kurum Haritası" width={20} height={20} />
            <span>Kurum Haritası</span>
          </div>
          <Link href="/haritada-ara" className="institution-map-detail-link">
            Haritada Ara
          </Link>
        </div>
        {mounted ? (
          <InstitutionLocationsMap
            key={`${mapKeyPrefix}-sidebar`}
            markers={markers}
            loading={loading}
          />
        ) : (
          <InstitutionMapLoadingPlaceholder />
        )}
      </div>
      {showSeparatorAfter ? <Separator /> : null}
    </>
  );
}
