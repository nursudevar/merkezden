import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveInstitutionLogoPublicUrl } from "@/lib/institutionLogoUrl";
import type { FeaturedInstitution } from "./featuredInstitutionTypes";

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

type InstitutionTypeJoin =
  | { name?: string | null; category?: { name?: string | null } | null }
  | undefined;

export function mapInstitutionRowToFeatured(
  supabase: SupabaseBrowser,
  row: Record<string, unknown>,
): FeaturedInstitution | null {
  const id = Number(row.id);
  const name = String(row.institution_name ?? "").trim();
  if (!Number.isFinite(id) || !name) return null;

  const institutionType = row.institution_type as InstitutionTypeJoin;
  const mainCategory = String(institutionType?.category?.name ?? "").trim();
  const subCategory =
    String(institutionType?.name ?? "").trim() || String(row.type ?? "").trim();
  const city = String(row.city ?? "").trim();
  const district = String(row.district ?? "").trim();
  const location = [district, city].filter(Boolean).join(", ");
  const logoUrl = resolveInstitutionLogoPublicUrl(supabase, String(row.logo ?? ""));

  return {
    id,
    name,
    imageUrl: logoUrl,
    slug: String(row.slug ?? "").trim(),
    source: String(row.source ?? "").trim(),
    bodyMainCategory: mainCategory || "Kategori",
    bodySubCategory: subCategory || "Alt kategori belirtilmedi",
    bodyLocation: location || "Konum bilgisi yok",
  };
}
