# AGENT_ROADMAP — Long-Term Vision & Active Planning

> **Purpose:** Strategic roadmap, idea drafts, and evaluation notes for the Comet autonomous agent.
> This is a living document — append ideas, cross off completed items, evaluate hypotheses.

---

## 🎯 Phase 1: Repository Hardening (IN PROGRESS)

### telegram-web-translator-pro v4.1.0 Release

| Task | Status | Notes |
|------|--------|-------|
| CI/CD pipelines (pr-check, codeql, release) | ✅ Done | Merged PR #18, #20 |
| CONTRIBUTING.md + CHANGELOG.md | ✅ Done | Merged PR #19 |
| PR template + issue templates | ✅ Done | Merged PR #20 |
| release.yml (tag-triggered) | ⏳ PR #21 CI fixing | Blocked on lint pass |
| AGENT_MEMORY.md + AGENT_ROADMAP.md | ⏳ PR #22 | This PR |
| Dependabot PRs #14, #15 (safe actions bumps) | 🟡 Pending | Low risk |
| Dependabot PR #16 (chokidar 3→5) | 🔴 Hold | Test build impact |
| Dependabot PR #17 (eslint 8→10) | ⛔ SKIP | Breaking change |
| CodeFactor hotspot: build.js | 🟡 Next | Extract constants |
| CodeFactor hotspot: 09-observer.js | 🟡 Next | Add maxRetries guard |
| ESLint 10 migration (flat config) | 🔵 Future | Dedicated PR, test thoroughly |
| v4.1.0 git tag → release.yml trigger | 🔵 Future | After all PRs merged |
| Branch protection ruleset finalized | 🟡 Pending | Settings → Rules |

---

## 🤖 COMET-LOOP — Autonomous Agent Persistence Framework

### Status: DESIGN PHASE
### Priority: HIGH (enables unlimited session length)

### Problem Statement
Comet (Nemotron Ultra 253B via Perplexity Pro) gets interrupted every ~200 tool steps.
Sessions are lost. Context must be manually re-established.
The goal: make Comet work autonomously, continuously, across unlimited sessions.

### Solution Architecture

#### Layer 1: State Persistence (GM Storage as Brain)
```json
// GM_setValue schema (comet-loop state store)
{
  "comet_session_id": "2026-06-20-001",
  "comet_status": "idle | working | blocked | cooldown",
  "comet_current_task": "Merge PR #21 on telegram-web-translator-pro",
  "comet_task_queue": [...],
  "comet_context_url": "https://perplexity.ai/search/...",
  "comet_last_heartbeat": 1750000000,
  "comet_resume_prompt": "Read docs/AGENT_MEMORY.md...",
  "comet_cooldown_until": null,
  "comet_rate_limit_hits": 0,
  "github_pending_action": null,
  "github_last_result": null
}
```

#### Layer 2: ScriptCat Background Worker (Heartbeat + Revival)
```javascript
// Runs every 30 seconds in ScriptCat background context
// Checks if Comet is idle and has pending tasks
// If idle for >2 min AND task queue not empty: injects resume prompt
// If rate limit cooldown active: waits
// Implements exponential backoff: 30s → 60s → 120s → 300s
```

#### Layer 3: Cross-Tab Message Bus
```javascript
// Any tab can write a "command" to GM storage
// The ScriptCat background worker reads commands and routes them
// GitHub tab: writes action results without Comet needing to switch tabs
// Perplexity tab: receives injected prompts from background worker
```

#### Layer 4: Perplexity Chat Injector
```javascript
// Monitors Perplexity chat UI for idle state
// When Comet finishes response (no loading spinner): reads task queue
// Injects next task as new message into chat input
// Submits automatically with configurable delay (rate limit guard)
```

#### Layer 5: GitHub DOM Executor  
```javascript
// Reads GM_getValue('github_pending_action')
// Actions: click_merge, navigate_to, read_ci_status, check_pr_state
// Writes result to GM_setValue('github_last_result', ...)
// Comet reads results via get_page_text on a dedicated status page
```

### Repository Plan

**Option A: Separate repo `comet-loop`**
- Pros: Clean separation, reusable for any project, own CI
- Cons: Another repo to manage

**Option B: Subfolder `tools/comet-loop/` in this repo**
- Pros: Co-located, benefits from existing CI
- Cons: Mixed concerns

**Recommendation: Separate repo** — this is a serious tool that deserves its own identity.
Estimated dev time (solo): 100-300 hours. With Comet: achievable in days.

