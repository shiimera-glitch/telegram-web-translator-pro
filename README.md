# telegram-web-translator-pro

> **RTL/LTR bidi engine for Telegram Web** — Tampermonkey / Violentmonkey userscript v4.0.0

[![Build & Release](https://github.com/shiimera-glitch/telegram-web-translator-pro/actions/workflows/build.yml/badge.svg)](https://github.com/shiimera-glitch/telegram-web-translator-pro/actions/workflows/build.yml)
![Version](https://img.shields.io/badge/version-4.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- Full Unicode BiDi RTL/LTR alignment — no visible bidi markers in the DOM
- Mixed-script segmentation (Arabic, Hebrew, Persian alongside Latin/CJK)
- PUA-token invisible tagging for round-trip translation fidelity
- Context injection stripped before rendering — clean output cached
- MutationObserver-driven auto-translation as new messages arrive
- LRU translation cache with hit/miss tracking
- Circuit-breaker on consecutive API failures
- Touch gesture support (long-press / double-tap to translate)
- Keyboard shortcuts: `Alt+T` translate hovered bubble, `Alt+Shift+T` all visible, `Alt+C` clear, `Alt+S` settings
- Works on both `web.telegram.org/a` (React) and `web.telegram.org/k` (K-app)
- Supports Google Translate, DeepL Free, and MyMemory backends

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Download the latest build from [Releases](https://github.com/shiimera-glitch/telegram-web-translator-pro/releases) or from `dist/TelegramWebTranslatorPro.user.js`
3. Drag the `.user.js` file into your browser — the extension will prompt to install

## Development

```bash
# Clone
git clone https://github.com/shiimera-glitch/telegram-web-translator-pro.git
cd telegram-web-translator-pro
npm install

# One-shot build  →  dist/TelegramWebTranslatorPro.user.js
npm run build

# Watch mode (rebuilds on every src/ change)
npm run watch

# Lint
npm run lint

# Version bump + build
npm run release:patch   # 4.0.0 → 4.0.1
npm run release:minor   # 4.0.0 → 4.1.0
npm run release:major   # 4.0.0 → 5.0.0
```

## Source modules (`src/`)

| File | Module | Responsibility |
|------|--------|----------------|
| `00-header.js` | Header | `==UserScript==` metadata + IIFE open |
| `01-constants.js` | Constants | Global config, selectors, timing |
| `02-langmap.js` | LangMap | Language detection & locale mapping |
| `03-bidi.js` | Bidi | Unicode RTL/LTR direction logic |
| `04-segmenter.js` | Segmenter | Mixed-script word segmentation |
| `05-pua.js` | PUA | Invisible PUA-token encoder/decoder |
| `06-extractor.js` | Extractor | Text extraction from message bubbles |
| `07-translator.js` | Translator | Google / DeepL / MyMemory API adapter |
| `08-injector.js` | Injector | DOM injection & removal |
| `09-observer.js` | Observer | MutationObserver watcher |
| `10-cache.js` | Cache | LRU translation cache |
| `11-ui.js` | UI | Floating panel & CSS injection |
| `12-settings.js` | Settings | Persistent user settings (GM storage) |
| `13-context.js` | ContextMgr | Context injection manager |
| `14-recompiler.js` | Recompiler | PUA strip + output recompiler |
| `15-renderer.js` | Renderer | Final bidi-aware DOM renderer |
| `16-gestures.js` | GestureHandler | Touch long-press / double-tap handler |
| `17-hotkeys.js` | HotkeyManager | Keyboard shortcut registry |
| `18-perf.js` | Perf | debounce, throttle, idle/frame scheduler |
| `19-compat.js` | Compat | GM API shims, feature detection |
| `20-init.js` | Init | Bootstrap wiring & public API surface |
| `21-footer.js` | Footer | IIFE close, console banner, self-test |
| `22-engines.js` | Engines | Multi-engine registry: Google, DeepL, LibreTranslate, Microsoft |
| `23-adapter.js` | Adapter | Unified A/K DOM selector map & bubble translation API |
| `24-a11y.js` | A11y | ARIA labels, keyboard nav, focus trap, screen-reader hints |
| `25-dragdrop.js` | DragDrop | Drag-and-drop text/image onto panel with auto-translate |

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+T` | Translate hovered message bubble |
| `Alt+Shift+T` | Translate all visible bubbles |
| `Alt+C` | Clear all injected translations |
| `Alt+S` | Open settings panel |
| `Escape` | Close panels |

## Architecture

All modules attach themselves to `window._twtp` and are orchestrated by `20-init.js` on boot.
The build script (`build.js`) concatenates `src/00` through `src/21` in order into a single
`.user.js` file. The GitHub Actions workflow (`build.yml`) runs the build on every push to
`src/` and commits the artefact to `dist/`.

## License

MIT — see [LICENSE](LICENSE)

---

## v4.1.0 Roadmap

### Completed in this release
- [x] 22-engines.js: Multi-engine registry (Google, DeepL, LibreTranslate, Microsoft Azure)
- [x] 23-adapter.js: Unified Telegram Web A/K DOM adapter with bubble toggle API
- [x] 24-a11y.js: ARIA labelling, keyboard focus trap, screen-reader bubble hints
- [x] 25-dragdrop.js: Drag-and-drop text/image onto panel; auto-translate + clipboard
- [x] build.js: updated FILES array to include all 26 modules (00-25)
- [x] README.md: full module table + roadmap

### Planned (v4.2 / v5)
- [ ] 26-ocr.js: Image OCR pipeline (Tesseract.js) for photo captions and stickers
- [ ] 27-tts.js: Text-to-speech for translated messages (Web Speech API)
- [ ] 28-addons.js: Plugin loader API for third-party extensions
- [ ] IME input support for CJK languages
- [ ] Translation memory / glossary (user-defined term overrides)
- [ ] Privacy mode: local-only via WebAssembly NLLB model
- [ ] Web extension build target (Manifest V3, content-script variant)
- [ ] Monetization: premium engines unlocked via license key

### Known limitations
- build.js comment shows `00 > 2125` (cosmetic only, no functional impact)
- DeepL and Microsoft engines require API key in settings
- Image drag-and-drop is stubbed for v5 OCR pipeline
