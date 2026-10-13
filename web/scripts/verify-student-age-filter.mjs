import assert from "node:assert/strict";
import { storedStudentAgeMatchesFilter } from "@/lib/institutionStudentAgeFilter.ts";

const STORED = { min: 1.5, max: 4 };

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

console.log("student-age filter verification: all cases passed (production module)");
