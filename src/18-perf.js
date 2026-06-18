// 18-perf.js – Performance utilities (debounce, throttle, idle scheduling)
// Part of telegram-web-translator-pro v4.0.0

'use strict';

(function _perfModule() {

  // ── debounce ───────────────────────────────────────────────────────────────────
  /**
   * Returns a debounced version of `fn` that delays invoking until
   * `wait` ms have elapsed since the last call.
   * @param {Function} fn
   * @param {number}   wait  milliseconds
   * @returns {Function}
   */
  function debounce(fn, wait) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => { timer = null; fn.apply(this, args); }, wait);
    };
  }

  // ── throttle ───────────────────────────────────────────────────────────────────
  /**
   * Returns a throttled version of `fn` that invokes at most once per
   * `limit` ms (leading edge).
   * @param {Function} fn
   * @param {number}   limit  milliseconds
   * @returns {Function}
   */
  function throttle(fn, limit) {
    let lastCall = 0;
    let timer    = null;
    return function throttled(...args) {
      const now = Date.now();
      const remaining = limit - (now - lastCall);
      if (remaining <= 0) {
        clearTimeout(timer);
        timer    = null;
        lastCall = now;
        fn.apply(this, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          lastCall = Date.now();
          timer    = null;
          fn.apply(this, args);
        }, remaining);
      }
    };
  }

  // ── scheduleIdle ─────────────────────────────────────────────────────────────
  /**
   * Schedule `fn` to run when the browser is idle (or after `timeout` ms).
   * Falls back to setTimeout when requestIdleCallback is unavailable.
   * @param {Function} fn
   * @param {number}  [timeout=2000]
   */
  function scheduleIdle(fn, timeout) {
    const t = timeout !== undefined ? timeout : 2000;
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fn, { timeout: t });
    } else {
      setTimeout(fn, 0);
    }
  }

  // ── scheduleFrame ────────────────────────────────────────────────────────────
  /**
   * Schedule `fn` on the next animation frame.
   * Useful for DOM mutations that must not block input.
   * @param {Function} fn
   */
  function scheduleFrame(fn) {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(fn);
    } else {
      setTimeout(fn, 16);
    }
  }

  // ── measureAsync ────────────────────────────────────────────────────────────
  /**
   * Measure execution time of an async function and log it.
   * No-op in production (when TWTConfig.DEBUG is falsy).
   * @param {string}   label
   * @param {Function} asyncFn  must return a Promise
   * @returns {Promise<*>}
   */
  async function measureAsync(label, asyncFn) {
    const debug = typeof TWTConfig !== 'undefined' && TWTConfig.DEBUG;
    if (!debug) return asyncFn();
    const t0 = performance.now();
    try {
      const result = await asyncFn();
      console.debug(`[perf] ${label}: ${(performance.now() - t0).toFixed(1)} ms`);
      return result;
    } catch (e) {
      console.debug(`[perf] ${label} ERROR after ${(performance.now() - t0).toFixed(1)} ms`);
      throw e;
    }
  }

  // ── batchMicro ──────────────────────────────────────────────────────────────────
  /**
   * Queue items and flush them via the microtask queue.
   * Useful when many observer callbacks fire in the same tick.
   * @param {Function} flushFn  called with the accumulated array
   * @returns {{ enqueue(item): void, flush(): void }}
   */
  function batchMicro(flushFn) {
    let queue    = [];
    let pending  = false;
    function enqueue(item) {
      queue.push(item);
      if (!pending) {
        pending = true;
        Promise.resolve().then(() => {
          const items = queue;
          queue   = [];
          pending = false;
          try { flushFn(items); } catch (e) {
            console.warn('[perf.batchMicro] flush error', e);
          }
        });
      }
    }
    function flush() {
      if (queue.length) {
        const items = queue;
        queue   = [];
        pending = false;
        flushFn(items);
      }
    }
    return { enqueue, flush };
  }

  // ── Public API ────────────────────────────────────────────────────────────
  /* exported Perf */
  const Perf = { debounce, throttle, scheduleIdle, scheduleFrame, measureAsync, batchMicro };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Perf;
  } else {
    (window._twtp = window._twtp || {}).Perf = Perf;
  }

}());
