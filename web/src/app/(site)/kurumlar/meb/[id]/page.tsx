import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInstitutionDetailHref, isMebInstitution } from "@/lib/institutionHelpers";

export default async function MebInstitutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const routeId = String(id ?? "").trim();
  const parsedId = Number(routeId);

  if (!routeId || !Number.isFinite(parsedId) || parsedId <= 0) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("institutions")
    .select("id, slug, source")
    .eq("id", parsedId)
    .eq("is_approved", true)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const institution = data as { id: number; slug: string | null; source: string | null };

  if (!isMebInstitution(institution.source)) {
    notFound();
  }

  const slug = String(institution.slug ?? "").trim();
  if (!slug) {
    notFound();
  }

  redirect(getInstitutionDetailHref({ slug }));
}
