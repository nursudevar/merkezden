"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchActiveHomepageBanners,
  type PublicHomepageBanner,
} from "@/lib/homeBannersClient";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const AUTO_ADVANCE_MS = 3000;

const FALLBACK_BANNER: PublicHomepageBanner = {
  id: "fallback",
  imageUrl: "/images/hero-banner-car.jpg",
  title: "ÇAYYOLU SÜRÜCÜ KURSU",
  description: "İLETİŞİME GEÇMEYİ UNUTMAYIN!",
  mediaType: "image",
  videoUrl: null,
};

type HeroBannerSlide = PublicHomepageBanner & {
  isFallback?: boolean;
};

let cachedActiveBanners: PublicHomepageBanner[] = [];
let hasCachedFetch = false;

function getBannerListKey(banners: PublicHomepageBanner[]): string {
  return banners.map((banner) => banner.id).join("\0");
}

function formatBannerDisplayText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
}

function splitBannerTitleParts(title: string): { leadingWhite: string | null; gradient: string } {
  const normalized = title.trim().replace(/\s+/g, " ");
  const words = normalized.split(" ").filter(Boolean);

  if (words.length === 0) {
    return { leadingWhite: null, gradient: "" };
  }

  if (words.length <= 2) {
    return { leadingWhite: null, gradient: words.join(" ") };
  }

  return {
    leadingWhite: words.slice(0, -2).join(" "),
    gradient: words.slice(-2).join(" "),
  };
}

function HeroBannerTitle({ title }: { title: string }) {
  const { leadingWhite, gradient } = splitBannerTitleParts(title);

  return (
    <h1 className="hero-search-title">
      {leadingWhite ? (
        <>
          <span className="hero-search-title-white">{leadingWhite}</span>{" "}
        </>
      ) : null}
      {gradient ? <span className="hero-search-title-purple">{gradient}</span> : null}
    </h1>
  );
}

function mapPublicBanner(row: PublicHomepageBanner): HeroBannerSlide {
  return { ...row, isFallback: false };
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  return prefersReducedMotion;
}

