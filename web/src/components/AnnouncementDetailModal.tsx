"use client";

import { useEffect } from "react";
import { CalendarDays, Globe, ImageOff, X } from "lucide-react";
import "@/styles/components/announcement-detail-modal.scss";

export type AnnouncementDetailItem = {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string | null;
  institutionName: string;
  linkUrl: string | null;
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
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !announcement) return null;

  const dateText = formatAnnouncementDateTr(announcement.createdAt);
  const trimmedLink = (announcement.linkUrl ?? "").trim();
  const hasLink = trimmedLink.length > 0;

  return (
    <div className="announcement-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="announcement-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="announcement-modal-close"
          aria-label="Kapat"
          onClick={onClose}
        >
          <X size={18} />
        </button>

        <div
          className={`announcement-modal-media${
            announcement.imageUrl ? "" : " announcement-modal-media--empty"
          }`}
          style={
            announcement.imageUrl
              ? { backgroundImage: `url("${announcement.imageUrl}")` }
              : undefined
          }
          aria-hidden
        >
          {!announcement.imageUrl ? (
            <ImageOff
              className="announcement-modal-media-icon"
              size={48}
              strokeWidth={1.25}
            />
          ) : null}
        </div>

        <div className="announcement-modal-body">
          {announcement.institutionName ? (
            <div className="announcement-modal-kicker">
              {announcement.institutionName.toLocaleUpperCase("tr-TR")}
            </div>
          ) : null}

          <h2 id="announcement-modal-title" className="announcement-modal-title">
            {announcement.title}
          </h2>

          {dateText ? (
            <div className="announcement-modal-meta">
              <span className="announcement-modal-meta-item">
                <CalendarDays className="announcement-modal-meta-icon" />
                {dateText}
              </span>
            </div>
          ) : null}

          {announcement.content ? (
            <p className="announcement-modal-desc">{announcement.content}</p>
          ) : null}

          {hasLink ? (
            <a
              className="announcement-modal-link"
              href={ensureAbsoluteUrl(trimmedLink)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Globe className="announcement-modal-link-icon" />
              <span className="announcement-modal-link-text">
                {formatLinkLabel(trimmedLink)}
              </span>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
