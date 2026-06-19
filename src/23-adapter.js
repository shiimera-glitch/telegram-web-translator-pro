// 23-adapter.js — App Adapter (Telegram Web A & K selector unification)
// Provides a unified selector/DOM API over both Telegram Web A and K variants.
//
// BUG-15 fix: observeChat() REMOVED. All observation goes through 09-observer.js.
//   This file is now a pure selector/DOM-access layer with zero observer logic.
// BUG-16 fix: setBubbleTranslation/toggleBubble rewritten to use overlay <span>
//   so the original DOM structure (bold, italic, emoji, mentions) is preserved.
// BUG-17 fix: variant is no longer cached at IIFE load time. _getVariant() is
//   called lazily at each sel() invocation, with DOM-sniff fallback.

'use strict';

window._twtp = window._twtp || {};

window._twtp.Adapter = (function () {

  // ── Selector maps ────────────────────────────────────────────────────────────
  const SELECTORS = {
    A: {
      messageContainer: '.messages-container',
      messageBubble:    '.message.spoilers-container',
      messageText:      '.text-content',
      inputBox:         '#editable-message-text',
      chatList:         '.chatlist-top',
      replyWrapper:     '.reply-markup',
      mediaCaption:     '.media-caption',
    },
    K: {
      messageContainer: '.bubbles',
      messageBubble:    '.bubble',
      messageText:      '.message',
      inputBox:         '.input-message-input',
      chatList:         '.chatlist',
      replyWrapper:     '.reply-markup',
      mediaCaption:     '.caption',
    },
  };

  /**
   * BUG-17 fix: Determine app variant lazily at call time.
   * Priority: explicit flag > DOM sniff (K has .bubbles, A has .messages-container).
   * Never cached — called fresh per sel() invocation so it works even if the
   * flag is set after the IIFE fires.
   * @returns {'A'|'K'}
   */
  function _getVariant() {
    if (window.__TWT_APP_VARIANT__) return window.__TWT_APP_VARIANT__;
    // DOM sniff: Telegram Web K uses .bubbles as its main container
    if (document.querySelector('.bubbles')) return 'K';
    return 'A';
  }

  function sel(key) {
    const map = SELECTORS[_getVariant()] || SELECTORS.A;
    return map[key] || null;
  }

  function queryAll(key, root) {
    const s = sel(key);
    if (!s) return [];
    return Array.from((root || document).querySelectorAll(s));
  }

  function query(key, root) {
    const s = sel(key);
    if (!s) return null;
    return (root || document).querySelector(s);
  }

  // ── Bubble access ────────────────────────────────────────────────────────────

  /** Returns all visible message bubble elements in the current chat view. */
  function getBubbles() {
    return queryAll('messageBubble');
  }

  /** Extract plain text from a bubble (read-only). */
  function getBubbleText(bubble) {
    const textEl = bubble.querySelector(sel('messageText'));
    return textEl ? textEl.innerText.trim() : '';
  }

  // ── Translation overlay ───────────────────────────────────────────────────────
  //
  // BUG-16 fix: instead of replacing textEl.textContent (which destroys Telegram's
  // inline formatting, custom emoji <img>, mention <a> nodes), we now INSERT a
  // <span data-twt-overlay> AFTER the text element.  The original DOM is untouched.
  // toggling simply hides/shows the overlay span and the original text element.

  const OVERLAY_ATTR = 'data-twt-overlay';
  const ORIG_HIDDEN  = 'data-twt-orig-hidden';

  /**
   * Inject a translated text overlay after the message text element.
   * Original content is NOT modified — the overlay is appended as a sibling.
   *
   * BUG-16 fix: was textEl.textContent = translatedText (destroyed formatting).
   *
   * @param {Element} bubble
   * @param {string}  translatedText  Clean translated string.
   */
  function setBubbleTranslation(bubble, translatedText) {
    const textEl = bubble.querySelector(sel('messageText'));
    if (!textEl) return;

    // Remove any previous overlay (idempotent)
    _removeOverlay(bubble);

    // Build overlay element
    const overlay = document.createElement('span');
    overlay.setAttribute(OVERLAY_ATTR, '1');
    overlay.textContent = translatedText;
    overlay.style.cssText = [
      'display:block',
      'margin-top:3px',
      'padding:2px 6px',
      'border-left:2px solid var(--color-primary,#5288c1)',
      'font-size:.93em',
      'opacity:.92',
      'white-space:pre-wrap',
      'word-break:break-word',
    ].join(';');

    // Insert overlay as next sibling of textEl (never inside it)
    textEl.insertAdjacentElement('afterend', overlay);
    bubble.dataset.twtShowing  = 'translated';
    bubble.setAttribute('data-twt', '1');
  }

  /**
   * Toggle the overlay visibility.
   * BUG-16 fix: original DOM is never touched; we only show/hide the overlay.
   *
   * @param {Element} bubble
   * @returns {boolean}  true = translation now visible, false = hidden.
   */
  function toggleBubble(bubble) {
    const overlay = bubble.querySelector(`[${OVERLAY_ATTR}]`);
    if (!overlay) return false;

    const isHidden = overlay.style.display === 'none';
    overlay.style.display = isHidden ? '' : 'none';
    bubble.dataset.twtShowing = isHidden ? 'translated' : 'original';
    return isHidden;
  }

  /** Remove the overlay element if present. */
  function _removeOverlay(bubble) {
    bubble.querySelectorAll(`[${OVERLAY_ATTR}]`).forEach(n => n.remove());
    delete bubble.dataset.twtShowing;
    bubble.removeAttribute('data-twt');
  }

  // ── DEPRECATED: observeChat() removed (BUG-15 fix) ─────────────────────────────
  // Previously contained its own MutationObserver which ran in parallel with
  // 09-observer.js, causing double-processing of every bubble.  All observation
  // must go through startObserver() / stopObserver() in 09-observer.js.
  //
  // If you need a reference to the message container element, use:
  //   window._twtp.Adapter.query('messageContainer')
  // ───────────────────────────────────────────────────────────────────────────────

  return {
    // Selectors
    sel,
    query,
    queryAll,
    // Bubble access
    getBubbles,
    getBubbleText,
    // Translation overlay (BUG-16 fixed)
    setBubbleTranslation,
    toggleBubble,
    // Variant (BUG-17: now a getter, not a cached string)
    get variant() { return _getVariant(); },
  };

}());
