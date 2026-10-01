const fs = require("fs");
const path = "web/src/components/category/CategoryFilterSidebar.tsx";
let s = fs.readFileSync(path, "utf8");
const origLen = s.length;

function mustInclude(label, needle) {
  if (!s.includes(needle)) {
    console.error("MISSING:", label, JSON.stringify(needle.slice(0, 120)));
    process.exit(1);
  }
}

// Remove setCommonPriceRange function (before setStudentAgeRange or leftover)
{
  const start = s.indexOf("  const setCommonPriceRange = (definitionId: number, value: PriceRangeSliderValue) => {");
  const end = s.indexOf("  /** Öğrenci yaşı: bağımsız ham metin (ana sayfa ile aynı). */");
  if (start >= 0 && end > start) {
    s = s.slice(0, start) + s.slice(end);
    console.log("removed setCommonPriceRange");
  } else {
    console.log("setCommonPriceRange already gone?", start, end);
  }
}

// Remove getCommonRangeSliderValue helper if it exists
{
  const start = s.indexOf("  const getCommonRangeSliderValue = (definitionId: number): PriceRangeSliderValue => {");
  if (start >= 0) {
    // find end of function - next "  const " at same indent after closing
    const marker = "\n  const renderWorkingHoursFilterSection";
    const marker2 = "\n  const renderInstructorPriceFilterSection";
    const marker3 = "\n  const schoolOrderedDynamicSections";
    let end = -1;
    for (const m of [marker, marker3, "\n  const renderStudentAgeFilterSection"]) {
      const i = s.indexOf(m, start);
      if (i > start && (end < 0 || i < end)) end = i;
    }
    // Actually getCommonRangeSliderValue is after renderInstructorPriceFilterSection
    const afterFn = s.indexOf("\n  const ", start + 10);
    // find matching by looking for next const at column 2
    let i = start + 1;
    let depth = 0;
    let begun = false;
    for (; i < s.length; i++) {
      const ch = s[i];
      if (ch === "{") {
        depth++;
        begun = true;
      } else if (ch === "}") {
        depth--;
        if (begun && depth === 0) {
          i++;
          break;
        }
      }
    }
    // skip trailing newline
    while (s[i] === "\n") i++;
    s = s.slice(0, start) + s.slice(i);
    console.log("removed getCommonRangeSliderValue");
  }
}

// workingHoursKey + priceKey
mustInclude(
  "workingHoursKey",
  `  const workingHoursKey = useMemo(
    () => \`\${String(workingHoursStart ?? "").trim()}|\${String(workingHoursEnd ?? "").trim()}\`,
    [workingHoursStart, workingHoursEnd],
  );`,
);
s = s.replace(
  `  const workingHoursKey = useMemo(
    () => \`\${String(workingHoursStart ?? "").trim()}|\${String(workingHoursEnd ?? "").trim()}\`,
    [workingHoursStart, workingHoursEnd],
  );`,
  `  const workingHoursKey = useMemo(
    () => \`\${String(workingHoursStart ?? "").trim()}|\${String(workingHoursEnd ?? "").trim()}\`,
    [workingHoursStart, workingHoursEnd],
  );
  const priceRangeKey = useMemo(
    () => \`\${String(priceMin ?? "").trim()}|\${String(priceMax ?? "").trim()}\`,
    [priceMin, priceMax],
  );`,
);

// emit payload
mustInclude(
  "emit working",
  `      workingHoursStart: String(workingHoursStart ?? "").trim(),
      workingHoursEnd: String(workingHoursEnd ?? "").trim(),
    });`,
);
s = s.replace(
  `      workingHoursStart: String(workingHoursStart ?? "").trim(),
      workingHoursEnd: String(workingHoursEnd ?? "").trim(),
    });`,
  `      workingHoursStart: String(workingHoursStart ?? "").trim(),
      workingHoursEnd: String(workingHoursEnd ?? "").trim(),
      priceMin: String(priceMin ?? "").trim(),
      priceMax: String(priceMax ?? "").trim(),
    });`,
);

s = s.replace(
  `    studentAgeRangeKey,
    workingHoursKey,
    featureGroupSelectionsKey,
  ]);`,
  `    studentAgeRangeKey,
    workingHoursKey,
    priceRangeKey,
    featureGroupSelectionsKey,
  ]);`,
);

// hasActiveFilters: replace patiliPrice loop with priceMin/Max
s = s.replace(
  `    if (String(workingHoursStart ?? "").trim() || String(workingHoursEnd ?? "").trim()) return true;
    for (const v of Object.values(selectedCommonSingle)) {`,
  `    if (String(workingHoursStart ?? "").trim() || String(workingHoursEnd ?? "").trim()) return true;
    if (String(priceMin ?? "").trim() || String(priceMax ?? "").trim()) return true;
    for (const v of Object.values(selectedCommonSingle)) {`,
);

