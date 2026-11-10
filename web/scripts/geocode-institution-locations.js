/**
 * Institution geocoding script.
 *
 * Varsayılan: dry-run (API çağrısı / DB yazımı yok).
 *
 * Geoapify batch:
 *   node scripts/geocode-institution-locations.js --mode=dry-run --state=/abs/path/outside-repo/job.json \
 *     [--city=Ankara] [--limit=200] [--max-new=800] [--prior-states=/tmp/a.json,/tmp/b.json]
 *   node scripts/geocode-institution-locations.js --mode=submit  --state=/abs/path/outside-repo/job.json \
 *     [--prior-states=...] [--retry-ids=721,744] [--primary-simplified] [--second-pass]
 *   node scripts/geocode-institution-locations.js --mode=collect --state=/abs/path/outside-repo/job.json
 *   node scripts/geocode-institution-locations.js --mode=apply --state=/abs/path/outside-repo/job.json \
 *     --confirm-apply --approve-ids=101,102,103
 *   node scripts/geocode-institution-locations.js --mode=apply --state=/abs/path/outside-repo/job.json \
 *     --confirm-apply --approve-all-accepted
 *
 * Eski Nominatim (yalnızca açık seçimle):
 *   node scripts/geocode-institution-locations.js --mode=nominatim
 *
 * API anahtarı: yalnızca GEOAPIFY_API_KEY (loglanmaz).
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BATCH_SIZE = Number(process.env.GEOCODE_BATCH_SIZE || 100);
const SLEEP_MS = Number(process.env.GEOCODE_SLEEP_MS || 1200);
const NOMINATIM_BASE_URL =
  process.env.GEOCODER_BASE_URL || "https://nominatim.openstreetmap.org/search";
const NOMINATIM_EMAIL = process.env.GEOCODER_EMAIL || "";
const USER_AGENT =
  process.env.GEOCODER_USER_AGENT || "merkezden-geocoder/1.0 (contact: support@merkezden.com)";

const GEOAPIFY_BATCH_URL = "https://api.geoapify.com/v1/batch/geocode/search";
const GEOAPIFY_MAX_BATCH = 1000;
const GEOAPIFY_POLL_MS = Number(process.env.GEOAPIFY_POLL_MS || 60_000);
const GEOAPIFY_MAX_POLL_ATTEMPTS = Number(process.env.GEOAPIFY_MAX_POLL_ATTEMPTS || 120);
const GEOAPIFY_MIN_CONFIDENCE = Number(process.env.GEOAPIFY_MIN_CONFIDENCE || 0.6);
const GEOAPIFY_MIN_STREET_CONFIDENCE = Number(
  process.env.GEOAPIFY_MIN_STREET_CONFIDENCE || 0.5,
);
const STATE_VERSION = 3;

const REJECTED_RESULT_TYPES = new Set(["country", "state", "city", "postcode", "county"]);
const REJECTED_MATCH_TYPES = new Set([
  "match_by_city",
  "match_by_postcode",
  "match_by_country",
  "match_by_state",
]);
/**
 * building/amenity/street/suburb:
 * - il+ilçe+sokak doğrulanırsa accept
 * - il+ilçe+mahalle doğrulanırsa yaklaşık accept
 */
const AUTO_ACCEPT_RESULT_TYPES = new Set(["building", "amenity", "street", "suburb"]);
/** Ankara için Geoapify bazen TR-06 yerine TR-AN döner; ISO tek başına kanıt değil. */
const TR_PROVINCE_ISO_ALIASES = new Map([["TR-06", new Set(["TR-06", "TR-AN"])]]);
const TURKEY_COUNTRY_CODES = new Set(["tr", "tur"]);
const TURKEY_COUNTRY_NAMES = new Set([
  "turkey",
  "turkiye",
  "türkiye",
  "republic of turkey",
  "republic of turkiye",
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function printHelp() {
  console.log(`Usage:
  node scripts/geocode-institution-locations.js --mode=<dry-run|submit|collect|apply|nominatim> [options]

Geoapify (default provider for dry-run/submit/collect/apply):
  --state=/absolute/path/outside-repo/state.json   (required for geoapify modes)
  --city=Ankara                                    (optional city filter)
   --limit=200                                      (legacy: snapshot limit before exclusions)
   --max-new=800                                    (new institution limit after exclusions; automation)
  --prior-states=/tmp/a.json,/tmp/b.json           (skip IDs already processed there)
  --retry-ids=721,744                              (explicit re-submit allowlist)
  --second-pass                                    (retry reject/manual_review with simplified address)
  --primary-simplified                             (opt-in: simplified address on first pass)
  --confirm-apply                                  (required for --mode=apply)
  --approve-ids=101,102,103                        (apply only these accept IDs)
  --approve-all-accepted                           (apply all decision=accept; needs --confirm-apply)

Nominatim (legacy, not default):
  --mode=nominatim

Env:
  GEOAPIFY_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
`);
}

function parseIdList(rawValue, flagName) {
  const parts = String(rawValue ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const ids = [];
  for (const part of parts) {
    const id = Number(part);
    if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
      throw new Error(`Geçersiz ${flagName} değeri: ${part}`);
    }
    ids.push(id);
  }
  return Array.from(new Set(ids));
}

function parseApproveIds(rawValue) {
  return parseIdList(rawValue, "--approve-ids");
}

function parsePathList(rawValue, flagName) {
  const parts = String(rawValue ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`${flagName} boş olamaz`);
  }
  return parts;
}

function parseArgs(argv) {
  const args = {
    mode: "dry-run",
    state: "",
    city: "",
    limit: null,
    maxNew: null,
    expectedFresh: null,
    confirmApply: false,
    approveIds: [],
    approveAllAccepted: false,
    priorStates: [],
    retryIds: [],
    secondPass: false,
    primarySimplified: false,
    help: false,
  };

  for (const raw of argv) {
    if (raw === "--help" || raw === "-h") {
      args.help = true;
      continue;
    }
    if (raw === "--confirm-apply") {
      args.confirmApply = true;
      continue;
    }
    if (raw === "--approve-all-accepted") {
      args.approveAllAccepted = true;
      continue;
    }
    if (raw === "--second-pass") {
      args.secondPass = true;
      continue;
    }
    if (raw === "--primary-simplified") {
      args.primarySimplified = true;
      continue;
    }
    if (raw.startsWith("--mode=")) {
      args.mode = String(raw.slice("--mode=".length)).trim().toLowerCase() || "dry-run";
      continue;
    }
    if (raw.startsWith("--state=")) {
      args.state = String(raw.slice("--state=".length)).trim();
      continue;
    }
    if (raw.startsWith("--city=")) {
      args.city = String(raw.slice("--city=".length)).trim();
      continue;
    }
    if (raw.startsWith("--limit=")) {
      const n = Number(raw.slice("--limit=".length));
      args.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
      continue;
    }
    if (raw.startsWith("--max-new=")) {
      const n = Number(raw.slice("--max-new=".length));
      if (!Number.isSafeInteger(n) || n < 1 || n > 1000) {
        throw new Error("--max-new 1 ile 1000 arasında tam sayı olmalıdır.");
      }
      args.maxNew = n;
      continue;
    }
    if (raw.startsWith("--expected-fresh=")) {
      const n = Number(raw.slice("--expected-fresh=".length));
      if (!Number.isSafeInteger(n) || n < 0 || n > 1000) throw new Error("Geçersiz --expected-fresh");
      args.expectedFresh = n;
      continue;
    }
    if (raw.startsWith("--approve-ids=")) {
      args.approveIds = parseApproveIds(raw.slice("--approve-ids=".length));
      continue;
    }
    if (raw.startsWith("--retry-ids=")) {
      args.retryIds = parseIdList(raw.slice("--retry-ids=".length), "--retry-ids");
      continue;
    }
    if (raw.startsWith("--prior-states=")) {
      args.priorStates = parsePathList(raw.slice("--prior-states=".length), "--prior-states");
      continue;
    }
    throw new Error(`Bilinmeyen argüman: ${raw}`);
  }

  if (args.secondPass && args.primarySimplified) {
    throw new Error("--primary-simplified ile --second-pass birlikte kullanılamaz.");
  }

  const allowed = new Set(["dry-run", "submit", "collect", "apply", "nominatim"]);
  if (!allowed.has(args.mode)) {
    throw new Error(`Geçersiz --mode=${args.mode}. İzinli: ${Array.from(allowed).join(", ")}`);
  }
  return args;
}

function redactSecrets(value) {
  return String(value ?? "")
    .replace(/apiKey=[^&\s"']+/gi, "apiKey=REDACTED")
    .replace(/GEOAPIFY_API_KEY\s*=\s*[^\s]+/gi, "GEOAPIFY_API_KEY=REDACTED");
}

function normalizeText(value) {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function toTurkishTitleCase(value) {
  const lower = normalizeText(value).toLocaleLowerCase("tr-TR");
  return lower
    .split(" ")
    .map((word) => {
      if (!word) return word;
      return word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1);
    })
    .join(" ");
}

function normalizeCompareKey(value) {
  return normalizeText(value)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTurkishAddress(value) {
  let text = normalizeText(value);
  text = text.replace(/\s*\/\s*/g, ", ");
  text = text
    .replace(/\bMAH\./gi, "Mahallesi")
    .replace(/\bMH\./gi, "Mahallesi")
    .replace(/\bSK\./gi, "Sokak")
    .replace(/\bSOK\./gi, "Sokak")
    .replace(/\bCAD\./gi, "Caddesi")
    .replace(/\bCD\./gi, "Caddesi")
    .replace(/\bBLV\./gi, "Bulvarı")
    .replace(/\bBULV\./gi, "Bulvarı")
    .replace(/\bNO\s*:\s*/gi, "No: ");

  text = text.replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim();
  return toTurkishTitleCase(text);
}

function stripNoisyAddressWords(value) {
  return normalizeText(
    value
      .replace(/\bAPT\b\.?/gi, "")
      .replace(/\bAPARTMANI?\b/gi, "")
      .replace(/\bAPARTMAN\b/gi, "")
      .replace(/\bSITESI\b/gi, "")
      .replace(/\bSİTESİ\b/gi, "")
      .replace(/\bSITE\b/gi, "")
      .replace(/\bSİTE\b/gi, "")
      .replace(/\bBLOK\b\.?/gi, "")
      .replace(/\bB\s*BLOK\b/gi, "")
      .replace(/\bDAİRE\b\.?/gi, "")
      .replace(/\bDAIRE\b\.?/gi, "")
      .replace(/\bKAT\b\.?/gi, "")
      .replace(/\bİÇ\s*KAPI\s*NO\s*:?\s*[\w/-]+/gi, "")
      .replace(/\bIC\s*KAPI\s*NO\s*:?\s*[\w/-]+/gi, "")
      .replace(/\bNO\s*:?\s*[\w/-]+/gi, "")
      .replace(/\(\s*DİĞER[^)]*\)/gi, "")
      .replace(/\(\s*DIGER[^)]*\)/gi, "")
      .replace(/\s*,\s*/g, ", ")
      .replace(/\s+/g, " "),
  );
}

/** Dedup anahtarı: normalize edilmiş adres/query. */
function normalizeAddressKey(value) {
  return normalizeCompareKey(value);
}

/**
 * İkinci geçiş: gürültülü bina/blok/daire bilgisini çıkar;
 * Format: Mahalle → Sokak/Cadde → İlçe → İl → Türkiye
 * İlçe/şehir merkezine düşülmez. Mahalle query'de tek kez yer alır.
 */
function buildSimplifiedBatchQuery(institution) {
  const district = toTurkishTitleCase(institution.district);
  const city = toTurkishTitleCase(institution.city);

  const escapeRegExp = (value) =>
    String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /** Yapışık token'lara boşluk ekle (ör. AtatürkMahallesi → Atatürk Mahallesi). */
  const ensureAddressComponentSpaces = (value) =>
    normalizeText(value)
      .replace(
        /([A-Za-zçğıöşüÇĞİÖŞÜ0-9])(Mahallesi|Mahalle)\b/giu,
        "$1 $2",
      )
      .replace(
        /([A-Za-zçğıöşüÇĞİÖŞÜ0-9])(Sokak|Sokağı|Caddesi|Cadde|Bulvarı|Bulvar)\b/giu,
        "$1 $2",
      );

  const stripExtraNoise = (value) =>
    normalizeText(value)
      .replace(/\bDAİRE\s*:?\s*[\w/-]+/giu, "")
      .replace(/\bDAIRE\s*:?\s*[\w/-]+/giu, "")
      .replace(/\bAPT\.?\b/giu, "")
      .replace(/\bAPARTMANI?\b/giu, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/\s*,\s*/g, ", ")
      .replace(/\s+/g, " ")
      .trim();

  /** Metinden mahalle ifadesinin tüm tekrarlarını çıkar (sokak tespiti için). */
  const removeNeighborhoodOccurrences = (value, neighborhoodLabel) => {
    let text = normalizeText(value);
    if (!text || !neighborhoodLabel) return text;
    text = text.replace(
      new RegExp(escapeRegExp(neighborhoodLabel), "giu"),
      " ",
    );
    const nameOnly = normalizeText(
      neighborhoodLabel.replace(/\s+Mahallesi$/iu, ""),
    );
    if (nameOnly) {
      text = text.replace(
        new RegExp(`${escapeRegExp(nameOnly)}\\s+Mahallesi\\b`, "giu"),
        " ",
      );
    }
    return normalizeText(text.replace(/\s*,\s*/g, ", ").replace(/\s+/g, " "));
  };

  /** Sokak alanından mahalle sızıntısını temizle. */
  const cleanStreetLabel = (streetLabel, neighborhoodLabel) => {
    let street = normalizeText(streetLabel);
    if (!street) return "";
    if (neighborhoodLabel) {
      street = removeNeighborhoodOccurrences(street, neighborhoodLabel);
    }
    // "… Mahallesi X Sokak" kaldıysa yalnızca sokak/cadde kısmını al
    const streetOnly = street.match(
      /([A-Za-zçğıöşüÇĞİÖŞÜ0-9][A-Za-zçğıöşüÇĞİÖŞÜ0-9\s-]{0,60}?)\s+(Caddesi|Cadde|Sokak|Sokağı|Bulvarı|Bulvar)\b/iu,
    );
    if (streetOnly) {
      street = normalizeText(`${streetOnly[1]} ${streetOnly[2]}`);
      if (neighborhoodLabel) {
        street = removeNeighborhoodOccurrences(street, neighborhoodLabel);
      }
    }
    const numbered = street.match(
      /(\d+\.?\s*(?:Caddesi|Cadde|Sokak|Sokağı|Bulvarı|Bulvar))\b/iu,
    );
    if (numbered && !/[A-Za-zçğıöşüÇĞİÖŞÜ]/u.test(street.replace(numbered[1], ""))) {
      street = normalizeText(numbered[1]);
    }
    return toTurkishTitleCase(street);
  };

  let rawAddress = normalizeTurkishAddress(institution.address);
  rawAddress = normalizeTurkishAddress(ensureAddressComponentSpaces(rawAddress));
  if (!rawAddress) {
    return { query: "", skipReason: "Adres boş — second-pass yok" };
  }

  let stripped = normalizeTurkishAddress(
    stripExtraNoise(stripNoisyAddressWords(rawAddress)),
  );
  stripped = normalizeTurkishAddress(ensureAddressComponentSpaces(stripped));

  // Adres kuyruğundaki il/ilçe tekrarını sokak tespitinden çıkar
  let work = stripped;
  if (city && addressEndsWithLocation(work, city)) {
    const parts = work.split(",").map((p) => normalizeText(p)).filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      work = parts.join(", ");
    }
  }
  if (district && addressEndsWithLocation(work, district)) {
    const parts = work.split(",").map((p) => normalizeText(p)).filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      work = parts.join(", ");
    }
  }

  const neighborhood =
    detectNeighborhood(work) ||
    detectNeighborhood(stripped) ||
    detectNeighborhood(rawAddress) ||
    "";

  const workWithoutNeighborhood = neighborhood
    ? removeNeighborhoodOccurrences(work, neighborhood)
    : work;

  let street =
    detectStreet(workWithoutNeighborhood) ||
    cleanStreetLabel(
      detectStreet(work) || detectStreet(stripped) || detectStreet(rawAddress),
      neighborhood,
    ) ||
    "";
  street = cleanStreetLabel(street, neighborhood);

  // Mahalle ile sokak aynıysa sokak sayma
  if (
    neighborhood &&
    street &&
    normalizeCompareKey(neighborhood) === normalizeCompareKey(street)
  ) {
    street = "";
  }

  if (!neighborhood && !street) {
    return {
      query: "",
      skipReason:
        "Second-pass: mahalle/sokak yok — ilçe/şehir merkezine düşülmez, atlandı",
    };
  }
  if (!district || !city) {
    return {
      query: "",
      skipReason: "Second-pass: il/ilçe eksik — atlandı",
    };
  }

  // Mahalle → Sokak/Cadde → İlçe → İl → Türkiye (mahalle tek kez)
  const parts = [neighborhood, street, district, city, "Türkiye"].filter(Boolean);
  const query = normalizeTurkishAddress(parts.join(", "));
  if (!query) {
    return { query: "", skipReason: "Second-pass: sadeleştirilmiş query boş" };
  }

  // Güvenlik: yalnızca il+ilçe (+ülke) kaldıysa reddet
  const withoutPlace = normalizeCompareKey(query)
    .replace(normalizeCompareKey(district), " ")
    .replace(normalizeCompareKey(city), " ")
    .replace(/\bturkiye\b/g, " ")
    .replace(/\bturkey\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!withoutPlace) {
    return {
      query: "",
      skipReason: "Second-pass: yalnızca il/ilçe kaldı — merkez fallback yok",
    };
  }

  return { query, skipReason: null, neighborhood, street };
}

