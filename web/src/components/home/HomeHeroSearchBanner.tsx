"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { AdvertisementButton, PlacementTarget } from "@/lib/advertisementsClient";
import {
  fetchPublishedHeroSlides,
  type PublishedHeroSlide,
} from "@/components/home/publishedHeroSlides";

const AUTO_ADVANCE_MS = 3000;

type HeroBannerSlide = PublishedHeroSlide;

function getBannerListKey(banners: Array<{ id: string }>): string {
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

function HeroBannerTitle({
  title,
  titleAs = "h1",
}: {
  title: string;
  titleAs?: "h1" | "p" | "div";
}) {
  const { leadingWhite, gradient } = splitBannerTitleParts(title);
  const TitleTag = titleAs;

  return (
    <TitleTag className="hero-search-title">
      {leadingWhite ? (
        <>
          <span className="hero-search-title-white">{leadingWhite}</span>{" "}
        </>
      ) : null}
      {gradient ? <span className="hero-search-title-purple">{gradient}</span> : null}
    </TitleTag>
  );
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
  titleAs = "h1",
}: {
  banner: HeroBannerSlide;
  isActive?: boolean;
  isTabHidden?: boolean;
  prefersReducedMotion?: boolean;
  titleAs?: "h1" | "p" | "div";
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
          {banner.imageUrl ? (
            <img
              src={banner.imageUrl}
              alt=""
              aria-hidden="true"
              className="hero-search-banner hero-search-banner--poster"
            />
          ) : null}
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
          <HeroBannerTitle title={displayTitle} titleAs={titleAs} />
          {displayDescription ? (
            <p className="hero-search-subtitle">{displayDescription}</p>
          ) : null}
          <HeroBannerActions buttons={banner.buttons} />
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
        <HeroBannerTitle title={displayTitle} titleAs={titleAs} />
        {displayDescription ? (
          <p className="hero-search-subtitle">{displayDescription}</p>
        ) : null}
        <HeroBannerActions buttons={banner.buttons} />
      </div>
    </>
  );
}

function advertisementButtonHref(url: string): { href: string; external: boolean } | null {
  const value = url.trim();
  if (!value || /[\u0000-\u001F\u007F\s]/.test(value)) return null;

  if (value.startsWith("/")) {
    if (value.startsWith("//") || value.includes("://")) return null;
    return { href: value, external: false };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || !parsed.hostname.includes(".")) return null;
  return { href: value, external: true };
}

function HeroBannerActions({ buttons }: { buttons?: AdvertisementButton[] }) {
  const visible = (buttons ?? [])
    .flatMap((button) => {
      const label = button.label.trim();
      const href = advertisementButtonHref(button.url);
      return label && href ? [{ label, ...href }] : [];
    })
    .slice(0, 2);
  if (visible.length === 0) return null;
  return (
    <div className="hero-search-actions">
      {visible.map((button, index) => (
        <a
          key={`${button.label}-${button.href}`}
          className={index === 1 ? "hero-search-action hero-search-action--secondary" : "hero-search-action"}
          href={button.href}
          target={button.external ? "_blank" : undefined}
          rel={button.external ? "noopener noreferrer" : undefined}
        >
          {button.label}
        </a>
      ))}
    </div>
  );
}

type HeroTitleAs = "h1" | "p" | "div";

type CarouselSlide =
  | { kind: "db"; id: string; banner: HeroBannerSlide }
  | { kind: "custom"; id: string; content: ReactNode };

const LEADING_DRIVING_SLIDE_ID = "driving-schools";

interface HomeHeroSearchBannerProps {
  /** Semantic title tag. Use non-h1 on pages that already have a page H1. */
  titleAs?: HeroTitleAs;
  /** Optional first carousel slide (e.g. Sürücü Kursları banner on /surucu-kursu). */
  leadingSlide?: ReactNode;
  /** When set, slides come from published advertisements for this placement. */
  placement?: PlacementTarget;
}

