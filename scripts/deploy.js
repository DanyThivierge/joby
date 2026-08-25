#!/usr/bin/env node
// scripts/deploy.js — One-step deploy to Gizmos: bumps the build-number suffix shown in
// the app header (v2.5-001), rebuilds, assembles the deploy folder, and pushes.
//
// Usage: node scripts/deploy.js
//
// The build-number suffix is cosmetic UI text only — it lets a bug report be checked
// against whether the reporter has actually refreshed to pick up the latest deploy. It
// is tracked in .build-info.json and is entirely separate from APP_VERSION (js/constants.js),
// which is the saved-task-data format marker (storage.js/drive.js) and is bumped by hand.
// Whenever APP_VERSION changes since the last recorded deploy, the build counter resets
// to 000 automatically.
//
// This never touches jira-proxy.py — that's a separate, manually-distributed file.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUILD_INFO_PATH = path.join(ROOT, '.build-info.json');
const DEPLOY_ASSETS = ['favicon.ico', 'th_logo_en.png', 'telus_logo_dark.png', 'Joby_logo.png'];

function readAppVersion() {
    const src = fs.readFileSync(path.join(ROOT, 'js/constants.js'), 'utf8');
    const m = src.match(/const APP_VERSION\s*=\s*'([^']+)'/);
    if (!m) throw new Error('Could not find APP_VERSION in js/constants.js');
    return m[1];
}

function bumpBuildNumber(currentVersion) {
    let info = { version: null, build: -1 };
    if (fs.existsSync(BUILD_INFO_PATH)) {
        try { info = JSON.parse(fs.readFileSync(BUILD_INFO_PATH, 'utf8')); } catch { /* corrupt — treat as missing */ }
    }
    // A version bump (a manual edit to APP_VERSION) resets the build counter — otherwise
    // "v2.5-000" would misleadingly read as if 2.5 had already been deployed 40+ times.
    const build = info.version === currentVersion ? info.build + 1 : 0;
    fs.writeFileSync(BUILD_INFO_PATH, JSON.stringify({ version: currentVersion, build }, null, 2) + '\n');
    return build;
}

const version = readAppVersion();
const build = bumpBuildNumber(version);
const buildStr = String(build).padStart(3, '0');
const fullVersion = 'v' + version + '-' + buildStr;
console.log('Deploying ' + fullVersion + '...\n');

execFileSync('node', [path.join(ROOT, 'build.js')], { stdio: 'inherit' });

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'joby-deploy-'));
try {
    fs.copyFileSync(path.join(ROOT, 'dist', 'Work Task Tracker.html'), path.join(scratch, 'index.html'));
    for (const asset of DEPLOY_ASSETS) {
        fs.copyFileSync(path.join(ROOT, asset), path.join(scratch, asset));
    }
    const gizmosPath = path.join(os.homedir(), '.local', 'bin', 'gizmos.mjs');
    execFileSync('node', [gizmosPath, 'push', '--app', 'joby', '--org', 'telus'], { cwd: scratch, stdio: 'inherit' });
    console.log('\nDeployed ' + fullVersion);
} finally {
    fs.rmSync(scratch, { recursive: true, force: true });
}
