// 24-a11y.js — Accessibility Layer (v4.1.0)
// Adds ARIA labels, keyboard navigation, and screen-reader support
// to TWT-injected UI elements. Zero impact on Telegram's native a11y.

'use strict';

window._twtp = window._twtp || {};

window._twtp.A11y = (function () {
  let _initialized = false;

  // ——— ARIA helpers ———
  function ariaLabel(el, label) {
    if (el && !el.getAttribute('aria-label')) el.setAttribute('aria-label', label);
  }

  function ariaLive(el, politeness) {
    if (el) el.setAttribute('aria-live', politeness || 'polite');
  }

  function role(el, r) {
    if (el && !el.getAttribute('role')) el.setAttribute('role', r);
  }

  // ——— Annotate TWT UI elements with ARIA ———
  function annotateUI() {
    const fab = document.getElementById('twt-fab');
    if (fab) {
      ariaLabel(fab, 'Telegram Web Translator — open settings');
      role(fab, 'button');
      if (!fab.hasAttribute('tabindex')) fab.setAttribute('tabindex', '0');
    }

    const panel = document.getElementById('twt-panel');
    if (panel) {
      ariaLabel(panel, 'Translation settings panel');
      role(panel, 'dialog');
      panel.setAttribute('aria-modal', 'true');
      ariaLive(panel, 'polite');
    }

    const statusBar = document.getElementById('twt-status');
    if (statusBar) {
      role(statusBar, 'status');
      ariaLive(statusBar, 'polite');
    }
  }

  // ——— Annotate translated bubbles ———
  function annotateBubble(bubble) {
    if (!bubble || bubble.dataset.twtA11y) return;
    bubble.setAttribute('data-twt-a11y', '1');
    const original = bubble.querySelector('[data-twt-original]');
    if (original) {
      original.setAttribute('aria-label', `Translated message: ${original.textContent}`);
    }
    // Add toggle button hint for screen readers
    if (!bubble.querySelector('.twt-a11y-hint')) {
      const hint = document.createElement('span');
      hint.className = 'twt-a11y-hint';
      hint.setAttribute('aria-hidden', 'false');
      hint.textContent = ' [translated — press T to toggle]';
      hint.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;';
      bubble.appendChild(hint);
    }
  }

  // ——— Keyboard trap management for panel ———
  function trapFocus(panel) {
    if (!panel) return;
    const focusable = panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    panel.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  // ——— FAB keyboard activation ———
  function enableFABKeyboard() {
    const fab = document.getElementById('twt-fab');
    if (!fab) return;
    fab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fab.click();
      }
    });
  }

  function init() {
    if (_initialized) return;
    _initialized = true;
    // Annotate existing UI
    annotateUI();
    enableFABKeyboard();
    // Re-annotate when panel opens (observe body for twt-panel insertion)
    const observer = new MutationObserver(() => {
      annotateUI();
      trapFocus(document.getElementById('twt-panel'));
    });
    observer.observe(document.body, { childList: true, subtree: false });
  }

  return { init, annotateUI, annotateBubble, trapFocus };
})();
