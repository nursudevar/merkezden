"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Separator } from "@/components/ui";
import type { InstitutionMapMarker } from "@/lib/institutionMapMarkers";
import "@/styles/components/institution-locations-map.scss";

const InstitutionLocationsMap = dynamic(
  () => import("@/components/map/InstitutionLocationsMap"),
  { ssr: false },
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
        <InstitutionLocationsMap
          key={`${mapKeyPrefix}-sidebar`}
          markers={markers}
          loading={loading}
        />
      </div>
      {showSeparatorAfter ? <Separator /> : null}
    </>
  );
}
