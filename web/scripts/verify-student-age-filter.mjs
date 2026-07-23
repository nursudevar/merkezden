/**
 * Öğrenci yaşı filtre kuralları — kurum aralığı 1.5–4.
 * Çalıştır: node scripts/verify-student-age-filter.mjs
 */
import assert from "node:assert/strict";

const STORED = { min: 1.5, max: 4 };

function studentAgeRangesIntersect(stored, selected) {
  return stored.min <= selected.max && stored.max >= selected.min;
}

function storedStudentAgeMatchesFilter(stored, filter) {
  const storedMin = Math.min(stored.min, stored.max);
  const storedMax = Math.max(stored.min, stored.max);
  const selectedMin = filter.min;
  const selectedMax = filter.max;

  const hasMin = selectedMin != null && Number.isFinite(selectedMin);
  const hasMax = selectedMax != null && Number.isFinite(selectedMax);
  if (!hasMin && !hasMax) return false;

  if (hasMin && hasMax) {
    const lo = Math.min(selectedMin, selectedMax);
    const hi = Math.max(selectedMin, selectedMax);
    return studentAgeRangesIntersect({ min: storedMin, max: storedMax }, { min: lo, max: hi });
  }
  if (hasMin) {
    return storedMin <= selectedMin && selectedMin <= storedMax;
  }
  return storedMin <= selectedMax && selectedMax <= storedMax;
}

function minOnly(value) {
  return storedStudentAgeMatchesFilter(STORED, { min: value, max: null });
}

function maxOnly(value) {
  return storedStudentAgeMatchesFilter(STORED, { min: null, max: value });
}

function both(min, max) {
  return storedStudentAgeMatchesFilter(STORED, { min, max });
}

assert.equal(minOnly(0.5), false, "min-only 0.5 must not match 1.5–4");
assert.equal(minOnly(2), true, "min-only 2 must match 1.5–4");

assert.equal(maxOnly(6), false, "max-only 6 must not match 1.5–4");
assert.equal(maxOnly(3), true, "max-only 3 must match 1.5–4");

assert.equal(both(2, 6), true, "search 2–6 must overlap 1.5–4");
assert.equal(both(5, 8), false, "search 5–8 must not overlap 1.5–4");
assert.equal(both(0.5, 1), false, "search 0.5–1 must not overlap 1.5–4");

assert.equal(
  storedStudentAgeMatchesFilter(STORED, { min: null, max: null }),
  false,
  "empty filter must not match",
);

console.log("student-age filter verification: all cases passed");
