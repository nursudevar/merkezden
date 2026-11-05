"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import AnnouncementDetailModal, {
  type AnnouncementDetailItem,
} from "@/components/AnnouncementDetailModal";
import {
  getAnnouncementTagTone,
  type AnnouncementTagTone,
} from "@/lib/announcementTags";
import {
  fetchCalendarMonthAnnouncements,
  type CalendarAnnouncementItem,
  type CalendarAnnouncementSource,
} from "@/components/home/homeCalendarAnnouncementsClient";
import "@/styles/components/home-calendar-announcements.scss";

const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"] as const;
const SOURCE_LABEL: Record<CalendarAnnouncementSource, string> = {
  admin: "Merkezden",
  institution: "Kurum",
  instructor: "Eğitmen",
};
const VISIBLE_CARD_COUNT = 3;

function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function buildMonthCells(year: number, monthIndex: number): Array<Date | null> {
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<Date | null> = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, monthIndex, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function publicationTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function HomeCalendarAnnouncementsSection() {
  const today = useMemo(() => new Date(), []);
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState(today);
  const [items, setItems] = useState<CalendarAnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<AnnouncementDetailItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchCalendarMonthAnnouncements(visibleYear, visibleMonth);
      if (cancelled) return;
      setItems(result.items);
      setError(result.error);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [visibleYear, visibleMonth]);

  const selectedKey = localDateKey(selected);
  const dayItems = useMemo(
    () => items.filter((item) => item.dayKey === selectedKey),
    [items, selectedKey],
  );
  const dotsByDay = useMemo(() => {
    const map = new Map<string, AnnouncementTagTone[]>();
    for (const item of items) {
      if (!item.announcementTag) continue;
      const tone = getAnnouncementTagTone(item.announcementTag);
      const current = map.get(item.dayKey) ?? [];
      if (!current.includes(tone) && current.length < 3) {
        current.push(tone);
        map.set(item.dayKey, current);
      }
    }
    return map;
  }, [items]);

  const cells = buildMonthCells(visibleYear, visibleMonth);
  const monthLabel = new Date(visibleYear, visibleMonth, 1).toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });
  const selectedLabel = selected.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  const visibleCards = expanded ? dayItems : dayItems.slice(0, VISIBLE_CARD_COUNT);

  const shiftMonth = (delta: number) => {
    const next = new Date(visibleYear, visibleMonth + delta, 1);
    const nextYear = next.getFullYear();
    const nextMonth = next.getMonth();
    const todayInNext = today.getFullYear() === nextYear && today.getMonth() === nextMonth;
    const selectedInNext = selected.getFullYear() === nextYear && selected.getMonth() === nextMonth;
    setLoading(true);
    setExpanded(false);
    setVisibleYear(nextYear);
    setVisibleMonth(nextMonth);
    if (!selectedInNext) setSelected(todayInNext ? today : next);
  };

  const openDetail = (item: CalendarAnnouncementItem) => {
    setActive({
      id: item.id,
      title: item.title,
      content: item.content,
      imageUrl: null,
      publishedAt: item.publishedAt,
      institutionName: item.ownerName,
      linkUrl: item.linkUrl,
      announcementTag: item.announcementTag,
      ownerHref: item.ownerHref,
    });
  };

  return (
    <section className="home-cal-announcements" aria-label="Takvim ve duyurular">
      <div className="home-cal-announcements-header">
        <h2 className="home-cal-announcements-title">
          <CalendarDays className="home-cal-announcements-title-icon" aria-hidden />
          Takvim &amp; Duyurular
        </h2>
        <Link href="/duyurular" className="home-cal-announcements-all">
          Tümünü Gör
        </Link>
      </div>

      <div className="home-cal-announcements-grid">
        <div className="home-cal-announcements-calendar">
          <div className="home-cal-announcements-calendar-nav">
            <p className="home-cal-announcements-month">{monthLabel}</p>
            <div className="home-cal-announcements-nav-buttons">
              <button type="button" onClick={() => shiftMonth(-1)} aria-label="Önceki ay">
                <ChevronLeft aria-hidden />
              </button>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="Sonraki ay">
                <ChevronRight aria-hidden />
              </button>
            </div>
          </div>
          <div className="home-cal-announcements-weekdays" aria-hidden>
            {WEEKDAYS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="home-cal-announcements-days" role="grid" aria-label={monthLabel}>
            {cells.map((date, index) => {
              if (!date) return <span key={`empty-${index}`} />;
              const key = localDateKey(date);
              const selectedDay = key === selectedKey;
              const tones = dotsByDay.get(key) ?? [];
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  className={selectedDay ? "is-selected" : undefined}
                  aria-pressed={selectedDay}
                  aria-label={date.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}
                  onClick={() => {
                    setSelected(date);
                    setExpanded(false);
                  }}
                >
                  <span>{date.getDate()}</span>
                  <span className="home-cal-announcements-dots" aria-hidden>
                    {tones.map((tone) => (
                      <i key={tone} className={`home-cal-announcements-dot home-cal-announcements-dot--${tone}`} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="home-cal-announcements-summary">
            {selectedLabel} · {loading ? "…" : `${dayItems.length} duyuru`}
          </p>
        </div>

        <div className="home-cal-announcements-list">
          <h3>Seçili günün duyuruları</h3>
          {loading ? <p className="home-cal-announcements-status">Yükleniyor…</p> : null}
          {!loading && error ? <p className="home-cal-announcements-status">{error}</p> : null}
          {!loading && !error && dayItems.length === 0 ? (
            <p className="home-cal-announcements-status">Bu tarihte duyuru yok.</p>
          ) : null}
          {!loading && !error && dayItems.length > 0 ? (
            <>
              <ul>
                {visibleCards.map((item) => {
                  const tone = item.announcementTag ? getAnnouncementTagTone(item.announcementTag) : item.source;
                  const time = publicationTime(item.publishedAt);
                  return (
                    <li key={item.id}>
                      <div className="home-cal-announcements-card-top">
                        <span className={`home-cal-announcements-source-dot home-cal-announcements-dot--${tone}`} />
                        <span className="home-cal-announcements-source">{SOURCE_LABEL[item.source]}</span>
                        {time ? <time dateTime={item.publishedAt}>{time}</time> : null}
                      </div>
                      <p className="home-cal-announcements-card-title">{item.title}</p>
                      <div className="home-cal-announcements-card-bottom">
                        <span>{item.ownerName}</span>
                        <button type="button" onClick={() => openDetail(item)}>
                          Detay
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {dayItems.length > VISIBLE_CARD_COUNT ? (
                <button
                  type="button"
                  className="home-cal-announcements-more"
                  onClick={() => setExpanded((current) => !current)}
                >
                  {expanded ? "Daha az göster" : `Diğer duyurular (${dayItems.length - VISIBLE_CARD_COUNT})`}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <AnnouncementDetailModal
        isOpen={active !== null}
        onClose={() => setActive(null)}
        announcement={active}
      />
    </section>
  );
}
