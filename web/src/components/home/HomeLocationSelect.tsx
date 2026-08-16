"use client";

import { useMemo, useState } from "react";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import {
  locationOptionMatches,
  type TurkiyeLocationOption,
} from "@/lib/turkiyeLocationsClient";

type HomeLocationSelectProps = {
  id?: string;
  value: string | undefined;
  options: TurkiyeLocationOption[];
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
  allValue?: string;
  allLabel?: string;
  onValueChange: (nextValue: string) => void;
};

export function HomeLocationSelect({
  id,
  value,
  options,
  placeholder,
  searchPlaceholder,
  disabled,
  allValue,
  allLabel,
  onValueChange,
}: HomeLocationSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const matches = options.filter((option) => locationOptionMatches(option.ad, query));
    if (!value || value === allValue) return matches;
    const selected = options.find((option) => String(option.id) === value);
    if (!selected || matches.some((option) => option.id === selected.id)) return matches;
    return [selected, ...matches];
  }, [allValue, options, query, value]);

  return (
    <Select
      value={value || undefined}
      onValueChange={onValueChange}
      disabled={disabled}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setQuery("");
      }}
    >
      <SelectTrigger id={id} className="location-input" aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        className="select-content home-location-dropdown"
        side="bottom"
        avoidCollisions={false}
      >
        <div
          className="home-location-dropdown-search"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            className="home-location-dropdown-search-input"
            placeholder={searchPlaceholder}
            autoComplete="off"
          />
        </div>
        {allValue && allLabel && locationOptionMatches(allLabel, query) ? (
          <SelectItem value={allValue} className="select-item">
            {allLabel}
          </SelectItem>
        ) : null}
        {filteredOptions.length === 0 ? (
          <div className="home-location-dropdown-empty">Sonuç bulunamadı</div>
        ) : (
          filteredOptions.map((option) => (
            <SelectItem key={option.id} value={String(option.id)} className="select-item">
              {option.ad}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
