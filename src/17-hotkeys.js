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
