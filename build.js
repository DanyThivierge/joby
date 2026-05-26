#!/usr/bin/env node
// build.js — Bundles the multi-file dev layout into production output.
//
// Usage:
//   node build.js          → dist/Work Task Tracker.html         (full app, local use)
//   node build.js --gas    → dist/gas/Index.html + Code.gs       (Google Apps Script, full)
//   node build.js --home   → dist/home/Joby Home.html            (personal-only, no Work mode / Jira)
//
// No external dependencies — only Node.js built-in 'fs' and 'path'.

const fs   = require('fs');
const path = require('path');

const GAS_MODE  = process.argv.includes('--gas');
const HOME_MODE = process.argv.includes('--home');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SRC  = path.join(ROOT, 'Work Task Tracker.html');

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

// ── Shared: build inlined HTML ─────────────────────────────────────────────────
function toDataUri(filePath, mimeType) {
    const abs = path.join(ROOT, filePath);
    if (!fs.existsSync(abs)) return null;
    return 'data:' + mimeType + ';base64,' + fs.readFileSync(abs).toString('base64');
}

function buildHtml(gasMode, homeMode) {
    let html = fs.readFileSync(SRC, 'utf8');

    // Inline CSS
    html = html.replace(
        /<link\s+rel="stylesheet"\s+href="css\/styles\.css"\s*>/,
        () => '<style>\n' + fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8') + '\n</style>'
    );

    // Home build: strip mode toggle, Jira tab, and Jira settings sections from HTML
    if (homeMode) {
        html = html.replace(/\s*<div class="mode-toggle">[\s\S]*?<\/div>/m, '');
        html = html.replace(/\s*<button id="jira-tab-btn"[^>]*>.*?<\/button>/g, '');
        // Strip Jira config fields from settings modal
        html = html.replace(/\s*<!-- jira-settings-start -->[\s\S]*?<!-- jira-settings-end -->/m, '');
        // Strip Update Cookie / Test Proxy buttons from modal actions
        html = html.replace(/\s*<!-- jira-modal-actions-start -->[\s\S]*?<!-- jira-modal-actions-end -->/m, '');
        // Simplify the settings modal title
        html = html.replace('Settings &#9881;&#65039; Settings — Jira Integration', '&#9881;&#65039; Settings');
        html = html.replace('Settings — Jira Integration', 'Settings');
    }

    // Build JS bundle (optionally prepend flags)
    const flags = [
        gasMode  ? '/* GAS build — Jira proxy unavailable */\nconst GAS_MODE = true;'  : '',
        homeMode ? '/* Home build — personal mode only */\nconst HOME_BUILD = true;'    : '',
    ].filter(Boolean).join('\n') + (gasMode || homeMode ? '\n\n' : '');
    const jsBundle = flags + JS_ORDER.map(f => {
        return '/* ── ' + f + ' ── */\n' + fs.readFileSync(path.join(ROOT, f), 'utf8');
    }).join('\n\n');

    // Remove individual <script src="js/..."> tags then inject bundle
    html = html.replace(/<script src="js\/[^"]+"><\/script>\n?/g, '');
    html = html.replace('</body>', '<script>\n' + jsBundle + '\n</script>\n</body>');

    // Home build: lock to personal mode and neutralise the mode switcher.
    // Must happen AFTER bundle injection so the source strings are present.
    if (homeMode) {
        // Force personal mode on boot (replaces the localStorage lookup in initStorage)
        html = html.replace(
            "activeMode = localStorage.getItem(ACTIVE_MODE_LS_KEY) || 'work';",
            "activeMode = 'personal';"
        );
        // Make switchMode a no-op so keyboard/programmatic calls do nothing
        html = html.replace(
            'async function switchMode(newMode) {\n    if (newMode === activeMode) return;',
            'async function switchMode(newMode) {\n    return; // home build — single mode'
        );
    }

    // In GAS mode, replace logo references with inline base64 data URIs
    // so the images work without a local file server.
    // Must happen AFTER bundle injection so the constants.js strings are in html.
    if (gasMode) {
        const logoLight = toDataUri('th_logo_en.png', 'image/png');
        const logoDark  = toDataUri('telus_logo_dark.png', 'image/png') || logoLight;
        if (logoLight) {
            // Patch the HTML img tag (src appears before id in the tag)
            html = html.replace(
                /(<img\s[^>]*)src="[^"]*"([^>]*id="logo-img")/,
                '$1src="' + logoLight + '"$2'
            );
            // Patch LOGO_LIGHT / LOGO_DARK constants so theme.js dark-mode swap works
            html = html.replace(
                "const LOGO_LIGHT          = 'th_logo_en.png';",
                "const LOGO_LIGHT          = '" + logoLight + "';"
            );
            html = html.replace(
                "const LOGO_DARK           = 'telus_logo_dark.png';",
                "const LOGO_DARK           = '" + logoDark + "';"
            );
        }
    }

    // In Home mode, replace logo with Joby logo embedded as base64.
    // Must happen AFTER bundle injection so the constants.js strings are in html.
    // Patches PERSONAL_LOGO_LIGHT/DARK (used by applyTheme in personal mode)
    // and the initial <img> src (which starts as th_logo_en.png in the HTML shell).
    if (homeMode) {
        const logoLight = toDataUri('Joby_logo.png', 'image/png');
        const logoDark  = toDataUri('Joby_logo_dark.png', 'image/png') || logoLight;
        if (logoLight) {
            html = html.replace(
                /(<img\s[^>]*)src="[^"]*"([^>]*id="logo-img")/,
                '$1src="' + logoLight + '"$2'
            );
            html = html.replace(
                "const PERSONAL_LOGO_LIGHT = 'Joby_logo.png';",
                "const PERSONAL_LOGO_LIGHT = '" + logoLight + "';"
            );
            html = html.replace(
                "const PERSONAL_LOGO_DARK  = 'Joby_logo_dark.png';",
                "const PERSONAL_LOGO_DARK  = '" + logoDark + "';"
            );
        }
    }

    return html;
}

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

