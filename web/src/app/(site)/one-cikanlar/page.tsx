"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import LoginModal from "@/components/LoginModal";
import { AppNoticeBar } from "@/components/AppNoticeBar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FavoritesError, getMyFavoriteInstitutionIds, NOT_INDIVIDUAL_FAVORITES_MESSAGE, toggleFavorite } from "@/lib/favorites/favoritesClient";
import type { FeaturedInstitution } from "@/components/featured/featuredInstitutionTypes";
import {
  FEATURED_PAGE_CATEGORY_SECTIONS,
  institutionMatchesFeaturedCategory,
} from "@/components/featured/featuredCategoriesConfig";
import { mapInstitutionRowToFeatured } from "@/components/featured/mapInstitutionRowToFeatured";
import { HomeFeaturedInstitutionsMarquee } from "@/components/featured/HomeFeaturedInstitutionsMarquee";
import { FeaturedCategoryInstitutionsRow } from "@/components/featured/FeaturedCategoryInstitutionsRow";
import "@/styles/main.scss";
import "@/styles/pages/home.scss";
import "@/styles/pages/featured-institutions-page.scss";

const FETCH_LIMIT = 400;
const MAX_PER_CATEGORY_ROW = 24;

export default function OneCikanlarPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => new Set());
  const [favoritesEnabled, setFavoritesEnabled] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoriteActionLoadingIds, setFavoriteActionLoadingIds] = useState<Set<number>>(() => new Set());
  const [brokenFeaturedImageIds, setBrokenFeaturedImageIds] = useState<Set<number>>(() => new Set());
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const [allInstitutions, setAllInstitutions] = useState<FeaturedInstitution[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setListLoading(true);
      setListError(null);
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("institutions")
        .select(
          "id, slug, source, institution_name, type, city, district, logo, institution_type:institution_types(name, category:institution_categories(name))",
        )
        .not("institution_name", "is", null)
        .eq("is_approved", true)
        .limit(FETCH_LIMIT);

      if (cancelled) return;
      if (error || !data) {
        setListError("Kurumlar yüklenirken bir hata oluştu.");
        setAllInstitutions([]);
        setListLoading(false);
        return;
      }

      const mapped = (data as Array<Record<string, unknown>>)
        .map((row) => mapInstitutionRowToFeatured(supabase, row))
        .filter((item): item is FeaturedInstitution => item !== null);

      mapped.sort((a, b) => a.name.localeCompare(b.name, "tr", { sensitivity: "base" }));
      setAllInstitutions(mapped);
      setListLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      queueMicrotask(() => {
        if (cancelled) return;
        setUser(session?.user ?? null);
        setIsAuthReady(true);
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (cancelled) return;
        setUser(session?.user ?? null);
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthReady || !user) {
      setFavoriteIds(new Set());
      setFavoritesEnabled(false);
      setFavoritesLoading(false);
      setFavoriteActionLoadingIds(new Set());
      return;
    }

    setFavoritesLoading(true);
    (async () => {
      try {
        const ids = await getMyFavoriteInstitutionIds();
        if (cancelled) return;
        setFavoritesEnabled(true);
        setFavoriteIds(new Set(ids));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof FavoritesError && err.code === "NOT_INDIVIDUAL") {
          setFavoritesEnabled(false);
          setFavoriteIds(new Set());
        }
      } finally {
        if (!cancelled) setFavoritesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user]);

  const handleFavoriteToggle = useCallback(
    async (institutionId: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!user) {
        setShowLoginModal(true);
        return;
      }
      if (!favoritesEnabled) {
        setNoticeMessage(NOT_INDIVIDUAL_FAVORITES_MESSAGE);
        return;
      }
      if (favoriteActionLoadingIds.has(institutionId)) return;

      const wasFavorited = favoriteIds.has(institutionId);
      setFavoriteActionLoadingIds((prev) => {
        const next = new Set(prev);
        next.add(institutionId);
        return next;
      });
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.delete(institutionId);
        else next.add(institutionId);
        return next;
      });

      try {
        const res = await toggleFavorite(institutionId);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (res.isFavorited) next.add(institutionId);
          else next.delete(institutionId);
          return next;
        });
      } catch {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorited) next.add(institutionId);
          else next.delete(institutionId);
          return next;
        });
        window.alert("Favori işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.");
      } finally {
        setFavoriteActionLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(institutionId);
          return next;
        });
      }
    },
    [user, favoritesEnabled, favoriteActionLoadingIds, favoriteIds],
  );

  const institutionsByCategory = useMemo(() => {
    return FEATURED_PAGE_CATEGORY_SECTIONS.map((section) => {
      const items = allInstitutions
        .filter((inst) => institutionMatchesFeaturedCategory(inst, section.matchKeys))
        .slice(0, MAX_PER_CATEGORY_ROW);
      return { ...section, items };
    });
  }, [allInstitutions]);

  const hasAnyCategoryRow = institutionsByCategory.some((s) => s.items.length > 0);

  return (
    <div className="page-container">
      <div className="featured-institutions-page">
        <header className="featured-institutions-page-hero">
          <h1 className="featured-institutions-page-title">Öne Çıkan Kurumları Keşfet</h1>
          <p className="featured-institutions-page-subtitle">
            Merkezden&apos;de öne çıkan eğitim kurumlarını kategori kategori inceleyin.
          </p>
        </header>

        {listLoading ? (
          <p className="featured-institutions-page-loading" role="status">
            Yükleniyor…
          </p>
        ) : listError ? (
          <p className="featured-institutions-page-error" role="alert">
            {listError}
          </p>
        ) : (
          <>
            <HomeFeaturedInstitutionsMarquee
              mode="standalone"
              onToggleFavorite={handleFavoriteToggle}
              favoriteIds={favoriteIds}
              favoritesEnabled={favoritesEnabled && !favoritesLoading}
              favoriteActionLoadingIds={favoriteActionLoadingIds}
              isAuthenticated={Boolean(user)}
            />

            {!hasAnyCategoryRow ? (
              <p className="featured-institutions-page-empty">
                Şu anda kategorilere göre listelenecek kurum bulunmuyor.
              </p>
            ) : (
              institutionsByCategory.map((section, idx) => (
                <FeaturedCategoryInstitutionsRow
                  key={`featured-section-${idx}`}
                  sectionId={`featured-category-heading-${idx}`}
                  heading={section.heading}
                  institutions={section.items}
                  onToggleFavorite={handleFavoriteToggle}
                  favoriteIds={favoriteIds}
                  favoritesEnabled={favoritesEnabled && !favoritesLoading}
                  favoriteActionLoadingIds={favoriteActionLoadingIds}
                  isAuthenticated={Boolean(user)}
                  brokenFeaturedImageIds={brokenFeaturedImageIds}
                  setBrokenFeaturedImageIds={setBrokenFeaturedImageIds}
                />
              ))
            )}
          </>
        )}
      </div>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <AppNoticeBar
        message={noticeMessage}
        onDismiss={() => setNoticeMessage(null)}
        variant={noticeMessage === NOT_INDIVIDUAL_FAVORITES_MESSAGE ? "warning" : "error"}
      />
    </div>
  );
}
