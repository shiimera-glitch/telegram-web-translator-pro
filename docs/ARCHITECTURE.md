# Architecture — telegram-web-translator-pro

This document maps the internal structure, data flow, and module responsibilities of the translation suite.

## Core Design Principles
- **Concatenation-First:** Single-file distribution via `build.js` numeric sorting.
- **Normalization:** Unified `A/K` adapter to abstract Telegram Web's competing DOM structures.
- **Pure Constants:** Logic-free configuration in `01-constants.js`.
- **Observer-Driven:** MutationObserver lifecycle for reactive translation of dynamic chat history.

## Module Map (src/)

| Range | Namespace | Responsibility |
| :--- | :--- | :--- |
| **00** | **Header** | UserScript metadata, `@grant` directives, `@connect` white-lists. |
| **01** | **Constants** | Normalized selectors (`MSGSEL`, `BUBBLESEL`), engine registry, script sets. |
| **02-05** | **Primitives** | Language maps, bidi-logic, PUA character handling, text segmentation. |docs: add ARCHITECTURE.md madocs: add ARCHITECTURE.md mapping module flow and logicpping module flow and logic
| **06-10** | **Core** | Text extraction, engine dispatch, injection logic, caching. |
| **11-16** | **UI/UX** | Shadow DOM panel, settings, context menus, docs: add ARCHITECTURE.md mapping module flow and logicrenderer, gesture support. |
| **17-19** | **Utilities** | Hotkeys, performance monitoring, browser compatibility shims. |
| **20-21** | **Bootstrap** | Initialization sequences, footer cleanup, lifecycle hooks. |
| **22-25** | **Adapters** | Engine registry (Google/DeepL/OpenAI), A/K DOM adapters, a11y, drag-and-drop. |

## Data Flow: Translation Lifecycle

1. **Detection:** `09-observer.js` monitors `.bubbles .scrollable-y` (A) or `#column-center` (K).
2. **Filtering:** `06-extractor.js` checks `DATA_ATTR` to prevent re-translation loops.
3. **Dispatch:** `07-translator.js` selects engine from `ENGINES` registry in `01-constants.js`.
4. **Execution:** `22-engines.js` performs async request via `GM_xmlhttpRequest`.
5. **Rendering:** `15-renderer.js` injects the result using `11-ui.js` templates.

## Extension Points
- **New Engines:** Register in `01-constants.js:ENGINES` and implement handler in `22-engines.js`.
- **New DOM Elements:** Add normalized selector to `01-constants.js`.
- **Custom UI:** Modify `11-ui.js` (Shadow DOM) and `12-settings.js`.
