import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DATA_YEAR = "2025";
const BATCH_SIZE = 500;
const PROVINCES_URL = `https://api.turkiyeapi.dev/v2/datasets/${DATA_YEAR}/provinces.json`;
const DISTRICTS_URL = `https://api.turkiyeapi.dev/v2/datasets/${DATA_YEAR}/districts.json`;
const NEIGHBORHOODS_URL = `https://api.turkiyeapi.dev/v2/datasets/${DATA_YEAR}/neighborhoods.json`;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Eksik ortam değişkeni: NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function describeError(error) {
  if (!error) return "bilinmeyen hata";
  if (typeof error === "string") return error;
  const parts = [error.message, error.details, error.hint, error.code].filter(Boolean);
  return parts.length > 0 ? parts.join(" | ") : String(error);
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function extractRecords(json, sourceLabel) {
  if (Array.isArray(json)) return json;

  if (json && typeof json === "object") {
    const candidates = [json.data, json.records, json.items, json.result, json.payload];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
      if (candidate && typeof candidate === "object" && Array.isArray(candidate.data)) {
        return candidate.data;
      }
    }
  }

  throw new Error(
    `${sourceLabel}: beklenmeyen response yapısı. Dizi veya data/records sarmalayıcısı bekleniyordu.`,
  );
}

async function fetchDataset(url, sourceLabel) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`${sourceLabel}: HTTP ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const records = extractRecords(json, sourceLabel);
  if (records.length === 0) {
    throw new Error(`${sourceLabel}: kayıt listesi boş.`);
  }
  return records;
}

function mapProvince(row) {
  const id = asNumber(row?.id);
  const ad = asText(row?.name);
  const slug = asText(row?.slug);
  if (id == null || !ad || !slug) return null;
  return { id, ad, slug, veri_surumu: DATA_YEAR };
}

function mapDistrict(row) {
  const id = asNumber(row?.id);
  const il_id = asNumber(row?.provinceId ?? row?.province_id);
  const ad = asText(row?.name);
  const slug = asText(row?.slug);
  if (id == null || il_id == null || !ad || !slug) return null;
  return { id, il_id, ad, slug, veri_surumu: DATA_YEAR };
}

function mapNeighborhood(row) {
  const id = asNumber(row?.id);
  const il_id = asNumber(row?.provinceId ?? row?.province_id);
  const ilce_id = asNumber(row?.districtId ?? row?.district_id);
  const ad = asText(row?.name);
  const slug = asText(row?.slug);
  if (id == null || il_id == null || ilce_id == null || !ad || !slug) return null;
  return {
    id,
    il_id,
    ilce_id,
    belediye_id: asNumber(row?.municipalityId ?? row?.municipality_id),
    ad,
    slug,
    posta_kodu: asText(row?.postalCode ?? row?.postal_code),
    posta_kodu_durumu: asText(row?.postalCodeStatus ?? row?.postal_code_status),
    veri_surumu: DATA_YEAR,
  };
}

function uniqueById(rows, label) {
  const seen = new Map();
  for (const row of rows) {
    if (!seen.has(row.id)) seen.set(row.id, row);
  }
  if (seen.size !== rows.length) {
    console.warn(`${label}: tekrarlayan id'ler elendi (${rows.length} → ${seen.size}).`);
  }
  return Array.from(seen.values());
}

async function upsertBatches(table, rows, label) {
  const batches = chunk(rows, BATCH_SIZE);
  let upserted = 0;

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const { error } = await supabase.from(table).upsert(batch, { onConflict: "id" });
    if (error) {
      console.error(
        `Hata | tablo=${table} | batch=${i + 1}/${batches.length} | kayıt=${batch.length} | ${describeError(error)}`,
      );
      process.exit(1);
    }
    upserted += batch.length;
    console.log(`${label} batch ${i + 1}/${batches.length} tamamlandı (${batch.length} kayıt).`);
  }

  return upserted;
}

