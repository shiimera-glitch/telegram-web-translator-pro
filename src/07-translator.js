// §7 — TRANSLATION ENGINE ADAPTER
// Phase 3 · async, network-touching.
//
// Wraps multiple translation back-ends behind a single async interface.
// Engine priority (configurable via settings):
//   1. Google Translate (unofficial endpoint — no key needed)
//   2. DeepL Free API   (requires user-supplied key)
//   3. LibreTranslate   (requires user-supplied host + key)
//
// All engines receive PUA-encoded text and return PUA-encoded text.
// Context injection (13-context.js) wraps the encoded text before
// sending and strips the wrapper from the response.

/** @typedef {'google'|'deepl'|'libretranslate'} EngineId */

// ─ Google Translate (unofficial) ──────────────────────────────

/**
 * Translate via Google's unofficial endpoint.
 * Returns translated text or throws on failure.
 *
 * @param {string} text     - PUA-encoded source text.
 * @param {string} srcLang  - BCP-47 or 'auto'.
 * @param {string} tgtLang  - BCP-47 target language.
 * @returns {Promise<string>}
 */
async function _googleTranslate(text, srcLang, tgtLang) {
  const sl  = srcLang === 'auto' ? 'auto' : srcLang.replace('-', '_');
  const tl  = tgtLang.replace('-', '_');
  const url = `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}` +
    `&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google: HTTP ${res.status}`);

  const data  = await res.json();
  // data[0] is an array of [translated, original, ...] tuples
  const parts = (data[0] || []).map(t => t[0] || '').join('');
  return parts;
}

// ─ DeepL Free API ────────────────────────────────────────────

/**
 * Translate via DeepL Free API.
 *
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

// ─ LibreTranslate ────────────────────────────────────────────

/**
 * Translate via a LibreTranslate instance.
 *
 * @param {string} text
 * @param {string} srcLang
 * @param {string} tgtLang
 * @param {string} host     - e.g. 'https://libretranslate.com'
 * @param {string} [apiKey] - optional
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

// ─ Public facade ────────────────────────────────────────────

/**
 * Translate `text` using the engine specified in settings.
 * Falls back to Google if the primary engine fails.
 *
 * @param {string} text
 * @param {string} srcLang
 * @param {string} tgtLang
 * @param {Object} [cfg]   - Slice of the settings object.
 * @returns {Promise<string>}
 */
async function translate(text, srcLang, tgtLang, cfg = {}) {
  if (!text.trim()) return text;

  const engine = cfg.engine || 'google';

  try {
    switch (engine) {
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
  } catch (primaryErr) {
    // Fallback to Google on non-Google engines
    if (engine !== 'google') {
      console.warn(`[${PFX}] ${engine} failed, falling back to Google:`, primaryErr);
      return _googleTranslate(text, srcLang, tgtLang);
    }
    throw primaryErr;
  }
}
