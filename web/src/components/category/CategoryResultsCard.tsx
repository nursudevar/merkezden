"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, GraduationCap } from "lucide-react";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";

interface CategoryResultsCardProps {
  id: string;
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
}

const DESCRIPTION_MAX_LENGTH = 100;

function truncateDescription(value: string, max = DESCRIPTION_MAX_LENGTH): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}...`;
}

export default function CategoryResultsCard({
  id,
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
}: CategoryResultsCardProps) {
  const institutionSlug = String(slug ?? "").trim();
  const truncatedDescription = truncateDescription(description);
  const subcategoryLabel = String(subcategoryName ?? "").trim();

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
          <div className="category-results-card-badges">
            {badges.map((badge, index) => (
              <span key={index} className="category-results-card-badge">
                {badge}
              </span>
            ))}
          </div>
        </div>

        <div className="category-results-card-header-info">
          <h3 className="category-results-card-title">{name}</h3>
          {subcategoryLabel ? (
            <span className="category-results-card-subcategory-badge">
              <GraduationCap size={12} />
              {subcategoryLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="category-results-card-content">
        {truncatedDescription ? (
          <p className="category-results-card-description">{truncatedDescription}</p>
        ) : null}

        <div className="category-results-card-location">
          <MapPin size={14} />
          <span>{location}</span>
        </div>
      </div>
    </>
  );

  if (institutionSlug) {
    return (
      <Link
        href={getInstitutionDetailHref({ id, slug: institutionSlug, source: source ?? null })}
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
