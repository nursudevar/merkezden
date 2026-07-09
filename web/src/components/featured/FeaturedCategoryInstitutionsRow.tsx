"use client";

import type { FeaturedInstitution } from "./featuredInstitutions";
import { FeaturedInstitutionCardLink } from "./FeaturedInstitutionCardLink";

export function FeaturedCategoryInstitutionsRow({
  sectionId,
  heading,
  institutions,
  onToggleFavorite,
  favoriteIds,
  favoritesEnabled,
  favoriteActionLoadingIds,
  isAuthenticated,
  brokenFeaturedImageIds,
  setBrokenFeaturedImageIds,
}: {
  sectionId: string;
  heading: string;
  institutions: FeaturedInstitution[];
  onToggleFavorite: (institutionId: number, e: React.MouseEvent) => void;
  favoriteIds: Set<number>;
  favoritesEnabled: boolean;
  favoriteActionLoadingIds: Set<number>;
  isAuthenticated: boolean;
  brokenFeaturedImageIds: Set<number>;
  setBrokenFeaturedImageIds: React.Dispatch<React.SetStateAction<Set<number>>>;
}) {
  if (institutions.length === 0) return null;

  return (
    <section className="featured-category-section" aria-labelledby={sectionId}>
      <h2 className="featured-category-section-title" id={sectionId}>
        {heading}
      </h2>
      <div className="featured-category-row-outer">
        <div className="featured-category-row-scroller">
          {institutions.map((institution) => {
            const key = `cat-${heading}-${institution.id}`;
            const isFavorite = favoriteIds.has(institution.id);
            const isActionLoading = favoriteActionLoadingIds.has(institution.id);
            const canRenderImage = Boolean(institution.imageUrl) && !brokenFeaturedImageIds.has(institution.id);
            return (
              <FeaturedInstitutionCardLink
                key={key}
                institution={institution}
                isFavorite={isFavorite}
                isActionLoading={isActionLoading}
                favoritesEnabled={favoritesEnabled}
                isAuthenticated={isAuthenticated}
                canRenderImage={canRenderImage}
                onToggleFavorite={onToggleFavorite}
                onImageError={() =>
                  setBrokenFeaturedImageIds((prev) => {
                    const next = new Set(prev);
                    next.add(institution.id);
                    return next;
                  })
                }
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
