// §12 — SETTINGS MANAGER
// Phase 4 · persists user preferences via GM_getValue / GM_setValue.
//
// All settings are flat, JSON-serialisable, versioned.
// Consumers read via getSetting(key) / getAllSettings().
// Writes via setSetting(key, value) — auto-saved, debounced.

const SETTINGS_KEY_GM = `${PFX}_settings`;

/**
 * Default settings schema.
 * Every key here is guaranteed to exist after init.
 */
const SETTINGS_DEFAULTS = {
  // Language
  tgtLang:       'en',        // BCP-47 target language
  srcLangHint:   'auto',      // source lang hint ('auto' = detect)

  // Engine
  engine:        'google',    // 'google' | 'deepl' | 'libretranslate'
  deeplKey:      '',
  ltHost:        '',
  ltKey:         '',

  // Behaviour
  autoTranslate: false,       // translate new bubbles automatically
  skipOwn:       true,        // don't translate own messages
  minLength:     3,           // minimum char count to translate

  // UI
  panelOpen:     true,        // show panel on load
  hotkey:        'Alt+T',     // toggle panel hotkey

  // Privacy
  cacheEnabled:  true,        // use translation cache
  cacheTTLDays:  7,
};

/** Runtime settings object (merged defaults + persisted). */
let _settings = null;
let _dirty    = false;
let _saveTimer = null;

// ─ Init ───────────────────────────────────────────────────

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
    _settings = Object.assign({}, SETTINGS_DEFAULTS, stored);
  } catch {
    _settings = { ...SETTINGS_DEFAULTS };
  }
}

// ─ Read ───────────────────────────────────────────────────

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

// ─ Write ──────────────────────────────────────────────────

/**
 * Set a setting value and schedule a persisted save.
 * @param {string} key
 * @param {*}      value
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
