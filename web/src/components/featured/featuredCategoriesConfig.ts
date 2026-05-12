/**
 * Öne çıkanlar sayfasındaki 8 ana kategori bölümü — `institution_categories.name`
 * ile normalize edilmiş anahtarlar üzerinden eşleşir (ana sayfa sol panel ile uyumlu).
 */
export const FEATURED_PAGE_CATEGORY_SECTIONS: ReadonlyArray<{
  heading: string;
  matchKeys: readonly string[];
}> = [
  { heading: "Okul Kategorisinde Öne Çıkanlar", matchKeys: ["okul"] },
  {
    heading: "Kurs & Sınava Hazırlık Kategorisinde Öne Çıkanlar",
    matchKeys: ["kurs sinava hazirlik", "kurs ve sinava hazirlik", "sinava hazirlik"],
  },
  { heading: "Özel Eğitim Kategorisinde Öne Çıkanlar", matchKeys: ["ozel egitim"] },
  { heading: "Kişisel Gelişim Kategorisinde Öne Çıkanlar", matchKeys: ["kisisel gelisim"] },
  { heading: "Mesleki Eğitim Kategorisinde Öne Çıkanlar", matchKeys: ["mesleki egitim"] },
  { heading: "Spor Kategorisinde Öne Çıkanlar", matchKeys: ["spor"] },
  { heading: "Sanat Kategorisinde Öne Çıkanlar", matchKeys: ["sanat"] },
  {
    heading: "Yabancı Dil Kategorisinde Öne Çıkanlar",
    matchKeys: ["yabanci dil", "yabanci diller"],
  },
];

export function normalizeCategoryKeyForFeatured(value: string): string {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function institutionMatchesFeaturedCategory(
  institution: { bodyMainCategory: string },
  matchKeys: readonly string[],
): boolean {
  const nameKey = normalizeCategoryKeyForFeatured(institution.bodyMainCategory);
  return matchKeys.some((k) => {
    const key = normalizeCategoryKeyForFeatured(k);
    if (!key) return false;
    if (nameKey === key) return true;
    if (nameKey.includes(key)) return true;
    if (key.includes(nameKey) && nameKey.length >= 4) return true;
    return false;
  });
}
