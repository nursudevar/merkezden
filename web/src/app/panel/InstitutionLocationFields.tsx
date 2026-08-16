"use client";

import { useEffect, useImperativeHandle, useMemo, useState, forwardRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeProfileSearchText } from "@/lib/profileSearch";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";

export type LocationOption = {
  id: number;
  ad: string;
};

export type InstitutionLocationFieldsHandle = {
  getSelectedNames: () => { city: string; district: string };
};

type InstitutionLocationFieldsProps = {
  ilId: string;
  ilceId: string;
  mahalleId: string;
  disabled?: boolean;
  onIlChange: (ilId: string, ilAd: string) => void;
  onIlceChange: (ilceId: string, ilceAd: string) => void;
  onMahalleChange: (mahalleId: string, mahalleAd: string) => void;
};

const LOCATION_PAGE_SIZE = 1000;

export function toLocationIdString(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed) && parsed > 0) return String(parsed);
    }
  }
  return "";
}

function sortLocationOptions(rows: LocationOption[]): LocationOption[] {
  return [...rows].sort((a, b) => a.ad.localeCompare(b.ad, "tr", { sensitivity: "base" }));
}

function parseLocationRows(data: unknown): LocationOption[] {
  if (!Array.isArray(data)) return [];
  const rows: LocationOption[] = [];
  const seen = new Set<number>();
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const id = Number((item as { id?: unknown }).id);
    const ad = String((item as { ad?: unknown }).ad ?? "").trim();
    if (!Number.isFinite(id) || id <= 0 || !ad || seen.has(id)) continue;
    seen.add(id);
    rows.push({ id, ad });
  }
  return sortLocationOptions(rows);
}

function locationOptionMatches(ad: string, query: string): boolean {
  const needle = normalizeProfileSearchText(query);
  if (!needle) return true;
  return normalizeProfileSearchText(ad).includes(needle);
}

async function fetchLocationRows(
  table: "iller" | "ilceler" | "mahalleler",
  filter?: { column: "il_id" | "ilce_id"; value: number },
): Promise<LocationOption[]> {
  const supabase = createSupabaseBrowserClient();
  const all: LocationOption[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select("id, ad")
      .order("id", { ascending: true })
      .range(from, from + LOCATION_PAGE_SIZE - 1);
    if (filter) {
      query = query.eq(filter.column, filter.value);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message || `${table} yüklenemedi.`);
    }
    const page = parseLocationRows(data);
    all.push(...page);
    if (!data || data.length < LOCATION_PAGE_SIZE) break;
    from += LOCATION_PAGE_SIZE;
  }

  return sortLocationOptions(all);
}

function SearchableLocationSelect({
  id,
  value,
  options,
  placeholder,
  searchPlaceholder,
  disabled,
  onValueChange,
}: {
  id: string;
  value: string;
  options: LocationOption[];
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
  onValueChange: (nextValue: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const matches = options.filter((option) => locationOptionMatches(option.ad, query));
    if (!value) return matches;
    const selected = options.find((option) => String(option.id) === value);
    if (!selected || matches.some((option) => option.id === selected.id)) return matches;
    return [selected, ...matches];
  }, [options, query, value]);

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
      <SelectTrigger
        id={id}
        className="panel-institution-location-select"
        aria-label={placeholder}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        sideOffset={4}
        className="select-content panel-institution-location-select-content"
      >
        <div
          className="panel-institution-location-select-search"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            className="panel-institution-location-select-search-input"
            placeholder={searchPlaceholder}
            autoComplete="off"
          />
        </div>
        {filteredOptions.length === 0 ? (
          <div className="panel-institution-location-select-empty">Sonuç bulunamadı</div>
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

export const InstitutionLocationFields = forwardRef<
  InstitutionLocationFieldsHandle,
  InstitutionLocationFieldsProps
>(function InstitutionLocationFields(
  { ilId, ilceId, mahalleId, disabled = false, onIlChange, onIlceChange, onMahalleChange },
  ref,
) {
  const [iller, setIller] = useState<LocationOption[]>([]);
  const [ilceler, setIlceler] = useState<LocationOption[]>([]);
  const [mahalleler, setMahalleler] = useState<LocationOption[]>([]);

  useImperativeHandle(
    ref,
    () => ({
      getSelectedNames: () => ({
        city: iller.find((row) => String(row.id) === ilId)?.ad ?? "",
        district: ilceler.find((row) => String(row.id) === ilceId)?.ad ?? "",
      }),
    }),
    [iller, ilceler, ilId, ilceId],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchLocationRows("iller");
        if (!cancelled) setIller(rows);
      } catch (error) {
        console.error("İller yüklenemedi:", error);
        if (!cancelled) setIller([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const selectedIlId = Number(ilId);
    if (!Number.isFinite(selectedIlId) || selectedIlId <= 0) {
      setIlceler([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchLocationRows("ilceler", { column: "il_id", value: selectedIlId });
        if (!cancelled) setIlceler(rows);
      } catch (error) {
        console.error("İlçeler yüklenemedi:", error);
        if (!cancelled) setIlceler([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ilId]);

  useEffect(() => {
    const selectedIlceId = Number(ilceId);
    if (!Number.isFinite(selectedIlceId) || selectedIlceId <= 0) {
      setMahalleler([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchLocationRows("mahalleler", {
          column: "ilce_id",
          value: selectedIlceId,
        });
        if (!cancelled) setMahalleler(rows);
      } catch (error) {
        console.error("Mahalleler yüklenemedi:", error);
        if (!cancelled) setMahalleler([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ilceId]);

  return (
    <>
      <div className="panel-institution-form-row">
        <div className="panel-institution-form-field">
          <label className="panel-institution-form-label" htmlFor="panel-institution-il">
            İl
          </label>
          <SearchableLocationSelect
            id="panel-institution-il"
            value={ilId}
            options={iller}
            placeholder="İl seçiniz"
            searchPlaceholder="İl ara"
            disabled={disabled}
            onValueChange={(nextIlId) => {
              const selected = iller.find((row) => String(row.id) === nextIlId);
              onIlChange(nextIlId, selected?.ad ?? "");
            }}
          />
        </div>
        <div className="panel-institution-form-field">
          <label className="panel-institution-form-label" htmlFor="panel-institution-ilce">
            İlçe
          </label>
          <SearchableLocationSelect
            id="panel-institution-ilce"
            value={ilceId}
            options={ilceler}
            placeholder="İlçe seçiniz"
            searchPlaceholder="İlçe ara"
            disabled={disabled || !ilId}
            onValueChange={(nextIlceId) => {
              const selected = ilceler.find((row) => String(row.id) === nextIlceId);
              onIlceChange(nextIlceId, selected?.ad ?? "");
            }}
          />
        </div>
      </div>
      <div className="panel-institution-form-row panel-institution-form-row--full">
        <div className="panel-institution-form-field">
          <label className="panel-institution-form-label" htmlFor="panel-institution-mahalle">
            Mahalle
          </label>
          <SearchableLocationSelect
            id="panel-institution-mahalle"
            value={mahalleId}
            options={mahalleler}
            placeholder="Mahalle seçiniz"
            searchPlaceholder="Mahalle ara"
            disabled={disabled || !ilceId}
            onValueChange={(nextMahalleId) => {
              const selected = mahalleler.find((row) => String(row.id) === nextMahalleId);
              onMahalleChange(nextMahalleId, selected?.ad ?? "");
            }}
          />
        </div>
      </div>
    </>
  );
});

InstitutionLocationFields.displayName = "InstitutionLocationFields";
