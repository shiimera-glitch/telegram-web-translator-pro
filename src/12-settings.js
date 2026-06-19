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
