import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sortByHomeMainCategoryOrder } from "@/lib/categoryHelpers";

export type ActiveInstitutionCategory = {
  id: number;
  name: string;
  slug: string;
};

export async function fetchActiveInstitutionCategories(): Promise<ActiveInstitutionCategory[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("institution_categories")
    .select("id, name, slug, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data?.length) return [];

  return sortByHomeMainCategoryOrder(
    (data as Array<{ id: number; name: string | null; slug: string | null }>)
      .map((row) => ({
        id: row.id,
        name: String(row.name ?? "").trim(),
        slug: String(row.slug ?? "").trim(),
      }))
      .filter((row) => row.name.length > 0),
  );
}

export async function fetchInstitutionCategoryBySlug(
  slug: string,
): Promise<ActiveInstitutionCategory | null> {
  const normalizedSlug = String(slug ?? "").trim();
  if (!normalizedSlug) return null;

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("institution_categories")
    .select("id, name, slug")
    .eq("is_active", true)
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (error || !data) return null;

  const name = String((data as { name?: string | null }).name ?? "").trim();
  const resolvedSlug = String((data as { slug?: string | null }).slug ?? "").trim();
  const id = Number((data as { id?: number | null }).id);

  if (!name || !Number.isFinite(id)) return null;

  return {
    id,
    name,
    slug: resolvedSlug || normalizedSlug,
  };
}

/** "Hepsi" + kategori adları; DB boş/hatalıysa fallback listesi kullanılır. */
export function buildCategoryTabNames(
  categories: ActiveInstitutionCategory[],
  fallback: readonly string[],
): string[] {
  if (categories.length === 0) return [...fallback];
  return ["Hepsi", ...categories.map((category) => category.name)];
}
