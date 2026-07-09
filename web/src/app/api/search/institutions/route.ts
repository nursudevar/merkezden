import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveInstitutionLogoPublicUrl } from "@/lib/institutionHelpers";
import {
  buildProfileSearchVariants,
  escapeProfileLikeValue,
  resolveInstitutionIdsByProfileSearch,
} from "@/lib/profileSearch";

type Institution = {
  id: number;
  name: string;
  location: string;
  description: string;
  rating: number;
  imageUrl: string;
  slug: string;
  source: string | null;
  badge?: {
    icon: string;
    label: string;
    color: string;
  };
};

type InstitutionRow = {
  id: number | null;
  institution_name: string | null;
  city: string | null;
  district: string | null;
  type: string | null;
  subheading?: string | null;
  about?: string | null;
  address: string | null;
  official_phone?: string | null;
  official_email?: string | null;
  website?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  x_url?: string | null;
  linkedin_url?: string | null;
  logo: string | null;
  slug: string | null;
  source: string | null;
  institution_type_id?: number | null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (query.length < 1) {
      return NextResponse.json({ results: [], message: "En az 1 karakter giriniz" });
    }

    const supabase = await createSupabaseServerClient();
    const relatedSearch = await resolveInstitutionIdsByProfileSearch(supabase, query);
    let institutionQuery = supabase
      .from("institutions")
      .select("id, institution_name, city, district, type, subheading, about, address, official_phone, official_email, website, facebook_url, instagram_url, x_url, linkedin_url, logo, slug, source, institution_type_id")
      .not("institution_name", "is", null)
      .eq("is_approved", true)
      .order("institution_name", { ascending: true })
      .limit(600);

    const variants = buildProfileSearchVariants(query).map(escapeProfileLikeValue).filter(Boolean);
    const searchColumns = [
      "institution_name",
      "city",
      "district",
      "type",
      "subheading",
      "about",
      "address",
      "official_phone",
      "official_email",
      "website",
      "facebook_url",
      "instagram_url",
      "x_url",
      "linkedin_url",
    ] as const;
    const orParts = variants.flatMap((term) => {
      const q = `%${term}%`;
      return searchColumns.map((col) => `${col}.ilike.${q}`);
    });
    if (relatedSearch.institutionIds.length > 0) {
      orParts.push(`id.in.(${relatedSearch.institutionIds.join(",")})`);
    }
    if (relatedSearch.institutionTypeIds.length > 0) {
      orParts.push(`institution_type_id.in.(${relatedSearch.institutionTypeIds.join(",")})`);
    }
    if (orParts.length > 0) {
      institutionQuery = institutionQuery.or(orParts.join(","));
    }

    const { data, error } = await institutionQuery;

    if (error) {
      throw error;
    }

    const allInstitutions: Institution[] = ((data ?? []) as InstitutionRow[])
      .map((row) => {
        const id = Number(row.id);
        const name = String(row.institution_name ?? "").trim();
        if (!Number.isFinite(id) || !name) return null;

        const district = String(row.district ?? "").trim();
        const city = String(row.city ?? "").trim();
        const location = [district, city].filter(Boolean).join(", ") || "Konum bilgisi yok";
        const type = String(row.type ?? "").trim();
        const subheading = String(row.subheading ?? "").trim();
        const about = String(row.about ?? "").trim();
        const address = String(row.address ?? "").trim();
        const description = subheading || about || type || address || "Kurum bilgisi";
        const imageUrl =
          resolveInstitutionLogoPublicUrl(supabase, row.logo) || "/images/hero-banner-car.jpg";

        return {
          id,
          name,
          location,
          description,
          rating: 4.8,
          imageUrl,
          slug: String(row.slug ?? "").trim(),
          source: row.source ?? null,
        };
      })
      .filter((institution): institution is Institution => institution !== null);

    const results = allInstitutions
      .slice(0, 20)
      .map((institution) => ({
        id: institution.id.toString(),
        name: institution.name,
        description: institution.description,
        location: institution.location,
        rating: institution.rating,
        reviewCount: Math.floor(institution.rating * 25),
        imageUrl: institution.imageUrl,
        slug: institution.slug,
        source: institution.source,
        badge: institution.badge || null,
      }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[Search API] Error:", error);
    return NextResponse.json(
      { results: [], error: "Arama sırasında bir hata oluştu" },
      { status: 500 }
    );
  }
}
