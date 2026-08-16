export const ANNOUNCEMENT_TAG_OPTIONS = [
  "Kampanya",
  "İndirim",
  "Etkinlik",
  "Başarı",
  "Sınav",
  "Erken Kayıt",
  "Yaz Okulu",
  "Haber",
  "Merkezden'e Özel",
  "Açık Pozisyonlar",
] as const;

export type AnnouncementTag = (typeof ANNOUNCEMENT_TAG_OPTIONS)[number];

export const ANNOUNCEMENT_TAG_REQUIRED_ERROR = "Lütfen bir duyuru etiketi seçin.";

export type AnnouncementTagTone =
  | "red"
  | "green"
  | "blue"
  | "orange"
  | "gradient"
  | "purple";

const ANNOUNCEMENT_TAG_TONE_BY_VALUE: Record<AnnouncementTag, AnnouncementTagTone> = {
  Kampanya: "red",
  İndirim: "red",
  Etkinlik: "green",
  Başarı: "blue",
  Sınav: "blue",
  "Erken Kayıt": "orange",
  "Yaz Okulu": "orange",
  Haber: "green",
  "Merkezden'e Özel": "gradient",
  "Açık Pozisyonlar": "purple",
};

export function normalizeAnnouncementTag(value: unknown): AnnouncementTag | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return (ANNOUNCEMENT_TAG_OPTIONS as readonly string[]).includes(trimmed)
    ? (trimmed as AnnouncementTag)
    : null;
}

export function announcementTagToSlug(tag: string): string {
  return String(tag ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function announcementTagFromSlug(slug: string): AnnouncementTag | null {
  const normalized = announcementTagToSlug(slug);
  if (!normalized) return null;
  return (
    ANNOUNCEMENT_TAG_OPTIONS.find((tag) => announcementTagToSlug(tag) === normalized) ?? null
  );
}

export function getAnnouncementTagTone(tag: AnnouncementTag): AnnouncementTagTone {
  return ANNOUNCEMENT_TAG_TONE_BY_VALUE[tag];
}

export function getAnnouncementTagBadgeClassName(
  tag: string | null | undefined,
): string | null {
  const normalized = normalizeAnnouncementTag(tag);
  if (!normalized) return null;
  return `announcement-tag-badge announcement-tag-badge--${getAnnouncementTagTone(normalized)}`;
}
