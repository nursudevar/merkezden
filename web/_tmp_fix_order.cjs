const fs = require("fs");
const p = "web/src/components/category/CategoryFilterSidebar.tsx";
let s = fs.readFileSync(p, "utf8");
const from = `  if (section.kind === "student_age") return STUDENT_AGE_RANGE_LABEL;
  return WORKING_HOURS_FILTER_ORDER_NAME;
}`;
const to = `  if (section.kind === "student_age") return STUDENT_AGE_RANGE_LABEL;
  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  if (section.kind === "price_range") return PRICE_RANGE_FILTER_ORDER_NAME;
  return WORKING_HOURS_FILTER_ORDER_NAME;
}`;
const n = s.split(from).length - 1;
if (!n) {
  console.error("no matches");
  process.exit(1);
}
s = s.replaceAll(from, to);
fs.writeFileSync(p, s);
console.log("fixed", n);
