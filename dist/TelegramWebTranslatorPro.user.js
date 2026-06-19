// ==UserScript==
// @name         Telegram Web Translator Pro
// @namespace    https://greasyfork.org/
// @version      4.0.0
// @description  RTL/LTR bidi engine, context injection, mixed-script
//               segmentation, spoiler support, PUA-guard rich format
//               preservation, dual targets, LRU cache, circuit breaker
// @author       shiimera-glitch
// @match        https://web.telegram.org/a/*
// @match        https://web.telegram.org/k/*
// @license      MIT
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      translate.googleapis.com
// @connect      api-free.deepl.com
// @connect      api.mymemory.translated.net
// @connect      api.deepl.com
// @connect      libretranslate.com
// @connect      translate.yandex.net
// @connect      api.openai.com
// @connect      api.anthropic.com
// @connect      api.cognitive.microsofttranslator.com
// @connect      *
// @run-at       document-end
// @homepageURL  https://github.com/shiimera-glitch/telegram-web-translator-pro
// @supportURL   https://github.com/shiimera-glitch/telegram-web-translator-pro/issues
// ==/UserScript==
//
// Version History:
// 4.0.0  2026-06-18  Full bidi engine. Context injection. Mixed-script
//                    segmentation. PUA guards. Spoiler support.
//                    Unified WeakMap. requestIdleCallback scheduling.
//                    AbortController per request. Cache hit/miss tracking.
// 3.0.2  (baseline)  Per-chat overrides, dual targets, polyglot skip,
//                    hover bubble, LRU cache, circuit breaker

