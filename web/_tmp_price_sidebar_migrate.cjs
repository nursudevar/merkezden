const fs = require("fs");
const path = "web/src/components/category/CategoryFilterSidebar.tsx";
let s = fs.readFileSync(path, "utf8");
const origLen = s.length;

function mustInclude(label, needle) {
  if (!s.includes(needle)) {
    console.error("MISSING:", label, needle.slice(0, 80));
    process.exit(1);
  }
}

// 1) Imports
{
  const from = `import {
  INSTITUTION_PRICE_RANGE_DEFINITION_ID,
  INSTITUTION_PRICE_FILTER_MAX,
  INSTITUTION_PRICE_FILTER_MIN,
  isInstitutionPriceRangeFieldName,
  orderPriceRangeChoicesFromCanonical,
  parseInstructorPriceRangeBound,
  rangesOverlap,
  sortPriceRangeChoicesByMin,
} from "@/lib/institutionPriceRangeFilter";`;
  const to = `import {
  formatPriceFilterValue,
  parsePriceInputToIntOrNull,
} from "@/lib/institutionPriceRangeFilter";`;
  mustInclude("imports", from);
  s = s.replace(from, to);
}

// 2) Constants
if (!s.includes("PRICE_RANGE_FILTER_ORDER_NAME")) {
  s = s.replace(
    'const WORKING_HOURS_FILTER_ORDER_NAME = "Eğitim Saatleri";',
    `const WORKING_HOURS_FILTER_ORDER_NAME = "Eğitim Saatleri";
/** Kolon-based Aylık Fiyat Aralığı filtre section order adı (feature değil). */
const PRICE_RANGE_FILTER_ORDER_NAME = "Aylık Fiyat Aralığı";`,
  );
}

// 3) Remove resolveOverlappingPriceChoiceIds
{
  const start = s.indexOf("function resolveOverlappingPriceChoiceIds(");
  const end = s.indexOf("function buildPatiliBaslicaCommonField(");
  if (start < 0 || end <= start) {
    console.error("resolveOverlapping markers fail", start, end);
    process.exit(1);
  }
  s = s.slice(0, start) + s.slice(end);
}

// 4) buildPatiliBaslicaCommonField: skip price + no canonical order
{
  const from = `  const orderedChoices = isInstitutionPriceRangeFieldName(displayName)
    ? orderPriceRangeChoicesFromCanonical(defChoices)
    : defChoices;

  if (inputType === "single_select") {`;
  const to = `  const orderedChoices = defChoices;

  {
    const priceKey = normalizeCommonFieldNameKey(displayName);
    if (
      priceKey.includes("aylik fiyat araligi") ||
      priceKey.includes("aylik ortalama fiyat") ||
      priceKey === "fiyat araligi" ||
      priceKey.includes("ortalama fiyat araligi")
    ) {
      return null;
    }
  }

  if (inputType === "single_select") {`;
  mustInclude("patili build", from);
  s = s.replace(from, to);
}

// 5) Remove isPriceRangeCommonField
{
  const start = s.indexOf("function isPriceRangeCommonField(field: CommonField): boolean {");
  if (start < 0) {
    console.error("isPriceRangeCommonField missing");
    process.exit(1);
  }
  const end = s.indexOf("\nfunction ", start + 1);
  if (end <= start) {
    console.error("isPriceRangeCommonField end fail");
    process.exit(1);
  }
  s = s.slice(0, start) + s.slice(end + 1);
}

// 6) Add price_range to DynamicFilterSection unions
s = s.replaceAll(
  '| { kind: "working_hours"; originalIndex: number };',
  '| { kind: "working_hours"; originalIndex: number }\n  | { kind: "price_range"; originalIndex: number };',
);

// 7) Section order name helpers
s = s.replaceAll(
  `  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  return WORKING_HOURS_FILTER_ORDER_NAME;
}`,
  `  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  if (section.kind === "price_range") return PRICE_RANGE_FILTER_ORDER_NAME;
  return WORKING_HOURS_FILTER_ORDER_NAME;
}`,
);

s = s.replaceAll(
  `  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  return section.group.name;
}`,
  `  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  if (section.kind === "price_range") return PRICE_RANGE_FILTER_ORDER_NAME;
  return section.group.name;
}`,
);

s = s.replaceAll(
  `  if (section.kind === "student_age") return "Öğrenci Yaşı";
  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  return section.group.name;
}`,
  `  if (section.kind === "student_age") return "Öğrenci Yaşı";
  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  if (section.kind === "price_range") return PRICE_RANGE_FILTER_ORDER_NAME;
  return section.group.name;
}`,
);

