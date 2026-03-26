"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Clock, Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";
import { getInstitutionDetailHref } from "@/lib/institutions/getInstitutionDetailHref";

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
}

export default function CategoryResultsCard({
  id,
  name,
  description,
  location,
  price,
  ageRange,
  rating,
  reviewCount,
  badges,
  logoInitial = "M",
  logoColor = "#6d5dfc",
  imageUrl,
  slug,
  source,
}: CategoryResultsCardProps) {
  const priceText = typeof price === "number" ? `${price.toLocaleString("tr-TR")} ₺ / ay` : price;
  
  const institutionSlug = String(slug ?? "").trim();

  const cardContent = (
    <>
      <div className="category-results-card-logo-section">
        <div className="category-results-card-logo" style={{ backgroundColor: imageUrl ? 'transparent' : logoColor }}>
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
      
      <div className="category-results-card-content">
        <div className="category-results-card-header">
          <div className="category-results-card-rating">
            <Star size={14} fill="currentColor" />
            <span>{rating}</span>
            <span className="category-results-card-rating-count">({reviewCount})</span>
          </div>
        </div>

        <h3 className="category-results-card-title">{name}</h3>
        
        <p className="category-results-card-description">{description}</p>

        <div className="category-results-card-meta">
          <div className="category-results-card-meta-item">
            <MapPin size={16} />
            <span>{location}</span>
          </div>
          <div className="category-results-card-meta-item">
            <span className="category-results-card-meta-icon">₺</span>
            <span>{priceText}</span>
          </div>
          <div className="category-results-card-meta-item">
            <Clock size={16} />
            <span>{ageRange}</span>
          </div>
        </div>

        <div className="category-results-card-actions">
          <span className="category-results-card-details-link">Detayları İncele</span>
          <Button 
            className="category-results-card-contact-button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            İletişime Geç
            <ArrowRight size={16} />
          </Button>
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