(function () {
  'use strict';
  // === All sections §0-§20 follow in subsequent src/ files ===

// 01-constants.js – Global constants, selectors, feature flags
// Part of telegram-web-translator-pro v4.1.0
// Pure constants only – no side-effects.

/* global location */

// ── App variant detection ──────────────────────────────────────────────────────────────
const ISK = location.pathname.startsWith('/k');   // K-app (Webogram)
const ISA = !ISK;                                  // A-app (React, default)

// ── Version & namespace ─────────────────────────────────────────────────────────────
const VER = '4.1.0';
const PFX = 'tgtp4';  // DOM attr / storage key prefix

// ── DOM selectors (A-app ↔ K-app normalised) ────────────────────────────────────────
// Message bubble wrapper
const MSGSEL = ISK
  ? '.message .text-content, .translatable-message, .message p'
  : '.bubble .message.spoilers-container, .bubble .text-content, .bubble .message-text, .translatable-message';

// Bubble container (the whole card incl. avatar + meta)
const BUBBLESEL = ISK ? '.message' : '.bubble';

// Message list scroll container
const CHATSEL = ISK ? '#column-center .scrollable' : '.bubbles .scrollable-y';

// Outgoing message indicator
const OUTSEL = ISK ? '.message.is-out' : '.bubble.is-out';

// Input composer
const INPUTSEL = ISK
  ? '#editable-message-text'
  : '.input-message-input[contenteditable]';

// Spoiler wrapper (render differently A vs K)
const SPOILERSEL = ISK
  ? '.spoiler'
  : '.spoiler-container, .i-am-a-spoiler';

// ── Translation engines ───────────────────────────────────────────────────────────────
const ENGINES = [
  { id: 'google',       label: 'Google Translate',   free: true,  requiresKey: false },
  { id: 'deepl',        label: 'DeepL Free',          free: true,  requiresKey: false },
  { id: 'deepl_pro',   label: 'DeepL Pro',           free: false, requiresKey: true  },
  { id: 'mymemory',    label: 'MyMemory',            free: true,  requiresKey: false },
  { id: 'libretranslate', label: 'LibreTranslate',   free: true,  requiresKey: false },
  { id: 'lingva',      label: 'Lingva',              free: true,  requiresKey: false },
  { id: 'openai',      label: 'OpenAI (GPT-4o)',     free: false, requiresKey: true  },
  { id: 'anthropic',   label: 'Claude (Anthropic)',  free: false, requiresKey: true  },
  { id: 'azure',       label: 'Azure Translator',    free: false, requiresKey: true  },
  { id: 'yandex',      label: 'Yandex Translate',    free: false, requiresKey: true  },
];

// ── Script / IME categories ─────────────────────────────────────────────────────────────
const SCRIPT_RTL  = new Set(['ar','he','fa','ur','ps','sd','yi','ug','ku','dv','ha','ks']);
const SCRIPT_CJK  = new Set(['zh','ja','ko','yue']);
const SCRIPT_INDIC= new Set(['hi','bn','ta','te','mr','gu','kn','ml','pa','si','ne','my','km','lo','th']);
const SCRIPT_LATIN= new Set(['en','fr','de','es','it','pt','nl','sv','no','da','fi','pl','cs','sk','hu','ro','hr','sr','bg','uk','ru','el','tr']);
// IME-heavy scripts that need special composition handling
const NEEDS_IME   = new Set([...SCRIPT_CJK, ...SCRIPT_INDIC]);

// ── UI defaults ───────────────────────────────────────────────────────────────────────
const UI_DEFAULTS = {
  theme:          'dark',      // 'dark' | 'light' | 'auto'
  scale:          1.0,         // global UI scale (0.7 – 2.0)
  fontSize:       14,          // px base for panel text
  panelW:         340,         // panel width px
  panelH:         480,         // panel height px
  panelX:         null,        // drag position (null = auto)
  panelY:         null,
  accordionPins:  {},          // section id → boolean (true = always open)
  engine:         'google',
  targetLang:     'en',
  secondaryLang:  '',
  polyglotSkip:   [],          // array of BCP-47 lang codes to never translate
  autoTranslate:  false,
  showOriginal:   true,
  contextHint:    true,
  debug:          false,
};

// ── Timing (ms) ───────────────────────────────────────────────────────────────────────
const TIMING = {
  debounceObserver:  120,
  throttleScroll:    200,
  longPressDuration: 600,
  doubleTapWindow:   350,
  circuitBreakerMax: 5,
  circuitBreakerTTL: 30000,
  cacheMaxEntries:   800,
  cacheTTL:          7 * 24 * 60 * 60 * 1000,  // 7 days
  requestTimeout:    8000,
};

// ── Misc ────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY  = `${PFX}_settings`;
const CACHE_KEY    = `${PFX}_cache`;
const DATA_ATTR    = `data-${PFX}`;
const DONE_ATTR    = `data-${PFX}-done`;
const ORIG_ATTR    = `data-${PFX}-orig`;
const LANG_ATTR    = `data-${PFX}-lang`;

// TWTConfig – single global config object consumed by all modules
const TWTConfig = Object.freeze({
  ISK, ISA, VER, PFX,
  MSGSEL, BUBBLESEL, CHATSEL, OUTSEL, INPUTSEL, SPOILERSEL,
  ENGINES, SCRIPT_RTL, SCRIPT_CJK, SCRIPT_INDIC, SCRIPT_LATIN, NEEDS_IME,
  UI_DEFAULTS, TIMING,
  STORAGE_KEY, CACHE_KEY, DATA_ATTR, DONE_ATTR, ORIG_ATTR, LANG_ATTR,
  DEBUG: false,
});

// §2 — LANGUAGE MAP & DIRECTION TABLE
// Phase 0 · pure data, zero side-effects.

/**
 * BCP-47 tag → { label, dir, font? }
 * dir: 'rtl' | 'ltr'
 * Extend freely; nothing else imports this directly —
 * consumers call getLangDir() / getLangLabel().
 */
const LANG_MAP = {
  // ── Latin / LTR ────────────────────────────────────────
  en: { label: 'English',    dir: 'ltr' },
  fr: { label: 'Français',   dir: 'ltr' },
  de: { label: 'Deutsch',    dir: 'ltr' },
  es: { label: 'Español',    dir: 'ltr' },
  pt: { label: 'Português',  dir: 'ltr' },
  it: { label: 'Italiano',   dir: 'ltr' },
  nl: { label: 'Nederlands', dir: 'ltr' },
  pl: { label: 'Polski',     dir: 'ltr' },
  sv: { label: 'Svenska',    dir: 'ltr' },
  no: { label: 'Norsk',      dir: 'ltr' },
  da: { label: 'Dansk',      dir: 'ltr' },
  fi: { label: 'Suomi',      dir: 'ltr' },
  ro: { label: 'Română',     dir: 'ltr' },
  hu: { label: 'Magyar',     dir: 'ltr' },
  cs: { label: 'Čeština',    dir: 'ltr' },
  sk: { label: 'Slovenčina', dir: 'ltr' },
  hr: { label: 'Hrvatski',   dir: 'ltr' },
  bg: { label: 'Български',  dir: 'ltr' },
  uk: { label: 'Українська', dir: 'ltr' },
  ru: { label: 'Русский',    dir: 'ltr' },
  id: { label: 'Indonesia',  dir: 'ltr' },
  ms: { label: 'Melayu',     dir: 'ltr' },
  vi: { label: 'Tiếng Việt', dir: 'ltr' },
  tr: { label: 'Türkçe',     dir: 'ltr' },
  // ── CJK ────────────────────────────────────────────────
  zh: { label: '中文',        dir: 'ltr' },
  'zh-CN': { label: '简体中文', dir: 'ltr' },
  'zh-TW': { label: '繁體中文', dir: 'ltr' },
  ja: { label: '日本語',       dir: 'ltr' },
  ko: { label: '한국어',       dir: 'ltr' },
  // ── RTL ────────────────────────────────────────────────
  ar: { label: 'العربية',    dir: 'rtl' },
  fa: { label: 'فارسی',      dir: 'rtl' },
  he: { label: 'עברית',      dir: 'rtl' },
  ur: { label: 'اردو',       dir: 'rtl' },
  ps: { label: 'پښتو',       dir: 'rtl' },
  ug: { label: 'ئۇيغۇرچە',   dir: 'rtl' },
  // ── Indic ──────────────────────────────────────────────
  hi: { label: 'हिन्दी',      dir: 'ltr' },
  bn: { label: 'বাংলা',       dir: 'ltr' },
  ta: { label: 'தமிழ்',       dir: 'ltr' },
  te: { label: 'తెలుగు',      dir: 'ltr' },
  mr: { label: 'मराठी',       dir: 'ltr' },
  gu: { label: 'ગુજરાતી',     dir: 'ltr' },
  kn: { label: 'ಕನ್ನಡ',       dir: 'ltr' },
  ml: { label: 'മലയാളം',      dir: 'ltr' },
  si: { label: 'සිංහල',       dir: 'ltr' },
  // ── Misc ───────────────────────────────────────────────
  el: { label: 'Ελληνικά',   dir: 'ltr' },
  ka: { label: 'ქართული',    dir: 'ltr' },
  hy: { label: 'Հայերեն',    dir: 'ltr' },
  th: { label: 'ภาษาไทย',    dir: 'ltr' },
  lo: { label: 'ລາວ',        dir: 'ltr' },
  km: { label: 'ខ្មែរ',       dir: 'ltr' },
  my: { label: 'မြန်မာ',     dir: 'ltr' },
  az: { label: 'Azərbaycan', dir: 'ltr' },
  kk: { label: 'Қазақша',    dir: 'ltr' },
  uz: { label: "O'zbek",     dir: 'ltr' },
  tk: { label: 'Türkmen',    dir: 'ltr' },
  ky: { label: 'Кыргызча',   dir: 'ltr' },
};

/** Normalise BCP-47 tag for lookup (e.g. 'zh-cn' → 'zh-CN'). */
function _normTag(tag) {
  if (!tag) return '';
  const [lang, region] = tag.split('-');
  return region ? `${lang.toLowerCase()}-${region.toUpperCase()}` : lang.toLowerCase();
}

/**
 * Return 'rtl' | 'ltr' for a BCP-47 language tag.
 * Falls back to 'ltr' when unknown.
 */
function getLangDir(tag) {
  const entry = LANG_MAP[_normTag(tag)];
  return entry ? entry.dir : 'ltr';
}

/**
 * Return the human-readable label for a BCP-47 tag.
 * Falls back to the raw tag.
 */
function getLangLabel(tag) {
  const norm = _normTag(tag);
  const entry = LANG_MAP[norm];
  return entry ? entry.label : tag;
}

/**
 * Return sorted array of { tag, label, dir } for UI menus.
 * LTR entries first, then RTL, each group alpha by label.
 */
function getLangList() {
  return Object.entries(LANG_MAP)
    .map(([tag, { label, dir }]) => ({ tag, label, dir }))
    .sort((a, b) => {
      if (a.dir !== b.dir) return a.dir === 'ltr' ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
}

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

// §4 — MIXED-SCRIPT SEGMENTER
// Phase 1 · pure functions.
//
// Breaks a raw text string into typed segments so downstream
// modules can handle each run individually:
//   - translate only the human-language spans
//   - leave URLs, mentions, hashtags, code, emoji untouched
//   - preserve whitespace runs exactly

/** Segment type tokens — consumed by extractor & recompiler. */
const SEG = {
  TEXT:    'TEXT',    // translatable human-language run
  URL:     'URL',     // http(s):// …
  MENTION: 'MENTION', // @handle
  HASHTAG: 'HASHTAG', // #tag
  CODE:    'CODE',    // `inline` or multi-char code run
  EMOJI:   'EMOJI',   // Unicode emoji sequence
  SPACE:   'SPACE',   // whitespace (preserved verbatim)
  NUMBER:  'NUMBER',  // standalone numeric token
  PUNCT:   'PUNCT',   // punctuation-only run
};

// ─ Regex arsenal ─────────────────────────────────────────────
// Ordered from most-specific to least-specific.
// Each pattern must consume at least 1 character.
const _PATTERNS = [
  // URL (greedy, stops at whitespace or closing bracket)
  [SEG.URL,     /https?:\/\/[^\s<>"'\u200B-\u200D\uFEFF]+/u],
  // @mention
  [SEG.MENTION, /@[\w.]{1,32}/u],
  // #hashtag
  [SEG.HASHTAG, /#[\w\u00C0-\u024F\u0400-\u04FF]{1,50}/u],
  // backtick inline code
  [SEG.CODE,    /`[^`\n]+`/u],
  // emoji (ZWJ sequences, variation selectors, keycap, flags)
  [SEG.EMOJI,   /(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*/u],
  // whitespace run
  [SEG.SPACE,   /[ \t\r\n\u00A0\u200B]+/u],
  // number (with optional thousands-sep / decimal)
  [SEG.NUMBER,  /[\d][\d,.\u066B\u066C]*/u],
  // punctuation-only run (ASCII + common Unicode)
  [SEG.PUNCT,   /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~\u2010-\u2027\u2030-\u205E\u2060-\u2FFF]+/u],
];

/**
 * Tokenise `text` into an array of segment objects.
 *
 * @param {string} text
 * @returns {{ type: string, value: string }[]}
 */
function segment(text) {
  const out = [];
  let pos   = 0;
  const len = text.length;

  while (pos < len) {
    let matched = false;

    for (const [type, rx] of _PATTERNS) {
      // Anchor regex to current position
      rx.lastIndex = 0;
      const slice = text.slice(pos);
      const m = rx.exec(slice);
      if (m && m.index === 0) {
        out.push({ type, value: m[0] });
        pos += m[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Accumulate as TEXT until next pattern matches
      let end = pos + 1;
      outer: while (end < len) {
        const slice = text.slice(end);
        for (const [, rx] of _PATTERNS) {
          rx.lastIndex = 0;
          const m = rx.exec(slice);
          if (m && m.index === 0) break outer;
        }
        end++;
      }
      out.push({ type: SEG.TEXT, value: text.slice(pos, end) });
      pos = end;
    }
  }

  return _mergeAdjacentText(out);
}

/**
 * Merge consecutive TEXT segments so the translator sees
 * the longest possible natural sentence.
 */
function _mergeAdjacentText(segs) {
  const out = [];
  for (const seg of segs) {
    const prev = out[out.length - 1];
    if (prev && prev.type === SEG.TEXT && seg.type === SEG.TEXT) {
      prev.value += seg.value;
    } else {
      out.push({ ...seg });
    }
  }
  return out;
}

/**
 * Reconstruct the original string from a segment array.
 * Useful for sanity-checking: segment(x).map(s=>s.value).join('') === x
 */
function unsegment(segs) {
  return segs.map(s => s.value).join('');
}

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

// §6 — TEXT EXTRACTOR
// Phase 2 · reads DOM, emits a portable extraction record.
//
// Responsibilities:
//   1. Walk the message bubble's subtree.
//   2. Collect text runs, tagging non-translatable spans as PUA placeholders.
//   3. Return an ExtractionRecord that the translator & recompiler consume.
//   4. Never mutate the DOM — read-only pass.

/**
 * @typedef {Object} ExtractionRecord
 * @property {string}   raw        - Original concatenated text (for cache key).
 * @property {string}   encoded    - Text with non-translatable spans as PUA.
 * @property {string[]} stash      - Stash of replaced non-translatable spans.
 * @property {string}   srcLang    - Detected source language tag or 'auto'.
 * @property {string}   dir        - Detected base direction 'ltr' | 'rtl'.
 * @property {Element}  el         - The bubble element (reference only).
 */

/**
 * Extract translatable content from a Telegram message bubble element.
 *
 * @param {Element} el  - The `.message` or `.bubble` element.
 * @returns {ExtractionRecord}
 */
function extractBubble(el) {
  const stash  = [];
  const parts  = [];
  let   raw    = '';

  _walkNode(el, parts, stash, raw);

  // Rebuild raw and encoded from parts
  const rawText     = parts.map(p => p.raw).join('');
  const encodedText = parts.map(p => p.enc).join('');

  return {
    raw:     rawText,
    encoded: encodedText,
    stash,
    srcLang: 'auto',
    dir:     detectDir(rawText),
    el,
  };
}

// ─ Internal walker ──────────────────────────────────────────

/**
 * @param {Node}     node
 * @param {Array}    parts   - Accumulator of { raw, enc } pairs.
 * @param {string[]} stash
 * @param {string}   _raw    - Unused param kept for signature compat.
 */
function _walkNode(node, parts, stash, _raw) {
  // Text node — the main path
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent;
    if (text) parts.push({ raw: text, enc: text });
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const tag = node.tagName.toLowerCase();

  // Skip script / style entirely
  if (tag === 'script' || tag === 'style') return;

  // Non-translatable inline elements — stash as PUA placeholder
  if (_isOpaqueElement(node)) {
    const outer = node.outerHTML || node.textContent;
    const ph    = puaStash(outer, stash);
    parts.push({ raw: node.textContent, enc: ph });
    return;
  }

  // Block-level element — insert synthetic newline if we have content
  const isBlock = _isBlockElement(tag);
  if (isBlock && parts.length) {
    parts.push({ raw: '\n', enc: PUA.NEWLINE });
  }

  // Recurse into children
  for (const child of node.childNodes) {
    _walkNode(child, parts, stash, _raw);
  }

  if (isBlock && parts.length) {
    parts.push({ raw: '\n', enc: PUA.NEWLINE });
  }
}

/** Elements whose inner content we must NOT translate. */
function _isOpaqueElement(el) {
  const tag = el.tagName.toLowerCase();
  // <a> links — stash the whole element
  if (tag === 'a') return true;
  // Inline code
  if (tag === 'code' || tag === 'pre') return true;
  // Custom emoji / sticker wrappers
  if (el.classList.contains('custom-emoji')) return true;
  if (el.classList.contains('emoji')) return true;
  return false;
}

/** Tags that introduce block-level breaks. */
function _isBlockElement(tag) {
  return ['div', 'p', 'br', 'li', 'blockquote', 'section', 'article'].includes(tag);
}

/**
 * Quick smoke-test: does this element contain any non-whitespace text?
 * Used by the observer to skip empty or media-only bubbles.
 *
 * @param {Element} el
 * @returns {boolean}
 */
function hasMeaningfulText(el) {
  return /\S/.test(el.textContent || '');
}

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

// §8 — DOM INJECTOR
// Phase 3 · writes translated content back to the bubble DOM.
//
// Rules:
//   • CSS-first: set `dir` attribute on wrapper; never insert bidi marks
//     into the text content itself (unless bidiIsolate is explicitly called).
//   • Never replace the bubble’s existing DOM structure — only update
//     text nodes and add a translation wrapper `<span>`.
//   • All injected elements carry data-tgtp=VER so the observer
//     can skip already-translated bubbles.
//   • Idempotent: calling inject twice on the same el is safe.

// CSS class / data attribute used to mark translated content.
const INJECTED_CLASS = `${PFX}-translated`;
const INJECTED_ATTR  = 'data-tgtp';

/**
 * Inject a translated string into a bubble element.
 *
 * Creates a `<div class="tgtp3-translated">` wrapper appended after
 * the existing content, with the correct `dir` attribute.
 * The original content is left untouched so toggling is trivial.
 *
 * @param {Element} el          - The message bubble element.
 * @param {string}  translated  - Clean translated text (PUA already stripped).
 * @param {string}  dir         - 'ltr' | 'rtl' for the translated text.
 * @param {string}  srcLang     - Source language tag (stored as data attribute).
 * @param {string}  tgtLang     - Target language tag.
 */
function injectTranslation(el, translated, dir, srcLang, tgtLang) {
  // Remove any previous injection first (idempotency)
  removeInjection(el);

  const wrap = document.createElement('div');
  wrap.className  = INJECTED_CLASS;
  wrap.dir        = dir;
  wrap.lang       = tgtLang;
  wrap.setAttribute(INJECTED_ATTR, VER);
  wrap.setAttribute('data-src-lang', srcLang);
  wrap.setAttribute('data-tgt-lang', tgtLang);

  // Apply numeric bidi fix for RTL targets
  const displayText = dir === 'rtl' ? fixNumericDir(translated) : translated;
  wrap.textContent  = displayText;

  // Separator line (subtle, CSS can override)
  const sep = document.createElement('hr');
  sep.className = `${INJECTED_CLASS}-sep`;
  sep.setAttribute(INJECTED_ATTR, VER);

  el.appendChild(sep);
  el.appendChild(wrap);

  // Mark the bubble itself so the observer ignores it on the next tick
  el.setAttribute(INJECTED_ATTR, VER);
}

/**
 * Remove any previously injected translation from a bubble.
 *
 * @param {Element} el
 */
function removeInjection(el) {
  el.querySelectorAll(`[${INJECTED_ATTR}]`).forEach(n => n.remove());
  el.removeAttribute(INJECTED_ATTR);
}

/**
 * Toggle the visibility of an existing injection.
 * Used by the “show/hide translation” UI action.
 *
 * @param {Element} el
 * @returns {boolean}  true = now visible, false = now hidden.
 */
function toggleInjection(el) {
  const wrap = el.querySelector(`.${INJECTED_CLASS}`);
  if (!wrap) return false;

  const hidden = wrap.style.display === 'none';
  wrap.style.display = hidden ? '' : 'none';

  const sep = el.querySelector(`.${INJECTED_CLASS}-sep`);
  if (sep) sep.style.display = wrap.style.display;

  return hidden; // true = we just made it visible
}

/**
 * Return true if this element already has a translation injected.
 *
 * @param {Element} el
 * @returns {boolean}
 */
function isInjected(el) {
  return el.hasAttribute(INJECTED_ATTR);
}

/**
 * Insert the global stylesheet needed by injected elements.
 * Called once on init (20-init.js).
 */
function injectStyles() {
  if (document.getElementById(`${PFX}-style`)) return; // already injected

  const style = document.createElement('style');
  style.id = `${PFX}-style`;
  style.textContent = `
    .${INJECTED_CLASS} {
      margin-top: 4px;
      padding: 4px 6px;
      border-left: 2px solid var(--color-primary, #5288c1);
      font-size: .92em;
      opacity: .9;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .${INJECTED_CLASS}-sep {
      border: none;
      border-top: 1px solid rgba(127,127,127,.25);
      margin: 4px 0 2px;
    }
    .${INJECTED_CLASS}[dir="rtl"] {
      border-left: none;
      border-right: 2px solid var(--color-primary, #5288c1);
      text-align: right;
    }
  `;
  document.head.appendChild(style);
}

// §9 — MUTATION OBSERVER
// Phase 3 · watches the DOM for new/changed message bubbles.
//
// Design:
//   • Single shared MutationObserver for the whole chat viewport.
//   • New bubble candidates are batched into a microtask queue
//     so we never block the main thread per-mutation.
//   • Auto-translate only fires when the user has enabled auto mode.
//   • Already-translated bubbles (data-tgtp) are skipped.
//
// BUG-10 fix: _queue is now a Set<Element> — _enqueue() is O(1) instead of O(n).
// BUG-11 fix: startObserver() resets _queue and _scheduled before reconnecting.

/** Safe prefix constant (BUG-06 guard). */
const _OBS_PFX = (typeof PFX !== 'undefined') ? PFX : 'twtp';

/**
 * Internal queue of bubble elements waiting to be processed.
 * BUG-10 fix: Set<Element> provides O(1) has/add vs O(n) Array.includes.
 */
let _queue     = new Set();
let _scheduled = false;
let _observer  = null;

/** Callback invoked per bubble that needs processing. Set by init. */
let _onBubble = null;

/**
 * Register the handler called for each new/changed bubble.
 * @param {(el: Element) => void} fn
 */
function setObserverHandler(fn) {
  if (typeof fn !== 'function') {
    console.warn(`[${_OBS_PFX}] setObserverHandler: expected function, got`, typeof fn);
    return;
  }
  _onBubble = fn;
}

/**
 * Start observing the given root element (typically the messages
 * container div that Telegram renders into).
 *
 * BUG-11 fix: clears _queue and resets _scheduled before reconnecting
 * so stale nodes from a previous chat are never processed.
 *
 * @param {Element} root
 */
function startObserver(root) {
  if (_observer) _observer.disconnect();

  // BUG-11 fix: reset state on every (re)start
  _queue     = new Set();
  _scheduled = false;

  _observer = new MutationObserver(_onMutations);
  _observer.observe(root, {
    childList: true,
    subtree:   true,
  });
}

/** Stop the observer (e.g. on script teardown). */
function stopObserver() {
  if (_observer) {
    _observer.disconnect();
    _observer = null;
  }
  _queue     = new Set();
  _scheduled = false;
}

// ─ Internal ──────────────────────────────────────────────────────────────

function _onMutations(records) {
  for (const rec of records) {
    for (const node of rec.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      _collectBubbles(node);
    }
  }
  _scheduleFlush();
}

/**
 * Collect message bubble elements from `root` and its subtree.
 * We look for MSGSEL (defined in 01-constants.js).
 */
function _collectBubbles(root) {
  // Is root itself a bubble?
  if (_isBubble(root)) {
    _enqueue(root);
    return;
  }
  // Walk subtree
  const hits = root.querySelectorAll(MSGSEL);
  for (const el of hits) _enqueue(el);
}

function _isBubble(el) {
  return el.matches && el.matches(MSGSEL);
}

function _enqueue(el) {
  // Skip already translated, media-only, or already queued
  if (isInjected(el)) return;       // data-tgtp present — already done
  if (!hasMeaningfulText(el)) return; // no translatable text
  // BUG-10 fix: Set.has() is O(1) vs Array.includes() O(n)
  _queue.add(el);
}

function _scheduleFlush() {
  if (_scheduled) return;
  _scheduled = true;
  // Use a microtask to batch; fall back to setTimeout for older engines
  Promise.resolve().then(_flush).catch(() => setTimeout(_flush, 0));
}

function _flush() {
  _scheduled = false;
  if (!_onBubble) {
    _queue.clear();
    return;
  }
  // BUG-10 fix: drain Set (was: Array.splice(0))
  const batch = [..._queue];
  _queue.clear();
  for (const el of batch) {
    try {
      _onBubble(el);
    } catch (e) {
      // Never let a bubble error kill the observer loop
      console.warn(`[${_OBS_PFX}] observer handler error`, e);
    }
  }
}

/**
 * Imperatively scan all visible bubbles in the current chat.
 * Called after auto-translate is toggled ON or the user switches chats.
 *
 * @param {Element} [root=document]
 */
function scanExistingBubbles(root = document) {
  const hits = root.querySelectorAll(MSGSEL);
  for (const el of hits) _enqueue(el);
  _scheduleFlush();
}

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
const CACHE_MAX_L2 = (window._twtp && window._twtp.Config && window._twtp.Config.cacheMaxEntries) || 800; // BUG-02 fix: was 2000, now reads from TWTConfig (fallback 800)

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

// §11 — FLOATING UI PANEL
// Phase 4 · non-blocking UI overlay.
//
// Provides:
//   • A draggable floating panel with:
//       - Target language selector
//       - Auto-translate toggle
//       - "Translate page" button
//       - Cache-clear button
//       - Settings link
//   • Per-bubble context menu item (injected via right-click intercept).
//
// No framework — vanilla DOM only.

const PANEL_ID = `${PFX}-panel`;

/**
 * Build and insert the floating control panel.
 * Idempotent — safe to call multiple times.
 *
 * @param {Object} opts
 * @param {string}   opts.tgtLang       - Currently selected target language.
 * @param {boolean}  opts.autoTranslate - Auto-translate enabled?
 * @param {Function} opts.onLangChange  - Called with new lang tag.
 * @param {Function} opts.onAutoToggle  - Called with new boolean.
 * @param {Function} opts.onTranslatePage
 * @param {Function} opts.onCacheClear
 * @param {Function} opts.onSettings
 */
function buildPanel(opts) {
  removePanel();

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="${PFX}-panel-header" title="Drag to move">
      <span>🌐 Translator Pro ${VER}</span>
      <button class="${PFX}-close" title="Close">×</button>
    </div>
    <div class="${PFX}-panel-body">
      <label>
        Target
        <select id="${PFX}-lang-sel">
          ${getLangList().map(l =>
            `<option value="${l.tag}"${l.tag === opts.tgtLang ? ' selected' : ''}>${l.label}</option>`
          ).join('')}
        </select>
      </label>
      <label class="${PFX}-row">
        <input type="checkbox" id="${PFX}-auto"${opts.autoTranslate ? ' checked' : ''}>
        Auto-translate
      </label>
      <button id="${PFX}-btn-page">Translate chat</button>
      <button id="${PFX}-btn-cache">Clear cache</button>
      <button id="${PFX}-btn-settings">⚙️ Settings</button>
    </div>
  `;

  _applyPanelStyles(panel);
  document.body.appendChild(panel);
  _makeDraggable(panel);

  // Wire events
  panel.querySelector(`.${PFX}-close`).onclick = removePanel;
  panel.querySelector(`#${PFX}-lang-sel`).onchange = e => opts.onLangChange(e.target.value);
  panel.querySelector(`#${PFX}-auto`).onchange    = e => opts.onAutoToggle(e.target.checked);
  panel.querySelector(`#${PFX}-btn-page`).onclick   = opts.onTranslatePage;
  panel.querySelector(`#${PFX}-btn-cache`).onclick  = opts.onCacheClear;
  panel.querySelector(`#${PFX}-btn-settings`).onclick = opts.onSettings;

  return panel;
}

function removePanel() {
  document.getElementById(PANEL_ID)?.remove();
}

function isPanelOpen() {
  return !!document.getElementById(PANEL_ID);
}

/**
 * Update the auto-translate checkbox state without rebuilding panel.
 * @param {boolean} val
 */
function setPanelAutoState(val) {
  const cb = document.getElementById(`${PFX}-auto`);
  if (cb) cb.checked = val;
}

// ─ Internal helpers ───────────────────────────────────────

function _applyPanelStyles(panel) {
  Object.assign(panel.style, {
    position:   'fixed',
    top:        '80px',
    right:      '16px',
    zIndex:     '2147483647',
    background: 'var(--color-background, #212121)',
    color:      'var(--color-text, #e0e0e0)',
    border:     '1px solid rgba(255,255,255,.15)',
    borderRadius: '10px',
    boxShadow:  '0 4px 24px rgba(0,0,0,.5)',
    minWidth:   '210px',
    fontFamily: 'inherit',
    fontSize:   '13px',
    userSelect: 'none',
  });
}

function _makeDraggable(panel) {
  const handle = panel.querySelector(`.${PFX}-panel-header`);
  let ox = 0, oy = 0, startX = 0, startY = 0;

  handle.style.cursor = 'move';
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX; startY = e.clientY;
    ox = panel.offsetLeft; oy = panel.offsetTop;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });

  function onMove(e) {
    panel.style.left = `${ox + e.clientX - startX}px`;
    panel.style.top  = `${oy + e.clientY - startY}px`;
    panel.style.right = 'auto';
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
  }
}

// §12 — SETTINGS MANAGER
// Phase 4 · persists user preferences via GM_getValue / GM_setValue.
//
// All settings are flat, JSON-serialisable, versioned.
// Consumers read via getSetting(key) / getAllSettings().
// Writes via setSetting(key, value) — auto-saved, debounced.
//
// BUG-19 patch: added all engine API keys, expanded engine list,
// wrapped as window._twtp.Settings module per registry pattern.

/* global PFX, GM_getValue, GM_setValue */

(function _settingsModule() {
  'use strict';

  const SETTINGS_KEY_GM = `${PFX}_settings`;

  /**
   * Default settings schema.
   * Every key here is guaranteed to exist after init.
   */
  const SETTINGS_DEFAULTS = {
    // Language
    tgtLang:      'en',     // BCP-47 target language
    srcLangHint:  'auto',   // source lang hint ('auto' = detect)

    // Engine selection
    // Valid values: 'google' | 'microsoft' | 'deepl' | 'deeplpro' | 'libre' |
    //               'mymemory' | 'lingva' | 'anthropic' | 'openai' | 'yandex'
    engine:       'google',

    // Google Translate — no key needed (scrape-based)

    // Microsoft / Azure Translator
    azureKey:     '',       // Azure Cognitive Services subscription key
    azureRegion:  '',       // e.g. 'eastus'

    // DeepL Free
    deeplKey:     '',       // DeepL API Free key (ends with :fx)

    // DeepL Pro
    deeplProKey:  '',       // DeepL API Pro key

    // LibreTranslate
    ltHost:       '',       // e.g. 'https://libretranslate.com'
    ltKey:        '',       // optional API key

    // MyMemory — no key needed for basic use

    // Lingva Translate
    lingvaHost:   '',       // e.g. 'https://lingva.ml'

    // OpenAI
    openaiKey:    '',       // sk-... key
    openaiModel:  'gpt-4o-mini', // model ID

    // Anthropic
    anthropicKey: '',       // sk-ant-... key

    // Yandex Translate
    yandexKey:    '',       // IAM or API key

    // Behaviour
    autoTranslate:  false,  // translate new bubbles automatically
    skipOwn:        true,   // don’t translate own messages
    minLength:      3,      // minimum char count to translate

    // UI
    panelOpen:    true,     // show panel on load
    hotkey:       'Alt+T',  // toggle panel hotkey

    // Privacy / Cache
    cacheEnabled: true,     // use translation cache
    cacheTTLDays: 7,
  };

  /** Runtime settings object (merged defaults + persisted). */
  let _settings  = null;
  let _dirty     = false;
  let _saveTimer = null;

  // ─ Init ───────────────────────────────────────────────────────────
  /**
   * Load persisted settings and merge with defaults.
   * Must be called before any getSetting() call.
   */
  function loadSettings() {
    try {
      const raw = typeof GM_getValue === 'function'
        ? GM_getValue(SETTINGS_KEY_GM, '{}')
        : '{}';
      const stored = JSON.parse(raw);
      // Object.assign: defaults first, then stored — unknown keys from stored are kept
      _settings = Object.assign({}, SETTINGS_DEFAULTS, stored);
    } catch {
      _settings = { ...SETTINGS_DEFAULTS };
    }
  }

  // ─ Read ───────────────────────────────────────────────────────────
  /**
   * Get a single setting value.
   * @template {keyof typeof SETTINGS_DEFAULTS} K
   * @param {K} key
   * @returns {typeof SETTINGS_DEFAULTS[K]}
   */
  function getSetting(key) {
    if (!_settings) loadSettings();
    return key in _settings ? _settings[key] : SETTINGS_DEFAULTS[key];
  }

  /** Get all settings as a shallow-copy plain object. */
  function getAllSettings() {
    if (!_settings) loadSettings();
    return { ..._settings };
  }

  // ─ Write ──────────────────────────────────────────────────────────
  /**
   * Set a setting value and schedule a persisted save.
   * @param {string} key
   * @param {*} value
   */
  function setSetting(key, value) {
    if (!_settings) loadSettings();
    _settings[key] = value;
    _dirty = true;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_persistSettings, 800);
  }

  /** Bulk-update settings from a partial object. */
  function applySettings(partial) {
    if (!_settings) loadSettings();
    Object.assign(_settings, partial);
    _dirty = true;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_persistSettings, 800);
  }

  /** Reset all settings to defaults. */
  function resetSettings() {
    _settings = { ...SETTINGS_DEFAULTS };
    _persistSettings();
  }

  function _persistSettings() {
    if (!_dirty) return;
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(SETTINGS_KEY_GM, JSON.stringify(_settings));
      }
      _dirty = false;
    } catch (e) {
      console.warn(`[${PFX}] settings save failed`, e);
    }
  }

  // ─ Public API ─────────────────────────────────────────────────────
  /* exported Settings */
  const Settings = {
    DEFAULTS: SETTINGS_DEFAULTS,
    load:     loadSettings,
    get:      getSetting,
    getAll:   getAllSettings,
    set:      setSetting,
    apply:    applySettings,
    reset:    resetSettings,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Settings;
  } else {
    (window._twtp = window._twtp || {}).Settings = Settings;
  }
}());

// §13 — CONTEXT INJECTION
// Phase 3 · pure string transforms, no DOM.
//
// Problem: Short messages (“Yes”, “OK”, “Thanks”) are ambiguous.
// Translation engines guess poorly without surrounding context.
//
// Solution: Wrap the encoded text in invisible context markers before
// sending to the engine.  The wrapper is stripped from the response
// before display or caching.  The markers never appear in the UI.
//
// Context marker format (invisible to translation engine word-count):
//   CTX_OPEN + contextString + CTX_SEP + encodedText + CTX_CLOSE
//
// We use ASCII pipe chars that survive most engines intact.
// The context string is generated from available metadata.

const CTX_OPEN  = '[[';
const CTX_SEP   = ']]:';
const CTX_CLOSE = ':[[END]]';

// Minimum text length below which we add context
const CTX_THRESHOLD = 40;

/**
 * Wrap encoded text with a context hint if the text is short.
 *
 * @param {string} encoded   - PUA-encoded source text.
 * @param {Object} meta      - Metadata from the extraction record.
 * @param {string} meta.srcLang
 * @param {string} meta.tgtLang
 * @param {string} [meta.senderName]
 * @param {string} [meta.chatTitle]
 * @returns {string}  Possibly wrapped text.
 */
function contextWrap(encoded, meta) {
  // Only inject context for short messages
  if (stripBidi(encoded).replace(/[\uE000-\uF8FF]/g, '').trim().length >= CTX_THRESHOLD) {
    return encoded;
  }

  const hint = _buildHint(meta);
  if (!hint) return encoded;

  return `${CTX_OPEN}${hint}${CTX_SEP}${encoded}${CTX_CLOSE}`;
}

/**
 * Strip context markers from a translated string.
 * Always safe to call even if no markers are present.
 *
 * @param {string} translated
 * @returns {string}
 */
function contextStrip(translated) {
  // Remove any leading context echoes the engine may have included
  // Pattern: [[...]]:<content>:[[END]] or [[...]]:<content>
  return translated
    .replace(/^\[\[[^\]]*\]\]:?/,   '')  // leading [[hint]]:
    .replace(/:?\[\[END\]\]\s*$/,   '')  // trailing :[[END]]
    .trim();
}

// ─ Internal ───────────────────────────────────────────────

function _buildHint({ srcLang, tgtLang, senderName, chatTitle }) {
  const parts = [];

  if (srcLang && srcLang !== 'auto')
    parts.push(`lang:${srcLang}`);
  if (tgtLang)
    parts.push(`to:${tgtLang}`);
  if (chatTitle)
    parts.push(`chat:${chatTitle.slice(0, 24)}`);
  if (senderName)
    parts.push(`from:${senderName.slice(0, 16)}`);

  return parts.join(' ');
}

/**
 * Extract the sender name from a bubble element if possible.
 * Returns empty string if not found or ambiguous.
 *
 * @param {Element} bubbleEl
 * @returns {string}
 */
function getSenderName(bubbleEl) {
  // Telegram Web typically renders sender in .peer-title or .name-inner
  const el = bubbleEl.querySelector('.peer-title, .name-inner, .message-name');
  return el ? el.textContent.trim() : '';
}

/**
 * Extract the chat / channel title from the document.
 * Returns empty string if unavailable.
 *
 * @returns {string}
 */
function getChatTitle() {
  const el = document.querySelector('.peer-title, .chat-info .title');
  return el ? el.textContent.trim() : '';
}

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

// §15 — ASYNC RENDER PIPELINE
// Phase 3 · orchestrates the full extract → translate → inject cycle.
//
// This is the central coordinator called by:
//   • The observer flush (auto-translate)
//   • The “Translate chat” button
//   • Per-bubble right-click actions
//
// Errors are caught per-bubble so one failure never blocks others.
//
// BUG-22 patch: wrapped as IIFE, registered as window._twtp.Renderer
// BUG-23 patch: cache HIT path now stores raw translated string, not
//   the already-recompiled clean string. On hit, full recompile() is
//   called (not recompileSimple) so PUA restore + stash are re-applied
//   correctly. Eliminates double-stripping.

/* global PFX, MSGSEL, extractBubble, isInjected, hasMeaningfulText,
          getSenderName, getChatTitle, contextWrap, translate,
          recompile, recompileSimple, isValidRecompile,
          injectTranslation, cacheKey, cacheGet, cacheSet, getLangDir */

(function _rendererModule() {
  'use strict';

  /**
   * Translate and inject a single bubble element.
   * Checks cache first; falls back to the translation engine.
   *
   * @param {Element} el   - The message bubble element.
   * @param {Object}  cfg  - Merged settings object.
   * @returns {Promise<void>}
   */
  async function renderBubble(el, cfg) {
    // Guard: already translated or no text
    if (isInjected(el)) return;
    if (!hasMeaningfulText(el)) return;

    // Skip own messages if configured
    if (cfg.skipOwn && _isOwnMessage(el)) return;

    // Extraction (read-only DOM pass)
    const record = extractBubble(el);

    // Minimum length guard
    if (record.raw.length < (cfg.minLength || 3)) return;

    const tgtLang = cfg.tgtLang || 'en';
    const tgtDir  = getLangDir(tgtLang);

    // Cache lookup
    // KEY: srcLang + tgtLang + raw source text
    const key = cacheKey(record.srcLang, tgtLang, record.raw);
    if (cfg.cacheEnabled !== false) {
      const hit = cacheGet(key);
      if (hit) {
        // BUG-23 FIX: cache stores the raw engine output (hit.raw) and the
        // original stash (hit.stash) so recompile() can fully re-process.
        // Previously stored 'clean' and called recompileSimple — that
        // caused double PUA-stripping and lost stash restoration.
        const cached = recompile(hit.raw, hit.stash, tgtDir);
        injectTranslation(el, cached, tgtDir, record.srcLang, tgtLang);
        return;
      }
    }

    // Context injection for short messages
    const senderName = getSenderName(el);
    const chatTitle  = getChatTitle();
    const withCtx    = contextWrap(record.encoded, {
      srcLang: record.srcLang,
      tgtLang,
      senderName,
      chatTitle,
    });

    // Translation
    let raw;
    try {
      raw = await translate(withCtx, record.srcLang, tgtLang, cfg);
    } catch (err) {
      console.warn(`[${PFX}] translation failed for bubble`, err);
      return;
    }

    // Recompile: restore stash, decode PUA, fix RTL numerics
    const clean = recompile(raw, record.stash, tgtDir);

    // Validate
    if (!isValidRecompile(clean, record.raw)) return;

    // Cache store — store raw engine output + stash for faithful replay
    if (cfg.cacheEnabled !== false) {
      cacheSet(key, {
        raw:    raw,           // engine output (pre-recompile)
        stash:  record.stash, // non-translatable spans
        tgtLang,
        dir:    tgtDir,
        ts:     Date.now(),
      });
    }

    // DOM injection
    injectTranslation(el, clean, tgtDir, record.srcLang, tgtLang);
  }

  /**
   * Translate all eligible bubbles visible in the document.
   * Fires in small async batches to avoid freezing the UI.
   *
   * @param {Object}   cfg
   * @param {Element}  [root=document]
   * @returns {Promise<void>}
   */
  async function renderAll(cfg, root = document) {
    const bubbles = Array.from(root.querySelectorAll(MSGSEL))
      .filter(el => !isInjected(el) && hasMeaningfulText(el));

    // Process in batches of 5 with a short yield between each
    const BATCH = 5;
    for (let i = 0; i < bubbles.length; i += BATCH) {
      await Promise.allSettled(
        bubbles.slice(i, i + BATCH).map(el => renderBubble(el, cfg))
      );
      // Yield to the browser’s rendering pipeline
      await new Promise(r => setTimeout(r, 50));
    }
  }

  // ─ Helpers ───────────────────────────────────────────────────────

  function _isOwnMessage(el) {
    // Telegram Web marks outgoing messages with .is-out or .out
    return el.classList.contains('is-out')
        || el.classList.contains('out')
        || !!el.closest('.is-out, .out');
  }

  // ─ Public API ────────────────────────────────────────────────────
  /* exported Renderer */
  const Renderer = { renderBubble, renderAll };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Renderer;
  } else {
    (window._twtp = window._twtp || {}).Renderer = Renderer;
  }
}());

// §16 — GESTURE SUPPORT (TOUCH / LONG-PRESS)
// Phase 5 · progressive enhancement — gracefully absent on desktop.
//
// On mobile (Telegram Web PWA / mobile browser):
// • Long-press (500ms) on a message bubble → translate that bubble.
// • Double-tap on a translated bubble → toggle translation visibility.
//
// Never blocks native Telegram gestures (swipe-to-reply, etc.).
//
// BUG-25 patch: replaced anonymous listeners with AbortController so
// teardownGestures() cleanly removes all handlers, preventing memory leaks.
// BUG-20 patch: wrapped as IIFE, no globals leaked.

/* global PFX, MSGSEL, renderBubble, toggleInjection */

(function _gesturesModule() {
  'use strict';

  const LONG_PRESS_MS = 500;
  const DBL_TAP_MS   = 300; // max interval for double-tap

  let _gestureActive = false;
  let _lpTimer       = null;
  let _lastTap       = 0;
  let _tapTarget     = null;
  let _controller    = null; // AbortController for clean teardown

  /**
   * Attach gesture listeners to the root element.
   * Call once from init. Passive listeners only.
   *
   * @param {Element} root  - The messages container.
   * @param {Object}  cfg   - Settings object (passed to renderBubble).
   */
  function initGestures(root, cfg) {
    if (_gestureActive) return;
    _gestureActive = true;

    // AbortController lets us remove all listeners in one call
    _controller = new AbortController();
    const { signal } = _controller;

    root.addEventListener('touchstart',  e => _onTouchStart(e, cfg), { passive: true, signal });
    root.addEventListener('touchend',    e => _onTouchEnd(e, cfg),   { passive: true, signal });
    root.addEventListener('touchmove',   _cancelLongPress,            { passive: true, signal });
    root.addEventListener('touchcancel', _cancelLongPress,            { passive: true, signal });
  }

  /** Remove all gesture listeners and reset state. */
  function teardownGestures() {
    if (_controller) {
      _controller.abort(); // removes all signal-bound listeners atomically
      _controller = null;
    }
    _cancelLongPress();
    _gestureActive = false;
    _lastTap       = 0;
    _tapTarget     = null;
  }

  // ─ Internal ──────────────────────────────────────────────────────

  function _onTouchStart(e, cfg) {
    if (e.touches.length !== 1) { _cancelLongPress(); return; }

    const bubble = _nearestBubble(e.target);
    if (!bubble) return;

    _lpTimer = setTimeout(() => {
      _lpTimer = null;
      _triggerTranslate(bubble, cfg);
    }, LONG_PRESS_MS);
  }

  function _onTouchEnd(e, cfg) {
    const hadTimer = !!_lpTimer; // true = finger lifted before long-press fired
    _cancelLongPress();

    const bubble = _nearestBubble(e.target);
    if (!bubble) return;

    // Double-tap is only a short tap (hadTimer=true), not a completed long-press
    if (hadTimer) {
      const now = Date.now();
      if (now - _lastTap < DBL_TAP_MS && _tapTarget === bubble) {
        // Second tap on same bubble within window — toggle
        const _toggle = window._twtp && window._twtp.toggleInjection
          ? window._twtp.toggleInjection
          : (typeof toggleInjection !== 'undefined' ? toggleInjection : null);
        if (_toggle) _toggle(bubble);
        _lastTap   = 0;
        _tapTarget = null;
      } else {
        _lastTap   = now;
        _tapTarget = bubble;
      }
    }
  }

  function _cancelLongPress() {
    clearTimeout(_lpTimer);
    _lpTimer = null;
  }

  function _nearestBubble(target) {
    const sel = (window._twtp && window._twtp.MSGSEL) || (typeof MSGSEL !== 'undefined' ? MSGSEL : '.message');
    return target && target.closest ? target.closest(sel) : null;
  }

  function _triggerTranslate(bubble, cfg) {
    const _render = window._twtp && window._twtp.renderBubble
      ? window._twtp.renderBubble
      : (typeof renderBubble !== 'undefined' ? renderBubble : null);
    if (!_render) return;
    _render(bubble, cfg).catch(e => console.warn(`[${PFX}] gesture translate error`, e));
  }

  // ─ Public API ─────────────────────────────────────────────────────
  /* exported Gestures */
  const Gestures = { init: initGestures, teardown: teardownGestures };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Gestures;
  } else {
    (window._twtp = window._twtp || {}).Gestures = Gestures;
  }
}());

// 17-hotkeys.js – Keyboard shortcut handler
// Part of telegram-web-translator-pro v4.0.0

'use strict';

(function _hotkeyModule() {

  // ── Hotkey registry ──────────────────────────────────────────────────────
  const _registry = new Map(); // key: combo string → value: handler fn

  /**
   * Normalise a keyboard event into a canonical combo string.
   * Examples:  "Alt+KeyT"  |  "Shift+Alt+KeyT"  |  "Escape"
   * @param {KeyboardEvent} e
   * @returns {string}
   */
  function _comboOf(e) {
    const parts = [];
    if (e.ctrlKey  || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey)              parts.push('Shift');
    if (e.altKey)                parts.push('Alt');
    parts.push(e.code || e.key);
    return parts.join('+');
  }

  /**
   * Register a hotkey combo.
   * @param {string}   combo   – e.g. "Alt+KeyT"
   * @param {Function} handler – called with the KeyboardEvent
   * @param {string}  [desc]   – human-readable description (for UI)
   */
  function register(combo, handler, desc) {
    _registry.set(combo, { handler, desc: desc || combo });
  }

  /**
   * Unregister a previously registered combo.
   * @param {string} combo
   */
  function unregister(combo) {
    _registry.delete(combo);
  }

  // ── Global keydown listener ───────────────────────────────────────────────
  function _onKeyDown(e) {
    // Skip when user is typing in a real input / contentEditable
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.target && e.target.isContentEditable) return;

    const combo = _comboOf(e);
    const entry = _registry.get(combo);
    if (entry) {
      e.preventDefault();
      e.stopPropagation();
      try { entry.handler(e); } catch (err) {
        console.warn('[hotkeys] handler error for', combo, err);
      }
    }
  }

  // ── Built-in bindings (registered at init time via 20-init.js) ───────────
  /**
   * Register the default translator hotkeys.
   * Called from 20-init.js after all modules are ready.
   */
  function registerDefaults() {
    // Alt+T  – translate hovered / selected bubble
    register('Alt+KeyT', () => {
      const bubble = _lastHovered();
      if (bubble) window._twtp && window._twtp.toggleInjection(bubble);
    }, 'Translate hovered message (Alt+T)');

    // Alt+Shift+T – translate all visible bubbles
    register('Alt+Shift+KeyT', () => {
      document.querySelectorAll(window._twtp
        ? window._twtp.MSGSEL : '.message').forEach(b => {
        window._twtp && window._twtp.toggleInjection(b);
      });
    }, 'Translate all visible messages (Alt+Shift+T)');

    // Alt+C – clear all injected translations
    register('Alt+KeyC', () => {
      window._twtp && window._twtp.clearAll && window._twtp.clearAll();
    }, 'Clear all translations (Alt+C)');

    // Alt+S – open settings panel
    register('Alt+KeyS', () => {
      window._twtp && window._twtp.openSettings && window._twtp.openSettings();
    }, 'Open settings (Alt+S)');

    // Escape – close floating panels
    register('Escape', () => {
      window._twtp && window._twtp.closePanels && window._twtp.closePanels();
    }, 'Close panels (Escape)');
  }

  // ── Track last hovered message bubble ────────────────────────────────────
  let _hoveredBubble = null;

  function _lastHovered() { return _hoveredBubble; }

  function _trackHover() {
    document.addEventListener('mouseover', e => {
      const MSGSEL = window._twtp ? window._twtp.MSGSEL : '.message';
      const bubble = e.target && e.target.closest
        ? e.target.closest(MSGSEL) : null;
      if (bubble) _hoveredBubble = bubble;
    }, { passive: true, capture: true });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    document.addEventListener('keydown', _onKeyDown, true);
    _trackHover();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  /* exported HotkeyManager */
  const HotkeyManager = { init, register, unregister, registerDefaults };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HotkeyManager;
  } else {
    (window._twtp = window._twtp || {}).HotkeyManager = HotkeyManager;
  }

}());

