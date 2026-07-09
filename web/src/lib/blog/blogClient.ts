import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BlogPost } from "@/lib/data/blog";

export type BlogCategory = {
  id: number;
  name: string;
};

export type MyBlogPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  cover_image_url: string | null;
  cover_image_path: string | null;
  is_published: boolean | null;
  published_at: string | null;
  created_at: string | null;
  category_id: number | null;
  categoryName: string;
};

export type CreateBlogPostPayload = {
  author_auth_id: string;
  author_type: "individual" | "instructor";
  author_full_name: string;
  category_id: number;
  title: string;
  slug: string;
  content: string;
  cover_image_url: string;
  cover_image_path: string;
};

export type PublishedBlogPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  coverImageUrl: string;
  authorName: string;
  publishedAt: string | null;
  categoryName: string;
};

const PUBLISHED_BLOG_POST_SELECT =
  "id, title, slug, content, cover_image_url, author_full_name, published_at, created_at, category:institution_categories(name)";

function resolveCategoryName(
  category: { name?: string | null } | Array<{ name?: string | null }> | null | undefined
): string {
  const categoryRow = Array.isArray(category) ? category[0] : category;
  return String(categoryRow?.name ?? "").trim() || "-";
}

export function mapPublishedPostRow(row: {
  id: string | number;
  title?: string | null;
  slug?: string | null;
  content?: string | null;
  cover_image_url?: string | null;
  author_full_name?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  category?: { name?: string | null } | Array<{ name?: string | null }> | null;
}): PublishedBlogPost {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    slug: String(row.slug ?? ""),
    content: String(row.content ?? ""),
    coverImageUrl: String(row.cover_image_url ?? ""),
    authorName: String(row.author_full_name ?? "").trim() || "Yazar",
    publishedAt: row.published_at ?? row.created_at ?? null,
    categoryName: resolveCategoryName(row.category),
  };
}

function safeStorageFileName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export function generateBlogSlug(title: string): string {
  const turkishMap: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    ö: "o",
    ş: "s",
    ü: "u",
    Ç: "c",
    Ğ: "g",
    İ: "i",
    I: "i",
    Ö: "o",
    Ş: "s",
    Ü: "u",
  };

  let slug = title.trim().toLowerCase();
  slug = slug.replace(/[çğıöşüÇĞİÖŞÜ]/g, (char) => turkishMap[char] ?? char);
  slug = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  slug = slug.replace(/[^a-z0-9\s-]/g, "");
  slug = slug.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  if (!slug) {
    slug = "blog-yazisi";
  }

  return `${slug}-${Date.now().toString(36)}`;
}

export async function fetchBlogCategories(): Promise<BlogCategory[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("institution_categories")
    .select("id, name, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    const fallback = await supabase
      .from("institution_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("id", { ascending: true });

    if (fallback.error) {
      throw new Error("Kategoriler yüklenemedi.");
    }

    return ((fallback.data ?? []) as Array<{ id: number; name: string | null }>)
      .map((row) => ({
        id: row.id,
        name: String(row.name ?? "").trim(),
      }))
      .filter((row) => row.name.length > 0);
  }

  return ((data ?? []) as Array<{ id: number; name: string | null }>)
    .map((row) => ({
      id: row.id,
      name: String(row.name ?? "").trim(),
    }))
    .filter((row) => row.name.length > 0);
}

export async function fetchMyBlogPosts(authorAuthId: string): Promise<MyBlogPost[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(
      "id, title, slug, content, cover_image_url, cover_image_path, is_published, published_at, created_at, category_id, category:institution_categories(name)"
    )
    .eq("author_auth_id", authorAuthId)
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error("Blog yazıları yüklenemedi.");
  }

  return (data ?? []).map((row) => {
    return {
      id: String(row.id),
      title: String(row.title ?? ""),
      slug: String(row.slug ?? ""),
      content: String(row.content ?? ""),
      cover_image_url: row.cover_image_url ?? null,
      cover_image_path: row.cover_image_path ?? null,
      is_published: row.is_published ?? null,
      published_at: row.published_at ?? null,
      created_at: row.created_at ?? null,
      category_id: row.category_id ?? null,
      categoryName: resolveCategoryName(
        row.category as { name?: string | null } | Array<{ name?: string | null }> | null
      ),
    };
  });
}

