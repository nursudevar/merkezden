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
