#!/usr/bin/env node
// build.js — Bundles the multi-file dev layout into production output.
//
// Usage:
//   node build.js          → dist/Work Task Tracker.html  (single-file, local use)
//   node build.js --gas    → dist/gas/Index.html + dist/gas/Code.gs  (Google Apps Script)
//
// No external dependencies — only Node.js built-in 'fs' and 'path'.

const fs   = require('fs');
const path = require('path');

const GAS_MODE = process.argv.includes('--gas');

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

function buildHtml(gasMode) {
    let html = fs.readFileSync(SRC, 'utf8');

    // Inline CSS
    html = html.replace(
        /<link\s+rel="stylesheet"\s+href="css\/styles\.css"\s*>/,
        () => '<style>\n' + fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8') + '\n</style>'
    );

    // Build JS bundle (optionally prepend GAS_MODE flag)
    const gasFlag  = gasMode ? '/* GAS build — Jira proxy unavailable */\nconst GAS_MODE = true;\n\n' : '';
    const jsBundle = gasFlag + JS_ORDER.map(f => {
        return '/* ── ' + f + ' ── */\n' + fs.readFileSync(path.join(ROOT, f), 'utf8');
    }).join('\n\n');

    // Remove individual <script src="js/..."> tags then inject bundle
    html = html.replace(/<script src="js\/[^"]+"><\/script>\n?/g, '');
    html = html.replace('</body>', '<script>\n' + jsBundle + '\n</script>\n</body>');

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

    return html;
}

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

if (GAS_MODE) {
    // ── Google Apps Script build ───────────────────────────────────────────────
    const GAS_DIST = path.join(DIST, 'gas');
    if (!fs.existsSync(GAS_DIST)) fs.mkdirSync(GAS_DIST, { recursive: true });

    // Index.html — full inlined app (GAS_MODE = true injected)
    const indexOut = path.join(GAS_DIST, 'Index.html');
    fs.writeFileSync(indexOut, buildHtml(true), 'utf8');

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
    fs.writeFileSync(OUT, buildHtml(false), 'utf8');
    const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
    console.log('Build complete: dist/Work Task Tracker.html (' + kb + ' KB)');
}
