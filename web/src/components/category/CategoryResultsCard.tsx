"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, MapPin, GraduationCap, UserRound } from "lucide-react";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";
import { OKUL_CATEGORY_SLUG } from "@/lib/schoolInstitutionTypes";
import { InstitutionCompareToggleButton } from "@/components/compare/InstitutionCompareToggleButton";
import { InstructorCompareToggleButton } from "@/components/compare/InstructorCompareToggleButton";

interface CategoryResultsCardProps {
  id: string;
  resultType?: "institution" | "instructor";
  name: string;
  description: string;
  location: string;
  price: string | number;
  ageRange: string;
  rating: number;
  reviewCount: number;
  badges: string[];
  logoInitial?: string;
  logoColor?: string;
  imageUrl?: string;
  slug?: string;
  source?: string | null;
  subcategoryName?: string;
  categorySlug?: string;
  detailUrl?: string;
  instructorTitle?: string;
  instructorBranch?: string;
  priceRange?: string;
  institutionId?: number;
  instructorId?: number;
  isFavorite?: boolean;
  isFavoriteActionLoading?: boolean;
  favoritesEnabled?: boolean;
  isAuthenticated?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
}

export default function CategoryResultsCard({
  id,
  resultType = "institution",
  name,
  location,
  badges,
  logoInitial = "M",
  logoColor = "#6d5dfc",
  imageUrl,
  slug,
  source,
  subcategoryName,
  categorySlug,
  detailUrl,
  instructorTitle,
  instructorBranch,
  priceRange,
  institutionId,
  instructorId,
  isFavorite = false,
  isFavoriteActionLoading = false,
  favoritesEnabled = false,
  isAuthenticated = false,
  onToggleFavorite,
}: CategoryResultsCardProps) {
  const isInstructor = resultType === "instructor";
  const institutionSlug = String(slug ?? "").trim();
  const subcategoryLabel = String(subcategoryName ?? "").trim();
  const showInstitutionType =
    String(categorySlug ?? "").trim() === OKUL_CATEGORY_SLUG && subcategoryLabel.length > 0;
  const instructorTitleText = String(instructorTitle ?? "").trim();
  const instructorBranchText = String(instructorBranch ?? "").trim();
  const instructorPriceText = String(priceRange ?? "").trim();
  const locationText = String(location ?? "").trim();
  const numericInstitutionId =
    typeof institutionId === "number" && Number.isInteger(institutionId) && institutionId > 0
      ? institutionId
      : null;
  const numericInstructorId =
    typeof instructorId === "number" && Number.isInteger(instructorId) && instructorId > 0
      ? instructorId
      : null;
  const instructorSlug =
    institutionSlug || (numericInstructorId != null ? String(numericInstructorId) : "");
  const canCompareInstitution =
    !isInstructor && numericInstitutionId != null && institutionSlug.length > 0;
  const canCompareInstructor =
    isInstructor && numericInstructorId != null && instructorSlug.length > 0;
  const canFavorite =
    Boolean(onToggleFavorite) &&
    (isInstructor ? numericInstructorId != null : numericInstitutionId != null);
  const href = isInstructor
    ? String(detailUrl ?? "").trim()
    : institutionSlug
      ? getInstitutionDetailHref({ id, slug: institutionSlug, source: source ?? null })
      : "";

  const cardContent = (
    <>
      <div className="category-results-card-top">
        <div className="category-results-card-logo-section">
          <div
            className="category-results-card-logo"
            style={{ backgroundColor: imageUrl ? "transparent" : logoColor }}
          >
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={name}
                fill
                className="category-results-card-logo-image"
                sizes="(max-width: 640px) 60px, 40vw"
                unoptimized
              />
            ) : (
              <span className="category-results-card-logo-fallback">{logoInitial}</span>
            )}
          </div>
          {!isInstructor && badges.length > 0 ? (
            <div className="category-results-card-badges">
              {badges.map((badge, index) => (
                <span key={index} className="category-results-card-badge">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="category-results-card-header-info">
          <h3 className="category-results-card-title">{name}</h3>
          {isInstructor ? (
            <div className="category-results-card-instructor-meta">
              {instructorBranchText ? (
                <span className="category-results-card-instructor-branch">{instructorBranchText}</span>
              ) : null}
              <span className="category-results-card-badge category-results-card-badge--type">
                Bireysel Eğitmen
              </span>
            </div>
          ) : null}
          {showInstitutionType ? (
            <span className="category-results-card-subcategory-badge">
              <GraduationCap size={12} />
              {subcategoryLabel}
            </span>
          ) : null}
          {locationText ? (
            <div className="category-results-card-location">
              <MapPin size={14} />
              <span>{locationText}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="category-results-card-content">
        {isInstructor && instructorTitleText ? (
          <p className="category-results-card-description category-results-card-description--instructor-title">
            <UserRound size={14} aria-hidden />
            <span>{instructorTitleText}</span>
          </p>
        ) : null}
        {isInstructor && instructorPriceText ? (
          <p className="category-results-card-price">{instructorPriceText}</p>
        ) : null}
        {canFavorite ? (
          <button
            type="button"
            className="category-results-card-favorite"
            aria-label={isFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}
            disabled={isFavoriteActionLoading || (isAuthenticated && !favoritesEnabled)}
            onClick={(e) => {
              onToggleFavorite?.(e);
            }}
          >
            <Heart
              className={
                isFavorite
                  ? "heart-favorite-icon heart-favorite-icon--active"
                  : "heart-favorite-icon"
              }
            />
          </button>
        ) : null}
        {canCompareInstitution ? (
          <InstitutionCompareToggleButton
            className="institution-compare-toggle--category"
            item={{
              id: numericInstitutionId,
              name,
              slug: institutionSlug,
              imageUrl,
            }}
          />
        ) : null}
        {canCompareInstructor ? (
          <InstructorCompareToggleButton
            className="instructor-compare-toggle--category"
            item={{
              id: numericInstructorId,
              name,
              slug: instructorSlug,
              imageUrl,
            }}
          />
        ) : null}
      </div>
    </>
  );

  const cardClassName = isInstructor
    ? "category-results-card"
    : "category-results-card category-results-card--institution";

  if (href) {
    return (
      <Link
        href={href}
        className={cardClassName}
        aria-label={`${name} detayları`}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <article className={cardClassName}>
      {cardContent}
    </article>
  );
}
