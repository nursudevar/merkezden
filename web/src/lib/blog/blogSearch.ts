export type BlogSearchableFields = {
  title?: string | null;
  content?: string | null;
  excerpt?: string | null;
  authorName?: string | null;
  institutionName?: string | null;
  instructorName?: string | null;
  cityName?: string | null;
  districtName?: string | null;
};

/** Blog araması için Türkçe karakter + case normalize. */
export function normalizeBlogSearchText(value: string): string {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bir blog kaydının aranabilir metnini tek yerde birleştirir. */
export function buildBlogSearchableText(post: BlogSearchableFields): string {
  return [
    post.title,
    post.content,
    post.excerpt,
    post.authorName,
    post.institutionName,
    post.instructorName,
    post.cityName,
    post.districtName,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function blogSearchTokenMatches(haystack: string, token: string): boolean {
  if (!token) return true;
  if (haystack.includes(token)) return true;
  return haystack.split(/\s+/).some((word) => word.startsWith(token));
}

/** Tüm query token'ları searchable metinde prefix/substring olarak bulunursa true. */
export function matchesBlogSearch(
  post: BlogSearchableFields,
  searchQuery: string,
): boolean {
  const tokens = normalizeBlogSearchText(searchQuery)
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;

  const haystack = normalizeBlogSearchText(buildBlogSearchableText(post));
  if (!haystack) return false;

  return tokens.every((token) => blogSearchTokenMatches(haystack, token));
}
