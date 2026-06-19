// 23-adapter.js — App Adapter (Telegram Web A & K selector unification)
// Provides a unified selector/DOM API over both Telegram Web A and K variants.

'use strict';

window._twtp = window._twtp || {};

window._twtp.Adapter = (function () {
  const variant = window.__TWT_APP_VARIANT__ || 'A';

  // ——— Selector maps ———
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

  function sel(key) {
    const map = SELECTORS[variant] || SELECTORS.A;
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

  // ——— Unified bubble scanner ———
  // Returns all visible message bubble elements in the current chat view.
  function getBubbles() {
    return queryAll('messageBubble');
  }

  // ——— Extract plain text from a bubble ———
  function getBubbleText(bubble) {
    const textEl = bubble.querySelector(sel('messageText'));
    return textEl ? textEl.innerText.trim() : '';
  }

  // ——— Inject translated text into a bubble ———
  // Preserves original in a data attribute for toggle.
  function setBubbleTranslation(bubble, translatedText) {
    const textEl = bubble.querySelector(sel('messageText'));
    if (!textEl) return;
    if (!textEl.dataset.twtOriginal) {
      textEl.dataset.twtOriginal = textEl.innerHTML;
    }
    textEl.dataset.twtTranslated = translatedText;
    if (bubble.dataset.twtShowing === 'translated') return;
    textEl.textContent = translatedText;
    bubble.dataset.twtShowing = 'translated';
    bubble.setAttribute('data-twt', '1');
  }

  // ——— Toggle between original and translated ———
  function toggleBubble(bubble) {
    const textEl = bubble.querySelector(sel('messageText'));
    if (!textEl || !textEl.dataset.twtOriginal) return;
    if (bubble.dataset.twtShowing === 'translated') {
      textEl.innerHTML = textEl.dataset.twtOriginal;
      bubble.dataset.twtShowing = 'original';
    } else {
      textEl.textContent = textEl.dataset.twtTranslated || textEl.innerText;
      bubble.dataset.twtShowing = 'translated';
    }
  }

  // ——— Observe chat container for new messages ———
  function observeChat(callback) {
    const container = query('messageContainer');
    if (!container) {
      console.warn('[TWT:adapter] messageContainer not found');
      return null;
    }
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mut) => {
        mut.addedNodes.forEach((node) => {
          if (node.nodeType === 1) callback(node);
        });
      });
    });
    observer.observe(container, { childList: true, subtree: true });
    return observer;
  }

  return { sel, query, queryAll, getBubbles, getBubbleText, setBubbleTranslation, toggleBubble, observeChat, variant };
})();
