"use client";

import { useEffect, useMemo, useState } from "react";
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

const MAP_CATEGORY_FILTERS = [
  "Hepsi",
  "Okul",
  "Kurs & Sınava Hazırlık",
  "Spor",
  "Sanat",
  "Yabancı Dil",
  "Kişisel Gelişim",
  "Mesleki Eğitim",
  "Özel Eğitim",
  "Patili Dostlar",
];

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
  const [selectedMapCategory, setSelectedMapCategory] = useState("Hepsi");

  const modalMarkers = useMemo(
    () => markers.filter((marker) => markerMatchesCategory(marker, selectedMapCategory)),
    [markers, selectedMapCategory],
  );

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
            <div className="institution-map-modal-body">
              <div className="map-modal-category-filters" aria-label="Harita kategori filtreleri">
                {MAP_CATEGORY_FILTERS.map((category) => {
                  const isActive = selectedMapCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      className={`map-modal-category-chip${isActive ? " map-modal-category-chip--active" : ""}`}
                      aria-pressed={isActive}
                      onClick={() => setSelectedMapCategory(category)}
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
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
