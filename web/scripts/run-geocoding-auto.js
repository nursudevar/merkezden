/**
 * Merkezden bulk Geoapify orchestrator (Node >=18, no extra packages).
 * Usage (from web/):
 *   node scripts/run-geocoding-auto.js --import-states=/tmp/old-a.json,/tmp/old-b.json
 *   node scripts/run-geocoding-auto.js --execute --once
 *   node scripts/run-geocoding-auto.js --execute --continuous
 *
 * Default without --execute: import history and show status; no API/DB writes.
 * Completed historical raw results are reused by the core and revalidated per institution.
 * Execute explicitly authorizes apply of every decision=accept; never approve rejects.
 * A submit of unknown outcome stops for manual reconciliation, never auto-retries.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORE = path.join(WEB, 'scripts', 'geocode-institution-locations.js');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// UTC daily accounting is an approximation of Geoapify's dashboard calendar buckets.
// The provider does not expose live usage through this script. We keep a reserve
// for polling and deliberately count legacy reservations at their full amount.
const DAY_MS = 24 * 60 * 60 * 1000;
const POLL_RESERVE = 140; // up to 120 normal polls plus margin for retries/requests
const BATCH_INPUT_CREDIT = 0.5;
function utcDay(timestamp) { return new Date(timestamp).toISOString().slice(0, 10); }
function nextUtcDay(timestamp) {
  return Date.parse(`${utcDay(timestamp)}T00:00:00.000Z`) + DAY_MS;
}
function plannedCost(unique) {
  return unique > 0 ? Math.ceil(unique * BATCH_INPUT_CREDIT) + POLL_RESERVE : 0;
}
function options(argv) {
  const out = { execute: false, continuous: false, once: false, maxNew: 800, dailyBudget: 1800,
    workdir: path.join(os.homedir(), '.merkezden-geocoding'), imports: [], city: '', replacePreview: false };
  for (const arg of argv) {
    if (arg === '--execute') out.execute = true;
    else if (arg === '--replace-preview') out.replacePreview = true;
    else if (arg.startsWith('--city=')) out.city = arg.slice(7).trim();
    else if (arg === '--continuous') out.continuous = true;
    else if (arg === '--once') out.once = true;
    else if (arg.startsWith('--workdir=')) out.workdir = path.resolve(arg.slice(10));
    else if (arg.startsWith('--import-states=')) out.imports.push(...arg.slice(16).split(',').filter(Boolean));
    else if (arg.startsWith('--max-new=')) out.maxNew = Number(arg.slice(10));
    else if (arg.startsWith('--daily-budget=')) out.dailyBudget = Number(arg.slice(15));
    else if (arg === '--help') { console.log('Flags: --import-states=path1,path2 --execute [--once|--continuous] [--max-new=800] [--daily-budget=2700] [--city=İSTANBUL] [--replace-preview] [--workdir=/absolute/path]'); process.exit(0); }
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!Number.isSafeInteger(out.maxNew) || out.maxNew < 1 || out.maxNew > 1000) throw new Error('--max-new must be 1..1000');
  if (!Number.isSafeInteger(out.dailyBudget) || out.dailyBudget < 50) throw new Error('--daily-budget must be >= 50');
  if (out.replacePreview && out.execute) throw new Error('--replace-preview only allowed in preview mode (without --execute)');
  if (out.once && out.continuous) throw new Error('Choose --once OR --continuous');
  return out;
}
function read(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function save(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, p);
}
function callCore(args) {
  console.log(`\n▶ ${args.find(x => x.startsWith('--mode='))}`);
  const res = spawnSync(process.execPath, [CORE, ...args], { cwd: WEB, stdio: 'inherit' });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`Core script failed (status=${res.status}; signal=${res.signal || '-'}).`);
}
function verifyCompleted(state, source) {
  if (!Array.isArray(state.jobs) || !state.jobs.length) throw new Error(`Imported state has no jobs: ${source}`);
  for (const job of state.jobs) {
    if (job.status !== 'completed' || !Array.isArray(job.evaluations))
      throw new Error(`Import unfinished, collect/apply original job first: ${source}`);
  }
  if (state.report?.phase !== 'apply') throw new Error(`Import not applied (phase=${state.report?.phase}): ${source}`);
  if (state.report?.failedUpdates > 0) throw new Error(`Imported state has failed updates: ${source}`);
}
function importStates(opts, db) {
  for (const raw of opts.imports) {
    const src = path.resolve(raw);
    const contents = fs.readFileSync(src);
    const hash = crypto.createHash('sha256').update(contents).digest('hex').slice(0, 16);
    const dest = path.join(opts.workdir, 'imported', `${hash}.json`);
    const state = JSON.parse(contents.toString('utf8'));
    verifyCompleted(state, src);
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
      fs.copyFileSync(src, dest, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(dest, 0o600);
    }
    if (!db.imported.includes(dest)) db.imported.push(dest);
    console.log(`Imported: ${path.basename(src)}`);
  }
}
function allPriors(db) { return [...db.imported, ...db.completed]; }
function coreArgs(opts, statePath, db, mode) {
  const args = [`--mode=${mode}`, `--state=${statePath}`];
  if (mode === 'dry-run' || mode === 'submit') {
    args.push('--primary-simplified', `--max-new=${opts.maxNew}`);
    if (opts.city) args.push(`--city=${opts.city}`);
    const prior = allPriors(db);
    if (prior.length) args.push(`--prior-states=${prior.join(',')}`);
  }
  return args;
}
function stage(db, name, status) { db.current = { path: name, status }; }
function reserve(db, cost) {
  db.credits.push({ at: Date.now(), cost, accounting: 'utc-batch-v2' });
}
function budgetStatus(db, needed, budget, now = Date.now()) {
  const day = utcDay(now);
  // Legacy entries are NOT discounted retroactively: no proof of their real usage.
  // Entries from other UTC days are kept in the manifest for audit but not charged today.
  const today = (db.credits || []).filter(c =>
    Number.isFinite(c.at) && Number.isFinite(c.cost) && utcDay(c.at) === day
  );
  const reserved = today.reduce((sum, item) => sum + item.cost, 0);
  const available = Math.max(0, budget - reserved);
  return {
    day, reserved, available, needed,
    canSubmit: needed <= available,
    nextAttempt: nextUtcDay(now) + 60_000,
    legacyCount: today.filter(item => !item.accounting).length,
  };
}
async function waitUntilBudgetRefresh(until) {
  // Short sleeps allow the process to wake reliably after machine sleep and
  // avoid one giant multi-hour timer; no API request while waiting.
  while (Date.now() < until) {
    await sleep(Math.min(60_000, Math.max(1000, until - Date.now())));
  }
}
async function main() {
  const opts = options(process.argv.slice(2));
  if (!fs.existsSync(CORE)) throw new Error(`Core script not found: ${CORE}`);
  fs.mkdirSync(opts.workdir, { recursive: true, mode: 0o700 });
  const manifestPath = path.join(opts.workdir, 'manifest.json');
  const lockPath = path.join(opts.workdir, '.lock');
  let lock;
  try { lock = fs.openSync(lockPath, 'wx', 0o600); }
  catch { throw new Error(`Another run may be active or stale lock exists: ${lockPath}. Verify no runner active first.`); }
  const release = () => { try { fs.closeSync(lock); fs.unlinkSync(lockPath); } catch {} };
  // Leave the lock on abrupt interruption; the child may still be running.
  // Remove it manually only after confirming no geocoder process is alive.
  const onSignal = () => { console.error('Interrupted. Verify no child process is active before clearing the lock.'); process.exit(130); };
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  try {
    const db = fs.existsSync(manifestPath) ? read(manifestPath) : {
      version: 1, imported: [], completed: [], credits: [], nextId: 1, current: null,
    };
    importStates(opts, db);
    if (opts.replacePreview) {
      if (!db.current || db.current.status !== 'ready') throw new Error('Only an existing ready preview can be replaced.');
      const old = read(db.current.path);
      if (Array.isArray(old.jobs) && old.jobs.length) throw new Error('Preview has submitted jobs; cannot replace.');
      // Never delete or overwrite an older preview/state. Only move manifest pointer.
      db.previousPreviews = [...(db.previousPreviews || []), db.current.path];
      db.current = null;
      console.log('Previous preview preserved; creating a new preview with updated scope.');
    }
    if (db.current && db.current.status === 'ready') {
      const prevCity = db.current.city || '';
      if (prevCity !== opts.city || db.current.maxNew !== opts.maxNew)
        throw new Error(`Existing preview scope is city=${prevCity || 'ALL'}, max-new=${db.current.maxNew}. Use --replace-preview (without --execute) to create a new preview.`);
    }
    const persist = () => save(manifestPath, db);
    persist();
    console.log(`Workdir: ${opts.workdir}`);
    console.log(`History: ${allPriors(db).length} states; completed this run: ${db.completed.length}; current: ${db.current?.status || '-'}`);
    if (!opts.execute) {
      if (!db.current) {
        const preview = path.join(opts.workdir, 'jobs', `job-${String(db.nextId++).padStart(5,'0')}.json`);
        stage(db, preview, 'preparing'); persist();
      }
      if (db.current.status === 'preparing') {
        callCore(coreArgs(opts, db.current.path, db, 'dry-run'));
        db.current.maxNew = opts.maxNew;
        db.current.city = opts.city;
        db.current.priorPaths = allPriors(db);
        db.current.status = 'ready'; persist();
      }
      console.log('Preview ready. No Geoapify requests or DB writes. Inspect state report before --execute.');
      return;
    }
    if (allPriors(db).length === 0 && !db.current) {
      throw new Error('No existing history imported. Supply --import-states=... first to avoid re-submitting old rejected addresses.');
    }
    let count = 0;
    while (true) {
      if (!db.current) {
        const p = path.join(opts.workdir, 'jobs', `job-${String(db.nextId++).padStart(5,'0')}.json`);
        stage(db, p, 'preparing'); persist();
      }
      const cur = db.current;
      if (cur.status === 'preparing') {
        callCore(coreArgs(opts, cur.path, db, 'dry-run'));
        cur.maxNew = opts.maxNew;
        cur.city = opts.city;
        cur.priorPaths = allPriors(db);
        cur.status = 'ready'; persist();
      }
      const state = read(cur.path);
      if (cur.status === 'ready') {
        // A preview must be submitted with the same candidate scope and prior history.
        // Otherwise the POST may contain a different set than the inspected dry-run.
        if ((cur.city || '') !== opts.city) throw new Error('Preview city changed; regenerate preview using --replace-preview without --execute.');
        if (cur.maxNew != null && cur.maxNew !== opts.maxNew)
          throw new Error(`Preview used --max-new=${cur.maxNew}; rerun with that value or regenerate the preview.`);
        if (cur.priorPaths && JSON.stringify(cur.priorPaths) !== JSON.stringify(allPriors(db)))
          throw new Error('History changed since preview; review and regenerate the preview before submitting.');
        const unique = Number(state.report?.planFreshQueryCount);
        if (!Number.isFinite(unique) || unique < 0 || unique > 1000) throw new Error('Invalid dry-run plan count');
        if (unique === 0 && Number(state.report?.planCachedQueryCount || 0) === 0) {
          console.log('✅ No eligible new addresses remain. Done.');
          db.current = null; persist(); break;
        }
        // Batch: ~0.5 per address plus a conservative polling reserve.
        // Never infer live Geoapify remaining credits from this local ledger.
        const cost = plannedCost(unique);
        if (cost > opts.dailyBudget) throw new Error(`Planned job (${cost} reserved credits) exceeds daily budget (${opts.dailyBudget}). Increase budget or lower --max-new.`);
        const budget = budgetStatus(db, cost, opts.dailyBudget);
        console.log(`💳 UTC ${budget.day}: local reserved ${budget.reserved}/${opts.dailyBudget}; next job estimate ${cost} (new addresses=${unique}, polling reserve=${POLL_RESERVE}).`);
        if (budget.legacyCount) console.log(`ℹ️ ${budget.legacyCount} legacy reservation(s) retained at original conservative cost for this UTC day.`);
        if (!budget.canSubmit) {
          console.log(`⏳ Local UTC-day budget reached; next possible attempt ${new Date(budget.nextAttempt).toISOString()}`);
          if (!opts.continuous) break;
          await waitUntilBudgetRefresh(budget.nextAttempt);
          continue;
        }
        reserve(db, cost);
        cur.expectedQueries = unique;
        cur.status = 'submitting'; persist(); // before any POST; never automatically retry unknown submit
        callCore([...coreArgs(opts, cur.path, db, 'submit'), `--expected-fresh=${unique}`]);
        cur.status = 'submitted'; persist();
      }
      if (cur.status === 'submitting') {
        // Recovery without re-POST is safe only if all requested inputs have
        // already been persisted in the state as a single job.
        const attempted = read(cur.path);
        const expected = Number(cur.expectedQueries);
        const jobs = attempted.jobs || [];
        if (jobs.some(j => !j.cacheReplay) && jobs.filter(j => !j.cacheReplay).reduce((n,j) => n + (j.inputs?.length || 0), 0) === expected) {
          console.log('Recovered fully persisted job without resubmitting.');
          cur.status = 'submitted'; persist();
        } else {
          throw new Error(`Submit outcome is uncertain for ${cur.path}. Do NOT re-submit. Inspect state and Geoapify dashboard; manually reconcile first.`);
        }
      }
      if (cur.status === 'submitted' || cur.status === 'collecting') {
        cur.status = 'collecting'; persist();
        callCore(coreArgs(opts, cur.path, db, 'collect'));
        cur.status = 'collected'; persist();
      }
      if (cur.status === 'collected' || cur.status === 'applying') {
        cur.status = 'applying'; persist();
        const collected = read(cur.path);
        const accepted = collected.jobs?.flatMap(j => j.evaluations || []).filter(e => e.decision === 'accept').length || 0;
        if (accepted) callCore([...coreArgs(opts, cur.path, db, 'apply'), '--confirm-apply', '--approve-all-accepted']);
        const applied = read(cur.path);
        if (accepted && (applied.report?.phase !== 'apply' || applied.report?.failedUpdates > 0))
          throw new Error('Apply incomplete/errors; inspect state before proceeding.');
        cur.status = 'finished'; persist();
      }
      if (cur.status !== 'finished') throw new Error(`Cannot automatically resume stage '${cur.status}'. Inspect ${cur.path}.`);
      const completed = read(cur.path);
      if (!completed.jobs?.every(j => j.status === 'completed' && Array.isArray(j.evaluations)))
        throw new Error('Cannot mark job complete: missing evaluations');
      db.completed.push(cur.path);
      db.current = null;
      persist();
      count++;
      console.log(`✅ Auto job ${count} finished. Total stored states: ${allPriors(db).length}`);
      if (opts.once) break;
    }
  } finally { release(); process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal); }
}
main().catch(e => { console.error('❌', e.message); process.exitCode = 1; });
