// 25-dragdrop.js — Drag & Drop Support (v4.1.0)
// Enables drag-and-drop of text/files onto the TWT panel or Telegram chat area.
// Supports: plain text drops (auto-translate), image drops (future: OCR pipeline).

'use strict';

window._twtp = window._twtp || {};

window._twtp.DragDrop = (function () {
  let _initialized = false;

  // Visual feedback CSS classes
  const CSS_DRAGOVER = 'twt-dragover';

  function _injectStyles() {
    if (document.getElementById('twt-dragdrop-styles')) return;
    const style = document.createElement('style');
    style.id = 'twt-dragdrop-styles';
    style.textContent = `
      .${CSS_DRAGOVER} {
        outline: 2px dashed #5288c1 !important;
        background: rgba(82,136,193,0.08) !important;
        transition: background 0.15s;
      }
    `;
    document.head.appendChild(style);
  }

  // ——— Attach drag-and-drop to an element ———
  function attach(el, opts) {
    if (!el || el.dataset.twtDnd) return;
    el.dataset.twtDnd = '1';

    el.addEventListener('dragenter', (e) => {
      e.preventDefault();
      el.classList.add(CSS_DRAGOVER);
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    el.addEventListener('dragleave', (e) => {
      // Only remove if leaving the element entirely
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove(CSS_DRAGOVER);
      }
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove(CSS_DRAGOVER);
      _handleDrop(e, opts);
    });
  }

  function _handleDrop(e, opts) {
    const dt = e.dataTransfer;
    // Text drop
    if (dt.types.includes('text/plain')) {
      const text = dt.getData('text/plain').trim();
      if (text && opts && typeof opts.onText === 'function') {
        opts.onText(text);
      } else if (text) {
        _defaultTextDrop(text);
      }
      return;
    }
    // File drop (images, future OCR)
    if (dt.files && dt.files.length > 0) {
      Array.from(dt.files).forEach((file) => {
        if (file.type.startsWith('image/')) {
          if (opts && typeof opts.onImage === 'function') {
            opts.onImage(file);
          } else {
            console.log('[TWT:dragdrop] Image dropped (OCR pipeline pending):', file.name);
          }
        }
      });
    }
  }

  // Default text drop: auto-translate using active engine
  function _defaultTextDrop(text) {
    const engines = window._twtp && window._twtp.Engines;
    const settings = window._twtp && window._twtp.Settings;
    if (!engines || !settings) {
      console.warn('[TWT:dragdrop] Engines/Settings not ready');
      return;
    }
    const engineName = settings.get('engine') || 'google';
    const targetLang = settings.get('targetLang') || 'en';
    const engine = engines.get(engineName);
    if (!engine) return;
    engine.translate(text, 'auto', targetLang)
      .then((result) => {
        // Copy to clipboard and notify
        navigator.clipboard.writeText(result).catch(() => {});
        const ui = window._twtp && window._twtp.UI;
        if (ui && ui.showToast) ui.showToast(`Translated: ${result.slice(0, 80)}…`);
        else console.log('[TWT:dragdrop] Translation:', result);
      })
      .catch((err) => console.error('[TWT:dragdrop] Translation error:', err));
  }

  function init() {
    if (_initialized) return;
    _initialized = true;
    _injectStyles();

    // Attach to TWT panel if present
    const panel = document.getElementById('twt-panel');
    if (panel) attach(panel, {});

    // Watch for panel insertion
    const observer = new MutationObserver(() => {
      const p = document.getElementById('twt-panel');
      if (p && !p.dataset.twtDnd) attach(p, {});
    });
    observer.observe(document.body, { childList: true, subtree: false });
  }

  return { init, attach };
})();
