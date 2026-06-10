"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";
import type { FeaturedInstructorItem } from "@/lib/publicInstructorSearch";

export function FeaturedInstructorCardLink({
  instructor,
  isDuplicate,
  canRenderImage,
  onImageError,
}: {
  instructor: FeaturedInstructorItem;
  isDuplicate?: boolean;
  canRenderImage: boolean;
  onImageError: () => void;
}) {
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
