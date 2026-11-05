"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Button,
  Input,
  ExpandableChat,
  ExpandableChatHeader,
  ExpandableChatBody,
  ExpandableChatFooter,
} from "@/components/ui";
import { PawPrint, UserRound } from "lucide-react";
import { HomeAnnouncementsMarquee } from "@/components/announcements/HomeAnnouncementsMarquee";
import { HomeBlogSection } from "@/components/blog/HomeBlogSection";
import { HomeFeaturedInstitutionsList } from "@/components/featured/HomeFeaturedInstitutionsList";
import { HomeIndividualInstructorsSection } from "@/components/featured/HomeIndividualInstructorsSection";
import { HomePurpleFeaturedMarquee } from "@/components/featured/HomePurpleFeaturedMarquee";
import { HomeMainCategoryCard } from "@/components/home/HomeMainCategoryCard";
import { HomeHeroSearchBanner } from "@/components/home/HomeHeroSearchBanner";
import { HomeCalendarAnnouncementsSection } from "@/components/home/HomeCalendarAnnouncementsSection";
import { HomeHowItWorksSection } from "@/components/home/HomeHowItWorksSection";
import { HomeMapSearchPromoBanner } from "@/components/home/HomeMapSearchPromoBanner";
import { HeaderWithSearch } from "@/components/layout/header.client";
import SearchResults from "@/components/SearchResults";
import LoginModal from "@/components/LoginModal";
import { AppNoticeBar } from "@/components/AppNoticeBar";
import MekoChromaVideo from "@/components/MekoChromaVideo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FavoritesError,
  getMyFavoriteInstitutionIds,
  getMyFavoriteInstructorIds,
  SELF_FAVORITE_MESSAGE,
  toggleFavorite,
  toggleInstructorFavorite,
} from "@/lib/favorites/favoritesClient";
import { getCategoryHref, getCategoryLogoSrc } from "@/lib/categoryHelpers";
import { resolvePreferredCategoryLocation } from "@/components/category/categoryLocationFilter";
import type { User } from "@supabase/supabase-js";
import "@/styles/main.scss";
import "@/styles/pages/home.scss";

const HOME_HEADER_SEARCH_TYPEWRITER_PLACEHOLDERS = [
  "Meko AI ile istediğin kurumu Ara",
  "Okul, bölge veya özellik adını yazarak ara",
  "Ankara Çankaya'da kreş arıyorum",
  "Yakınımdaki özel ders öğretmenini bul",
  "İstanbul Kadıköy'de yüzme kursu arıyorum",
] as const;

type MainCategorySubcategory = {
  id: number;
  name: string;
};

type MainCategoryCard = {
  id: number;
  name: string;
  slug: string;
  subcategories: MainCategorySubcategory[];
};

/** Ana sayfa kartları. Sekiz kategorinin alt satırları kart bileşeninde sabit; sürücü ve patili satırları mevcut institution_types adları. */
const HOME_MAIN_CATEGORY_CARDS: MainCategoryCard[] = [
  { id: 1, name: "Okul", slug: "okul", subcategories: [] },
  { id: 2, name: "Kurs & Sınava Hazırlık", slug: "kurs-sinava-hazirlik", subcategories: [] },
  { id: 5, name: "Yabancı Dil", slug: "yabanci-dil", subcategories: [] },
  { id: 4, name: "Sanat", slug: "sanat", subcategories: [] },
  { id: 3, name: "Spor", slug: "spor", subcategories: [] },
  { id: 6, name: "Kişisel Gelişim", slug: "kisisel-gelisim", subcategories: [] },
  { id: 7, name: "Mesleki Eğitim", slug: "mesleki-egitim", subcategories: [] },
  { id: 8, name: "Özel Eğitim", slug: "ozel-egitim", subcategories: [] },
  {
    id: 10,
    name: "Sürücü Kursu",
    slug: "surucu-kursu",
    subcategories: [{ id: 102, name: "Sürücü Kursu" }],
  },
  {
    id: 9,
    name: "Patili Dostlar",
    slug: "patili-dostlar",
    subcategories: [
      { id: 98, name: "Pet Kuaför" },
      { id: 97, name: "Köpek Eğitimi" },
      { id: 96, name: "Pet Otel/Kreş" },
    ],
  },
];

type AuthErrorModalState = {
  title: string;
  message: string;
} | null;

const PATILI_DOSTLAR_PAGE_HREF = "/patili-dostlar";

const HOME_PATILI_DOSTLAR_FEATURED = {
  title: "Pet Kuaför",
  description: "Patili dostunuz için bakım ve tımar hizmetleri yakında burada listelenecek.",
  imageUrl: "/images/pet_kuafor.png",
};

