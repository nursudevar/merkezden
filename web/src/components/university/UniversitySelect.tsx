"use client";

import { useEffect, useMemo, useState } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon } from "lucide-react";
import { Input, Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui";
import {
  fetchActiveUniversities,
  formatUniversityMeta,
  universityNameMatches,
  type UniversityRow,
} from "@/lib/universitiesClient";

type UniversitySelectVariant = "signup" | "panel";

type UniversitySelectProps = {
  id?: string;
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  variant?: UniversitySelectVariant;
  ariaLabel?: string;
};

function UniversitySelectItem({
  value,
  name,
  meta,
}: {
  value: string;
  name: string;
  meta: string;
}) {
  return (
    <SelectPrimitive.Item className="select-item university-select-item" value={value}>
      <span className="select-item-indicator">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="select-item-check-icon" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <span className="university-select-item-copy">
        <SelectPrimitive.ItemText>{name}</SelectPrimitive.ItemText>
        {meta ? <span className="university-select-item-meta">{meta}</span> : null}
      </span>
    </SelectPrimitive.Item>
  );
}

export function UniversitySelect({
  id,
  value,
  onChange,
  placeholder = "Üniversite seçin",
  disabled = false,
  hasError = false,
  variant = "signup",
  ariaLabel,
}: UniversitySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [universities, setUniversities] = useState<UniversityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchActiveUniversities()
      .then((rows) => {
        if (cancelled) return;
        setUniversities(rows);
      })
      .catch((error) => {
        console.error("[universities] fetch:", error);
        if (!cancelled) setUniversities([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedName = String(value ?? "").trim();

  const options = useMemo(() => {
    const list = [...universities];
    if (
      selectedName &&
      !list.some((row) => row.name === selectedName)
    ) {
      list.unshift({ id: 0, name: selectedName, type: null, city: null });
    }
    return list;
  }, [selectedName, universities]);

  const filteredOptions = useMemo(() => {
    const matches = options.filter((row) => universityNameMatches(row.name, query));
    if (!selectedName) return matches;
    const selected = options.find((row) => row.name === selectedName);
    if (!selected || matches.some((row) => row.id === selected.id && row.name === selected.name)) {
      return matches;
    }
    return [selected, ...matches];
  }, [options, query, selectedName]);

  const triggerClassName =
    variant === "panel"
      ? `university-select-trigger university-select-trigger--panel${hasError ? " university-select-trigger--error" : ""}`
      : `signup-category-select-trigger university-select-trigger${hasError ? " signup-category-select-trigger--error" : ""}`;

  const contentClassName =
    variant === "panel"
      ? "university-select-content university-select-content--panel"
      : "signup-category-select-content university-select-content";

  return (
    <Select
      value={selectedName}
      onValueChange={onChange}
      disabled={disabled || loading}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setQuery("");
      }}
    >
      <SelectTrigger
        id={id}
        className={triggerClassName}
        aria-label={ariaLabel || placeholder}
        aria-invalid={hasError ? true : undefined}
      >
        <SelectValue placeholder={loading ? "Üniversiteler yükleniyor..." : placeholder} />
      </SelectTrigger>
      <SelectContent
        className={contentClassName}
        position="popper"
        side="bottom"
        sideOffset={6}
        align="start"
      >
        <div
          className="university-select-search"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            className="university-select-search-input"
            placeholder="Üniversite ara"
            autoComplete="off"
          />
        </div>
        {filteredOptions.length === 0 ? (
          <div className="university-select-empty">Sonuç bulunamadı</div>
        ) : (
          filteredOptions.map((row) => (
            <UniversitySelectItem
              key={row.id > 0 ? row.id : `legacy-${row.name}`}
              value={row.name}
              name={row.name}
              meta={formatUniversityMeta(row)}
            />
          ))
        )}
      </SelectContent>
    </Select>
  );
}
