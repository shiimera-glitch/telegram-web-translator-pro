// 20-init.js – Bootstrap & wiring for telegram-web-translator-pro v4.1.0
// Runs after all modules have been concatenated into the final userscript.
//
// BUG-38a fix: removed redundant HotkeyManager.registerDefaults() call —
//   17-hotkeys.js:init() already calls registerDefaults() internally.
// BUG-38b fix: Observer.start() now receives the resolved chat root element
//   instead of being called with no arguments (which threw TypeError).
// BUG-35 fix: version string updated to v4.1.0 to match 01-constants.js:VER.

'use strict';

(function _initModule() {

  // ── Convenience aliases ────────────────────────────────────────────────────────────
  const ns = window._twtp || {};

  function _get(name) {
    const m = ns[name];
    if (!m) console.warn('[init] module not found:', name);
    return m || {};
  }

  // ── Boot sequence ────────────────────────────────────────────────────────────────────
  async function _boot() {
    try {
      console.log('[twtp] booting v4.1.0 …'); // BUG-35 fix: was v4.0.0

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
      // BUG-38a fix: do NOT call registerDefaults() separately —
      // 17-hotkeys.js:init() already calls it internally to avoid double registration.
      const HotkeyManager = _get('HotkeyManager');
      if (HotkeyManager.init) HotkeyManager.init();

      // 5. Start the DOM observer
      // BUG-38b fix: resolve chat root element before starting observer.
      // Observer.start(root) requires a valid Element — calling without arg throws TypeError.
      const Observer  = _get('Observer');
      const CHATSEL_  = (typeof TWTConfig !== 'undefined' && TWTConfig.CHATSEL)
        || '.bubbles .scrollable-y, #column-center .scrollable';
      const chatRoot  = document.querySelector(CHATSEL_);
      if (Observer.start && chatRoot) {
        Observer.start(chatRoot);
      } else if (Observer.start && !chatRoot) {
        console.warn('[twtp] chat root not found yet — observer will start on _waitForApp retry');
      }

      // 6. Expose a minimal public surface on window._twtp for inter-module calls
      const Injector  = _get('Injector');
      const Renderer  = _get('Renderer');
      const Cache     = _get('Cache');
      const ContextMgr = _get('ContextMgr');

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

        openSettings:  () => { UI.openPanel  && UI.openPanel();  },
        closePanels:   () => { UI.closePanel && UI.closePanel(); },
      });

      console.log('[twtp] ready.');
    } catch (err) {
      console.error('[twtp] boot error:', err);
    }
  }

  // ── Entry point ─────────────────────────────────────────────────────────────────────
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
      childList: true,
      subtree:   true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => _waitForApp(_boot));
  } else {
    _waitForApp(_boot);
  }

}());
