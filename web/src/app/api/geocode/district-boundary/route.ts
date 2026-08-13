import { NextResponse } from "next/server";
import { parseNominatimDistrictResult, type DistrictBoundaryGeoJson } from "@/lib/districtMapView";

export const runtime = "nodejs";

const NOMINATIM_USER_AGENT = "Merkezden/1.0 (https://merkezden.com; district-boundary)";

type NominatimSearchRow = {
  boundingbox?: string[];
  geojson?: {
    type: string;
    coordinates?: unknown;
    geometries?: unknown[];
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city")?.trim() ?? "";
  const district = searchParams.get("district")?.trim() ?? "";

  if (!city || !district) {
    return NextResponse.json({ error: "city ve district zorunludur." }, { status: 400 });
  }

  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
  nominatimUrl.searchParams.set("q", `${district}, ${city}, Türkiye`);
  nominatimUrl.searchParams.set("format", "json");
  nominatimUrl.searchParams.set("polygon_geojson", "1");
  nominatimUrl.searchParams.set("limit", "1");
  nominatimUrl.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": NOMINATIM_USER_AGENT,
      },
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "İlçe sınırı alınamadı." }, { status: 502 });
    }

    const rows = (await response.json()) as NominatimSearchRow[];
    const first = rows?.[0];
    if (!first) {
      return NextResponse.json({ error: "İlçe sınırı bulunamadı." }, { status: 404 });
    }

    const view = parseNominatimDistrictResult({
      boundingbox: first.boundingbox,
      geojson: first.geojson as DistrictBoundaryGeoJson | undefined,
    });
    if (!view) {
      return NextResponse.json({ error: "İlçe sınırı çözümlenemedi." }, { status: 404 });
    }

    return NextResponse.json(view);
  } catch {
    return NextResponse.json({ error: "İlçe sınırı servisi kullanılamıyor." }, { status: 502 });
  }
}
