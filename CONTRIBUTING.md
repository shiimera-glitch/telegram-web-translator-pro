# Contributing to telegram-web-translator-pro

Thank you for contributing. This document explains the exact workflow required to get changes merged into `main`.

## Architecture constraints

Before writing any code, understand these non-negotiable invariants:

1. **Module registry** — every module must register itself via `window._twtp.<name> = ...`. Never attach state directly to `window` outside this namespace.
2. **DOM constants** — all data attributes must be referenced through `DATA_ATTR` constants defined in `src/01-constants.js`. Never hardcode attribute strings like `'data-twtp-*'` inline.
3. **Version sync** — `@version` in `src/00-header.js`, `VER` in `src/01-constants.js`, and the boot log string in `src/20-init.js` must always be identical. The CI `Check version consistency` step will fail the build if they diverge.
4. **Observer discipline** — `src/09-observer.js` uses a `MutationObserver` with an internal `_processing` guard. Never call observer callbacks recursively or synchronously within a mutation handler.
5. **Injection idempotency** — `src/08-injector.js` checks `DATA_ATTR.INJECTED` before injecting UI. Every injection function must be idempotent.

## Development setup

```bash
git clone https://github.com/shiimera-glitch/telegram-web-translator-pro.git
cd telegram-web-translator-pro
npm install
```

Install the script in [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) pointing at `dist/telegram-web-translator-pro.user.js`, or use the `@require` chain directly from `src/`.

## Branch and PR flow

- `main` is a **protected branch**. Direct pushes are blocked by ruleset ID 17876690.
- All changes must go through a pull request from a feature branch.
- Branch naming: `fix/<short-description>`, `feat/<short-description>`, `ci/<short-description>`, `docs/<short-description>`.
- Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`.
  - Valid types: `fix`, `feat`, `ci`, `docs`, `chore`, `refactor`, `perf`
  - Reference issue numbers where applicable: `fix(observer): prevent recursive mutation loop #9`

## Required status checks

Every PR must pass both of these before merge is allowed:

| Check | What it does |
|---|---|
| **Lint & Build** (PR Quality Check workflow) | Runs ESLint, builds the userscript bundle via `build.js`, verifies `dist/` output exists, checks version consistency across the 3 version-carrying files |
| **CodeQL** (CodeQL Analysis workflow) | SAST scan using GitHub's JS security-extended query suite — catches XSS, injection, unsafe eval patterns |

If either check fails, the PR cannot be merged. Fix the issue on your branch and push — checks re-run automatically.

## AI code review (CodeRabbit)

CodeRabbit is configured via `.coderabbit.yaml` at repo root. It will automatically review every PR with:
- Architectural consistency checks (registry pattern, DATA_ATTR usage)
- Security review (no inline event handlers, no eval, no hardcoded tokens)
- Per-file rules for each `src/` module

CodeRabbit comments are non-blocking but should be addressed before merge unless explicitly dismissed with a reason.

## Code quality baseline

CodeFactor tracks code quality continuously. Current grade: **B+** (target: A).
Hotspot files requiring care: `build.js` (F), `src/09-observer.js` (D).

Do not introduce new issues in files already below B.

## Changelog

All user-facing changes must be documented in `CHANGELOG.md` under the appropriate version heading before the PR is merged. Follow [Keep a Changelog](https://keepachangelog.com/) format.

## Security

- No API keys, tokens, or credentials in source. GitHub secret scanning is active.
- No `eval()`, `new Function()`, or `innerHTML` with unsanitized input.
- Report security vulnerabilities privately via GitHub's Security tab, not as public issues.
