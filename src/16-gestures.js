// §16 — GESTURE SUPPORT (TOUCH / LONG-PRESS)
// Phase 5 · progressive enhancement — gracefully absent on desktop.
//
// On mobile (Telegram Web PWA / mobile browser):
//   • Long-press (500ms) on a message bubble → translate that bubble.
//   • Double-tap on a translated bubble → toggle translation visibility.
//
// Never blocks native Telegram gestures (swipe-to-reply, etc.).

const LONG_PRESS_MS = 500;
const DBL_TAP_MS   = 300; // max interval for double-tap

let _gestureActive = false;
let _lpTimer  = null;
let _lastTap  = 0;
let _tapTarget = null;

/**
 * Attach gesture listeners to the root element.
 * Call once from init.  Passive listeners only.
 *
 * @param {Element} root   - The messages container.
 * @param {Object}  cfg    - Settings object (passed to renderBubble).
 */
function initGestures(root, cfg) {
  if (_gestureActive) return;
  _gestureActive = true;

  root.addEventListener('touchstart', e => _onTouchStart(e, cfg), { passive: true });
  root.addEventListener('touchend',   e => _onTouchEnd(e, cfg),   { passive: true });
  root.addEventListener('touchmove',  _cancelLongPress,             { passive: true });
  root.addEventListener('touchcancel',_cancelLongPress,             { passive: true });
}

/** Remove gesture listeners and reset state. */
function teardownGestures(root) {
  _gestureActive = false;
  _cancelLongPress();
  // Note: anonymous listeners can’t be removed easily; use a controller if needed.
}

// ─ Internal ───────────────────────────────────────────────

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
  const hadTimer = !!_lpTimer;
  _cancelLongPress();

  const bubble = _nearestBubble(e.target);
  if (!bubble) return;

  // Double-tap detection (only if it wasn’t a long press)
  if (hadTimer) {
    const now = Date.now();
    if (now - _lastTap < DBL_TAP_MS && _tapTarget === bubble) {
      toggleInjection(bubble);
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
  return target.closest ? target.closest(MSGSEL) : null;
}

function _triggerTranslate(bubble, cfg) {
  // Fire-and-forget; errors handled inside renderBubble
  renderBubble(bubble, cfg).catch(e =>
    console.warn(`[${PFX}] gesture translate error`, e)
  );
}
