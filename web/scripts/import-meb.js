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
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");

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

function listJsonFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .map((f) => path.join(dir, f));
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
  
  const files = listJsonFiles(DATA_DIR);

  if (!files.length) {
    console.error(`❌ JSON bulunamadı: ${DATA_DIR} içinde .json yok`);
    process.exit(1);
  }

  console.log("✅ Import başlıyor");
  console.log("• Tablo:", TABLE_NAME);
  console.log("• Data klasörü:", DATA_DIR);
  console.log("• JSON dosya sayısı:", files.length);
  console.log("• Batch size:", BATCH_SIZE);
  console.log("• Source tag (rollback):", importTag);



  for (const filePath of files) {
    const fileName = path.basename(filePath);
    console.log("\n==============================");
    console.log("📦 Dosya:", fileName);
  
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
      console.error(`❌ JSON tek array değil: ${fileName}`);
      process.exit(1);
    }
  
    console.log("• Kayıt sayısı:", data.length);
  
    // Her dosya için ayrı source tag (rollback kolay olsun)
    const perFileTag = `${importTag}__${path.basename(fileName, ".json")}`;
    console.log("• Source tag:", perFileTag);
  
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
        source: perFileTag,
        host: "ookgm.meb.gov.tr",
        external_key: buildExternalKey(institution_name, district),
        is_active: true,
        last_updated_at: new Date().toISOString(),
      };
    });
  
    const batches = chunk(rows, BATCH_SIZE);
  
    for (let i = 0; i < batches.length; i++) {
      await upsertWithRetry(batches[i]);
      console.log(`✅ ${fileName} | Batch ${i + 1}/${batches.length} (+${batches[i].length})`);
      await sleep(SLEEP_MS);
    }
  
    console.log(`🎉 Dosya tamamlandı: ${fileName}`);
    console.log(`🔍 Doğrulama: SELECT COUNT(*) FROM ${TABLE_NAME} WHERE source='${perFileTag}';`);
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
