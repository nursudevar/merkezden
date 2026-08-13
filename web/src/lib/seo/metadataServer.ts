import { createSupabaseServerClient } from "@/lib/supabase/server";

const PUBLIC_INSTRUCTORS_TABLE = "public_instructors" as const;
const INSTRUCTORS_TABLE = "instructors" as const;

type PublicInstructorRow = {
  id: number;
  slug?: string | null;
  name?: string | null;
  surname?: string | null;
  branch?: string | null;
  bio?: string | null;
  about?: string | null;
  city?: string | null;
  district?: string | null;
  category_id?: number | null;
  category_name?: string | null;
};

export function publicInstructorDisplayName(row: PublicInstructorRow | null): string {
  if (!row) return "Eğitmen";
  const combined = `${String(row.name ?? "").trim()} ${String(row.surname ?? "").trim()}`.trim();
  return combined || "Eğitmen";
}

const INSTITUTION_METADATA_SELECT =
  "institution_name, subheading, about, city, district, institution_type:institution_types(name, category:institution_categories(name))";

const INSTRUCTOR_METADATA_SELECT =
  "id, slug, name, surname, bio, about, branch, city, district, category_id";

export function truncateMetaDescription(text: string, maxLength = 160): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  const slice = cleaned.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.6) {
    return `${slice.slice(0, lastSpace).trim()}…`;
  }
  return `${slice.trim()}…`;
}

