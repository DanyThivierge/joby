// theme.js — Dark/light toggle, theme presets, Custom Theme Studio, speech-to-text.

// ── Theme presets ─────────────────────────────────────────────────────────────
const THEME_PRESETS = {
    default: {
        label: 'Default',
        base: 'auto',         // 'light' | 'dark' | 'auto' = keep current
        swatchBg: '#f5f5f5',
        swatchAccent: '#7c3aed',
        vars: {}              // use CSS-file defaults
    },
    lcars: {
        label: 'LCARS',
        base: 'dark',
        swatchBg: '#000',
        swatchAccent: '#ff9900',
        vars: {
            '--bg':           '#000000',
            '--card':         '#0a0a1a',
            '--border':       '#ff990033',
            '--text-1':       '#ffcc00',
            '--text-2':       '#ff9900',
            '--text-3':       '#cc6600',
            '--purple':       '#ff9900',
            '--purple-light': '#ff990018',
            '--red':          '#cc3300',
            '--green':        '#66cc00',
            '--font-app':     "'Helvetica Neue', Arial, sans-serif",
            '--radius-card':  '0px',
            '--radius-pill':  '0px',
            '--radius-check': '0px',
            '--radius-btn':   '0px',
            '--logo-filter':  'sepia(1) saturate(4) hue-rotate(5deg) brightness(1.1)'
        }
    },
    'outer-rim': {
        label: 'Outer Rim',
        base: 'dark',
        swatchBg: '#0d1117',
        swatchAccent: '#4af626',
        vars: {
            '--bg':           '#0d1117',
            '--card':         '#161b22',
            '--border':       '#4af62630',
            '--text-1':       '#c9d1d9',
            '--text-2':       '#8b949e',
            '--text-3':       '#4af626',
            '--purple':       '#4af626',
            '--purple-light': '#4af62618',
            '--red':          '#f85149',
            '--green':        '#3fb950',
            '--font-app':     "'Courier New', monospace",
            '--radius-card':  '3px',
            '--radius-pill':  '3px',
            '--radius-check': '3px',
            '--radius-btn':   '2px',
            '--logo-filter':  'sepia(1) saturate(3) hue-rotate(90deg) brightness(0.9)'
        }
    },
    sakura: {
        label: 'Sakura',
        base: 'light',
        swatchBg: '#fff5f7',
        swatchAccent: '#e75480',
        vars: {
            '--bg':           '#fff5f7',
            '--card':         '#ffffff',
            '--border':       '#f4b8c8',
            '--text-1':       '#3d1a2a',
            '--text-2':       '#7a3a55',
            '--text-3':       '#c06080',
            '--purple':       '#e75480',
            '--purple-light': '#f4b8c820',
            '--red':          '#d63060',
            '--green':        '#5a9e6f',
            '--font-app':     "'Georgia', serif",
            '--radius-card':  '12px',
            '--radius-pill':  '24px',
            '--radius-check': '50%',
            '--radius-btn':   '8px',
            '--logo-filter':  'sepia(0.4) saturate(2) hue-rotate(290deg) brightness(1.05)'
        }
    },
    'dont-panic': {
        label: "Don't Panic",
        base: 'light',
        swatchBg: '#f0f4ff',
        swatchAccent: '#0052cc',
        vars: {
            '--bg':           '#f0f4ff',
            '--card':         '#ffffff',
            '--border':       '#c7d4f0',
            '--text-1':       '#172b4d',
            '--text-2':       '#42526e',
            '--text-3':       '#5e6c84',
            '--purple':       '#0052cc',
            '--purple-light': '#0052cc1a',
            '--red':          '#de350b',
            '--green':        '#006644',
            '--font-app':     "'Segoe UI', Arial, sans-serif",
            '--radius-card':  '6px',
            '--radius-pill':  '20px',
            '--radius-check': '50%',
            '--radius-btn':   '4px',
            '--logo-filter':  'none'
        }
    }
};

// Tracks which CSS vars were last set by a preset (to clear them on switch)
let _activePresetVars = [];

function applyPreset(id) {
    const preset = THEME_PRESETS[id] || THEME_PRESETS.default;
    const root   = document.documentElement;

    // Clear previously applied preset vars
    _activePresetVars.forEach(v => root.style.removeProperty(v));
    _activePresetVars = [];

    // Apply new preset vars
    Object.entries(preset.vars).forEach(([k, v]) => {
        root.style.setProperty(k, v);
        _activePresetVars.push(k);
    });

    // Apply base theme (dark/light), skip if 'auto'
    if (preset.base === 'dark')  applyTheme('dark');
    else if (preset.base === 'light') applyTheme('light');

    // Save to settings
    if (typeof settings !== 'undefined') {
        settings.themePreset = id;
        if (typeof debouncedSave === 'function') debouncedSave();
    }

    // Refresh preset cards UI
    document.querySelectorAll('.theme-preset-card').forEach(c => {
        c.classList.toggle('active', c.dataset.preset === id);
    });
}

function restoreTheme() {
    const id = (typeof settings !== 'undefined' && settings.themePreset) || 'default';
    applyPreset(id);
    // Restore any custom studio overrides on top
    const custom = (typeof settings !== 'undefined' && settings.themeCustom) || {};
    Object.entries(custom).forEach(([k, v]) => {
        document.documentElement.style.setProperty(k, v);
    });
}

