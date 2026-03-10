/**
 * Merges class names. Filters out falsy values.
 */
export function cn(...args: (string | undefined | false | null)[]): string {
  return args.filter(Boolean).join(" ");
}
