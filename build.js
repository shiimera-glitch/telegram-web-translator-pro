#!/usr/bin/env node
// build.js – Concatenation build script for TelegramWebTranslatorPro v4.1.0
// Usage: node build.js [--watch] [--bump patch|minor|major]

const fs   = require('fs');
const path = require('path');

const SRC_DIR  = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');

// META is the single source of truth for all project identity fields.
// Never read from package.json for version or name; always use meta.json.
const META = require('./meta.json');
const OUT_FILE = path.join(DIST_DIR, `${META.slug}.user.js`);

// Source files in exact assembly order (00 → 25)
const FILES = [
  '00-header.js', '01-constants.js', '02-langmap.js', '03-bidi.js', '04-segmenter.js',
  '05-pua.js', '06-extractor.js', '07-translator.js', '08-injector.js', '09-observer.js',
  '10-cache.js', '11-ui.js', '12-settings.js', '13-context.js', '14-recompiler.js',
  '15-renderer.js', '16-gestures.js', '17-hotkeys.js', '18-perf.js', '19-compat.js',
  '20-init.js', '21-footer.js', '22-engines.js', '23-adapter.js', '24-a11y.js', '25-dragdrop.js',
];

// ── Helpers ────────────────────────────────────────────────────────────────────────────────────
function stamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

/**
 * Compute the next semver string from META.version.
 * @param {'patch'|'minor'|'major'} type
 * @returns {string}
 */
function bumpVersion(type) {
  const VALID_TYPES = ['patch', 'minor', 'major'];
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`[build] invalid bump type: "${type}". Expected: ${VALID_TYPES.join('|')}`);
  }
  const parts = META.version.split('.').map(Number);
  if (type === 'major') {
    parts[0]++; parts[1] = 0; parts[2] = 0;
  } else if (type === 'minor') {
    parts[1]++; parts[2] = 0;
  } else {
    parts[2]++;
  }
  return parts.join('.');
}

// ── Build ────────────────────────────────────────────────────────────────────────────────────
function build(bumpType) {
  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

  // Resolve version — optionally bump and persist to BOTH meta.json and package.json
  let version = META.version;
  if (bumpType) {
    version = bumpVersion(bumpType);

    // Update meta.json (single source of truth)
    const metaCopy = Object.assign({}, META, { version });
    fs.writeFileSync(
      path.join(__dirname, 'meta.json'),
      JSON.stringify(metaCopy, null, 2) + '\n',
    );

    // Keep package.json in sync (tooling compatibility)
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    pkg.version = version;
    fs.writeFileSync(
      path.join(__dirname, 'package.json'),
      JSON.stringify(pkg, null, 2) + '\n',
    );

    console.log(`[build] version bumped to ${version}`);
  }

  // Concatenate all source chunks
  const chunks = FILES.map(f => {
    const p = path.join(SRC_DIR, f);
    if (!fs.existsSync(p)) {
      console.warn(`[build] WARNING: missing src file: ${f}`);
      return `/* --- MISSING: ${f} --- */\n`;
    }
    return fs.readFileSync(p, 'utf8');
  });

  // Cache timestamp to keep header + log line identical
  const buildStamp = stamp();

  // Replace version/date placeholders in header chunk
  const output = chunks
    .join('\n')
    .replace(/@version\s+\S+/, `@version ${version}`)
    .replace(/@builddate\s+\S+/, `@builddate ${buildStamp}`);

  fs.writeFileSync(OUT_FILE, output, 'utf8');
  const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
  console.log(`[build] ✅ ${OUT_FILE} (${kb} KB) v${version} @ ${buildStamp}`);
}

// ── Watch mode ───────────────────────────────────────────────────────────────────────────────────────
function watch() {
  console.log('[build] watching src/ for changes…');
  build();
  fs.watch(SRC_DIR, { recursive: false }, (evt, filename) => {
    if (filename && filename.endsWith('.js')) {
      console.log(`[build] change detected: ${filename}`);
      build();
    }
  });
}

// ── CLI entry ───────────────────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const doWatch = args.includes('--watch');
const bumpIdx = args.indexOf('--bump');
const bumpType = bumpIdx !== -1 ? args[bumpIdx + 1] : null;

if (doWatch) {
  watch();
} else {
  build(bumpType);
}