function detectNeighborhood(value) {
  const text = normalizeText(value);
  const match = text.match(/([a-zA-ZçğıöşüÇĞİÖŞÜ0-9\s-]+?)\s+Mahallesi\b/u);
  if (!match) return "";
  return toTurkishTitleCase(`${normalizeText(match[1])} Mahallesi`);
}

function detectStreet(value) {
  const text = normalizeTurkishAddress(value);
  if (!text) return "";

  // "254 Caddesi" / "254. Cadde" / "11. Sokak"
  const numbered = text.match(
    /(\d+\.?\s*(?:Caddesi|Cadde|Sokak|Sokağı|Bulvarı|Bulvar))\b/iu,
  );
  if (numbered) return normalizeText(numbered[1]);

  // "Atatürk Bulvarı" / "Gazi Mustafa Kemal Caddesi"
  const named = text.match(
    /([A-Za-zçğıöşüÇĞİÖŞÜ0-9][A-Za-zçğıöşüÇĞİÖŞÜ0-9\s-]{0,60}?)\s+(Caddesi|Cadde|Sokak|Sokağı|Bulvarı|Bulvar)\b/u,
  );
  if (named) return normalizeText(`${named[1]} ${named[2]}`);
  return "";
}

function normalizeStreetKey(value) {
  return normalizeCompareKey(value)
    .replace(/\bcaddesi\b/g, "cadde")
    .replace(/\bsokagi\b/g, "sokak")
    .replace(/\bbulvari\b/g, "bulvar")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function streetNamesMatch(expected, actual) {
  const exp = normalizeStreetKey(expected);
  const act = normalizeStreetKey(actual);
  if (!exp || !act) return false;
  return act === exp || act.includes(exp) || exp.includes(act);
}

function buildGeocodeQueries(institution) {
  const institutionName = toTurkishTitleCase(institution.institution_name);
  const address = normalizeTurkishAddress(institution.address);
  const district = toTurkishTitleCase(institution.district);
  const city = toTurkishTitleCase(institution.city);

  const normalizedFullAddress = normalizeTurkishAddress(
    [address, district, city].filter(Boolean).join(", "),
  );
  const strippedFullAddress = normalizeTurkishAddress(
    stripNoisyAddressWords([address, district, city].filter(Boolean).join(", ")),
  );
  const neighborhood = detectNeighborhood(normalizedFullAddress);

  const queryCandidates = [
    {
      level: "L1_FULL_NORMALIZED",
      query: normalizedFullAddress ? `${normalizedFullAddress}, Türkiye` : "",
    },
    {
      level: "L2_FULL_STRIPPED",
      query: strippedFullAddress ? `${strippedFullAddress}, Türkiye` : "",
    },
    {
      level: "L3_NEIGHBORHOOD_DISTRICT_CITY",
      query: [neighborhood, district, city, "Türkiye"].filter(Boolean).join(", "),
    },
    {
      level: "L4_DISTRICT_CITY",
      query: [district, city, "Türkiye"].filter(Boolean).join(", "),
    },
    {
      level: "L5_INSTITUTION_PLUS_ADDRESS",
      query: [institutionName, normalizedFullAddress, "Türkiye"].filter(Boolean).join(", "),
    },
  ];

  const dedup = new Set();
  const cleaned = [];
  for (const item of queryCandidates) {
    const q = normalizeText(item.query);
    if (!q || dedup.has(q)) continue;
    dedup.add(q);
    cleaned.push({ level: item.level, query: q });
  }

  return cleaned;
}

/**
 * Adres zaten trailing segment olarak ilçe/şehir/ülke içeriyor mu?
 * Virgüllü kuyrukta tam eşleşme veya segment sonundaki bütün kelime eşleşmesi
 * (ör. "... No: 4 Etimesgut, Ankara"). Sokak adının ortasındaki rastgele
 * alt dizgileri eşlemez.
 */
function addressEndsWithLocation(address, locationName) {
  const locKey = normalizeCompareKey(locationName);
  if (!locKey || !address) return false;

  const parts = normalizeText(address)
    .split(",")
    .map((part) => normalizeText(part))
    .filter(Boolean);
  if (parts.length === 0) return false;

  const segmentHasLocation = (segment) => {
    const segKey = normalizeCompareKey(segment);
    if (!segKey) return false;
    if (segKey === locKey) return true;
    // Bütün kelime olarak sonda: "... etimesgut"
    if (segKey.endsWith(` ${locKey}`)) return true;
    return false;
  };

  const tail = parts.slice(-3);
  for (let i = tail.length - 1; i >= 0; i -= 1) {
    if (segmentHasLocation(tail[i])) return true;
  }

  // "Kadıköy İstanbul" tek segmentte birleşik yazılmışsa
  if (parts.length >= 2) {
    const lastTwo = normalizeCompareKey(`${parts[parts.length - 2]} ${parts[parts.length - 1]}`);
    if (lastTwo === locKey) return true;
  }

  return false;
}

/** Batch için tek, mümkün olan en spesifik adres satırı (şehir/ilçe fallback query kullanılmaz). */
function buildPrimaryBatchQuery(institution) {
  let address = normalizeTurkishAddress(institution.address);
  const district = toTurkishTitleCase(institution.district);
  const city = toTurkishTitleCase(institution.city);
  if (!address) return "";

  // Adres zaten ilçe/şehir ile bitiyorsa tekrar ekleme; sokak/no/blok içeriğine dokunma.
  if (district && !addressEndsWithLocation(address, district)) {
    address = normalizeTurkishAddress(`${address}, ${district}`);
  }
  if (city && !addressEndsWithLocation(address, city)) {
    address = normalizeTurkishAddress(`${address}, ${city}`);
  }
  if (
    !addressEndsWithLocation(address, "Türkiye") &&
    !addressEndsWithLocation(address, "Turkey")
  ) {
    address = normalizeTurkishAddress(`${address}, Türkiye`);
  }
  return address;
}

function createSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      ".env eksik: NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli",
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function requireGeoapifyApiKey() {
  const key = String(process.env.GEOAPIFY_API_KEY ?? "").trim();
  if (!key) {
    throw new Error("GEOAPIFY_API_KEY tanımlı değil. Anahtar loglanmaz; .env.local içine ekleyin.");
  }
  return key;
}

function assertStatePathOutsideRepo(statePath) {
  if (!statePath || !path.isAbsolute(statePath)) {
    throw new Error(
      "--state mutlak bir yol olmalıdır ve depo dışında seçilmelidir (ör. /tmp/merkezden-geocode-state.json).",
    );
  }
  const resolved = path.resolve(statePath);
  const bannedRoots = [REPO_ROOT, WEB_ROOT].map((p) => path.resolve(p));
  for (const root of bannedRoots) {
    if (resolved === root || resolved.startsWith(root + path.sep)) {
      throw new Error(
        `--state depo içinde olamaz. Seçilen: ${resolved}. Depo: ${REPO_ROOT}`,
      );
    }
  }
  return resolved;
}

function readStateFile(statePath) {
  if (!fs.existsSync(statePath)) return null;
  const raw = fs.readFileSync(statePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("State dosyası geçersiz JSON nesnesi değil.");
  }
  return parsed;
}

function writeStateFile(statePath, state) {
  const dir = path.dirname(statePath);
  fs.mkdirSync(dir, { recursive: true });
  const next = {
    ...state,
    version: STATE_VERSION,
    updatedAt: new Date().toISOString(),
  };
  const tmp = `${statePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
  fs.renameSync(tmp, statePath);
  return next;
}

function emptyState(filters) {
  return {
    version: STATE_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    provider: "geoapify",
    filters: {
      city: filters.city || null,
      limit: filters.limit,
    },
    candidates: [],
    missingLocationRows: [],
    jobs: [],
    report: null,
    applyLog: [],
  };
}

async function fetchAllPaged(supabase, buildQuery) {
  const pageSize = 1000;
  const rows = [];
  for (let page = 0; page < 200; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function loadCandidateSnapshot(supabase, { city, limit }) {
  const locationRows = await fetchAllPaged(supabase, () =>
    supabase
      .from("institution_locations")
      .select("institution_id, geocode_status, latitude, longitude")
      .order("institution_id", { ascending: true }),
  );

  const byInstitutionId = new Map();
  for (const row of locationRows) {
    const id = Number(row.institution_id);
    if (!Number.isFinite(id)) continue;
    if (!byInstitutionId.has(id)) byInstitutionId.set(id, row);
  }

  let institutionQuery = () =>
    supabase
      .from("institutions")
      .select("id, institution_name, address, district, city")
      .order("id", { ascending: true });

  // city filtresi varsa sunucu tarafında ilike; yoksa tüm sayfalama
  const institutions = await fetchAllPaged(supabase, () => {
    let q = institutionQuery();
    if (city) {
      q = q.ilike("city", `%${city}%`);
    }
    return q;
  });

  const cityKey = city ? normalizeCompareKey(city) : "";
  const pending = [];
  const missingLocationRows = [];
  const successSkipped = [];

  for (const institution of institutions) {
    const id = Number(institution.id);
    if (!Number.isFinite(id)) continue;
    if (cityKey) {
      const instCity = normalizeCompareKey(institution.city);
      if (!instCity.includes(cityKey) && cityKey !== instCity) continue;
    }

    const loc = byInstitutionId.get(id);
    if (!loc) {
      missingLocationRows.push({
        institutionId: id,
        institution_name: institution.institution_name,
        city: institution.city,
        district: institution.district,
      });
      continue;
    }

    const status = String(loc.geocode_status ?? "").trim().toLowerCase();
    if (status === "success") {
      successSkipped.push(id);
      continue;
    }
    if (status !== "pending" && status !== "failed") {
      // bilinmeyen durumlar dokunulmaz
      continue;
    }

    const query = buildPrimaryBatchQuery(institution);
    if (!query) {
      pending.push({
        institutionId: id,
        institution_name: institution.institution_name,
        address: institution.address,
        district: institution.district,
        city: institution.city,
        geocode_status: status,
        query: "",
        skipReason: "Adres boş — batch'e eklenmez",
      });
      continue;
    }

    pending.push({
      institutionId: id,
      institution_name: institution.institution_name,
      address: institution.address,
      district: institution.district,
      city: institution.city,
      geocode_status: status,
      query,
      skipReason: null,
    });
  }

  const eligible = pending.filter((row) => !row.skipReason);
  const limited = limit != null ? eligible.slice(0, limit) : eligible;

  return {
    pendingAll: pending,
    candidates: limited.map((row, index) => ({
      index,
      institutionId: row.institutionId,
      institution_name: row.institution_name,
      address: row.address,
      district: row.district,
      city: row.city,
      geocode_status: row.geocode_status,
      query: row.query,
    })),
    skippedNoAddress: pending.filter((row) => row.skipReason),
    missingLocationRows,
    successSkippedCount: successSkipped.length,
  };
}

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function isFatalGeoapifyStatus(status) {
  return status === 401 || status === 403 || status === 402 || status === 400;
}

/**
 * @param {"submit"|"collect"} purpose
 * submit: 429/5xx fail-closed (çift faturalama riski)
 * collect: 429/503 için sınırlı retry (salt okuma poll)
 */
async function geoapifyRequest(url, { method = "GET", body = null, purpose = "collect" } = {}) {
  const headers = {
    Accept: "application/json",
    "User-Agent": USER_AGENT,
  };
  if (body != null) headers["Content-Type"] = "application/json";

  const maxAttempts = purpose === "submit" ? 1 : 3;
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    const response = await fetch(url, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });

    let parsed = null;
    const text = await response.text();
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text.slice(0, 500) };
    }

    if (isFatalGeoapifyStatus(response.status)) {
      const message = redactSecrets(
        parsed?.message || parsed?.error || text.slice(0, 300) || `HTTP ${response.status}`,
      );
      throw new Error(
        `Geoapify kimlik doğrulama/kota/istek hatası (HTTP ${response.status}). Durduruldu; yeniden deneme yok. ${message}`,
      );
    }

    if (response.status === 429 || response.status === 503) {
      if (purpose === "submit") {
        throw new Error(
          `Geoapify HTTP ${response.status} submit sırasında. Fail-closed durduruldu (çift job/faturalama riski). Geoapify panelini kontrol edip yeni --state ile devam edin.`,
        );
      }
      if (attempt >= maxAttempts) {
        throw new Error(
          `Geoapify HTTP ${response.status} collect poll limit aşıldı. Daha sonra --mode=collect ile sürdürün (yeniden submit etmeyin).`,
        );
      }
      const wait = Math.min(120_000, GEOAPIFY_POLL_MS * attempt);
      console.warn(
        `⚠️ Geoapify HTTP ${response.status}. ${wait}ms sonra poll yeniden (deneme ${attempt}/${maxAttempts}).`,
      );
      await sleep(wait);
      continue;
    }

    if (!response.ok && response.status !== 202) {
      const message = redactSecrets(
        parsed?.message || parsed?.error || text.slice(0, 300) || `HTTP ${response.status}`,
      );
      const err = new Error(`Geoapify isteği başarısız (HTTP ${response.status}): ${message}`);
      err.status = response.status;
      throw err;
    }

    return { status: response.status, body: parsed };
  }

  throw new Error("Geoapify istek limiti aşıldı.");
}

/**
 * Türkiye için Geoapify alan eşlemesi:
 * - county ≈ il (province)
 * - city ≈ ilçe (district)
 * - suburb ≈ mahalle (neighborhood)
 * - iso3166_2 örn. TR-06 (Ankara)
 * Beklenen input.city = il, input.district = ilçe.
 */
const TR_PROVINCE_ISO_BY_NAME = new Map([
  ["adana", "TR-01"],
  ["adiyaman", "TR-02"],
  ["afyonkarahisar", "TR-03"],
  ["agri", "TR-04"],
  ["amasya", "TR-05"],
  ["ankara", "TR-06"],
  ["antalya", "TR-07"],
  ["artvin", "TR-08"],
  ["aydin", "TR-09"],
  ["balikesir", "TR-10"],
  ["bilecik", "TR-11"],
  ["bingol", "TR-12"],
  ["bitlis", "TR-13"],
  ["bolu", "TR-14"],
  ["burdur", "TR-15"],
  ["bursa", "TR-16"],
  ["canakkale", "TR-17"],
  ["cankiri", "TR-18"],
  ["corum", "TR-19"],
  ["denizli", "TR-20"],
  ["diyarbakir", "TR-21"],
  ["edirne", "TR-22"],
  ["elazig", "TR-23"],
  ["erzincan", "TR-24"],
  ["erzurum", "TR-25"],
  ["eskisehir", "TR-26"],
  ["gaziantep", "TR-27"],
  ["giresun", "TR-28"],
  ["gumushane", "TR-29"],
  ["hakkari", "TR-30"],
  ["hatay", "TR-31"],
  ["isparta", "TR-32"],
  ["mersin", "TR-33"],
  ["istanbul", "TR-34"],
  ["izmir", "TR-35"],
  ["kars", "TR-36"],
  ["kastamonu", "TR-37"],
  ["kayseri", "TR-38"],
  ["kirklareli", "TR-39"],
  ["kirsehir", "TR-40"],
  ["kocaeli", "TR-41"],
  ["konya", "TR-42"],
  ["kutahya", "TR-43"],
  ["malatya", "TR-44"],
  ["manisa", "TR-45"],
  ["kahramanmaras", "TR-46"],
  ["mardin", "TR-47"],
  ["mugla", "TR-48"],
  ["mus", "TR-49"],
  ["nevsehir", "TR-50"],
  ["nigde", "TR-51"],
  ["ordu", "TR-52"],
  ["rize", "TR-53"],
  ["sakarya", "TR-54"],
  ["samsun", "TR-55"],
  ["siirt", "TR-56"],
  ["sinop", "TR-57"],
  ["sivas", "TR-58"],
  ["tekirdag", "TR-59"],
  ["tokat", "TR-60"],
  ["trabzon", "TR-61"],
  ["tunceli", "TR-62"],
  ["sanliurfa", "TR-63"],
  ["usak", "TR-64"],
  ["van", "TR-65"],
  ["yozgat", "TR-66"],
  ["zonguldak", "TR-67"],
  ["aksaray", "TR-68"],
  ["bayburt", "TR-69"],
  ["karaman", "TR-70"],
  ["kirikkale", "TR-71"],
  ["batman", "TR-72"],
  ["sirnak", "TR-73"],
  ["bartin", "TR-74"],
  ["ardahan", "TR-75"],
  ["igdir", "TR-76"],
  ["yalova", "TR-77"],
  ["karabuk", "TR-78"],
  ["kilis", "TR-79"],
  ["osmaniye", "TR-80"],
  ["duzce", "TR-81"],
]);

function extractResultIso3166_2(result) {
  const raw = String(result?.iso3166_2 ?? "").trim().toUpperCase();
  return raw || null;
}

function expectedProvinceIso(expectedCity) {
  const key = normalizeCompareKey(expectedCity);
  if (!key) return null;
  return TR_PROVINCE_ISO_BY_NAME.get(key) || null;
}

function isKnownProvinceName(name) {
  return Boolean(expectedProvinceIso(name));
}

function isoCompatibleWithProvince(iso, expectedCity) {
  const expectedIso = expectedProvinceIso(expectedCity);
  const resultIso = String(iso || "").trim().toUpperCase();
  if (!expectedIso || !resultIso) return false;
  if (resultIso === expectedIso) return true;
  const aliases = TR_PROVINCE_ISO_ALIASES.get(expectedIso);
  return Boolean(aliases && aliases.has(resultIso));
}

/**
 * Geoapify TR metadata:
 * - TR-06 stili: county=il, city=ilçe, state=bölge
 * - TR-AN stili: state=il, county=ilçe, city=ilçe veya il
 * ISO (TR-06 / TR-AN) tek başına il kanıtı değildir.
 */
function extractResultProvince(result) {
  const county = result?.county || null;
  const state = result?.state || null;
  if (county && isKnownProvinceName(county)) return county;
  if (state && isKnownProvinceName(state)) return state;
  return county || state || null;
}

function extractResultDistrict(result) {
  const county = result?.county || null;
  const city = result?.city || null;
  const municipality = result?.municipality || null;
  const district = result?.district || null;

  if (county && isKnownProvinceName(county)) {
    // TR-06: city = ilçe (city bazen ili tekrarlar — çağıran taraf formatted fallback kullanabilir)
    return city || municipality || district || null;
  }
  if (result?.state && isKnownProvinceName(result.state)) {
    // TR-AN: county = ilçe
    return county || city || municipality || district || null;
  }
  return city || municipality || district || county || null;
}

function extractResultNeighborhood(result) {
  return result?.suburb || result?.neighbourhood || result?.neighborhood || null;
}

/**
 * county=il doğrulanmışken city alanının ili tekrarlaması
 * (ör. county=Ankara, city=Ankara) — yapısal ilçe yok sayılır.
 */
function cityFieldRepeatsProvince(result) {
  const county = result?.county || null;
  const city = result?.city || null;
  if (!county || !city) return false;
  if (!isKnownProvinceName(county)) return false;
  if (!isKnownProvinceName(city)) return false;
  return locationNamesMatch(county, city);
}

/**
 * formatted içinde beklenen ilçenin tek anlamlı (virgüllü segment) geçişi.
 * Mahalle adı ("Çankaya Mahallesi") veya serbest substring kabul edilmez.
 * Yalnızca: "Çankaya" veya "06530 Çankaya" segmentleri.
 */
function extractUnambiguousDistrictFromFormatted(formatted, expectedDistrict) {
  const districtKey = normalizeCompareKey(expectedDistrict);
  if (!districtKey || !formatted) return null;

  const segments = normalizeText(formatted)
    .split(",")
    .map((part) => normalizeText(part))
    .filter(Boolean);

  for (const segment of segments) {
    const segKey = normalizeCompareKey(segment);
    if (!segKey) continue;
    if (segKey === districtKey) {
      return toTurkishTitleCase(expectedDistrict);
    }
    // "06530 Çankaya" / "06420 Cankaya"
    const postcodeDistrict = segKey.match(/^(\d{4,5})\s+(.+)$/);
    if (postcodeDistrict && postcodeDistrict[2] === districtKey) {
      return toTurkishTitleCase(expectedDistrict);
    }
  }
  return null;
}

function locationNamesMatch(expected, actual) {
  const exp = normalizeCompareKey(expected);
  const act = normalizeCompareKey(actual);
  if (!exp || !act) return false;
  return act === exp || act.includes(exp) || exp.includes(act);
}

function locationCompatibility(expectedCity, expectedDistrict, result) {
  const resultProvinceRaw = extractResultProvince(result);
  let resultDistrictRaw = extractResultDistrict(result);
  const resultNeighborhoodRaw = extractResultNeighborhood(result);
  const resultIso = extractResultIso3166_2(result);
  const expectedIso = expectedProvinceIso(expectedCity);

  const expCity = normalizeCompareKey(expectedCity);
  const expDistrict = normalizeCompareKey(expectedDistrict);

  const provinceMissing = !expCity || !resultProvinceRaw;
  // İl adı zorunlu; ISO (TR-06/TR-AN) yalnız başına kabul ettirmez.
  const provinceOkByName =
    !provinceMissing && locationNamesMatch(expectedCity, resultProvinceRaw);
  const provinceOk = provinceOkByName;

  const cityRepeatsProvince = cityFieldRepeatsProvince(result);
  const structuredDistrictIsProvinceRepeat =
    cityRepeatsProvince &&
    Boolean(resultDistrictRaw) &&
    isKnownProvinceName(resultDistrictRaw) &&
    locationNamesMatch(resultDistrictRaw, resultProvinceRaw || expectedCity);

  let districtSource = "structured";
  let districtFromFormatted = null;

  // Yapısal city ili tekrarlıyorsa ilçe sanma; yalnızca formatted'ta açık ilçe segmenti kabul.
  if (provinceOk && structuredDistrictIsProvinceRepeat) {
    districtFromFormatted = extractUnambiguousDistrictFromFormatted(
      result?.formatted,
      expectedDistrict,
    );
    if (districtFromFormatted) {
      resultDistrictRaw = districtFromFormatted;
      districtSource = "formatted";
    } else {
      // Beklenen ilçe formatted'da yok → uyumsuz kalsın (eksik değil; yanlış/doğrulanamaz ilçe)
      districtSource = "province_repeat_no_formatted_district";
    }
  }

  const districtMissing = !expDistrict || !resultDistrictRaw;
  const districtOk =
    !districtMissing && locationNamesMatch(expectedDistrict, resultDistrictRaw);

  return {
    cityMissing: provinceMissing,
    districtMissing,
    cityOk: provinceOk,
    districtOk,
    resultCity: resultProvinceRaw,
    resultDistrict: resultDistrictRaw,
    resultNeighborhood: resultNeighborhoodRaw,
    resultIso3166_2: resultIso,
    expectedIso3166_2: expectedIso,
    isoCompatible: isoCompatibleWithProvince(resultIso, expectedCity),
    cityRepeatsProvince,
    districtSource,
    districtFromFormatted,
  };
}

/**
 * Adres/query'den beklenen mahalle+sokak ile Geoapify sonucunu karşılaştır.
 * Kapı numarası (housenumber) doğrulanmaz.
 */
/**
 * Query mahalle, sokak, ilçe, il olarak virgülle ayrılmışsa sokak bilgisini
 * yalnızca kendi segmentinden oku. Aksi halde "İstasyon Mahallesi Türk ... Caddesi"
 * gibi sahte sokak isimleri oluşabilir. Diğer segmentten tahmin yürütme.
 */
function detectStreetFromGeocodeQuery(query) {
  const segments = normalizeText(query).split(",").map(normalizeText).filter(Boolean);
  for (const segment of segments) {
    if (/\bMahallesi\b/iu.test(segment)) continue;
    if (!/(?:Caddesi|Cadde|Sokak|Sokağı|Bulvarı|Bulvar)\b/iu.test(segment)) continue;
    const street = detectStreet(segment);
    if (street) return street;
  }
  return "";
}

function streetLevelCompatibility(input, result) {
  // Sadeleştirilmiş query, orijinal gürültülü adresten daha güvenilir bir kaynak.
  // Sadece query segmenti değilse eski algılamaya dön; gevşek eşleştirme yok.
  const query = normalizeText(input?.query);
  const expectedNeighborhood = detectNeighborhood(query) || detectNeighborhood(input?.address) || "";
  const expectedStreet = detectStreetFromGeocodeQuery(query) ||
    (!query.includes(",") ? detectStreet(input?.address) : "") || "";
  const resultNeighborhood = extractResultNeighborhood(result) || "";
  const resultStreet = String(result?.street ?? "").trim();

  const hasExpectedNeighborhood = Boolean(expectedNeighborhood);
  const hasResultNeighborhood = Boolean(resultNeighborhood);
  const hasExpectedStreet = Boolean(expectedStreet);
  const hasResultStreet = Boolean(resultStreet);

  const neighborhoodOk =
    hasExpectedNeighborhood &&
    hasResultNeighborhood &&
    locationNamesMatch(expectedNeighborhood, resultNeighborhood);
  const streetOk =
    hasExpectedStreet &&
    hasResultStreet &&
    streetNamesMatch(expectedStreet, resultStreet);

  const neighborhoodConflict =
    hasExpectedNeighborhood && hasResultNeighborhood && !neighborhoodOk;
  const streetConflict = hasExpectedStreet && hasResultStreet && !streetOk;

  return {
    expectedNeighborhood: expectedNeighborhood || null,
    expectedStreet: expectedStreet || null,
    resultNeighborhood: resultNeighborhood || null,
    resultStreet: resultStreet || null,
    neighborhoodOk,
    streetOk,
    neighborhoodConflict,
    streetConflict,
    streetVerified: streetOk,
    neighborhoodVerified: neighborhoodOk,
  };
}

function isTurkeyCountry(result) {
  const code = normalizeCompareKey(result?.country_code || "");
  const name = normalizeCompareKey(result?.country || "");
  if (code && TURKEY_COUNTRY_CODES.has(code)) return true;
  if (name && TURKEY_COUNTRY_NAMES.has(name)) return true;
  return false;
}

function evaluationBase(input, extras = {}) {
  return {
    decision: "reject",
    rejectReason: null,
    latitude: null,
    longitude: null,
    confidence: null,
    confidenceStreet: null,
    confidenceBuilding: null,
    matchType: null,
    resultType: null,
    country: null,
    countryCode: null,
    iso3166_2: null,
    formatted: null,
    geocoded_query: input.query,
    ...extras,
  };
}

function evaluateGeoapifyResult(input, rawResult) {
  if (!rawResult || typeof rawResult !== "object" || Array.isArray(rawResult)) {
    return evaluationBase(input, {
      decision: "reject",
      rejectReason: "Boş veya geçersiz geocode sonucu (beklenen: tek sonuç nesnesi)",
    });
  }

  if (rawResult.error || rawResult.statusCode >= 400) {
    return evaluationBase(input, {
      decision: "reject",
      rejectReason: redactSecrets(
        String(rawResult.message || rawResult.error || "Geoapify sonuç hatası"),
      ),
    });
  }

  const lat = Number(rawResult.lat);
  const lon = Number(rawResult.lon);
  const resultType = String(rawResult.result_type ?? "").trim().toLowerCase();
  const rank = rawResult.rank && typeof rawResult.rank === "object" ? rawResult.rank : {};
  const confidence =
    rank.confidence != null && Number.isFinite(Number(rank.confidence))
      ? Number(rank.confidence)
      : null;
  const confidenceStreet =
    rank.confidence_street_level != null &&
    Number.isFinite(Number(rank.confidence_street_level))
      ? Number(rank.confidence_street_level)
      : null;
  const confidenceBuilding =
    rank.confidence_building_level != null &&
    Number.isFinite(Number(rank.confidence_building_level))
      ? Number(rank.confidence_building_level)
      : null;
  const matchType = String(rank.match_type ?? "").trim().toLowerCase() || null;
  const country = rawResult.country || null;
  const countryCode = rawResult.country_code || null;
  const iso3166_2 = extractResultIso3166_2(rawResult);

  const withMeta = (decision, rejectReason) =>
    evaluationBase(input, {
      decision,
      rejectReason,
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lon) ? lon : null,
      confidence,
      confidenceStreet,
      confidenceBuilding,
      matchType,
      resultType: resultType || null,
      country,
      countryCode,
      iso3166_2,
      formatted: rawResult.formatted || null,
      resultCity: extractResultProvince(rawResult),
      resultDistrict: extractResultDistrict(rawResult),
      resultNeighborhood: extractResultNeighborhood(rawResult),
      resultStreet: String(rawResult?.street ?? "").trim() || null,
    });

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return withMeta("reject", "Geçersiz koordinat");
  }

  if (!resultType) {
    return withMeta(
      "manual_review",
      "result_type eksik — otomatik kabul yok, manuel inceleme gerekli",
    );
  }

  if (REJECTED_RESULT_TYPES.has(resultType)) {
    return withMeta(
      "reject",
      `Belirsiz eşleşme: result_type=${resultType} (şehir/ilçe merkezine düşülmez)`,
    );
  }

  if (matchType && REJECTED_MATCH_TYPES.has(matchType)) {
    return withMeta("reject", `Belirsiz eşleşme: match_type=${matchType}`);
  }

  if (!isTurkeyCountry(rawResult)) {
    return withMeta(
      "manual_review",
      `Ülke doğrulanamadı/uyumsuz (country=${country}, country_code=${countryCode})`,
    );
  }

  if (!AUTO_ACCEPT_RESULT_TYPES.has(resultType)) {
    return withMeta(
      "manual_review",
      `Bilinmeyen/desteklenmeyen result_type=${resultType} — otomatik kabul yok`,
    );
  }

  const compat = locationCompatibility(input.city, input.district, rawResult);
  if (compat.cityMissing || compat.districtMissing) {
    return withMeta(
      "manual_review",
      `İl/ilçe metadata eksik (beklenen il="${input.city}" ilçe="${input.district}"; gelen il="${compat.resultCity}" iso=${compat.resultIso3166_2 || "?"} ilçe="${compat.resultDistrict}")`,
    );
  }
  if (!compat.cityOk) {
    return withMeta(
      "reject",
      `İl uyumsuz: beklenen="${input.city}"; gelen="${compat.resultCity}" iso=${compat.resultIso3166_2 || "?"} (ISO tek başına kabul edilmez)`,
    );
  }
  if (!compat.districtOk) {
    const formattedHint =
      compat.districtSource === "province_repeat_no_formatted_district"
        ? "; city ili tekrarlıyor ve formatted'da beklenen ilçe yok"
        : compat.cityRepeatsProvince
          ? `; city ili tekrarlıyor (districtSource=${compat.districtSource})`
          : "";
    return withMeta(
      "reject",
      `İlçe uyumsuz: beklenen="${input.district}" gelen="${compat.resultDistrict}"${formattedHint}`,
    );
  }

  const streetCompat = streetLevelCompatibility(input, rawResult);

  // Çakışan mahalle/sokak → otomatik accept yok
  if (streetCompat.neighborhoodConflict || streetCompat.streetConflict) {
    const parts = [];
    if (streetCompat.neighborhoodConflict) {
      parts.push(
        `mahalle beklenen="${streetCompat.expectedNeighborhood}" gelen="${streetCompat.resultNeighborhood}"`,
      );
    }
    if (streetCompat.streetConflict) {
      parts.push(
        `sokak beklenen="${streetCompat.expectedStreet}" gelen="${streetCompat.resultStreet}"`,
      );
    }
    return withMeta(
      "manual_review",
      `Çakışan konum verisi — manuel inceleme (${parts.join("; ")})`,
    );
  }

  const acceptPayload = (acceptKind) => ({
    decision: "accept",
    rejectReason: null,
    acceptKind,
    latitude: lat,
    longitude: lon,
    confidence,
    confidenceStreet,
    confidenceBuilding,
    matchType,
    resultType,
    country,
    countryCode,
    iso3166_2,
    formatted: rawResult.formatted || null,
    resultCity: compat.resultCity,
    resultDistrict: compat.resultDistrict,
    resultNeighborhood: streetCompat.resultNeighborhood || compat.resultNeighborhood,
    resultStreet: streetCompat.resultStreet,
    districtSource: compat.districtSource,
    districtFromFormatted: compat.districtFromFormatted,
    geocoded_query: input.query,
  });

  // Formatted ilçe tek başına yetmez: sokak veya mahalle doğrulanmalı
  const streetConfidenceTooLow =
    confidenceStreet != null &&
    confidenceStreet < GEOAPIFY_MIN_STREET_CONFIDENCE;

  // 1) Doğrulanmış il + ilçe + sokak (eşik altı street confidence ile accept yok)
  if (streetCompat.streetVerified && !streetConfidenceTooLow) {
    return acceptPayload(
      compat.districtSource === "formatted"
        ? "province_formatted_district_street"
        : "province_district_street",
    );
  }

  // 2) Doğrulanmış il + ilçe + mahalle → yaklaşık konum
  //    Street confidence düşük olsa bile, çakışma yoksa ve mahalle bağımsız
  //    doğrulanmışsa bu yola düşülür (eşik düşürülmez; uyumsuz alan kabul edilmez).
  if (streetCompat.neighborhoodVerified) {
    return acceptPayload(
      compat.districtSource === "formatted"
        ? "province_formatted_district_neighborhood_approx"
        : streetConfidenceTooLow && streetCompat.streetVerified
          ? "province_district_neighborhood_approx_low_street_conf"
          : "province_district_neighborhood_approx",
    );
  }

  if (streetCompat.streetVerified && streetConfidenceTooLow) {
    return withMeta(
      "reject",
      `Düşük street confidence=${confidenceStreet} (min ${GEOAPIFY_MIN_STREET_CONFIDENCE}); mahalle de doğrulanamadı`,
    );
  }

  return withMeta(
    "manual_review",
    `Sokak/mahalle doğrulanamadı (mahalle="${streetCompat.resultNeighborhood || "?"}" sokak="${streetCompat.resultStreet || "?"}") — manuel inceleme`,
  );
}

function hasLockedJobs(state) {
  return Array.isArray(state?.jobs) && state.jobs.length > 0;
}

/** Tek input satırındaki tüm institution id'leri (eski 1:1 veya dedupe members). */
function institutionIdsFromInput(input) {
  const ids = [];
  if (Array.isArray(input?.members) && input.members.length > 0) {
    for (const member of input.members) {
      const id = Number(member.institutionId);
      if (Number.isFinite(id)) ids.push(id);
    }
    return ids;
  }
  const id = Number(input?.institutionId);
  if (Number.isFinite(id)) ids.push(id);
  return ids;
}

function collectSubmittedInstitutionIds(state) {
  const ids = new Set();
  for (const job of state?.jobs || []) {
    for (const input of job.inputs || []) {
      for (const id of institutionIdsFromInput(input)) ids.add(id);
    }
  }
  return ids;
}

/**
 * State'te daha önce işlenmiş (accept/reject/manual_review veya henüz evaluate
 * edilmemiş submit) institution id'leri.
 */
function collectProcessedInstitutionMeta(state, sourceLabel = "state") {
  const byId = new Map();
  for (const job of state?.jobs || []) {
    const jobId = job?.jobId || null;
    if (Array.isArray(job.evaluations) && job.evaluations.length > 0) {
      for (const row of job.evaluations) {
        const id = Number(row.institutionId);
        if (!Number.isFinite(id)) continue;
        byId.set(id, {
          institutionId: id,
          decision: row.decision || "submitted",
          jobId,
          pass: row.pass || job.pass || 1,
          source: sourceLabel,
        });
      }
      continue;
    }
    for (const input of job.inputs || []) {
      for (const id of institutionIdsFromInput(input)) {
        if (byId.has(id)) continue;
        byId.set(id, {
          institutionId: id,
          decision: "submitted",
          jobId,
          pass: input.pass || job.pass || 1,
          source: sourceLabel,
        });
      }
    }
  }
  return byId;
}

function loadPriorProcessedInstitutions(priorStatePaths) {
  const byId = new Map();
  const loaded = [];
  for (const rawPath of priorStatePaths || []) {
    const statePath = assertStatePathOutsideRepo(rawPath);
    const state = readStateFile(statePath);
    if (!state) {
      throw new Error(`--prior-states dosyası yok: ${statePath}`);
    }
    const meta = collectProcessedInstitutionMeta(state, statePath);
    for (const [id, info] of meta) {
      if (!byId.has(id)) byId.set(id, info);
    }
    loaded.push({ path: statePath, processedCount: meta.size });
  }
  return { byId, loaded };
}

function mergeProcessedMaps(...maps) {
  const out = new Map();
  for (const map of maps) {
    for (const [id, info] of map || []) {
      if (!out.has(id)) out.set(id, info);
    }
  }
  return out;
}

/**
 * Aynı normalize adres → tek API kaydı; members ile güvenli geri yayılım.
 */
function dedupeCandidatesByAddress(candidates) {
  const groups = new Map();
  for (const row of candidates) {
    const key = normalizeAddressKey(row.query);
    if (!key) continue;
    if (!groups.has(key)) {
      groups.set(key, {
        addressKey: key,
        query: row.query,
        members: [],
      });
    }
    groups.get(key).members.push(row);
  }
  const uniqueGroups = Array.from(groups.values());
  return {
    uniqueGroups,
    uniqueQueryCount: uniqueGroups.length,
    institutionCount: candidates.length,
    duplicateInstitutionCount: Math.max(0, candidates.length - uniqueGroups.length),
  };
}

function buildImmutableInputsFromGroups(groups, { pass = 1, queryKind = "primary" } = {}) {
  return groups.map((group, index) => {
    const members = group.members.map((row) =>
      Object.freeze({
        institutionId: row.institutionId,
        query: row.query,
        city: row.city,
        district: row.district,
        address: row.address,
        institution_name: row.institution_name,
        geocode_status: row.geocode_status,
        pass: row.pass || pass,
        queryKind: row.queryKind || queryKind,
      }),
    );
    const head = members[0];
    return Object.freeze({
      index,
      addressKey: group.addressKey,
      query: group.query,
      institutionId: head.institutionId,
      city: head.city,
      district: head.district,
      address: head.address,
      institution_name: head.institution_name,
      geocode_status: head.geocode_status,
      pass,
      queryKind,
      memberCount: members.length,
      members,
    });
  });
}

/** Geriye dönük: düz aday listesinden 1 grup/1 üye input üretir. */
function buildImmutableInputs(batch, options = {}) {
  const { uniqueGroups } = dedupeCandidatesByAddress(batch);
  return buildImmutableInputsFromGroups(uniqueGroups, options);
}

/**
 * Geoapify batch contract:
 * - POST 202: { id, status: "pending", url }
 * - GET 202 / body.status pending: still running
 * - GET/POST 200: JSON array, one result object per input, same order
 */
function assertCompletedBatchResults(jobId, inputs, body) {
  if (!Array.isArray(body)) {
    throw new Error(
      `Job ${jobId}: tamamlanmış yanıt dizi değil (Geoapify contract: one-result-per-input array).`,
    );
  }
  if (body.length !== inputs.length) {
    throw new Error(
      `Job ${jobId}: sonuç sayısı uyuşmuyor (inputs=${inputs.length}, results=${body.length}).`,
    );
  }
  for (let i = 0; i < body.length; i += 1) {
    const item = body[i];
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Job ${jobId}: results[${i}] geçersiz nesne değil.`);
    }
  }
  return body;
}