s = s.replace(
  `    for (const range of Object.values(patiliPriceSliderRange)) {
      if (range != null) return true;
    }
    for (const r of Object.values(selectedCommonRange)) {`,
  `    for (const r of Object.values(selectedCommonRange)) {`,
);

s = s.replace(
  `    selectedCommonRange,
    patiliPriceSliderRange,
    selectedStudentAgeRange,
    workingHoursStart,
    workingHoursEnd,`,
  `    selectedCommonRange,
    selectedStudentAgeRange,
    workingHoursStart,
    workingHoursEnd,
    priceMin,
    priceMax,`,
);

// Remove leftover patiliPrice / setPatiliPriceRange / setCommonPriceRange from dep arrays
s = s.replaceAll("    patiliPriceSliderRange,\n", "");
s = s.replaceAll("    setPatiliPriceRange,\n", "");
s = s.replaceAll("    setCommonPriceRange,\n", "");

// Add renderPriceRangeFilterSection after renderWorkingHoursFilterSection
{
  const marker = `  const renderWorkingHoursFilterSection = (keySuffix: string) => (
    <div className="category-filter-section" key={\`working-hours-\${keySuffix}\`}>
      <CategoryFilterSectionTitle title="EĞİTİM SAATLERİ" />
      <div className="category-filter-working-hours-range">
        <WorkingHoursTimePicker
          value={workingHoursStart}
          onChange={setWorkingHoursStart}
          ariaLabel="Eğitim saatleri başlangıç"
          placeholder="Başlangıç"
        />
        <span className="category-filter-price-separator" aria-hidden>
          —
        </span>
        <WorkingHoursTimePicker
          value={workingHoursEnd}
          onChange={setWorkingHoursEnd}
          ariaLabel="Eğitim saatleri bitiş"
          placeholder="Bitiş"
        />
      </div>
    </div>
  );`;
  mustInclude("renderWorkingHours", marker);
  const renderPrice = `${marker}

  const renderPriceRangeFilterSection = (keySuffix: string) => (
    <div className="category-filter-section" key={\`price-range-\${keySuffix}\`}>
      <CategoryFilterSectionTitle title="AYLIK FİYAT ARALIĞI" />
      <div className="category-filter-price-inputs">
        <input
          type="text"
          inputMode="numeric"
          value={priceMin}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\\d]/g, "");
            setPriceMin(digits);
          }}
          placeholder="Min"
          aria-label="Aylık fiyat minimum"
          className="category-filter-price-input"
        />
        <span className="category-filter-price-separator" aria-hidden>
          —
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={priceMax}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\\d]/g, "");
            setPriceMax(digits);
          }}
          placeholder="Max"
          aria-label="Aylık fiyat maksimum"
          className="category-filter-price-input"
        />
      </div>
      {(priceMin || priceMax) ? (
        <p className="category-filter-section-hint">
          {[priceMin, priceMax]
            .map((v) => (v ? \`\${formatPriceFilterValue(Number(v))} TL\` : null))
            .filter(Boolean)
            .join(" — ")}
        </p>
      ) : null}
    </div>
  );`;
  // Actually skip the hint to keep UI compact like working hours - user asked compact Min — Max
  const renderPriceCompact = `${marker}

  const renderPriceRangeFilterSection = (keySuffix: string) => (
    <div className="category-filter-section" key={\`price-range-\${keySuffix}\`}>
      <CategoryFilterSectionTitle title="AYLIK FİYAT ARALIĞI" />
      <div className="category-filter-price-inputs">
        <input
          type="text"
          inputMode="numeric"
          value={priceMin}
          onChange={(e) => setPriceMin(e.target.value.replace(/[^\\d]/g, ""))}
          placeholder="Min"
          aria-label="Aylık fiyat minimum"
          className="category-filter-price-input"
        />
        <span className="category-filter-price-separator" aria-hidden>
          —
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={priceMax}
          onChange={(e) => setPriceMax(e.target.value.replace(/[^\\d]/g, ""))}
          placeholder="Max"
          aria-label="Aylık fiyat maksimum"
          className="category-filter-price-input"
        />
      </div>
    </div>
  );`;
  s = s.replace(marker, renderPriceCompact);
}

// In render maps: after working_hours block, add price_range
s = s.replaceAll(
  `if (section.kind === "working_hours") {
                        return renderWorkingHoursFilterSection("`,
  `if (section.kind === "price_range") {
                        return renderPriceRangeFilterSection("PLACEHOLDER");
                      }
                      if (section.kind === "working_hours") {
                        return renderWorkingHoursFilterSection("`,
);

