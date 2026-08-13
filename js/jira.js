// jira.js — Settings modal (general/Jira/personal tabs) and the Jira proxy connection
// (cookie + Test Proxy), shared by the Jira Digest tab. The old issue-browsing Jira tab
// and its JQL builder were removed once Digest fully replaced it — see
// docs/superpowers/specs/2026-08-12-jira-digest-tab-design.md.

// ── Settings ──────────────────────────────────────────────────────────────────
function switchSettingsTab(tab) {
    ['general', 'jira', 'personal'].forEach(t => {
        const btn   = document.getElementById('stab-' + t);
        const panel = document.getElementById('settings-panel-' + t);
        if (btn)   btn.classList.toggle('active', t === tab);
        if (panel) panel.style.display = t === tab ? '' : 'none';
    });
}

function openSettings() {
    document.getElementById('s-jira-url').value = settings.jiraUrl || '';
    renderThemePresets();
    syncThemeStudio();
    _syncDarkToggle((typeof settings !== 'undefined' && settings.themePreset) || 'default');
    const cr = document.getElementById('conn-result'); if (cr) { cr.className = 'conn-result'; cr.textContent = ''; }
    const preferredTab = activeMode === 'personal' ? 'personal' : 'jira';
    const available = document.getElementById('stab-' + preferredTab) ? preferredTab : (document.getElementById('stab-jira') ? 'jira' : 'general');
    switchSettingsTab(available);
    const tamaChk = document.getElementById('s-tamagoshi-enabled');
    if (tamaChk) tamaChk.checked = settings.tamagoshiEnabled === true;
    document.getElementById('settings-modal').style.display = 'block';
}
function closeSettings() { document.getElementById('settings-modal').style.display = 'none'; }
function saveSettings() {
    settings.jiraUrl = document.getElementById('s-jira-url').value.trim().replace(/\/$/, '');
    closeSettings(); debouncedSave(); toast(t('toastSettingsSaved'));
}

// ── Jira proxy connection test ────────────────────────────────────────────────
async function testConnection() {
    const cr = document.getElementById('conn-result');
    cr.textContent = 'Testing proxy...'; cr.style.display = 'block'; cr.className = 'conn-result';
    try {
        const r = await fetch(PROXY_ORIGIN + '/rest/api/3/myself', { headers: { 'Accept': 'application/json' } });
        if (r.ok) {
            const d = await r.json();
            cr.textContent = '✓ Connected as ' + (d.displayName || d.emailAddress);
            cr.className = 'conn-result ok';
        } else if (r.status === 503) {
            cr.textContent = '✗ Proxy is running but no cookie set — paste your cookie above and click Update Cookie.';
            cr.className = 'conn-result err';
        } else {
            cr.textContent = '✗ HTTP ' + r.status + ' — cookie may have expired. Paste a fresh one above.';
            cr.className = 'conn-result err';
        }
    } catch {
        cr.textContent = '✗ Proxy not running — open a terminal and run: python jira-proxy.py';
        cr.className = 'conn-result err';
    }
}

async function updateCookie() {
    const cookie = document.getElementById('s-cookie').value.trim();
    const cr     = document.getElementById('cookie-result');
    if (!cookie) {
        cr.textContent = 'Paste your cookie first — expand the instructions above for help.';
        cr.className = 'conn-result err'; return;
    }
    cr.textContent = 'Saving...'; cr.style.display = 'block'; cr.className = 'conn-result';
    try {
        const r = await fetch(PROXY_ORIGIN + '/_set-cookie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookie })
        });
        if (r.ok) {
            cr.textContent = '✓ Cookie saved — click Test Proxy to verify.';
            cr.className = 'conn-result ok';
            document.getElementById('s-cookie').value = '';
        } else {
            cr.textContent = '✗ Failed to save — is the proxy running? (python jira-proxy.py)';
            cr.className = 'conn-result err';
        }
    } catch {
        cr.textContent = '✗ Proxy not running — open a terminal and run: python jira-proxy.py';
        cr.className = 'conn-result err';
    }
}
