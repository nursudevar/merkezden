type InstitutionDetailHrefParams = {
  id?: string | number | null;
  slug?: string | null;
  source?: string | null;
};

export function getInstitutionDetailHref({
  slug,
}: InstitutionDetailHrefParams): string {
  const slugValue = String(slug ?? "").trim();
  const identifier = slugValue;

  if (!identifier) return "/institutions";

  return `/institutions/${identifier}`;
}

export function isMebInstitution(source?: string | null): boolean {
  return (source ?? "").trim().toLowerCase().startsWith("meb");
}

/** Browser veya server Supabase istemcisi (storage.getPublicUrl) */
type InstitutionLogoSupabaseClient = {
  storage: {
    from: (bucket: string) => {
      getPublicUrl: (path: string) => { data: { publicUrl?: string | null } };
    };
  };
};

/**
 * institutions.logo hem göreli yol (institutions/11/logo.jpg) hem tam public URL olabilir.
 * Tam URL'yi getPublicUrl ile tekrar sarmayın — aksi halde görsel 404 olur.
 */
export function resolveInstitutionLogoPublicUrl(
  supabase: InstitutionLogoSupabaseClient,
  rawLogo: string | null | undefined,
): string {
  const trimmed = String(rawLogo ?? "").trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/images/")) {
    return trimmed;
  }

  const path = trimmed.replace(/^\/+/, "");
  return supabase.storage.from("institution-logos").getPublicUrl(path).data.publicUrl || "";
}

/** Postgres `time` (HH:mm[:ss]) -> HTML `input[type=time]` (HH:mm). */
export function institutionTimeToInputHHMM(value: string | null | undefined): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** HTML `input[type=time]` -> Postgres `time` (HH:mm:ss) veya boşsa null. */
export function inputHHMMToDbTimeOrNull(value: string): string | null {
  const t = String(value ?? "").trim();
  if (!t) return null;
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  return t || null;
}

/** İkisi de doluysa `HH:mm-HH:mm`, aksi halde null. */
export function formatWorkingHoursRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  const a = institutionTimeToInputHHMM(start);
  const b = institutionTimeToInputHHMM(end);
  if (a && b) return `${a}-${b}`;
  return null;
}

function normalizeInstitutionFeatureNameKey(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAverageClassSizeInstitutionFeature(name: string): boolean {
  const key = normalizeInstitutionFeatureNameKey(name);
  return key.includes("ortalama sinif mevcudu");
}
