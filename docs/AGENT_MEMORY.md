# AGENT_MEMORY — Comet Autonomous Session Brain

> **Purpose:** This file is the persistent long-term memory for the Comet AI agent operating on this repository. It is updated at the end of every session and read at the start of every new session to re-establish context. The agent (Comet / Nemotron Ultra 253B on Perplexity Pro) reads this file FIRST before taking any action.

---

---

## 🔄 COMET-LOOP PROTOCOL — Autonomous Session Resumption

> **READ THIS SECTION FIRST.** This protocol ensures the agent works non-stop across sessions without requiring re-briefing. Every new session MUST execute this boot sequence before taking any other action.

### Boot Sequence (execute in order every session start)

1. **READ** `docs/AGENT_MEMORY.md` (this file) — full context restore
2. **READ** `docs/AGENT_ROADMAP.md` — current priorities and next tasks
3. **READ** `docs/WORK-LOG.md` — recent actions taken
4. **CHECK** open PRs: `https://github.com/shiimera-glitch/telegram-web-translator-pro/pulls`
5. **CHECK** Actions CI status: `https://github.com/shiimera-glitch/telegram-web-translator-pro/actions`
6. **EXECUTE** the highest-priority pending task from AGENT_ROADMAP.md
7. **UPDATE** this file + AGENT_ROADMAP.md + WORK-LOG.md at session end

### Loop Rules

- **Never stop mid-task** to ask for confirmation unless an irreversible destructive action is required
- **Never ask what to do next** — read AGENT_ROADMAP.md and execute
- **Never re-explain completed work** — update memory and move to next task
- **Always commit memory updates** at end of session via PR
- If blocked (CI red, merge conflict), document the blocker in WORK-LOG.md and move to next task in queue
- If all tasks complete, perform a full audit: check open issues, stale PRs, open dependabot PRs, CodeFactor alerts

### Session Identity

- Agent: Comet (Perplexity / Nemotron Ultra 253B)
- Repo owner: shiimera-glitch
- Project: Telegram Web Translator Pro (TWTP) — RTL/LTR bidi engine userscript
- Memory last updated: see `## @ Last Updated` below

### Priority Queue (next session picks up here)

1. Merge open dependabot PRs #30, #31 if CI green
2. Evaluate PR #16 (chokidar bump) — merge if safe
3. Implement comet-loop self-audit: after each PR merge, run full open-issue scan
4. Decide project rename (BabelGram / Teleglossia / TeleLingua / TG Lens / ClearGram / Hermes)
5. Migrate ESLint 8 → 10 flat config (tracked, deferred — open issue exists)
6. Add comet-loop unit tests to CI (verify AGENT_MEMORY.md has required sections)

## @ Last Updated
2026-06-19 ∼03:00 EDT (Session 5)

---

## 🟠 Repository Context
- **Repo:** `shiimera-glitch/telegram-web-translator-pro`
- **Purpose:** RTL/LTR bidi engine userscript for Telegram Web (v4.1.0)
- **Language:** 100% JavaScript (Tampermonkey/Violentmonkey/ScriptCat)
- **Main branch:** `main` (protected, requires CI + CodeQL)
- **Active branches:** `fix/ui-innerhtml-bug44`, `fix/registry-exports` (PRs open, CI pending)

---

