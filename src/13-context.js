// §13 — CONTEXT INJECTION
// Phase 3 · pure string transforms, no DOM.
//
// Problem: Short messages (“Yes”, “OK”, “Thanks”) are ambiguous.
// Translation engines guess poorly without surrounding context.
//
// Solution: Wrap the encoded text in invisible context markers before
// sending to the engine.  The wrapper is stripped from the response
// before display or caching.  The markers never appear in the UI.
//
// Context marker format (invisible to translation engine word-count):
//   CTX_OPEN + contextString + CTX_SEP + encodedText + CTX_CLOSE
//
// We use ASCII pipe chars that survive most engines intact.
// The context string is generated from available metadata.

const CTX_OPEN  = '[[';
const CTX_SEP   = ']]:';
const CTX_CLOSE = ':[[END]]';

// Minimum text length below which we add context
const CTX_THRESHOLD = 40;

/**
 * Wrap encoded text with a context hint if the text is short.
 *
 * @param {string} encoded   - PUA-encoded source text.
 * @param {Object} meta      - Metadata from the extraction record.
 * @param {string} meta.srcLang
 * @param {string} meta.tgtLang
 * @param {string} [meta.senderName]
 * @param {string} [meta.chatTitle]
 * @returns {string}  Possibly wrapped text.
 */
function contextWrap(encoded, meta) {
  // Only inject context for short messages
  if (stripBidi(encoded).replace(/[\uE000-\uF8FF]/g, '').trim().length >= CTX_THRESHOLD) {
    return encoded;
  }

  const hint = _buildHint(meta);
  if (!hint) return encoded;

  return `${CTX_OPEN}${hint}${CTX_SEP}${encoded}${CTX_CLOSE}`;
}

/**
 * Strip context markers from a translated string.
 * Always safe to call even if no markers are present.
 *
 * @param {string} translated
 * @returns {string}
 */
function contextStrip(translated) {
  // Remove any leading context echoes the engine may have included
  // Pattern: [[...]]:<content>:[[END]] or [[...]]:<content>
  return translated
    .replace(/^\[\[[^\]]*\]\]:?/,   '')  // leading [[hint]]:
    .replace(/:?\[\[END\]\]\s*$/,   '')  // trailing :[[END]]
    .trim();
}

// ─ Internal ───────────────────────────────────────────────

function _buildHint({ srcLang, tgtLang, senderName, chatTitle }) {
  const parts = [];

  if (srcLang && srcLang !== 'auto')
    parts.push(`lang:${srcLang}`);
  if (tgtLang)
    parts.push(`to:${tgtLang}`);
  if (chatTitle)
    parts.push(`chat:${chatTitle.slice(0, 24)}`);
  if (senderName)
    parts.push(`from:${senderName.slice(0, 16)}`);

  return parts.join(' ');
}

/**
 * Extract the sender name from a bubble element if possible.
 * Returns empty string if not found or ambiguous.
 *
 * @param {Element} bubbleEl
 * @returns {string}
 */
function getSenderName(bubbleEl) {
  // Telegram Web typically renders sender in .peer-title or .name-inner
  const el = bubbleEl.querySelector('.peer-title, .name-inner, .message-name');
  return el ? el.textContent.trim() : '';
}

/**
 * Extract the chat / channel title from the document.
 * Returns empty string if unavailable.
 *
 * @returns {string}
 */
function getChatTitle() {
  const el = document.querySelector('.peer-title, .chat-info .title');
  return el ? el.textContent.trim() : '';
}
