"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, CalendarDays } from "lucide-react";
import AnnouncementDetailModal, {
  type AnnouncementDetailItem,
} from "@/components/AnnouncementDetailModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  countUnreadAdminAnnouncements,
  fetchAdminAnnouncementReads,
  fetchPublicAdminAnnouncements,
  fetchPublishedAdminAnnouncementMetas,
  isAdminAnnouncementUnread,
  markAdminAnnouncementsRead,
  subscribeAdminAnnouncementReadChanges,
  type AdminAnnouncementReadMap,
  type PublicAdminAnnouncement,
  type PublicAdminAnnouncementMeta,
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

function formatUnreadBadge(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}

export function HeaderAnnouncementBell({ placement }: HeaderAnnouncementBellProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PublicAdminAnnouncement[] | null>(null);
  const [metas, setMetas] = useState<PublicAdminAnnouncementMeta[]>([]);
  const [reads, setReads] = useState<AdminAnnouncementReadMap>({});
  const [selected, setSelected] = useState<AnnouncementDetailItem | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const mountedRef = useRef(true);
  const markingIdsRef = useRef<Set<string>>(new Set());
  const refreshSeqRef = useRef(0);
  const readsRef = useRef<AdminAnnouncementReadMap>({});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    readsRef.current = reads;
  }, [reads]);

  const refreshReadState = useCallback(async () => {
    const seq = ++refreshSeqRef.current;
    const [metaResult, readResult] = await Promise.all([
      fetchPublishedAdminAnnouncementMetas(),
      fetchAdminAnnouncementReads(),
    ]);
    if (!mountedRef.current || seq !== refreshSeqRef.current) return;
    if (!metaResult.error) setMetas(metaResult.items);
    if (!readResult.error) setReads(readResult.reads);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshReadState();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshReadState]);

  useEffect(() => {
    return subscribeAdminAnnouncementReadChanges(() => {
      void refreshReadState();
    });
  }, [refreshReadState]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshReadState();
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [refreshReadState]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshReadState();
    };
    const onFocus = () => {
      void refreshReadState();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshReadState]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const [listResult] = await Promise.all([
          fetchPublicAdminAnnouncements(),
          refreshReadState(),
        ]);
        if (cancelled || !mountedRef.current) return;
        setItems(listResult.items);
        setError(listResult.error);
        setLoading(false);
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, refreshReadState]);

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

  const unreadCount = countUnreadAdminAnnouncements(metas, reads);
  const hasUnread = unreadCount > 0;

  const publishedById = useCallback((): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const meta of metas) map[meta.id] = meta.publishedAt;
    for (const item of items ?? []) map[item.id] = item.publishedAt;
    return map;
  }, [items, metas]);

  const markReadOptimistic = useCallback(
    async (ids: string[]) => {
      const unique = [...new Set(ids.filter(Boolean))];
      const pending = unique.filter((id) => !markingIdsRef.current.has(id));
      if (pending.length === 0) return;

      const publishedMap = publishedById();
      const previousSlice: AdminAnnouncementReadMap = {};
      const appliedIds: string[] = [];
      const current = readsRef.current;
      const next = { ...current };

      for (const id of pending) {
        const publishedAt = publishedMap[id];
        if (!publishedAt) continue;
        if (current[id] !== undefined) previousSlice[id] = current[id];
        next[id] = publishedAt;
        appliedIds.push(id);
        markingIdsRef.current.add(id);
      }

      if (appliedIds.length === 0) return;
      readsRef.current = next;
      setReads(next);

      const result = await markAdminAnnouncementsRead(appliedIds, publishedMap);
      for (const id of appliedIds) markingIdsRef.current.delete(id);
      if (!mountedRef.current) return;
      if (!result.ok) {
        const restored = { ...readsRef.current };
        for (const id of appliedIds) {
          if (Object.prototype.hasOwnProperty.call(previousSlice, id)) {
            restored[id] = previousSlice[id];
          } else {
            delete restored[id];
          }
        }
        readsRef.current = restored;
        setReads(restored);
      }
    },
    [publishedById],
  );

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
    if (isAdminAnnouncementUnread(item.publishedAt, reads[item.id])) {
      void markReadOptimistic([item.id]);
    }
  };

  const markAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    const unreadIds = metas
      .filter((meta) => isAdminAnnouncementUnread(meta.publishedAt, reads[meta.id]))
      .map((meta) => meta.id);
    await markReadOptimistic(unreadIds);
    if (mountedRef.current) setMarkingAll(false);
  };

  return (
    <div
      className={`header-announcement-bell header-announcement-bell--${placement}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="header-announcement-bell-btn"
        aria-label={hasUnread ? `Duyurular, ${unreadCount} okunmamış` : "Duyurular"}
        aria-expanded={open}
        aria-controls={listId}
        onClick={(event) => {
          event.stopPropagation();
          toggleOpen();
        }}
      >
        <Bell className="header-announcement-bell-icon" aria-hidden />
        {hasUnread ? (
          <span className="header-announcement-bell-badge" aria-hidden>
            {formatUnreadBadge(unreadCount)}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={listId}
          className="header-announcement-dropdown"
          role="dialog"
          aria-label="Duyurular"
        >
          <div className="header-announcement-dropdown-header">
            <p className="header-announcement-dropdown-title">Duyurular</p>
            {hasUnread ? (
              <button
                type="button"
                className="header-announcement-mark-all"
                disabled={markingAll}
                onClick={() => void markAllRead()}
              >
                Tümünü okundu işaretle
              </button>
            ) : null}
          </div>
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
                const unread = isAdminAnnouncementUnread(item.publishedAt, reads[item.id]);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`header-announcement-dropdown-item${
                        unread ? " header-announcement-dropdown-item--unread" : ""
                      }`}
                      onClick={() => openAnnouncement(item)}
                    >
                      <span className="header-announcement-dropdown-item-title-row">
                        {unread ? (
                          <span className="header-announcement-unread-dot" aria-hidden />
                        ) : null}
                        <span className="header-announcement-dropdown-item-title">{item.title}</span>
                      </span>
                      {preview ? (
                        <span className="header-announcement-dropdown-item-preview">{preview}</span>
                      ) : null}
                      {dateLabel ? (
                        <span className="header-announcement-dropdown-item-date">
                          <CalendarDays
                            className="header-announcement-dropdown-item-date-icon"
                            aria-hidden
                          />
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