async function countTable(table) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) {
    throw new Error(`${table} satır sayısı alınamadı: ${describeError(error)}`);
  }
  return count ?? 0;
}

async function main() {
  console.log("TurkiyeAPI konum datasetleri indiriliyor...");

  const provinceRecords = await fetchDataset(PROVINCES_URL, "İller");
  const districtRecords = await fetchDataset(DISTRICTS_URL, "İlçeler");
  const neighborhoodRecords = await fetchDataset(NEIGHBORHOODS_URL, "Mahalleler");

  console.log(`İller API kayıt sayısı: ${provinceRecords.length}`);
  console.log(`İlçeler API kayıt sayısı: ${districtRecords.length}`);
  console.log(`Mahalleler API kayıt sayısı: ${neighborhoodRecords.length}`);

  const iller = uniqueById(provinceRecords.map(mapProvince).filter(Boolean), "İller");
  const ilceler = uniqueById(districtRecords.map(mapDistrict).filter(Boolean), "İlçeler");
  const mahalleler = uniqueById(
    neighborhoodRecords.map(mapNeighborhood).filter(Boolean),
    "Mahalleler",
  );

  if (iller.length === 0) throw new Error("İller: eşlenen geçerli kayıt yok.");
  if (ilceler.length === 0) throw new Error("İlçeler: eşlenen geçerli kayıt yok.");
  if (mahalleler.length === 0) throw new Error("Mahalleler: eşlenen geçerli kayıt yok.");

  if (iller.length !== provinceRecords.length) {
    throw new Error(`İller: API ${provinceRecords.length} kayıt, eşlenen ${iller.length}.`);
  }
  if (ilceler.length !== districtRecords.length) {
    throw new Error(`İlçeler: API ${districtRecords.length} kayıt, eşlenen ${ilceler.length}.`);
  }
  if (mahalleler.length !== neighborhoodRecords.length) {
    throw new Error(
      `Mahalleler: API ${neighborhoodRecords.length} kayıt, eşlenen ${mahalleler.length}.`,
    );
  }

  const illerAktarilan = await upsertBatches("iller", iller, "İller");
  const ilcelerAktarilan = await upsertBatches("ilceler", ilceler, "İlçeler");
  const mahallelerAktarilan = await upsertBatches("mahalleler", mahalleler, "Mahalleler");

  const illerDb = await countTable("iller");
  const ilcelerDb = await countTable("ilceler");
  const mahallelerDb = await countTable("mahalleler");

  console.log(`İller API kayıt sayısı: ${provinceRecords.length}`);
  console.log(`İller aktarıldı: ${illerAktarilan}`);
  console.log(`İlçeler API kayıt sayısı: ${districtRecords.length}`);
  console.log(`İlçeler aktarıldı: ${ilcelerAktarilan}`);
  console.log(`Mahalleler API kayıt sayısı: ${neighborhoodRecords.length}`);
  console.log(`Mahalleler aktarıldı: ${mahallelerAktarilan}`);
  console.log(`Supabase iller satır sayısı: ${illerDb}`);
  console.log(`Supabase ilceler satır sayısı: ${ilcelerDb}`);
  console.log(`Supabase mahalleler satır sayısı: ${mahallelerDb}`);

  const missing = [];
  if (illerDb !== provinceRecords.length) missing.push(`iller (${illerDb}/${provinceRecords.length})`);
  if (ilcelerDb !== districtRecords.length) {
    missing.push(`ilceler (${ilcelerDb}/${districtRecords.length})`);
  }
  if (mahallelerDb !== neighborhoodRecords.length) {
    missing.push(`mahalleler (${mahallelerDb}/${neighborhoodRecords.length})`);
  }

  if (missing.length > 0) {
    console.error(`Eksik kayıt: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log("Konum import işlemi başarıyla tamamlandı.");
}

main().catch((error) => {
  console.error(describeError(error));
  process.exit(1);
});
