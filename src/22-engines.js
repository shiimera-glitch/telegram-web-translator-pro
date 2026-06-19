// 22-engines.js — Multi-Engine Translation Adapter Registry (v4.1.0)
// Registers all supported translation engines with a unified async interface.
// Each engine exposes: { name, translate(text, from, to) => Promise<string> }

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
              const result = data[0].map(s => s[0]).join('');
              resolve(result);
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
      const apiKey = (window._twtp.Settings && window._twtp.Settings.get('deeplApiKey')) || '';
      if (!apiKey) return Promise.reject(new Error('DeepL: no API key configured'));
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://api-free.deepl.com/v2/translate',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          data: `auth_key=${encodeURIComponent(apiKey)}&text=${encodeURIComponent(text)}&source_lang=${from.toUpperCase()}&target_lang=${to.toUpperCase()}`,
          onload(res) {
            try {
              const data = JSON.parse(res.responseText);
              resolve(data.translations[0].text);
            } catch (e) { reject(e); }
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
      const host = (window._twtp.Settings && window._twtp.Settings.get('libreHost')) || 'https://libretranslate.com';
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: `${host}/translate`,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({ q: text, source: from, target: to, format: 'text' }),
          onload(res) {
            try {
              const data = JSON.parse(res.responseText);
              resolve(data.translatedText);
            } catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  // ——— Microsoft Azure Cognitive Services ———
  register({
    name: 'microsoft',
    translate(text, from, to) {
      const apiKey = (window._twtp.Settings && window._twtp.Settings.get('msApiKey')) || '';
      const region = (window._twtp.Settings && window._twtp.Settings.get('msRegion')) || 'eastus';
      if (!apiKey) return Promise.reject(new Error('Microsoft: no API key configured'));
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
            try {
              const data = JSON.parse(res.responseText);
              resolve(data[0].translations[0].text);
            } catch (e) { reject(e); }
          },
          onerror: reject,
        });
      });
    },
  });

  return { register, get, list };
})();