function printCandidateReport(snapshot, statePath, extra = {}) {
  console.log("📋 Dry-run / aday raporu");
  console.log("• State:", statePath);
  console.log("• Aday (kurum):", snapshot.candidates.length);
  if (extra.uniqueQueryCount != null) {
    console.log("• Tekil adres (API):", extra.uniqueQueryCount);
    console.log("• Adres dedupe tasarrufu:", extra.duplicateInstitutionCount ?? 0);
  }
  if (extra.priorExcludedCount != null) {
    console.log("• Prior/state işlenmiş atlanan:", extra.priorExcludedCount);
  }
  if (extra.retryAllowCount != null) {
    console.log("• Explicit retry allowlist:", extra.retryAllowCount);
  }
  if (extra.secondPass != null) {
    console.log("• Second-pass:", extra.secondPass ? "evet" : "hayır");
  }
  if (extra.primarySimplified != null) {
    console.log("• First-pass sade adres:", extra.primarySimplified ? "evet" : "hayır");
  }
  console.log("• Adres boş atlanan:", snapshot.skippedNoAddress?.length ?? 0);
  console.log("• institution_locations satırı eksik:", snapshot.missingLocationRows?.length ?? 0);
  console.log("• success atlanan (dokunulmaz):", snapshot.successSkippedCount ?? 0);
  console.log(
    "• Not: dry-run/submit/collect eksik location satırı INSERT etmez; önce pending satır gerekir.",
  );
  if (snapshot.candidates.length > 0) {
    console.log("• Örnek adaylar:");
    for (const row of snapshot.candidates.slice(0, 5)) {
      console.log(
        `  - #${row.institutionId} [${row.geocode_status || row.queryKind || "?"}] ${row.city}/${row.district} | ${row.query}`,
      );
    }
  }
}