function HeroBannerSlideContent({
  banner,
  isActive = true,
  isTabHidden = false,
  prefersReducedMotion = false,
}: {
  banner: HeroBannerSlide;
  isActive?: boolean;
  isTabHidden?: boolean;
  prefersReducedMotion?: boolean;
}) {
  const title = banner.title.trim();
  const description = banner.description.trim();
  const displayTitle = formatBannerDisplayText(title);
  const displayDescription = formatBannerDisplayText(description);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  const isVideoBanner = banner.mediaType === "video" && Boolean(banner.videoUrl);
  const showVideo = isVideoBanner && !prefersReducedMotion && !videoFailed;
  const videoSrc = isActive && showVideo ? banner.videoUrl ?? undefined : undefined;

  useEffect(() => {
    if (isActive) {
      setVideoFailed(false);
    }
  }, [isActive, banner.videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showVideo) return;

    if (!isActive) {
      video.pause();
      video.currentTime = 0;
      return;
    }

    if (isTabHidden) {
      video.pause();
      return;
    }

    if (!videoSrc) return;

    video.currentTime = 0;
    void video.play().catch(() => {
      setVideoFailed(true);
    });
  }, [isActive, isTabHidden, showVideo, videoSrc, banner.videoUrl]);

  if (isVideoBanner) {
    return (
      <>
        <div className="hero-search-banner-media">
          <img
            src={banner.imageUrl}
            alt=""
            aria-hidden="true"
            className="hero-search-banner hero-search-banner--poster"
          />
          {showVideo ? (
            <video
              ref={videoRef}
              src={videoSrc}
              className="hero-search-banner hero-search-banner--video"
              muted
              loop
              playsInline
              preload="metadata"
              disablePictureInPicture
              controls={false}
              controlsList="nodownload nofullscreen noremoteplayback"
              onError={() => setVideoFailed(true)}
              onContextMenu={(event) => event.preventDefault()}
              aria-hidden="true"
            />
          ) : null}
        </div>
        <div className="hero-search-overlay"></div>
        <div className="hero-search-content">
          <HeroBannerTitle title={displayTitle} />
          {displayDescription ? (
            <p className="hero-search-subtitle">{displayDescription}</p>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <img
        src={banner.imageUrl}
        alt={displayTitle || "Hero Banner"}
        className="hero-search-banner"
      />
      <div className="hero-search-overlay"></div>
      <div className="hero-search-content">
        <HeroBannerTitle title={displayTitle} />
        {displayDescription ? (
          <p className="hero-search-subtitle">{displayDescription}</p>
        ) : null}
      </div>
    </>
  );
}

export function HomeHeroSearchBanner() {
  const [dbBanners, setDbBanners] = useState<PublicHomepageBanner[]>(() => cachedActiveBanners);
  const [hasFetched, setHasFetched] = useState(hasCachedFetch);
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [isHoverPaused, setIsHoverPaused] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(
    () => typeof document !== "undefined" && document.hidden,
  );
  const prefersReducedMotion = usePrefersReducedMotion();

  const activeIndexRef = useRef(0);
  const bannerCountRef = useRef(0);
  const enableCarouselRef = useRef(false);
  const isPausedRef = useRef(false);
  const intervalRef = useRef<number | null>(null);
  const prevBannerListKeyRef = useRef(getBannerListKey(cachedActiveBanners));

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const sourceBanners = useMemo<HeroBannerSlide[]>(() => {
    if (dbBanners.length > 0) {
      return dbBanners.map(mapPublicBanner);
    }
    return [{ ...FALLBACK_BANNER, isFallback: true }];
  }, [dbBanners]);

  const bannerCount = sourceBanners.length;
  const enableCarousel = hasFetched && dbBanners.length > 1;
  const bannerListKey = useMemo(() => getBannerListKey(dbBanners), [dbBanners]);

  useEffect(() => {
    bannerCountRef.current = bannerCount;
  }, [bannerCount]);

  useEffect(() => {
    enableCarouselRef.current = enableCarousel;
  }, [enableCarousel]);

  useEffect(() => {
    isPausedRef.current = isHoverPaused || isTabHidden;
  }, [isHoverPaused, isTabHidden]);

  useEffect(() => {
    const listChanged = prevBannerListKeyRef.current !== bannerListKey;
    prevBannerListKeyRef.current = bannerListKey;

    if (listChanged) {
      setActiveIndex(0);
      setTransitionEnabled(true);
      activeIndexRef.current = 0;
      return;
    }

    setActiveIndex((prev) => {
      if (bannerCount <= 1) return 0;
      if (!enableCarousel) return 0;
      if (prev > bannerCount) return 0;
      return prev;
    });
  }, [bannerListKey, bannerCount, enableCarousel]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    void (async () => {
      const { banners, error } = await fetchActiveHomepageBanners(supabase);
      if (cancelled) return;

      if (!error) {
        cachedActiveBanners = banners;
        setDbBanners(banners);
      }

      hasCachedFetch = true;
      setHasFetched(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const clearAutoplayInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const advanceSlide = useCallback(() => {
    const count = bannerCountRef.current;
    if (count <= 1 || !enableCarouselRef.current) return;

    const current = activeIndexRef.current;
    if (current >= count) return;

    setTransitionEnabled(true);
    setActiveIndex((prev) => Math.min(prev + 1, count));
  }, []);

  const startAutoplayInterval = useCallback(() => {
    clearAutoplayInterval();
    if (!enableCarouselRef.current || isPausedRef.current) return;

    intervalRef.current = window.setInterval(() => {
      advanceSlide();
    }, AUTO_ADVANCE_MS);
  }, [advanceSlide, clearAutoplayInterval]);

  const restartAutoplay = useCallback(() => {
    clearAutoplayInterval();
    if (!hasFetched || !enableCarouselRef.current || isPausedRef.current) return;
    startAutoplayInterval();
  }, [clearAutoplayInterval, hasFetched, startAutoplayInterval]);

  useEffect(() => {
    if (!hasFetched || !enableCarousel || isHoverPaused || isTabHidden) {
      clearAutoplayInterval();
      return;
    }

    startAutoplayInterval();
    return clearAutoplayInterval;
  }, [
    bannerListKey,
    clearAutoplayInterval,
    enableCarousel,
    hasFetched,
    isHoverPaused,
    isTabHidden,
    startAutoplayInterval,
  ]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsTabHidden(true);
        clearAutoplayInterval();
        return;
      }

      setIsTabHidden(false);

      const count = bannerCountRef.current;
      setActiveIndex((prev) => {
        if (count <= 1) return 0;
        if (prev > count || prev === count) return 0;
        return prev;
      });
      setTransitionEnabled(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [clearAutoplayInterval]);

  const trackSlides = useMemo(() => {
    if (!enableCarousel) return sourceBanners;
    return [...sourceBanners, sourceBanners[0]];
  }, [enableCarousel, sourceBanners]);

  const safeActiveIndex = useMemo(() => {
    if (!enableCarousel) return 0;
    const maxIndex = sourceBanners.length;
    if (activeIndex < 0 || activeIndex > maxIndex) return 0;
    return activeIndex;
  }, [activeIndex, enableCarousel, sourceBanners.length]);

  const dotActiveIndex =
    enableCarousel && safeActiveIndex >= sourceBanners.length ? 0 : safeActiveIndex;

  const goToSlide = useCallback(
    (index: number, withTransition = true) => {
      if (!enableCarousel || sourceBanners.length <= 1) return;
      const normalized =
        ((index % sourceBanners.length) + sourceBanners.length) % sourceBanners.length;
      setTransitionEnabled(withTransition);
      setActiveIndex(normalized);
      restartAutoplay();
    },
    [enableCarousel, restartAutoplay, sourceBanners.length],
  );

  const handleTrackTransitionEnd = useCallback(() => {
    if (!enableCarousel) return;
    if (activeIndexRef.current !== sourceBanners.length) return;

    setTransitionEnabled(false);
    setActiveIndex(0);
    activeIndexRef.current = 0;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setTransitionEnabled(true);
      });
    });
  }, [enableCarousel, sourceBanners.length]);

  const displayBanner = sourceBanners[0] ?? { ...FALLBACK_BANNER, isFallback: true };

  return (
    <section className="hero-search">
      <div
        className="hero-search-container"
        onMouseEnter={() => setIsHoverPaused(true)}
        onMouseLeave={() => setIsHoverPaused(false)}
      >
        {enableCarousel ? (
          <div
            className={[
              "hero-search-track",
              transitionEnabled ? "hero-search-track--animated" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ transform: `translate3d(-${safeActiveIndex * 100}%, 0, 0)` }}
            onTransitionEnd={handleTrackTransitionEnd}
          >
            {trackSlides.map((banner, index) => (
              <div
                key={`${banner.id}-${index}`}
                className="hero-search-slide"
                aria-hidden={index !== safeActiveIndex && index !== sourceBanners.length}
              >
                <HeroBannerSlideContent
                  banner={banner}
                  isActive={index === safeActiveIndex}
                  isTabHidden={isTabHidden}
                  prefersReducedMotion={prefersReducedMotion}
                />
              </div>
            ))}
          </div>
        ) : (
          <HeroBannerSlideContent
            banner={displayBanner}
            isTabHidden={isTabHidden}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
      </div>

      {enableCarousel ? (
        <div className="hero-search-dots" role="tablist" aria-label="Banner seçimi">
          {sourceBanners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              role="tab"
              className={[
                "hero-search-dot",
                index === dotActiveIndex ? "hero-search-dot--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={`${index + 1}. banner`}
              aria-selected={index === dotActiveIndex}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
