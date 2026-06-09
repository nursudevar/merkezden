"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { X } from "lucide-react";
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
  const [showInstitutionMapModal, setShowInstitutionMapModal] = useState(false);

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
            onClick={() => setShowInstitutionMapModal(true)}
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
            <div className="institution-map-modal-body">
              <InstitutionLocationsMap
                key={`${mapKeyPrefix}-modal`}
                variant="modal"
                markers={markers}
                loading={loading}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
