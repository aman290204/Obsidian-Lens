#!/usr/bin/env node
/**
 * Obsidian Lens — NVIDIA NIM Model Test Suite
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests every configured NIM model endpoint with verified IDs.
 * Last verified: 2026-04-16 against https://integrate.api.nvidia.com/v1/models
 *
 * Usage:
 *   npm run test:models
 *   node scripts/test-nim-models.mjs
 *
 * Requires Node.js 18+ (built-in fetch).
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Parse .env.local ─────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = join(ROOT, '.env.local');
  if (!existsSync(envPath)) {
    console.error('❌  .env.local not found. Copy .env.local.example and fill in your keys.');
    process.exit(1);
  }
  const env = {};
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('=');
    if (eq === -1) return;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    env[k] = v;
  });
  return env;
}

const ENV = loadEnv();

// ── Build key list ───────────────────────────────────────────────────────────
function collectKeys() {
  const seen = new Set(), keys = [];
  const bulk = ENV['NVIDIA_NIM_API_KEYS'] || '';
  if (bulk) bulk.split(',').map(k => k.trim()).filter(k => k.startsWith('nvapi-')).forEach(k => { if (!seen.has(k)) { seen.add(k); keys.push(k); } });
  for (let i = 1; i <= 10; i++) {
    const k = (ENV[`NVIDIA_API_KEY_${i}`] || '').trim();
    if (k.startsWith('nvapi-') && !seen.has(k)) { seen.add(k); keys.push(k); }
  }
  return keys;
}

const BASE    = ENV['NVIDIA_NIM_BASE_URL'] || 'https://integrate.api.nvidia.com/v1';
const NVCF    = ENV['NVIDIA_NVCF_URL']     || 'https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions';
const KEYS    = collectKeys();

// ── VERIFIED model IDs from GET /v1/models (2026-04-16) ─────────────────────
const MODELS = {
  llmPrimary:      ENV['NIM_LLM_PRIMARY']         || 'qwen/qwen3.5-122b-a10b',
  llmFallback:     ENV['NIM_LLM_FALLBACK']         || 'meta/llama-3.3-70b-instruct',
  llmIndian:       ENV['NIM_LLM_INDIAN_LANG']      || 'sarvamai/sarvam-m',
  ttsPrimaryId:    ENV['NIM_TTS_PRIMARY']           || 'magpie-tts-multilingual',
  ttsFallbackId:   ENV['NIM_TTS_FALLBACK']          || 'nvidia/riva-tts',
  ttsPrimaryFnId:  ENV['NIM_TTS_PRIMARY_FN_ID']     || '',
  ttsFallbackFnId: ENV['NIM_TTS_FALLBACK_FN_ID']    || '',
  avatar:          ENV['NIM_AVATAR']                || 'audio2face-3d',
};

// ── Terminal colours ─────────────────────────────────────────────────────────
const C = { reset:'\x1b[0m', bold:'\x1b[1m', green:'\x1b[32m', red:'\x1b[31m', yellow:'\x1b[33m', cyan:'\x1b[36m', dim:'\x1b[2m' };
const ok   = m => console.log(`  ${C.green}✓${C.reset} ${m}`);
const fail = m => console.log(`  ${C.red}✗${C.reset} ${m}`);
const warn = m => console.log(`  ${C.yellow}⚠${C.reset} ${m}`);
const info = m => console.log(`  ${C.cyan}ℹ${C.reset} ${m}`);
const sec  = t => `${C.bold}${C.cyan}───── ${t} ${'─'.repeat(Math.max(0,54-t.length))}${C.reset}`;

// ── Request helper ───────────────────────────────────────────────────────────
async function post(url, body, key, extraHeaders = {}, timeoutMs = 45_000) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${key}`, ...extraHeaders },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { r, ms: Date.now()-t0, ok: r.ok, status: r.status };
  } catch(e) {
    return { r: null, ms: Date.now()-t0, ok: false, status: 0, err: e.message };
  }
}

// ── Key auth probe ───────────────────────────────────────────────────────────
async function testKey(key) {
  console.log(`\n${sec(`Key: …${key.slice(-8)}`)} `);
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}/models`, { headers:{Authorization:`Bearer ${key}`}, signal: AbortSignal.timeout(10_000) });
    const ms = Date.now()-t0;
    if (r.status===200)      { ok(`Auth valid (${ms}ms)`); return true; }
    else if (r.status===401) { fail(`Unauthorized — key invalid/revoked (${ms}ms)`); return false; }
    else                     { warn(`HTTP ${r.status} (${ms}ms)`); return false; }
  } catch(e) { fail(`Network error: ${e.message}`); return false; }
}

// ── LLM test ─────────────────────────────────────────────────────────────────
async function testLLM(name, model, key) {
  console.log(`\n${sec(`LLM ${name}: ${model}`)}`);
  // Large models (deepseek-v3.2 ~671B params) can take 60–90s on cold starts
  const timeoutMs = model.includes('deepseek') ? 90_000 : 45_000;

  const { r, ms, ok:isOk, status, err } = await post(`${BASE}/chat/completions`, {
    model,
    messages: [
      { role:'system', content:'Reply only in valid JSON. No markdown, no explanation.' },
      { role:'user',   content:'Return: {"status":"ok","model":"working"}' },
    ],
    temperature: 0,
    max_tokens: 50,
    // json_object mode only for models that support it (not deepseek)
    ...(!model.includes('deepseek') ? { response_format:{ type:'json_object' } } : {}),
  }, key, {}, timeoutMs);


  if (err)  { fail(`Network: ${err}`); return false; }
  if (isOk) {
    const j = await r.json().catch(()=>null);
    const content = j?.choices?.[0]?.message?.content || '';
    ok(`HTTP ${status} — ${ms}ms`);
    info(`Output: ${content.slice(0,100)}`);
    info(`Tokens: prompt=${j?.usage?.prompt_tokens} completion=${j?.usage?.completion_tokens}`);
    return true;
  } else {
    const txt = await r.text().catch(()=>'');
    fail(`HTTP ${status} — ${ms}ms — ${txt.slice(0,200)}`);
    if (status===410) warn(`Model EOL — update NIM_LLM_FALLBACK in .env.local`);
    if (status===404) warn(`Model not found — verify at https://build.nvidia.com`);
    return false;
  }
}

// ── TTS test (NVCF endpoint) ─────────────────────────────────────────────────
async function testTTS(name, modelId, fnId, key) {
  console.log(`\n${sec(`TTS ${name}: ${modelId}`)}`);

  if (!fnId) {
    warn(`NIM_TTS_${name.toUpperCase()}_FN_ID not set in .env.local`);
    info(`Get the function UUID from: https://build.nvidia.com/nvidia/${modelId}`);
    info(`Click "Get API Key" → copy the function-id from the curl snippet`);
    info(`Then add: NIM_TTS_${name.toUpperCase()}_FN_ID=<uuid> to .env.local`);
    return null; // skipped — not configured
  }

  const { r, ms, ok:isOk, status, err } = await post(
    `${NVCF}/${fnId}`,
    { text:'Hello from Obsidian Lens.', voice:'en-US-female-1', language:'en-US' },
    key,
    { Accept:'audio/wav, audio/mpeg, */*' }
  );

  if (err)  { fail(`Network: ${err}`); return false; }
  if (isOk) {
    const ct  = r.headers.get('content-type') || '';
    const buf = await r.arrayBuffer().catch(()=>null);
    ok(`HTTP ${status} — ${ms}ms`);
    info(`Content-Type: ${ct}`);
    info(`Audio: ${buf ? ((buf.byteLength/1024).toFixed(1)+' KB') : 'N/A'}`);
    return true;
  } else {
    const txt = await r.text().catch(()=>'');
    fail(`HTTP ${status} — ${ms}ms — ${txt.slice(0,300)}`);
    return false;
  }
}

