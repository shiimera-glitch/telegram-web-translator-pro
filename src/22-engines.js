// 22-engines.js — Multi-Engine Translation Adapter Registry (v4.2.0)
// Registers all supported translation engines with a unified async interface.
// Each engine exposes: { name, translate(text, from, to) => Promise<string> }
//
// Fixes applied (2026-06-18):
//   BUG-01: Renamed 'microsoft' → 'azure' to match ENGINES[] id in 01-constants.js
//   BUG-03: Implemented 6 missing engines: mymemory, lingva, deepl_pro, openai, anthropic, yandex

'use strict';

window._twtp = window._twtp || {};

window._twtp.Engines = (function () {
  const ENGINES = {};

  function register(engine) {
    if (!engine || !engine.name || typeof engine.translate !== 'function') {
      console.warn('[TWT:engines] Invalid engine registration:', engine);
      return;
    }
    ENGINES[engine.name] = engine;
  }

  function get(name) {
    return ENGINES[name] || null;
  }

  function list() {
    return Object.keys(ENGINES);
  }

  // ——— Helper: read Settings safely ———
  function _cfg(key) {
    return (window._twtp.Settings && window._twtp.Settings.get(key)) || '';
  }

  // ——— Google Translate (free endpoint) ———
  register({
    name: 'google',
    translate(text, from, to) {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          onload(res) {
            try {
              const data = JSON.parse(res.responseText);
              resolve(data[0].map(s => s[0]).join(''));
            } catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— DeepL Free API ———
  register({
    name: 'deepl',
    translate(text, from, to) {
      const apiKey = _cfg('deeplApiKey');
      if (!apiKey) return Promise.reject(new Error('DeepL: no API key configured'));
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://api-free.deepl.com/v2/translate',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          data: `auth_key=${encodeURIComponent(apiKey)}&text=${encodeURIComponent(text)}&source_lang=${from.toUpperCase()}&target_lang=${to.toUpperCase()}`,
          onload(res) {
            try { resolve(JSON.parse(res.responseText).translations[0].text); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— DeepL Pro API (BUG-03 fix) ———
  register({
    name: 'deepl_pro',
    translate(text, from, to) {
      const apiKey = _cfg('deeplProApiKey');
      if (!apiKey) return Promise.reject(new Error('DeepL Pro: no API key configured'));
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://api.deepl.com/v2/translate',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          data: `auth_key=${encodeURIComponent(apiKey)}&text=${encodeURIComponent(text)}&source_lang=${from.toUpperCase()}&target_lang=${to.toUpperCase()}`,
          onload(res) {
            try { resolve(JSON.parse(res.responseText).translations[0].text); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— MyMemory (free, no key required) (BUG-03 fix) ———
  register({
    name: 'mymemory',
    translate(text, from, to) {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          onload(res) {
            try { resolve(JSON.parse(res.responseText).responseData.translatedText); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— Lingva (free Google proxy) (BUG-03 fix) ———
  register({
    name: 'lingva',
    translate(text, from, to) {
      const host = _cfg('lingvaHost') || 'https://lingva.ml';
      const url = `${host}/api/v1/${from}/${to}/${encodeURIComponent(text)}`;
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          onload(res) {
            try { resolve(JSON.parse(res.responseText).translation); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— LibreTranslate (self-hosted / public) ———
  register({
    name: 'libretranslate',
    translate(text, from, to) {
      const host = _cfg('libreHost') || 'https://libretranslate.com';
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: `${host}/translate`,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({ q: text, source: from, target: to, format: 'text' }),
          onload(res) {
            try { resolve(JSON.parse(res.responseText).translatedText); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— Azure Cognitive Services (BUG-01 fix: was 'microsoft') ———
  register({
    name: 'azure',
    translate(text, from, to) {
      const apiKey = _cfg('msApiKey');
      const region = _cfg('msRegion') || 'eastus';
      if (!apiKey) return Promise.reject(new Error('Azure: no API key configured'));
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${from}&to=${to}`,
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': apiKey,
            'Ocp-Apim-Subscription-Region': region,
          },
          data: JSON.stringify([{ Text: text }]),
          onload(res) {
            try { resolve(JSON.parse(res.responseText)[0].translations[0].text); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— OpenAI GPT-4o (BUG-03 fix) ———
  register({
    name: 'openai',
    translate(text, from, to) {
      const apiKey = _cfg('openaiApiKey');
      if (!apiKey) return Promise.reject(new Error('OpenAI: no API key configured'));
      const body = {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: `Translate the following text from ${from} to ${to}. Output only the translation, no explanations.` },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
      };
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://api.openai.com/v1/chat/completions',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          data: JSON.stringify(body),
          onload(res) {
            try { resolve(JSON.parse(res.responseText).choices[0].message.content.trim()); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— Anthropic Claude (BUG-03 fix) ———
  register({
    name: 'anthropic',
    translate(text, from, to) {
      const apiKey = _cfg('anthropicApiKey');
      if (!apiKey) return Promise.reject(new Error('Anthropic: no API key configured'));
      const body = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: `Translate from ${from} to ${to}. Output only the translation:\n\n${text}` },
        ],
      };
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://api.anthropic.com/v1/messages',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          data: JSON.stringify(body),
          onload(res) {
            try { resolve(JSON.parse(res.responseText).content[0].text.trim()); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— Yandex Translate (BUG-03 fix) ———
  register({
    name: 'yandex',
    translate(text, from, to) {
      const apiKey = _cfg('yandexApiKey');
      if (!apiKey) return Promise.reject(new Error('Yandex: no API key configured'));
      const folderId = _cfg('yandexFolderId') || '';
      const body = { targetLanguageCode: to, sourceLanguageCode: from, texts: [text], folderId };
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://translate.api.cloud.yandex.net/translate/v2/translate',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Api-Key ${apiKey}` },
          data: JSON.stringify(body),
          onload(res) {
            try { resolve(JSON.parse(res.responseText).translations[0].text); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  return { register, get, list };
})();
