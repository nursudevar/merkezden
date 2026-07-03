"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, GraduationCap, UserRound } from "lucide-react";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";

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
  detailUrl?: string;
  instructorTitle?: string;
  instructorBranch?: string;
  priceRange?: string;
}

export default function CategoryResultsCard({
  id,
  resultType = "institution",
  name,
  description,
  location,
  badges,
  logoInitial = "M",
  logoColor = "#6d5dfc",
  imageUrl,
  slug,
  source,
  subcategoryName,
  detailUrl,
  instructorTitle,
  instructorBranch,
  priceRange,
}: CategoryResultsCardProps) {
  const isInstructor = resultType === "instructor";
  const institutionSlug = String(slug ?? "").trim();
  const descriptionText = String(description ?? "").trim();
  const subcategoryLabel = String(subcategoryName ?? "").trim();
  const instructorTitleText = String(instructorTitle ?? "").trim();
  const instructorBranchText = String(instructorBranch ?? "").trim();
  const instructorPriceText = String(priceRange ?? "").trim();
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
                sizes="80px"
                unoptimized
              />
            ) : (
              logoInitial
            )}
          </div>
          {!isInstructor ? (
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
          {!isInstructor && subcategoryLabel ? (
            <span className="category-results-card-subcategory-badge">
              <GraduationCap size={12} />
              {subcategoryLabel}
            </span>
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
        {!isInstructor && descriptionText ? (
          <p className="category-results-card-description">{descriptionText}</p>
        ) : null}

        <div className="category-results-card-location">
          <MapPin size={14} />
          <span>{location}</span>
        </div>
        {isInstructor && instructorPriceText ? (
          <p className="category-results-card-price">{instructorPriceText}</p>
        ) : null}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="category-results-card"
        aria-label={`${name} detayları`}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <article className="category-results-card">
      {cardContent}
    </article>
  );
}