/**
 * Submit/dry-run adaylarını prior-state + retry + second-pass + dedupe ile hazırlar.
 * API çağrısı yok.
 */
function prepareSubmitPlan(args, state, snapshot) {
  const retrySet = new Set((args.retryIds || []).map((id) => Number(id)));
  const prior = loadPriorProcessedInstitutions(args.priorStates || []);
  const currentProcessed = collectProcessedInstitutionMeta(state, args.state || "current");
  const processed = mergeProcessedMaps(prior.byId, currentProcessed);

  const priorExcluded = [];
  const retryIncluded = [];
  let baseRows;

  if (args.secondPass) {
    // Second-pass: mevcut state'teki reject/manual_review (veya explicit retry)
    const byInstitution = new Map();
    for (const job of state?.jobs || []) {
      for (const row of job.evaluations || []) {
        const id = Number(row.institutionId);
        if (!Number.isFinite(id)) continue;
        byInstitution.set(id, { job, row });
      }
    }

    baseRows = [];
    for (const [id, { row }] of byInstitution) {
      const decision = String(row.decision || "");
      const explicitRetry = retrySet.has(id);
      if (!explicitRetry && decision === "accept") continue;
      if (!explicitRetry && decision !== "reject" && decision !== "manual_review") continue;
      if (!explicitRetry && Number(row.pass || 1) >= 2) {
        // zaten second-pass denenmiş
        priorExcluded.push({
          institutionId: id,
          reason: "second-pass zaten uygulanmış",
          decision,
        });
        continue;
      }

      const institution = {
        institution_name: row.institution_name || null,
        address: row.address || null,
        district: row.district || state.candidates?.find((c) => Number(c.institutionId) === id)?.district,
        city: row.city || state.candidates?.find((c) => Number(c.institutionId) === id)?.city,
      };

      // Adres bilgisini candidates / job inputs'tan tamamla
      const fromCandidate = (state.candidates || []).find((c) => Number(c.institutionId) === id);
      const fromSnapshot = (snapshot.candidates || []).find((c) => Number(c.institutionId) === id);
      const fromInputMember = findInstitutionMemberInJobs(state, id);
      const address =
        fromInputMember?.address ||
        fromCandidate?.address ||
        fromSnapshot?.address ||
        institution.address ||
        "";
      const district =
        fromInputMember?.district ||
        fromCandidate?.district ||
        fromSnapshot?.district ||
        row.district ||
        "";
      const city =
        fromInputMember?.city ||
        fromCandidate?.city ||
        fromSnapshot?.city ||
        row.city ||
        "";

      const simplified = buildSimplifiedBatchQuery({
        address,
        district,
        city,
        institution_name: fromCandidate?.institution_name || fromSnapshot?.institution_name,
      });
      if (simplified.skipReason) {
        priorExcluded.push({
          institutionId: id,
          reason: simplified.skipReason,
          decision,
        });
        continue;
      }

      // Aynı query ile tekrar deneme — faydasız
      const prevQueryKey = normalizeAddressKey(row.query || fromInputMember?.query || "");
      if (prevQueryKey && prevQueryKey === normalizeAddressKey(simplified.query)) {
        priorExcluded.push({
          institutionId: id,
          reason: "Second-pass query birincil ile aynı — atlandı",
          decision,
        });
        continue;
      }

      baseRows.push({
        institutionId: id,
        institution_name:
          fromCandidate?.institution_name ||
          fromSnapshot?.institution_name ||
          fromInputMember?.institution_name ||
          null,
        address,
        district,
        city,
        geocode_status: fromCandidate?.geocode_status || fromSnapshot?.geocode_status || "pending",
        query: simplified.query,
        pass: 2,
        queryKind: "simplified",
      });
      if (explicitRetry) retryIncluded.push(id);
    }
  } else {
    baseRows = [];
    for (const row of snapshot.candidates || []) {
      const id = Number(row.institutionId);
      if (!Number.isFinite(id)) continue;
      const processedInfo = processed.get(id);
      if (processedInfo && !retrySet.has(id)) {
        priorExcluded.push({
          institutionId: id,
          reason: `önceden işlenmiş (${processedInfo.decision}) @ ${processedInfo.source}`,
          decision: processedInfo.decision,
        });
        continue;
      }
      if (processedInfo && retrySet.has(id)) {
        retryIncluded.push(id);
      }
      if (args.primarySimplified) {
        const simplified = buildSimplifiedBatchQuery(row);
        if (simplified.skipReason) {
          priorExcluded.push({
            institutionId: id,
            reason: simplified.skipReason,
            decision: "simplified_query_unavailable",
          });
          continue; // Never fall back to district/city center or the original address silently.
        }
        baseRows.push({
          ...row,
          query: simplified.query,
          pass: 1,
          queryKind: "simplified",
        });
      } else {
        baseRows.push({
          ...row,
          pass: 1,
          queryKind: "primary",
        });
      }
    }
  }

  // Önce önceden işlenenleri çıkar, sonra yeni aday limitini uygula.
  // Legacy --limit bu noktadan önce uygulanır; otomasyonda --limit kullanılmaz.
  // Group across the entire remaining dataset before limiting to avoid repeat
  // requests for the same address in different jobs.
  const globallyGrouped = dedupeCandidatesByAddress(baseRows);
  const selectedGroups = [];
  let selectedCount = 0;
  for (const group of globallyGrouped.uniqueGroups) {
    if (args.maxNew != null && selectedCount >= args.maxNew) break;
    selectedGroups.push(group);
    selectedCount += group.members.length;
  }
  const selectedRows = selectedGroups.flatMap((group) => group.members);
  const deduped = {
    uniqueGroups: selectedGroups,
    uniqueQueryCount: selectedGroups.length,
    duplicateInstitutionCount: selectedRows.length - selectedGroups.length,
  };

  return {
    candidates: selectedRows,
    uniqueGroups: deduped.uniqueGroups,
    uniqueQueryCount: deduped.uniqueQueryCount,
    duplicateInstitutionCount: deduped.duplicateInstitutionCount,
    priorExcluded,
    priorExcludedCount: priorExcluded.length,
    retryIncluded,
    retryAllowCount: retrySet.size,
    secondPass: Boolean(args.secondPass),
    primarySimplified: Boolean(args.primarySimplified),
    priorStatesLoaded: prior.loaded,
    processedCount: processed.size,
  };
}

