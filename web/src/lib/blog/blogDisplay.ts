import type { BlogPost } from "@/lib/data/blog";
import type { PublishedBlogPost } from "@/lib/blog/blogClient";

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

function createExcerpt(content: string, maxLength = 160): string {
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
    excerpt: createExcerpt(post.content),
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
  limit?: number
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
