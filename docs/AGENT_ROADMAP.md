# AGENT_ROADMAP — Comet Development Roadmap

> **Purpose:** Tracks planned work, priorities, and long-term direction for the agent. Updated each session after reviewing AGENT_MEMORY.md. Read alongside AGENT_MEMORY.md at session start.

---

## @ Last Updated
2026-06-19 ∼03:00 EDT (Session 5 revision)

---

## 🟥 Priority 0 — Immediate (This Session / Next Session)

| # | Task | Status | Notes |
|---|------|--------|-------|
| P0-1 | Merge PR #32 (`fix/ui-innerhtml-bug44`) | ⏳ CI pending | Critical security fix — BUG-44 |
| P0-2 | Merge PR #33 (`fix/registry-exports`) | ⏳ CI pending | 3 modules missing `window._twtp` |
| P0-3 | Merge PR #34 (`docs/session5-memory-update`) | ⏳ CI pending | AGENT_MEMORY + ROADMAP sync |
| P0-4 | Merge PR #16 (chokidar 3→5) | ⏳ Awaiting Dependabot rebase | `fs.watch` confirmed; safe |
| P0-5 | **Project rename decision** | ⏳ Awaiting user | Candidates: BabelGram ★, Teleglossia, TeleLingua |

---

## 🟠 Priority 1 — High (v4.1.x / Near-term)

| # | Task | Status | Notes |
|---|------|--------|-------|
| P1-1 | `build.js` constants extraction | 🟡 Planned | CodeFactor hotspot: `SRC_DIR`, `DIST_DIR`, `OUT_FILE` as bare strings |
| P1-2 | Audit remaining src modules for `window._twtp` exports | 🟡 Planned | `04-segmenter`, `05-pua`, `06-extractor`, `07-translator`, `08-injector`, `10-cache`, `12-settings`, `14–n` |
| P1-3 | Branch protection ruleset activation | 🟡 Planned | Tab `Settings → Rules → new` is pre-loaded |
| P1-4 | Audit `12-settings.js` for `GM_setValue`/`GM_getValue` usage | 🟡 Planned | Must use ScriptCat-compatible API fallbacks |

---

## 🟡 Priority 2 — Medium (v4.2.0)

| # | Task | Status | Notes |
|---|------|--------|-------|
| P2-1 | ESLint 8→10 migration | 🔵 Deferred | Flat config required; peer-dep updates; plan as separate feature branch |
| P2-2 | DeepL engine integration | 🔵 Planned | Add alongside Google Translate; user-selectable in UI panel |
| P2-3 | Persistent language memory | 🔵 Planned | Remember per-chat tgtLang via `GM_setValue`; key = chat ID |
| P2-4 | Auto-detect RTL/LTR per message | 🔵 Planned | Use `03-bidi.js` `detectDir()` — already implemented, needs integration |
| P2-5 | ScriptCat native API support | 🔵 Planned | `GM.xmlHttpRequest` vs `GM_xmlhttpRequest` shim |
| P2-6 | Module 22-25 stabilization | 🔵 Planned | High-priority per original roadmap |

---

## 🟢 Priority 3 — Low / Future

| # | Task | Status | Notes |
|---|------|--------|-------|
| P3-1 | Toolbar UI redesign | 🔵 Low | Cleaner settings panel; keyboard shortcut support |
| P3-2 | Greasy Fork / OpenUserJS publication | 🔵 Future | After rename decision is made |
| P3-3 | Automated E2E test harness | 🔵 Future | Playwright + Telegram Web sandbox |

---

## 🤖 Comet-Loop Architecture

**Status:** Design Phase. **Priority:** P1 after rename decision.

**Purpose:** An autonomous agent persistence framework designed to enable unlimited session operation by overcoming the ~200 tool-step interruption limit.

### 5-Layer Design
| Layer | Name | Description |
|-------|------|-------------|
| 1 | **State** | GM Storage schema: session ID, status, task queue, heartbeat |
| 2 | **Background** | ScriptCat worker: heartbeat, revival, exponential backoff |
| 3 | **Router** | Cross-tab message bus (GitHub ↔ Perplexity) |
| 4 | **Injector** | Monitors Perplexity UI to inject tasks + resume prompts |
| 5 | **Executor** | GitHub DOM executor: merges PRs, reads CI status, edits files |

### Implementation Plan
- **Repository:** Separate repo for clean separation and reusability
- **Core files:** `state-manager.js`, `background-worker.js`, `perplexity-injector.js`, `github-executor.js`, `rate-limiter.js`, `tab-router.js`
- **Evolution:** State mgmt → background polling → UI injection → GitHub automation

### Success Metrics
- Session length: ~200 steps → unlimited
- GitHub token efficiency: -40% (via userstyles removing decorative elements)
- Merge cycle time: ~10 min → ~3 min

---

## 📊 Project Rename Decision Matrix

| Name | Pros | Cons | Slug | Score |
|------|------|------|------|-------|
| **BabelGram** | Universal understanding; zero trademark conflicts; clean slug | None found | `babelgram` | ★★★★★ |
| **Teleglossia** | Unique; zero npm/GitHub collisions; scholarly | Harder to pronounce in some languages | `teleglossia` | ★★★★ |
| **TeleLingua** | Latin; professional; multilingual-friendly | Less unique | `tele-lingua` | ★★★★ |
| **TG Lens** | Very short | Too generic; could apply to many TG tools | `tg-lens` | ★★★ |
| **ClearGram** | Intuitive | Sounds like a cleaning product | `cleargram` | ★★★ |
| **Hermes for Telegram** | Strong mythology metaphor | Long; not slug-friendly | `hermes-tg` | ★★★ |
| **TW·i18n** | Technically precise | Too developer-jargon for end users | `tw-i18n` | ★★★ |

**Current recommendation: BabelGram**

### Rename Scope (atomic PR when decided)
1. `package.json` — `name`, `description`
2. `src/00-header.js` — `@name`, `@namespace`, `@description`
3. `build.js` — `OUT_FILE` constant
4. `.github/workflows/release.yml` — dist path references
5. GitHub repo Settings → rename slug
6. `window._twtp` registry key — add deprecation shim for `_babelgram` alias
7. `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md` — name references

---

## 📌 Session History Summary

| Session | Date | Key Accomplishments |
|---------|------|---------------------|
| 1 | 2026-06-20 | Repo hardening, branch protection, Dependabot, CodeFactor |
| 2 | 2026-06-20 | CI/CD pipeline, ESLint, CodeRabbit, PR #18 |
| 3 | 2026-06-20 | Docs, CI templates, release.yml, AGENT_MEMORY.md |
| 4 | 2026-06-20 | CodeFactor hotspot fixes (PRs #23, #24), Dependabot PRs #14/#15 |
| 5 | 2026-06-19 | BUG-44 (innerHTML), registry exports, PR #28/#29 merged, ROADMAP revised, rename decision documented |
