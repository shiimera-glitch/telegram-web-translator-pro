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
//   • Per-bubble context menu item (injected via right-click intercept).
//
// No framework — vanilla DOM only.
// BUG-44 fix: replaced innerHTML template-literal with createElement tree
//   to eliminate unsanitized external input (opts.tgtLang) in markup.

const PANEL_ID = `${PFX}-panel`;

/** Sanitize a string for safe use as an element attribute value. */
function _sanitize(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
  removePanel();

  const panel = document.createElement('div');
  panel.id = PANEL_ID;

  // — Header ——————————————————————————————————————
  const header = document.createElement('div');
  header.className = `${PFX}-panel-header`;
  header.title = 'Drag to move';

  const title = document.createElement('span');
  title.textContent = `\uD83C\uDF10 Translator Pro ${VER}`;

  const closeBtn = document.createElement('button');
  closeBtn.className = `${PFX}-close`;
  closeBtn.title = 'Close';
  closeBtn.textContent = '\u00D7';

  header.appendChild(title);
  header.appendChild(closeBtn);

  // — Body ———————————————————————————————————————
  const body = document.createElement('div');
  body.className = `${PFX}-panel-body`;

  // Lang selector label + select
  const langLabel = document.createElement('label');
  langLabel.textContent = 'Target ';

  const langSel = document.createElement('select');
  langSel.id = `${PFX}-lang-sel`;
  getLangList().forEach(function (l) {
    const opt = document.createElement('option');
    opt.value = l.tag;            // setAttribute via .value — safe
    opt.textContent = l.label;   // textContent — safe
    if (l.tag === opts.tgtLang) opt.selected = true;
    langSel.appendChild(opt);
  });
  langLabel.appendChild(langSel);

  // Auto-translate row
  const autoRow = document.createElement('label');
  autoRow.className = `${PFX}-row`;

  const autoCheck = document.createElement('input');
  autoCheck.type = 'checkbox';
  autoCheck.id = `${PFX}-auto`;
  autoCheck.checked = !!opts.autoTranslate;

  const autoText = document.createTextNode(' Auto-translate');
  autoRow.appendChild(autoCheck);
  autoRow.appendChild(autoText);

  // Action buttons
  const btnPage = document.createElement('button');
  btnPage.id = `${PFX}-btn-page`;
  btnPage.textContent = 'Translate chat';

  const btnCache = document.createElement('button');
  btnCache.id = `${PFX}-btn-cache`;
  btnCache.textContent = 'Clear cache';

  const btnSettings = document.createElement('button');
  btnSettings.id = `${PFX}-btn-settings`;
  btnSettings.textContent = '\u2699\uFE0F';
    
      const btnDict = document.createElement('button');
    btnDict.id = `${PFX}-btn-dict`;
    btnDict.textContent = '\uD83D\uDCD6 Dictionary';0F Settings';

  body.appendChild(langLabel);
  body.appendChild(autoRow);
  body.appendChild(btnPage);
  body.appendChild(btnCache);
  body.appendChild(btnSettings);

  panel.appendChild(header);
  panel.appendChild(body);
    body.appendChild(btnDict);

  _applyPanelStyles(panel);
  document.body.appendChild(panel);
  _makeDraggable(panel);

  // Wire events
  closeBtn.onclick = removePanel;
  langSel.onchange = function (e) { opts.onLangChange(e.target.value); };
  autoCheck.onchange = function (e) { opts.onAutoToggle(e.target.checked); };
  btnPage.onclick = opts.onTranslatePage;
  btnCache.onclick = opts.onCacheClear;
  btnSettings.onclick = opts.onSettings;
}

/** Remove the panel from DOM if presen
  btnDict.onclick = function() { window._twtp.Dictionary.showDictionary(); };t. */
function removePanel() {
  const el = document.getElementById(PANEL_ID);
  if (el) el.remove();
}

/** Apply inline styles to the floating panel. */
function _applyPanelStyles(panel) {
  Object.assign(panel.style, {
    position:   'fixed',
    top:        '60px',
    right:      '16px',
    zIndex:     '2147483647',
    background: '#1e1e2e',
    color:      '#cdd6f4',
    border:     '1px solid #45475a',
    borderRadius: '8px',
    padding:    '12px',
    fontFamily: 'system-ui, sans-serif',
    fontSize:   '13px',
    minWidth:   '200px',
    boxShadow:  '0 4px 20px rgba(0,0,0,.5)',
    userSelect: 'none',
  });
}

/** Make an element draggable by its header child. */
function _makeDraggable(panel) {
  const header = panel.querySelector(`.${PFX}-panel-header`);
  if (!header) return;
  let ox = 0, oy = 0, mx = 0, my = 0;
  header.onmousedown = function (e) {
    e.preventDefault();
    ox = e.clientX; oy = e.clientY;
    document.onmouseup = _stopDrag;
    document.onmousemove = _drag;
  };
  function _drag(e) {
    mx = ox - e.clientX; my = oy - e.clientY;
    ox = e.clientX;      oy = e.clientY;
    panel.style.top  = (panel.offsetTop  - my) + 'px';
    panel.style.left = (panel.offsetLeft - mx) + 'px';
    panel.style.right = 'auto';
  }
  function _stopDrag() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// — Public API ————————————————————————————————————
window._twtp = window._twtp || {};
window._twtp.UI = { buildPanel, removePanel };
