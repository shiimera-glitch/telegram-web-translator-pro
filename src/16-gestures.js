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
