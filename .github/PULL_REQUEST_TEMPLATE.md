## Summary

<!-- One sentence: what does this PR do and why? -->

## Type of change

- [ ] `fix` — bug fix (non-breaking)
- [ ] `feat` — new feature (non-breaking)
- [ ] `feat!` / `fix!` — breaking change
- [ ] `ci` — workflow / tooling change
- [ ] `docs` — documentation only
- [ ] `refactor` — code restructure, no behavior change
- [ ] `perf` — performance improvement
- [ ] `chore` — dependency bump, housekeeping

## Checklist

### Code
- [ ] All new modules register via `window._twtp.<name>` — no bare `window.*` state
- [ ] All DOM data attributes referenced through `DATA_ATTR.*` constants — no inline `'data-twtp-*'` strings
- [ ] No `eval()`, `new Function()`, or `innerHTML` with unsanitized input
- [ ] No hardcoded API keys, tokens, or credentials
- [ ] Observer callbacks guarded against re-entrancy (`_processing` flag pattern)
- [ ] Injection functions are idempotent (check `DATA_ATTR.INJECTED` before acting)

### Versioning
- [ ] If this is a user-facing change: version bumped in `src/00-header.js` (`@version`)
- [ ] Version string matches in `src/01-constants.js` (`VER`)
- [ ] Version string matches in `src/20-init.js` (boot log)
- [ ] `CHANGELOG.md` updated under the correct version heading

### CI
- [ ] `Lint & Build` check passes locally (`npm run lint && npm run build`)
- [ ] `dist/telegram-web-translator-pro.user.js` generated and sane (non-zero bytes)
- [ ] No new ESLint errors introduced

### Review
- [ ] CodeRabbit review addressed (or comments dismissed with reason)
- [ ] PR description explains the *why*, not just the *what*
- [ ] Commit messages follow Conventional Commits format (`type(scope): description`)