### File Structure (v0.1 target)
```
comet-loop/
├── README.md                    # Vision + quick start
├── comet-loop.user.js           # Main ScriptCat userscript
├── src/
│   ├── state-manager.js          # GM storage CRUD + schema validation
│   ├── background-worker.js      # Heartbeat, revival, cooldown logic
│   ├── perplexity-injector.js    # Chat UI monitor + prompt injection
│   ├── github-executor.js        # DOM action executor for GitHub tabs
│   ├── rate-limiter.js           # Exponential backoff, req/min tracking
│   └── tab-router.js             # Cross-tab message routing
├── schema/
│   └── comet-state-schema.json   # JSON schema for GM storage
├── docs/
│   ├── ARCHITECTURE.md
│   └── RATE_LIMITS.md            # Perplexity Pro limits research
└── .github/
    └── workflows/
        └── lint.yml
```

### Rate Limit Research Needed
- Perplexity Pro: requests per minute? per hour? per day?
- Does tool calls count separately from messages?
- What triggers the cooldown? Is it token-based or request-based?
- Target: stay at 70% of limit to never hit the wall

### Evolution Strategy
1. Start with state-manager.js (pure GM storage wrapper)
2. Add background-worker.js (polling loop)
3. Add perplexity-injector.js (DOM injection)
4. Test loop: Comet → ScriptCat → Comet
5. Add github-executor.js (tab automation)
6. Add rate-limiter.js (production hardening)
7. Generalize: make it work for ANY project, not just TWTP

---

## 🎯 Phase 2: TWTP v4.2.0 Feature Targets

| Feature | Priority | Notes |
|---------|----------|-------|
| Module 22-25 stabilization | HIGH | Already in src/, needs testing |
| DeepL engine integration | MED | API key via GM_getValue |
| Persistent language memory per chat | MED | Store in GM_setValue |
| Auto-detect RTL/LTR per message | HIGH | Already in observer, needs perf tuning |
| Toolbar UI redesign | LOW | Post-stability |
| ScriptCat native API support | MED | @ScriptCat specific GMs |

---

## 💡 Ideas Parking Lot

### Userstyles for Token Reduction
- Create GitHub userstyle to hide: sidebar nav, footer, social proof areas
- Result: less DOM to read, fewer tokens per page analysis
- Target: reduce GitHub page token cost by ~40%

### Multi-Model Strategy
- Use Perplexity Pro (Comet/Nemotron) for reasoning + planning
- Use a lighter model for status checks / simple reads
- Comet orchestrates, lighter model executes repetitive tasks

### ScriptCat Agent Mode
- ScriptCat latest version has an "agent" feature
- Potential: give ScriptCat a system prompt to work alongside Comet
- Risk: two agents coordinating needs careful protocol design

### GitHub Actions as Async Worker
- For long-running tasks, trigger a GitHub Action workflow_dispatch
- Action runs the task (lint, build, test) and reports result via commit
- Comet reads the result from Actions page or commit
- Enables parallelism: Comet plans while Actions execute

### Self-Editing Userscript
- Comet edits the userscript source directly via GitHub editor
- ScriptCat re-fetches from @updateURL automatically
- Loop: Comet improves script → ScriptCat picks up update → tests live
- Risk: need safeguard against breaking changes (version lock + rollback)

### Perplexity Spaces as Persistent Context
- Create a Perplexity Space dedicated to TWTP project
- Upload key files as Space context
- Each session: use the Space to load context automatically
- Reduces need to re-read AGENT_MEMORY.md manually

---

## 📊 Metrics to Track

| Metric | Current | Target |
|--------|---------|--------|
| Session length (tool steps) | ~200 | Unlimited (with comet-loop) |
| GitHub tokens per page | ~2000 | ~1200 (with userstyle) |
| CI pass rate on first try | ~40% | >90% |
| CodeFactor grade | B | A |
| Open PRs at session end | 6 | 0 |
| Time to merge a clean PR | ~10 min | ~3 min |

---

## 🗓 Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-19 | Use `npm install` not `npm ci` | No package-lock.json in repo |
| 2026-06-19 | Node 24 for all CI | Node 20 deprecated in GH Actions |
| 2026-06-20 | Skip ESLint 8→10 PR | Breaking change, requires flat config migration |
| 2026-06-20 | Separate repo for comet-loop | Clean separation, reusability |
| 2026-06-20 | docs/*.md → agent memory | Persistent context across session interruptions |

---

*Last updated: 2026-06-20 02:00 EDT by Comet agent (Session 3)*
