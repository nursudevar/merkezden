"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

type Props = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  placeholder?: string;
};

const PAD = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => PAD(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => PAD(i));

function parseHHMM(value: string): { h: string; m: string } {
  const v = String(value ?? "").trim();
  const match = v.match(/^(\d{2}):(\d{2})$/);
  if (!match) return { h: "", m: "" };
  return { h: match[1], m: match[2] };
}

export function WorkingHoursTimePicker({
  id,
  value,
  onChange,
  disabled,
  ariaLabel,
  placeholder = "--:--",
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLUListElement>(null);
  const minuteListRef = useRef<HTMLUListElement>(null);

  const { h, m } = parseHHMM(value);
  const display = h && m ? `${h}:${m}` : "";

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const scrollSelected = (list: HTMLUListElement | null) => {
      if (!list) return;
      const sel = list.querySelector<HTMLElement>("[data-selected='true']");
      if (sel) {
        list.scrollTop = Math.max(0, sel.offsetTop - list.clientHeight / 2 + sel.clientHeight / 2);
      }
    };
    scrollSelected(hourListRef.current);
    scrollSelected(minuteListRef.current);
  }, [open]);

  const handleHour = (next: string) => {
    const mm = m || "00";
    onChange(`${next}:${mm}`);
  };
  const handleMinute = (next: string) => {
    const hh = h || "00";
    onChange(`${hh}:${next}`);
  };

  return (
    <div ref={rootRef} className="working-hours-picker">
      <button
        id={id}
        type="button"
        className={`working-hours-picker__trigger${open ? " is-open" : ""}`}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span
          className={`working-hours-picker__value${display ? "" : " is-placeholder"}`}
        >
          {display || placeholder}
        </span>
        <Clock size={18} className="working-hours-picker__icon" aria-hidden />
      </button>
      {open && !disabled ? (
        <div className="working-hours-picker__menu" role="dialog" aria-label={ariaLabel}>
          <div className="working-hours-picker__col-wrap">
            <span className="working-hours-picker__col-label">SAAT</span>
            <ul ref={hourListRef} className="working-hours-picker__col" role="listbox" aria-label="Saat">
              {HOURS.map((hh) => {
                const isSelected = hh === h;
                return (
                  <li key={hh}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-selected={isSelected ? "true" : "false"}
                      className={`working-hours-picker__opt${isSelected ? " is-selected" : ""}`}
                      onClick={() => handleHour(hh)}
                    >
                      {hh}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="working-hours-picker__col-wrap">
            <span className="working-hours-picker__col-label">DAKİKA</span>
            <ul ref={minuteListRef} className="working-hours-picker__col" role="listbox" aria-label="Dakika">
              {MINUTES.map((mm) => {
                const isSelected = mm === m;
                return (
                  <li key={mm}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-selected={isSelected ? "true" : "false"}
                      className={`working-hours-picker__opt${isSelected ? " is-selected" : ""}`}
                      onClick={() => handleMinute(mm)}
                    >
                      {mm}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