/** Exact-query historical Geoapify response cache. Cache the raw response only,
 * never a previous institution's accept decision or coordinates directly.
 * Ambiguous historical responses are deliberately not reused.
 */
function rawResultSignature(result) {
  const keys = ["lat", "lon", "result_type", "country_code", "country", "county", "state", "city", "municipality", "district", "suburb", "neighbourhood", "neighborhood", "street", "iso3166_2", "formatted"];
  const relevant = Object.fromEntries(keys.map((key) => [key, result?.[key] ?? null]));
  return JSON.stringify(relevant);
}

function loadHistoricalRawCache(paths) {
  const cache = new Map();
  const ambiguous = new Set();
  for (const rawPath of paths || []) {
    const file = assertStatePathOutsideRepo(rawPath);
    const prior = readStateFile(file);
    if (!prior) throw new Error(`Geçmiş cache dosyası bulunamadı: ${file}`);
    for (const job of prior.jobs || []) {
      if (job.status !== "completed" || !Array.isArray(job.inputs) || !Array.isArray(job.rawResults) || job.inputs.length !== job.rawResults.length) continue;
      for (let i = 0; i < job.inputs.length; i += 1) {
        const key = normalizeAddressKey(job.inputs[i]?.query);
        const raw = job.rawResults[i];
        if (!key || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const signature = rawResultSignature(raw);
        if (ambiguous.has(key)) continue;
        if (cache.has(key) && cache.get(key).signature !== signature) {
          cache.delete(key);
          ambiguous.add(key);
        } else if (!cache.has(key)) {
          cache.set(key, { raw, signature });
        }
      }
    }
  }
  return { cache, ambiguousCount: ambiguous.size };
}

function classifyCachedGroups(plan, paths) {
  const { cache, ambiguousCount } = loadHistoricalRawCache(paths);
  const cached = [];
  const fresh = [];
  for (const group of plan.uniqueGroups) {
    const hit = cache.get(group.addressKey);
    if (hit) cached.push({ group, raw: hit.raw });
    else fresh.push(group);
  }
  return { cached, fresh, ambiguousCount };
}

function findInstitutionMemberInJobs(state, institutionId) {
  const target = Number(institutionId);
  for (const job of state?.jobs || []) {
    for (const input of job.inputs || []) {
      if (Array.isArray(input.members)) {
        for (const member of input.members) {
          if (Number(member.institutionId) === target) return { ...member, query: input.query };
        }
      }
      if (Number(input.institutionId) === target) return input;
    }
  }
  return null;
}

async function modeDryRun(args) {
  const statePath = assertStatePathOutsideRepo(args.state);
  const supabase = createSupabase();
  const snapshot = await loadCandidateSnapshot(supabase, {
    city: args.city,
    limit: args.limit,
  });

  const existing = readStateFile(statePath);
  const plan = prepareSubmitPlan(
    args,
    existing || emptyState({ city: args.city, limit: args.limit }),
    snapshot,
  );
  const reuse = classifyCachedGroups(plan, args.priorStates || []);
  console.log(`♻️ Geçmiş adres cache: ${reuse.cached.length} yeniden kullanılacak / ${reuse.fresh.length} yeni Geoapify sorgusu; çelişkili geçmiş: ${reuse.ambiguousCount}`);


  if (existing && hasLockedJobs(existing) && !args.secondPass) {
    const lockedIds = collectSubmittedInstitutionIds(existing);
    const next = {
      ...existing,
      // Mevcut job.inputs / job mapping asla değiştirilmez.
      dryRunPreview: {
        generatedAt: new Date().toISOString(),
        filters: { city: args.city || null, limit: args.limit },
        candidateCount: snapshot.candidates.length,
        planInstitutionCount: plan.candidates.length,
        planUniqueQueryCount: plan.uniqueQueryCount,
        planFreshQueryCount: reuse.fresh.length,
        planCachedQueryCount: reuse.cached.length,
        primarySimplified: plan.primarySimplified,
        priorExcludedCount: plan.priorExcludedCount,
        missingLocationCount: snapshot.missingLocationRows.length,
        skippedNoAddressCount: snapshot.skippedNoAddress.length,
        successSkippedCount: snapshot.successSkippedCount,
        lockedJobCount: existing.jobs.length,
        lockedInstitutionCount: lockedIds.size,
        priorStatesLoaded: plan.priorStatesLoaded,
        note: "State içinde submitted/completed job var. dry-run preview-only; candidates/job.inputs üzerine yazılmadı. Yeni batch için yeni --state + --prior-states kullanın.",
      },
      missingLocationRows: snapshot.missingLocationRows,
      skippedNoAddress: snapshot.skippedNoAddress,
      report: {
        phase: "dry-run",
        generatedAt: new Date().toISOString(),
        locked: true,
        candidateCountPreview: snapshot.candidates.length,
        planInstitutionCount: plan.candidates.length,
        planUniqueQueryCount: plan.uniqueQueryCount,
        planFreshQueryCount: reuse.fresh.length,
        planCachedQueryCount: reuse.cached.length,
        primarySimplified: plan.primarySimplified,
        priorExcludedCount: plan.priorExcludedCount,
        missingLocationCount: snapshot.missingLocationRows.length,
        message:
          "Mevcut job'lar kilitli. Yeni submit için yeni --state + --prior-states; second-pass için --second-pass.",
      },
    };
    writeStateFile(statePath, next);
    printCandidateReport(
      { ...snapshot, candidates: plan.candidates },
      statePath,
      plan,
    );
    console.log(
      `ℹ️ dry-run: ${existing.jobs.length} kilitli job korundu; candidate mapping değiştirilmedi.`,
    );
    console.log("✅ Dry-run tamamlandı (API/DB yazımı yok).");
    return;
  }

  if (args.secondPass) {
    if (!existing?.jobs?.length) {
      throw new Error("--second-pass için state'te collect edilmiş job/evaluations gerekir.");
    }
    const next = {
      ...existing,
      dryRunPreview: {
        generatedAt: new Date().toISOString(),
        secondPass: true,
        planInstitutionCount: plan.candidates.length,
        planUniqueQueryCount: plan.uniqueQueryCount,
        planFreshQueryCount: reuse.fresh.length,
        planCachedQueryCount: reuse.cached.length,
        primarySimplified: plan.primarySimplified,
        priorExcludedCount: plan.priorExcludedCount,
        priorExcludedSample: plan.priorExcluded.slice(0, 15),
        note: "Second-pass dry-run: job.inputs değiştirilmedi; submit --second-pass ile yeni job eklenir.",
      },
      report: {
        phase: "dry-run",
        generatedAt: new Date().toISOString(),
        secondPass: true,
        planInstitutionCount: plan.candidates.length,
        planUniqueQueryCount: plan.uniqueQueryCount,
        planFreshQueryCount: reuse.fresh.length,
        planCachedQueryCount: reuse.cached.length,
        primarySimplified: plan.primarySimplified,
        priorExcludedCount: plan.priorExcludedCount,
      },
    };
    writeStateFile(statePath, next);
    printCandidateReport(
      {
        candidates: plan.candidates,
        skippedNoAddress: snapshot.skippedNoAddress,
        missingLocationRows: snapshot.missingLocationRows,
        successSkippedCount: snapshot.successSkippedCount,
      },
      statePath,
      plan,
    );
    console.log("✅ Second-pass dry-run tamamlandı (API/DB yazımı yok).");
    return;
  }

  const state = {
    ...emptyState({ city: args.city, limit: args.limit }),
    ...(existing && !hasLockedJobs(existing) ? existing : {}),
    filters: { city: args.city || null, limit: args.limit },
    candidates: plan.candidates,
    missingLocationRows: snapshot.missingLocationRows,
    skippedNoAddress: snapshot.skippedNoAddress,
    jobs: [],
    priorStates: args.priorStates || [],
    report: {
      phase: "dry-run",
      generatedAt: new Date().toISOString(),
      candidateCount: snapshot.candidates.length,
      planInstitutionCount: plan.candidates.length,
      planUniqueQueryCount: plan.uniqueQueryCount,
        planFreshQueryCount: reuse.fresh.length,
        planCachedQueryCount: reuse.cached.length,
      primarySimplified: plan.primarySimplified,
      duplicateInstitutionCount: plan.duplicateInstitutionCount,
      priorExcludedCount: plan.priorExcludedCount,
      priorStatesLoaded: plan.priorStatesLoaded,
      missingLocationCount: snapshot.missingLocationRows.length,
      skippedNoAddressCount: snapshot.skippedNoAddress.length,
      successSkippedCount: snapshot.successSkippedCount,
    },
  };

  writeStateFile(statePath, state);
  printCandidateReport(
    { ...snapshot, candidates: plan.candidates },
    statePath,
    plan,
  );
  console.log("✅ Dry-run tamamlandı (API/DB yazımı yok).");
}

async function modeSubmit(args) {
  const statePath = assertStatePathOutsideRepo(args.state);
  const apiKey = requireGeoapifyApiKey();
  const supabase = createSupabase();

  let state = readStateFile(statePath);
  if (!state) {
    state = emptyState({ city: args.city, limit: args.limit });
  }

  const alreadyInJobs = collectSubmittedInstitutionIds(state);
  if (alreadyInJobs.size > 0 && !args.secondPass && (args.retryIds || []).length === 0) {
    console.log(
      `ℹ️ State'te ${state.jobs.length} job / ${alreadyInJobs.size} işlenmiş institution var — yeniden submit için --retry-ids veya --second-pass gerekir.`,
    );
  }

  const snapshot = await loadCandidateSnapshot(supabase, {
    city: args.city || state.filters?.city || "",
    limit: args.limit ?? state.filters?.limit ?? null,
  });
  state.filters = {
    city: args.city || state.filters?.city || null,
    limit: args.limit ?? state.filters?.limit ?? null,
  };
  if (hasLockedJobs(state)) {
    state.submitPreviewCandidates = snapshot.candidates;
  } else {
    state.candidates = snapshot.candidates;
  }
  state.missingLocationRows = snapshot.missingLocationRows;
  state.skippedNoAddress = snapshot.skippedNoAddress;
  state.jobs = Array.isArray(state.jobs) ? state.jobs : [];
  state.priorStates = Array.from(
    new Set([...(state.priorStates || []), ...(args.priorStates || [])]),
  );

  const plan = prepareSubmitPlan(args, state, snapshot);
  if (!hasLockedJobs(state)) {
    // Persist only the selected batch, not all ~40k candidates.
    state.candidates = plan.candidates;
  }
  printCandidateReport(
    {
      candidates: plan.candidates,
      skippedNoAddress: snapshot.skippedNoAddress,
      missingLocationRows: snapshot.missingLocationRows,
      successSkippedCount: snapshot.successSkippedCount,
    },
    statePath,
    plan,
  );

  const reuse = classifyCachedGroups(plan, args.priorStates || []);
  console.log(`♻️ Cache: ${reuse.cached.length} adresin ham sonucu tekrar kullanılacak; ${reuse.fresh.length} yeni sorgu`);
  if (args.expectedFresh != null && reuse.fresh.length !== args.expectedFresh) {
    throw new Error(`Önizleme/sunum planı değişti: beklenen yeni sorgu ${args.expectedFresh}, mevcut ${reuse.fresh.length}. API çağrısı yapılmadı.`);
  }


  if (plan.uniqueGroups.length === 0) {
    writeStateFile(statePath, {
      ...state,
      report: {
        phase: "submit",
        generatedAt: new Date().toISOString(),
        message:
          plan.priorExcludedCount > 0
            ? "Submit edilecek yeni adres yok (prior/state engeli veya second-pass aday yok)"
            : "Submit edilecek aday yok",
        priorExcludedCount: plan.priorExcludedCount,
        processedCount: plan.processedCount,
        missingLocationCount: snapshot.missingLocationRows.length,
        secondPass: plan.secondPass,
        primarySimplified: plan.primarySimplified,
      },
    });
    console.log("ℹ️ Yeni submit yok.");
    return;
  }

  const pass = args.secondPass ? 2 : 1;
  const queryKind = args.secondPass || args.primarySimplified ? "simplified" : "primary";
  if (reuse.cached.length) {
    // Cache replay is a completed local job. mode=collect evaluates every member
    // with its own address/location checks before any database write.
    const cachedInputs = buildImmutableInputsFromGroups(reuse.cached.map((item) => item.group), { pass, queryKind });
    const cachedJob = {
      jobId: `cache-${Date.now()}`,
      status: "completed",
      submittedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      pollUrl: null, pass, queryKind,
      inputs: cachedInputs,
      inputCount: cachedInputs.length,
      institutionCount: cachedInputs.reduce((sum, input) => sum + input.memberCount, 0),
      rawResults: reuse.cached.map((item) => item.raw),
      evaluations: null,
      mappingFrozen: true,
      cacheReplay: true,
    };
    // No external API call has occurred. Atomic state write enables safe resume.
    state.jobs.push(cachedJob);
    state = writeStateFile(statePath, state);
  }
  const batches = chunkArray(reuse.fresh, GEOAPIFY_MAX_BATCH);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const latest = readStateFile(statePath) || state;
    const alreadySubmittedIds = collectSubmittedInstitutionIds(latest);
    const retrySet = new Set((args.retryIds || []).map((id) => Number(id)));

    // Grupları yeniden filtrele: üyelerin hepsi zaten işlenmişse (retry yok) atla
    const filteredGroups = [];
    for (const group of batches[batchIndex]) {
      const freshMembers = group.members.filter((row) => {
        const id = Number(row.institutionId);
        if (args.secondPass) return true;
        if (retrySet.has(id)) return true;
        return !alreadySubmittedIds.has(id);
      });
      if (freshMembers.length === 0) continue;
      filteredGroups.push({
        ...group,
        members: freshMembers,
        query: freshMembers[0].query,
      });
    }

    if (filteredGroups.length === 0) {
      console.log(`ℹ️ Batch ${batchIndex + 1}: tüm id'ler zaten state'te — atlandı.`);
      continue;
    }

    const immutableInputs = buildImmutableInputsFromGroups(filteredGroups, {
      pass,
      queryKind,
    });
    const addresses = immutableInputs.map((row) => row.query);
    const url = `${GEOAPIFY_BATCH_URL}?apiKey=${encodeURIComponent(apiKey)}&filter=${encodeURIComponent("countrycode:tr")}&lang=tr`;

    const institutionCount = immutableInputs.reduce((n, row) => n + row.memberCount, 0);
    console.log(
      `🚀 Batch submit ${batchIndex + 1}/${batches.length} (${addresses.length} tekil adres → ${institutionCount} kurum, pass=${pass})...`,
    );

    const { status, body } = await geoapifyRequest(url, {
      method: "POST",
      body: addresses,
      purpose: "submit",
    });

    let job;
    if (status === 200) {
      const rawResults = assertCompletedBatchResults(
        `immediate-batch-${batchIndex}`,
        immutableInputs,
        body,
      );
      const jobId = `immediate-${Date.now()}-${batchIndex}`;
      job = {
        jobId,
        status: "completed",
        submittedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        pollUrl: null,
        pass,
        queryKind,
        inputs: immutableInputs,
        inputCount: immutableInputs.length,
        institutionCount,
        rawResults,
        evaluations: null,
        mappingFrozen: true,
      };
      console.log(`✅ Batch anında tamamlandı (HTTP 200), jobId=${jobId}`);
    } else if (status === 202) {
      const jobId = String(body?.id ?? "").trim();
      if (!jobId) {
        throw new Error("Geoapify 202 yanıtında job id yok — submit kaydedilmedi.");
      }
      if (body?.status && body.status !== "pending") {
        console.warn(`⚠️ Beklenen pending status; gelen: ${body.status}`);
      }
      job = {
        jobId,
        status: "submitted",
        submittedAt: new Date().toISOString(),
        completedAt: null,
        pollUrl: `${GEOAPIFY_BATCH_URL}?id=${encodeURIComponent(jobId)}`,
        pass,
        queryKind,
        inputs: immutableInputs,
        inputCount: immutableInputs.length,
        institutionCount,
        rawResults: null,
        evaluations: null,
        mappingFrozen: true,
      };
      console.log(`✅ Job alındı id=${jobId} (API anahtarı loglanmadı)`);
    } else {
      throw new Error(`Beklenmeyen submit HTTP ${status}`);
    }

    const persistState = readStateFile(statePath) || state;
    persistState.filters = state.filters;
    persistState.candidates = state.candidates;
    persistState.submitPreviewCandidates = state.submitPreviewCandidates;
    persistState.missingLocationRows = state.missingLocationRows;
    persistState.skippedNoAddress = state.skippedNoAddress;
    persistState.priorStates = state.priorStates;
    persistState.jobs = [...(persistState.jobs || []), job];
    persistState.report = {
      phase: "submit",
      generatedAt: new Date().toISOString(),
      lastPersistedJobId: job.jobId,
      submittedJobs: persistState.jobs.length,
      lastBatchUniqueQueries: immutableInputs.length,
      lastBatchInstitutions: institutionCount,
      duplicateInstitutionCount: plan.duplicateInstitutionCount,
      priorExcludedCount: plan.priorExcludedCount,
      secondPass: plan.secondPass,
      primarySimplified: plan.primarySimplified,
      pass,
      missingLocationCount: snapshot.missingLocationRows.length,
    };
    writeStateFile(statePath, persistState);
    state = persistState;
    console.log(
      `💾 Job state'e yazıldı: ${job.jobId} (${immutableInputs.length} tekil adres / ${institutionCount} kurum)`,
    );

    if (batchIndex < batches.length - 1) {
      await sleep(Math.max(1000, SLEEP_MS));
    }
  }

  console.log("✅ Submit tamamlandı. Sonuç için --mode=collect");
}