// 18-perf.js – Performance utilities (debounce, throttle, idle scheduling)
// Part of telegram-web-translator-pro v4.0.0

'use strict';

(function _perfModule() {

  // ── debounce ───────────────────────────────────────────────────────────────────
  /**
   * Returns a debounced version of `fn` that delays invoking until
   * `wait` ms have elapsed since the last call.
   * @param {Function} fn
   * @param {number}   wait  milliseconds
   * @returns {Function}
   */
  function debounce(fn, wait) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => { timer = null; fn.apply(this, args); }, wait);
    };
  }

  // ── throttle ───────────────────────────────────────────────────────────────────
  /**
   * Returns a throttled version of `fn` that invokes at most once per
   * `limit` ms (leading edge).
   * @param {Function} fn
   * @param {number}   limit  milliseconds
   * @returns {Function}
   */
  function throttle(fn, limit) {
    let lastCall = 0;
    let timer    = null;
    return function throttled(...args) {
      const now = Date.now();
      const remaining = limit - (now - lastCall);
      if (remaining <= 0) {
        clearTimeout(timer);
        timer    = null;
        lastCall = now;
        fn.apply(this, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          lastCall = Date.now();
          timer    = null;
          fn.apply(this, args);
        }, remaining);
      }
    };
  }

  // ── scheduleIdle ─────────────────────────────────────────────────────────────
  /**
   * Schedule `fn` to run when the browser is idle (or after `timeout` ms).
   * Falls back to setTimeout when requestIdleCallback is unavailable.
   * @param {Function} fn
   * @param {number}  [timeout=2000]
   */
  function scheduleIdle(fn, timeout) {
    const t = timeout !== undefined ? timeout : 2000;
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fn, { timeout: t });
    } else {
      setTimeout(fn, 0);
    }
  }

  // ── scheduleFrame ────────────────────────────────────────────────────────────
  /**
   * Schedule `fn` on the next animation frame.
   * Useful for DOM mutations that must not block input.
   * @param {Function} fn
   */
  function scheduleFrame(fn) {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(fn);
    } else {
      setTimeout(fn, 16);
    }
  }

  // ── measureAsync ────────────────────────────────────────────────────────────
  /**
   * Measure execution time of an async function and log it.
   * No-op in production (when TWTConfig.DEBUG is falsy).
   * @param {string}   label
   * @param {Function} asyncFn  must return a Promise
   * @returns {Promise<*>}
   */
  async function measureAsync(label, asyncFn) {
    const debug = typeof TWTConfig !== 'undefined' && TWTConfig.DEBUG;
    if (!debug) return asyncFn();
    const t0 = performance.now();
    try {
      const result = await asyncFn();
      console.debug(`[perf] ${label}: ${(performance.now() - t0).toFixed(1)} ms`);
      return result;
    } catch (e) {
      console.debug(`[perf] ${label} ERROR after ${(performance.now() - t0).toFixed(1)} ms`);
      throw e;
    }
  }

  // ── batchMicro ──────────────────────────────────────────────────────────────────
  /**
   * Queue items and flush them via the microtask queue.
   * Useful when many observer callbacks fire in the same tick.
   * @param {Function} flushFn  called with the accumulated array
   * @returns {{ enqueue(item): void, flush(): void }}
   */
  function batchMicro(flushFn) {
    let queue    = [];
    let pending  = false;
    function enqueue(item) {
      queue.push(item);
      if (!pending) {
        pending = true;
        Promise.resolve().then(() => {
          const items = queue;
          queue   = [];
          pending = false;
          try { flushFn(items); } catch (e) {
            console.warn('[perf.batchMicro] flush error', e);
          }
        });
      }
    }
    function flush() {
      if (queue.length) {
        const items = queue;
        queue   = [];
        pending = false;
        flushFn(items);
      }
    }
    return { enqueue, flush };
  }

  // ── Public API ────────────────────────────────────────────────────────────
  /* exported Perf */
  const Perf = { debounce, throttle, scheduleIdle, scheduleFrame, measureAsync, batchMicro };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Perf;
  } else {
    (window._twtp = window._twtp || {}).Perf = Perf;
  }

}());

