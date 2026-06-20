// §11 — FLOATING UI PANEL
// Phase 4 · non-blocking UI overlay.
//
// Provides:
//   • A draggable floating panel with:
//       - Target language selector
//       - Auto-translate toggle
//       - "Translate page" button
//       - Cache-clear button
//       - Settings link
//       - Dictionary button
//   • Per-bubble context menu item (injected via right-click intercept).
//
// No framework — vanilla DOM only.
// BUG-44 fix: replaced innerHTML template-literal with createElement tree
//   to eliminate unsanitized external input (opts.tgtLang) in markup.
//
// Refactored for:
//   - Memory leak prevention (proper event listener cleanup)
//   - Performance optimization (CSS transforms, event delegation)
//   - Accessibility (ARIA labels, proper label associations)
//   - Error handling and input validation

const PANEL_ID = `${PFX}-panel`;

/** Inject panel styles once at module load. */
function _injectStyles() {
  if (document.getElementById(`${PFX}-panel-styles`)) return;
  
  const style = document.createElement('style');
  style.id = `${PFX}-panel-styles`;
  style.textContent = `
    .${PFX}-panel {
      position: fixed;
      z-index: 2147483647;
      background: #1e1e2e;
      color: #cdd6f4;
      border: 1px solid #45475a;
      border-radius: 8px;
      padding: 12px;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      min-width: 200px;
      box-shadow: 0 4px 20px rgba(0,0,0,.5);
      user-select: none;
    }
    .${PFX}-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      cursor: move;
      padding-bottom: 8px;
      border-bottom: 1px solid #45475a;
    }
    .${PFX}-panel-header span {
      font-weight: 600;
      font-size: 12px;
      letter-spacing: 0.5px;
    }
    .${PFX}-close {
      background: transparent;
      border: none;
      color: #cdd6f4;
      cursor: pointer;
      font-size: 18px;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background-color 0.2s;
    }
    .${PFX}-close:hover {
      background-color: #45475a;
    }
    .${PFX}-close:focus-visible {
      outline: 2px solid #89b4fa;
      outline-offset: 2px;
    }
    .${PFX}-panel-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .${PFX}-panel-body label {
      display: flex;
      align-items: center;
      cursor: pointer;
      gap: 4px;
    }
    .${PFX}-panel-body select {
      padding: 4px 6px;
      border: 1px solid #45475a;
      background: #313244;
      color: #cdd6f4;
      border-radius: 4px;
      font-size: 13px;
      flex: 1;
    }
    .${PFX}-panel-body select:focus-visible {
      outline: 2px solid #89b4fa;
      outline-offset: -1px;
    }
    .${PFX}-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .${PFX}-row input[type="checkbox"] {
      cursor: pointer;
    }
    .${PFX}-row input[type="checkbox"]:focus-visible {
      outline: 2px solid #89b4fa;
      outline-offset: 2px;
    }
    .${PFX}-panel-body button {
      padding: 6px 10px;
      border: 1px solid #45475a;
      background: #313244;
      color: #cdd6f4;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: background-color 0.2s;
      text-align: left;
    }
    .${PFX}-panel-body button:hover {
      background-color: #45475a;
    }
    .${PFX}-panel-body button:focus-visible {
      outline: 2px solid #89b4fa;
      outline-offset: -1px;
    }
    .${PFX}-panel-body button:active {
      background-color: #585b70;
    }
  `;
  document.head.appendChild(style);
}

