export function isMebInstitution(source?: string | null): boolean {
  return (source ?? "").trim().toLowerCase().startsWith("meb");
}