// ── Avatar (informational only — gRPC service) ───────────────────────────────
function noteAvatar() {
  console.log(`\n${sec('Avatar: audio2face-3d')}`);
  warn(`Audio2Face-3D is a gRPC streaming service — REST endpoint not available.`);
  info(`Integration path: self-host NIM container → gRPC port 52000`);
  info(`Python sample:    https://github.com/NVIDIA/Audio2Face-3D-Samples`);
  info(`NIM docs:         https://docs.nvidia.com/nim/audio2face-3d/latest/`);
}

// ── Available models cross-check ─────────────────────────────────────────────
async function crossCheckModels(key) {
  console.log(`\n${sec('Model Cross-Check (GET /v1/models)')}`);
  try {
    const r = await fetch(`${BASE}/models`, { headers:{Authorization:`Bearer ${key}`}, signal: AbortSignal.timeout(10_000) });
    const j = await r.json().catch(()=>({data:[]}));
    const ids = (j.data||[]).map(m=>m.id);

    const check = (id, label) => {
      if (ids.includes(id)) ok(`${label.padEnd(30)} → AVAILABLE  (${id})`);
      else                  fail(`${label.padEnd(30)} → NOT FOUND  (${id})`);
    };

    check(MODELS.llmPrimary,  'LLM Primary');
    check(MODELS.llmFallback, 'LLM Fallback');
    check(MODELS.llmIndian,   'LLM Indian-Lang');
    // TTS models are on NVCF, not /v1/models — informational
    info(`TTS Primary  (NVCF): ${MODELS.ttsPrimaryId}${MODELS.ttsPrimaryFnId ? ' — fn-id set ✓' : ' — fn-id NOT SET'}`);
    info(`TTS Fallback (NVCF): ${MODELS.ttsFallbackId}${MODELS.ttsFallbackFnId ? ' — fn-id set ✓' : ' — fn-id NOT SET'}`);

    // Also show which recommended models are available
    console.log(`\n  ${C.dim}─── Recommended Indian-language models on NIM ───${C.reset}`);
    ['sarvamai/sarvam-m', 'nvidia/riva-translate-4b-instruct-v1.1'].forEach(id => {
      if (ids.includes(id)) info(`${id} — available (could be used for Indian TTS/ASR)`);
    });

  } catch(e) { fail(`Could not fetch model list: ${e.message}`); }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.cyan}╔════════════════════════════════════════════════════════╗`);
  console.log(`║   Obsidian Lens — NVIDIA NIM Model Test Suite   v2.0  ║`);
  console.log(`╚════════════════════════════════════════════════════════╝${C.reset}`);
  console.log(`\n  Base URL : ${BASE}`);
  console.log(`  NVCF URL : ${NVCF}`);
  console.log(`  Keys     : ${KEYS.length} found`);
  KEYS.forEach((k,i) => console.log(`    [${i+1}] nvapi-...${k.slice(-8)}`));

  if (!KEYS.length) { fail('No API keys — set NVIDIA_NIM_API_KEYS in .env.local'); process.exit(1); }

  const key = KEYS[0];
  const r = { passed:0, failed:0, skipped:0 };

  // 1 ── Key auth
  for (const k of KEYS) {
    const p = await testKey(k);
    p ? r.passed++ : r.failed++;
  }

  // 2 ── Model cross-check
  await crossCheckModels(key);

  // 3 ── LLM
  for (const [n, m] of [['Primary', MODELS.llmPrimary], ['Fallback', MODELS.llmFallback]]) {
    const p = await testLLM(n, m, key);
    p ? r.passed++ : r.failed++;
  }

  // 4 ── TTS
  for (const [n, id, fnId] of [
    ['Primary',  MODELS.ttsPrimaryId,  MODELS.ttsPrimaryFnId],
    ['Fallback', MODELS.ttsFallbackId, MODELS.ttsFallbackFnId],
  ]) {
    if (!fnId) {
      info(`TTS ${n} (NVCF): undefined — fn-id NOT SET`);
      r.skipped++;
      continue;
    }
    const p = await testTTS(n, id, fnId, key);
    if (p === null) r.skipped++; else p ? r.passed++ : r.failed++;
  }

  // 5 ── Avatar
  noteAvatar();
  r.skipped++;

  // Summary
  console.log(`\n${sec('Summary')}`);
  console.log(`\n  ${C.green}Passed : ${r.passed}${C.reset}`);
  console.log(`  ${C.red}Failed : ${r.failed}${C.reset}`);
  console.log(`  ${C.yellow}Skipped: ${r.skipped}${C.reset}`);

  if (r.failed === 0) {
    console.log(`\n  ${C.bold}${C.green}✅  All critical models responding correctly.${C.reset}\n`);
  } else {
    console.log(`\n  ${C.bold}${C.red}❌  ${r.failed} test(s) failed.${C.reset}`);
    process.exit(1);
  }
}

main().catch(e => { console.error(`\n${C.red}Fatal:${C.reset}`, e.message); process.exit(1); });
