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
