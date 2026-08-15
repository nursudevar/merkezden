"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Globe, X } from "lucide-react";
import "@/styles/components/announcement-detail-modal.scss";

export type AnnouncementDetailItem = {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string | null;
  institutionName: string;
  linkUrl: string | null;
  announcementTag?: string | null;
  ownerHref?: string | null;
};

interface AnnouncementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcement: AnnouncementDetailItem | null;
}

function formatAnnouncementDateTr(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function ensureAbsoluteUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function formatLinkLabel(url: string): string {
  try {
    const u = new URL(ensureAbsoluteUrl(url));
    const path = u.pathname && u.pathname !== "/" ? u.pathname : "";
    return u.host.replace(/^www\./i, "") + path;
  } catch {
    return url;
  }
}

export default function AnnouncementDetailModal({
  isOpen,
  onClose,
  announcement,
}: AnnouncementDetailModalProps) {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsRedirecting(false);
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isRedirecting) onClose();
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose, isRedirecting]);

  if (!isOpen || !announcement) return null;

  const dateText = formatAnnouncementDateTr(announcement.createdAt);
  const trimmedLink = (announcement.linkUrl ?? "").trim();
  const hasLink = trimmedLink.length > 0;

  return (
    <div
      className="announcement-modal-overlay"
      onClick={isRedirecting ? undefined : onClose}
      role="presentation"
    >
      <div
        className="announcement-modal-content announcement-modal-content--parchment"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-modal-title"
        aria-busy={isRedirecting}
        onClick={(event) => {
          event.stopPropagation();
          if (isRedirecting) return;
          if ((event.target as HTMLElement).closest("a, button")) return;
          const ownerHref = (announcement.ownerHref ?? "").trim();
          if (!ownerHref) return;
          setIsRedirecting(true);
          router.push(ownerHref);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/duyuru-modal-bg.png"
          alt=""
          aria-hidden="true"
          className="announcement-modal-parchment-bg"
        />

        <button
          type="button"
          className="announcement-modal-close"
          aria-label="Kapat"
          disabled={isRedirecting}
          onClick={onClose}
        >
          <X size={18} />
        </button>

        <div className="announcement-modal-body">
          <div className="announcement-modal-layout">
            <div className="announcement-modal-info">
              {announcement.institutionName ? (
                <div className="announcement-modal-kicker">
                  {announcement.institutionName.toLocaleUpperCase("tr-TR")}
                </div>
              ) : null}

              {dateText ? (
                <div className="announcement-modal-meta">
                  <span className="announcement-modal-meta-item">
                    <CalendarDays className="announcement-modal-meta-icon" />
                    {dateText}
                  </span>
                </div>
              ) : null}

              {announcement.imageUrl ? (
                <div className="announcement-modal-media-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={announcement.imageUrl}
                    alt={announcement.title}
                    className="announcement-modal-media-image announcement-modal-image"
                  />
                </div>
              ) : null}

              {hasLink ? (
                <a
                  className="announcement-modal-link"
                  href={ensureAbsoluteUrl(trimmedLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Globe className="announcement-modal-link-icon" />
                  <span className="announcement-modal-link-text">{formatLinkLabel(trimmedLink)}</span>
                </a>
              ) : null}
            </div>

            <div className="announcement-modal-detail">
              <div className="announcement-modal-detail-header">
                <h2 id="announcement-modal-title" className="announcement-modal-title">
                  {announcement.title}
                </h2>
                <hr className="announcement-modal-title-separator" aria-hidden="true" />
              </div>

              <div className="announcement-modal-detail-scroll">
                {announcement.content ? (
                  <p className="announcement-modal-desc">{announcement.content}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
      {isRedirecting ? (
        <div className="announcement-modal-redirecting" role="status" aria-live="polite">
          Yükleniyor...
        </div>
      ) : null}
    </div>
  );
}