// 19-compat.js – Browser / userscript compatibility shims
// Part of telegram-web-translator-pro v4.0.0

'use strict';

(function _compatModule() {

  // ── GM API shims ──────────────────────────────────────────────────────────────────
  // Normalise GM_xmlhttpRequest vs GM.xmlHttpRequest (Violentmonkey / Tampermonkey)
  const _gmXhr =
    (typeof GM !== 'undefined' && GM.xmlHttpRequest) ||
    (typeof GM_xmlhttpRequest !== 'undefined' && GM_xmlhttpRequest) ||
    null;

  /**
   * Perform a cross-origin XHR via the userscript GM API.
   * Falls back to fetch() when running outside a userscript context.
   * @param {object} opts  – same shape as GM_xmlhttpRequest options
   * @returns {Promise<{status, responseText, responseHeaders}>}
   */
  function gmFetch(opts) {
    return new Promise((resolve, reject) => {
      if (_gmXhr) {
        _gmXhr(Object.assign({}, opts, {
          onload:   r  => resolve(r),
          onerror:  e  => reject(e),
          ontimeout: () => reject(new Error('GM xhr timeout')),
        }));
      } else {
        // Fallback: native fetch (same-origin only)
        fetch(opts.url, {
          method:  opts.method || 'GET',
          headers: opts.headers || {},
          body:    opts.data || undefined,
        })
          .then(async r => resolve({
            status:          r.status,
            responseText:    await r.text(),
            responseHeaders: '',
          }))
          .catch(reject);
      }
    });
  }

  // ── GM_setValue / GM_getValue shims ──────────────────────────────────────────
  const _gmSetValue =
    (typeof GM !== 'undefined' && GM.setValue) ||
    (typeof GM_setValue !== 'undefined' && (k, v) => Promise.resolve(GM_setValue(k, v))) ||
    ((k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} return Promise.resolve(); });

  const _gmGetValue =
    (typeof GM !== 'undefined' && GM.getValue) ||
    (typeof GM_getValue !== 'undefined' && (k, d) => Promise.resolve(GM_getValue(k, d))) ||
    ((k, d) => { try { const s = localStorage.getItem(k); return Promise.resolve(s !== null ? JSON.parse(s) : d); } catch (_) { return Promise.resolve(d); } });

  /**
   * Persist a key/value pair using the best available storage.
   * @param {string} key
   * @param {*}      value
   * @returns {Promise<void>}
   */
  function setValue(key, value) {
    return Promise.resolve(_gmSetValue(key, value));
  }

  /**
   * Retrieve a stored value.
   * @param {string} key
   * @param {*}      defaultValue
   * @returns {Promise<*>}
   */
  function getValue(key, defaultValue) {
    return Promise.resolve(_gmGetValue(key, defaultValue));
  }

  // ── Intl.Segmenter shim ──────────────────────────────────────────────────────────
  /**
   * True when Intl.Segmenter with word granularity is available.
   */
  const hasIntlSegmenter = (() => {
    try {
      const s = new Intl.Segmenter('en', { granularity: 'word' });
      return typeof s.segment === 'function';
    } catch (_) { return false; }
  })();

  // ── CSS.supports shim ──────────────────────────────────────────────────────────────
  /**
   * Safe CSS.supports wrapper – returns false when API is unavailable.
   * @param {string} prop
   * @param {string} value
   * @returns {boolean}
   */
  function cssSupports(prop, value) {
    try { return CSS.supports(prop, value); } catch (_) { return false; }
  }

  // ── Feature flags (evaluated once at load time) ───────────────────────────
  const features = {
    intlSegmenter:         hasIntlSegmenter,
    cssWritingMode:        cssSupports('writing-mode', 'vertical-rl'),
    cssLogicalProps:       cssSupports('margin-inline-start', '0'),
    mutationObserver:      typeof MutationObserver !== 'undefined',
    intersectionObserver:  typeof IntersectionObserver !== 'undefined',
    requestIdleCallback:   typeof requestIdleCallback !== 'undefined',
    requestAnimFrame:      typeof requestAnimationFrame !== 'undefined',
    gmXhr:                 _gmXhr !== null,
  };

  // ── Public API ────────────────────────────────────────────────────────────
  /* exported Compat */
  const Compat = { gmFetch, setValue, getValue, cssSupports, features };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Compat;
  } else {
    (window._twtp = window._twtp || {}).Compat = Compat;
  }

}());

