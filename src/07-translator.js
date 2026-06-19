// §7 — TRANSLATION ENGINE ADAPTER
// Phase 3 · async, network-touching.
//
// Architecture (post BUG-05 fix):
//   translate() is now a thin facade over the engine registry (22-engines.js).
//   All engine implementations live in 22-engines.js and register themselves
//   at window._twtp.Engines.  This file retains the legacy inline implementations
//   (_googleTranslate, _deeplTranslate, _libreTranslate) ONLY as fallback stubs
//   for environments where 22-engines.js failed to load.
//
// BCP-47 normalisation (BUG-07 fix):
//   All lang tags are normalised via _normLang() which uses replaceAll() to
//   convert every hyphen to an underscore, not just the first one.
//   zh-Hant-TW  →  zh_Hant_TW  (was: zh_Hant-TW)

/** @typedef {'google'|'deepl'|'libretranslate'|'azure'|'deepl_pro'|'mymemory'|'lingva'|'openai'|'anthropic'|'yandex'} EngineId */

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Normalise a BCP-47 tag to underscore-separated form for Google Translate.
 *  Fixes BUG-07: String.replace only replaces the first hyphen.
 *  @param {string} lang
 *  @returns {string}
 */
function _normLang(lang) {
  return (lang || '').replaceAll('-', '_');
}

/** Resolve the prefix constant safely even if 01-constants.js hasn't loaded. */
const _PFX = (typeof PFX !== 'undefined') ? PFX : 'twtp';

// ── Legacy inline implementations (fallback only) ──────────────────────────────
// These are consulted ONLY if window._twtp.Engines is unavailable.
// Primary path goes through the registry (see translate() below).

/**
 * Translate via Google's unofficial endpoint.
 * @param {string} text  PUA-encoded source text.
 * @param {string} srcLang  BCP-47 or 'auto'.
 * @param {string} tgtLang  BCP-47 target language.
 * @returns {Promise<string>}
 */
async function _googleTranslate(text, srcLang, tgtLang) {
  const sl = srcLang === 'auto' ? 'auto' : _normLang(srcLang); // BUG-07 fix
  const tl = _normLang(tgtLang);                               // BUG-07 fix
  const url = `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}` +
    `&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google: HTTP ${res.status}`);
  const data = await res.json();
  // data[0] is an array of [translated, original, ...] tuples
  const parts = (data[0] || []).map(t => t[0] || '').join('');
  return parts;
}

/**
 * Translate via DeepL Free API.
 * @param {string} text
 * @param {string} srcLang
 * @param {string} tgtLang
 * @param {string} apiKey
 * @returns {Promise<string>}
 */
async function _deeplTranslate(text, srcLang, tgtLang, apiKey) {
  const body = new URLSearchParams({
    auth_key:    apiKey,
    text,
    target_lang: tgtLang.toUpperCase(),
  });
  if (srcLang !== 'auto') body.set('source_lang', srcLang.toUpperCase());
  const res = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    body,
  });
  if (!res.ok) throw new Error(`DeepL: HTTP ${res.status}`);
  const data = await res.json();
  return (data.translations || []).map(t => t.text).join('');
}

/**
 * Translate via a LibreTranslate instance.
 * @param {string} text
 * @param {string} srcLang
 * @param {string} tgtLang
 * @param {string} host  e.g. 'https://libretranslate.com'
 * @param {string} [apiKey]  optional
 * @returns {Promise<string>}
 */
async function _libreTranslate(text, srcLang, tgtLang, host, apiKey) {
  const payload = {
    q:      text,
    source: srcLang === 'auto' ? 'auto' : srcLang,
    target: tgtLang,
    format: 'text',
  };
  if (apiKey) payload.api_key = apiKey;
  const res = await fetch(`${host}/translate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`LibreTranslate: HTTP ${res.status}`);
  const data = await res.json();
  return data.translatedText || '';
}

// ── Public facade ──────────────────────────────────────────────────────────────

/**
 * Translate `text` using the engine registered in the engine registry.
 * Falls back to the inline Google implementation only on transient network
 * errors (never on unknown engine ID — those throw immediately).
 *
 * BUG-05 fix: delegates to window._twtp.Engines registry instead of a
 * hard-coded switch that only knew 3 of 10 engines.
 *
 * @param {string} text
 * @param {string} srcLang
 * @param {string} tgtLang
 * @param {Object} [cfg]  Slice of the settings object.
 * @returns {Promise<string>}
 */
async function translate(text, srcLang, tgtLang, cfg = {}) {
  if (!text.trim()) return text;

  const engineId = cfg.engine || 'google';
  const registry  = window._twtp && window._twtp.Engines;

  // ── Primary path: engine registry (22-engines.js) ────────────────────────
  if (registry && typeof registry.get === 'function') {
    const engine = registry.get(engineId);
    if (!engine) {
      // Unknown engine ID — fail loudly so the user knows their setting is wrong
      throw new Error(`[${_PFX}] Unknown engine id: "${engineId}". Check your settings.`);
    }
    try {
      return await engine.translate(text, srcLang, tgtLang);
    } catch (primaryErr) {
      // Only fall back to Google on engines that aren't Google themselves
      if (engineId !== 'google') {
        console.warn(`[${_PFX}] ${engineId} failed, falling back to Google:`, primaryErr);
        const googleEngine = registry.get('google');
        if (googleEngine) return googleEngine.translate(text, srcLang, tgtLang);
        // Last resort: inline implementation
        return _googleTranslate(text, srcLang, tgtLang);
      }
      throw primaryErr;
    }
  }

  // ── Fallback path: registry unavailable, use legacy inline switch ─────────
  // This path should never be hit in normal operation.
  console.warn(`[${_PFX}] Engine registry unavailable; using legacy inline dispatch.`);
  try {
    switch (engineId) {
      case 'deepl':
        if (!cfg.deeplKey) throw new Error('No DeepL API key configured.');
        return await _deeplTranslate(text, srcLang, tgtLang, cfg.deeplKey);
      case 'libretranslate':
        if (!cfg.ltHost) throw new Error('No LibreTranslate host configured.');
        return await _libreTranslate(text, srcLang, tgtLang, cfg.ltHost, cfg.ltKey);
      case 'google':
      default:
        return await _googleTranslate(text, srcLang, tgtLang);
    }
  } catch (legacyErr) {
    if (engineId !== 'google') {
      console.warn(`[${_PFX}] Legacy ${engineId} failed, falling back to Google:`, legacyErr);
      return _googleTranslate(text, srcLang, tgtLang);
    }
    throw legacyErr;
  }
}