function evaluateJob(job) {
  const inputs = job.inputs || [];
  const rawResults = assertCompletedBatchResults(job.jobId, inputs, job.rawResults);
  const evaluations = [];

  inputs.forEach((input, index) => {
    const raw = rawResults[index];
    const members =
      Array.isArray(input.members) && input.members.length > 0
        ? input.members
        : [
            {
              institutionId: input.institutionId,
              city: input.city,
              district: input.district,
              address: input.address,
              institution_name: input.institution_name,
              geocode_status: input.geocode_status,
              query: input.query,
              pass: input.pass || job.pass || 1,
              queryKind: input.queryKind || job.queryKind || "primary",
            },
          ];

    for (const member of members) {
      const evalInput = {
        institutionId: member.institutionId,
        city: member.city,
        district: member.district,
        address: member.address,
        institution_name: member.institution_name,
        query: input.query,
      };
      const evaluated = evaluateGeoapifyResult(evalInput, raw);
      evaluations.push({
        index,
        institutionId: member.institutionId,
        query: input.query,
        addressKey: input.addressKey || normalizeAddressKey(input.query) || null,
        sharedAddress: members.length > 1,
        memberCount: members.length,
        city: member.city,
        district: member.district,
        pass: member.pass || input.pass || job.pass || 1,
        queryKind: member.queryKind || input.queryKind || job.queryKind || "primary",
        ...evaluated,
      });
    }
  });

  return evaluations;
}

