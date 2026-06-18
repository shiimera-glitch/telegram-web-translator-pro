// §4 — MIXED-SCRIPT SEGMENTER
// Phase 1 · pure functions.
//
// Breaks a raw text string into typed segments so downstream
// modules can handle each run individually:
//   - translate only the human-language spans
//   - leave URLs, mentions, hashtags, code, emoji untouched
//   - preserve whitespace runs exactly

/** Segment type tokens — consumed by extractor & recompiler. */
const SEG = {
  TEXT:    'TEXT',    // translatable human-language run
  URL:     'URL',     // http(s):// …
  MENTION: 'MENTION', // @handle
  HASHTAG: 'HASHTAG', // #tag
  CODE:    'CODE',    // `inline` or multi-char code run
  EMOJI:   'EMOJI',   // Unicode emoji sequence
  SPACE:   'SPACE',   // whitespace (preserved verbatim)
  NUMBER:  'NUMBER',  // standalone numeric token
  PUNCT:   'PUNCT',   // punctuation-only run
};

// ─ Regex arsenal ─────────────────────────────────────────────
// Ordered from most-specific to least-specific.
// Each pattern must consume at least 1 character.
const _PATTERNS = [
  // URL (greedy, stops at whitespace or closing bracket)
  [SEG.URL,     /https?:\/\/[^\s<>"'\u200B-\u200D\uFEFF]+/u],
  // @mention
  [SEG.MENTION, /@[\w.]{1,32}/u],
  // #hashtag
  [SEG.HASHTAG, /#[\w\u00C0-\u024F\u0400-\u04FF]{1,50}/u],
  // backtick inline code
  [SEG.CODE,    /`[^`\n]+`/u],
  // emoji (ZWJ sequences, variation selectors, keycap, flags)
  [SEG.EMOJI,   /(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*/u],
  // whitespace run
  [SEG.SPACE,   /[ \t\r\n\u00A0\u200B]+/u],
  // number (with optional thousands-sep / decimal)
  [SEG.NUMBER,  /[\d][\d,.\u066B\u066C]*/u],
  // punctuation-only run (ASCII + common Unicode)
  [SEG.PUNCT,   /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~\u2010-\u2027\u2030-\u205E\u2060-\u2FFF]+/u],
];

/**
 * Tokenise `text` into an array of segment objects.
 *
 * @param {string} text
 * @returns {{ type: string, value: string }[]}
 */
function segment(text) {
  const out = [];
  let pos   = 0;
  const len = text.length;

  while (pos < len) {
    let matched = false;

    for (const [type, rx] of _PATTERNS) {
      // Anchor regex to current position
      rx.lastIndex = 0;
      const slice = text.slice(pos);
      const m = rx.exec(slice);
      if (m && m.index === 0) {
        out.push({ type, value: m[0] });
        pos += m[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Accumulate as TEXT until next pattern matches
      let end = pos + 1;
      outer: while (end < len) {
        const slice = text.slice(end);
        for (const [, rx] of _PATTERNS) {
          rx.lastIndex = 0;
          const m = rx.exec(slice);
          if (m && m.index === 0) break outer;
        }
        end++;
      }
      out.push({ type: SEG.TEXT, value: text.slice(pos, end) });
      pos = end;
    }
  }

  return _mergeAdjacentText(out);
}

/**
 * Merge consecutive TEXT segments so the translator sees
 * the longest possible natural sentence.
 */
function _mergeAdjacentText(segs) {
  const out = [];
  for (const seg of segs) {
    const prev = out[out.length - 1];
    if (prev && prev.type === SEG.TEXT && seg.type === SEG.TEXT) {
      prev.value += seg.value;
    } else {
      out.push({ ...seg });
    }
  }
  return out;
}

/**
 * Reconstruct the original string from a segment array.
 * Useful for sanity-checking: segment(x).map(s=>s.value).join('') === x
 */
function unsegment(segs) {
  return segs.map(s => s.value).join('');
}
