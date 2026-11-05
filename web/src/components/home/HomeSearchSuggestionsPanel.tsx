"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";
import {
  loadHomeFeaturedAccountsShared,
  type FeaturedInstitution,
} from "@/components/featured/featuredInstitutions";
import type { FeaturedInstructorItem } from "@/lib/publicInstructorSearch";

export const HOME_POPULAR_SEARCHES = [
  "Ümitköy Piyano Kursu",
  "Çankaya Bale Dersi",
  "Kadıköy Yüzme Kursu",
] as const;

/** Fisher–Yates ile en fazla `count` benzersiz öğe; kaynak yetersizse hepsini döner. */
function pickRandomDistinct<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool.slice(0, count);
}

type HomeSearchSuggestionsPanelProps = {
  onPopularSearch: (query: string) => void;
};

export function HomeSearchSuggestionsPanel({
  onPopularSearch,
}: HomeSearchSuggestionsPanelProps) {
  const [institutions, setInstitutions] = useState<FeaturedInstitution[]>([]);
  const [instructors, setInstructors] = useState<FeaturedInstructorItem[]>([]);
  const [brokenImages, setBrokenImages] = useState<Record<string, true>>({});

  // Paylaşılan ana sayfa listesi; panel mount = yalnızca client-side rastgele seçim (yeni sorgu yok).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { items, failed } = await loadHomeFeaturedAccountsShared(supabase);
        if (cancelled || failed) return;

        const allInstitutions = items
          .filter((item): item is { kind: "institution"; institution: FeaturedInstitution } =>
            item.kind === "institution",
          )
          .map((item) => item.institution);
        const allInstructors = items
          .filter((item): item is { kind: "instructor"; instructor: FeaturedInstructorItem } =>
            item.kind === "instructor",
          )
          .map((item) => item.instructor);

        setInstitutions(pickRandomDistinct(allInstitutions, 3));
        setInstructors(pickRandomDistinct(allInstructors, 3));
      } catch {
        // Panel boş kalabilir; arama akışını bozma.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markBroken = (key: string) => {
    setBrokenImages((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  return (
    <div
      className="home-search-suggestions"
      role="listbox"
      aria-label="Arama önerileri"
      onMouseDown={(event) => {
        // Input blur olmadan chip/link tıklanabilsin.
        event.preventDefault();
      }}
    >
      <div className="home-search-suggestions-scroll">
        <section className="home-search-suggestions-section" aria-label="Popüler aramalar">
          <header className="home-search-suggestions-heading">
            <TrendingUp size={15} strokeWidth={2.2} aria-hidden />
            <span>Popüler Aramalar</span>
          </header>
          <div className="home-search-suggestions-chips">
            {HOME_POPULAR_SEARCHES.map((term) => (
              <button
                key={term}
                type="button"
                className="home-search-suggestions-chip"
                onClick={() => onPopularSearch(term)}
              >
                {term}
              </button>
            ))}
          </div>
        </section>

        {institutions.length > 0 ? (
          <section className="home-search-suggestions-section" aria-label="Öne çıkan kurumlar">
            <header className="home-search-suggestions-heading">
              <Building2 size={15} strokeWidth={2.2} aria-hidden />
              <span>Öne Çıkan Kurumlar</span>
            </header>
            <ul className="home-search-suggestions-list">
              {institutions.map((institution) => {
                const imageKey = `institution-${institution.id}`;
                const showImage = Boolean(institution.imageUrl) && !brokenImages[imageKey];
                return (
                  <li key={institution.id}>
                    <Link
                      href={getInstitutionDetailHref({ slug: institution.slug })}
                      className="home-search-suggestions-row"
                    >
                      <span className="home-search-suggestions-avatar home-search-suggestions-avatar--square">
                        {showImage ? (
                          // eslint-disable-next-line @next/next/no-img-element -- remote institution logos
                          <img
                            src={institution.imageUrl}
                            alt=""
                            onError={() => markBroken(imageKey)}
                          />
                        ) : (
                          <Building2 size={18} strokeWidth={1.9} aria-hidden />
                        )}
                      </span>
                      <span className="home-search-suggestions-copy">
                        <span className="home-search-suggestions-title">{institution.name}</span>
                        <span className="home-search-suggestions-meta">
                          {institution.bodyLocation}
                        </span>
                      </span>
                      <ChevronRight
                        className="home-search-suggestions-chevron"
                        size={16}
                        strokeWidth={2}
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {instructors.length > 0 ? (
          <section className="home-search-suggestions-section" aria-label="Öne çıkan eğitmenler">
            <header className="home-search-suggestions-heading">
              <Users size={15} strokeWidth={2.2} aria-hidden />
              <span>Öne Çıkan Eğitmenler</span>
            </header>
            <ul className="home-search-suggestions-list">
              {instructors.map((instructor) => {
                const imageKey = `instructor-${instructor.id}`;
                const showImage = Boolean(instructor.imageUrl) && !brokenImages[imageKey];
                const specialty =
                  String(instructor.branch ?? "").trim() ||
                  String(instructor.bodyMainCategory ?? "").trim() ||
                  "Eğitmen";
                return (
                  <li key={instructor.id}>
                    <Link href={instructor.href} className="home-search-suggestions-row">
                      <span className="home-search-suggestions-avatar home-search-suggestions-avatar--circle">
                        {showImage ? (
                          // eslint-disable-next-line @next/next/no-img-element -- remote instructor photos
                          <img
                            src={instructor.imageUrl}
                            alt=""
                            onError={() => markBroken(imageKey)}
                          />
                        ) : (
                          <UserRound size={18} strokeWidth={1.9} aria-hidden />
                        )}
                      </span>
                      <span className="home-search-suggestions-copy">
                        <span className="home-search-suggestions-title">{instructor.name}</span>
                        <span className="home-search-suggestions-meta">{specialty}</span>
                      </span>
                      <ChevronRight
                        className="home-search-suggestions-chevron"
                        size={16}
                        strokeWidth={2}
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
