"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Bell, CalendarDays } from "lucide-react";
import AnnouncementDetailModal, {
  type AnnouncementDetailItem,
} from "@/components/AnnouncementDetailModal";
import {
  fetchPublicAdminAnnouncements,
  type PublicAdminAnnouncement,
} from "@/lib/publicAdminAnnouncements";

type HeaderAnnouncementBellProps = {
  placement: "mobile" | "desktop";
};

function previewContent(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= 90) return normalized;
  return `${normalized.slice(0, 90).trim()}…`;
}

function formatPublicationDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

export function HeaderAnnouncementBell({ placement }: HeaderAnnouncementBellProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PublicAdminAnnouncement[] | null>(null);
  const [selected, setSelected] = useState<AnnouncementDetailItem | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchPublicAdminAnnouncements();
      if (cancelled) return;
      setItems(result.items);
      setError(result.error);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      if (next) {
        setLoading(true);
        setError(null);
      }
      return next;
    });
  };

  const openAnnouncement = (item: PublicAdminAnnouncement) => {
    setSelected({
      id: item.id,
      title: item.title,
      content: item.content,
      imageUrl: item.imageUrl,
      publishedAt: item.publishedAt,
      institutionName: "Merkezden",
      linkUrl: item.linkUrl,
      announcementTag: item.announcementTag,
    });
    setOpen(false);
  };

  return (
    <div
      className={`header-announcement-bell header-announcement-bell--${placement}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="header-announcement-bell-btn"
        aria-label="Duyurular"
        aria-expanded={open}
        aria-controls={listId}
        onClick={(event) => {
          event.stopPropagation();
          toggleOpen();
        }}
      >
        <Bell className="header-announcement-bell-icon" aria-hidden />
      </button>
      {open ? (
        <div
          id={listId}
          className="header-announcement-dropdown"
          role="dialog"
          aria-label="Duyurular"
        >
          <p className="header-announcement-dropdown-title">Duyurular</p>
          {loading ? (
            <p className="header-announcement-dropdown-status">Yükleniyor...</p>
          ) : error ? (
            <p className="header-announcement-dropdown-status">{error}</p>
          ) : !items || items.length === 0 ? (
            <p className="header-announcement-dropdown-status">Şu anda duyuru bulunmuyor.</p>
          ) : (
            <ul className="header-announcement-dropdown-list">
              {items.map((item) => {
                const preview = previewContent(item.content);
                const dateLabel = formatPublicationDate(item.publishedAt);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="header-announcement-dropdown-item"
                      onClick={() => openAnnouncement(item)}
                    >
                      <span className="header-announcement-dropdown-item-title">{item.title}</span>
                      {preview ? (
                        <span className="header-announcement-dropdown-item-preview">{preview}</span>
                      ) : null}
                      {dateLabel ? (
                        <span className="header-announcement-dropdown-item-date">
                          <CalendarDays className="header-announcement-dropdown-item-date-icon" aria-hidden />
                          {dateLabel}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
      <AnnouncementDetailModal
        isOpen={selected !== null}
        announcement={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
