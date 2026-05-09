"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type CategoryResultItem = {
  id: string;
  name: string;
  description: string;
  location: string;
  price: string | number;
  ageRange: string;
  rating: number;
  reviewCount: number;
  badges: string[];
  logoInitial?: string;
  logoColor?: string;
  imageUrl?: string;
  slug?: string;
  source?: string | null;
  subcategoryName?: string;
};

type InstitutionTypeJoinRow =
  | { name: string | null }
  | Array<{ name: string | null }>
  | null;

type InstitutionRow = {
  id: number;
  slug: string | null;
  institution_name: string | null;
  subheading: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  official_phone: string | null;
  official_email: string | null;
  website: string | null;
  logo: string | null;
  source: string | null;
  institution_type?: InstitutionTypeJoinRow;
};

const FALLBACK = "-";
const FIXED_CITY = "Ankara";

function pickInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "M";
  const first = trimmed.charAt(0).toUpperCase();
  return first || "M";
}

function toTitleCaseTr(value: string): string {
  return value
    .split(/(\s+|-)/u)
    .map((segment) => {
      if (!segment || /^\s+$/.test(segment) || segment === "-") return segment;
      const first = segment.charAt(0).toLocaleUpperCase("tr-TR");
      const rest = segment.slice(1).toLocaleLowerCase("tr-TR");
      return `${first}${rest}`;
    })
    .join("");
}

function buildLocation(district?: string | null, city?: string | null): string {
  const parts = [district, city]
    .map((part) => String(part ?? "").trim())
    .filter((part) => Boolean(part))
    .map((part) => toTitleCaseTr(part));
  if (parts.length === 0) return FALLBACK;
  return parts.join(", ");
}

const normalizeSearchText = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildSearchVariants = (rawValue: string): string[] => {
  const value = rawValue.trim();
  if (!value) return [];
  const normalized = normalizeSearchText(value);
  const variants = [
    value,
    value.toLocaleLowerCase("tr-TR"),
    value.toLocaleUpperCase("tr-TR"),
    normalized,
    normalized.toLocaleUpperCase("tr-TR"),
  ]
    .map((v) => v.trim())
    .filter(Boolean);
  return [...new Set(variants)];
};

const escapeLikeValue = (value: string) =>
  value
    .replace(/[(),]/g, " ")
    .replace(/[.%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function useCategoryInstitutions(
  categoryName: string,
  options?: { search?: string; district?: string }
): {
  results: CategoryResultItem[];
  isLoading: boolean;
  error: string | null;
  districts: string[];
} {
  const rawSearch = options?.search ?? "";
  const district = (options?.district ?? "").trim();

  const [results, setResults] = useState<CategoryResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(rawSearch);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [rawSearch]);

  // Ankara + kategoriye ait distinct ilçe listesi (kategori değişince bir kez)
  useEffect(() => {
    const targetName = String(categoryName ?? "").trim();
    if (!targetName) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error: qErr } = await supabase
        .from("institutions")
        .select(
          "district, institution_type:institution_types!inner(id, category:institution_categories!inner(id, name))"
        )
        .ilike("city", FIXED_CITY)
        .ilike("institution_type.category.name", targetName)
        .limit(2000);

      if (cancelled) return;
      if (qErr) {
        setDistricts([]);
        return;
      }
      const rows = (data as Array<{ district: string | null }> | null) ?? [];
      const next = [
        ...new Set(
          rows
            .map((r) => String(r.district ?? "").trim())
            .filter((v) => Boolean(v))
        ),
      ].sort((a, b) => a.localeCompare(b, "tr"));
      setDistricts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryName]);

  // Asıl kurum listesi
  useEffect(() => {
    const targetName = String(categoryName ?? "").trim();
    if (!targetName) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      const supabase = createSupabaseBrowserClient();

      let query = supabase
        .from("institutions")
        .select(
          "id, slug, institution_name, subheading, address, district, city, official_phone, official_email, website, logo, source, institution_type:institution_types!inner(id, name, category:institution_categories!inner(id, name))"
        )
        .ilike("institution_type.category.name", targetName)
        .ilike("city", FIXED_CITY)
        .order("institution_name", { ascending: true });

      if (district) {
        query = query.eq("district", district);
      }

      const searchTerm = debouncedSearch.trim();
      if (searchTerm) {
        const variants = buildSearchVariants(searchTerm)
          .map(escapeLikeValue)
          .filter(Boolean);
        if (variants.length > 0) {
          const searchColumns = [
            "institution_name",
            "city",
            "district",
            "official_phone",
            "address",
          ] as const;
          const orParts = variants.flatMap((term) => {
            const q = `%${term}%`;
            return searchColumns.map((col) => `${col}.ilike.${q}`);
          });
          query = query.or(orParts.join(","));
        }
      }

      const { data, error: qErr } = await query;

      if (cancelled) return;

      if (qErr) {
        console.error("[category][institutions][query-error]", qErr);
        setResults([]);
        setError("Kurumlar yüklenirken bir hata oluştu.");
        setIsLoading(false);
        return;
      }

      const rows = (data as InstitutionRow[] | null) ?? [];
      const mapped = rows.map((row): CategoryResultItem => {
        const logoPath = String(row.logo ?? "").trim().replace(/^\/+/, "");
        const imageUrl = logoPath
          ? supabase.storage.from("institution-logos").getPublicUrl(logoPath).data.publicUrl ||
            undefined
          : undefined;
        const name = String(row.institution_name ?? "").trim() || FALLBACK;
        const description = String(row.subheading ?? "").trim();
        const location = buildLocation(row.district, row.city);
        const slug = String(row.slug ?? "").trim();
        const typeJoin = row.institution_type;
        const typeRow = Array.isArray(typeJoin) ? typeJoin[0] ?? null : typeJoin ?? null;
        const subcategoryName = String(typeRow?.name ?? "").trim();

        return {
          id: String(row.id),
          name,
          description,
          location,
          price: FALLBACK,
          ageRange: FALLBACK,
          rating: 0,
          reviewCount: 0,
          badges: [],
          logoInitial: pickInitial(name),
          imageUrl,
          slug: slug || undefined,
          source: row.source ?? null,
          subcategoryName: subcategoryName || undefined,
        };
      });

      setResults(mapped);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [categoryName, debouncedSearch, district]);

  return { results, isLoading, error, districts };
}