// 20-init.js – Bootstrap & wiring for telegram-web-translator-pro v4.0.0
// Runs after all modules have been concatenated into the final userscript.

'use strict';

(function _initModule() {

  // ── Convenience aliases ──────────────────────────────────────────────────────────
  const ns = window._twtp || {};

  function _get(name) {
    const m = ns[name];
    if (!m) console.warn('[init] module not found:', name);
    return m || {};
  }

  // ── Boot sequence ──────────────────────────────────────────────────────────────────
  async function _boot() {
    try {
      console.log('[twtp] booting v4.0.0 …');

      // 1. Load persisted settings
      const Settings = _get('Settings');
      if (Settings.load) await Settings.load();

      // 2. Inject global CSS (UI chrome + bidi helpers)
      const UI = _get('UI');
      if (UI.injectStyles) UI.injectStyles();

      // 3. Initialise gesture handler
      const GestureHandler = _get('GestureHandler');
      if (GestureHandler.init) GestureHandler.init();

      // 4. Initialise hotkeys
      const HotkeyManager = _get('HotkeyManager');
      if (HotkeyManager.init)             HotkeyManager.init();
      if (HotkeyManager.registerDefaults) HotkeyManager.registerDefaults();

      // 5. Start the DOM observer
      const Observer = _get('Observer');
      if (Observer.start) Observer.start();

      // 6. Expose a minimal public surface on window._twtp for inter-module calls
      const Injector    = _get('Injector');
      const Renderer    = _get('Renderer');
      const Cache       = _get('Cache');
      const ContextMgr  = _get('ContextMgr');

      Object.assign(ns, {
        // Selector used by gestures / hotkeys
        MSGSEL: (typeof TWTConfig !== 'undefined' && TWTConfig.MSGSEL) ||
                '.message.spoilers-container',

        // Public actions
        toggleInjection: bubble => {
          if (!bubble) return;
          const Injector_ = _get('Injector');
          if (Injector_.isInjected && Injector_.isInjected(bubble)) {
            Injector_.remove && Injector_.remove(bubble);
          } else {
            Injector_.inject && Injector_.inject(bubble, Settings.get ? Settings.get() : {});
          }
        },
        clearAll: () => {
          document.querySelectorAll(ns.MSGSEL).forEach(b => {
            Injector.remove && Injector.remove(b);
          });
          Cache.clear && Cache.clear();
        },
        openSettings: () => { UI.openPanel && UI.openPanel(); },
        closePanels:  () => { UI.closePanel && UI.closePanel(); },
      });

      console.log('[twtp] ready.');
    } catch (err) {
      console.error('[twtp] boot error:', err);
    }
  }

  // ── Entry point ───────────────────────────────────────────────────────────────────
  // Telegram Web loads its React tree asynchronously; wait for the first
  // message container to appear before starting the observer.
  function _waitForApp(cb) {
    const READY_SEL = '.messages-container, #app, .chat-list';
    if (document.querySelector(READY_SEL)) {
      cb();
      return;
    }
    const mo = new MutationObserver(() => {
      if (document.querySelector(READY_SEL)) {
        mo.disconnect();
        cb();
      }
    });
    mo.observe(document.body || document.documentElement, {
      childList: true, subtree: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => _waitForApp(_boot));
  } else {
    _waitForApp(_boot);
  }

}());

// 21-footer.js – Userscript closing wrapper
// Part of telegram-web-translator-pro v4.0.0
//
// This file is the LAST chunk concatenated by build.js.
// It closes the top-level IIFE opened in 00-header.js and adds
// a small self-test / version banner to the browser console.

/* ---- close the top-level IIFE from 00-header.js ---- */

  // ── Version banner (console only) ─────────────────────────────────────────────
  (function _banner() {
    const VER  = (typeof GM_info !== 'undefined' && GM_info.script)
      ? GM_info.script.version
      : '4.0.0';
    const NAME = 'telegram-web-translator-pro';
    /* eslint-disable no-console */
    console.log(
      `%c ${NAME} v${VER} %c loaded`,
      'background:#0088cc;color:#fff;font-weight:bold;border-radius:3px 0 0 3px;padding:2px 6px',
      'background:#222;color:#aaa;border-radius:0 3px 3px 0;padding:2px 6px',
    );
    /* eslint-enable no-console */
  }());

  // ── Sanity self-test (DEBUG builds only) ──────────────────────────────────────
  (function _selfTest() {
    if (typeof TWTConfig === 'undefined' || !TWTConfig.DEBUG) return;
    const ns    = window._twtp || {};
    const mods  = [
      'LangMap', 'Bidi', 'Segmenter', 'PUA', 'Extractor',
      'Translator', 'Injector', 'Observer', 'Cache', 'UI',
      'Settings', 'ContextMgr', 'Recompiler', 'Renderer',
      'GestureHandler', 'HotkeyManager', 'Perf', 'Compat',
    ];
    const missing = mods.filter(m => !ns[m]);
    if (missing.length) {
      console.warn('[twtp] missing modules at footer:', missing.join(', '));
    } else {
      console.debug('[twtp] all modules registered OK');
    }
  }());

// ─── end of telegram-web-translator-pro ─────────────────────────────────────────────────
// The top-level IIFE wrapper (opened in 00-header.js) is closed below.
}()); // ← matches:  (function(){ ‘use strict’;  in 00-header.js

