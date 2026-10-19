"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, MapPin, UserRound } from "lucide-react";
import { InstructorCompareToggleButton } from "@/components/compare/InstructorCompareToggleButton";

type InstructorDirectoryCardProps = {
  name: string;
  location: string;
  logoInitial?: string;
  imageUrl?: string;
  detailUrl?: string;
  slug?: string;
  instructorTitle?: string;
  instructorBranch?: string;
  instructorId?: number;
  isFavorite?: boolean;
  isFavoriteActionLoading?: boolean;
  favoritesEnabled?: boolean;
  isAuthenticated?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
};

export default function InstructorDirectoryCard({
  name,
  location,
  logoInitial = "E",
  imageUrl,
  detailUrl,
  slug,
  instructorTitle,
  instructorBranch,
  instructorId,
  isFavorite = false,
  isFavoriteActionLoading = false,
  favoritesEnabled = false,
  isAuthenticated = false,
  onToggleFavorite,
}: InstructorDirectoryCardProps) {
  const instructorTitleText = String(instructorTitle ?? "").trim();
  const instructorBranchText = String(instructorBranch ?? "").trim();
  const locationText = String(location ?? "").trim();
  const numericInstructorId =
    typeof instructorId === "number" && Number.isInteger(instructorId) && instructorId > 0
      ? instructorId
      : null;
  const instructorSlug =
    String(slug ?? "").trim() || (numericInstructorId != null ? String(numericInstructorId) : "");
  const canCompare = numericInstructorId != null && instructorSlug.length > 0;
  const canFavorite = Boolean(onToggleFavorite) && numericInstructorId != null;
  const href = String(detailUrl ?? "").trim();
  const initial = String(logoInitial ?? "").trim() || "E";

  const cardContent = (
    <>
      <div className="instructor-directory-card-layout">
        <div
          className={`instructor-directory-card-media${
            imageUrl ? "" : " instructor-directory-card-media--fallback"
          }`}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              className="instructor-directory-card-image"
              sizes="(max-width: 640px) 40vw, 180px"
              unoptimized
            />
          ) : (
            <span className="instructor-directory-card-fallback">{initial}</span>
          )}
        </div>

        <div className="instructor-directory-card-body">
          <h3 className="instructor-directory-card-name">{name}</h3>
          <div className="instructor-directory-card-meta">
            {instructorBranchText ? (
              <span className="instructor-directory-card-branch">{instructorBranchText}</span>
            ) : (
              <span className="instructor-directory-card-branch" />
            )}
            <span className="instructor-directory-card-type">Bireysel Eğitmen</span>
          </div>
          <div className="instructor-directory-card-location">
            <MapPin size={14} />
            <span>{locationText}</span>
          </div>
          <p className="instructor-directory-card-school">
            {instructorTitleText ? (
              <>
                <UserRound size={14} aria-hidden />
                <span>{instructorTitleText}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {canFavorite ? (
        <button
          type="button"
          className="instructor-directory-card-favorite"
          aria-label={isFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}
          disabled={isFavoriteActionLoading || (isAuthenticated && !favoritesEnabled)}
          onClick={(event) => {
            onToggleFavorite?.(event);
          }}
        >
          <Heart
            className={
              isFavorite ? "heart-favorite-icon heart-favorite-icon--active" : "heart-favorite-icon"
            }
          />
        </button>
      ) : null}
      {canCompare ? (
        <InstructorCompareToggleButton
          className="instructor-directory-card-compare"
          item={{
            id: numericInstructorId,
            name,
            slug: instructorSlug,
            imageUrl,
          }}
        />
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="instructor-directory-card" aria-label={`${name} detayları`}>
        {cardContent}
      </Link>
    );
  }

  return <article className="instructor-directory-card">{cardContent}</article>;
}
