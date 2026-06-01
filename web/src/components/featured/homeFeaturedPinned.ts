import type { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

/** Ana sayfa Öne Çıkanlar — sabit kurumlar (Deneme hariç ID ile) */
export const HOME_FEATURED_PINNED_IDS = [104, 200] as const;

/** ID ile bulunamazsa isimle yedek arama */
export const HOME_FEATURED_PINNED_NAME_BY_ID: Record<number, readonly string[]> = {
  104: ["ODTÜ GELİŞTİRME VAKFI ÖZEL LİSESİ"],
  200: ["ÖZEL BİLFEN ÇAYYOLU FEN LİSESİ"],
};

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
    .maybeSingle();

  if (denemeResult.error) {
    console.warn("[home-featured] Deneme pinned load error:", denemeResult.error.message);
  } else {
    pushRow(denemeResult.data as Record<string, unknown> | null);
  }

  const byIdResult = await supabase
    .from("institutions")
    .select(HOME_FEATURED_PINNED_ROW_SELECT)
    .in("id", [...HOME_FEATURED_PINNED_IDS]);

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
