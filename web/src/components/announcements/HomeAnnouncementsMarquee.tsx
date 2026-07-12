"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import AnnouncementDetailModal, {
  type AnnouncementDetailItem,
} from "@/components/AnnouncementDetailModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchHomeAnnouncements,
  type HomeAnnouncementItem,
} from "@/lib/homeAnnouncementsClient";

function HomeAnnouncementCard({
  announcement,
  isDuplicate,
  onOpen,
}: {
  announcement: HomeAnnouncementItem;
  isDuplicate?: boolean;
  onOpen: (item: HomeAnnouncementItem) => void;
}) {
  const [imageBroken, setImageBroken] = useState(false);
  const imageUrl = (announcement.imageUrl ?? "").trim();
  const hasImage = Boolean(imageUrl) && !imageBroken;
  const contentText = String(announcement.content ?? "").trim().replace(/\s+/g, " ");
  const ownerName = (announcement.ownerName ?? "").trim();
  const titleText = String(announcement.title ?? "").trim();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(announcement);
    }
  };

  return (
    <article
      className="duyurular-card"
      role="button"
      tabIndex={isDuplicate ? -1 : 0}
      aria-hidden={isDuplicate}
      aria-label={`${announcement.title} duyurusunu aç`}
      onClick={() => onOpen(announcement)}
      onKeyDown={handleKeyDown}
    >
      {hasImage ? (
        <div className="home-announcement-card-content home-announcement-card-content--with-image">
          <div className="home-announcement-card-media">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote announcement image URLs */}
            <img
              className="home-announcement-card-image"
              src={imageUrl}
              alt={announcement.title}
              onError={() => setImageBroken(true)}
            />
          </div>

          <div className="home-announcement-card-info">
            <h3 className="home-announcement-card-title">{titleText}</h3>
            {ownerName ? (
              <div className="home-announcement-card-owner">{ownerName}</div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="home-announcement-card-content home-announcement-card-content--without-image">
          <h3 className="home-announcement-card-title">{titleText}</h3>
          {contentText ? (
            <p className="home-announcement-card-summary">{contentText}</p>
          ) : null}
          {ownerName ? (
            <div className="home-announcement-card-owner">{ownerName}</div>
          ) : null}
        </div>
      )}
    </article>
  );
}

export function HomeAnnouncementsMarquee() {
  const [isMarqueeMounted, setIsMarqueeMounted] = useState(false);
  const [announcements, setAnnouncements] = useState<HomeAnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAnnouncement, setActiveAnnouncement] = useState<HomeAnnouncementItem | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMarqueeMounted(true);
  }, []);

  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;

    const syncCardSizeFromCategories = () => {
      const categoryCard = document.querySelector<HTMLElement>(".home-main-category-card");
      if (!categoryCard) return;

      const { width, height } = categoryCard.getBoundingClientRect();
      const roundedWidth = Math.round(width);
      const roundedHeight = Math.round(height);

      if (roundedWidth > 0) {
        slider.style.setProperty("--duyurular-card-width", `${roundedWidth}px`);
      }
      if (roundedHeight > 0) {
        slider.style.setProperty("--duyurular-card-height", `${roundedHeight}px`);
      }
    };

    syncCardSizeFromCategories();

    const resizeObserver = new ResizeObserver(syncCardSizeFromCategories);
    const categoryCard = document.querySelector<HTMLElement>(".home-main-category-card");
    if (categoryCard) {
      resizeObserver.observe(categoryCard);
    }

    const categoriesGrid = document.querySelector<HTMLElement>(".home-main-categories-grid");
    if (categoriesGrid) {
      resizeObserver.observe(categoriesGrid);
    }

    window.addEventListener("resize", syncCardSizeFromCategories);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncCardSizeFromCategories);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { items, error } = await fetchHomeAnnouncements(supabase);

      if (cancelled) return;
      if (error) {
        console.error("[home][duyurular] load error", error);
      }
      setAnnouncements(items);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const openAnnouncement = useCallback((item: HomeAnnouncementItem) => {
    setActiveAnnouncement(item);
  }, []);

  const closeAnnouncement = useCallback(() => {
    setActiveAnnouncement(null);
  }, []);

  const activeAnnouncementForModal: AnnouncementDetailItem | null = activeAnnouncement
    ? {
        id: activeAnnouncement.id,
        title: activeAnnouncement.title,
        content: activeAnnouncement.content,
        imageUrl: activeAnnouncement.imageUrl,
        createdAt: activeAnnouncement.createdAt,
        institutionName: activeAnnouncement.ownerName,
        linkUrl: activeAnnouncement.linkUrl,
      }
    : null;

  const marqueeList = [...announcements, ...announcements];
  const showCarousel = !loading && announcements.length > 0;

  if (!loading && announcements.length === 0) {
    return null;
  }

  return (
    <>
      <section className="duyurular-section" aria-label="Duyurular">
        <div className="duyurular-header">
          <h2 className="duyurular-title">Duyurular</h2>
        </div>

        <div
          ref={sliderRef}
          className={`duyurular-slider${loading ? " duyurular-slider--loading" : ""}`}
        >
          {loading ? (
            <div className="duyurular-loading" role="status" aria-live="polite">
              <Megaphone className="duyurular-loading-icon" aria-hidden />
            </div>
          ) : (
            <div
              className={`duyurular-track${
                isMarqueeMounted && showCarousel ? " duyurular-track--animated" : ""
              }`}
            >
              {marqueeList.map((announcement, index) => {
                const isDuplicate = index >= announcements.length;

                return (
                  <HomeAnnouncementCard
                    key={`${announcement.id}-${index}`}
                    announcement={announcement}
                    isDuplicate={isDuplicate}
                    onOpen={openAnnouncement}
                  />
                );
              })}
            </div>
          )}
        </div>

        {showCarousel ? (
          <div className="duyurular-view-all">
            <Link href="/announcements">Tüm Duyuruları Görüntüle →</Link>
          </div>
        ) : null}
      </section>

      <AnnouncementDetailModal
        isOpen={Boolean(activeAnnouncementForModal)}
        onClose={closeAnnouncement}
        announcement={activeAnnouncementForModal}
      />
    </>
  );
}
