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

const PANEL_ID = `${PFX}-panel`;

/**
 * Build and insert the floating control panel.
 * Idempotent — safe to call multiple times.
 *
 * @param {Object} opts
 * @param {string}   opts.tgtLang       - Currently selected target language.
 * @param {boolean}  opts.autoTranslate - Auto-translate enabled?
 * @param {Function} opts.onLangChange  - Called with new lang tag.
 * @param {Function} opts.onAutoToggle  - Called with new boolean.
 * @param {Function} opts.onTranslatePage
 * @param {Function} opts.onCacheClear
 * @param {Function} opts.onSettings
 */
function buildPanel(opts) {
  removePanel();

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="${PFX}-panel-header" title="Drag to move">
      <span>🌐 Translator Pro ${VER}</span>
      <button class="${PFX}-close" title="Close">×</button>
    </div>
    <div class="${PFX}-panel-body">
      <label>
        Target
        <select id="${PFX}-lang-sel">
          ${getLangList().map(l =>
            `<option value="${l.tag}"${l.tag === opts.tgtLang ? ' selected' : ''}>${l.label}</option>`
          ).join('')}
        </select>
      </label>
      <label class="${PFX}-row">
        <input type="checkbox" id="${PFX}-auto"${opts.autoTranslate ? ' checked' : ''}>
        Auto-translate
      </label>
      <button id="${PFX}-btn-page">Translate chat</button>
      <button id="${PFX}-btn-cache">Clear cache</button>
      <button id="${PFX}-btn-settings">⚙️ Settings</button>
    </div>
  `;

  _applyPanelStyles(panel);
  document.body.appendChild(panel);
  _makeDraggable(panel);

  // Wire events
  panel.querySelector(`.${PFX}-close`).onclick = removePanel;
  panel.querySelector(`#${PFX}-lang-sel`).onchange = e => opts.onLangChange(e.target.value);
  panel.querySelector(`#${PFX}-auto`).onchange    = e => opts.onAutoToggle(e.target.checked);
  panel.querySelector(`#${PFX}-btn-page`).onclick   = opts.onTranslatePage;
  panel.querySelector(`#${PFX}-btn-cache`).onclick  = opts.onCacheClear;
  panel.querySelector(`#${PFX}-btn-settings`).onclick = opts.onSettings;

  return panel;
}

function removePanel() {
  document.getElementById(PANEL_ID)?.remove();
}

function isPanelOpen() {
  return !!document.getElementById(PANEL_ID);
}

/**
 * Update the auto-translate checkbox state without rebuilding panel.
 * @param {boolean} val
 */
function setPanelAutoState(val) {
  const cb = document.getElementById(`${PFX}-auto`);
  if (cb) cb.checked = val;
}

// ─ Internal helpers ───────────────────────────────────────

function _applyPanelStyles(panel) {
  Object.assign(panel.style, {
    position:   'fixed',
    top:        '80px',
    right:      '16px',
    zIndex:     '2147483647',
    background: 'var(--color-background, #212121)',
    color:      'var(--color-text, #e0e0e0)',
    border:     '1px solid rgba(255,255,255,.15)',
    borderRadius: '10px',
    boxShadow:  '0 4px 24px rgba(0,0,0,.5)',
    minWidth:   '210px',
    fontFamily: 'inherit',
    fontSize:   '13px',
    userSelect: 'none',
  });
}

function _makeDraggable(panel) {
  const handle = panel.querySelector(`.${PFX}-panel-header`);
  let ox = 0, oy = 0, startX = 0, startY = 0;

  handle.style.cursor = 'move';
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX; startY = e.clientY;
    ox = panel.offsetLeft; oy = panel.offsetTop;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });

  function onMove(e) {
    panel.style.left = `${ox + e.clientX - startX}px`;
    panel.style.top  = `${oy + e.clientY - startY}px`;
    panel.style.right = 'auto';
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
  }
}