async function modeCollect(args) {
  const statePath = assertStatePathOutsideRepo(args.state);
  const apiKey = requireGeoapifyApiKey();
  let state = readStateFile(statePath);
  if (!state?.jobs?.length) {
    throw new Error("State içinde job yok. Önce --mode=submit çalıştırın.");
  }

  for (const job of state.jobs) {
    // inputs mapping dondurulmuş kabul edilir
    if (!Array.isArray(job.inputs) || job.inputs.length === 0) {
      throw new Error(`Job ${job.jobId}: inputs mapping eksik — collect durdu.`);
    }

    if (job.status === "completed" && Array.isArray(job.rawResults)) {
      assertCompletedBatchResults(job.jobId, job.inputs, job.rawResults);
      console.log(`ℹ️ Job ${job.jobId} zaten completed — yeniden poll yok.`);
      writeStateFile(statePath, state);
      continue;
    }

    if (!job.jobId) throw new Error("Job id eksik.");

    if (String(job.jobId).startsWith("immediate-")) {
      if (!Array.isArray(job.rawResults)) {
        throw new Error(`Immediate job ${job.jobId}: rawResults eksik.`);
      }
      assertCompletedBatchResults(job.jobId, job.inputs, job.rawResults);
      job.status = "completed";
      writeStateFile(statePath, state);
      continue;
    }

    const pollUrl = `${GEOAPIFY_BATCH_URL}?id=${encodeURIComponent(job.jobId)}&apiKey=${encodeURIComponent(apiKey)}`;
    console.log(`⏳ Job collect: ${job.jobId}`);

    let done = false;
    for (let attempt = 1; attempt <= GEOAPIFY_MAX_POLL_ATTEMPTS; attempt += 1) {
      const { status, body } = await geoapifyRequest(pollUrl, { purpose: "collect" });

      // Pending contract: HTTP 202 and/or { id, status: "pending" }
      if (
        status === 202 ||
        (body && typeof body === "object" && !Array.isArray(body) && body.status === "pending")
      ) {
        console.log(
          `  … pending (deneme ${attempt}/${GEOAPIFY_MAX_POLL_ATTEMPTS}), ${GEOAPIFY_POLL_MS}ms bekleniyor`,
        );
        await sleep(GEOAPIFY_POLL_MS);
        continue;
      }

      if (status === 200) {
        const rawResults = assertCompletedBatchResults(job.jobId, job.inputs, body);
        job.rawResults = rawResults;
        job.status = "completed";
        job.completedAt = new Date().toISOString();
        // inputs asla yeniden yazılmaz
        done = true;
        writeStateFile(statePath, state);
        console.log(`✅ Job tamamlandı: ${job.jobId} (${rawResults.length} sonuç)`);
        break;
      }
      throw new Error(`Job ${job.jobId}: beklenmeyen HTTP ${status}`);
    }
    if (!done) {
      throw new Error(
        `Job ${job.jobId}: poll deneme limiti aşıldı (hâlâ pending). Yeniden submit etmeyin; sonra --mode=collect.`,
      );
    }
  }

  const allEvaluations = [];
  for (const job of state.jobs) {
    job.evaluations = evaluateJob(job);
    allEvaluations.push(...job.evaluations);
  }

  const accepted = allEvaluations.filter((row) => row.decision === "accept");
  const rejected = allEvaluations.filter((row) => row.decision === "reject");
  const manualReview = allEvaluations.filter((row) => row.decision === "manual_review");

  state.report = {
    phase: "collect",
    generatedAt: new Date().toISOString(),
    total: allEvaluations.length,
    accepted: accepted.length,
    rejected: rejected.length,
    manualReview: manualReview.length,
    minConfidence: GEOAPIFY_MIN_CONFIDENCE,
    minStreetConfidence: GEOAPIFY_MIN_STREET_CONFIDENCE,
    note: "DB yazımı yok. Apply: --confirm-apply ile --approve-ids=... veya --approve-all-accepted.",
    acceptedPreview: accepted.slice(0, 20).map((row) => ({
      institutionId: row.institutionId,
      lat: row.latitude,
      lon: row.longitude,
      confidence: row.confidence,
      resultType: row.resultType,
      matchType: row.matchType,
      city: row.resultCity,
      district: row.resultDistrict,
    })),
    manualReviewPreview: manualReview.slice(0, 20).map((row) => ({
      institutionId: row.institutionId,
      reason: row.rejectReason,
      resultType: row.resultType,
      confidence: row.confidence,
    })),
    rejectedPreview: rejected.slice(0, 20).map((row) => ({
      institutionId: row.institutionId,
      reason: row.rejectReason,
      resultType: row.resultType,
      matchType: row.matchType,
      confidence: row.confidence,
    })),
  };

  writeStateFile(statePath, state);
  console.log("📋 Collect raporu");
  console.log("• Toplam:", allEvaluations.length);
  console.log("• Kabul (accept):", accepted.length);
  console.log("• Manuel inceleme:", manualReview.length);
  console.log("• Red:", rejected.length);
  console.log("• State:", statePath);
  console.log(
    "✅ Collect tamamlandı (DB yazımı yok). Apply: --confirm-apply --approve-ids=ID1,ID2 | veya --approve-all-accepted",
  );
}

