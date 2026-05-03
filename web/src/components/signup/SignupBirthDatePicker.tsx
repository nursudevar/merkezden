"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WEEKDAY_LABELS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYY-MM-DD` veya boş */
function parseISODateLocal(iso: string): Date | null {
  const t = iso.trim();
  if (!t) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

function toISODateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDisplayTR(iso: string): string {
  const d = parseISODateLocal(iso);
  if (!d) return "";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildMonthGrid(view: Date): (number | null)[] {
  const first = startOfMonth(view);
  const lastDay = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= lastDay; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isSameDay(a: Date, y: number, m0: number, day: number): boolean {
  return a.getFullYear() === y && a.getMonth() === m0 && a.getDate() === day;
}

function compareYMD(y: number, m0: number, d: number, y2: number, m2: number, d2: number): number {
  if (y !== y2) return y - y2;
  if (m0 !== m2) return m0 - m2;
  return d - d2;
}

const MONTH_NAME_FMT = new Intl.DateTimeFormat("tr-TR", { month: "long" });

type SignupBirthDatePickerProps = {
  id: string;
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
};

export function SignupBirthDatePicker({ id, value, onChange, disabled }: SignupBirthDatePickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseISODateLocal(value), [value]);

  const anchorMonth = useCallback((): Date => {
    if (selected) return startOfMonth(selected);
    return startOfMonth(new Date());
  }, [selected]);

  const [view, setView] = useState<Date>(() => {
    const s = parseISODateLocal(value);
    if (s) return startOfMonth(s);
    return startOfMonth(new Date());
  });

  /** Açıkken üstten gelen değer değişirse (ör. Bugün) takvim ayını eşle */
  useEffect(() => {
    if (!open) return;
    setView(anchorMonth());
  }, [open, value, anchorMonth]);

  const cells = useMemo(() => buildMonthGrid(view), [view]);

  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();

  const viewYear = view.getFullYear();

  const birthYearOptions = useMemo(() => {
    const maxY = todayY;
    const minY = maxY - 100;
    const years = new Set<number>();
    for (let y = maxY; y >= minY; y -= 1) years.add(y);
    years.add(viewYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [todayY, viewYear]);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i,
        label: MONTH_NAME_FMT.format(new Date(2000, i, 1)),
        disabled: viewYear === todayY && i > todayM,
      })),
    [viewYear, todayY, todayM]
  );

  const setViewMonth = (monthIndex: number) => {
    setView((v) => new Date(v.getFullYear(), monthIndex, 1));
  };

  const setViewYear = (year: number) => {
    setView((v) => {
      let m = v.getMonth();
      if (year === todayY && m > todayM) m = todayM;
      return new Date(year, m, 1);
    });
  };

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      /* Radix Select içeriği portala taşınır; dışarı tıklama takvimi kapatmasın */
      if (t.closest("[data-radix-popper-content-wrapper]")) return;
      if (t.closest('[role="listbox"]')) return;
      const el = rootRef.current;
      if (!el) return;
      if (el.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /* Ay/yıl Radix select açıkken önce o kapanır; takvimi hemen kapatma */
      if (rootRef.current?.querySelector('[role="combobox"][data-state="open"]')) return;
      close();
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const pickDay = (day: number) => {
    const iso = toISODateLocal(new Date(view.getFullYear(), view.getMonth(), day));
    onChange(iso);
    close();
  };

  const display = formatDisplayTR(value);

  return (
    <div className="signup-date-picker" ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`signup-date-picker-trigger${display ? "" : " signup-date-picker-trigger--empty"}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => {
          setOpen((o) => {
            if (o) return false;
            setView(anchorMonth());
            return true;
          });
        }}
      >
        <span className="signup-date-picker-trigger-text">{display || "gg.aa.yyyy"}</span>
        <Calendar className="signup-date-picker-trigger-icon" aria-hidden size={18} strokeWidth={1.75} />
      </button>

      {open ? (
        <div className="signup-date-picker-popover" role="dialog" aria-label="Doğum tarihi" id={listId}>
          <div className="signup-date-picker-toolbar">
            <div className="signup-date-picker-select-wrap">
              <Select
                value={String(view.getMonth())}
                onValueChange={(v) => setViewMonth(Number(v))}
              >
                <SelectTrigger
                  size="sm"
                  className="signup-birth-select-trigger"
                  aria-label="Ay seçin"
                >
                  <SelectValue placeholder="Ay" />
                </SelectTrigger>
                <SelectContent
                  className="signup-birth-select-content"
                  position="popper"
                  side="bottom"
                  sideOffset={4}
                  align="start"
                >
                  {monthOptions.map((m) => (
                    <SelectItem
                      key={m.value}
                      value={String(m.value)}
                      disabled={m.disabled}
                      className="signup-birth-select-item"
                    >
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="signup-date-picker-select-wrap">
              <Select value={String(view.getFullYear())} onValueChange={(v) => setViewYear(Number(v))}>
                <SelectTrigger
                  size="sm"
                  className="signup-birth-select-trigger"
                  aria-label="Yıl seçin"
                >
                  <SelectValue placeholder="Yıl" />
                </SelectTrigger>
                <SelectContent
                  className="signup-birth-select-content signup-birth-select-content--year"
                  position="popper"
                  side="bottom"
                  sideOffset={4}
                  align="start"
                >
                  {birthYearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)} className="signup-birth-select-item">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="signup-date-picker-weekdays" aria-hidden>
            {WEEKDAY_LABELS.map((w) => (
              <span key={w} className="signup-date-picker-weekday">
                {w}
              </span>
            ))}
          </div>

          <div className="signup-date-picker-grid">
            {cells.map((day, idx) => {
              if (day == null) {
                return <span key={`e-${idx}`} className="signup-date-picker-cell signup-date-picker-cell--empty" />;
              }
              const y = view.getFullYear();
              const m0 = view.getMonth();
              const isSelected = selected ? isSameDay(selected, y, m0, day) : false;
              const isToday = y === todayY && m0 === todayM && day === todayD;
              const isFuture = compareYMD(y, m0, day, todayY, todayM, todayD) > 0;
              const cls = [
                "signup-date-picker-cell",
                "signup-date-picker-cell--day",
                isSelected ? "signup-date-picker-cell--selected" : "",
                isToday && !isSelected ? "signup-date-picker-cell--today" : "",
                isFuture ? "signup-date-picker-cell--disabled" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={`${y}-${m0}-${day}`}
                  type="button"
                  className={cls}
                  disabled={isFuture}
                  onClick={() => pickDay(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="signup-date-picker-footer">
            <button type="button" className="signup-date-picker-footer-link signup-date-picker-footer-link--clear" onClick={() => { onChange(""); close(); }}>
              Temizle
            </button>
            <button
              type="button"
              className="signup-date-picker-footer-link signup-date-picker-footer-link--today"
              onClick={() => {
                const d = new Date();
                onChange(toISODateLocal(d));
                setView(startOfMonth(d));
                close();
              }}
            >
              Bugün
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
