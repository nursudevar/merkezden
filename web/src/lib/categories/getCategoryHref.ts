/** Ana sayfa kategori kartları ve footer ile aynı rota eşlemesi */

export const normalizeCategoryKey = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Bilinen kategori sayfalarına gider; yoksa null (çağıran `/okullar` vb. kullanabilir) */
export function getCategoryHref(name: string, slug: string): string | null {
  const key = normalizeCategoryKey(`${name} ${slug}`);
  if (key.includes("okul")) return "/school";
  if (key.includes("kurs") || key.includes("sinav")) return "/courses";
  if (key.includes("spor")) return "/sports";
  if (key.includes("sanat")) return "/arts";
  if (key.includes("yabanci dil") || key.includes("dil")) return "/languages";
  if (key.includes("kisisel gelisim")) return "/personal-development";
  if (key.includes("mesleki egitim")) return "/vocational-training";
  if (key.includes("ozel egitim")) return "/special-education";
  return null;
}
