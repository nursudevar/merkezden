"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import type L from "leaflet";
import { InstitutionCompareToggleButton } from "@/components/compare/InstitutionCompareToggleButton";
import { InstructorCompareToggleButton } from "@/components/compare/InstructorCompareToggleButton";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";
import {
  getMapMarkerAccountType,
  type InstitutionMapMarker,
} from "@/lib/institutionMapMarkers";
import { instructorDetailHref } from "@/lib/instructorMapMarkers";

function relayoutLeafletPopup(popup: L.Popup) {
  const layoutPopup = popup as L.Popup & {
    _updateLayout?: () => void;
    _updatePosition?: () => void;
    _adjustPan?: () => void;
  };
  layoutPopup._updateLayout?.();
  layoutPopup._updatePosition?.();
  layoutPopup._adjustPan?.();
}

export type MapPopupFavoriteHandlers = {
  favoriteIds: Set<number>;
  instructorFavoriteIds: Set<number>;
  favoritesEnabled: boolean;
  isAuthenticated: boolean;
  favoriteActionLoadingIds: Set<number>;
  instructorFavoriteActionLoadingIds: Set<number>;
  onToggleFavorite: (
    id: number,
    e: React.MouseEvent,
    accountType: "institution" | "instructor",
  ) => void;
};

export function InstitutionMapMarkerPopupActions({
  marker,
  favorites,
  popup,
}: {
  marker: InstitutionMapMarker;
  favorites: MapPopupFavoriteHandlers;
  popup: L.Popup;
}) {
  useEffect(() => {
    relayoutLeafletPopup(popup);
  }, [popup]);

  const isInstructor = getMapMarkerAccountType(marker) === "instructor";
  const detailHref = isInstructor
    ? instructorDetailHref(marker)
    : getInstitutionDetailHref({ slug: marker.slug });
  const slug = String(marker.slug ?? "").trim() || (isInstructor ? String(marker.id) : "");
  const canCompare = marker.id > 0 && slug.length > 0;
  const isFavorite = isInstructor
    ? favorites.instructorFavoriteIds.has(marker.id)
    : favorites.favoriteIds.has(marker.id);
  const isActionLoading = isInstructor
    ? favorites.instructorFavoriteActionLoadingIds.has(marker.id)
    : favorites.favoriteActionLoadingIds.has(marker.id);
  const imageUrl = String(marker.logoUrl ?? "").trim() || undefined;

  const stopMapEvent = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      className="institution-locations-popup-actions"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <Link href={detailHref} className="institution-locations-popup-detail">
        Detayları Gör
      </Link>
      <button
        type="button"
        className="institution-locations-popup-icon-btn"
        aria-label={isFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}
        disabled={isActionLoading || (favorites.isAuthenticated && !favorites.favoritesEnabled)}
        onClick={(event) => {
          stopMapEvent(event);
          favorites.onToggleFavorite(marker.id, event, isInstructor ? "instructor" : "institution");
        }}
      >
        <Heart
          className={
            isFavorite ? "heart-favorite-icon heart-favorite-icon--active" : "heart-favorite-icon"
          }
        />
      </button>
      {canCompare && !isInstructor ? (
        <InstitutionCompareToggleButton
          className="institution-compare-toggle--map-popup"
          item={{
            id: marker.id,
            name: marker.institution_name,
            slug,
            imageUrl,
          }}
        />
      ) : null}
      {canCompare && isInstructor ? (
        <InstructorCompareToggleButton
          className="instructor-compare-toggle--map-popup"
          item={{
            id: marker.id,
            name: marker.institution_name,
            slug,
            imageUrl,
          }}
        />
      ) : null}
    </div>
  );
}
