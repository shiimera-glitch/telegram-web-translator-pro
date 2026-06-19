// §8 — DOM INJECTOR
// Phase 3 · writes translated content back to the bubble DOM.
//
// Rules:
//   • CSS-first: set `dir` attribute on wrapper; never insert bidi marks
//       into the text content itself (unless bidiIsolate is explicitly called).
//   • Never replace the bubble's existing DOM structure — only update
//       text nodes and add a translation wrapper `<span>`.
//   • All injected elements carry data-tgtp4=VER so the observer
//       can skip already-translated bubbles.
//   • Idempotent: calling inject twice on the same el is safe.
//
// BUG-29 fix: INJECTED_ATTR now reads DATA_ATTR from 01-constants.js (data-tgtp4).
//   Was hardcoded as 'data-tgtp' which diverged from DATA_ATTR = 'data-tgtp4'.
// BUG-37 fix: Added window._twtp.Injector export block at end of file.

// CSS class / data attribute used to mark translated content.
const INJECTED_CLASS = `${PFX}-translated`;
// BUG-29 fix: use DATA_ATTR from 01-constants.js; fallback for standalone use.
const INJECTED_ATTR  = (typeof DATA_ATTR !== 'undefined') ? DATA_ATTR : 'data-tgtp4';

/**
 * Inject a translated string into a bubble element.
 *
 * Creates a `<div class="tgtp4-translated">` wrapper appended after
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
 * Used by the "show/hide translation" UI action.
 *
 * @param {Element} el
 * @returns {boolean} true = now visible, false = now hidden.
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

// ── Public API ───────────────────────────────────────────────────────────────
// BUG-37 fix: export all injector functions to window._twtp.Injector so
// 20-init.js, 15-renderer.js, and 23-adapter.js can access them via _get('Injector').
window._twtp = window._twtp || {};
window._twtp.Injector = {
  inject:       injectTranslation,
  remove:       removeInjection,
  toggle:       toggleInjection,
  isInjected,
  injectStyles,
  INJECTED_ATTR,
  INJECTED_CLASS,
};
