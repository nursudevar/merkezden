import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE_NAME = process.env.TABLE_NAME || "institutions";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_JSON_PATH = path.join(__dirname, "data", "tum_okullar_ankara.json");
const JSON_FILE = process.env.JSON_FILE || DEFAULT_JSON_PATH;

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 300);
const SLEEP_MS = Number(process.env.SLEEP_MS || 200);
const MAX_RETRY = Number(process.env.MAX_RETRY || 3);

const importTag = (() => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
    d.getHours()
  )}${pad(d.getMinutes())}`;
  return `meb_ankara_${stamp}`;
})();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ .env eksik: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeText(v) {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function buildExternalKey(okulAdi, ilce) {
  const name = normalizeText(okulAdi).toLocaleLowerCase("tr-TR");
  const dist = normalizeText(ilce).toLocaleLowerCase("tr-TR");
  return `${name} | ${dist}`;
}

function normalizePhone(v) {
  const s = normalizeText(v);
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;
  return s;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function upsertWithRetry(rows) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    const { error } = await supabase.from(TABLE_NAME).upsert(rows, {
      onConflict: "external_key",
    });

    if (!error) return;

    lastError = error;
    const backoff = 400 * attempt;
    console.warn(
      `⚠️ Batch hata aldı (deneme ${attempt}/${MAX_RETRY}). ${backoff}ms sonra tekrar...`
    );
    await sleep(backoff);
  }

  console.error("❌ Upsert başarısız. Son hata:", lastError);
  throw lastError;
}

async function main() {
  if (!fs.existsSync(JSON_FILE)) {
    console.error(`❌ JSON bulunamadı: ${JSON_FILE}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(JSON_FILE, "utf-8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    console.error("❌ JSON tek bir array değil: [ {..}, {..} ] olmalı");
    process.exit(1);
  }

  console.log("✅ Import başlıyor");
  console.log("• Tablo:", TABLE_NAME);
  console.log("• JSON:", JSON_FILE);
  console.log("• Kayıt sayısı:", data.length);
  console.log("• Batch size:", BATCH_SIZE);
  console.log("• Source tag (rollback):", importTag);

  const rows = data.map((item) => {
    const institution_name = normalizeText(item.okul_adi);
    const district = normalizeText(item.ilce);
    const city = normalizeText(item.il) || "ANKARA";
    const type = normalizeText(item.okul_turu);
    const address = normalizeText(item.adres);
    const official_phone = normalizePhone(item.telefon);

    return {
      institution_name,
      district,
      city,
      type,
      address,
      official_phone,
      source: importTag,
      host: "ookgm.meb.gov.tr",
      external_key: buildExternalKey(institution_name, district),
      is_active: true,
      last_updated_at: new Date().toISOString(),
    };
  });

  const emptyName = rows.filter((r) => !r.institution_name).length;
  const emptyDistrict = rows.filter((r) => !r.district).length;
  const emptyKey = rows.filter((r) => !r.external_key).length;

  if (emptyName || emptyDistrict || emptyKey) {
    console.warn(
      `⚠️ Uyarı: boş institution_name=${emptyName}, boş district=${emptyDistrict}, boş external_key=${emptyKey}`
    );
  }

  const batches = chunk(rows, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    await upsertWithRetry(batches[i]);
    console.log(`✅ Batch ${i + 1}/${batches.length} (+${batches[i].length})`);
    await sleep(SLEEP_MS);
  }

  console.log("\n🎉 Import tamamlandı!");
  console.log("📌 Rollback için source tag:", importTag);
  console.log(
    `\n🔍 Doğrulama SQL:\nSELECT COUNT(*) FROM ${TABLE_NAME} WHERE source = '${importTag}';\n`
  );
  console.log(
    `🧹 Rollback SQL:\nDELETE FROM ${TABLE_NAME} WHERE source = '${importTag}';\n`
  );
}

main().catch((e) => {
  console.error("❌ Beklenmeyen hata:", e);
  process.exit(1);
});
