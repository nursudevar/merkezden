/**
 * Normalizes Turkish characters for search matching
 * Converts İ/ı, I/ı, ö/Ö, ü/Ü, ş/Ş, ç/Ç, ğ/Ğ to ASCII equivalents
 */
export function normalizeTurkish(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g');
}

/**
 * Checks if search query matches text (case-insensitive, Turkish-aware)
 * Supports prefix, substring, and word-based matching
 */
export function matchesSearch(text: string, query: string): boolean {
  if (!query || query.length === 0) return false;
  
  const normalizedText = normalizeTurkish(text);
  const normalizedQuery = normalizeTurkish(query);
  
  // Direct substring match (covers cases like "okul" in "Ankara Okul")
  if (normalizedText.includes(normalizedQuery)) {
    return true;
  }
  
  // Word-based matching: check each word individually
  // This handles cases like "spo" matching "spor" in "Spor Akademisi"
  const words = normalizedText.split(/\s+/);
  for (const word of words) {
    // Check if query is a prefix of the word (e.g., "spo" -> "spor")
    if (word.startsWith(normalizedQuery)) {
      return true;
    }
    // Check if query is a substring of the word (e.g., "spo" in "spor")
    if (word.includes(normalizedQuery)) {
      return true;
    }
    // Check if word is a prefix of query (for very short queries)
    if (normalizedQuery.length <= 3 && word.startsWith(normalizedQuery.substring(0, Math.min(2, normalizedQuery.length)))) {
      return true;
    }
  }
  
  return false;
}
