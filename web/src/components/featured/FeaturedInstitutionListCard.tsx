"use client";

import Link from "next/link";
import Image from "next/image";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";

export type FeaturedInstitutionListItem = {
  id: number;
  name: string;
  imageUrl: string;
  slug: string;
  source: string;
  district: string;
};

export function FeaturedInstitutionListCard({
  institution,
  canRenderImage,
  onImageError,
}: {
  institution: FeaturedInstitutionListItem;
  canRenderImage: boolean;
  onImageError: () => void;
}) {
  const logoInitial = institution.name.trim().charAt(0).toUpperCase() || "M";

  return (
    <Link
      href={getInstitutionDetailHref({
        id: institution.id,
        slug: institution.slug,
        source: institution.source || undefined,
      })}
      className="featured-institutions-list-card"
      aria-label={`${institution.name} detayları`}
    >
      <div className="featured-institutions-list-card-logo">
        {canRenderImage ? (
          <Image
            src={institution.imageUrl}
            alt=""
            fill
            className="featured-institutions-list-card-logo-image"
            sizes="48px"
            unoptimized
            onError={onImageError}
          />
        ) : (
          <span className="featured-institutions-list-card-logo-fallback" aria-hidden>
            {logoInitial}
          </span>
        )}
      </div>
      <div className="featured-institutions-list-card-body">
        <h3 className="featured-institutions-list-card-title">{institution.name}</h3>
        {institution.district ? (
          <p className="featured-institutions-list-card-district">{institution.district}</p>
        ) : null}
      </div>
    </Link>
  );
}
