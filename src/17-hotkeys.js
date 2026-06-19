// 17-hotkeys.js – Keyboard shortcut handler
// Part of telegram-web-translator-pro v4.0.0
//
// BUG-27 patch: added e.isComposing guard in _onKeyDown to prevent
//   hotkeys from firing during CJK/IME composition sequences.
// BUG-28 patch: init() now automatically calls registerDefaults() so
//   default bindings are always active after init — callers no longer
//   need to remember a two-step setup.
// Also: _trackHover uses AbortController for clean removal.

'use strict';

(function _hotkeyModule() {

  // ── Hotkey registry ────────────────────────────────────────────────────
  const _registry = new Map(); // key: combo string → value: { handler, desc }
  let   _hoverCtrl = null;     // AbortController for _trackHover cleanup

  /**
   * Normalise a keyboard event into a canonical combo string.
   * Examples:  "Alt+KeyT"  |  "Shift+Alt+KeyT"  |  "Escape"
   * @param {KeyboardEvent} e
   * @returns {string}
   */
  function _comboOf(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey)              parts.push('Shift');
    if (e.altKey)                parts.push('Alt');
    parts.push(e.code || e.key);
    return parts.join('+');
  }

  /**
   * Register a hotkey combo.
   * @param {string}   combo   – e.g. "Alt+KeyT"
   * @param {Function} handler – called with the KeyboardEvent
   * @param {string}   [desc]  – human-readable description (for UI)
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

  // ── Global keydown listener ────────────────────────────────────────────
  function _onKeyDown(e) {
    // BUG-27 FIX: skip during IME composition (CJK input, accent dead-keys, etc.)
    if (e.isComposing || e.keyCode === 229) return;

    // Skip when user is typing in a real input / contentEditable
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.target && e.target.isContentEditable)    return;

    const combo = _comboOf(e);
    const entry = _registry.get(combo);
    if (entry) {
      e.preventDefault();
      e.stopPropagation();
      try {
        entry.handler(e);
      } catch (err) {
        console.warn('[hotkeys] handler error for', combo, err);
      }
    }
  }

  // ── Built-in bindings ────────────────────────────────────────────────
  /**
   * Register the default translator hotkeys.
   * Called automatically by init().
   */
  function registerDefaults() {
    // Alt+T – translate hovered bubble
    register('Alt+KeyT', () => {
      const bubble = _lastHovered();
      if (bubble) {
        const fn = window._twtp && window._twtp.toggleInjection;
        if (fn) fn(bubble);
      }
    }, 'Translate hovered message (Alt+T)');

    // Alt+Shift+T – render all untranslated bubbles
    register('Alt+Shift+KeyT', () => {
      const _twtp = window._twtp;
      if (!_twtp) return;
      // Use renderAll for batch translation (not just toggle)
      const cfg = _twtp.Settings ? _twtp.Settings.getAll() : {};
      if (_twtp.Renderer && _twtp.Renderer.renderAll) {
        _twtp.Renderer.renderAll(cfg).catch(e =>
          console.warn('[hotkeys] renderAll error', e)
        );
      }
    }, 'Translate all visible messages (Alt+Shift+T)');

    // Alt+C – clear all injected translations
    register('Alt+KeyC', () => {
      const fn = window._twtp && window._twtp.clearAll;
      if (fn) fn();
    }, 'Clear all translations (Alt+C)');

    // Alt+S – open settings panel
    register('Alt+KeyS', () => {
      const fn = window._twtp && window._twtp.openSettings;
      if (fn) fn();
    }, 'Open settings (Alt+S)');

    // Escape – close floating panels
    register('Escape', () => {
      const fn = window._twtp && window._twtp.closePanels;
      if (fn) fn();
    }, 'Close panels (Escape)');
  }

  // ── Track last hovered message bubble ─────────────────────────────────
  let _hoveredBubble = null;
  function _lastHovered() { return _hoveredBubble; }

  function _trackHover() {
    // BUG-28 FIX: use AbortController so the listener can be removed on teardown
    _hoverCtrl = new AbortController();
    document.addEventListener('mouseover', e => {
      const MSGSEL = (window._twtp && window._twtp.MSGSEL) || '.message';
      const bubble = e.target && e.target.closest ? e.target.closest(MSGSEL) : null;
      if (bubble) _hoveredBubble = bubble;
    }, { passive: true, capture: true, signal: _hoverCtrl.signal });
  }

  // ── Init / Teardown ─────────────────────────────────────────────────────
  function init() {
    document.addEventListener('keydown', _onKeyDown, true);
    _trackHover();
    // BUG-28 FIX: auto-register defaults so callers don’t need a two-step setup
    registerDefaults();
  }

  function teardown() {
    document.removeEventListener('keydown', _onKeyDown, true);
    if (_hoverCtrl) { _hoverCtrl.abort(); _hoverCtrl = null; }
    _hoveredBubble = null;
    _registry.clear();
  }

  // ── Public API ─────────────────────────────────────────────────────────
  /* exported HotkeyManager */
  const HotkeyManager = { init, teardown, register, unregister, registerDefaults };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HotkeyManager;
  } else {
    (window._twtp = window._twtp || {}).HotkeyManager = HotkeyManager;
  }

}());
