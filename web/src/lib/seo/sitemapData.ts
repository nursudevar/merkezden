import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCategoryHref } from "@/lib/categoryHelpers";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";

/** publicInstructorClient.PUBLIC_INSTRUCTORS_TABLE ile aynı — client modül import etmeden. */
const PUBLIC_INSTRUCTORS_TABLE = "public_instructors";
const PAGE_SIZE = 1000;
const MAX_PAGES = 200;

export type SitemapPathEntry = {
  path: string;
  lastModified?: Date;
};

function createSitemapSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[sitemap] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function parseOptionalDate(value: unknown): Date | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** `publicInstructorSearch.getPublicInstructorDetailHref` ile aynı canonical kural. */
function instructorDetailPath(slug: string | null | undefined, id: number): string {
  const hrefKey = String(slug ?? "").trim() || String(id);
  return `/egitmenler/${encodeURIComponent(hrefKey)}`;
}

async function fetchAllPagedRows<T extends Record<string, unknown>>(
  fetchPage: (
    from: number,
    to: number,
  ) => Promise<{ data: T[] | null; error: { message?: string; code?: string } | null }>,
  label: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) {
      console.error(`[sitemap] ${label} page ${page} failed:`, error.message ?? error);
      break;
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Onaylı ve slug'ı olan kurumlar — canonical `/kurumlar/[slug]`. */
export async function fetchApprovedInstitutionSitemapEntries(): Promise<SitemapPathEntry[]> {
  const supabase = createSitemapSupabaseClient();
  if (!supabase) return [];

  try {
    const rows = await fetchAllPagedRows<{ slug: string | null }>(
      async (from, to) => {
        const { data, error } = await supabase
          .from("institutions")
          .select("slug")
          .eq("is_approved", true)
          .not("slug", "is", null)
          .neq("slug", "")
          .order("id", { ascending: true })
          .range(from, to);
        return { data: (data as Array<{ slug: string | null }> | null) ?? null, error };
      },
      "institutions",
    );

    const seen = new Set<string>();
    const entries: SitemapPathEntry[] = [];
    for (const row of rows) {
      const slug = String(row.slug ?? "").trim();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      entries.push({ path: getInstitutionDetailHref({ slug }) });
    }
    return entries;
  } catch (error) {
    console.error("[sitemap] institutions fetch failed:", error);
    return [];
  }
}

type InstructorSitemapRow = {
  id: number;
  slug?: string | null;
  created_at?: string | null;
};

async function fetchInstructorRowsFromTable(
  supabase: SupabaseClient,
  table: string,
): Promise<InstructorSitemapRow[] | null> {
  const withCreatedAt = await fetchAllPagedRows<InstructorSitemapRow>(
    async (from, to) => {
      const { data, error } = await supabase
        .from(table)
        .select("id, slug, created_at")
        .eq("is_approved", true)
        .eq("is_active", true)
        .order("id", { ascending: true })
        .range(from, to);
      return { data: (data as InstructorSitemapRow[] | null) ?? null, error };
    },
    `instructors:${table}:created_at`,
  );

  // created_at kolonu yoksa veya ilk sorguda hata olduysa (0 satır + probe)
  if (withCreatedAt.length > 0) return withCreatedAt;

  const probe = await supabase
    .from(table)
    .select("id, slug, created_at")
    .eq("is_approved", true)
    .eq("is_active", true)
    .limit(1);

  if (!probe.error) {
    // Tablo boş veya gerçekten kayıt yok
    return withCreatedAt;
  }

  const withoutCreatedAt = await fetchAllPagedRows<InstructorSitemapRow>(
    async (from, to) => {
      const { data, error } = await supabase
        .from(table)
        .select("id, slug")
        .eq("is_approved", true)
        .eq("is_active", true)
        .order("id", { ascending: true })
        .range(from, to);
      return { data: (data as InstructorSitemapRow[] | null) ?? null, error };
    },
    `instructors:${table}:base`,
  );

  // base select de hata verdiyse tablo yok / erişilemez
  if (withoutCreatedAt.length === 0) {
    const baseProbe = await supabase
      .from(table)
      .select("id, slug")
      .eq("is_approved", true)
      .eq("is_active", true)
      .limit(1);
    if (baseProbe.error) return null;
  }

  return withoutCreatedAt;
}

/**
 * Public eğitmenler — önce `public_instructors`, gerekirse `instructors`.
 * Detay URL: slug varsa `/egitmenler/{slug}`, yoksa `/egitmenler/{id}`.
 */
export async function fetchPublicInstructorSitemapEntries(): Promise<SitemapPathEntry[]> {
  const supabase = createSitemapSupabaseClient();
  if (!supabase) return [];

  try {
    // Tablo erişilebilirse (boş olsa bile) onu kullan; yalnızca erişilemezse fallback.
    const fromPublic = await fetchInstructorRowsFromTable(supabase, PUBLIC_INSTRUCTORS_TABLE);
    const rows =
      fromPublic !== null
        ? fromPublic
        : ((await fetchInstructorRowsFromTable(supabase, "instructors")) ?? []);

    const seen = new Set<string>();
    const entries: SitemapPathEntry[] = [];
    for (const row of rows) {
      const id = Number(row.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const path = instructorDetailPath(row.slug, id);
      if (seen.has(path)) continue;
      seen.add(path);
      entries.push({
        path,
        lastModified: parseOptionalDate(row.created_at),
      });
    }
    return entries;
  } catch (error) {
    console.error("[sitemap] instructors fetch failed:", error);
    return [];
  }
}

/** Yayınlanmış blog yazıları — `/blog-yazilari/[slug]`. */
export async function fetchPublishedBlogSitemapEntries(): Promise<SitemapPathEntry[]> {
  const supabase = createSitemapSupabaseClient();
  if (!supabase) return [];

  try {
    const rows = await fetchAllPagedRows<{
      slug: string | null;
      published_at: string | null;
      created_at: string | null;
    }>(
      async (from, to) => {
        const { data, error } = await supabase
          .from("blog_posts")
          .select("slug, published_at, created_at")
          .eq("is_published", true)
          .not("slug", "is", null)
          .neq("slug", "")
          .order("id", { ascending: true })
          .range(from, to);
        return {
          data:
            (data as Array<{
              slug: string | null;
              published_at: string | null;
              created_at: string | null;
            }> | null) ?? null,
          error,
        };
      },
      "blog_posts",
    );

    const seen = new Set<string>();
    const entries: SitemapPathEntry[] = [];
    for (const row of rows) {
      const slug = String(row.slug ?? "").trim();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      entries.push({
        path: `/blog-yazilari/${encodeURIComponent(slug)}`,
        lastModified:
          parseOptionalDate(row.published_at) ?? parseOptionalDate(row.created_at),
      });
    }
    return entries;
  } catch (error) {
    console.error("[sitemap] blog_posts fetch failed:", error);
    return [];
  }
}

/**
 * Sabit kategori sayfalarında olmayan aktif kategoriler → `/kategori/{slug}`.
 * getCategoryHref bilinen slug'ları `/okul` vb. döndürür; onlar statik listede.
 */
export async function fetchExtraCategorySitemapEntries(): Promise<SitemapPathEntry[]> {
  const supabase = createSitemapSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("institution_categories")
      .select("name, slug")
      .eq("is_active", true);

    if (error || !data) {
      if (error) console.error("[sitemap] institution_categories failed:", error.message);
      return [];
    }

    const seen = new Set<string>();
    const entries: SitemapPathEntry[] = [];
    for (const row of data as Array<{ name?: string | null; slug?: string | null }>) {
      const name = String(row.name ?? "").trim();
      const slug = String(row.slug ?? "").trim();
      const href = getCategoryHref(name, slug);
      if (!href || !href.startsWith("/kategori/")) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      entries.push({ path: href });
    }
    return entries;
  } catch (error) {
    console.error("[sitemap] institution_categories fetch failed:", error);
    return [];
  }
}
