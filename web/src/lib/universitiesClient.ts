"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeProfileSearchText } from "@/lib/profileSearch";

export type UniversityType = "devlet" | "vakif" | "vakif_myo" | "kktc";

export type UniversityRow = {
  id: number;
  name: string;
  type: string | null;
  city: string | null;
};

const UNIVERSITIES_PAGE_SIZE = 1000;

const UNIVERSITY_TYPE_LABELS: Record<UniversityType, string> = {
  devlet: "Devlet",
  vakif: "Vakıf",
  vakif_myo: "Vakıf Meslek Yüksekokulu",
  kktc: "KKTC",
};

export function formatUniversityTypeLabel(type: string | null | undefined): string {
  const key = String(type ?? "").trim() as UniversityType;
  return UNIVERSITY_TYPE_LABELS[key] ?? "";
}

export function formatUniversityMeta(row: Pick<UniversityRow, "city" | "type">): string {
  const city = String(row.city ?? "").trim();
  const typeLabel = formatUniversityTypeLabel(row.type);
  return [city, typeLabel].filter(Boolean).join(" · ");
}

export function universityNameMatches(name: string, query: string): boolean {
  const needle = normalizeProfileSearchText(query);
  if (!needle) return true;
  return normalizeProfileSearchText(name).includes(needle);
}

function parseUniversityRows(data: unknown): UniversityRow[] {
  if (!Array.isArray(data)) return [];
  const rows: UniversityRow[] = [];
  const seen = new Set<number>();
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const id = Number((item as { id?: unknown }).id);
    const name = String((item as { name?: unknown }).name ?? "").trim();
    if (!Number.isFinite(id) || id <= 0 || !name || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      name,
      type: String((item as { type?: unknown }).type ?? "").trim() || null,
      city: String((item as { city?: unknown }).city ?? "").trim() || null,
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, "tr", { sensitivity: "base" }));
}

async function loadActiveUniversities(): Promise<UniversityRow[]> {
  const supabase = createSupabaseBrowserClient();
  const all: UniversityRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("universities")
      .select("id, name, type, city")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .range(from, from + UNIVERSITIES_PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message || "Üniversiteler yüklenemedi.");
    }

    all.push(...parseUniversityRows(data));
    if (!data || data.length < UNIVERSITIES_PAGE_SIZE) break;
    from += UNIVERSITIES_PAGE_SIZE;
  }

  return all.sort((a, b) => a.name.localeCompare(b.name, "tr", { sensitivity: "base" }));
}

let universitiesPromise: Promise<UniversityRow[]> | null = null;

export function fetchActiveUniversities(): Promise<UniversityRow[]> {
  if (!universitiesPromise) {
    universitiesPromise = loadActiveUniversities().catch((error) => {
      universitiesPromise = null;
      throw error;
    });
  }
  return universitiesPromise;
}
