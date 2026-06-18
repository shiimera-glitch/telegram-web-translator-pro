// 21-footer.js – Userscript closing wrapper
// Part of telegram-web-translator-pro v4.0.0
//
// This file is the LAST chunk concatenated by build.js.
// It closes the top-level IIFE opened in 00-header.js and adds
// a small self-test / version banner to the browser console.

/* ---- close the top-level IIFE from 00-header.js ---- */

  // ── Version banner (console only) ─────────────────────────────────────────────
  (function _banner() {
    const VER  = (typeof GM_info !== 'undefined' && GM_info.script)
      ? GM_info.script.version
      : '4.0.0';
    const NAME = 'telegram-web-translator-pro';
    /* eslint-disable no-console */
    console.log(
      `%c ${NAME} v${VER} %c loaded`,
      'background:#0088cc;color:#fff;font-weight:bold;border-radius:3px 0 0 3px;padding:2px 6px',
      'background:#222;color:#aaa;border-radius:0 3px 3px 0;padding:2px 6px',
    );
    /* eslint-enable no-console */
  }());

  // ── Sanity self-test (DEBUG builds only) ──────────────────────────────────────
  (function _selfTest() {
    if (typeof TWTConfig === 'undefined' || !TWTConfig.DEBUG) return;
    const ns    = window._twtp || {};
    const mods  = [
      'LangMap', 'Bidi', 'Segmenter', 'PUA', 'Extractor',
      'Translator', 'Injector', 'Observer', 'Cache', 'UI',
      'Settings', 'ContextMgr', 'Recompiler', 'Renderer',
      'GestureHandler', 'HotkeyManager', 'Perf', 'Compat',
    ];
    const missing = mods.filter(m => !ns[m]);
    if (missing.length) {
      console.warn('[twtp] missing modules at footer:', missing.join(', '));
    } else {
      console.debug('[twtp] all modules registered OK');
    }
  }());

// ─── end of telegram-web-translator-pro ─────────────────────────────────────────────────
// The top-level IIFE wrapper (opened in 00-header.js) is closed below.
}()); // ← matches:  (function(){ ‘use strict’;  in 00-header.js