// 22-engines.js — Multi-Engine Translation Adapter Registry (v4.2.0)
// Registers all supported translation engines with a unified async interface.
// Each engine exposes: { name, translate(text, from, to) => Promise<string> }
//
// Fixes applied (2026-06-18):
//   BUG-01: Renamed 'microsoft' → 'azure' to match ENGINES[] id in 01-constants.js
//   BUG-03: Implemented 6 missing engines: mymemory, lingva, deepl_pro, openai, anthropic, yandex

'use strict';

window._twtp = window._twtp || {};

window._twtp.Engines = (function () {
  const ENGINES = {};

  function register(engine) {
    if (!engine || !engine.name || typeof engine.translate !== 'function') {
      console.warn('[TWT:engines] Invalid engine registration:', engine);
      return;
    }
    ENGINES[engine.name] = engine;
  }

  function get(name) {
    return ENGINES[name] || null;
  }

  function list() {
    return Object.keys(ENGINES);
  }

  // ——— Helper: read Settings safely ———
  function _cfg(key) {
    return (window._twtp.Settings && window._twtp.Settings.get(key)) || '';
  }

  // ——— Google Translate (free endpoint) ———
  register({
    name: 'google',
    translate(text, from, to) {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          onload(res) {
            try {
              const data = JSON.parse(res.responseText);
              resolve(data[0].map(s => s[0]).join(''));
            } catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— DeepL Free API ———
  register({
    name: 'deepl',
    translate(text, from, to) {
      const apiKey = _cfg('deeplApiKey');
      if (!apiKey) return Promise.reject(new Error('DeepL: no API key configured'));
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://api-free.deepl.com/v2/translate',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          data: `auth_key=${encodeURIComponent(apiKey)}&text=${encodeURIComponent(text)}&source_lang=${from.toUpperCase()}&target_lang=${to.toUpperCase()}`,
          onload(res) {
            try { resolve(JSON.parse(res.responseText).translations[0].text); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— DeepL Pro API (BUG-03 fix) ———
  register({
    name: 'deepl_pro',
    translate(text, from, to) {
      const apiKey = _cfg('deeplProApiKey');
      if (!apiKey) return Promise.reject(new Error('DeepL Pro: no API key configured'));
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://api.deepl.com/v2/translate',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          data: `auth_key=${encodeURIComponent(apiKey)}&text=${encodeURIComponent(text)}&source_lang=${from.toUpperCase()}&target_lang=${to.toUpperCase()}`,
          onload(res) {
            try { resolve(JSON.parse(res.responseText).translations[0].text); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— MyMemory (free, no key required) (BUG-03 fix) ———
  register({
    name: 'mymemory',
    translate(text, from, to) {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          onload(res) {
            try { resolve(JSON.parse(res.responseText).responseData.translatedText); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— Lingva (free Google proxy) (BUG-03 fix) ———
  register({
    name: 'lingva',
    translate(text, from, to) {
      const host = _cfg('lingvaHost') || 'https://lingva.ml';
      const url = `${host}/api/v1/${from}/${to}/${encodeURIComponent(text)}`;
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          onload(res) {
            try { resolve(JSON.parse(res.responseText).translation); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— LibreTranslate (self-hosted / public) ———
  register({
    name: 'libretranslate',
    translate(text, from, to) {
      const host = _cfg('libreHost') || 'https://libretranslate.com';
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: `${host}/translate`,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({ q: text, source: from, target: to, format: 'text' }),
          onload(res) {
            try { resolve(JSON.parse(res.responseText).translatedText); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— Azure Cognitive Services (BUG-01 fix: was 'microsoft') ———
  register({
    name: 'azure',
    translate(text, from, to) {
      const apiKey = _cfg('msApiKey');
      const region = _cfg('msRegion') || 'eastus';
      if (!apiKey) return Promise.reject(new Error('Azure: no API key configured'));
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${from}&to=${to}`,
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': apiKey,
            'Ocp-Apim-Subscription-Region': region,
          },
          data: JSON.stringify([{ Text: text }]),
          onload(res) {
            try { resolve(JSON.parse(res.responseText)[0].translations[0].text); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— OpenAI GPT-4o (BUG-03 fix) ———
  register({
    name: 'openai',
    translate(text, from, to) {
      const apiKey = _cfg('openaiApiKey');
      if (!apiKey) return Promise.reject(new Error('OpenAI: no API key configured'));
      const body = {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: `Translate the following text from ${from} to ${to}. Output only the translation, no explanations.` },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
      };
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://api.openai.com/v1/chat/completions',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          data: JSON.stringify(body),
          onload(res) {
            try { resolve(JSON.parse(res.responseText).choices[0].message.content.trim()); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— Anthropic Claude (BUG-03 fix) ———
  register({
    name: 'anthropic',
    translate(text, from, to) {
      const apiKey = _cfg('anthropicApiKey');
      if (!apiKey) return Promise.reject(new Error('Anthropic: no API key configured'));
      const body = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: `Translate from ${from} to ${to}. Output only the translation:\n\n${text}` },
        ],
      };
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://api.anthropic.com/v1/messages',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          data: JSON.stringify(body),
          onload(res) {
            try { resolve(JSON.parse(res.responseText).content[0].text.trim()); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— Yandex Translate (BUG-03 fix) ———
  register({
    name: 'yandex',
    translate(text, from, to) {
      const apiKey = _cfg('yandexApiKey');
      if (!apiKey) return Promise.reject(new Error('Yandex: no API key configured'));
      const folderId = _cfg('yandexFolderId') || '';
      const body = { targetLanguageCode: to, sourceLanguageCode: from, texts: [text], folderId };
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://translate.api.cloud.yandex.net/translate/v2/translate',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Api-Key ${apiKey}` },
          data: JSON.stringify(body),
          onload(res) {
            try { resolve(JSON.parse(res.responseText).translations[0].text); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  return { register, get, list };
})();

// 23-adapter.js — App Adapter (Telegram Web A & K selector unification)
// Provides a unified selector/DOM API over both Telegram Web A and K variants.
//
// BUG-15 fix: observeChat() REMOVED. All observation goes through 09-observer.js.
//   This file is now a pure selector/DOM-access layer with zero observer logic.
// BUG-16 fix: setBubbleTranslation/toggleBubble rewritten to use overlay <span>
//   so the original DOM structure (bold, italic, emoji, mentions) is preserved.
// BUG-17 fix: variant is no longer cached at IIFE load time. _getVariant() is
//   called lazily at each sel() invocation, with DOM-sniff fallback.

'use strict';

window._twtp = window._twtp || {};

window._twtp.Adapter = (function () {

  // ── Selector maps ────────────────────────────────────────────────────────────
  const SELECTORS = {
    A: {
      messageContainer: '.messages-container',
      messageBubble:    '.message.spoilers-container',
      messageText:      '.text-content',
      inputBox:         '#editable-message-text',
      chatList:         '.chatlist-top',
      replyWrapper:     '.reply-markup',
      mediaCaption:     '.media-caption',
    },
    K: {
      messageContainer: '.bubbles',
      messageBubble:    '.bubble',
      messageText:      '.message',
      inputBox:         '.input-message-input',
      chatList:         '.chatlist',
      replyWrapper:     '.reply-markup',
      mediaCaption:     '.caption',
    },
  };

  /**
   * BUG-17 fix: Determine app variant lazily at call time.
   * Priority: explicit flag > DOM sniff (K has .bubbles, A has .messages-container).
   * Never cached — called fresh per sel() invocation so it works even if the
   * flag is set after the IIFE fires.
   * @returns {'A'|'K'}
   */
  function _getVariant() {
    if (window.__TWT_APP_VARIANT__) return window.__TWT_APP_VARIANT__;
    // DOM sniff: Telegram Web K uses .bubbles as its main container
    if (document.querySelector('.bubbles')) return 'K';
    return 'A';
  }

  function sel(key) {
    const map = SELECTORS[_getVariant()] || SELECTORS.A;
    return map[key] || null;
  }

  function queryAll(key, root) {
    const s = sel(key);
    if (!s) return [];
    return Array.from((root || document).querySelectorAll(s));
  }

  function query(key, root) {
    const s = sel(key);
    if (!s) return null;
    return (root || document).querySelector(s);
  }

  // ── Bubble access ────────────────────────────────────────────────────────────

  /** Returns all visible message bubble elements in the current chat view. */
  function getBubbles() {
    return queryAll('messageBubble');
  }

  /** Extract plain text from a bubble (read-only). */
  function getBubbleText(bubble) {
    const textEl = bubble.querySelector(sel('messageText'));
    return textEl ? textEl.innerText.trim() : '';
  }

  // ── Translation overlay ───────────────────────────────────────────────────────
  //
  // BUG-16 fix: instead of replacing textEl.textContent (which destroys Telegram's
  // inline formatting, custom emoji <img>, mention <a> nodes), we now INSERT a
  // <span data-twt-overlay> AFTER the text element.  The original DOM is untouched.
  // toggling simply hides/shows the overlay span and the original text element.

  const OVERLAY_ATTR = 'data-twt-overlay';
  const ORIG_HIDDEN  = 'data-twt-orig-hidden';

  /**
   * Inject a translated text overlay after the message text element.
   * Original content is NOT modified — the overlay is appended as a sibling.
   *
   * BUG-16 fix: was textEl.textContent = translatedText (destroyed formatting).
   *
   * @param {Element} bubble
   * @param {string}  translatedText  Clean translated string.
   */
  function setBubbleTranslation(bubble, translatedText) {
    const textEl = bubble.querySelector(sel('messageText'));
    if (!textEl) return;

    // Remove any previous overlay (idempotent)
    _removeOverlay(bubble);

    // Build overlay element
    const overlay = document.createElement('span');
    overlay.setAttribute(OVERLAY_ATTR, '1');
    overlay.textContent = translatedText;
    overlay.style.cssText = [
      'display:block',
      'margin-top:3px',
      'padding:2px 6px',
      'border-left:2px solid var(--color-primary,#5288c1)',
      'font-size:.93em',
      'opacity:.92',
      'white-space:pre-wrap',
      'word-break:break-word',
    ].join(';');

    // Insert overlay as next sibling of textEl (never inside it)
    textEl.insertAdjacentElement('afterend', overlay);
    bubble.dataset.twtShowing  = 'translated';
    bubble.setAttribute('data-twt', '1');
  }

  /**
   * Toggle the overlay visibility.
   * BUG-16 fix: original DOM is never touched; we only show/hide the overlay.
   *
   * @param {Element} bubble
   * @returns {boolean}  true = translation now visible, false = hidden.
   */
  function toggleBubble(bubble) {
    const overlay = bubble.querySelector(`[${OVERLAY_ATTR}]`);
    if (!overlay) return false;

    const isHidden = overlay.style.display === 'none';
    overlay.style.display = isHidden ? '' : 'none';
    bubble.dataset.twtShowing = isHidden ? 'translated' : 'original';
    return isHidden;
  }

  /** Remove the overlay element if present. */
  function _removeOverlay(bubble) {
    bubble.querySelectorAll(`[${OVERLAY_ATTR}]`).forEach(n => n.remove());
    delete bubble.dataset.twtShowing;
    bubble.removeAttribute('data-twt');
  }

  // ── DEPRECATED: observeChat() removed (BUG-15 fix) ─────────────────────────────
  // Previously contained its own MutationObserver which ran in parallel with
  // 09-observer.js, causing double-processing of every bubble.  All observation
  // must go through startObserver() / stopObserver() in 09-observer.js.
  //
  // If you need a reference to the message container element, use:
  //   window._twtp.Adapter.query('messageContainer')
  // ───────────────────────────────────────────────────────────────────────────────

  return {
    // Selectors
    sel,
    query,
    queryAll,
    // Bubble access
    getBubbles,
    getBubbleText,
    // Translation overlay (BUG-16 fixed)
    setBubbleTranslation,
    toggleBubble,
    // Variant (BUG-17: now a getter, not a cached string)
    get variant() { return _getVariant(); },
  };

}());

// 24-a11y.js — Accessibility Layer (v4.1.0)
// Adds ARIA labels, keyboard navigation, and screen-reader support
// to TWT-injected UI elements. Zero impact on Telegram's native a11y.

'use strict';

window._twtp = window._twtp || {};

window._twtp.A11y = (function () {
  let _initialized = false;

  // ——— ARIA helpers ———
  function ariaLabel(el, label) {
    if (el && !el.getAttribute('aria-label')) el.setAttribute('aria-label', label);
  }

  function ariaLive(el, politeness) {
    if (el) el.setAttribute('aria-live', politeness || 'polite');
  }

  function role(el, r) {
    if (el && !el.getAttribute('role')) el.setAttribute('role', r);
  }

  // ——— Annotate TWT UI elements with ARIA ———
  function annotateUI() {
    const fab = document.getElementById('twt-fab');
    if (fab) {
      ariaLabel(fab, 'Telegram Web Translator — open settings');
      role(fab, 'button');
      if (!fab.hasAttribute('tabindex')) fab.setAttribute('tabindex', '0');
    }

    const panel = document.getElementById('twt-panel');
    if (panel) {
      ariaLabel(panel, 'Translation settings panel');
      role(panel, 'dialog');
      panel.setAttribute('aria-modal', 'true');
      ariaLive(panel, 'polite');
    }

    const statusBar = document.getElementById('twt-status');
    if (statusBar) {
      role(statusBar, 'status');
      ariaLive(statusBar, 'polite');
    }
  }

  // ——— Annotate translated bubbles ———
  function annotateBubble(bubble) {
    if (!bubble || bubble.dataset.twtA11y) return;
    bubble.setAttribute('data-twt-a11y', '1');
    const original = bubble.querySelector('[data-twt-original]');
    if (original) {
      original.setAttribute('aria-label', `Translated message: ${original.textContent}`);
    }
    // Add toggle button hint for screen readers
    if (!bubble.querySelector('.twt-a11y-hint')) {
      const hint = document.createElement('span');
      hint.className = 'twt-a11y-hint';
      hint.setAttribute('aria-hidden', 'false');
      hint.textContent = ' [translated — press T to toggle]';
      hint.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;';
      bubble.appendChild(hint);
    }
  }

  // ——— Keyboard trap management for panel ———
  function trapFocus(panel) {
    if (!panel) return;
    const focusable = panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    panel.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  // ——— FAB keyboard activation ———
  function enableFABKeyboard() {
    const fab = document.getElementById('twt-fab');
    if (!fab) return;
    fab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fab.click();
      }
    });
  }

  function init() {
    if (_initialized) return;
    _initialized = true;
    // Annotate existing UI
    annotateUI();
    enableFABKeyboard();
    // Re-annotate when panel opens (observe body for twt-panel insertion)
    const observer = new MutationObserver(() => {
      annotateUI();
      trapFocus(document.getElementById('twt-panel'));
    });
    observer.observe(document.body, { childList: true, subtree: false });
  }

  return { init, annotateUI, annotateBubble, trapFocus };
})();

// 25-dragdrop.js — Drag & Drop Support (v4.1.0)
// Enables drag-and-drop of text/files onto the TWT panel or Telegram chat area.
// Supports: plain text drops (auto-translate), image drops (future: OCR pipeline).

'use strict';

window._twtp = window._twtp || {};

window._twtp.DragDrop = (function () {
  let _initialized = false;

  // Visual feedback CSS classes
  const CSS_DRAGOVER = 'twt-dragover';

  function _injectStyles() {
    if (document.getElementById('twt-dragdrop-styles')) return;
    const style = document.createElement('style');
    style.id = 'twt-dragdrop-styles';
    style.textContent = `
      .${CSS_DRAGOVER} {
        outline: 2px dashed #5288c1 !important;
        background: rgba(82,136,193,0.08) !important;
        transition: background 0.15s;
      }
    `;
    document.head.appendChild(style);
  }

  // ——— Attach drag-and-drop to an element ———
  function attach(el, opts) {
    if (!el || el.dataset.twtDnd) return;
    el.dataset.twtDnd = '1';

    el.addEventListener('dragenter', (e) => {
      e.preventDefault();
      el.classList.add(CSS_DRAGOVER);
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    el.addEventListener('dragleave', (e) => {
      // Only remove if leaving the element entirely
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove(CSS_DRAGOVER);
      }
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove(CSS_DRAGOVER);
      _handleDrop(e, opts);
    });
  }

  function _handleDrop(e, opts) {
    const dt = e.dataTransfer;
    // Text drop
    if (dt.types.includes('text/plain')) {
      const text = dt.getData('text/plain').trim();
      if (text && opts && typeof opts.onText === 'function') {
        opts.onText(text);
      } else if (text) {
        _defaultTextDrop(text);
      }
      return;
    }
    // File drop (images, future OCR)
    if (dt.files && dt.files.length > 0) {
      Array.from(dt.files).forEach((file) => {
        if (file.type.startsWith('image/')) {
          if (opts && typeof opts.onImage === 'function') {
            opts.onImage(file);
          } else {
            console.log('[TWT:dragdrop] Image dropped (OCR pipeline pending):', file.name);
          }
        }
      });
    }
  }

  // Default text drop: auto-translate using active engine
  function _defaultTextDrop(text) {
    const engines = window._twtp && window._twtp.Engines;
    const settings = window._twtp && window._twtp.Settings;
    if (!engines || !settings) {
      console.warn('[TWT:dragdrop] Engines/Settings not ready');
      return;
    }
    const engineName = settings.get('engine') || 'google';
    const targetLang = settings.get('targetLang') || 'en';
    const engine = engines.get(engineName);
    if (!engine) return;
    engine.translate(text, 'auto', targetLang)
      .then((result) => {
        // Copy to clipboard and notify
        navigator.clipboard.writeText(result).catch(() => {});
        const ui = window._twtp && window._twtp.UI;
        if (ui && ui.showToast) ui.showToast(`Translated: ${result.slice(0, 80)}…`);
        else console.log('[TWT:dragdrop] Translation:', result);
      })
      .catch((err) => console.error('[TWT:dragdrop] Translation error:', err));
  }

  function init() {
    if (_initialized) return;
    _initialized = true;
    _injectStyles();

    // Attach to TWT panel if present
    const panel = document.getElementById('twt-panel');
    if (panel) attach(panel, {});

    // Watch for panel insertion
    const observer = new MutationObserver(() => {
      const p = document.getElementById('twt-panel');
      if (p && !p.dataset.twtDnd) attach(p, {});
    });
    observer.observe(document.body, { childList: true, subtree: false });
  }

  return { init, attach };
})();
