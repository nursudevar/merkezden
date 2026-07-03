import type { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PUBLIC_INSTRUCTORS_TABLE } from "@/lib/publicInstructorClient";
import {
  PUBLIC_INSTRUCTOR_LIST_SELECT,
  type PublicInstructorListRow,
} from "@/lib/publicInstructorSearch";

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

/** Ana sayfa Öne Çıkanlar — sabit kurumlar (Deneme hariç ID ile) */
export const HOME_FEATURED_PINNED_IDS = [104, 200] as const;

/** ID ile bulunamazsa isimle yedek arama */
export const HOME_FEATURED_PINNED_NAME_BY_ID: Record<number, readonly string[]> = {
  104: ["ODTÜ GELİŞTİRME VAKFI ÖZEL LİSESİ"],
  200: ["ÖZEL BİLFEN ÇAYYOLU FEN LİSESİ"],
};

/** Ana sayfa Öne Çıkanlar grid — sabit bireysel eğitmen (1 tabanlı 4. sıra) */
export const HOME_FEATURED_PINNED_INSTRUCTOR_SLUG = "nur-sude-var-1";
export const HOME_FEATURED_PINNED_INSTRUCTOR_POSITION = 3;

export const HOME_FEATURED_PINNED_ROW_SELECT =
  "id, slug, source, institution_name, type, city, district, logo, institution_type:institution_types(name, category:institution_categories(name))";

function rowId(row: Record<string, unknown>): number {
  return Number(row.id);
}

/**
 * Deneme + ID 104/200 (+ gerekirse isim yedeği) sırayla döner.
 * Kurum paneli / liste kartları için sade select kullanır.
 */
export async function fetchHomeFeaturedPinnedRows(
  supabase: SupabaseBrowser,
): Promise<Record<string, unknown>[]> {
  const ordered: Record<string, unknown>[] = [];
  const foundIds = new Set<number>();

  const pushRow = (row: Record<string, unknown> | null | undefined) => {
    if (!row) return;
    const id = rowId(row);
    if (!Number.isFinite(id) || foundIds.has(id)) return;
    const name = String(row.institution_name ?? "").trim();
    if (!name) return;
    ordered.push(row);
    foundIds.add(id);
  };

  const denemeResult = await supabase
    .from("institutions")
    .select(HOME_FEATURED_PINNED_ROW_SELECT)
    .eq("institution_name", "Deneme")
    .eq("is_approved", true)
    .maybeSingle();

  if (denemeResult.error) {
    console.warn("[home-featured] Deneme pinned load error:", denemeResult.error.message);
  } else {
    pushRow(denemeResult.data as Record<string, unknown> | null);
  }

  const byIdResult = await supabase
    .from("institutions")
    .select(HOME_FEATURED_PINNED_ROW_SELECT)
    .in("id", [...HOME_FEATURED_PINNED_IDS])
    .eq("is_approved", true);

  if (byIdResult.error) {
    console.warn("[home-featured] Pinned IDs load error:", byIdResult.error.message);
  } else {
    const byIdRows = (byIdResult.data ?? []) as Array<Record<string, unknown>>;
    for (const pinnedId of HOME_FEATURED_PINNED_IDS) {
      const row = byIdRows.find((r) => rowId(r) === pinnedId);
      pushRow(row);
    }
  }

  for (const pinnedId of HOME_FEATURED_PINNED_IDS) {
    if (foundIds.has(pinnedId)) continue;
    const names = HOME_FEATURED_PINNED_NAME_BY_ID[pinnedId];
    if (!names?.length) continue;

    const byNameResult = await supabase
      .from("institutions")
      .select(HOME_FEATURED_PINNED_ROW_SELECT)
      .in("institution_name", [...names])
      .eq("is_approved", true)
      .limit(1);

    if (byNameResult.error) {
      console.warn(
        `[home-featured] Pinned name fallback (${pinnedId}) error:`,
        byNameResult.error.message,
      );
      continue;
    }

    const first = (byNameResult.data ?? [])[0] as Record<string, unknown> | undefined;
    pushRow(first);
  }

  return ordered;
}

export async function fetchHomeFeaturedPinnedInstructorRow(
  supabase: SupabaseBrowser,
): Promise<PublicInstructorListRow | null> {
  const { data, error } = await supabase
    .from(PUBLIC_INSTRUCTORS_TABLE)
    .select(PUBLIC_INSTRUCTOR_LIST_SELECT)
    .eq("slug", HOME_FEATURED_PINNED_INSTRUCTOR_SLUG)
    .eq("is_active", true)
    .eq("is_approved", true)
    .maybeSingle();

  if (error) {
    console.warn("[home-featured] Pinned instructor load error:", error.message);
    return null;
  }

  const row = data as PublicInstructorListRow | null;
  if (!row || !Number.isFinite(Number(row.id)) || Number(row.id) <= 0) return null;
  return row;
}
