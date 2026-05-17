import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { FeaturedInstitutionListItem } from "./FeaturedInstitutionListCard";

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

export function mapInstitutionRowToListItem(
  supabase: SupabaseBrowser,
  row: Record<string, unknown>,
): FeaturedInstitutionListItem | null {
  const id = Number(row.id);
  const name = String(row.institution_name ?? "").trim();
  if (!Number.isFinite(id) || !name) return null;

  const district = String(row.district ?? "").trim();
  const logoPath = String(row.logo ?? "").trim();
  const logoUrl = logoPath
    ? supabase.storage.from("institution-logos").getPublicUrl(logoPath).data.publicUrl
    : "";

  return {
    id,
    name,
    imageUrl: logoUrl,
    slug: String(row.slug ?? "").trim(),
    source: String(row.source ?? "").trim(),
    district,
  };
}
