// §15 — ASYNC RENDER PIPELINE
// Phase 3 · orchestrates the full extract → translate → inject cycle.
//
// This is the central coordinator called by:
//   • The observer flush (auto-translate)
//   • The “Translate chat” button
//   • Per-bubble right-click actions
//
// Errors are caught per-bubble so one failure never blocks others.
//
// BUG-22 patch: wrapped as IIFE, registered as window._twtp.Renderer
// BUG-23 patch: cache HIT path now stores raw translated string, not
//   the already-recompiled clean string. On hit, full recompile() is
//   called (not recompileSimple) so PUA restore + stash are re-applied
//   correctly. Eliminates double-stripping.

/* global PFX, MSGSEL, extractBubble, isInjected, hasMeaningfulText,
          getSenderName, getChatTitle, contextWrap, translate,
          recompile, recompileSimple, isValidRecompile,
          injectTranslation, cacheKey, cacheGet, cacheSet, getLangDir */

(function _rendererModule() {
  'use strict';

  /**
   * Translate and inject a single bubble element.
   * Checks cache first; falls back to the translation engine.
   *
   * @param {Element} el   - The message bubble element.
   * @param {Object}  cfg  - Merged settings object.
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

    // Cache lookup
    // KEY: srcLang + tgtLang + raw source text
    const key = cacheKey(record.srcLang, tgtLang, record.raw);
    if (cfg.cacheEnabled !== false) {
      const hit = cacheGet(key);
      if (hit) {
        // BUG-23 FIX: cache stores the raw engine output (hit.raw) and the
        // original stash (hit.stash) so recompile() can fully re-process.
        // Previously stored 'clean' and called recompileSimple — that
        // caused double PUA-stripping and lost stash restoration.
        const cached = recompile(hit.raw, hit.stash, tgtDir);
        injectTranslation(el, cached, tgtDir, record.srcLang, tgtLang);
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

    // Recompile: restore stash, decode PUA, fix RTL numerics
    const clean = recompile(raw, record.stash, tgtDir);

    // Validate
    if (!isValidRecompile(clean, record.raw)) return;

    // Cache store — store raw engine output + stash for faithful replay
    if (cfg.cacheEnabled !== false) {
      cacheSet(key, {
        raw:    raw,           // engine output (pre-recompile)
        stash:  record.stash, // non-translatable spans
        tgtLang,
        dir:    tgtDir,
        ts:     Date.now(),
      });
    }

    // DOM injection
    injectTranslation(el, clean, tgtDir, record.srcLang, tgtLang);
  }

  /**
   * Translate all eligible bubbles visible in the document.
   * Fires in small async batches to avoid freezing the UI.
   *
   * @param {Object}   cfg
   * @param {Element}  [root=document]
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
      // Yield to the browser’s rendering pipeline
      await new Promise(r => setTimeout(r, 50));
    }
  }

  // ─ Helpers ───────────────────────────────────────────────────────

  function _isOwnMessage(el) {
    // Telegram Web marks outgoing messages with .is-out or .out
    return el.classList.contains('is-out')
        || el.classList.contains('out')
        || !!el.closest('.is-out, .out');
  }

  // ─ Public API ────────────────────────────────────────────────────
  /* exported Renderer */
  const Renderer = { renderBubble, renderAll };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Renderer;
  } else {
    (window._twtp = window._twtp || {}).Renderer = Renderer;
  }
}());
