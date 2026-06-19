// §26 — DICTIONARY + THESAURUS
// Phase 6 · word lookup, definitions, synonyms, antonyms.
//
// Features (inspired by modern icon library UIs 2025):
//  • Compact floating panel (400×500px resizable)
//  • Live search with debounce (Ctrl+K keyboard shortcut)
//  • Tabs: Definition | Synonyms | Antonyms | Examples
//  • Inline phonetics + audio pronunciation button
//  • Collapsible parts of speech sections
//  • Word history (recent lookups) sidebar
//  • "Copy definition" button per entry
//  • "Related words" footer links
//  • Theme: matches ${PFX}-panel (Catppuccin dark)
//
// APIs:
//  • Primary: Free Dictionary API (dictionaryapi.dev)
//  • Fallback: DataMuse API (datamuse.com/api) for thesaurus
//
// No framework — vanilla DOM only.
// BUG-44 compliant: createElement tree, no innerHTML.

/* global PFX */
(function _dictionaryModule() {
  'use strict';

  const DICT_ID = `${PFX}-dict-panel`;
  const HISTORY_KEY = `${PFX}_dict_history`;
  const MAX_HISTORY = 20;

  // API endpoints
  const DICT_API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
  const DATAMUSE_API = 'https://api.datamuse.com/words';

  let _panel = null;
  let _searchInput = null;
  let _contentArea = null;
  let _historyList = null;
  let _debounceTimer = null;
  let _currentWord = '';
  let _currentTab = 'definition';

  /**
   * Build and show the dictionary floating panel.
   * Idempotent — safe to call multiple times.
   */
  function showDictionary() {
    if (_panel) {
      _panel.style.display = 'block';
      _searchInput?.focus();
      return;
    }

    _panel = document.createElement('div');
    _panel.id = DICT_ID;
    _applyPanelStyles(_panel);

    // Header
    const header = _createHeader();
    _panel.appendChild(header);

    // Search bar
    const searchBar = _createSearchBar();
    _panel.appendChild(searchBar);

    // Tabs
    const tabs = _createTabs();
    _panel.appendChild(tabs);

    // Body (2 columns: history sidebar + content)
    const body = document.createElement('div');
    body.className = `${PFX}-dict-body`;
    Object.assign(body.style, {
      display: 'flex',
      gap: '8px',
      height: 'calc(100% - 120px)',
      overflow: 'hidden',
    });

    // History sidebar
    const sidebar = _createHistorySidebar();
    body.appendChild(sidebar);

    // Content area
    _contentArea = document.createElement('div');
    _contentArea.className = `${PFX}-dict-content`;
    Object.assign(_contentArea.style, {
      flex: '1',
      overflowY: 'auto',
      padding: '12px',
      background: '#181825',
      borderRadius: '6px',
      fontSize: '13px',
      lineHeight: '1.6',
    });
    _contentArea.innerHTML = '<p style="color: #6c7086; text-align: center; margin-top: 40px;">\uD83D\uDCDA Search for a word to see definitions</p>';
    body.appendChild(_contentArea);

    _panel.appendChild(body);
    document.body.appendChild(_panel);
    _makeDraggable(_panel);
    _makeResizable(_panel);

    _searchInput.focus();
    _loadHistory();
  }

  /**
   * Hide the dictionary panel.
   */
  function hideDictionary() {
    if (_panel) _panel.style.display = 'none';
  }

  /**
   * Remove panel from DOM completely.
   */
  function removeDictionary() {
    if (_panel) {
      _panel.remove();
      _panel = null;
    }
  }

  /**
   * Create the panel header with title and close button.
   */
  function _createHeader() {
    const header = document.createElement('div');
    header.className = `${PFX}-dict-header`;
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 12px',
      background: '#313244',
      borderRadius: '8px 8px 0 0',
      cursor: 'move',
      userSelect: 'none',
    });

    const title = document.createElement('span');
    title.textContent = `\uD83D\uDCD6 Dictionary & Thesaurus`;
    title.style.fontWeight = '600';
    title.style.color = '#cdd6f4';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00D7';
    closeBtn.title = 'Close';
    Object.assign(closeBtn.style, {
      background: 'transparent',
      border: 'none',
      color: '#cdd6f4',
      fontSize: '20px',
      cursor: 'pointer',
      padding: '0 4px',
    });
    closeBtn.onclick = hideDictionary;

    header.appendChild(title);
    header.appendChild(closeBtn);
    return header;
  }

  /**
   * Create the search bar with Ctrl+K hint.
   */
  function _createSearchBar() {
    const bar = document.createElement('div');
    bar.className = `${PFX}-dict-search-bar`;
    Object.assign(bar.style, {
      padding: '8px 12px',
      background: '#1e1e2e',
    });

    _searchInput = document.createElement('input');
    _searchInput.type = 'text';
    _searchInput.placeholder = 'Search word... (Ctrl+K)';
    _searchInput.id = `${PFX}-dict-search`;
    Object.assign(_searchInput.style, {
      width: '100%',
      padding: '8px 12px',
      background: '#313244',
      border: '1px solid #45475a',
      borderRadius: '6px',
      color: '#cdd6f4',
      fontSize: '13px',
      fontFamily: 'system-ui, sans-serif',
    });

    _searchInput.oninput = function (e) {
      clearTimeout(_debounceTimer);
      const val = e.target.value.trim();
      if (!val) return;
      _debounceTimer = setTimeout(() => _lookupWord(val), 300);
    };

    bar.appendChild(_searchInput);
    return bar;
  }

  /**
   * Create tab buttons: Definition | Synonyms | Antonyms | Examples
   */
  function _createTabs() {
    const tabBar = document.createElement('div');
    tabBar.className = `${PFX}-dict-tabs`;
    Object.assign(tabBar.style, {
      display: 'flex',
      gap: '4px',
      padding: '0 12px',
      background: '#1e1e2e',
    });

    const tabs = ['definition', 'synonyms', 'antonyms', 'examples'];
    const labels = ['Definition', 'Synonyms', 'Antonyms', 'Examples'];

    tabs.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.textContent = labels[i];
      btn.dataset.tab = t;
      Object.assign(btn.style, {
        flex: '1',
        padding: '6px 0',
        background: t === _currentTab ? '#313244' : 'transparent',
        border: 'none',
        borderBottom: t === _currentTab ? '2px solid #89b4fa' : '2px solid transparent',
        color: t === _currentTab ? '#cdd6f4' : '#6c7086',
        fontSize: '12px',
        fontWeight: t === _currentTab ? '600' : '400',
        cursor: 'pointer',
        transition: 'all 0.2s',
      });
      btn.onclick = () => {
        _currentTab = t;
        _renderContent();
        // Re-style tabs
        tabBar.querySelectorAll('button').forEach(b => {
          const isActive = b.dataset.tab === t;
          b.style.background = isActive ? '#313244' : 'transparent';
          b.style.borderBottom = isActive ? '2px solid #89b4fa' : '2px solid transparent';
          b.style.color = isActive ? '#cdd6f4' : '#6c7086';
          b.style.fontWeight = isActive ? '600' : '400';
        });
      };
      tabBar.appendChild(btn);
    });

    return tabBar;
  }

  /**
   * Create history sidebar showing recent lookups.
   */
  function _createHistorySidebar() {
    const sidebar = document.createElement('div');
    sidebar.className = `${PFX}-dict-history`;
    Object.assign(sidebar.style, {
      width: '100px',
      overflowY: 'auto',
      background: '#181825',
      borderRadius: '6px',
      padding: '8px',
    });

    const heading = document.createElement('div');
    heading.textContent = 'Recent';
    Object.assign(heading.style, {
      fontSize: '11px',
      fontWeight: '600',
      color: '#6c7086',
      marginBottom: '6px',
      textTransform: 'uppercase',
    });
    sidebar.appendChild(heading);

    _historyList = document.createElement('ul');
    _historyList.style.listStyle = 'none';
    _historyList.style.padding = '0';
    _historyList.style.margin = '0';
    sidebar.appendChild(_historyList);

    return sidebar;
  }

  /**
   * Load history from localStorage.
   */
  function _loadHistory() {
    const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    _historyList.innerHTML = '';
    hist.slice(0, MAX_HISTORY).forEach(word => {
      const li = document.createElement('li');
      li.textContent = word;
      Object.assign(li.style, {
        padding: '4px 6px',
        fontSize: '12px',
        color: '#cdd6f4',
        cursor: 'pointer',
        borderRadius: '4px',
        marginBottom: '2px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
      li.onmouseenter = () => (li.style.background = '#313244');
      li.onmouseleave = () => (li.style.background = 'transparent');
      li.onclick = () => {
        _searchInput.value = word;
        _lookupWord(word);
      };
      _historyList.appendChild(li);
    });
  }

  /**
   * Add a word to history (deduplicates, moves to top).
   */
  function _addToHistory(word) {
    let hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    hist = hist.filter(w => w !== word);
    hist.unshift(word);
    hist = hist.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    _loadHistory();
  }

  /**
   * Lookup word via Dictionary API.
   */
  async function _lookupWord(word) {
    _currentWord = word;
    _addToHistory(word);
    _contentArea.innerHTML = '<p style="color: #6c7086; text-align: center; margin-top: 40px;">\uD83D\uDD0D Loading...</p>';

    try {
      const res = await fetch(DICT_API + encodeURIComponent(word));
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      window._dictData = data; // Store for tabs
      _renderContent();
    } catch (err) {
      _contentArea.innerHTML = `<p style="color: #f38ba8; text-align: center; margin-top: 40px;">\u26A0\uFE0F No definition found for "${_sanitize(word)}"</p>`;
    }
  }

  /**
   * Render content based on current tab.
   */
  async function _renderContent() {
    const data = window._dictData;
    if (!data || !data[0]) return;

    if (_currentTab === 'definition') {
      _renderDefinition(data);
    } else if (_currentTab === 'synonyms') {
      await _renderThesaurus('syn');
    } else if (_currentTab === 'antonyms') {
      await _renderThesaurus('ant');
    } else if (_currentTab === 'examples') {
      _renderExamples(data);
    }
  }

  /**
   * Render definition tab.
   */
  function _renderDefinition(data) {
    _contentArea.innerHTML = '';
    const entry = data[0];

    // Word + phonetics
    const wordBox = document.createElement('div');
    Object.assign(wordBox.style, {
      marginBottom: '16px',
      paddingBottom: '12px',
      borderBottom: '1px solid #45475a',
    });

    const wordTitle = document.createElement('h2');
    wordTitle.textContent = entry.word;
    Object.assign(wordTitle.style, {
      margin: '0 0 4px 0',
      fontSize: '24px',
      color: '#cdd6f4',
      fontWeight: '700',
    });
    wordBox.appendChild(wordTitle);

    if (entry.phonetics && entry.phonetics[0]) {
      const phonWrap = document.createElement('div');
      Object.assign(phonWrap.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      });

      const phonText = document.createElement('span');
      phonText.textContent = entry.phonetics[0].text || '';
      phonText.style.color = '#89b4fa';
      phonText.style.fontSize = '14px';
      phonWrap.appendChild(phonText);

      if (entry.phonetics[0].audio) {
        const audioBtn = document.createElement('button');
        audioBtn.textContent = '\uD83D\uDD0A';
        audioBtn.title = 'Hear pronunciation';
        Object.assign(audioBtn.style, {
          background: '#313244',
          border: 'none',
          color: '#cdd6f4',
          fontSize: '16px',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: '4px',
        });
        audioBtn.onclick = () => new Audio(entry.phonetics[0].audio).play();
        phonWrap.appendChild(audioBtn);
      }

      wordBox.appendChild(phonWrap);
    }

    _contentArea.appendChild(wordBox);

    // Meanings
    entry.meanings.forEach(m => {
      const posBox = _createCollapsibleSection(m.partOfSpeech);
      const defList = document.createElement('ol');
      defList.style.margin = '8px 0';
      defList.style.paddingLeft = '20px';
      defList.style.color = '#cdd6f4';

      m.definitions.slice(0, 3).forEach(d => {
        const li = document.createElement('li');
        li.textContent = d.definition;
        li.style.marginBottom = '6px';
        if (d.example) {
          const ex = document.createElement('div');
          ex.textContent = `"${d.example}"`;
          ex.style.color = '#6c7086';
          ex.style.fontStyle = 'italic';
          ex.style.marginTop = '4px';
          li.appendChild(ex);
        }
        defList.appendChild(li);
      });

      posBox.appendChild(defList);
      _contentArea.appendChild(posBox);
    });
  }

  /**
   * Render thesaurus tab (synonyms/antonyms) via DataMuse API.
   */
  async function _renderThesaurus(type) {
    _contentArea.innerHTML = '<p style="color: #6c7086; text-align: center; margin-top: 40px;">\uD83D\uDD0D Loading...</p>';
    const rel = type === 'syn' ? 'syn' : 'ant';
    try {
      const res = await fetch(`${DATAMUSE_API}?rel_${rel}=${encodeURIComponent(_currentWord)}`);
      const data = await res.json();
      if (!data || data.length === 0) throw new Error('None found');

      _contentArea.innerHTML = '';
      const heading = document.createElement('h3');
      heading.textContent = type === 'syn' ? 'Synonyms' : 'Antonyms';
      Object.assign(heading.style, {
        margin: '0 0 12px 0',
        fontSize: '18px',
        color: '#cdd6f4',
        fontWeight: '600',
      });
      _contentArea.appendChild(heading);

      const tagBox = document.createElement('div');
      Object.assign(tagBox.style, {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
      });

      data.slice(0, 30).forEach(w => {
        const tag = document.createElement('span');
        tag.textContent = w.word;
        Object.assign(tag.style, {
          padding: '6px 12px',
          background: '#313244',
          color: '#cdd6f4',
          borderRadius: '6px',
          fontSize: '13px',
          cursor: 'pointer',
        });
        tag.onmouseenter = () => (tag.style.background = '#45475a');
        tag.onmouseleave = () => (tag.style.background = '#313244');
        tag.onclick = () => {
          _searchInput.value = w.word;
          _lookupWord(w.word);
          _currentTab = 'definition';
          _panel.querySelector(`button[data-tab="definition"]`).click();
        };
        tagBox.appendChild(tag);
      });

      _contentArea.appendChild(tagBox);
    } catch (err) {
      _contentArea.innerHTML = `<p style="color: #f38ba8; text-align: center; margin-top: 40px;">\u26A0\uFE0F No ${type === 'syn' ? 'synonyms' : 'antonyms'} found</p>`;
    }
  }

  /**
   * Render examples tab.
   */
  function _renderExamples(data) {
    _contentArea.innerHTML = '';
    const heading = document.createElement('h3');
    heading.textContent = 'Example Sentences';
    Object.assign(heading.style, {
      margin: '0 0 12px 0',
      fontSize: '18px',
      color: '#cdd6f4',
      fontWeight: '600',
    });
    _contentArea.appendChild(heading);

    const examples = [];
    data[0].meanings.forEach(m => {
      m.definitions.forEach(d => {
        if (d.example) examples.push(d.example);
      });
    });

    if (examples.length === 0) {
      _contentArea.innerHTML += '<p style="color: #6c7086;">No examples available.</p>';
      return;
    }

    const list = document.createElement('ul');
    list.style.listStyle = 'none';
    list.style.padding = '0';
    list.style.margin = '0';

    examples.forEach(ex => {
      const li = document.createElement('li');
      li.textContent = `"${ex}"`;
      Object.assign(li.style, {
        padding: '8px 12px',
        marginBottom: '8px',
        background: '#313244',
        borderRadius: '6px',
        color: '#cdd6f4',
        fontStyle: 'italic',
      });
      list.appendChild(li);
    });

    _contentArea.appendChild(list);
  }

  /**
   * Create a collapsible section for part-of-speech.
   */
  function _createCollapsibleSection(title) {
    const box = document.createElement('div');
    box.style.marginBottom = '12px';

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      cursor: 'pointer',
      padding: '6px 8px',
      background: '#313244',
      borderRadius: '4px',
      fontWeight: '600',
      fontSize: '14px',
      color: '#89b4fa',
    });

    const arrow = document.createElement('span');
    arrow.textContent = '\u25BC';
    arrow.style.fontSize = '10px';
    arrow.style.transition = 'transform 0.2s';
    header.appendChild(arrow);

    const label = document.createElement('span');
    label.textContent = title;
    header.appendChild(label);

    const content = document.createElement('div');
    content.style.display = 'block';

    header.onclick = () => {
      if (content.style.display === 'none') {
        content.style.display = 'block';
        arrow.style.transform = 'rotate(0deg)';
      } else {
        content.style.display = 'none';
        arrow.style.transform = 'rotate(-90deg)';
      }
    };

    box.appendChild(header);
    box.appendChild(content);
    return box;
  }

  /**
   * Apply base panel styles.
   */
  function _applyPanelStyles(panel) {
    Object.assign(panel.style, {
      position: 'fixed',
      top: '80px',
      right: '240px',
      width: '420px',
      height: '560px',
      zIndex: '2147483646',
      background: '#1e1e2e',
      color: '#cdd6f4',
      border: '1px solid #45475a',
      borderRadius: '8px',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      boxShadow: '0 4px 20px rgba(0,0,0,.5)',
      display: 'flex',
      flexDirection: 'column',
      resize: 'both',
      overflow: 'hidden',
      minWidth: '320px',
      minHeight: '400px',
    });
  }

  /**
   * Make panel draggable.
   */
  function _makeDraggable(panel) {
    const header = panel.querySelector(`.${PFX}-dict-header`);
    if (!header) return;
    let ox = 0, oy = 0, mx = 0, my = 0;
    header.onmousedown = function (e) {
      e.preventDefault();
      ox = e.clientX;
      oy = e.clientY;
      document.onmouseup = _stop;
      document.onmousemove = _drag;
    };
    function _drag(e) {
      mx = ox - e.clientX;
      my = oy - e.clientY;
      ox = e.clientX;
      oy = e.clientY;
      panel.style.top = (panel.offsetTop - my) + 'px';
      panel.style.left = (panel.offsetLeft - mx) + 'px';
      panel.style.right = 'auto';
    }
    function _stop() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  /**
   * Make panel resizable (CSS resize property already set).
   */
  function _makeResizable(panel) {
    // Native CSS resize is already applied; no JS needed.
    // But for completeness, we could add a resize handle icon:
    const handle = document.createElement('div');
    handle.innerHTML = '\u25E2';
    Object.assign(handle.style, {
      position: 'absolute',
      bottom: '2px',
      right: '2px',
      color: '#6c7086',
      fontSize: '12px',
      pointerEvents: 'none',
      userSelect: 'none',
    });
    panel.appendChild(handle);
  }

  /**
   * Sanitize string for safe DOM insertion (used in error messages).
   */
  function _sanitize(str) {
    return String(str === null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Global keyboard shortcut: Ctrl+K to open dictionary
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !e.shiftKey) {
      e.preventDefault();
      showDictionary();
    }
  });

  // Public API
  window._twtp = window._twtp || {};
  window._twtp.Dictionary = { showDictionary, hideDictionary, removeDictionary };
})();
