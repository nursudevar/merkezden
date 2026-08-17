export const MAP_HESAP_TIPI_PARAM = "hesap-tipi";

export type MapHesapTipi = "hepsi" | "kurumlar" | "egitmenler";

export const MAP_HESAP_TIPI_OPTIONS: ReadonlyArray<{ slug: MapHesapTipi; label: string }> = [
  { slug: "hepsi", label: "Hepsi" },
  { slug: "kurumlar", label: "Kurumlar" },
  { slug: "egitmenler", label: "Eğitmenler" },
];

export function parseMapHesapTipi(raw: string): MapHesapTipi {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (normalized === "kurumlar" || normalized === "kurum") return "kurumlar";
  if (normalized === "egitmenler" || normalized === "egitmen") return "egitmenler";
  return "hepsi";
}

export function readMapHesapTipiFromSearch(search: string): MapHesapTipi {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return parseMapHesapTipi(params.get(MAP_HESAP_TIPI_PARAM) ?? "");
}

export function writeMapHesapTipiToParams(params: URLSearchParams, value: MapHesapTipi): void {
  params.delete(MAP_HESAP_TIPI_PARAM);
  if (value !== "hepsi") params.set(MAP_HESAP_TIPI_PARAM, value);
}