// Fix placeholders by copying the same suffix from working_hours line that follows
s = s.replace(
  /if \(section\.kind === "price_range"\) \{\s*return renderPriceRangeFilterSection\("PLACEHOLDER"\);\s*\}\s*if \(section\.kind === "working_hours"\) \{\s*return renderWorkingHoursFilterSection\("([^"]+)"\);/g,
  (m, suffix) =>
    `if (section.kind === "price_range") {
                        return renderPriceRangeFilterSection("${suffix}");
                      }
                      if (section.kind === "working_hours") {
                        return renderWorkingHoursFilterSection("${suffix}");`,
);

// Okul uses different indentation potentially
s = s.replaceAll(
  `if (section.kind === "working_hours") {
                      return renderWorkingHoursFilterSection("okul");
                    }`,
  `if (section.kind === "price_range") {
                      return renderPriceRangeFilterSection("okul");
                    }
                    if (section.kind === "working_hours") {
                      return renderWorkingHoursFilterSection("okul");
                    }`,
);

// Remove price special cases in renderInstitutionCommonField
{
  // single_select price block
  const singlePrice = `    if (field.kind === "single_select") {
      if (isPriceRangeCommonField(field)) {
        return (
          <div className="category-filter-section" key={\`common-\${field.definitionId}\`}>
            <CategoryFilterSectionTitle title={title} />
            <PriceRangeSliderFilter
              value={getCommonRangeSliderValue(field.definitionId)}
              onChange={(nextRange) => setCommonPriceRange(field.definitionId, nextRange)}
              className="category-filter-price-slider"
            />
          </div>
        );
      }
      const selectedValue = selectedCommonSingle[field.definitionId] ?? "";`;
  if (s.includes("isPriceRangeCommonField(field)")) {
    s = s.replace(
      /if \(field\.kind === "single_select"\) \{\s*if \(isPriceRangeCommonField\(field\)\) \{[\s\S]*?\}\s*const selectedValue = selectedCommonSingle\[field\.definitionId\] \?\? "";/,
      `if (field.kind === "single_select") {
      const selectedValue = selectedCommonSingle[field.definitionId] ?? "";`,
    );
  }

  // number_range price block
  s = s.replace(
    /if \(field\.kind === "number_range"\) \{\s*if \(\s*field\.definitionId === INSTITUTION_PRICE_RANGE_DEFINITION_ID \|\|[\s\S]*?className="category-filter-price-slider"\s*\/>\s*<\/div>\s*\);\s*\}\s*const value = selectedCommonRange\[field\.definitionId\]/,
    `if (field.kind === "number_range") {
      const value = selectedCommonRange[field.definitionId]`,
  );

  // multi_select price block
  s = s.replace(
    /if \(field\.kind === "multi_select"\) \{\s*if \(isPriceRangeCommonField\(field\)\) \{[\s\S]*?\}\s*const selectedSet = selectedCommonMulti\[field\.definitionId\]/,
    `if (field.kind === "multi_select") {
      const selectedSet = selectedCommonMulti[field.definitionId]`,
  );

  s = s.replace(
    /const sortedChoices = isPriceRangeCommonField\(field\)\s*\? sortPriceRangeChoicesByMin\(field\.choices\)\s*: sortCheckboxOptionsByLabel\(field\.choices, \(c\) => c\.name\);/,
    `const sortedChoices = sortCheckboxOptionsByLabel(field.choices, (c) => c.name);`,
  );
}

// Remove Patili special price slider render
s = s.replace(
  /const field = section\.field;\s*const title = getPatiliDostlarInstitutionFilterSectionTitle\(field\.name\);\s*if \(\s*field\.kind === "multi_select" &&\s*isInstitutionPriceRangeFieldName\(field\.name\)\s*\) \{[\s\S]*?\}\s*return renderInstitutionCommonField\(field, title\);/,
  `const field = section.field;
                      const title = getPatiliDostlarInstitutionFilterSectionTitle(field.name);
                      return renderInstitutionCommonField(field, title);`,
);

// Generic fallback: add price section
s = s.replace(
  `{renderWorkingHoursFilterSection("generic")}
                      </>
                    )`,
  `{renderWorkingHoursFilterSection("generic")}
                        {renderPriceRangeFilterSection("generic")}
                      </>
                    )`,
);

fs.writeFileSync(path, s);
console.log("phase2", origLen, "->", s.length);

// leftover checks
for (const bad of [
  "INSTITUTION_PRICE_RANGE_DEFINITION_ID",
  "isInstitutionPriceRangeFieldName",
  "orderPriceRangeChoicesFromCanonical",
  "sortPriceRangeChoicesByMin",
  "parseInstructorPriceRangeBound",
  "patiliPriceSliderRange",
  "setPatiliPriceRange",
  "isPriceRangeCommonField",
  "setCommonPriceRange",
  "getCommonRangeSliderValue",
  "resolveOverlappingPriceChoiceIds",
]) {
  if (s.includes(bad)) console.warn("STILL HAS", bad);
}
