import { NextResponse } from "next/server";

export const runtime = "nodejs";

const NOMINATIM_USER_AGENT = "Merkezden/1.0 (https://merkezden.com; place-geocode)";

type NominatimSearchRow = {
  lat?: string;
  lon?: string;
};

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) {
    return NextResponse.json({ error: "q zorunludur." }, { status: 400 });
  }

  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
  nominatimUrl.searchParams.set("q", query);
  nominatimUrl.searchParams.set("format", "json");
  nominatimUrl.searchParams.set("limit", "1");
  nominatimUrl.searchParams.set("countrycodes", "tr");
  nominatimUrl.searchParams.set("addressdetails", "0");

  try {
    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": NOMINATIM_USER_AGENT,
      },
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Konum çözümlenemedi." }, { status: 502 });
    }

    const rows = (await response.json()) as NominatimSearchRow[];
    const first = rows?.[0];
    const lat = Number(first?.lat);
    const lng = Number(first?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "Konum bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({ lat, lng });
  } catch {
    return NextResponse.json({ error: "Konum servisi kullanılamıyor." }, { status: 502 });
  }
}
