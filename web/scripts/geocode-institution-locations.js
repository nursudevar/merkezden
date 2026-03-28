import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BATCH_SIZE = Number(process.env.GEOCODE_BATCH_SIZE || 100);
const SLEEP_MS = Number(process.env.GEOCODE_SLEEP_MS || 1200);
const NOMINATIM_BASE_URL =
  process.env.GEOCODER_BASE_URL || "https://nominatim.openstreetmap.org/search";
const NOMINATIM_EMAIL = process.env.GEOCODER_EMAIL || "";
const USER_AGENT =
  process.env.GEOCODER_USER_AGENT || "merkezden-geocoder/1.0 (contact: support@merkezden.com)";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ .env eksik: NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      .replace(/\bAPARTMANI\b/gi, "")
      .replace(/\bSITESI\b/gi, "")
      .replace(/\bSİTESİ\b/gi, "")
      .replace(/\bBLOK\b/gi, "")
      .replace(/\s*,\s*/g, ", ")
      .replace(/\s+/g, " ")
  );
}

function detectNeighborhood(value) {
  const text = normalizeText(value);
  const match = text.match(/([a-zA-ZçğıöşüÇĞİÖŞÜ0-9\s-]+?)\s+Mahallesi\b/u);
  if (!match) return "";
  return toTurkishTitleCase(`${normalizeText(match[1])} Mahallesi`);
}

function buildGeocodeQueries(institution) {
  const institutionName = toTurkishTitleCase(institution.institution_name);
  const address = normalizeTurkishAddress(institution.address);
  const district = toTurkishTitleCase(institution.district);
  const city = toTurkishTitleCase(institution.city);

  const normalizedFullAddress = normalizeTurkishAddress(
    [address, district, city].filter(Boolean).join(", ")
  );
  const strippedFullAddress = normalizeTurkishAddress(
    stripNoisyAddressWords([address, district, city].filter(Boolean).join(", "))
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

async function fetchPendingRows(offset) {
  const { data, error } = await supabase
    .from("institution_locations")
    .select("institution_id")
    .eq("geocode_status", "pending")
    .order("institution_id", { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1);

  if (error) throw error;

  return (data || [])
    .map((row) => Number(row.institution_id))
    .filter((id) => Number.isFinite(id));
}

async function fetchInstitutionsByIds(ids) {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("institutions")
    .select("id, institution_name, address, district, city")
    .in("id", ids);

  if (error) throw error;
  return data || [];
}

async function updateLocationSuccess(institutionId, payload) {
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
    .eq("institution_id", institutionId);

  if (error) throw error;
}

async function updateLocationFailure(institutionId, payload) {
  const { error } = await supabase
    .from("institution_locations")
    .update({
      geocode_status: "failed",
      geocode_error: payload.reason,
      geocoded_query: payload.query,
      geocoded_at: new Date().toISOString(),
    })
    .eq("institution_id", institutionId);

  if (error) throw error;
}

async function main() {
  console.log("✅ Institution geocode script başladı");
  console.log("• Batch size:", BATCH_SIZE);
  console.log("• Sleep ms:", SLEEP_MS);
  console.log("• Geocoder:", NOMINATIM_BASE_URL);

  let totalProcessed = 0;
  let successCount = 0;
  let failedCount = 0;
  let offset = 0;

  while (true) {
    const pendingIds = await fetchPendingRows(offset);
    if (pendingIds.length === 0) break;

    const institutions = await fetchInstitutionsByIds(pendingIds);
    const institutionById = new Map(
      institutions.map((institution) => [Number(institution.id), institution])
    );

    for (const institutionId of pendingIds) {
      totalProcessed += 1;

      const institution = institutionById.get(institutionId);
      if (!institution) {
        failedCount += 1;
        await updateLocationFailure(institutionId, {
          reason: "Institutions tablosunda eşleşen kayıt bulunamadı",
          query: null,
        });
        console.log(`❌ #${institutionId}: institutions kaydı bulunamadı`);
        continue;
      }

      const result = await geocodeInstitution(institution);
      if (result.success) {
        successCount += 1;
        await updateLocationSuccess(institutionId, result);
        console.log(
          `✅ #${institutionId}: (${result.lat.toFixed(6)}, ${result.lon.toFixed(6)}) | level=${result.level} | query="${result.query}"`
        );
      } else {
        failedCount += 1;
        await updateLocationFailure(institutionId, result);
        console.log(`❌ #${institutionId}: ${result.reason} | last_level=${result.level ?? "-"}`);
      }

      await sleep(SLEEP_MS);
    }

    offset += pendingIds.length;
  }

  console.log("🎯 Geocode tamamlandı");
  console.log("• Toplam işlenen:", totalProcessed);
  console.log("• Başarılı:", successCount);
  console.log("• Başarısız:", failedCount);
}

main().catch((error) => {
  console.error("❌ Beklenmeyen hata:", error);
  process.exit(1);
});