## ✅ Completed This Session
### Session 5 (2026-06-19)
- Merged PR #29: `fix(deps): remove invalid labels from dependabot.yml` — removed non-existent `dependencies`, `automated`, `github-actions` labels
- Merged PR #28: `chore(version): bump package.json to 4.1.0, sync description`
- Opened PR #32: `fix(ui): replace innerHTML with createElement tree — BUG-44` — eliminates unsanitized `opts.tgtLang` injection in `11-ui.js`; adds `window._twtp.UI` export
- Opened PR #33: `fix(registry): add missing window._twtp exports to 02-langmap, 03-bidi, 13-context` — 3 modules were not registered in the `window._twtp` namespace
- **BUG-44 identified and fixed:** `11-ui.js` used `panel.innerHTML = \`...\`` with `opts.tgtLang` as unsanitized external input — replaced with full `createElement`/`textContent` tree
- **Registry gap found:** `02-langmap.js`, `03-bidi.js`, `13-context.js` had no `window._twtp` export blocks
- Confirmed `release.yml` historical failure (run triggered by PR #15 merge before dist filename fix in PR #27) was pre-fix and expected — not a current issue
- Confirmed `build.js` uses native `fs.watch` exclusively (not chokidar); chokidar PR #16 is safe to merge
- Confirmed `09-observer.js` has `_MAX_ERRORS = 3`, `WeakMap` blacklist, and `_processing` flag — compliant

### Session 4 (2026-06-20)
- Merged PR #23: `refactor/build-codefactor` → remove dead `execSync` import, cache `stamp()`, guard `bumpVersion()`, write PKG copy (4 checks passed)
- Merged PR #24: `fix/observer-codefactor` → `typeof MSGSEL` null guard, WeakMap error-count blacklist after `_MAX_ERRORS` (3 required checks passed)
- Confirmed PRs #20, #21, #22 already merged from Session 3
- Dependabot PRs #14 (setup-node 4→6) and #15 (checkout 4→7): CI queued, awaiting completion

### Session 3 (2026-06-20)
- Merged PR #19: `docs/contributing-and-changelog` → CONTRIBUTING.md + CHANGELOG.md
- Merged PR #20: `ci/github-templates` → PR template + issue templates
- Fixed and merged PR #21 (`ci/release-workflow`): Node 24, `npm install`, `.eslintignore`, `.eslintrc.json` sync
- Merged PR #22: `docs/agent-memory` → AGENT_MEMORY.md created
- Identified Dependabot PRs: #14 (setup-node 4→6), #15 (checkout 4→7), #16 (chokidar 3→5), #17 (eslint 8→10 — DANGEROUS, skip)

### Session 2 (2026-06-20)
- Created CI/CD pipeline, configured `.eslintrc.json` and `.coderabbit.yaml`, fixed environment inconsistencies, merged PR #18

### Session 1 (2026-06-20)
- Initial repo hardening, branch protection, Dependabot configuration, and CodeFactor integration

---

## 🔴 Open / Pending Tasks
1. **Monitor + Merge:** PR #32 (`fix/ui-innerhtml-bug44`) — CI pending
2. **Monitor + Merge:** PR #33 (`fix/registry-exports`) — CI pending
3. **Merge when CI passes:** PR #16 (chokidar 3→5) — Dependabot rebase triggered; chokidar not used in build.js (native `fs.watch` confirmed)
4. **Future:** ESLint 8→10 migration (PR #17 closed; requires flat config, plugin updates, breaking changes — planned for v4.2.0)
5. **Future:** `build.js` constants extraction (CodeFactor hotspot: magic strings for SRC_DIR, DIST_DIR, OUT_FILE)
6. **Future:** `comet-loop` architecture implementation (separate repo, 5-layer design)
7. **Decision pending:** Project rename — see Decisions section

---

## 🏗 Architecture Invariants
- **Security:** No `eval()`, `new Function()`, or `innerHTML` with unsanitized input. Use `createElement`/`textContent`/IDL property assignment.
- **Registry:** Every module MUST export via `window._twtp.<ModuleName> = { ... }` at EOF. No bare `window.*` state.
- **State:** Use `window._twtp.<Module>` for inter-module access. Use `DATA_ATTR.*` constants for all DOM data attributes — never inline `data-twtp-*` strings.
- **Observer:** Re-entrancy guard via `_processing` flag. Disconnect observers when not needed. `_MAX_ERRORS = 3` blacklist via WeakMap.
- **Environment:** Node 24 + `npm install` (no lockfile). ESLint must pass. CodeQL must pass.
- **Versioning:** Tag-triggered releases only (`v[0-9]+.[0-9]+.[0-9]+`). Version must be in sync across `package.json`, `src/00-header.js`, `dist/` filename.
- **DOM:** No hardcoded selectors. All IDs/classes use `${PFX}-*` pattern. No hardcoded API keys.

---

## 📝 Decisions
- **Versioning:** Standardized on tag-triggered releases (`v4.1.0`).
- **Code Quality:** Enforced `no-undef`, `no-var`, and `eqeqeq` via ESLint.
- **Architecture:** `_processing` flag pattern for observer re-entrancy. WeakMap for per-element error count.
- **Maintenance:** AGENT_MEMORY.md + AGENT_ROADMAP.md persist state across agent sessions.
- **dist filename:** `TelegramWebTranslatorPro.user.js` (PascalCase) — fixed in PR #27.
- **Dependabot labels:** Removed invalid labels (`dependencies`, `automated`, `github-actions`) in PR #29.
- **chokidar:** Safe to accept bump (PR #16) — not used in build.js. Watch mode uses native `fs.watch`.
- **ESLint 10:** Deferred. Requires flat config migration + peer-dep updates. Track for v4.2.0.
- **Project rename 🔄 OPEN DECISION:** User is considering renaming the project. Candidates discussed:
  - **BabelGram** (recommended — universally understood, zero trademark conflicts, maps to clean slug/dist)
  - **Teleglossia** (unique, Greek *glossia* = tongue, zero collisions)
  - **TeleLingua** (Latin, professional, multilingual-friendly)
  - **TG Lens**, **ClearGram**, **Hermes for Telegram**, **TW·i18n** (alternatives)
  - **Rename scope:** `package.json`, `src/00-header.js` (`@name`, `@namespace`), `build.js` (`OUT_FILE`), `release.yml`, GitHub repo slug, `window._twtp` registry key (needs deprecation shim)
  - **Status:** No decision made yet. Waiting for user direction.

---

## 📋 Lessons Learned
- `release.yml` must only trigger on `push: tags:` pattern — not on branch pushes.
- `dist` filename must exactly match across `build.js` `OUT_FILE` and `release.yml` verification step.
- Dependabot `labels:` entries must reference labels that actually exist in the repo.
- All src modules must self-register via `window._twtp` — audit new modules on creation.
- `innerHTML` with any external input is forbidden even if input appears controlled.
- `npm ci` fails without a lockfile — use `npm install`.
- Node 20 is deprecated; use Node 24 in all CI workflows.

---

## 💾 Session 6 — Completed Items

**Date:** 2026-06-19 (continuation of Session 5)

**Completed items (Session 6):**
- Reviewed PR #37 CodeRabbit feedback — 2 actionable items identified
- Fixed `meta.json`: removed wildcard `"*"` from `connect` allowlist (security hardening) — commit `86fe7bd`
- Fixed `build.js`: replaced `require('./package.json')` with `require('./meta.json')` as single source of truth; derived `OUT_FILE` from `META.slug` — commit `e05f272`
- Merged PR #37 `feat(meta): add meta.json — single source of truth` into `main` (3 commits, 3 checks passed)
- Deleted `feat/meta-single-source` branch post-merge

**Current main branch state:**
- `meta.json` is the canonical single source of truth for name, slug, version, description, namespace, match, grant, connect, runAt
- `build.js` reads `META = require('./meta.json')`, derives `OUT_FILE` from `META.slug`, bumps both `meta.json` and `package.json` when `--bump` is passed
- No wildcard in `connect` — all 9 translation API domains explicitly listed
- All v4.1.0 CI checks green (PR Quality Check + CodeQL + coderabbitai)

**Next session priorities:**
1. Tag `v4.1.0` release — create GitHub release pointing to `main` HEAD with `dist/TelegramWebTranslatorPro.user.js` artifact
2. Update `AGENT_ROADMAP.md` — mark meta single-source milestone as done
3. Address ESLint warnings (10 `no-unused-vars` in pua/segmenter/bidi) — track as separate issue/PR
4. Project rename decision — awaiting user direction (BabelGram / Teleglossia / TeleLingua candidates)
