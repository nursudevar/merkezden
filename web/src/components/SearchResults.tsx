"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import "@/styles/pages/home.scss";

interface SearchResult {
  id: string;
  name: string;
  description: string;
  location: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  slug: string;
  badge: {
    icon: string;
    label: string;
    color: string;
  } | null;
}

interface SearchResultsProps {
  query: string;
  onResultClick?: () => void;
}

export default function SearchResults({ query, onResultClick }: SearchResultsProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Clear previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset state for empty query
    if (!query || query.trim().length < 1) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Debounce: wait 300ms before searching
    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError(null);

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();

      fetch(`/api/search/institutions?q=${encodeURIComponent(query.trim())}`, {
        signal: abortControllerRef.current.signal,
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error("Arama başarısız");
          }
          return res.json();
        })
        .then((data) => {
          if (data.error) {
            setError(data.error);
            setResults([]);
          } else {
            setResults(data.results || []);
            setError(null);
          }
        })
        .catch((err) => {
          if (err.name === "AbortError") {
            // Request was cancelled, ignore
            return;
          }
          console.error("[SearchResults] Error:", err);
          setError("Arama sırasında bir hata oluştu");
          setResults([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query]);

  // Don't render if query is too short
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

  return (
    <section className="search-results-section">
      <div className="search-results-container">
        <div className="search-results-header">
          <h2 className="search-results-title">
            Arama Sonuçları ({results.length})
          </h2>
        </div>
        <div className="search-results-grid">
          {results.map((result) => (
            <Link
              key={result.id}
              href={`/institutions/${result.slug}`}
              className="featured-institution-card"
              aria-label={`${result.name} detayları`}
              onClick={onResultClick}
            >
              <div className="featured-institution-image-wrapper">
                <Image
                  src={result.imageUrl}
                  alt={result.name}
                  fill
                  className="featured-institution-image"
                  sizes="220px"
                  unoptimized
                />
                <div className="featured-institution-overlay" />
                {result.badge && (
                  <div className={`featured-institution-badge featured-institution-badge--${result.badge.color}`}>
                    <span className="featured-institution-badge-icon">{result.badge.icon}</span>
                    <span className="featured-institution-badge-label">{result.badge.label}</span>
                  </div>
                )}
                <button
                  type="button"
                  className="featured-institution-favorite"
                  aria-label="Favorilere ekle"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 17.35L8.55 16.03C3.4 11.36 0 8.28 0 4.5C0 1.96 2.24 0 5 0C6.74 0 8.41 0.81 9.5 2.09C10.59 0.81 12.26 0 14 0C16.76 0 19 1.96 19 4.5C19 8.28 15.6 11.36 10.45 16.04L10 17.35Z" fill="currentColor"/>
                  </svg>
                </button>
              </div>
              <div className="featured-institution-content">
                <div className="featured-institution-location">
                  <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 0C2.69 0 0 2.69 0 6C0 10.5 6 14 6 14C6 14 12 10.5 12 6C12 2.69 9.31 0 6 0ZM6 8.25C4.76 8.25 3.75 7.24 3.75 6C3.75 4.76 4.76 3.75 6 3.75C7.24 3.75 8.25 4.76 8.25 6C8.25 7.24 7.24 8.25 6 8.25Z" fill="currentColor"/>
                  </svg>
                  <span>{result.location}</span>
                </div>
                <h3 className="featured-institution-name">{result.name}</h3>
                <p className="featured-institution-description">{result.description}</p>
                <div className="featured-institution-footer">
                  <div className="featured-institution-rating">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 0L9.79611 5.52786L15.6085 5.52786L10.9062 8.94427L12.7023 14.4721L8 11.0557L3.29772 14.4721L5.09383 8.94427L0.391548 5.52786L6.20389 5.52786L8 0Z" fill="currentColor"/>
                    </svg>
                    <span>{result.rating}</span>
                  </div>
                  <span className="featured-institution-link">
                    İncele ›
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
