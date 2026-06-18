// §14 — RECOMPILER
// Phase 3 · pure string / DOM transform.
//
// Takes a translated+PUA string and restores the original non-translatable
// segments (URLs, mentions, code spans) from the stash produced by the
// extractor.  Also decodes PUA formatting tokens.
//
// Pipeline:
//   translated (engine output)
//     → contextStrip()
//     → puaRestore(stash)
//     → puaDecode()       (optional, used for text-mode output)
//     → fixNumericDir()   (if tgtLang is RTL)
//     → puaStrip()        (safety valve — remove any residual PUA)
//     → clean string ready for injectTranslation()

/**
 * Full recompile pipeline for a translated string.
 *
 * @param {string}   translated  - Raw engine output (may contain PUA).
 * @param {string[]} stash       - Non-translatable spans from extraction.
 * @param {string}   dir         - Target direction 'ltr' | 'rtl'.
 * @returns {string}  Display-ready clean string.
 */
function recompile(translated, stash, dir) {
  let result = translated;

  // 1. Strip context injection markers
  result = contextStrip(result);

  // 2. Restore stashed non-translatable spans
  result = puaRestore(result, stash);

  // 3. Decode PUA formatting tokens back to text markers
  //    (we output plain text, so just decode to visible equivalents)
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
 * Used when we only have a plain-text cache hit.
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
 * Validate that a recompiled string is safe to display:
 *   - Not empty
 *   - No raw PUA leakage
 *   - Not identical to the source (would be a translation no-op)
 *
 * @param {string} recompiled
 * @param {string} original     - Original raw text for comparison.
 * @returns {boolean}
 */
function isValidRecompile(recompiled, original) {
  if (!recompiled || !recompiled.trim()) return false;
  // Check for PUA leakage
  if (/[\uE000-\uF8FF]/.test(recompiled)) return false;
  // Skip if result is identical to source (translation didn’t change anything)
  if (recompiled.trim() === original.trim()) return false;
  return true;
}
