// §15 — ASYNC RENDER PIPELINE
// Phase 3 · orchestrates the full extract → translate → inject cycle.
//
// This is the central coordinator called by:
//   • The observer flush (auto-translate)
//   • The “Translate chat” button
//   • Per-bubble right-click actions
//
// Errors are caught per-bubble so one failure never blocks others.

/**
 * Translate and inject a single bubble element.
 * Checks cache first; falls back to the translation engine.
 *
 * @param {Element} el       - The message bubble element.
 * @param {Object}  cfg      - Merged settings object.
 * @returns {Promise<void>}
 */
async function renderBubble(el, cfg) {
  // Guard: already translated or no text
  if (isInjected(el)) return;
  if (!hasMeaningfulText(el)) return;

  // Skip own messages if configured
  if (cfg.skipOwn && _isOwnMessage(el)) return;

  // Extraction (read-only DOM pass)
  const record = extractBubble(el);

  // Minimum length guard
  if (record.raw.length < (cfg.minLength || 3)) return;

  const tgtLang = cfg.tgtLang || 'en';
  const tgtDir  = getLangDir(tgtLang);

  // Cache lookup (raw text is the key input)
  const key = cacheKey(record.srcLang, tgtLang, record.raw);
  if (cfg.cacheEnabled !== false) {
    const hit = cacheGet(key);
    if (hit) {
      injectTranslation(el, recompileSimple(hit.translated, tgtDir), tgtDir, record.srcLang, tgtLang);
      return;
    }
  }

  // Context injection for short messages
  const senderName = getSenderName(el);
  const chatTitle  = getChatTitle();
  const withCtx    = contextWrap(record.encoded, {
    srcLang: record.srcLang,
    tgtLang,
    senderName,
    chatTitle,
  });

  // Translation
  let raw;
  try {
    raw = await translate(withCtx, record.srcLang, tgtLang, cfg);
  } catch (err) {
    console.warn(`[${PFX}] translation failed for bubble`, err);
    return;
  }

  // Recompile
  const clean = recompile(raw, record.stash, tgtDir);

  // Validate
  if (!isValidRecompile(clean, record.raw)) return;

  // Cache store (store clean text for simple reuse)
  if (cfg.cacheEnabled !== false) {
    cacheSet(key, { translated: clean, dir: tgtDir, tgtLang, ts: Date.now() });
  }

  // DOM injection
  injectTranslation(el, clean, tgtDir, record.srcLang, tgtLang);
}

/**
 * Translate all eligible bubbles visible in the document.
 * Fires in small async batches to avoid freezing the UI.
 *
 * @param {Object}  cfg
 * @param {Element} [root=document]
 * @returns {Promise<void>}
 */
async function renderAll(cfg, root = document) {
  const bubbles = Array.from(root.querySelectorAll(MSGSEL))
    .filter(el => !isInjected(el) && hasMeaningfulText(el));

  // Process in batches of 5 with a short yield between each
  const BATCH = 5;
  for (let i = 0; i < bubbles.length; i += BATCH) {
    await Promise.allSettled(
      bubbles.slice(i, i + BATCH).map(el => renderBubble(el, cfg))
    );
    // Yield to the browser's rendering pipeline
    await new Promise(r => setTimeout(r, 50));
  }
}

// ─ Helpers ───────────────────────────────────────────────

function _isOwnMessage(el) {
  // Telegram Web marks outgoing messages with .is-out or .out class
  return el.classList.contains('is-out') ||
         el.classList.contains('out') ||
         !!el.closest('.is-out, .out');
}
