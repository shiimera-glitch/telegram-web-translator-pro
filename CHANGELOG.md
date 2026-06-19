# Changelog

All notable changes to `telegram-web-translator-pro` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [4.1.0] - 2026-06-19

### Fixed

- **BUG-35 / injector race condition** (`src/08-injector.js`)
  UI injection was running before the `window._twtp` module registry was populated, causing `Cannot read properties of undefined` on first load. Fixed by adding a registry-readiness guard that defers injection until all required module keys are present.

- **BUG-36 / observer infinite recursion** (`src/09-observer.js`)
  `MutationObserver` callback was triggering DOM mutations internally (setting translated text), which re-fired the observer synchronously. Fixed by wrapping the handler body in a `_processing` boolean guard: if `_processing` is true, the callback returns immediately without re-entering.

- **BUG-37 / init version mismatch** (`src/20-init.js`)
  Boot log string `'booting v4.0.0'` was not updated to match `@version 4.1.0` in `src/00-header.js`, causing the CI version-consistency check to fail and confusing diagnostic output. Fixed by syncing all three version-carrying strings.

- **BUG-38 / DATA_ATTR constant drift** (`src/01-constants.js`)
  Several data attribute strings were referenced inline in `08-injector.js` and `09-observer.js` as raw string literals instead of via the `DATA_ATTR` constant object. This caused silent mismatches when constants were renamed. Fixed by replacing all inline strings with the canonical `DATA_ATTR.*` references.

### Changed

- Version bumped from `4.0.0` to `4.1.0` across `src/00-header.js`, `src/01-constants.js`, and `src/20-init.js`.
- CI now enforces version consistency across all three files on every push/PR via the `Check version consistency` step in `.github/workflows/pr-check.yml`.

### Added

- **CodeQL SAST** (`.github/workflows/codeql.yml`) — security analysis on every push to `main` and all PRs.
- **PR Quality Check** (`.github/workflows/pr-check.yml`) — ESLint, build verification, and version consistency gate.
- **Dependabot** (`.github/dependabot.yml`) — automated npm and GitHub Actions dependency updates.
- **Branch protection ruleset** (ID 17876690) — blocks direct pushes and force-pushes to `main`; requires `Lint & Build` and `CodeQL` checks to pass before merge.
- **CodeRabbit** AI code review (`.coderabbit.yaml`) — automatic PR review with architectural consistency checks.
- **CodeFactor** continuous quality tracking — current grade B+ (107 issues across 31 files).
- **Gemini Code Assist** — integrated for PR-level AI suggestions.

---

## [4.0.0] - 2026-06-19

### Added

- Initial public release of the refactored v4 architecture.
- `window._twtp` module registry pattern replacing ad-hoc global state.
- Modular `src/` layout: `00-header`, `01-constants`, `08-injector`, `09-observer`, `16-gestures`, `18-cache`, `20-init`, `22-engines`, `23-adapter`.
- Multi-engine translation support via adapter pattern (`src/23-adapter.js`).
- RTL/LTR bidirectional text handling for Telegram Web A and K clients.
- Build pipeline via `build.js` producing single-file userscript in `dist/`.
