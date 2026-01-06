"use client";

import { MapPin, Clock, Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";

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
}

export default function CategoryResultsCard({
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
}: CategoryResultsCardProps) {
  const priceText = typeof price === "number" ? `${price.toLocaleString("tr-TR")} ₺ / ay` : price;

  return (
    <article className="category-results-card">
      <div className="category-results-card-logo" style={{ backgroundColor: logoColor }}>
        {logoInitial}
      </div>
      
      <div className="category-results-card-content">
        <div className="category-results-card-header">
          <div className="category-results-card-badges">
            {badges.map((badge, index) => (
              <span key={index} className="category-results-card-badge">
                {badge}
              </span>
            ))}
          </div>
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
          <button className="category-results-card-details-link">Detayları İncele</button>
          <Button className="category-results-card-contact-button">
            İletişime Geç
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </article>
  );
}

