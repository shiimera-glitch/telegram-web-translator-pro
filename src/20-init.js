// 20-init.js – Bootstrap & wiring for telegram-web-translator-pro v4.0.0
// Runs after all modules have been concatenated into the final userscript.

'use strict';

(function _initModule() {

  // ── Convenience aliases ──────────────────────────────────────────────────────────
  const ns = window._twtp || {};

  function _get(name) {
    const m = ns[name];
    if (!m) console.warn('[init] module not found:', name);
    return m || {};
  }

  // ── Boot sequence ──────────────────────────────────────────────────────────────────
  async function _boot() {
    try {
      console.log('[twtp] booting v4.0.0 …');

      // 1. Load persisted settings
      const Settings = _get('Settings');
      if (Settings.load) await Settings.load();

      // 2. Inject global CSS (UI chrome + bidi helpers)
      const UI = _get('UI');
      if (UI.injectStyles) UI.injectStyles();

      // 3. Initialise gesture handler
      const GestureHandler = _get('GestureHandler');
      if (GestureHandler.init) GestureHandler.init();

      // 4. Initialise hotkeys
      const HotkeyManager = _get('HotkeyManager');
      if (HotkeyManager.init)             HotkeyManager.init();
      if (HotkeyManager.registerDefaults) HotkeyManager.registerDefaults();

      // 5. Start the DOM observer
      const Observer = _get('Observer');
      if (Observer.start) Observer.start();

      // 6. Expose a minimal public surface on window._twtp for inter-module calls
      const Injector    = _get('Injector');
      const Renderer    = _get('Renderer');
      const Cache       = _get('Cache');
      const ContextMgr  = _get('ContextMgr');

      Object.assign(ns, {
        // Selector used by gestures / hotkeys
        MSGSEL: (typeof TWTConfig !== 'undefined' && TWTConfig.MSGSEL) ||
                '.message.spoilers-container',

        // Public actions
        toggleInjection: bubble => {
          if (!bubble) return;
          const Injector_ = _get('Injector');
          if (Injector_.isInjected && Injector_.isInjected(bubble)) {
            Injector_.remove && Injector_.remove(bubble);
          } else {
            Injector_.inject && Injector_.inject(bubble, Settings.get ? Settings.get() : {});
          }
        },
        clearAll: () => {
          document.querySelectorAll(ns.MSGSEL).forEach(b => {
            Injector.remove && Injector.remove(b);
          });
          Cache.clear && Cache.clear();
        },
        openSettings: () => { UI.openPanel && UI.openPanel(); },
        closePanels:  () => { UI.closePanel && UI.closePanel(); },
      });

      console.log('[twtp] ready.');
    } catch (err) {
      console.error('[twtp] boot error:', err);
    }
  }

  // ── Entry point ───────────────────────────────────────────────────────────────────
  // Telegram Web loads its React tree asynchronously; wait for the first
  // message container to appear before starting the observer.
  function _waitForApp(cb) {
    const READY_SEL = '.messages-container, #app, .chat-list';
    if (document.querySelector(READY_SEL)) {
      cb();
      return;
    }
    const mo = new MutationObserver(() => {
      if (document.querySelector(READY_SEL)) {
        mo.disconnect();
        cb();
      }
    });
    mo.observe(document.body || document.documentElement, {
      childList: true, subtree: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => _waitForApp(_boot));
  } else {
    _waitForApp(_boot);
  }

}());
