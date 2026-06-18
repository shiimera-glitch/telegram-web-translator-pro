// §3 — UNICODE BIDI UTILITIES
// Phase 0 · pure functions, no DOM touches.
//
// Strategy:
//   CSS-first  → dir attribute on wrapper elements (08-injector handles this).
//   Unicode    → U+202A/202B/202C isolate spans when CSS is not enough.
//   Never inject bidi markers directly into translatable text nodes.

// ─ Unicode bidi control characters ───────────────────────────
// We store them as constants so search/replace doesn’t lose them.
const LRE  = '\u202A'; // LEFT-TO-RIGHT EMBEDDING  (deprecated, use isolate)
const RLE  = '\u202B'; // RIGHT-TO-LEFT EMBEDDING  (deprecated, use isolate)
const PDF  = '\u202C'; // POP DIRECTIONAL FORMATTING
const LRI  = '\u2066'; // LEFT-TO-RIGHT ISOLATE    (← preferred)
const RLI  = '\u2067'; // RIGHT-TO-LEFT ISOLATE    (← preferred)
const FSI  = '\u2068'; // FIRST STRONG ISOLATE
const PDI  = '\u2069'; // POP DIRECTIONAL ISOLATE
const LRM  = '\u200E'; // LEFT-TO-RIGHT MARK
const RLM  = '\u200F'; // RIGHT-TO-LEFT MARK

// ─ Script-range helpers ───────────────────────────────────

/** True if char is a strong RTL character (Arabic / Hebrew / etc.). */
function _isStrongRTL(ch) {
  const cp = ch.codePointAt(0);
  return (
    (cp >= 0x0590 && cp <= 0x05FF) || // Hebrew
    (cp >= 0x0600 && cp <= 0x06FF) || // Arabic
    (cp >= 0x0700 && cp <= 0x074F) || // Syriac
    (cp >= 0x0750 && cp <= 0x077F) || // Arabic Supplement
    (cp >= 0x08A0 && cp <= 0x08FF) || // Arabic Extended-A
    (cp >= 0xFB1D && cp <= 0xFDFF) || // Hebrew/Arabic Presentation
    (cp >= 0xFE70 && cp <= 0xFEFF) || // Arabic Presentation-B
    (cp >= 0x10800 && cp <= 0x10FFF)  // Old scripts (Phoenician etc.)
  );
}

/** True if char is a strong LTR character. */
function _isStrongLTR(ch) {
  const cp = ch.codePointAt(0);
  return (
    (cp >= 0x0041 && cp <= 0x005A) || // A-Z
    (cp >= 0x0061 && cp <= 0x007A) || // a-z
    (cp >= 0x00C0 && cp <= 0x024F) || // Latin Extended
    (cp >= 0x0400 && cp <= 0x04FF) || // Cyrillic
    (cp >= 0x0370 && cp <= 0x03FF) || // Greek
    (cp >= 0x4E00 && cp <= 0x9FFF) || // CJK Unified
    (cp >= 0xAC00 && cp <= 0xD7AF)    // Hangul
  );
}

// ─ Public API ────────────────────────────────────────────

/**
 * Detect the dominant base direction of a string.
 * Uses Unicode P2 / P3 first-strong algorithm (simplified).
 * Returns 'rtl' | 'ltr'.
 */
function detectDir(text) {
  for (const ch of text) {
    if (_isStrongRTL(ch)) return 'rtl';
    if (_isStrongLTR(ch)) return 'ltr';
  }
  return 'ltr'; // neutral default
}

/**
 * Wrap a plain-text span with Unicode Bidi Isolate markers
 * so it renders correctly when embedded inside opposite-direction context.
 *
 * Use ONLY for inline text fragments — never for full bubble content
 * (the injector sets dir= on the wrapper element instead).
 *
 * @param {string} text  - The text to wrap.
 * @param {'ltr'|'rtl'|'auto'} dir - Direction. 'auto' runs detectDir().
 * @returns {string}
 */
function bidiIsolate(text, dir = 'auto') {
  const resolved = dir === 'auto' ? detectDir(text) : dir;
  const open  = resolved === 'rtl' ? RLI : LRI;
  return open + text + PDI;
}

/**
 * Remove any bidi control characters from a string.
 * Used before sending text to translation engines.
 */
function stripBidi(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
}

/**
 * Apply a directional mark (LRM or RLM) after a number that is
 * adjacent to RTL text, so it anchors to the correct side.
 *
 * Example: "1,234 \u0645\u0644\u064a\u0648\u0646" → "1,234‎ \u0645\u0644\u064a\u0648\u0646"
 */
function fixNumericDir(text) {
  // Insert LRM after any numeric sequence followed by RTL text.
  return text.replace(/(\d[\d,.]*)(\s*)(?=[\u0590-\u06FF])/g,
    (_, num, sp) => num + LRM + sp);
}

/**
 * Set the `dir` attribute on a DOM element based on the
 * detected / supplied direction.  Pure helper — no cache, no side effects.
 *
 * @param {Element} el
 * @param {'ltr'|'rtl'|'auto'} dir
 */
function applyDir(el, dir = 'auto') {
  const resolved = dir === 'auto' ? detectDir(el.textContent || '') : dir;
  if (el.dir !== resolved) el.dir = resolved;
}
