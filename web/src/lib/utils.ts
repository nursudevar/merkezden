/**
 * Merges class names. Filters out falsy values.
 */
export function cn(...args: (string | undefined | false | null)[]): string {
  return args.filter(Boolean).join(" ");
}

/**
 * Normalizes Turkish characters for search matching
 * Converts İ/ı, I/ı, ö/Ö, ü/Ü, ş/Ş, ç/Ç, ğ/Ğ to ASCII equivalents
 */
export function normalizeTurkish(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesSearch(text: string, query: string): boolean {
  if (!query || query.trim().length === 0) return false;

  const normalizedText = normalizeTurkish(text);
  const normalizedQuery = normalizeTurkish(query);

  if (normalizedText.includes(normalizedQuery)) {
    return true;
  }

  const words = normalizedText.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(normalizedQuery)) {
      return true;
    }
    if (word.includes(normalizedQuery)) {
      return true;
    }
    if (
      normalizedQuery.length <= 3 &&
      word.startsWith(normalizedQuery.substring(0, Math.min(2, normalizedQuery.length)))
    ) {
      return true;
    }
  }

  return false;
}
