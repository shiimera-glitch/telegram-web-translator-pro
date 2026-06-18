// §10 — TRANSLATION CACHE
// Phase 3 · in-memory + GM_setValue persistence.
//
// Key   = sha1-like fingerprint of (srcLang + tgtLang + raw_text).
// Value = { translated, dir, tgtLang, ts } — plain object.
//
// Two-tier:
//   L1: JS Map (in-memory, instant).
//   L2: GM_getValue / GM_setValue (persisted across page reloads).
//
// Cache entries older than CACHE_TTL_MS are stale and evicted lazily.

const CACHE_TTL_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_KEY_GM  = `${PFX}_cache`;            // GM storage key
const CACHE_MAX_L2  = 2000;                       // max L2 entries (evict LRU)

/** In-memory L1 cache: fingerprint → CacheEntry. */
const _L1 = new Map();

/** L2 store loaded from GM storage on first access. */
let _L2   = null;
let _L2dirty = false;

/**
 * @typedef {Object} CacheEntry
 * @property {string} translated
 * @property {string} dir
 * @property {string} tgtLang
 * @property {number} ts         - Unix timestamp (ms) of storage.
 */

// ─ Key generation ───────────────────────────────────────────

/**
 * Derive a short, stable cache key.
 * Uses a fast non-cryptographic hash (djb2-like) —
 * collisions are tolerable: we'd just re-translate.
 *
 * @param {string} srcLang
 * @param {string} tgtLang
 * @param {string} raw       - Original message text (pre-PUA).
 * @returns {string}
 */
function cacheKey(srcLang, tgtLang, raw) {
  const str = `${srcLang}|${tgtLang}|${raw}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // keep 32-bit unsigned
  }
  return h.toString(36);
}

// ─ L2 lazy init ───────────────────────────────────────────

function _loadL2() {
  if (_L2 !== null) return;
  try {
    const raw = typeof GM_getValue === 'function'
      ? GM_getValue(CACHE_KEY_GM, '{}')
      : '{}';
    _L2 = JSON.parse(raw);
  } catch {
    _L2 = {};
  }
}

function _saveL2() {
  if (!_L2dirty) return;
  try {
    if (typeof GM_setValue === 'function') {
      GM_setValue(CACHE_KEY_GM, JSON.stringify(_L2));
    }
    _L2dirty = false;
  } catch (e) {
    console.warn(`[${PFX}] cache save failed`, e);
  }
}

// Debounced save — don’t hammer GM_setValue on every translate
let _saveTimer = null;
function _scheduleSave() {
  _L2dirty = true;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_saveL2, 2000);
}

// ─ Public API ───────────────────────────────────────────

/**
 * Retrieve a cached entry or null.
 *
 * @param {string} key  - From cacheKey().
 * @returns {CacheEntry|null}
 */
function cacheGet(key) {
  // L1 first
  if (_L1.has(key)) {
    const e = _L1.get(key);
    if (Date.now() - e.ts < CACHE_TTL_MS) return e;
    _L1.delete(key);
  }
  // L2
  _loadL2();
  const e = _L2[key];
  if (!e) return null;
  if (Date.now() - e.ts >= CACHE_TTL_MS) {
    delete _L2[key];
    _scheduleSave();
    return null;
  }
  _L1.set(key, e); // promote to L1
  return e;
}

/**
 * Store a cache entry.
 *
 * @param {string}     key
 * @param {CacheEntry} entry
 */
function cacheSet(key, entry) {
  _L1.set(key, entry);
  _loadL2();

  // LRU eviction: drop oldest if over limit
  const keys = Object.keys(_L2);
  if (keys.length >= CACHE_MAX_L2) {
    const oldest = keys.sort((a, b) => (_L2[a].ts || 0) - (_L2[b].ts || 0));
    delete _L2[oldest[0]];
  }

  _L2[key] = entry;
  _scheduleSave();
}

/** Wipe the entire cache (L1 + L2). */
function cacheClear() {
  _L1.clear();
  _L2 = {};
  _L2dirty = true;
  _saveL2();
}
