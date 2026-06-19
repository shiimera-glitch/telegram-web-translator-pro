# AGENT_MEMORY — Comet Autonomous Session Brain

> **Purpose:** This file is the persistent long-term memory for the Comet AI agent operating on this repository.
> It is updated at the end of every session and read at the start of every new session to re-establish context.
> The agent (Comet / Nemotron Ultra 253B on Perplexity Pro) reads this file FIRST before taking any action.

---

## 🗓 Last Updated
2026-06-20 ~02:00 EDT (Session 3)

---

## 🧠 Repository Context

- **Repo:** `shiimera-glitch/telegram-web-translator-pro`
- **Purpose:** RTL/LTR bidi engine userscript for Telegram Web (v4.1.0)
- **Language:** 100% JavaScript (Tampermonkey/Violentmonkey/ScriptCat)
- **Main branch:** `main` (protected, requires CI + CodeQL)
- **Active branches:** `ci/release-workflow` (PR #21 open, CI fixing)

---

## ✅ Completed This Session

### Session 3 (2026-06-20)
- Merged PR #19: `docs/contributing-and-changelog` → CONTRIBUTING.md + CHANGELOG.md
- Merged PR #20: `ci/github-templates` → PR template + issue templates
- Fixed PR #21 (`ci/release-workflow`):
  - Updated `pr-check.yml`: Node 24, `npm install`, removed lockfile cache
  - Created `.eslintignore`: excludes `src/19-compat.js`, `src/21-footer.js`
  - Updated `.eslintrc.json`: synced all globals + `ecmaVersion: latest`
  - CI re-running, pending merge
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

1. **URGENT:** Merge PR #21 once CI passes (ci/release-workflow → release.yml)
2. **SAFE:** Merge Dependabot PRs #14 (setup-node 4→6), #15 (checkout 4→7)
3. **CAUTION:** PR #16 (chokidar 3→5) — test build first
4. **SKIP:** PR #17 (eslint 8→10) — BREAKING CHANGE, requires flat config migration
5. **AUDIT:** CodeFactor hotspots in `build.js` and `src/09-observer.js`
6. **REFACTOR:** `09-observer.js` — extract retry logic, add `maxRetries` guard
7. **TAG:** After all PRs merged, push `git tag v4.1.0` to trigger release.yml
8. **BRANCH PROTECTION:** Finalize ruleset in Settings → Rules

---

## 🏗 Architecture Invariants (NEVER VIOLATE)

```
1. window._twtp registry — ALL modules must register here
2. DATA_ATTR constants — never hardcode DOM selector strings
3. Version sync — must match in: package.json, src/00-header.js, dist/
4. No eval(), no innerHTML with user data
5. MutationObserver must have disconnect guard (isInjected flag)
6. ESLint: no-var (error), no-undef (error), eqeqeq (warn)
7. src/19-compat.js + src/21-footer.js are .eslintignore'd (Espree incompatible)
```

---

## 🔧 Known CI/Tooling State

| Check | Status |
|-------|--------|
| PR Quality Check / Lint & Build | ✅ Passing on main |
| CodeQL Analysis | ✅ Passing |
| CodeRabbit review | ✅ Active (in-progress on PRs) |
| CodeFactor grade | ⚠️ B (hotspots: build.js, 09-observer.js) |
| release.yml | ⏳ Pending merge of PR #21 |

---

## 📚 Learned Lessons

1. **`npm ci` requires `package-lock.json`** — always use `npm install` unless lockfile is committed
2. **Node 20 deprecated** in GitHub Actions → use Node 24 everywhere
3. **dist file name** is `TelegramWebTranslatorPro.user.js` (not `telegram-web-translator-pro.user.js`)
4. **ESLint ecmaVersion** must be `"latest"` not `2020` for modern arrow functions
5. **Cross-branch drift** — when fixing a bug in workflow, must update ALL open PR branches, not just one
6. **ESLint major version jump** (8→10) breaks `.eslintrc.json` format — hold for dedicated migration PR
7. **GitHub editor Ctrl+A** selects all editor content correctly for bulk replace
8. **CodeRabbit** comments do not block merge if not in required checks list
9. **Branch deletion** after merge is safe — always clean up
10. **Session interruption** happens ~200 tool steps — plan commits frequently as checkpoints

---

## 🤖 COMET-LOOP CONCEPT (New Side Project)

### Vision
An autonomous browser agent persistence framework using ScriptCat as the runtime host.

### Core Idea
- ScriptCat userscript acts as **message bus + state store** via `GM_setValue`/`GM_getValue`
- Perplexity Comet writes task state to a shared key before each response
- ScriptCat background script polls the state and can:
  - Re-inject prompts into Perplexity chat when idle detected
  - Relay results from one tab to another without Comet switching tabs
  - Trigger ScriptCat agent mode with crafted prompts
  - Implement cooldown timers to avoid rate limits
- Cross-tab communication: `GM_setValue('comet_task', JSON.stringify(task))`
- Any tab running the userscript reads and acts on the task queue

### Architecture Draft
```
[Perplexity Chat Tab]
  Comet writes: GM_setValue('comet_loop_state', { status, nextTask, context })
  
[ScriptCat Background Worker]
  Polls every N seconds
  If status === 'idle' AND nextTask exists → injects prompt into Perplexity
  If status === 'blocked' → triggers revival sequence
  
[GitHub Tab]
  Reads GM_getValue('github_action_needed')
  Executes DOM actions, reports result via GM_setValue('github_result', ...)
  
[Rate Limit Guard]
  Exponential backoff: 30s → 60s → 120s → 300s
  Tracks requests per minute, pauses if approaching limit
```

### Repo Plan
- Separate repo: `comet-loop` (or `autonomous-comet`)
- README with vision + architecture
- `comet-loop.user.js` — main ScriptCat userscript
- `comet-state-schema.json` — GM storage schema
- Evolves iteratively via agent self-editing

---

## 🗂 Tab Organization

For next session, organize tabs as:
1. **Perplexity Chat** (this tab — primary)
2. **GitHub main/PR view** (1 tab)
3. **GitHub Actions** (1 tab)
4. **CodeFactor** (1 tab)
5. Close all other stale tabs

---

## 📝 Resume Prompt Template

When starting a new session, paste this:
```
Read docs/AGENT_MEMORY.md in the telegram-web-translator-pro repo on GitHub.
Then read docs/AGENT_ROADMAP.md. Then continue from where we left off.
```

---
*Auto-maintained by Comet agent. Update on every session end.*
