import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapPublishedPostRow, type PublishedBlogPost } from "@/lib/blog/blogClient";

const PUBLISHED_BLOG_POST_SELECT =
  "id, title, slug, content, cover_image_url, author_full_name, published_at, created_at, category:institution_categories(name)";

export async function fetchPublishedBlogPostsServer(
  limit?: number
): Promise<PublishedBlogPost[]> {
  const supabase = await createSupabaseServerClient();
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

export async function fetchPublishedBlogPostBySlugServer(
  slug: string
): Promise<PublishedBlogPost | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(PUBLISHED_BLOG_POST_SELECT)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) return null;
  return mapPublishedPostRow(data);
}