function renderThemePresets() {
    const grid = document.getElementById('theme-preset-grid');
    if (!grid) return;
    const current = (typeof settings !== 'undefined' && settings.themePreset) || 'default';
    grid.innerHTML = Object.entries(THEME_PRESETS).map(([id, p]) => `
        <div class="theme-preset-card${id === current ? ' active' : ''}" data-preset="${id}" onclick="applyPreset('${id}');syncThemeStudio();" title="${p.label}">
            <div class="preset-swatch">
                <div class="preset-swatch-bg" style="background:${p.swatchBg}"></div>
                <div class="preset-swatch-accent" style="background:${p.swatchAccent}"></div>
            </div>
            <span style="font-size:0.67rem;font-weight:600;color:var(--text-2)">${p.label}</span>
        </div>`).join('');
}

// ── Theme Studio ──────────────────────────────────────────────────────────────
function syncThemeStudio() {
    const root = getComputedStyle(document.documentElement);
    const get  = v => root.getPropertyValue(v).trim();

    const rSlider = document.getElementById('studio-radius-slider');
    const rVal    = document.getElementById('studio-radius-val');
    if (rSlider) {
        // Extract numeric value from --radius-card (e.g. "6px" → 6)
        const px = parseInt(get('--radius-card')) || 6;
        rSlider.value = px;
        if (rVal) rVal.textContent = px + 'px';
    }

    const bgPicker = document.getElementById('studio-bg-color');
    if (bgPicker) bgPicker.value = cssColorToHex(get('--bg'));

    const cardPicker = document.getElementById('studio-card-color');
    if (cardPicker) cardPicker.value = cssColorToHex(get('--card'));

    const accentPicker = document.getElementById('studio-accent-color');
    if (accentPicker) accentPicker.value = cssColorToHex(get('--purple'));
}

function cssColorToHex(color) {
    // Convert rgb(r,g,b) or named colors to #rrggbb for input[type=color]
    if (!color || color === 'transparent') return '#ffffff';
    if (color.startsWith('#') && color.length === 7) return color;
    if (color.startsWith('#') && color.length === 4) {
        return '#' + color[1]+color[1]+color[2]+color[2]+color[3]+color[3];
    }
    const m = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (m) return '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
    return '#888888';
}

function adjustGeometry(val) {
    const px = val + 'px';
    const root = document.documentElement;
    root.style.setProperty('--radius-card',  px);
    root.style.setProperty('--radius-btn',   px);
    // Pill stays proportionally larger, check stays circular
    root.style.setProperty('--radius-pill',  Math.max(val * 3, 4) + 'px');
    root.style.setProperty('--radius-check', val < 4 ? px : '50%');
    document.getElementById('studio-radius-val').textContent = px;
    _saveStudioVar('--radius-card', px);
    _saveStudioVar('--radius-btn',  px);
    _saveStudioVar('--radius-pill', Math.max(val * 3, 4) + 'px');
    _saveStudioVar('--radius-check', val < 4 ? px : '50%');
}

function adjustColors() {
    const bg     = document.getElementById('studio-bg-color')?.value;
    const card   = document.getElementById('studio-card-color')?.value;
    const accent = document.getElementById('studio-accent-color')?.value;
    const root   = document.documentElement;
    if (bg)     { root.style.setProperty('--bg',     bg);     _saveStudioVar('--bg',     bg); }
    if (card)   { root.style.setProperty('--card',   card);   _saveStudioVar('--card',   card); }
    if (accent) { root.style.setProperty('--purple', accent); _saveStudioVar('--purple', accent);
        // Derive light variant (20% opacity approximation)
        root.style.setProperty('--purple-light', accent + '22');
        _saveStudioVar('--purple-light', accent + '22');
    }
}

function _saveStudioVar(key, val) {
    if (typeof settings === 'undefined') return;
    if (!settings.themeCustom) settings.themeCustom = {};
    settings.themeCustom[key] = val;
    if (typeof debouncedSave === 'function') debouncedSave();
}

function resetThemeStudio() {
    if (typeof settings !== 'undefined') settings.themeCustom = {};
    const preset = (typeof settings !== 'undefined' && settings.themePreset) || 'default';
    applyPreset(preset);
    syncThemeStudio();
    if (typeof debouncedSave === 'function') debouncedSave();
    if (typeof toast === 'function') toast('Theme studio reset to preset defaults.');
}

// ── Base theme (light / dark) ─────────────────────────────────────────────────
function initTheme() {
    const saved = localStorage.getItem(LS_THEME_KEY) || 'light';
    applyTheme(saved);
}
function toggleDarkMode() {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
}
function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(LS_THEME_KEY, t);
    const btn  = document.getElementById('dark-toggle-btn');
    const logo = document.getElementById('logo-img');
    if (btn)  btn.innerHTML = t === 'dark' ? '&#9728;&#65039; Light' : '&#127769; Dark';
    if (logo) {
        logo.src = t === 'dark' ? LOGO_DARK : LOGO_LIGHT;
        logo.onerror = () => { logo.src = LOGO_LIGHT; logo.onerror = null; };
    }
}

// ── Speech-to-text ────────────────────────────────────────────────────────────
function initSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-CA';
    recognition.onresult = e => {
        const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
        document.getElementById('task-input').value = transcript;
    };
    recognition.onend = () => { isListening = false; updateMicBtn(); };
    recognition.onerror = e => {
        isListening = false; updateMicBtn();
        if (e.error !== 'no-speech') toast('Speech error: ' + e.error);
    };
    return true;
}
function toggleSpeech() {
    if (!recognition && !initSpeech()) { toast('Speech recognition not supported. Use Chrome or Edge.'); return; }
    if (isListening) { recognition.stop(); isListening = false; }
    else { recognition.start(); isListening = true; }
    updateMicBtn();
}
function updateMicBtn() {
    const btn = document.getElementById('mic-btn');
    if (!btn) return;
    btn.classList.toggle('listening', isListening);
    btn.title = isListening ? 'Stop recording (click or press Enter)' : 'Speak to add task';
}
