/** Browser veya server Supabase istemcisi (storage.getPublicUrl) */
export type InstitutionLogoSupabaseClient = {
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

  const path = trimmed.replace(/^\/+/, "");
  return supabase.storage.from("institution-logos").getPublicUrl(path).data.publicUrl || "";
}
