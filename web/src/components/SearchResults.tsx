"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Building2, Heart } from "lucide-react";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { matchesSearch } from "@/lib/utils";
import "@/styles/pages/home.scss";

interface SearchResult {
  id: string | number;
  name: string;
  description: string;
  location: string;
  mainCategory: string;
  subCategory: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  slug: string;
  source?: string | null;
  badge: {
    icon: string;
    label: string;
    color: string;
  } | null;
}

interface SearchResultsProps {
  query: string;
  onResultClick?: () => void;
  onClearSearch?: () => void;
  onToggleFavorite?: (institutionId: number, e: React.MouseEvent) => void;
  favoriteIds?: Set<number>;
  favoritesEnabled?: boolean;
  favoriteActionLoadingIds?: Set<number>;
  isAuthenticated?: boolean;
}

export default function SearchResults({
  query,
  onResultClick,
  onClearSearch,
  onToggleFavorite,
  favoriteIds,
  favoritesEnabled,
  favoriteActionLoadingIds,
  isAuthenticated,
}: SearchResultsProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<number>>(() => new Set());
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    if (!query || query.trim().length < 1) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError(null);
      const run = async () => {
        try {
          const supabase = createSupabaseBrowserClient();
          const { data, error } = await supabase
            .from("institutions")
            .select("id, institution_name, city, district, type, address, logo, slug, source, institution_type:institution_types(name, category:institution_categories(name))")
            .not("institution_name", "is", null)
            .order("institution_name", { ascending: true })
            .limit(600);

          if (error) {
            throw error;
          }

          const mappedResults = ((data ?? []) as Array<Record<string, unknown>>)
            .map((row) => {
              const id = Number(row.id);
              const name = String(row.institution_name ?? "").trim();
              if (!Number.isFinite(id) || !name) return null;

              const district = String(row.district ?? "").trim();
              const location = district || "Konum bilgisi yok";
              const type = String(row.type ?? "").trim();
              const address = String(row.address ?? "").trim();
              const description = type || address || "Kurum bilgisi";
              const institutionType = row.institution_type as
                | { name?: string | null; category?: { name?: string | null } | null }
                | undefined;
              const mainCategory = String(institutionType?.category?.name ?? "").trim();
              const subCategory = String(institutionType?.name ?? "").trim() || type;
              const logoPath = String(row.logo ?? "").trim();
              const imageUrl = logoPath
                ? supabase.storage.from("institution-logos").getPublicUrl(logoPath).data.publicUrl
                : "";

              return {
                id: id.toString(),
                name,
                description,
                location,
                mainCategory,
                subCategory,
                rating: 4.8,
                reviewCount: Math.floor(4.8 * 25),
                imageUrl,
                slug: String(row.slug ?? "").trim(),
                source: (row.source as string | null) ?? null,
                badge: null,
              } satisfies SearchResult;
            })
            .filter((item): item is SearchResult => item !== null)
            .filter(
              (institution) =>
                matchesSearch(institution.name, query) ||
                matchesSearch(institution.location, query) ||
                matchesSearch(institution.description, query) ||
                matchesSearch(institution.mainCategory, query) ||
                matchesSearch(institution.subCategory, query)
            );

          setResults(mappedResults);
          setVisibleCount(20);
          setError(null);
        } catch (err) {
          console.error("[SearchResults] Error:", err);
          setError("Arama sırasında bir hata oluştu");
          setResults([]);
        } finally {
          setLoading(false);
        }
      };

      void run();
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [query]);

  if (!query || query.trim().length < 1) {
    return null;
  }

  if (loading) {
    return (
      <section className="search-results-section">
        <div className="search-results-container">
          <div className="search-results-loading">
            <p>Aranıyor...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="search-results-section">
        <div className="search-results-container">
          <div className="search-results-error">
            <p>{error}</p>
          </div>
        </div>
      </section>
    );
  }

  if (results.length === 0) {
    return (
      <section className="search-results-section">
        <div className="search-results-container">
          <div className="search-results-empty">
            <p>"{query}" için sonuç bulunamadı.</p>
          </div>
        </div>
      </section>
    );
  }

  const visibleResults = results.slice(0, visibleCount);
  const hasMoreResults = visibleCount < results.length;

  return (
    <section className="search-results-section">
      <div className="search-results-container">
        <div className="search-results-header">
          <h2 className="search-results-title">
            Arama Sonuçları ({results.length})
          </h2>
          {onClearSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="search-results-clear-button"
            >
              Sıfırla
            </button>
          )}
        </div>
        <div className="search-results-grid">
          {visibleResults.map((result) => {
            const institutionId = Number(result.id);
            const isFavorite = Number.isFinite(institutionId) ? Boolean(favoriteIds?.has(institutionId)) : false;
            const isActionLoading = Number.isFinite(institutionId)
              ? Boolean(favoriteActionLoadingIds?.has(institutionId))
              : false;
            const canRenderImage =
              Number.isFinite(institutionId) &&
              Boolean(result.imageUrl) &&
              !brokenImageIds.has(institutionId);

            return (
            <Link
              key={result.id}
              href={getInstitutionDetailHref({
                id: result.id,
                slug: result.slug,
                source: result.source ?? null,
              })}
              className="search-result-card"
              aria-label={`${result.name} detayları`}
              onClick={onResultClick}
            >
              <div className="search-result-image-wrapper">
                {canRenderImage ? (
                  <Image
                    src={result.imageUrl}
                    alt={result.name}
                    fill
                    className="search-result-image"
                    sizes="240px"
                    unoptimized
                    onError={() =>
                      setBrokenImageIds((prev) => {
                        const next = new Set(prev);
                        next.add(institutionId);
                        return next;
                      })
                    }
                  />
                ) : (
                  <div className="search-result-placeholder" aria-label="Logo bulunmuyor">
                    <Building2 size={28} />
                  </div>
                )}
                <div className="search-result-overlay" />
                {result.badge && (
                  <div className={`search-result-badge search-result-badge--${result.badge.color}`}>
                    <span className="search-result-badge-label">{result.badge.label}</span>
                  </div>
                )}
                <button
                  type="button"
                  className="search-result-favorite"
                  aria-label={isFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}
                  disabled={isActionLoading || !Number.isFinite(institutionId) || (isAuthenticated && !favoritesEnabled)}
                  onClick={(e) => {
                    if (!onToggleFavorite || !Number.isFinite(institutionId)) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    onToggleFavorite(institutionId, e);
                  }}
                >
                  <Heart
                    className={
                      isFavorite ? "search-result-heart-icon search-result-heart-icon--active" : "search-result-heart-icon"
                    }
                  />
                </button>
              </div>
              <div className="search-result-content">
                <div className="search-result-location">
                  <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 0C2.69 0 0 2.69 0 6C0 10.5 6 14 6 14C6 14 12 10.5 12 6C12 2.69 9.31 0 6 0ZM6 8.25C4.76 8.25 3.75 7.24 3.75 6C3.75 4.76 4.76 3.75 6 3.75C7.24 3.75 8.25 4.76 8.25 6C8.25 7.24 7.24 8.25 6 8.25Z" fill="currentColor"/>
                  </svg>
                  <span>{result.location}</span>
                </div>
                <h3 className="search-result-name">{result.name}</h3>
                <p className="search-result-description" title={result.description}>{result.description}</p>
              </div>
            </Link>
            );
          })}
        </div>
        {hasMoreResults && (
          <div className="search-results-load-more-wrap">
            <button
              type="button"
              className="search-results-load-more-button"
              onClick={() => setVisibleCount((prev) => prev + 20)}
            >
              Daha Fazla Gör (+20)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