async function modeApply(args) {
  if (!args.confirmApply) {
    throw new Error(
      "Apply için --confirm-apply zorunlu. --approve-ids veya --approve-all-accepted ile birlikte kullanın.",
    );
  }
  if (!args.approveAllAccepted && (!Array.isArray(args.approveIds) || args.approveIds.length === 0)) {
    throw new Error(
      "Apply fail-closed: --approve-ids=101,102 veya --approve-all-accepted zorunlu.",
    );
  }
  if (args.approveAllAccepted && args.approveIds.length > 0) {
    throw new Error(
      "Fail-closed: --approve-all-accepted ile --approve-ids aynı anda kullanılamaz. Birini seçin.",
    );
  }

  const statePath = assertStatePathOutsideRepo(args.state);
  const supabase = createSupabase();
  const state = readStateFile(statePath);
  if (!state?.jobs?.length) {
    throw new Error("State içinde job yok.");
  }

  const acceptedById = new Map();
  for (const job of state.jobs) {
    if (!Array.isArray(job.evaluations)) {
      throw new Error(`Job ${job.jobId}: evaluations yok. Önce --mode=collect çalıştırın.`);
    }
    for (const row of job.evaluations) {
      if (row.decision === "accept") {
        acceptedById.set(Number(row.institutionId), row);
      }
    }
  }

  let approveIds;
  if (args.approveAllAccepted) {
    approveIds = Array.from(acceptedById.keys()).sort((a, b) => a - b);
    if (approveIds.length === 0) {
      throw new Error("Fail-closed: --approve-all-accepted ama decision=accept yok.");
    }
    console.log(`ℹ️ --approve-all-accepted: ${approveIds.length} accept ID uygulanacak.`);
  } else {
    approveIds = args.approveIds;
    const unknownApproveIds = approveIds.filter((id) => !acceptedById.has(id));
    if (unknownApproveIds.length > 0) {
      throw new Error(
        `Fail-closed: şu --approve-ids collect accept listesinde yok (veya manual_review/reject): ${unknownApproveIds.join(",")}`,
      );
    }
  }

  const approveSet = new Set(approveIds);
  const toApply = approveIds.map((id) => acceptedById.get(id)).filter(Boolean);

  const applyLog = [];
  let updated = 0;
  let skippedSuccess = 0;
  let skippedMissing = 0;
  let skippedChanged = 0;
  let failedUpdates = 0;
  let skippedNotApproved = 0;

  for (const job of state.jobs) {
    for (const row of job.evaluations || []) {
      if (row.decision === "accept" && !approveSet.has(Number(row.institutionId))) {
        skippedNotApproved += 1;
      }
    }
  }

  for (const row of toApply) {
    const institutionId = Number(row.institutionId);
    if (!Number.isFinite(institutionId)) continue;
    if (!Number.isFinite(Number(row.latitude)) || !Number.isFinite(Number(row.longitude))) {
      applyLog.push({
        institutionId,
        action: "skip",
        reason: "accept satırında geçersiz koordinat",
      });
      continue;
    }
    if (row.decision !== "accept") {
      applyLog.push({
        institutionId,
        action: "skip",
        reason: `decision=${row.decision} apply edilemez`,
      });
      continue;
    }

    const { data: loc, error: locError } = await supabase
      .from("institution_locations")
      .select("institution_id, geocode_status, latitude, longitude")
      .eq("institution_id", institutionId)
      .maybeSingle();

    if (locError) {
      failedUpdates += 1;
      applyLog.push({
        institutionId,
        action: "error",
        reason: locError.message,
      });
      continue;
    }

    if (!loc) {
      skippedMissing += 1;
      applyLog.push({
        institutionId,
        action: "skip",
        reason: "institution_locations satırı yok (INSERT yapılmaz)",
      });
      continue;
    }

    const status = String(loc.geocode_status ?? "").trim().toLowerCase();
    if (status === "success") {
      skippedSuccess += 1;
      applyLog.push({
        institutionId,
        action: "skip",
        reason: "mevcut geocode_status=success — üzerine yazılmadı",
      });
      continue;
    }

    if (status !== "pending" && status !== "failed") {
      skippedChanged += 1;
      applyLog.push({
        institutionId,
        action: "skip",
        reason: `beklenmeyen geocode_status=${status}`,
      });
      continue;
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from("institution_locations")
      .update({
        latitude: row.latitude,
        longitude: row.longitude,
        geocode_status: "success",
        geocode_error: null,
        geocoded_query: row.geocoded_query || row.query || null,
        geocoded_at: new Date().toISOString(),
      })
      .eq("institution_id", institutionId)
      .in("geocode_status", ["pending", "failed"])
      .select("institution_id");

    if (updateError) {
      failedUpdates += 1;
      applyLog.push({
        institutionId,
        action: "error",
        reason: updateError.message,
      });
      continue;
    }

    if (!updatedRows?.length) {
      skippedChanged += 1;
      applyLog.push({
        institutionId,
        action: "skip",
        reason: "update 0 satır (status arada success olmuş olabilir)",
      });
      continue;
    }

    updated += 1;
    applyLog.push({
      institutionId,
      action: "updated",
      latitude: row.latitude,
      longitude: row.longitude,
    });
  }

  state.applyLog = applyLog;
  state.report = {
    ...(state.report || {}),
    phase: "apply",
    appliedAt: new Date().toISOString(),
    approvedIdCount: approveIds.length,
    approveAllAccepted: Boolean(args.approveAllAccepted),
    acceptedInCollect: acceptedById.size,
    updated,
    skippedSuccess,
    skippedMissing,
    skippedChanged,
    skippedNotApproved,
    failedUpdates,
    note: args.approveAllAccepted
      ? "Tüm decision=accept uygulandı (--approve-all-accepted + --confirm-apply); success üzerine yazılmaz; manual_review/reject yazılmaz."
      : "Yalnızca --approve-ids ∩ decision=accept uygulandı; success üzerine yazılmaz; manual_review/reject yazılmaz.",
  };
  writeStateFile(statePath, state);

  console.log("🎯 Apply tamamlandı");
  console.log("• success güncellenen:", updated);
  console.log("• approve edilmeyen accept atlanan:", skippedNotApproved);
  console.log("• success atlanan:", skippedSuccess);
  console.log("• location satırı eksik:", skippedMissing);
  console.log("• durum değişmiş atlanan:", skippedChanged);
  console.log("• update hataları:", failedUpdates);
}

/* ========================= Nominatim (legacy, korunur) ========================= */

async function geocodeSingleQuery(query) {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    countrycodes: "tr",
    addressdetails: "0",
  });

  if (NOMINATIM_EMAIL) {
    params.set("email", NOMINATIM_EMAIL);
  }

  const response = await fetch(`${NOMINATIM_BASE_URL}?${params.toString()}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return {
      success: false,
      reason: `Geocoder HTTP ${response.status}`,
    };
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    return {
      success: false,
      reason: "Sonuç bulunamadı",
    };
  }

  const first = data[0];
  const lat = Number(first?.lat);
  const lon = Number(first?.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      success: false,
      reason: "Geçersiz koordinat yanıtı",
    };
  }

  return {
    success: true,
    lat,
    lon,
  };
}

async function geocodeInstitution(institution) {
  const queries = buildGeocodeQueries(institution);
  if (queries.length === 0) {
    return {
      success: false,
      reason: "Geocode için adres bilgisi yetersiz",
      query: null,
      level: null,
    };
  }

  let lastReason = "Sonuç bulunamadı";
  let lastLevel = null;
  for (const queryItem of queries) {
    try {
      const result = await geocodeSingleQuery(queryItem.query);
      if (result.success) {
        return {
          success: true,
          lat: result.lat,
          lon: result.lon,
          query: queryItem.query,
          level: queryItem.level,
        };
      }
      lastReason = result.reason || lastReason;
      lastLevel = queryItem.level;
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "Geocoder isteğinde hata";
      lastLevel = queryItem.level;
    }

    await sleep(SLEEP_MS);
  }

  return {
    success: false,
    reason: lastReason,
    query: queries[queries.length - 1]?.query || null,
    level: lastLevel,
  };
}

async function fetchPendingRowsKeyset(supabase, afterId) {
  let query = supabase
    .from("institution_locations")
    .select("institution_id")
    .eq("geocode_status", "pending")
    .order("institution_id", { ascending: true })
    .limit(BATCH_SIZE);

  if (afterId != null) {
    query = query.gt("institution_id", afterId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || [])
    .map((row) => Number(row.institution_id))
    .filter((id) => Number.isFinite(id));
}

async function fetchInstitutionsByIds(supabase, ids) {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("institutions")
    .select("id, institution_name, address, district, city")
    .in("id", ids);

  if (error) throw error;
  return data || [];
}

async function updateLocationSuccess(supabase, institutionId, payload) {
  const { error } = await supabase
    .from("institution_locations")
    .update({
      latitude: payload.lat,
      longitude: payload.lon,
      geocode_status: "success",
      geocode_error: null,
      geocoded_query: payload.query,
      geocoded_at: new Date().toISOString(),
    })
    .eq("institution_id", institutionId)
    .eq("geocode_status", "pending");

  if (error) throw error;
}

async function updateLocationFailure(supabase, institutionId, payload) {
  const { error } = await supabase
    .from("institution_locations")
    .update({
      geocode_status: "failed",
      geocode_error: payload.reason,
      geocoded_query: payload.query,
      geocoded_at: new Date().toISOString(),
    })
    .eq("institution_id", institutionId)
    .eq("geocode_status", "pending");

  if (error) throw error;
}

async function modeNominatim() {
  const supabase = createSupabase();
  console.log("✅ Nominatim geocode başladı (legacy)");
  console.log("• Batch size:", BATCH_SIZE);
  console.log("• Sleep ms:", SLEEP_MS);
  console.log("• Geocoder:", NOMINATIM_BASE_URL);
  console.log("• Not: offset bug düzeltildi (keyset: institution_id > lastId)");

  let totalProcessed = 0;
  let successCount = 0;
  let failedCount = 0;
  let lastId = null;

  while (true) {
    const pendingIds = await fetchPendingRowsKeyset(supabase, lastId);
    if (pendingIds.length === 0) break;

    const institutions = await fetchInstitutionsByIds(supabase, pendingIds);
    const institutionById = new Map(
      institutions.map((institution) => [Number(institution.id), institution]),
    );

    for (const institutionId of pendingIds) {
      totalProcessed += 1;
      lastId = institutionId;

      const institution = institutionById.get(institutionId);
      if (!institution) {
        failedCount += 1;
        await updateLocationFailure(supabase, institutionId, {
          reason: "Institutions tablosunda eşleşen kayıt bulunamadı",
          query: null,
        });
        console.log(`❌ #${institutionId}: institutions kaydı bulunamadı`);
        continue;
      }

      const result = await geocodeInstitution(institution);
      if (result.success) {
        successCount += 1;
        await updateLocationSuccess(supabase, institutionId, result);
        console.log(
          `✅ #${institutionId}: (${result.lat.toFixed(6)}, ${result.lon.toFixed(6)}) | level=${result.level} | query="${result.query}"`,
        );
      } else {
        failedCount += 1;
        await updateLocationFailure(supabase, institutionId, result);
        console.log(
          `❌ #${institutionId}: ${result.reason} | last_level=${result.level ?? "-"}`,
        );
      }

      await sleep(SLEEP_MS);
    }
  }

  console.log("🎯 Nominatim geocode tamamlandı");
  console.log("• Toplam işlenen:", totalProcessed);
  console.log("• Başarılı:", successCount);
  console.log("• Başarısız:", failedCount);
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error("❌", error instanceof Error ? error.message : error);
    printHelp();
    process.exit(1);
  }

  if (args.help) {
    printHelp();
    return;
  }

  console.log(`▶️ mode=${args.mode}`);

  try {
    if (args.mode === "dry-run") {
      if (!args.state) throw new Error("--state zorunlu (depo dışı mutlak yol).");
      await modeDryRun(args);
      return;
    }
    if (args.mode === "submit") {
      if (!args.state) throw new Error("--state zorunlu (depo dışı mutlak yol).");
      await modeSubmit(args);
      return;
    }
    if (args.mode === "collect") {
      if (!args.state) throw new Error("--state zorunlu (depo dışı mutlak yol).");
      await modeCollect(args);
      return;
    }
    if (args.mode === "apply") {
      if (!args.state) throw new Error("--state zorunlu (depo dışı mutlak yol).");
      await modeApply(args);
      return;
    }
    if (args.mode === "nominatim") {
      await modeNominatim();
      return;
    }
    throw new Error(`İşlenmeyen mode: ${args.mode}`);
  } catch (error) {
    console.error("❌", redactSecrets(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

main();
