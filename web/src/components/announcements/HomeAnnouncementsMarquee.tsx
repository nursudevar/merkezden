"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, Globe, Megaphone, UserRound } from "lucide-react";
import AnnouncementDetailModal, {
  type AnnouncementDetailItem,
} from "@/components/AnnouncementDetailModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchHomeAnnouncements,
  type HomeAnnouncementItem,
} from "@/lib/homeAnnouncementsClient";

function buildContentPreview(text: string, maxLen: number): string {
  const normalized = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

function HomeAnnouncementCard({
  announcement,
  isDuplicate,
  canRenderImage,
  onOpen,
  onImageError,
}: {
  announcement: HomeAnnouncementItem;
  isDuplicate?: boolean;
  canRenderImage: boolean;
  onOpen: (item: HomeAnnouncementItem) => void;
  onImageError: () => void;
}) {
  const hasLink = Boolean((announcement.linkUrl ?? "").trim());
  const preview = buildContentPreview(announcement.content, 72);

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
      <div className="duyurular-card-image-wrapper">
        {canRenderImage ? (
          <img
            src={announcement.imageUrl ?? ""}
            alt=""
            className="duyurular-card-image"
            onError={onImageError}
          />
        ) : (
          <div className="duyurular-card-placeholder" aria-hidden>
            {announcement.sourceType === "instructor" ? (
              <UserRound size={28} />
            ) : (
              <Building2 size={28} />
            )}
          </div>
        )}
        <div className="duyurular-card-overlay" aria-hidden />
      </div>
      <div className="duyurular-card-content">
        <h3 className="duyurular-card-title">{announcement.title}</h3>
        {preview ? <p className="duyurular-card-preview">{preview}</p> : null}
        <div className="duyurular-card-footer">
          {announcement.ownerName ? (
            <span className="duyurular-card-owner">{announcement.ownerName}</span>
          ) : null}
          {hasLink ? (
            <span className="duyurular-card-link-indicator" aria-hidden>
              <Globe size={12} />
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function HomeAnnouncementsMarquee() {
  const [isMarqueeMounted, setIsMarqueeMounted] = useState(false);
  const [announcements, setAnnouncements] = useState<HomeAnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(() => new Set());
  const [activeAnnouncement, setActiveAnnouncement] = useState<HomeAnnouncementItem | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMarqueeMounted(true);
  }, []);

  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;

    const updateCardWidth = () => {
      const containerWidth = slider.getBoundingClientRect().width;
      const useTwoColumns = window.matchMedia("(max-width: 1180px)").matches;
      const columns = useTwoColumns ? 2 : 4;
      const gap = useTwoColumns ? 12 : 10;
      const cardWidth = (containerWidth - gap * (columns - 1)) / columns;
      slider.style.setProperty("--duyurular-card-width", `${Math.max(0, cardWidth)}px`);
    };

    updateCardWidth();
    const resizeObserver = new ResizeObserver(updateCardWidth);
    resizeObserver.observe(slider);
    window.addEventListener("resize", updateCardWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateCardWidth);
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
                const canRenderImage =
                  Boolean(announcement.imageUrl) && !brokenImageIds.has(announcement.id);

                return (
                  <HomeAnnouncementCard
                    key={`${announcement.id}-${index}`}
                    announcement={announcement}
                    isDuplicate={isDuplicate}
                    canRenderImage={canRenderImage}
                    onOpen={openAnnouncement}
                    onImageError={() =>
                      setBrokenImageIds((prev) => {
                        const next = new Set(prev);
                        next.add(announcement.id);
                        return next;
                      })
                    }
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
