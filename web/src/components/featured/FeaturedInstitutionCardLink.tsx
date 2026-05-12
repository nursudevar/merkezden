"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, Heart } from "lucide-react";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";
import type { FeaturedInstitution } from "./featuredInstitutionTypes";

export function FeaturedInstitutionCardLink({
  institution,
  isDuplicate,
  isFavorite,
  isActionLoading,
  favoritesEnabled,
  isAuthenticated,
  canRenderImage,
  onToggleFavorite,
  onImageError,
}: {
  institution: FeaturedInstitution;
  isDuplicate?: boolean;
  isFavorite: boolean;
  isActionLoading: boolean;
  favoritesEnabled: boolean;
  isAuthenticated: boolean;
  canRenderImage: boolean;
  onToggleFavorite: (institutionId: number, e: React.MouseEvent) => void;
  onImageError: () => void;
}) {
  return (
    <Link
      href={getInstitutionDetailHref({
        id: institution.id,
        slug: institution.slug,
        source: institution.source || undefined,
      })}
      className="featured-institution-card"
      aria-label={`${institution.name} detayları`}
      aria-hidden={isDuplicate}
      tabIndex={isDuplicate ? -1 : undefined}
    >
      <div className="featured-institution-image-wrapper">
        {canRenderImage ? (
          <img
            src={institution.imageUrl}
            alt={institution.name}
            className="featured-institution-image"
            onError={onImageError}
          />
        ) : (
          <div className="featured-institution-placeholder" aria-label="Logo bulunmuyor">
            <Building2 size={28} />
          </div>
        )}
        <div className="featured-institution-overlay" />
        <motion.button
          type="button"
          aria-label={isFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}
          className="featured-institution-favorite"
          whileTap={{ scale: 0.9 }}
          disabled={isActionLoading || (isAuthenticated && !favoritesEnabled)}
          onClick={(e) => {
            onToggleFavorite(institution.id, e);
          }}
        >
          <motion.div
            animate={{ scale: isFavorite ? [1, 1.3, 1] : 1 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <Heart
              className={
                isFavorite ? "heart-favorite-icon heart-favorite-icon--active" : "heart-favorite-icon"
              }
            />
          </motion.div>
        </motion.button>
      </div>
      <div className="featured-institution-content">
        <span className="featured-institution-body-category">{institution.bodyMainCategory}</span>
        <h3 className="featured-institution-name">{institution.name}</h3>
        <p className="featured-institution-subcategory">{institution.bodySubCategory}</p>
        <div className="featured-institution-location">
          <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M6 0C2.69 0 0 2.69 0 6C0 10.5 6 14 6 14C6 14 12 10.5 12 6C12 2.69 9.31 0 6 0ZM6 8.25C4.76 8.25 3.75 7.24 3.75 6C3.75 4.76 4.76 3.75 6 3.75C7.24 3.75 8.25 4.76 8.25 6C8.25 7.24 7.24 8.25 6 8.25Z"
              fill="currentColor"
            />
          </svg>
          <span>{institution.bodyLocation}</span>
        </div>
      </div>
    </Link>
  );
}
