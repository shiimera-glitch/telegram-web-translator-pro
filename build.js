#!/usr/bin/env node
// build.js — Concatenation build script for TelegramWebTranslatorPro
// Usage: node build.js [--watch] [--bump patch|minor|major]

const fs      = require('fs');
const path    = require('path');
const { execSync } = require('child_process');

const SRC_DIR  = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');
const OUT_FILE = path.join(DIST_DIR, 'TelegramWebTranslatorPro.user.js');
const PKG      = require('./package.json');

// Source files in exact assembly order
const FILES = [
  '00-header.js',
  '01-constants.js',
  '02-langmap.js',
  '03-settings.js',
  '04-checksum.js',
  '05-cache.js',
  '06-api.js',
  '07-unicode.js',
  '08-inference.js',
  '09-tokens.js',
  '10-translate.js',
  '11-process.js',
  '12-render.js',
  '13-scan.js',
  '14-bubble.js',
  '15-outgoing.js',
  '16-panel-chat.js',
  '17-panel-global.js',
  '18-toast.js',
  '19-menu.js',
  '20-styles.js',
  '21-init.js',
];

function bump(type) {
  const parts = PKG.version.split('.').map(Number);
  if (type === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }
  else if (type === 'minor') { parts[1]++; parts[2] = 0; }
  else { parts[2]++; }
  const next = parts.join('.');
  PKG.version = next;
  fs.writeFileSync('./package.json', JSON.stringify(PKG, null, 2) + '\n');
  console.log(`Version bumped to ${next}`);
  return next;
}

function build() {
  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

  const missing = FILES.filter(f => !fs.existsSync(path.join(SRC_DIR, f)));
  if (missing.length) {
    console.warn(`WARNING: Missing src files: ${missing.join(', ')}`);
  }

  const parts = FILES
    .filter(f => fs.existsSync(path.join(SRC_DIR, f)))
    .map(f => {
      const content = fs.readFileSync(path.join(SRC_DIR, f), 'utf8');
      return `// ${'='.repeat(60)}\n// ${f}\n// ${'='.repeat(60)}\n${content}`;
    });

  const output = parts.join('\n\n');
  fs.writeFileSync(OUT_FILE, output, 'utf8');

  const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  console.log(`[${ts}] Built ${path.basename(OUT_FILE)} (${kb} KB) from ${parts.length} files`);
}

// Handle CLI args
const args = process.argv.slice(2);
const bumpArg = args.find(a => a.startsWith('--bump'));
const watch   = args.includes('--watch');

if (bumpArg) {
  const type = bumpArg.split('=')[1] || args[args.indexOf(bumpArg) + 1] || 'patch';
  bump(type);
}

build();

if (watch) {
  console.log('Watching src/ for changes...');
  try {
    const chokidar = require('chokidar');
    chokidar.watch(SRC_DIR).on('change', f => {
      console.log(`Changed: ${path.basename(f)}`);
      build();
    });
  } catch(e) {
    // Fallback: native fs.watch
    fs.watch(SRC_DIR, { recursive: true }, (evt, f) => {
      if (f && f.endsWith('.js')) { console.log(`Changed: ${f}`); build(); }
    });
  }
}
