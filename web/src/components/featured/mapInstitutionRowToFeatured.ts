import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveInstitutionLogoPublicUrl } from "@/lib/institutionLogoUrl";
import type { FeaturedInstitution } from "./featuredInstitutionTypes";

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

function resolveInstitutionCategoryName(row: Record<string, unknown>): string {
  const typeJoin = row.institution_type;
  const typeRow = Array.isArray(typeJoin) ? typeJoin[0] : typeJoin;
  if (!typeRow || typeof typeRow !== "object") return "";

  const categoryJoin = (typeRow as { category?: unknown }).category;
  const categoryRow = Array.isArray(categoryJoin) ? categoryJoin[0] : categoryJoin;
  if (!categoryRow || typeof categoryRow !== "object") return "";

  return String((categoryRow as { name?: unknown }).name ?? "").trim();
}

export function mapInstitutionRowToFeatured(
  supabase: SupabaseBrowser,
  row: Record<string, unknown>,
): FeaturedInstitution | null {
  const id = Number(row.id);
  const name = String(row.institution_name ?? "").trim();
  if (!Number.isFinite(id) || !name) return null;

  const mainCategory = resolveInstitutionCategoryName(row);
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
    bodyMainCategory: mainCategory,
    bodyLocation: location || "Konum bilgisi yok",
  };
}
