// §6 — TEXT EXTRACTOR
// Phase 2 · reads DOM, emits a portable extraction record.
//
// Responsibilities:
//   1. Walk the message bubble's subtree.
//   2. Collect text runs, tagging non-translatable spans as PUA placeholders.
//   3. Return an ExtractionRecord that the translator & recompiler consume.
//   4. Never mutate the DOM — read-only pass.

/**
 * @typedef {Object} ExtractionRecord
 * @property {string}   raw        - Original concatenated text (for cache key).
 * @property {string}   encoded    - Text with non-translatable spans as PUA.
 * @property {string[]} stash      - Stash of replaced non-translatable spans.
 * @property {string}   srcLang    - Detected source language tag or 'auto'.
 * @property {string}   dir        - Detected base direction 'ltr' | 'rtl'.
 * @property {Element}  el         - The bubble element (reference only).
 */

/**
 * Extract translatable content from a Telegram message bubble element.
 *
 * @param {Element} el  - The `.message` or `.bubble` element.
 * @returns {ExtractionRecord}
 */
function extractBubble(el) {
  const stash  = [];
  const parts  = [];
  let   raw    = '';

  _walkNode(el, parts, stash, raw);

  // Rebuild raw and encoded from parts
  const rawText     = parts.map(p => p.raw).join('');
  const encodedText = parts.map(p => p.enc).join('');

  return {
    raw:     rawText,
    encoded: encodedText,
    stash,
    srcLang: 'auto',
    dir:     detectDir(rawText),
    el,
  };
}

// ─ Internal walker ──────────────────────────────────────────

/**
 * @param {Node}     node
 * @param {Array}    parts   - Accumulator of { raw, enc } pairs.
 * @param {string[]} stash
 * @param {string}   _raw    - Unused param kept for signature compat.
 */
function _walkNode(node, parts, stash, _raw) {
  // Text node — the main path
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent;
    if (text) parts.push({ raw: text, enc: text });
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const tag = node.tagName.toLowerCase();

  // Skip script / style entirely
  if (tag === 'script' || tag === 'style') return;

  // Non-translatable inline elements — stash as PUA placeholder
  if (_isOpaqueElement(node)) {
    const outer = node.outerHTML || node.textContent;
    const ph    = puaStash(outer, stash);
    parts.push({ raw: node.textContent, enc: ph });
    return;
  }

  // Block-level element — insert synthetic newline if we have content
  const isBlock = _isBlockElement(tag);
  if (isBlock && parts.length) {
    parts.push({ raw: '\n', enc: PUA.NEWLINE });
  }

  // Recurse into children
  for (const child of node.childNodes) {
    _walkNode(child, parts, stash, _raw);
  }

  if (isBlock && parts.length) {
    parts.push({ raw: '\n', enc: PUA.NEWLINE });
  }
}

/** Elements whose inner content we must NOT translate. */
function _isOpaqueElement(el) {
  const tag = el.tagName.toLowerCase();
  // <a> links — stash the whole element
  if (tag === 'a') return true;
  // Inline code
  if (tag === 'code' || tag === 'pre') return true;
  // Custom emoji / sticker wrappers
  if (el.classList.contains('custom-emoji')) return true;
  if (el.classList.contains('emoji')) return true;
  return false;
}

/** Tags that introduce block-level breaks. */
function _isBlockElement(tag) {
  return ['div', 'p', 'br', 'li', 'blockquote', 'section', 'article'].includes(tag);
}

/**
 * Quick smoke-test: does this element contain any non-whitespace text?
 * Used by the observer to skip empty or media-only bubbles.
 *
 * @param {Element} el
 * @returns {boolean}
 */
function hasMeaningfulText(el) {
  return /\S/.test(el.textContent || '');
}
