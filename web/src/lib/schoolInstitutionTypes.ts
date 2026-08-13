export const OKUL_CATEGORY_SLUG = "okul";

/** `institutions.institution_type_id` — Lise */
export const LISE_INSTITUTION_TYPE_ID = 53;

export const HIGH_SCHOOL_TYPE_OPTIONS = [
  { slug: "mesleki-ve-teknik-anadolu-lisesi", label: "Mesleki ve Teknik Anadolu Lisesi" },
  { slug: "anadolu-lisesi", label: "Anadolu Lisesi" },
  { slug: "fen-lisesi", label: "Fen Lisesi" },
  { slug: "aksam-lisesi", label: "Akşam Lisesi" },
  { slug: "spor-lisesi", label: "Spor Lisesi" },
  { slug: "mesleki-acik-ogretim-lisesi", label: "Mesleki Açık Öğretim Lisesi" },
  { slug: "fen-ve-teknoloji-lisesi", label: "Fen ve Teknoloji Lisesi" },
  { slug: "cok-programli-anadolu-lisesi", label: "Çok Programlı Anadolu Lisesi" },
  { slug: "sosyal-bilimler-lisesi", label: "Sosyal Bilimler Lisesi" },
  { slug: "anadolu-imam-hatip-lisesi", label: "Anadolu İmam Hatip Lisesi" },
  { slug: "guzel-sanatlar-lisesi", label: "Güzel Sanatlar Lisesi" },
  { slug: "acik-ogretim-lisesi", label: "Açık Öğretim Lisesi" },
  { slug: "anadolu-meslek-lisesi", label: "Anadolu Meslek Lisesi" },
  { slug: "uluslararasi-lise", label: "Uluslararası Lise" },
] as const;

export type HighSchoolTypeSlug = (typeof HIGH_SCHOOL_TYPE_OPTIONS)[number]["slug"];

const HIGH_SCHOOL_TYPE_LABEL_BY_SLUG = new Map<string, string>(
  HIGH_SCHOOL_TYPE_OPTIONS.map((option) => [option.slug, option.label]),
);

export function isAllowedHighSchoolTypeSlug(value: string | null | undefined): value is HighSchoolTypeSlug {
  const slug = String(value ?? "").trim();
  return Boolean(slug) && HIGH_SCHOOL_TYPE_LABEL_BY_SLUG.has(slug);
}

export function getHighSchoolTypeLabel(value: string | null | undefined): string {
  const slug = String(value ?? "").trim();
  if (!slug) return "";
  return HIGH_SCHOOL_TYPE_LABEL_BY_SLUG.get(slug) ?? "";
}
