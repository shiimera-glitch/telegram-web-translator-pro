// §9 — MUTATION OBSERVER
// Phase 3 · watches the DOM for new/changed message bubbles.
//
// Design:
//   • Single shared MutationObserver for the whole chat viewport.
//   • New bubble candidates are batched into a microtask queue
//     so we never block the main thread per-mutation.
//   • Auto-translate only fires when the user has enabled auto mode.
//   • Already-translated bubbles (data-tgtp) are skipped.

/** Internal queue of bubble elements waiting to be processed. */
let _queue      = [];
let _scheduled  = false;
let _observer   = null;

/** Callback invoked per bubble that needs processing. Set by init. */
let _onBubble = null;

/**
 * Register the handler called for each new/changed bubble.
 * @param {(el: Element) => void} fn
 */
function setObserverHandler(fn) {
  _onBubble = fn;
}

/**
 * Start observing the given root element (typically the messages
 * container div that Telegram renders into).
 *
 * @param {Element} root
 */
function startObserver(root) {
  if (_observer) _observer.disconnect();

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
  _queue     = [];
  _scheduled = false;
}

// ─ Internal ────────────────────────────────────────────────

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
 */
function _collectBubbles(root) {
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
  // Quick check: does this element match any of the bubble selectors?
  return el.matches && el.matches(MSGSEL);
}

function _enqueue(el) {
  // Skip already translated, media-only, or already queued
  if (isInjected(el)) return;
  if (!hasMeaningfulText(el)) return;
  if (_queue.includes(el)) return;
  _queue.push(el);
}

function _scheduleFlush() {
  if (_scheduled) return;
  _scheduled = true;
  // Use a microtask to batch; fall back to setTimeout for older engines
  Promise.resolve().then(_flush).catch(() => setTimeout(_flush, 0));
}

function _flush() {
  _scheduled = false;
  if (!_onBubble) { _queue = []; return; }

  const batch = _queue.splice(0); // drain
  for (const el of batch) {
    try { _onBubble(el); } catch (e) {
      // Never let a bubble error kill the observer loop
      console.warn(`[${PFX}] observer handler error`, e);
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
  const hits = root.querySelectorAll(MSGSEL);
  for (const el of hits) _enqueue(el);
  _scheduleFlush();
}
