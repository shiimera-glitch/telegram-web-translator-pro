// ==UserScript==
// @name         Telegram Web Translator Pro
// @namespace    https://greasyfork.org/
// @version      4.2.0
// @description  RTL/LTR bidi engine, context injection, mixed-script
//               segmentation, spoiler support, PUA-guard rich format
//               preservation, dual targets, LRU cache, circuit breaker
// @author       shiimera-glitch
// @match        https://web.telegram.org/a/*
// @match        https://web.telegram.org/k/*
// @license      MIT
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      translate.googleapis.com
// @connect      api-free.deepl.com
// @connect      api.mymemory.translated.net
// @connect      api.deepl.com
// @connect      libretranslate.com
// @connect      translate.yandex.net
// @connect      api.openai.com
// @connect      api.anthropic.com
// @connect      api.cognitive.microsofttranslator.com
// @connect      api.dictionaryapi.dev
// @connect      api.datamuse.com
// @connect      *
// @run-at       document-end
// @homepageURL  https://github.com/shiimera-glitch/telegram-web-translator-pro
// @supportURL   https://github.com/shiimera-glitch/telegram-web-translator-pro/issues
// ==/UserScript==

//
// Version History:
// 4.1.0  2026-06-19  BUG-29/36/37/38 fixes: correct INJECTED_ATTR (data-tgtp4),
//                    added window._twtp.Injector + Observer exports,
//                    Observer.start() now receives chat root element,
//                    removed duplicate registerDefaults() call from init.
//                    Version strings synced across all files.
// 4.0.0  2026-06-18  Full bidi engine. Context injection. Mixed-script
//                    segmentation. PUA guards. Spoiler support.
//                    Unified WeakMap. requestIdleCallback scheduling.
//                    AbortController per request. Cache hit/miss tracking.
// 3.0.2  (baseline)  Per-chat overrides, dual targets, polyglot skip,
//                    hover bubble, LRU cache, circuit breaker

/* ---- open top-level IIFE (closed in 21-footer.js) ---- */
(function() {
'use strict';