export async function fetchPublishedBlogPosts(limit?: number): Promise<PublishedBlogPost[]> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from("blog_posts")
    .select(PUBLISHED_BLOG_POST_SELECT)
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (limit != null) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) return [];

  return (data ?? []).map((row) => mapPublishedPostRow(row));
}

export async function fetchPublishedBlogPostBySlug(slug: string): Promise<PublishedBlogPost | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(PUBLISHED_BLOG_POST_SELECT)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) return null;
  return mapPublishedPostRow(data);
}

export async function uploadBlogCoverImage(
  file: File,
  authorType: "individual" | "instructor",
  authorAuthId: string
): Promise<{ publicUrl: string; path: string } | { error: string }> {
  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    return { error: "Görsel en fazla 10MB olabilir." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "Lütfen geçerli bir görsel seçin." };
  }

  const supabase = createSupabaseBrowserClient();
  const timestamp = Date.now();
  const cleanName = safeStorageFileName(file.name) || `${timestamp}.jpg`;
  const path = `blog-posts/${authorType}/${authorAuthId}/${timestamp}-${cleanName}`;

  const { error } = await supabase.storage.from("blog-images").upload(path, file, {
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    return { error: "Görsel yüklenemedi." };
  }

  const publicUrl = supabase.storage.from("blog-images").getPublicUrl(path).data.publicUrl;
  return { publicUrl, path };
}

export async function createBlogPost(payload: CreateBlogPostPayload): Promise<MyBlogPost> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .insert({
      author_auth_id: payload.author_auth_id,
      author_type: payload.author_type,
      author_full_name: payload.author_full_name,
      category_id: payload.category_id,
      title: payload.title,
      slug: payload.slug,
      content: payload.content,
      cover_image_url: payload.cover_image_url,
      cover_image_path: payload.cover_image_path,
      is_published: true,
    })
    .select(
      "id, title, slug, content, cover_image_url, cover_image_path, is_published, published_at, created_at, category_id, category:institution_categories(name)"
    )
    .single();

  if (error || !data) {
    throw new Error("Blog yazısı kaydedilemedi.");
  }

  return {
    id: String(data.id),
    title: String(data.title ?? ""),
    slug: String(data.slug ?? ""),
    content: String(data.content ?? ""),
    cover_image_url: data.cover_image_url ?? null,
    cover_image_path: data.cover_image_path ?? null,
    is_published: data.is_published ?? null,
    published_at: data.published_at ?? null,
    created_at: data.created_at ?? null,
    category_id: data.category_id ?? null,
    categoryName: resolveCategoryName(
      data.category as { name?: string | null } | Array<{ name?: string | null }> | null
    ),
  };
}

export function formatBlogPostDate(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export type DisplayBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  categoryName: string;
  authorName: string;
  publishedDate: string;
  imageUrl: string;
  content: string;
  featured?: boolean;
  isMock: boolean;
};

export function formatBlogPostDateDisplay(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  const day = date.getDate();
  const month = date
    .toLocaleDateString("tr-TR", { month: "long" })
    .toLocaleUpperCase("tr-TR");
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function createBlogExcerpt(content: string, maxLength = 160): string {
  const text = content.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

export function mapPublishedPostToDisplay(post: PublishedBlogPost): DisplayBlogPost {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: createBlogExcerpt(post.content),
    categoryName: post.categoryName,
    authorName: post.authorName,
    publishedDate: formatBlogPostDateDisplay(post.publishedAt),
    imageUrl: post.coverImageUrl,
    content: post.content,
    isMock: false,
  };
}

export function mapMockPostToDisplay(post: BlogPost): DisplayBlogPost {
  return {
    id: post.slug,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    categoryName: post.category,
    authorName: post.authorName,
    publishedDate: post.date,
    imageUrl: post.coverImage,
    content: "",
    featured: post.featured,
    isMock: true,
  };
}

export function mergeDisplayBlogPosts(
  realPosts: DisplayBlogPost[],
  mockPosts: DisplayBlogPost[],
  limit?: number,
): DisplayBlogPost[] {
  const seenSlugs = new Set<string>();
  const merged: DisplayBlogPost[] = [];

  for (const post of [...realPosts, ...mockPosts]) {
    if (!post.slug || seenSlugs.has(post.slug)) continue;
    seenSlugs.add(post.slug);
    merged.push(post);
    if (limit != null && merged.length >= limit) break;
  }

  return merged;
}
