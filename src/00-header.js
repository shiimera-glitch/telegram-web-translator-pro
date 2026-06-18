// ==UserScript==
// @name         Telegram Web Translator Pro
// @namespace    https://greasyfork.org/
// @version      4.0.0
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
// @run-at       document-end
// @homepageURL  https://github.com/shiimera-glitch/telegram-web-translator-pro
// @supportURL   https://github.com/shiimera-glitch/telegram-web-translator-pro/issues
// ==/UserScript==
//
// Version History:
// 4.0.0  2026-06-18  Full bidi engine. Context injection. Mixed-script
//                    segmentation. PUA guards. Spoiler support.
//                    Unified WeakMap. requestIdleCallback scheduling.
//                    AbortController per request. Cache hit/miss tracking.
// 3.0.2  (baseline)  Per-chat overrides, dual targets, polyglot skip,
//                    hover bubble, LRU cache, circuit breaker

(function () {
  'use strict';
  // === All sections §0-§20 follow in subsequent src/ files ===