if (HOME_MODE) {
    // ── Personal / Home-only build ─────────────────────────────────────────────
    const HOME_DIST = path.join(DIST, 'home');
    if (!fs.existsSync(HOME_DIST)) fs.mkdirSync(HOME_DIST, { recursive: true });

    const OUT = path.join(HOME_DIST, 'Joby Home.html');
    fs.writeFileSync(OUT, buildHtml(false, true), 'utf8');
    const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
    console.log('Home build complete: dist/home/Joby Home.html (' + kb + ' KB)');
    console.log('Personal-only — no Work mode, no Jira tab.');

} else if (GAS_MODE) {
    // ── Google Apps Script build ───────────────────────────────────────────────
    const GAS_DIST = path.join(DIST, 'gas');
    if (!fs.existsSync(GAS_DIST)) fs.mkdirSync(GAS_DIST, { recursive: true });

    // Index.html — full inlined app (GAS_MODE = true injected)
    const indexOut = path.join(GAS_DIST, 'Index.html');
    fs.writeFileSync(indexOut, buildHtml(true, false), 'utf8');

    // Code.gs — GAS entry point
    const codeGs = `// Code.gs — Google Apps Script entry point for Joby
// Deploy as a Web App: Deploy → New deployment → Web app → Execute as Me → Anyone
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Joby | TELUS Health')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
`;
    fs.writeFileSync(path.join(GAS_DIST, 'Code.gs'), codeGs, 'utf8');

    const kb = (fs.statSync(indexOut).size / 1024).toFixed(1);
    console.log('GAS build complete:');
    console.log('  dist/gas/Index.html (' + kb + ' KB)');
    console.log('  dist/gas/Code.gs');
    console.log('');
    console.log('Deploy steps:');
    console.log('  1. Go to https://script.google.com and create a new project');
    console.log('  2. Paste Code.gs into the editor (replace the default code)');
    console.log('  3. Add a new file → HTML, name it "Index", paste Index.html content');
    console.log('  4. Deploy → New deployment → Web app → Execute as Me → Anyone');

} else {
    // ── Standard single-file build ─────────────────────────────────────────────
    const OUT = path.join(DIST, 'Work Task Tracker.html');
    fs.writeFileSync(OUT, buildHtml(false, false), 'utf8');
    const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
    console.log('Build complete: dist/Work Task Tracker.html (' + kb + ' KB)');
}
