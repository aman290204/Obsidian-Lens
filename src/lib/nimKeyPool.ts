/**
 * NVIDIA NIM API Key Pool
 * ─────────────────────────────────────────────────────────────────────────────
 * Supports two env-var formats (both work simultaneously, deduped by key value):
 *
 *   Format 1 (comma-separated list):
 *     NVIDIA_NIM_API_KEYS="nvapi-xxx,nvapi-yyy,nvapi-zzz"
 *
 *   Format 2 (individual numbered keys):
 *     NVIDIA_API_KEY_1=nvapi-xxx
 *     NVIDIA_API_KEY_2=nvapi-yyy
 *
 * Key health states:
 *   HEALTHY  → actively used in round-robin rotation
 *   COOLING  → hit 429; paused for COOLDOWN_MS, then auto-recovered
 *   DEAD     → MAX_FAILURES consecutive errors; removed until process restart
 *
 * With 3 keys @ 35 RPM each = 105 RPM effective throughput.
 */

export type KeyHealth = 'HEALTHY' | 'COOLING' | 'DEAD';

interface ManagedKey {
  key:           string;
  health:        KeyHealth;
  failures:      number;
  cooldownUntil: number; // epoch ms — only meaningful when health === 'COOLING'
  requestCount:  number;
  lastUsed:      number;
}

const COOLDOWN_MS  = 60_000; // 1 min pause after 429
const MAX_FAILURES = 3;      // mark DEAD after N consecutive non-429 failures

// ── Key collection ──────────────────────────────────────────────────────────
function collectRawKeys(): string[] {
  const seen  = new Set<string>();
  const keys: string[] = [];

  // Format 1: NVIDIA_NIM_API_KEYS="key1,key2,key3"
  const bulk = process.env.NVIDIA_NIM_API_KEYS || '';
  if (bulk) {
    bulk
      .replace(/^["']|["']$/g, '') // strip surrounding quotes if any
      .split(',')
      .map(k => k.trim())
      .filter(k => k.startsWith('nvapi-'))
      .forEach(k => { if (!seen.has(k)) { seen.add(k); keys.push(k); } });
  }

  // Format 2: NVIDIA_API_KEY_1 … NVIDIA_API_KEY_10
  for (let i = 1; i <= 10; i++) {
    const k = (process.env[`NVIDIA_API_KEY_${i}`] || '').trim();
    if (k.startsWith('nvapi-') && !seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  }

  return keys;
}

function buildPool(): ManagedKey[] {
  const raw = collectRawKeys();

  if (raw.length === 0) {
    console.warn(
      '[NIM KeyPool] ⚠️  No valid API keys found.\n' +
      '  Set NVIDIA_NIM_API_KEYS="nvapi-..." in .env.local and restart.\n' +
      '  API calls will return 503 until at least one key is available.'
    );
    return [];
  }

  console.info(`[NIM KeyPool] Loaded ${raw.length} key(s). Estimated RPM: ${raw.length * 35}.`);
  return raw.map(key => ({
    key,
    health:        'HEALTHY',
    failures:      0,
    cooldownUntil: 0,
    requestCount:  0,
    lastUsed:      0,
  }));
}

// ── Singleton — lives for the lifetime of the Node.js process ───────────────
let _pool: ManagedKey[] | null = null;

function getPool(): ManagedKey[] {
  if (!_pool) _pool = buildPool();
  return _pool;
}

// ── Round-robin cursor ───────────────────────────────────────────────────────
// BUG FIX: previous implementation had `_cursor = _cursor % healthy.length`
// which reset the cursor relative to the healthy-subset size, causing the same
// key to be selected repeatedly when pool size shrinks. Now we just increment
// monotonically and take modulo at selection time only.
let _cursor = 0;

/**
 * Acquire the next healthy API key (round-robin).
 * Throws NIM_KEY_POOL_EXHAUSTED if no key is available.
 */
export function acquireKey(): string {
  const pool = getPool();
  const now  = Date.now();

  // Auto-recover COOLING keys whose cooldown window has elapsed
  pool.forEach(entry => {
    if (entry.health === 'COOLING' && now >= entry.cooldownUntil) {
      entry.health   = 'HEALTHY';
      entry.failures = 0;
      console.info(`[NIM KeyPool] Key …${entry.key.slice(-8)} recovered after cooldown.`);
    }
  });

  const healthy = pool.filter(e => e.health === 'HEALTHY');
  if (healthy.length === 0) {
    throw new Error(
      'NIM_KEY_POOL_EXHAUSTED: All API keys are cooling/dead. Retry in ~60 seconds.'
    );
  }

  // Pick next key in round-robin order; increment cursor monotonically
  const entry     = healthy[_cursor % healthy.length];
  _cursor         = (_cursor + 1); // intentionally NOT modulo — keeps rotation stable
  entry.requestCount++;
  entry.lastUsed  = now;
  return entry.key;
}

/**
 * Report a failed request. Updates key health accordingly.
 * @param key  The API key that failed.
 * @param code HTTP status code (429 → cooldown; ≥500 → failure counter; 0 → network error).
 */
export function reportFailure(key: string, code: number): void {
  const entry = getPool().find(e => e.key === key);
  if (!entry) return;

  if (code === 429) {
    entry.health        = 'COOLING';
    entry.cooldownUntil = Date.now() + COOLDOWN_MS;
    entry.failures      = 0; // reset — cooling is not the same as a hard failure
    console.warn(`[NIM KeyPool] Key …${key.slice(-8)} rate-limited → cooling for ${COOLDOWN_MS / 1000}s.`);
  } else {
    entry.failures++;
    console.warn(`[NIM KeyPool] Key …${key.slice(-8)} failure ${entry.failures}/${MAX_FAILURES} (HTTP ${code}).`);
    if (entry.failures >= MAX_FAILURES) {
      entry.health = 'DEAD';
      console.error(`[NIM KeyPool] Key …${key.slice(-8)} marked DEAD.`);
    }
  }
}

/**
 * Report a successful request — resets consecutive failure counter.
 */
export function reportSuccess(key: string): void {
  const entry = getPool().find(e => e.key === key);
  if (entry) {
    entry.failures = 0;
    if (entry.health === 'COOLING') {
      // Unexpected success while "cooling" — restore to healthy
      entry.health = 'HEALTHY';
    }
  }
}

/**
 * Public snapshot of pool state — used by /api/pool-status and the UI engine card.
 */
export function poolStatus() {
  const pool = getPool();
  const now  = Date.now();

  // Trigger cooldown recovery check as a side-effect
  pool.forEach(entry => {
    if (entry.health === 'COOLING' && now >= entry.cooldownUntil) {
      entry.health   = 'HEALTHY';
      entry.failures = 0;
    }
  });

  return {
    total:   pool.length,
    healthy: pool.filter(e => e.health === 'HEALTHY').length,
    cooling: pool.filter(e => e.health === 'COOLING').length,
    dead:    pool.filter(e => e.health === 'DEAD').length,
    rpm:     pool.filter(e => e.health === 'HEALTHY').length * 35,
    keys: pool.map(e => ({
      suffix:       `…${e.key.slice(-8)}`,
      health:       e.health,
      requests:     e.requestCount,
      cooldownSecs: e.health === 'COOLING'
        ? Math.max(0, Math.round((e.cooldownUntil - now) / 1000))
        : 0,
    })),
  };
}