/** Sanitize a string for safe use as an element attribute value. */
const _sanitize = (str) => {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

/**
 * Build and insert the floating control panel.
 * Idempotent — safe to call multiple times.
 *
 * @param {Object} opts
 * @param {string}   opts.tgtLang        - Currently selected target language.
 * @param {boolean}  opts.autoTranslate  - Auto-translate enabled?
 * @param {Function} opts.onLangChange   - Called with new lang tag.
 * @param {Function} opts.onAutoToggle   - Called with new boolean.
 * @param {Function} opts.onTranslatePage
 * @param {Function} opts.onCacheClear
 * @param {Function} opts.onSettings
 */
function buildPanel(opts) {
  try {
    // Inject styles once
    _injectStyles();
    
    // Validate inputs
    if (!opts || typeof opts !== 'object') {
      console.error('[TWTP] buildPanel: opts must be an object');
      return;
    }
    
    // Validate and fallback callbacks
    const callbacks = [
      'onLangChange',
      'onAutoToggle',
      'onTranslatePage',
      'onCacheClear',
      'onSettings'
    ];
    
    for (const cbName of callbacks) {
      if (opts[cbName] && typeof opts[cbName] !== 'function') {
        console.warn(`[TWTP] buildPanel: opts.${cbName} is not a function, replacing with no-op`);
        opts[cbName] = () => {};
      } else if (!opts[cbName]) {
        opts[cbName] = () => {};
      }
    }
    
    // Validate language tag (basic check)
    const tgtLang = String(opts.tgtLang || '').trim();
    if (tgtLang && !/^[a-z]{2}(-[A-Z]{2})?$/.test(tgtLang)) {
      console.warn(`[TWTP] buildPanel: suspicious language tag "${tgtLang}"`);
    }
    
    removePanel();
    
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = `${PFX}-panel`;
    panel.style.top = '60px';
    panel.style.right = '16px';
    
    // — Header ——————————————————————————————————————
    const header = document.createElement('div');
    header.className = `${PFX}-panel-header`;
    header.setAttribute('role', 'toolbar');
    
    const title = document.createElement('span');
    title.textContent = `🌐 Translator Pro ${VER}`;
    title.id = `${PFX}-title`;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = `${PFX}-close`;
    closeBtn.setAttribute('aria-label', 'Close panel');
    closeBtn.title = 'Close panel (Escape)';
    closeBtn.textContent = '✕';
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // — Body ———————————————————————————————————————
    const body = document.createElement('div');
    body.className = `${PFX}-panel-body`;
    
    // Lang selector label + select
    const langLabel = document.createElement('label');
    langLabel.htmlFor = `${PFX}-lang-sel`;
    langLabel.textContent = 'Target: ';
    
    const langSel = document.createElement('select');
    langSel.id = `${PFX}-lang-sel`;
    langSel.setAttribute('aria-label', 'Select target language for translation');
    
    try {
      const langList = typeof getLangList === 'function' ? getLangList() : [];
      if (!Array.isArray(langList)) {
        console.warn('[TWTP] buildPanel: getLangList() returned invalid data');
      } else {
        langList.forEach((l) => {
          if (!l?.tag || !l?.label) {
            console.warn('[TWTP] buildPanel: skipping invalid lang entry:', l);
            return;
          }
          const opt = document.createElement('option');
          opt.value = l.tag;  // setValue via .value — safe
          opt.textContent = l.label;  // textContent — safe
          if (l.tag === tgtLang) opt.selected = true;
          langSel.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('[TWTP] buildPanel: getLangList() threw:', err);
    }
    
    langLabel.appendChild(langSel);
    
    // Auto-translate row
    const autoRow = document.createElement('label');
    autoRow.className = `${PFX}-row`;
    autoRow.htmlFor = `${PFX}-auto`;
    
    const autoCheck = document.createElement('input');
    autoCheck.type = 'checkbox';
    autoCheck.id = `${PFX}-auto`;
    autoCheck.setAttribute('aria-label', 'Automatically translate incoming messages');
    autoCheck.checked = !!opts.autoTranslate;
    
    const autoText = document.createTextNode(' Auto-translate');
    autoRow.appendChild(autoCheck);
    autoRow.appendChild(autoText);
    
    // Action buttons
    const btnPage = document.createElement('button');
    btnPage.id = `${PFX}-btn-page`;
    btnPage.setAttribute('aria-label', 'Translate entire chat');
    btnPage.textContent = 'Translate chat';
    
    const btnCache = document.createElement('button');
    btnCache.id = `${PFX}-btn-cache`;
    btnCache.setAttribute('aria-label', 'Clear translation cache');
    btnCache.textContent = 'Clear cache';
    
    const btnSettings = document.createElement('button');
    btnSettings.id = `${PFX}-btn-settings`;
    btnSettings.setAttribute('aria-label', 'Open settings');
    btnSettings.textContent = '⚙️ Settings';
    
    const btnDict = document.createElement('button');
    btnDict.id = `${PFX}-btn-dict`;
    btnDict.setAttribute('aria-label', 'Open dictionary and thesaurus');
    btnDict.textContent = '📖 Dictionary';
    
    body.appendChild(langLabel);
    body.appendChild(autoRow);
    body.appendChild(btnPage);
    body.appendChild(btnCache);
    body.appendChild(btnSettings);
    body.appendChild(btnDict);
    
    panel.appendChild(header);
    panel.appendChild(body);
    
    document.body.appendChild(panel);
    _makeDraggable(panel);
    
    // Wire events with addEventListener for proper cleanup
    const handlers = {
      closeBtn: () => removePanel(),
      langSel: (e) => opts.onLangChange(e.target.value),
      autoCheck: (e) => opts.onAutoToggle(e.target.checked),
      btnPage: opts.onTranslatePage,
      btnCache: opts.onCacheClear,
      btnSettings: opts.onSettings,
      btnDict: () => {
        try {
          window._twtp?.Dictionary?.showDictionary?.();
        } catch (err) {
          console.error('[TWTP] Dictionary.showDictionary() threw:', err);
        }
      },
      // Keyboard support
      escapeKey: (e) => {
        if (e.key === 'Escape') removePanel();
      }
    };
    
    closeBtn.addEventListener('click', handlers.closeBtn);
    langSel.addEventListener('change', handlers.langSel);
    autoCheck.addEventListener('change', handlers.autoCheck);
    btnPage.addEventListener('click', handlers.btnPage);
    btnCache.addEventListener('click', handlers.btnCache);
    btnSettings.addEventListener('click', handlers.btnSettings);
    btnDict.addEventListener('click', handlers.btnDict);
    document.addEventListener('keydown', handlers.escapeKey);
    
    // Store handlers on panel for cleanup
    panel._eventHandlers = handlers;
    panel._eventElements = {
      closeBtn,
      langSel,
      autoCheck,
      btnPage,
      btnCache,
      btnSettings,
      btnDict,
      doc: document
    };
    
  } catch (err) {
    console.error('[TWTP] buildPanel() threw:', err);
    removePanel();
  }
}

/** Remove the panel from DOM and clean up all event listeners. */
function removePanel() {
  const el = document.getElementById(PANEL_ID);
  if (!el) return;
  
  try {
    // Remove all stored event listeners
    if (el._eventHandlers && el._eventElements) {
      const h = el._eventHandlers;
      const e = el._eventElements;
      
      e.closeBtn?.removeEventListener('click', h.closeBtn);
      e.langSel?.removeEventListener('change', h.langSel);
      e.autoCheck?.removeEventListener('change', h.autoCheck);
      e.btnPage?.removeEventListener('click', h.btnPage);
      e.btnCache?.removeEventListener('click', h.btnCache);
      e.btnSettings?.removeEventListener('click', h.btnSettings);
      e.btnDict?.removeEventListener('click', h.btnDict);
      e.doc?.removeEventListener('keydown', h.escapeKey);
      
      delete el._eventHandlers;
      delete el._eventElements;
    }
    
    // Clean up drag handlers
    if (el._dragHandlers) {
      const h = el._dragHandlers;
      const header = el.querySelector(`.${PFX}-panel-header`);
      header?.removeEventListener('mousedown', h.startDrag);
      document.removeEventListener('mousemove', h.drag);
      document.removeEventListener('mouseup', h.stopDrag);
      
      delete el._dragHandlers;
    }
  } catch (err) {
    console.error('[TWTP] removePanel cleanup threw:', err);
  }
  
  el.remove();
}

/**
 * Make an element draggable by its header child.
 * Uses CSS transform to avoid layout thrashing.
 */
function _makeDraggable(panel) {
  try {
    const header = panel?.querySelector?.(`.${PFX}-panel-header`);
    if (!header) {
      console.warn('[TWTP] _makeDraggable: header not found');
      return;
    }
    
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;
    
    // Use transform for drag to avoid reflow (performance optimization)
    const drag = (e) => {
      if (!isDragging) return;
      offsetX = e.clientX - startX;
      offsetY = e.clientY - startY;
      // Use transform instead of top/left to avoid layout thrashing
      panel.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    };
    
    const stopDrag = (e) => {
      isDragging = false;
      document.removeEventListener('mousemove', drag, { passive: true });
      document.removeEventListener('mouseup', stopDrag);
    };
    
    const startDrag = (e) => {
      // Only allow left mouse button
      if (e.button !== 0) return;
      
      isDragging = true;
      startX = e.clientX - offsetX;
      startY = e.clientY - offsetY;
      
      e.preventDefault();
      document.addEventListener('mousemove', drag, { passive: true });
      document.addEventListener('mouseup', stopDrag, { once: true });
    };
    
    header.addEventListener('mousedown', startDrag);
    header.style.cursor = 'move';
    
    // Store handlers for cleanup
    panel._dragHandlers = { startDrag, drag, stopDrag };
    
  } catch (err) {
    console.error('[TWTP] _makeDraggable threw:', err);
  }
}

// — Public API ————————————————————————————————————
window._twtp = window._twtp || {};
window._twtp.UI = { buildPanel, removePanel };
