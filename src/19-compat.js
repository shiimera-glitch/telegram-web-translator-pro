// 19-compat.js – Browser / userscript compatibility shims
// Part of telegram-web-translator-pro v4.0.0

'use strict';

(function _compatModule() {

  // ── GM API shims ──────────────────────────────────────────────────────────────────
  // Normalise GM_xmlhttpRequest vs GM.xmlHttpRequest (Violentmonkey / Tampermonkey)
  const _gmXhr =
    (typeof GM !== 'undefined' && GM.xmlHttpRequest) ||
    (typeof GM_xmlhttpRequest !== 'undefined' && GM_xmlhttpRequest) ||
    null;

  /**
   * Perform a cross-origin XHR via the userscript GM API.
   * Falls back to fetch() when running outside a userscript context.
   * @param {object} opts  – same shape as GM_xmlhttpRequest options
   * @returns {Promise<{status, responseText, responseHeaders}>}
   */
  function gmFetch(opts) {
    return new Promise((resolve, reject) => {
      if (_gmXhr) {
        _gmXhr(Object.assign({}, opts, {
          onload:   r  => resolve(r),
          onerror:  e  => reject(e),
          ontimeout: () => reject(new Error('GM xhr timeout')),
        }));
      } else {
        // Fallback: native fetch (same-origin only)
        fetch(opts.url, {
          method:  opts.method || 'GET',
          headers: opts.headers || {},
          body:    opts.data || undefined,
        })
          .then(async r => resolve({
            status:          r.status,
            responseText:    await r.text(),
            responseHeaders: '',
          }))
          .catch(reject);
      }
    });
  }

  // ── GM_setValue / GM_getValue shims ──────────────────────────────────────────
  const _gmSetValue =
    (typeof GM !== 'undefined' && GM.setValue) ||
    (typeof GM_setValue !== 'undefined' && (k, v) => Promise.resolve(GM_setValue(k, v))) ||
    ((k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} return Promise.resolve(); });

  const _gmGetValue =
    (typeof GM !== 'undefined' && GM.getValue) ||
    (typeof GM_getValue !== 'undefined' && (k, d) => Promise.resolve(GM_getValue(k, d))) ||
    ((k, d) => { try { const s = localStorage.getItem(k); return Promise.resolve(s !== null ? JSON.parse(s) : d); } catch (_) { return Promise.resolve(d); } });

  /**
   * Persist a key/value pair using the best available storage.
   * @param {string} key
   * @param {*}      value
   * @returns {Promise<void>}
   */
  function setValue(key, value) {
    return Promise.resolve(_gmSetValue(key, value));
  }

  /**
   * Retrieve a stored value.
   * @param {string} key
   * @param {*}      defaultValue
   * @returns {Promise<*>}
   */
  function getValue(key, defaultValue) {
    return Promise.resolve(_gmGetValue(key, defaultValue));
  }

  // ── Intl.Segmenter shim ──────────────────────────────────────────────────────────
  /**
   * True when Intl.Segmenter with word granularity is available.
   */
  const hasIntlSegmenter = (() => {
    try {
      const s = new Intl.Segmenter('en', { granularity: 'word' });
      return typeof s.segment === 'function';
    } catch (_) { return false; }
  })();

  // ── CSS.supports shim ──────────────────────────────────────────────────────────────
  /**
   * Safe CSS.supports wrapper – returns false when API is unavailable.
   * @param {string} prop
   * @param {string} value
   * @returns {boolean}
   */
  function cssSupports(prop, value) {
    try { return CSS.supports(prop, value); } catch (_) { return false; }
  }

  // ── Feature flags (evaluated once at load time) ───────────────────────────
  const features = {
    intlSegmenter:         hasIntlSegmenter,
    cssWritingMode:        cssSupports('writing-mode', 'vertical-rl'),
    cssLogicalProps:       cssSupports('margin-inline-start', '0'),
    mutationObserver:      typeof MutationObserver !== 'undefined',
    intersectionObserver:  typeof IntersectionObserver !== 'undefined',
    requestIdleCallback:   typeof requestIdleCallback !== 'undefined',
    requestAnimFrame:      typeof requestAnimationFrame !== 'undefined',
    gmXhr:                 _gmXhr !== null,
  };

  // ── Public API ────────────────────────────────────────────────────────────
  /* exported Compat */
  const Compat = { gmFetch, setValue, getValue, cssSupports, features };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Compat;
  } else {
    (window._twtp = window._twtp || {}).Compat = Compat;
  }

}());