const HOME_PATILI_DOSTLAR_SIDE_CARDS = [
  {
    id: "kopek-egitimi",
    title: "Köpek Eğitimi",
    description: "Profesyonel köpek eğitimi seçeneklerini keşfedin.",
    imageUrl: "/images/kopek_egitimi.png",
  },
  {
    id: "pet-otel-kres",
    title: "Pet Otel / Kreş",
    description: "Güvenilir pet otel ve kreş hizmetleri yakında burada.",
    imageUrl: "/images/pet_otel.png",
  },
] as const;

export default function HomePageClient() {
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => new Set());
  const [favoriteInstructorIds, setFavoriteInstructorIds] = useState<Set<number>>(() => new Set());
  const [favoritesEnabled, setFavoritesEnabled] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [authErrorModal, setAuthErrorModal] = useState<AuthErrorModalState>(null);
  const [favoriteActionLoadingIds, setFavoriteActionLoadingIds] = useState<Set<number>>(() => new Set());
  const [favoriteInstructorActionLoadingIds, setFavoriteInstructorActionLoadingIds] = useState<
    Set<number>
  >(() => new Set());
  const [preferredIlId, setPreferredIlId] = useState("");
  const [preferredIlceId, setPreferredIlceId] = useState("");

  const showDefaultHomeContent = !(query && query.trim().length > 0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const errorCode = params.get("error_code");
    const errorDescription = params.get("error_description");
    if (!error && !errorCode && !errorDescription) return;

    const isExpiredLoginLink =
      errorCode === "otp_expired" ||
      String(errorDescription ?? "").includes("Email link is invalid or has expired");

    setAuthErrorModal(
      isExpiredLoginLink
        ? {
            title: "Giriş Bağlantısı Geçersiz",
            message:
              "Giriş bağlantınızın süresi dolmuş veya bağlantı geçersiz. Lütfen tekrar giriş yapmayı deneyin.",
          }
        : {
            title: "Giriş İşlemi Başarısız",
            message: "Giriş işlemi sırasında bir sorun oluştu. Lütfen tekrar deneyin.",
          },
    );

    params.delete("error");
    params.delete("error_code");
    params.delete("error_description");
    const nextQuery = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname || "/"}${nextQuery ? `?${nextQuery}` : ""}`,
    );
  }, []);

  const handleFavoriteToggle = async (institutionId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!favoritesEnabled) {
      setFavoritesError("Favoriler kullanılamıyor. Lütfen tekrar deneyin.");
      return;
    }
    if (favoriteActionLoadingIds.has(institutionId)) return;

    const wasFavorited = favoriteIds.has(institutionId);
    setFavoritesError(null);
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
    } catch (err) {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.add(institutionId);
        else next.delete(institutionId);
        return next;
      });
      const msg =
        err instanceof FavoritesError
          ? err.message
          : "Favori işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.";
      setFavoritesError(msg);
    } finally {
      setFavoriteActionLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(institutionId);
        return next;
      });
    }
  };

  const handleInstructorFavoriteToggle = async (instructorId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!favoritesEnabled) {
      setFavoritesError("Favoriler kullanılamıyor. Lütfen tekrar deneyin.");
      return;
    }
    if (favoriteInstructorActionLoadingIds.has(instructorId)) return;

    const wasFavorited = favoriteInstructorIds.has(instructorId);
    setFavoritesError(null);
    setFavoriteInstructorActionLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(instructorId);
      return next;
    });
    setFavoriteInstructorIds((prev) => {
      const next = new Set(prev);
      if (wasFavorited) next.delete(instructorId);
      else next.add(instructorId);
      return next;
    });

    try {
      const res = await toggleInstructorFavorite(instructorId);
      setFavoriteInstructorIds((prev) => {
        const next = new Set(prev);
        if (res.isFavorited) next.add(instructorId);
        else next.delete(instructorId);
        return next;
      });
    } catch (err) {
      setFavoriteInstructorIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.add(instructorId);
        else next.delete(instructorId);
        return next;
      });
      const msg =
        err instanceof FavoritesError
          ? err.message
          : "Favori işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.";
      setFavoritesError(msg);
    } finally {
      setFavoriteInstructorActionLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(instructorId);
        return next;
      });
    }
  };

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
      setFavoriteInstructorIds(new Set());
      setFavoritesEnabled(false);
      setFavoritesLoading(false);
      setFavoritesError(null);
      setFavoriteActionLoadingIds(new Set());
      setFavoriteInstructorActionLoadingIds(new Set());
      return;
    }

    setFavoritesLoading(true);
    setFavoritesError(null);
    (async () => {
      try {
        const [ids, instructorIds] = await Promise.all([
          getMyFavoriteInstitutionIds(),
          getMyFavoriteInstructorIds(),
        ]);
        if (cancelled) return;
        setFavoritesEnabled(true);
        setFavoriteIds(new Set(ids));
        setFavoriteInstructorIds(new Set(instructorIds));
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof FavoritesError ? err.message : "Favoriler yüklenemedi. Lütfen tekrar deneyin.";
        setFavoritesError(msg);
        setFavoritesEnabled(false);
      } finally {
        if (!cancelled) setFavoritesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const preferred = await resolvePreferredCategoryLocation("");
        if (cancelled) return;
        setPreferredIlId(preferred.ilId);
        setPreferredIlceId(preferred.ilceId);
      } catch (error) {
        console.error("Konum tercihi yüklenemedi:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-container">
      <HeaderWithSearch
        searchValue={query}
        onSearchChange={setQuery}
        searchTypewriterPlaceholders={HOME_HEADER_SEARCH_TYPEWRITER_PLACEHOLDERS}
        showSearchButton={false}
        enableSearchFocusSuggestions
      />

      <div className="main-layout home-main-layout">
        <main className="main-content">
          {showDefaultHomeContent ? (
            <>
              <HomeHeroSearchBanner />

              <section className="home-main-categories">
                <header className="home-main-categories-header">
                  <h2 className="home-main-categories-title">Ana Kategoriler</h2>
                </header>
                <div className="home-main-categories-slider">
                  <div className="categories-scroller home-main-categories-grid">
                    {HOME_MAIN_CATEGORY_CARDS.map((category) => {
                      const categoryHref = getCategoryHref(category.name, category.slug);
                      const categoryLogoSrc = getCategoryLogoSrc(category.name, category.slug);
                      return (
                        <HomeMainCategoryCard
                          key={category.id}
                          category={category}
                          categoryHref={categoryHref}
                          categoryLogoSrc={categoryLogoSrc}
                        />
                      );
                    })}
                  </div>
                </div>
              </section>

              <HomeMapSearchPromoBanner />

              <HomeIndividualInstructorsSection
                onToggleFavorite={handleInstructorFavoriteToggle}
                favoriteInstructorIds={favoriteInstructorIds}
                favoritesEnabled={favoritesEnabled && !favoritesLoading}
                favoriteInstructorActionLoadingIds={favoriteInstructorActionLoadingIds}
                isAuthenticated={Boolean(user)}
              />

              <HomeFeaturedInstitutionsList
                onToggleFavorite={handleFavoriteToggle}
                onToggleInstructorFavorite={handleInstructorFavoriteToggle}
                favoriteIds={favoriteIds}
                favoriteInstructorIds={favoriteInstructorIds}
                favoritesEnabled={favoritesEnabled && !favoritesLoading}
                favoriteActionLoadingIds={favoriteActionLoadingIds}
                favoriteInstructorActionLoadingIds={favoriteInstructorActionLoadingIds}
                isAuthenticated={Boolean(user)}
              />
            </>
          ) : (
            <SearchResults
              query={query}
              ilIdFilter={preferredIlId}
              ilceIdFilter={preferredIlceId}
              onClearSearch={() => setQuery("")}
              onClearAllFilters={() => setQuery("")}
              onToggleFavorite={handleFavoriteToggle}
              favoriteIds={favoriteIds}
              favoritesEnabled={favoritesEnabled && !favoritesLoading}
              favoriteActionLoadingIds={favoriteActionLoadingIds}
              isAuthenticated={Boolean(user)}
            />
          )}
        </main>
      </div>

      {showDefaultHomeContent ? (
        <div className="content-layout">
          <div className="content-layout-inner">
            <HomeAnnouncementsMarquee />

            <HomeHowItWorksSection />

            <HomeCalendarAnnouncementsSection />

            <div className="home-patili-dostlar-row">
              <div className="home-patili-dostlar-meko" aria-hidden>
                <MekoChromaVideo
                  src="/gifs/meko-pet.mp4"
                  className="home-patili-dostlar-meko-video"
                  ariaLabel="Meko animation"
                  threshold={18}
                />
              </div>

              <section className="patili-dostlar-section" aria-label="Patili Dostlar">
                <div className="patili-dostlar-header">
                  <h2 className="patili-dostlar-title">
                    <PawPrint
                      className="patili-dostlar-title-icon"
                      size={24}
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    <span>Patili Dostlar</span>
                  </h2>
                  <Link
                    href={PATILI_DOSTLAR_PAGE_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="patili-dostlar-view-all"
                  >
                    tümünü gör
                  </Link>
                </div>

                <div className="patili-dostlar-grid">
                  <Link
                    href={PATILI_DOSTLAR_PAGE_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="patili-dostlar-feature-card"
                  >
                    <div
                      className="patili-dostlar-feature-media"
                      style={{ backgroundImage: `url("${HOME_PATILI_DOSTLAR_FEATURED.imageUrl}")` }}
                    >
                      <div className="patili-dostlar-feature-overlay" />
                      <div className="patili-dostlar-feature-body">
                        <h3 className="patili-dostlar-feature-title">
                          {HOME_PATILI_DOSTLAR_FEATURED.title}
                        </h3>
                        <p className="patili-dostlar-feature-desc">
                          {HOME_PATILI_DOSTLAR_FEATURED.description}
                        </p>
                      </div>
                    </div>
                  </Link>

                  <div className="patili-dostlar-side">
                    {HOME_PATILI_DOSTLAR_SIDE_CARDS.map((item) => (
                      <Link
                        href={PATILI_DOSTLAR_PAGE_HREF}
                        key={item.id}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="patili-dostlar-feature-card patili-dostlar-side-card"
                      >
                        <div
                          className="patili-dostlar-feature-media"
                          style={{ backgroundImage: `url("${item.imageUrl}")` }}
                        >
                          <div className="patili-dostlar-feature-overlay" />
                          <div className="patili-dostlar-feature-body">
                            <h3 className="patili-dostlar-feature-title">{item.title}</h3>
                            <p className="patili-dostlar-feature-desc">{item.description}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <section className="purple-featured-section" aria-label="Aramıza Yeni Katılanlar">
              <div className="purple-featured-bg" aria-hidden />
              <div className="purple-featured-inner">
                <div className="purple-featured-heading">
                  <span className="purple-featured-kicker">Sizin için özenle seçildi.</span>
                  <h2 className="purple-featured-title">Aramıza Yeni Katılanlar</h2>
                </div>

                <HomePurpleFeaturedMarquee />
              </div>
            </section>

            <HomeBlogSection />
          </div>
        </div>
      ) : null}

      {authErrorModal ? (
        <div
          className="app-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-auth-error-modal-title"
          onClick={() => setAuthErrorModal(null)}
        >
          <div
            className="app-modal-content app-modal-content--error"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="home-auth-error-modal-title" className="app-modal-title">
              {authErrorModal.title}
            </h2>
            <div className="app-modal-body">
              <p className="app-modal-message">{authErrorModal.message}</p>
            </div>
            <div className="app-modal-footer">
              <Button
                type="button"
                variant="default"
                className="app-modal-btn app-modal-btn--primary"
                onClick={() => setAuthErrorModal(null)}
              >
                Tamam
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <AppNoticeBar
        message={favoritesError}
        onDismiss={() => setFavoritesError(null)}
        variant={favoritesError === SELF_FAVORITE_MESSAGE ? "warning" : "error"}
      />

      <ExpandableChat
        size="lg"
        position="bottom-right"
        toggleHintText="Sana nasıl yardımcı olabilirim?"
        icon={
          <MekoChromaVideo
            src="/gifs/meko-soru.mp4"
            className="expandable-chat-toggle-video"
            ariaLabel="Meko animation"
            threshold={18}
          />
        }
      >
        <ExpandableChatHeader>
          <h2 className="expandable-chat-header-title">Meko Asistan</h2>
        </ExpandableChatHeader>
        <ExpandableChatBody>
          <div className="expandable-chat-starter">
            <div className="expandable-chat-starter-avatar" aria-hidden>
              <UserRound size={16} />
            </div>
            <div className="expandable-chat-starter-bubble">
              <p className="expandable-chat-starter-text">
                Sorularınız için bize iletişim sayfamız üzerinden ulaşabilirsiniz!
              </p>
            </div>
          </div>
        </ExpandableChatBody>
        <ExpandableChatFooter>
          <form className="expandable-chat-form" onSubmit={(e) => e.preventDefault()}>
            <Input
              type="text"
              placeholder="Mesajınızı yazın..."
              className="expandable-chat-input"
              aria-label="Mesaj"
            />
            <Button type="submit" variant="default" className="expandable-chat-send-btn">
              Gönder
            </Button>
          </form>
        </ExpandableChatFooter>
      </ExpandableChat>
    </div>
  );
}
