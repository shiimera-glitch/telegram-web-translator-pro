// §9 — MUTATION OBSERVER
// Phase 3 · watches the DOM for new/changed message bubbles.
//
// Design:
// • Single shared MutationObserver for the whole chat viewport.
// • New bubble candidates are batched into a microtask queue
//   so we never block the main thread per-mutation.
// • Auto-translate only fires when the user has enabled auto mode.
// • Already-translated bubbles (data-tgtp4) are skipped.
//
// BUG-10 fix: _queue is now a Set<Element> — _enqueue() is O(1) instead of O(n).
// BUG-11 fix: startObserver() resets _queue and _scheduled before reconnecting.
// BUG-36 fix: Added window._twtp.Observer export block at end of file.
// BUG-42 fix: Added MSGSEL null guard in _collectBubbles.
// BUG-43 fix: Added error counter in _flush to skip chronically-failing elements.

/** Safe prefix constant (BUG-06 guard). */
const _OBS_PFX = (typeof PFX !== 'undefined') ? PFX : 'twtp';

/** Maximum consecutive errors allowed per bubble before it is blacklisted. */
const _MAX_ERRORS = 3;

/**
 * Internal queue of bubble elements waiting to be processed.
 * BUG-10 fix: Set<Element> provides O(1) has/add vs O(n) Array.includes.
 */
let _queue     = new Set();
let _scheduled = false;
let _observer  = null;

/** WeakMap tracking per-element error counts to avoid infinite retry loops. */
const _errorCounts = new WeakMap();

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
  if (!root) {
    console.warn(`[${_OBS_PFX}] startObserver: root element is required`);
    return;
  }
  if (_observer) _observer.disconnect();
  // BUG-11 fix: reset state on every (re)start
  _queue = new Set();
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
  _queue = new Set();
  _scheduled = false;
}

// ─ Internal ────────────────────────────────────────────────────────────────────
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
 * BUG-42 fix: guard against undefined MSGSEL (e.g. constants not yet loaded).
 */
function _collectBubbles(root) {
  // Guard: MSGSEL must be a non-empty string
  if (typeof MSGSEL !== 'string' || !MSGSEL) {
    console.warn(`[${_OBS_PFX}] _collectBubbles: MSGSEL is not defined; skipping`);
    return;
  }
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
  // Skip already translated, media-only, or chronically-failing elements
  if (isInjected(el)) return;          // data-tgtp4 present — already done
  if (!hasMeaningfulText(el)) return;  // no translatable text
  // Skip elements that have hit the error threshold
  if ((_errorCounts.get(el) || 0) >= _MAX_ERRORS) return;
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
      // BUG-43 fix: count errors per element; blacklist after _MAX_ERRORS
      // so a single malformed bubble never loops indefinitely.
      const prev = _errorCounts.get(el) || 0;
      _errorCounts.set(el, prev + 1);
      if (prev + 1 >= _MAX_ERRORS) {
        console.warn(`[${_OBS_PFX}] observer: element blacklisted after ${_MAX_ERRORS} errors`, el);
      } else {
        console.warn(`[${_OBS_PFX}] observer handler error (${prev + 1}/${_MAX_ERRORS})`, e);
      }
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
  if (typeof MSGSEL !== 'string' || !MSGSEL) return;
  const hits = root.querySelectorAll(MSGSEL);
  for (const el of hits) _enqueue(el);
  _scheduleFlush();
}

// ── Public API ───────────────────────────────────────────────────────────────────────
// BUG-36 fix: export all observer functions to window._twtp.Observer so
// 20-init.js can call Observer.start(chatRoot) to activate the pipeline.
window._twtp = window._twtp || {};
window._twtp.Observer = {
  start:      startObserver,
  stop:       stopObserver,
  setHandler: setObserverHandler,
  scan:       scanExistingBubbles,
};
