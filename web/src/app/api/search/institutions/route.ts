import { NextResponse } from "next/server";
import { matchesSearch } from "@/lib/utils";

type Institution = {
  id: number;
  name: string;
  location: string;
  description: string;
  rating: number;
  imageUrl: string;
  slug: string;
  badge?: {
    icon: string;
    label: string;
    color: string;
  };
};

const allInstitutions: Institution[] = [];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (query.length < 1) {
      return NextResponse.json({ results: [], message: "En az 1 karakter giriniz" });
    }

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