// 8) Inject price_range after working_hours pushes (avoid double)
{
  const re =
    /sections\.push\(\{\s*\n\s*kind:\s*"working_hours",\s*\n\s*originalIndex:\s*([^,\n]+),?\s*\n\s*\}\);/g;
  let count = 0;
  s = s.replace(re, (full, idxExpr) => {
    count += 1;
    const idx = String(idxExpr).trim();
    return `sections.push({
      kind: "working_hours",
      originalIndex: ${idx},
    });
    sections.push({
      kind: "price_range",
      originalIndex: (${idx}) + 1,
    });`;
  });
  console.log("injected price_range after working_hours:", count);
  if (count < 8) {
    console.error("expected many working_hours injections");
    process.exit(1);
  }
}

// 9) State: replace patiliPrice with priceMin/Max
{
  const from = `  /** Patili fiyat slider UI state (choice eşlemesi selectedCommonMulti üzerinden gider). */
  const [patiliPriceSliderRange, setPatiliPriceSliderRange] = useState<
    Record<number, PriceRangeSliderValue>
  >({});
  const [selectedCommonSingle, setSelectedCommonSingle] = useState<Record<number, string>>({});`;
  const to = `  const [selectedCommonSingle, setSelectedCommonSingle] = useState<Record<number, string>>({});`;
  mustInclude("patili state", from);
  s = s.replace(from, to);
}

s = s.replace(
  `  const [workingHoursStart, setWorkingHoursStart] = useState("");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("");`,
  `  const [workingHoursStart, setWorkingHoursStart] = useState("");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");`,
);

// resetCategoryFeatureFilters
s = s.replace(
  `    setSelectedCommonRange({});
    setPatiliPriceSliderRange({});
    setSelectedStudentAgeRange(null);
    setWorkingHoursStart("");
    setWorkingHoursEnd("");`,
  `    setSelectedCommonRange({});
    setSelectedStudentAgeRange(null);
    setWorkingHoursStart("");
    setWorkingHoursEnd("");
    setPriceMin("");
    setPriceMax("");`,
);

// effect cleanup setPatiliPriceSliderRange
s = s.replaceAll("setPatiliPriceSliderRange({});\n", "");
s = s.replaceAll("      setPatiliPriceSliderRange({});\n", "");

// commonFields load: remove price ordering + skip leftover price defs
s = s.replace(
  `        const orderedChoices =
          def.id === INSTITUTION_PRICE_RANGE_DEFINITION_ID || isInstitutionPriceRangeFieldName(displayName)
            ? orderPriceRangeChoicesFromCanonical(defChoices)
            : defChoices;

        if (
          isLegacyStudentAgeMultiSelectFeature({`,
  `        const orderedChoices = defChoices;

        if (
          isLegacyStudentAgeMultiSelectFeature({`,
);

{
  const hoursSkip = `        {
          const hoursKey = normalizeCommonFieldNameKey(displayName);
          if (
            hoursKey === "egitim saatleri" ||
            hoursKey === "okul saatleri" ||
            hoursKey === "kurum saatleri" ||
            hoursKey === "calisma saatleri"
          ) {
            return;
          }
        }`;
  const withPrice = `        {
          const hoursKey = normalizeCommonFieldNameKey(displayName);
          if (
            hoursKey === "egitim saatleri" ||
            hoursKey === "okul saatleri" ||
            hoursKey === "kurum saatleri" ||
            hoursKey === "calisma saatleri"
          ) {
            return;
          }
        }

        {
          const priceKey = normalizeCommonFieldNameKey(displayName);
          if (
            priceKey.includes("aylik fiyat araligi") ||
            priceKey.includes("aylik ortalama fiyat") ||
            priceKey === "fiyat araligi" ||
            priceKey.includes("ortalama fiyat araligi")
          ) {
            return;
          }
        }`;
  mustInclude("hours skip", hoursSkip);
  s = s.replace(hoursSkip, withPrice);
}

// Remove setPatiliPriceRange function
{
  const start = s.indexOf("  const setPatiliPriceRange = (");
  const end = s.indexOf("  /** Öğrenci yaşı: bağımsız ham metin (ana sayfa ile aynı). */");
  if (start < 0 || end <= start) {
    console.error("setPatiliPriceRange markers", start, end);
    process.exit(1);
  }
  s = s.slice(0, start) + s.slice(end);
}

// Remove setCommonPriceRange if present (kurum slider helper)
{
  const start = s.indexOf("  const setCommonPriceRange = (definitionId: number, value: PriceRangeSliderValue) => {");
  if (start >= 0) {
    const end = s.indexOf("  /** Öğrenci yaşı:", start);
    // may already be removed with setPatili; find next const after function
    const end2 = s.indexOf("\n  const setStudentAgeRange", start);
    const cutEnd = end > start ? end : end2;
    if (cutEnd > start) {
      // Keep setStudentAgeRange - setCommonPriceRange is before setPatili which we removed
      // Actually setCommonPriceRange is before setPatili which we removed. Check if still there.
      const after = s.slice(start, start + 40);
      console.log("setCommonPriceRange still at", start, after);
    }
  }
}

fs.writeFileSync(path, s);
console.log("phase1 written", origLen, "->", s.length);