function placementRequestKey(placement: PlacementTarget | undefined): string | null {
  if (!placement) return null;
  if (placement.placementType === "institution_category" || placement.placementType === "instructor_category") {
    return `${placement.placementType}:${placement.categoryId}`;
  }
  return placement.placementType;
}

export function HomeHeroSearchBanner({
  titleAs = "h1",
  leadingSlide,
  placement,
}: HomeHeroSearchBannerProps = {}) {
  const [dbBanners, setDbBanners] = useState<HeroBannerSlide[]>([]);
  const [loadedPlacementKey, setLoadedPlacementKey] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(() => !placement);
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [isHoverPaused, setIsHoverPaused] = useState(false);
  const [isPlaybackPaused, setIsPlaybackPaused] = useState(false);
  const [suspendHoverPause, setSuspendHoverPause] = useState(false);
  const hoverPausesPlayback = isHoverPaused && !suspendHoverPause;
  const [isTabHidden, setIsTabHidden] = useState(
    () => typeof document !== "undefined" && document.hidden,
  );
  const prefersReducedMotion = usePrefersReducedMotion();

  const activeIndexRef = useRef(0);
  const bannerCountRef = useRef(0);
  const enableCarouselRef = useRef(false);
  const isPausedRef = useRef(false);
  const intervalRef = useRef<number | null>(null);
  const prevBannerListKeyRef = useRef("");
  const hasLeadingSlide = Boolean(leadingSlide);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const requestKey = placementRequestKey(placement);
  const publishedReady = !requestKey || loadedPlacementKey === requestKey;
  const visibleBanners = placement && publishedReady ? dbBanners : [];
  const sourceBanners = visibleBanners;

  const sourceSlides = useMemo<CarouselSlide[]>(() => {
    const dbSlides: CarouselSlide[] = sourceBanners.map((banner) => ({
      kind: "db",
      id: banner.id,
      banner,
    }));
    if (!leadingSlide) return dbSlides;
    return [
      { kind: "custom", id: LEADING_DRIVING_SLIDE_ID, content: leadingSlide },
      ...dbSlides,
    ];
  }, [leadingSlide, sourceBanners]);

  const bannerCount = sourceSlides.length;
  const enableCarousel = hasFetched && bannerCount > 1;
  const bannerListKey = useMemo(
    () => `${hasLeadingSlide ? `${LEADING_DRIVING_SLIDE_ID}\0` : ""}${getBannerListKey(visibleBanners)}`,
    [hasLeadingSlide, visibleBanners],
  );

  useEffect(() => {
    bannerCountRef.current = bannerCount;
  }, [bannerCount]);

  useEffect(() => {
    enableCarouselRef.current = enableCarousel;
  }, [enableCarousel]);

  useEffect(() => {
    isPausedRef.current = hoverPausesPlayback || isTabHidden || isPlaybackPaused;
  }, [hoverPausesPlayback, isTabHidden, isPlaybackPaused]);

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
    if (!placement || !requestKey) return;
    let cancelled = false;

    void (async () => {
      const result = await fetchPublishedHeroSlides(placement);
      if (cancelled) return;
      setDbBanners(result.error ? [] : result.slides);
      setLoadedPlacementKey(requestKey);
      setHasFetched(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [placement, requestKey]);

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
    if (!hasFetched || !enableCarousel || hoverPausesPlayback || isTabHidden || isPlaybackPaused) {
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
    hoverPausesPlayback,
    isPlaybackPaused,
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
    if (!enableCarousel) return sourceSlides;
    return [...sourceSlides, sourceSlides[0]];
  }, [enableCarousel, sourceSlides]);

  const safeActiveIndex = useMemo(() => {
    if (!enableCarousel) return 0;
    const maxIndex = sourceSlides.length;
    if (activeIndex < 0 || activeIndex > maxIndex) return 0;
    return activeIndex;
  }, [activeIndex, enableCarousel, sourceSlides.length]);

  const dotActiveIndex =
    enableCarousel && safeActiveIndex >= sourceSlides.length ? 0 : safeActiveIndex;

  const goToSlide = useCallback(
    (index: number, withTransition = true) => {
      if (!enableCarousel || sourceSlides.length <= 1) return;
      const normalized =
        ((index % sourceSlides.length) + sourceSlides.length) % sourceSlides.length;
      setTransitionEnabled(withTransition);
      setActiveIndex(normalized);
      restartAutoplay();
    },
    [enableCarousel, restartAutoplay, sourceSlides.length],
  );

  const goToNextSlide = useCallback(() => {
    if (!enableCarousel || sourceSlides.length <= 1) return;
    setTransitionEnabled(true);
    setActiveIndex((prev) => {
      const count = sourceSlides.length;
      const current = prev >= count ? 0 : prev;
      return Math.min(current + 1, count);
    });
    restartAutoplay();
  }, [enableCarousel, restartAutoplay, sourceSlides.length]);

  const handleTrackTransitionEnd = useCallback(() => {
    if (!enableCarousel) return;
    if (activeIndexRef.current !== sourceSlides.length) return;

    setTransitionEnabled(false);
    setActiveIndex(0);
    activeIndexRef.current = 0;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setTransitionEnabled(true);
      });
    });
  }, [enableCarousel, sourceSlides.length]);

  const renderSlideContent = (slide: CarouselSlide, isActive: boolean) => {
    if (slide.kind === "custom") return slide.content;
    return (
      <HeroBannerSlideContent
        banner={slide.banner}
        isActive={isActive}
        isTabHidden={isTabHidden}
        prefersReducedMotion={prefersReducedMotion}
        titleAs={titleAs}
      />
    );
  };

  const displaySlide = sourceSlides[0];
  const publishedSettled = placement ? publishedReady && hasFetched : hasFetched;
  const placementHasNoSlides = publishedSettled && sourceSlides.length === 0;

  if (placementHasNoSlides) return null;

  return (
    <section
      className={[
        "hero-search",
        hasLeadingSlide ? "hero-search--with-driving-slide" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="hero-search-container"
        onMouseEnter={() => setIsHoverPaused(true)}
        onMouseLeave={() => {
          setSuspendHoverPause(false);
          setIsHoverPaused(false);
        }}
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
            {trackSlides.map((slide, index) => (
              <div
                key={`${slide.id}-${index}`}
                className="hero-search-slide"
                aria-hidden={index !== safeActiveIndex && index !== sourceSlides.length}
              >
                {renderSlideContent(slide, index === safeActiveIndex)}
              </div>
            ))}
          </div>
        ) : displaySlide ? (
          renderSlideContent(displaySlide, true)
        ) : null}

        {enableCarousel ? (
          <>
            <button
              type="button"
              className="hero-search-arrow hero-search-arrow--prev"
              aria-label="Önceki banner"
              onClick={() => goToSlide(dotActiveIndex - 1)}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hero-search-arrow hero-search-arrow--next"
              aria-label="Sonraki banner"
              onClick={goToNextSlide}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <div className="hero-search-controls">
              <div className="hero-search-dots" role="tablist" aria-label="Banner seçimi">
                {sourceSlides.map((slide, index) => (
                  <button
                    key={slide.id}
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
              <button
                type="button"
                className={[
                  "hero-search-playback",
                  isPlaybackPaused ? "hero-search-playback--paused" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={
                  isPlaybackPaused ? "Banner kaydırmayı oynat" : "Banner kaydırmayı duraklat"
                }
                aria-pressed={isPlaybackPaused}
                onClick={() => {
                  if (isPlaybackPaused) setSuspendHoverPause(true);
                  else setSuspendHoverPause(false);
                  setIsPlaybackPaused((paused) => !paused);
                }}
              >
                {isPlaybackPaused ? (
                  <Play size={11} aria-hidden="true" />
                ) : (
                  <Pause size={11} aria-hidden="true" />
                )}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
