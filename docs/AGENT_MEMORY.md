# AGENT_MEMORY — Comet Autonomous Session Brain

> **Purpose:** This file is the persistent long-term memory for the Comet AI agent operating on this repository. It is updated at the end of every session and read at the start of every new session to re-establish context. The agent (Comet / Nemotron Ultra 253B on Perplexity Pro) reads this file FIRST before taking any action.

---

## 🗓 Last Updated
2026-06-20 ~03:00 EDT (Session 4)

---

## 🧠 Repository Context
- **Repo:** `shiimera-glitch/telegram-web-translator-pro`
- **Purpose:** RTL/LTR bidi engine userscript for Telegram Web (v4.1.0)
- **Language:** 100% JavaScript (Tampermonkey/Violentmonkey/ScriptCat)
- **Main branch:** `main` (protected, requires CI + CodeQL)
- **Active branches:** none (all feature branches merged and deleted)

---

## ✅ Completed This Session
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

### Session 2 (2026-06-19)
- Created CI/CD pipeline: `pr-check.yml`, `codeql.yml`, `release.yml`
- Created `.eslintrc.json` with full globals
- Created `.coderabbit.yaml`
- Fixed Node 24 / npm install inconsistency across branches
- Merged PR #18: `ci/fix-pr-check-node24`

### Session 1 (2026-06-19)
- Initial repository hardening
- Branch protection setup
- Dependabot configuration
- CodeFactor integration

---

## 🔴 Open / Pending Tasks (Priority Order)
1. **IN PROGRESS:** Merge Dependabot PRs #14 (setup-node 4→6), #15 (checkout 4→7) — CI queued
2. **SKIP:** PR #17 (eslint 8→10) — BREAKING CHANGE, requires flat config migration
3. **CAUTION:** PR #16 (chokidar 3→5) — test build first before merging
4. **TAG:** Push `git tag v4.1.0` to trigger `release.yml` once all PRs merged
5. **PLAN:** Initialize `comet-loop` architecture — autonomous agent persistence design

---

## 🏗 Architecture Invariants (NEVER violate)
- All modules register via `window._twtp.<name>` — no bare `window.*` state
- All DOM data attributes via `DATA_ATTR.*` constants — no inline `data-twtp-*` strings
- No `eval()`, `new Function()`, or `innerHTML` with unsanitized input
- No hardcoded API keys, tokens, or credentials
- Observer callbacks guarded against re-entrancy (`_processing` flag pattern)
- Injection functions are idempotent (check `DATA_ATTR.INJECTED` before acting)
- ESLint: `no-undef`, `no-var`, `eqeqeq` enforced; `.eslintignore` for `19-compat.js`, `21-footer.js`
- CI uses Node 24 + `npm install` (no lockfile in repo)

---

## 📋 Lessons Learned
- CodeFactor hotspots: dead imports, mutation of cached objects, missing null guards — all addressed in PRs #23/#24
- Dependabot PRs need label `dependencies` + `github-actions` — currently missing from `.github/dependabot.yml`
- Branch protection requires CI + CodeQL to pass; merge button stays greyed until both complete
- `release.yml` is tag-triggered: `git tag v4.1.0 && git push --tags` fires the release pipeline
- CodeRabbit reviews are non-blocking (not Required); merge when required checks pass
