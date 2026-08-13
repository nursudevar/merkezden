"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GraduationCap, Heart } from "lucide-react";
import type { FeaturedInstructorItem } from "@/lib/publicInstructorSearch";
import { InstructorCompareToggleButton } from "@/components/compare/InstructorCompareToggleButton";

export function FeaturedInstructorCardLink({
  instructor,
  isDuplicate,
  isFavorite,
  isActionLoading,
  favoritesEnabled,
  isAuthenticated,
  canRenderImage,
  onToggleFavorite,
  onImageError,
}: {
  instructor: FeaturedInstructorItem;
  isDuplicate?: boolean;
  isFavorite?: boolean;
  isActionLoading?: boolean;
  favoritesEnabled?: boolean;
  isAuthenticated?: boolean;
  canRenderImage: boolean;
  onToggleFavorite?: (instructorId: number, e: React.MouseEvent) => void;
  onImageError: () => void;
}) {
  const canCompare =
    !isDuplicate &&
    Number.isInteger(instructor.id) &&
    instructor.id > 0 &&
    Boolean(String(instructor.slug ?? "").trim());

  return (
    <Link
      href={instructor.href}
      className="featured-institution-card featured-institution-card--instructor"
      aria-label={`${instructor.name} detayları`}
      aria-hidden={isDuplicate}
      tabIndex={isDuplicate ? -1 : undefined}
    >
      <div className="featured-institution-image-wrapper">
        {canRenderImage ? (
          <img
            src={instructor.imageUrl}
            alt={instructor.name}
            className="featured-institution-image"
            onError={onImageError}
          />
        ) : (
          <div className="featured-institution-placeholder" aria-label="Profil fotoğrafı bulunmuyor">
            <GraduationCap size={28} />
          </div>
        )}
        <div className="featured-institution-overlay" />
        {onToggleFavorite ? (
          <motion.button
            type="button"
            aria-label={isFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}
            className="featured-institution-favorite"
            whileTap={{ scale: 0.9 }}
            disabled={Boolean(isActionLoading) || (Boolean(isAuthenticated) && !favoritesEnabled)}
            onClick={(e) => {
              onToggleFavorite(instructor.id, e);
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
        ) : null}
        {canCompare ? (
          <InstructorCompareToggleButton
            className="instructor-compare-toggle--overlay"
            item={{
              id: instructor.id,
              name: instructor.name,
              slug: instructor.slug,
              imageUrl: instructor.imageUrl || undefined,
            }}
          />
        ) : null}
      </div>
      <div className="featured-institution-content">
        <span className="featured-institution-body-category">
          {instructor.bodyMainCategory || "Bireysel Eğitmen"}
        </span>
        <h3 className="featured-institution-name">{instructor.name}</h3>
        <div className="featured-institution-location">
          <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M6 0C2.69 0 0 2.69 0 6C0 10.5 6 14 6 14C6 14 12 10.5 12 6C12 2.69 9.31 0 6 0ZM6 8.25C4.76 8.25 3.75 7.24 3.75 6C3.75 4.76 4.76 3.75 6 3.75C7.24 3.75 8.25 4.76 8.25 6C8.25 7.24 7.24 8.25 6 8.25Z"
              fill="currentColor"
            />
          </svg>
          <span>{instructor.bodyLocation}</span>
        </div>
      </div>
    </Link>
  );
}
