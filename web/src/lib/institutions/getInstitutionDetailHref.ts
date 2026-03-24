import { isMebInstitution } from "@/lib/institutions/isMebInstitution";

type InstitutionDetailHrefParams = {
  id?: string | number | null;
  slug?: string | null;
  source?: string | null;
};

export function getInstitutionDetailHref({
  id,
  slug,
  source,
}: InstitutionDetailHrefParams): string {
  const slugValue = String(slug ?? "").trim();
  const idValue = id === null || id === undefined ? "" : String(id).trim();
  const identifier = slugValue || idValue;

  if (!identifier) return "/institutions";

  if (isMebInstitution(source)) {
    return `/institutions/meb/${identifier}`;
  }

  return `/institutions/${identifier}`;
}

