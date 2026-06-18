// §5 — PUA FORMATTING PRESERVATION
// Phase 2 · pure encode/decode, no DOM.
//
// Problem: Translation engines silently drop or mangle markdown-like
// formatting inside messages (bold, italic, spoiler, code spans).
//
// Solution: Before sending to the engine we encode formatting tokens
// as Private Use Area (PUA) characters that look opaque to the engine
// but survive round-trip.  After translation we decode them back.
//
// PUA block used: U+E000 – U+E0FF (first PUA block, 256 slots).
// We only use a small sub-range so we don’t collide with emoji PUA.

/**
 * Slot map: symbolic name → PUA codepoint.
 * Keep these stable — cached translations reference them by codepoint.
 */
const PUA = {
  // Telegram formatting marks
  BOLD_OPEN:      '\uE001',
  BOLD_CLOSE:     '\uE002',
  ITALIC_OPEN:    '\uE003',
  ITALIC_CLOSE:   '\uE004',
  STRIKE_OPEN:    '\uE005',
  STRIKE_CLOSE:   '\uE006',
  UNDER_OPEN:     '\uE007',
  UNDER_CLOSE:    '\uE008',
  SPOILER_OPEN:   '\uE009',
  SPOILER_CLOSE:  '\uE00A',
  CODE_OPEN:      '\uE00B',
  CODE_CLOSE:     '\uE00C',
  PRE_OPEN:       '\uE00D',
  PRE_CLOSE:      '\uE00E',
  // Structural
  NEWLINE:        '\uE010', // \n that must survive
  PLACEHOLDER:    '\uE020', // non-translatable inline span placeholder
};

/** Reverse map: PUA char → original token string. */
const _PUA_TO_TOKEN = {
  '\uE001': '**',   // bold open  (simplified; real extractor uses HTML)
  '\uE002': '**',
  '\uE003': '__',
  '\uE004': '__',
  '\uE005': '~~',
  '\uE006': '~~',
  '\uE007': '--',
  '\uE008': '--',
  '\uE009': '||',
  '\uE00A': '||',
  '\uE00B': '`',
  '\uE00C': '`',
  '\uE00D': '```',
  '\uE00E': '```',
  '\uE010': '\n',
};

// ─ Encoding API ──────────────────────────────────────────

/**
 * Encode a single formatting token to its PUA character.
 * Returns the original token unchanged if no mapping exists.
 *
 * @param {keyof PUA} name
 * @returns {string}
 */
function puaEncode(name) {
  return PUA[name] || name;
}

/**
 * Replace a sequence of consecutive non-translatable characters
 * with a single PLACEHOLDER PUA char, storing the original in a
 * side-channel array so the recompiler can put it back.
 *
 * @param {string}   raw         - The characters to stash.
 * @param {string[]} stash       - Mutable array; original is pushed here.
 * @returns {string}             - Single PUA PLACEHOLDER char.
 */
function puaStash(raw, stash) {
  stash.push(raw);
  return PUA.PLACEHOLDER;
}

/**
 * After translation, restore all PLACEHOLDER chars from stash
 * in order.  Stash index is advanced per replacement.
 *
 * @param {string}   translated
 * @param {string[]} stash
 * @returns {string}
 */
function puaRestore(translated, stash) {
  let i = 0;
  return translated.replace(new RegExp(PUA.PLACEHOLDER, 'g'), () => {
    return i < stash.length ? stash[i++] : PUA.PLACEHOLDER;
  });
}

/**
 * Strip ALL PUA characters from a string.
 * Safety valve — called before text is displayed or cached.
 *
 * @param {string} text
 * @returns {string}
 */
function puaStrip(text) {
  // U+E000 – U+F8FF = BMP PUA block
  return text.replace(/[\uE000-\uF8FF]/g, '');
}

/**
 * Decode known PUA chars back to their original token strings.
 * Used by the recompiler (14-recompiler.js).
 *
 * @param {string} text
 * @returns {string}
 */
function puaDecode(text) {
  return text.replace(/[\uE001-\uE010]/g, ch => _PUA_TO_TOKEN[ch] || ch);
}
