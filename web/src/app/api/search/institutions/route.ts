import { NextResponse } from "next/server";
import { matchesSearch } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveInstitutionLogoPublicUrl } from "@/lib/institutionLogoUrl";

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
  address: string | null;
  logo: string | null;
  slug: string | null;
  source: string | null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (query.length < 1) {
      return NextResponse.json({ results: [], message: "En az 1 karakter giriniz" });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("institutions")
      .select("id, institution_name, city, district, type, address, logo, slug, source")
      .not("institution_name", "is", null)
      .order("institution_name", { ascending: true })
      .limit(600);

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
        const address = String(row.address ?? "").trim();
        const description = type || address || "Kurum bilgisi";
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
      .filter((institution) => {
        return (
          matchesSearch(institution.name, query) ||
          matchesSearch(institution.location, query) ||
          matchesSearch(institution.description, query)
        );
      })
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
