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
