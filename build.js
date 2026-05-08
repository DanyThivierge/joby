#!/usr/bin/env node
// build.js — Bundles the multi-file dev layout into a single-file production HTML.
// Usage: node build.js
// Output: dist/Work Task Tracker.html
// No external dependencies — only Node.js built-in 'fs' and 'path'.

const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SRC  = path.join(ROOT, 'Work Task Tracker.html');
const OUT  = path.join(DIST, 'Work Task Tracker.html');

const JS_ORDER = [
    'js/constants.js',
    'js/state.js',
    'js/utils.js',
    'js/theme.js',
    'js/colors.js',
    'js/storage.js',
    'js/tasks.js',
    'js/render.js',
    'js/drag.js',
    'js/jira.js',
    'js/inbox.js',
    'js/stats.js',
    'js/main.js',
];

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

let html = fs.readFileSync(SRC, 'utf8');

// ── Inline CSS ────────────────────────────────────────────────────────────────
html = html.replace(
    /<link\s+rel="stylesheet"\s+href="css\/styles\.css"\s*>/,
    () => {
        const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
        return '<style>\n' + css + '\n</style>';
    }
);

// ── Inline JS ─────────────────────────────────────────────────────────────────
// Replace the first <script src="js/constants.js"> tag and remove the rest.
const jsBundle = JS_ORDER.map(f => {
    const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
    return '/* ── ' + f + ' ── */\n' + content;
}).join('\n\n');

// Remove all individual <script src="js/..."> tags
html = html.replace(/<script src="js\/[^"]+"><\/script>\n?/g, '');

// Insert the bundle before </body>
html = html.replace('</body>', '<script>\n' + jsBundle + '\n</script>\n</body>');

fs.writeFileSync(OUT, html, 'utf8');

const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log('Build complete: dist/Work Task Tracker.html (' + kb + ' KB)');
