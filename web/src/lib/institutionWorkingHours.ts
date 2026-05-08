/** Postgres `time` (HH:mm[:ss]) -> HTML `input[type=time]` (HH:mm). */
export function institutionTimeToInputHHMM(value: string | null | undefined): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** HTML `input[type=time]` -> Postgres `time` (HH:mm:ss) veya boşsa null. */
export function inputHHMMToDbTimeOrNull(value: string): string | null {
  const t = String(value ?? "").trim();
  if (!t) return null;
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  return t || null;
}

/** İkisi de doluysa `HH:mm-HH:mm`, aksi halde null. */
export function formatWorkingHoursRange(
  start: string | null | undefined,
  end: string | null | undefined
): string | null {
  const a = institutionTimeToInputHHMM(start);
  const b = institutionTimeToInputHHMM(end);
  if (a && b) return `${a}-${b}`;
  return null;
}