export function stripHtmlForMeta(text: string): string {
  return String(text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchInstitutionCategoryBySlugServer(
  slug: string,
): Promise<{ id: number; name: string; slug: string } | null> {
  const normalizedSlug = String(slug ?? "").trim();
  if (!normalizedSlug) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("institution_categories")
    .select("id, name, slug")
    .eq("is_active", true)
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (error || !data) return null;

  const name = String((data as { name?: string | null }).name ?? "").trim();
  const resolvedSlug = String((data as { slug?: string | null }).slug ?? "").trim();
  const id = Number((data as { id?: number | null }).id);

  if (!name || !Number.isFinite(id)) return null;

  return { id, name, slug: resolvedSlug || normalizedSlug };
}

type InstitutionMetadataRow = {
  institution_name?: string | null;
  subheading?: string | null;
  about?: string | null;
  city?: string | null;
  district?: string | null;
  institution_type?:
    | {
        name?: string | null;
        category?: { name?: string | null } | Array<{ name?: string | null }> | null;
      }
    | Array<{
        name?: string | null;
        category?: { name?: string | null } | Array<{ name?: string | null }> | null;
      }>
    | null;
};

export async function fetchApprovedInstitutionForMetadataServer(
  slug: string,
): Promise<InstitutionMetadataRow | null> {
  const trimmed = String(slug ?? "").trim();
  if (!trimmed) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("institutions")
    .select(INSTITUTION_METADATA_SELECT)
    .eq("slug", trimmed)
    .eq("is_approved", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as InstitutionMetadataRow;
}

function resolveInstitutionCategoryLabel(row: InstitutionMetadataRow): string {
  const typeJoin = row.institution_type;
  const typeRow = Array.isArray(typeJoin) ? typeJoin[0] : typeJoin;
  const categoryJoin = typeRow?.category;
  const categoryRow = Array.isArray(categoryJoin) ? categoryJoin[0] : categoryJoin;
  const categoryName = String(categoryRow?.name ?? "").trim();
  const typeName = String(typeRow?.name ?? "").trim();
  return categoryName || typeName;
}

export function buildInstitutionMetaDescription(row: InstitutionMetadataRow | null): string {
  if (!row) {
    return "Ankara'daki eğitim kurumlarını Merkezden üzerinde keşfedin ve karşılaştırın.";
  }

  const about = stripHtmlForMeta(String(row.about ?? ""));
  if (about) return truncateMetaDescription(about);

  const subheading = stripHtmlForMeta(String(row.subheading ?? ""));
  if (subheading) return truncateMetaDescription(subheading);

  const categoryLabel = resolveInstitutionCategoryLabel(row);
  const district = String(row.district ?? "").trim();
  const city = String(row.city ?? "").trim();
  const location = [district, city].filter(Boolean).join(", ");

  const parts = [categoryLabel, location].filter(Boolean);
  if (parts.length > 0) {
    return truncateMetaDescription(
      `${String(row.institution_name ?? "Kurum").trim()} — ${parts.join(" · ")} hakkında bilgi alın.`,
    );
  }

  return truncateMetaDescription(
    `${String(row.institution_name ?? "Kurum").trim()} profilini Merkezden'de inceleyin.`,
  );
}

async function queryInstructorForMetadata(
  table: string,
  select: string,
  param: string,
): Promise<PublicInstructorRow | null> {
  const supabase = await createSupabaseServerClient();
  const trimmed = String(param ?? "").trim();
  const isNumericId = /^\d+$/.test(trimmed);

  let query = supabase.from(table).select(select).eq("is_active", true).eq("is_approved", true);

  if (isNumericId) {
    query = query.eq("id", Number(trimmed));
  } else if (select.includes("slug")) {
    query = query.eq("slug", trimmed);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data as unknown as PublicInstructorRow;
}

async function enrichInstructorCategoryName(
  row: PublicInstructorRow,
): Promise<PublicInstructorRow> {
  if (String(row.category_name ?? "").trim()) return row;

  const categoryId = row.category_id;
  if (categoryId == null || !Number.isFinite(Number(categoryId))) return row;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("instructor_categories")
    .select("name")
    .eq("id", Number(categoryId))
    .eq("is_active", true)
    .maybeSingle();

  const categoryName = String((data as { name?: string | null } | null)?.name ?? "").trim();
  if (!categoryName) return row;
  return { ...row, category_name: categoryName };
}

export async function fetchPublicInstructorForMetadataServer(
  param: string,
): Promise<PublicInstructorRow | null> {
  const trimmed = String(param ?? "").trim();
  if (!trimmed) return null;

  const attempts: Array<{ table: string; select: string }> = [
    { table: PUBLIC_INSTRUCTORS_TABLE, select: `${INSTRUCTOR_METADATA_SELECT}, slug` },
    { table: PUBLIC_INSTRUCTORS_TABLE, select: INSTRUCTOR_METADATA_SELECT },
    { table: INSTRUCTORS_TABLE, select: `${INSTRUCTOR_METADATA_SELECT}, slug` },
    { table: INSTRUCTORS_TABLE, select: INSTRUCTOR_METADATA_SELECT },
  ];

  for (const { table, select } of attempts) {
    const row = await queryInstructorForMetadata(table, select, trimmed);
    if (row) return enrichInstructorCategoryName(row);
  }

  return null;
}

export function buildInstructorMetaDescription(row: PublicInstructorRow | null): string {
  if (!row) {
    return "Ankara'daki özel ders eğitmenlerini Merkezden üzerinde keşfedin ve karşılaştırın.";
  }

  const about = stripHtmlForMeta(String(row.about ?? ""));
  if (about) return truncateMetaDescription(about);

  const bio = stripHtmlForMeta(String(row.bio ?? ""));
  if (bio) return truncateMetaDescription(bio);

  const branch = String(row.branch ?? "").trim();
  const categoryName = String(row.category_name ?? "").trim();
  const subjectParts = [branch, categoryName].filter(Boolean);
  const district = String(row.district ?? "").trim();
  const city = String(row.city ?? "").trim();
  const location = [district, city].filter(Boolean).join(", ");

  const name = publicInstructorDisplayName(row);
  if (subjectParts.length > 0 && location) {
    return truncateMetaDescription(
      `${name} — ${subjectParts.join(", ")} alanında ${location} bölgesinde özel ders.`,
    );
  }
  if (subjectParts.length > 0) {
    return truncateMetaDescription(`${name} — ${subjectParts.join(", ")} alanında özel ders veriyor.`);
  }
  if (location) {
    return truncateMetaDescription(`${name} — ${location} bölgesinde özel ders eğitmeni profili.`);
  }

  return truncateMetaDescription(`${name} özel ders profilini Merkezden'de inceleyin.`);
}
