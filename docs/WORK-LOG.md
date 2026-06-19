# Work Log — telegram-web-translator-pro

Session journal, efficiency registry, inter-model delegation record, and known bug tracker. Add entries at the **top** of each section. Date: YYYY-MM-DD.

---

## Efficiency Registry — Comet Operational Shortcuts

### GitHub Web Editor (Learned 2026-06-18)
| Pattern | Method | Notes |
| :--- | :--- | :--- |
| **Read raw files** | `raw.githubusercontent.com/…/src/XX-file.js` | Avoids GitHub UI DOM overhead; use `get_page_text` on raw URL for instant full text |
| **New file in folder** | Navigate to `github.com/USER/REPO/new/BRANCH/FOLDER` | Filename input is pre-focused on load |
| **Fill editor content** | `find` → `form_input ref=refXXX value="..."` | CodeMirror textarea; DO NOT use `computer type` for large content |
| **Commit dialog trigger** | Click "Commit changes…" button (top-right, x≈1208 y≈119) | Opens modal with message field |
| **Commit message field** | Click message input in modal, `ctrl+a` → type new msg | Pre-filled with "Create FILENAME" |
| **Commit submit** | Click "Commit changes" button in modal (x≈787 y≈642) | Navigates to folder view on success |
| **Verify commit** | Check folder view — file appears with commit msg + timestamp | No extra nav needed |

### Z.ai / GLM-5.2 (Learned 2026-06-18)
| Pattern | Method | Notes |
| :--- | :--- | :--- |
| **Send message** | `find "chat message input textarea"` → `left_click ref` → `type` → `key Return` | Send button at ref_7610 also works |
| **Deep Think mode** | Default when chat starts — blue spinner in bottom-right confirms active | Use for complex multi-step analysis |
| **New chat** | `left_click` on "New Chat" in sidebar (x≈61 y≈139) | Resets context |

### Vibe / Mistral leChat (Learned 2026-06-18)
| Pattern | Method | Notes |
| :--- | :--- | :--- |
| **Send message** | `find "chat input box"` → `left_click ref` → `type` → `key Return` | Contenteditable div, not textarea |
| **GitHub connector** | Vibe does NOT have live GitHub access — must paste raw file contents directly | Always pre-fetch raw files then paste summaries |

---

## Inter-Model Delegation Log

### 2026-06-18 — Session 1: Source Code Audit

| Model | Task Assigned | Status | Raw File Access |
| :--- | :--- | :--- | :--- |
| **Vibe (Mistral)** | Cross-ref 22-engines.js→01-constants.js; flag undocumented selectors; flowchart 09-observer↔10-cache | In progress | No — fed structured summaries |
| **GLM-5.2 (Deep Think Max)** | Full bug audit: engine gaps, name mismatches, cache inconsistency, microtask safety, 3 code patches | In progress | No — fed structured summaries |

#### Pre-identified Bugs (found by Comet before model responses)
1. **Engine name mismatch** — `22-engines.js` registers `name: 'microsoft'` but `01-constants.js:ENGINES[]` declares `id: 'azure'`. `Engines.get('azure')` returns `null` at runtime.
2. **Cache max inconsistency** — `10-cache.js` uses hardcoded `CACHE_MAX_L2 = 2000` but `01-constants.js:TIMING.cacheMaxEntries = 800`. `10-cache.js` ignores `TIMING` entirely for its eviction threshold.
3. **Engine coverage gap** — `22-engines.js` registers 4 engines (`google`, `deepl`, `libretranslate`, `microsoft`) but `ENGINES[]` declares 10. Missing: `deepl_pro`, `mymemory`, `lingva`, `openai`, `anthropic`, `yandex`.

---

## Bug Tracker

| ID | File | Severity | Description | Status |
| :--- | :--- | :--- | :--- | :--- |
| BUG-01 | 22-engines.js | **HIGH** | `name: 'microsoft'` ≠ `id: 'azure'` in ENGINES[] — engine lookup fails | Open |
| BUG-02 | 10-cache.js | **MED** | `CACHE_MAX_L2=2000` ignores `TIMING.cacheMaxEntries=800` — diverged constants | Open |
| BUG-03 | 22-engines.js | **HIGH** | 6 of 10 declared engines have no `register()` implementation | Open |

---

## Session Summary — 2026-06-18

| Item | Detail |
| :--- | :--- |
| Docs committed | `docs/lessons-learned.md`, `docs/ARCHITECTURE.md`, `docs/WORK-LOG.md` |
| Models delegated | Vibe (Mistral), GLM-5.2 |
| Bugs pre-identified | 3 (BUG-01, BUG-02, BUG-03) |
| Next action | Collect model outputs → patch bugs → commit fixes to `src/` |
