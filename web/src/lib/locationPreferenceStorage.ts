"use client";

export type StoredLocationPreference = {
  ilSlug: string;
  ilceSlug: string;
};

const STORAGE_KEY = "merkezden.locationPreference.v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readLocationPreference(): StoredLocationPreference | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLocationPreference> | null;
    const ilSlug = String(parsed?.ilSlug ?? "")
      .trim()
      .toLowerCase();
    if (!ilSlug) return null;
    const ilceSlug = String(parsed?.ilceSlug ?? "")
      .trim()
      .toLowerCase();
    return { ilSlug, ilceSlug };
  } catch {
    return null;
  }
}

export function writeLocationPreference(preference: StoredLocationPreference): void {
  if (!canUseStorage()) return;
  const ilSlug = String(preference.ilSlug ?? "")
    .trim()
    .toLowerCase();
  if (!ilSlug) {
    clearLocationPreference();
    return;
  }
  const ilceSlug = String(preference.ilceSlug ?? "")
    .trim()
    .toLowerCase();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ilSlug, ilceSlug }));
  } catch {
    // Quota / private mode — preference is best-effort only.
  }
}

export function clearLocationPreference(): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
