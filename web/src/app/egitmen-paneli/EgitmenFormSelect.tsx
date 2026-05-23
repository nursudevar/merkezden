"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  options: readonly string[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
};

export function EgitmenFormSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Seçiniz",
  ariaLabel,
  disabled,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const display = value.trim() || placeholder;
  const isPlaceholder = !value.trim();

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

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="egitmen-panel-form-dropdown">
      <button
        type="button"
        id={id}
        className={`egitmen-panel-form-dropdown-trigger${open ? " is-open" : ""}${
          isPlaceholder ? " is-placeholder" : ""
        }`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
      >
        <span className="egitmen-panel-form-dropdown-label" title={display}>
          {display}
        </span>
      </button>
      {open && !disabled ? (
        <div
          id={listId}
          className="egitmen-panel-form-dropdown-menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          <button
            type="button"
            role="option"
            aria-selected={!value.trim()}
            className={`egitmen-panel-form-dropdown-option${
              !value.trim() ? " egitmen-panel-form-dropdown-option--selected" : ""
            }`}
            onClick={() => pick("")}
          >
            {placeholder}
          </button>
          {options.map((option) => {
            const isSelected = value === option;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`egitmen-panel-form-dropdown-option${
                  isSelected ? " egitmen-panel-form-dropdown-option--selected" : ""
                }`}
                onClick={() => pick(option)}
                title={option}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
