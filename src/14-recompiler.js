// §14 — RECOMPILER
// Phase 3 · pure string / DOM transform.
//
// Takes a translated+PUA string and restores the original non-translatable
// segments (URLs, mentions, code spans) from the stash produced by the
// extractor. Also decodes PUA formatting tokens.
//
// Pipeline:
//   translated (engine output)
//     → contextStrip()
//     → puaRestore(stash)
//     → puaDecode()        (optional, used for text-mode output)
//     → fixNumericDir()    (if tgtLang is RTL)
//     → puaStrip()        (safety valve — remove any residual PUA)
//     → clean string ready for injectTranslation()
//
// BUG-20 patch: wrapped as IIFE, registered as window._twtp.Recompiler
// BUG-21 patch: isValidRecompile() — removed the identical-string check
//   that was incorrectly discarding valid short translations (e.g. “OK”
//   → “OK” in some languages). The identical-text guard belongs at the
//   caller level (renderer decides whether to skip), not here.

/* global contextStrip, puaRestore, puaDecode, fixNumericDir, puaStrip */

(function _recompilerModule() {
  'use strict';

  /**
   * Full recompile pipeline for a translated string.
   *
   * @param {string}   translated  - Raw engine output (may contain PUA).
   * @param {string[]} stash       - Non-translatable spans from extraction.
   * @param {string}   dir         - Target direction 'ltr' | 'rtl'.
   * @returns {string} Display-ready clean string.
   */
  function recompile(translated, stash, dir) {
    let result = translated;

    // 1. Strip context injection markers
    result = contextStrip(result);

    // 2. Restore stashed non-translatable spans
    result = puaRestore(result, stash);

    // 3. Decode PUA formatting tokens back to text markers
    result = puaDecode(result);

    // 4. Fix numeric bidi if target is RTL
    if (dir === 'rtl') result = fixNumericDir(result);

    // 5. Safety: strip any residual PUA characters
    result = puaStrip(result);

    // 6. Normalise whitespace (collapse multiple \n > 2)
    result = result.replace(/\n{3,}/g, '\n\n').trim();

    return result;
  }

  /**
   * Lightweight version: just strip context + PUA, no stash restore.
   * Used only for genuinely plain-text situations where no stash exists.
   *
   * @param {string} text
   * @param {string} dir
   * @returns {string}
   */
  function recompileSimple(text, dir) {
    let result = contextStrip(text);
    if (dir === 'rtl') result = fixNumericDir(result);
    return puaStrip(result).trim();
  }

  /**
   * Validate that a recompiled string is safe to display.
   *
   * Checks:
   *   - Not empty
   *   - No raw PUA leakage
   *
   * NOTE (BUG-21 FIX): The “identical to source” check has been REMOVED.
   * Some translation engines legitimately return the same string for short
   * words that are language-neutral (e.g. proper nouns, “OK”, “URL”).
   * Discarding those was a silent data loss bug. The renderer can opt-in
   * to an identity filter via cfg.skipIdentical if the product requires it.
   *
   * @param {string} recompiled
   * @returns {boolean}
   */
  function isValidRecompile(recompiled) {
    if (!recompiled || !recompiled.trim()) return false;

    // Reject if any raw PUA characters leaked through
    if (/[\uE000-\uF8FF]/.test(recompiled)) return false;

    return true;
  }

  // ─ Public API ────────────────────────────────────────────────────
  /* exported Recompiler */
  const Recompiler = { recompile, recompileSimple, isValidRecompile };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Recompiler;
  } else {
    (window._twtp = window._twtp || {}).Recompiler = Recompiler;
  }
}());
