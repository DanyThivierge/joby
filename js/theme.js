// theme.js — Dark/light toggle, theme presets, Custom Theme Studio, speech-to-text.

// ── Theme presets ─────────────────────────────────────────────────────────────
const THEME_PRESETS = {

    default: {
        label: 'Default', emoji: '✦',
        base: 'auto',
        swatchBg: '#f5f5f5', swatchAccent: '#7c3aed',
        vars: {}
    },

    lcars: {
        label: 'LCARS', emoji: '🖖',
        base: 'dark',
        swatchBg: '#000000', swatchAccent: '#CC6699',
        vars: {
            '--bg':           '#000000',
            '--card':         '#111111',
            '--text-1':       '#FF9900',
            '--text-2':       '#CC7700',
            '--text-3':       '#885500',
            '--border':       'rgba(255,153,0,0.25)',
            '--purple':       '#CC6699',
            '--purple-light': 'rgba(204,102,153,0.15)',
            '--red':          '#CC3300',
            '--green':        '#FFCC00',
            '--font-app':     "'Trebuchet MS', sans-serif",
            '--font-body':    "'Trebuchet MS', sans-serif",
            '--radius-card':  '0px',
            '--radius-pill':  '0px',
            '--radius-check': '0px',
            '--radius-btn':   '0px',
            '--logo-filter':  'invert(1) brightness(2)'
        }
    },

    'outer-rim': {
        label: 'Outer Rim', emoji: '🔴',
        base: 'dark',
        swatchBg: '#12181F', swatchAccent: '#E74C3C',
        vars: {
            '--bg':           '#12181F',
            '--card':         '#16222F',
            '--text-1':       '#E2E8F0',
            '--text-2':       '#8B98A4',
            '--text-3':       '#5A6670',
            '--border':       'rgba(226,76,60,0.22)',
            '--purple':       '#E74C3C',
            '--purple-light': 'rgba(231,76,60,0.15)',
            '--red':          '#E74C3C',
            '--green':        '#2ECC71',
            '--font-app':     "'Consolas', monospace",
            '--font-body':    "'Consolas', monospace",
            '--radius-card':  '2px',
            '--radius-pill':  '4px',
            '--radius-check': '2px',
            '--radius-btn':   '2px',
            '--logo-filter':  'brightness(0.9) sepia(0.2)'
        }
    },

    'dont-panic': {
        label: "Don't Panic", emoji: '🚀',
        base: 'dark',
        swatchBg: '#0F172A', swatchAccent: '#F59E0B',
        vars: {
            '--bg':           '#0F172A',
            '--card':         '#1E293B',
            '--text-1':       '#F8FAFC',
            '--text-2':       '#CBD5E1',
            '--text-3':       '#94A3B8',
            '--border':       'rgba(245,158,11,0.22)',
            '--purple':       '#F59E0B',
            '--purple-light': 'rgba(245,158,11,0.15)',
            '--red':          '#EF4444',
            '--green':        '#10B981',
            '--font-app':     "'Segoe UI', sans-serif",
            '--radius-card':  '8px',
            '--radius-pill':  '20px',
            '--radius-check': '50%',
            '--radius-btn':   '6px',
            '--logo-filter':  'invert(0.85)'
        }
    },

    'knight-rider': {
        label: 'Knight Rider', emoji: '🚗',
        base: 'dark',
        swatchBg: '#000000', swatchAccent: '#FF0000',
        vars: {
            '--bg':           '#000000',
            '--card':         '#121212',
            '--text-1':       '#FFFFFF',
            '--text-2':       '#CCCCCC',
            '--text-3':       '#888888',
            '--border':       'rgba(255,0,0,0.28)',
            '--purple':       '#FF0000',
            '--purple-light': 'rgba(255,0,0,0.12)',
            '--red':          '#FF0000',
            '--green':        '#CC2200',
            '--font-app':     "'Impact', 'Arial Black', sans-serif",
            '--radius-card':  '0px',
            '--radius-pill':  '2px',
            '--radius-check': '0px',
            '--radius-btn':   '0px',
            '--logo-filter':  'invert(1) drop-shadow(0 0 4px red)'
        }
    },

    sakura: {
        label: 'Sakura', emoji: '🌸',
        base: 'light',
        swatchBg: '#FFF5F5', swatchAccent: '#D53F8C',
        vars: {
            '--bg':           '#FFF5F5',
            '--card':         '#FFFFFF',
            '--text-1':       '#4A2828',
            '--text-2':       '#7A4848',
            '--text-3':       '#B06080',
            '--border':       'rgba(213,63,140,0.22)',
            '--purple':       '#D53F8C',
            '--purple-light': 'rgba(213,63,140,0.10)',
            '--red':          '#C0315E',
            '--green':        '#38A169',
            '--radius-card':  '16px',
            '--radius-pill':  '99px',
            '--radius-check': '50%',
            '--radius-btn':   '10px',
            '--logo-filter':  'none'
        }
    },

    'enchanted-forest': {
        label: 'Forest', emoji: '🌲',
        base: 'light',
        swatchBg: '#EDF2F7', swatchAccent: '#805AD5',
        vars: {
            '--bg':           '#EDF2F7',
            '--card':         '#FFFFFF',
            '--text-1':       '#1A365D',
            '--text-2':       '#2D5380',
            '--text-3':       '#4A7AA8',
            '--border':       'rgba(128,90,213,0.22)',
            '--purple':       '#805AD5',
            '--purple-light': 'rgba(128,90,213,0.12)',
            '--red':          '#C53030',
            '--green':        '#2F855A',
            '--radius-card':  '14px',
            '--radius-pill':  '24px',
            '--radius-check': '50%',
            '--radius-btn':   '10px',
            '--logo-filter':  'sepia(0.5) hue-rotate(60deg)'
        }
    },

    synthwave: {
        label: 'Synthwave', emoji: '🌅',
        base: 'dark',
        swatchBg: '#0D0B18', swatchAccent: '#FF007F',
        vars: {
            '--bg':           '#0D0B18',
            '--card':         '#1A1528',
            '--text-1':       '#F4F4F9',
            '--text-2':       '#C4C4D9',
            '--text-3':       '#8888BB',
            '--border':       'rgba(255,0,127,0.28)',
            '--purple':       '#FF007F',
            '--purple-light': 'rgba(255,0,127,0.14)',
            '--red':          '#FF007F',
            '--green':        '#00F5D4',
            '--radius-card':  '8px',
            '--radius-pill':  '99px',
            '--radius-check': '50%',
            '--radius-btn':   '6px',
            '--logo-filter':  'hue-rotate(280deg) brightness(1.2)'
        }
    },

    'coffee-house': {
        label: 'Coffee', emoji: '☕',
        base: 'dark',
        swatchBg: '#2C1A12', swatchAccent: '#78350F',
        vars: {
            '--bg':           '#2C1A12',
            '--card':         '#F5EBE6',
            '--text-1':       '#3D2218',
            '--text-2':       '#6B4035',
            '--text-3':       '#9B7060',
            '--border':       'rgba(120,53,15,0.30)',
            '--purple':       '#78350F',
            '--purple-light': 'rgba(120,53,15,0.12)',
            '--red':          '#B91C1C',
            '--green':        '#D97706',
            '--font-app':     "'Georgia', serif",
            '--font-body':    "'Georgia', serif",
            '--radius-card':  '10px',
            '--radius-pill':  '12px',
            '--radius-check': '4px',
            '--radius-btn':   '6px',
            '--logo-filter':  'sepia(1) saturate(0.5) brightness(0.7)'
        }
    },

    'island-vacation': {
        label: 'Island', emoji: '🏝️',
        base: 'light',
        swatchBg: '#F4EAD4', swatchAccent: '#06B6D4',
        vars: {
            '--bg':           '#F4EAD4',
            '--card':         '#FFFFFF',
            '--text-1':       '#0F172A',
            '--text-2':       '#334155',
            '--text-3':       '#64748B',
            '--border':       'rgba(6,182,212,0.28)',
            '--purple':       '#06B6D4',
            '--purple-light': 'rgba(6,182,212,0.12)',
            '--red':          '#F43F5E',
            '--green':        '#10B981',
            '--radius-card':  '18px',
            '--radius-pill':  '99px',
            '--radius-check': '50%',
            '--radius-btn':   '12px',
            '--logo-filter':  'hue-rotate(140deg)'
        }
    },

    'pip-boy': {
        label: 'Pip-Boy', emoji: '☢️',
        base: 'dark',
        swatchBg: '#050A02', swatchAccent: '#39FF14',
        vars: {
            '--bg':           '#050A02',
            '--card':         '#0C1405',
            '--text-1':       '#39FF14',
            '--text-2':       '#22CC00',
            '--text-3':       '#119900',
            '--border':       'rgba(57,255,20,0.22)',
            '--purple':       '#22AA11',
            '--purple-light': 'rgba(57,255,20,0.10)',
            '--red':          '#39FF14',
            '--green':        '#116600',
            '--font-app':     "'Courier New', monospace",
            '--font-body':    "'Courier New', monospace",
            '--radius-card':  '0px',
            '--radius-pill':  '0px',
            '--radius-check': '0px',
            '--radius-btn':   '0px',
            '--logo-filter':  'sepia(1) hue-rotate(80deg) saturate(8) brightness(0.8)'
        }
    },

    steampunk: {
        label: 'Steampunk', emoji: '⚙️',
        base: 'dark',
        swatchBg: '#1E1610', swatchAccent: '#B45309',
        vars: {
            '--bg':           '#1E1610',
            '--card':         '#EFE3C3',
            '--text-1':       '#2B1810',
            '--text-2':       '#5C3828',
            '--text-3':       '#8B5E40',
            '--border':       'rgba(180,83,9,0.35)',
            '--purple':       '#B45309',
            '--purple-light': 'rgba(180,83,9,0.14)',
            '--red':          '#991B1B',
            '--green':        '#78350F',
            '--font-app':     "'Georgia', serif",
            '--font-body':    "'Georgia', serif",
            '--radius-card':  '4px',
            '--radius-pill':  '4px',
            '--radius-check': '0px',
            '--radius-btn':   '2px',
            '--logo-filter':  'sepia(1) contrast(1.2)'
        }
    },

    'midnight-dev': {
        label: 'Midnight', emoji: '💻',
        base: 'dark',
        swatchBg: '#000000', swatchAccent: '#A78BFA',
        vars: {
            '--bg':           '#000000',
            '--card':         '#121214',
            '--text-1':       '#E4E4E7',
            '--text-2':       '#A1A1AA',
            '--text-3':       '#71717A',
            '--border':       'rgba(167,139,250,0.18)',
            '--purple':       '#A78BFA',
            '--purple-light': 'rgba(167,139,250,0.12)',
            '--red':          '#F87171',
            '--green':        '#34D399',
            '--font-app':     "'Consolas', monospace",
            '--font-body':    "'Consolas', monospace",
            '--radius-card':  '0px',
            '--radius-pill':  '0px',
            '--radius-check': '0px',
            '--radius-btn':   '0px',
            '--logo-filter':  'invert(1)'
        }
    },

    'executive-silver': {
        label: 'Executive', emoji: '🏢',
        base: 'light',
        swatchBg: '#E2E8F0', swatchAccent: '#1E3A8A',
        vars: {
            '--bg':           '#E2E8F0',
            '--card':         '#FFFFFF',
            '--text-1':       '#0F172A',
            '--text-2':       '#334155',
            '--text-3':       '#64748B',
            '--border':       'rgba(30,58,138,0.18)',
            '--purple':       '#1E3A8A',
            '--purple-light': 'rgba(30,58,138,0.10)',
            '--red':          '#DC2626',
            '--green':        '#16A34A',
            '--radius-card':  '4px',
            '--radius-pill':  '6px',
            '--radius-check': '4px',
            '--radius-btn':   '4px',
            '--logo-filter':  'none'
        }
    },

    // ── Bonus presets ─────────────────────────────────────────────────────────

    nord: {
        label: 'Nord', emoji: '❄️',
        base: 'dark',
        swatchBg: '#2E3440', swatchAccent: '#88C0D0',
        vars: {
            '--bg':           '#2E3440',
            '--card':         '#3B4252',
            '--text-1':       '#ECEFF4',
            '--text-2':       '#D8DEE9',
            '--text-3':       '#8892A4',
            '--border':       'rgba(136,192,208,0.22)',
            '--purple':       '#88C0D0',
            '--purple-light': 'rgba(136,192,208,0.14)',
            '--red':          '#BF616A',
            '--green':        '#A3BE8C',
            '--radius-card':  '6px',
            '--radius-pill':  '16px',
            '--radius-check': '50%',
            '--radius-btn':   '4px',
            '--logo-filter':  'hue-rotate(170deg) brightness(0.9)'
        }
    },

    dracula: {
        label: 'Dracula', emoji: '🧛',
        base: 'dark',
        swatchBg: '#282A36', swatchAccent: '#BD93F9',
        vars: {
            '--bg':           '#282A36',
            '--card':         '#1E1F2B',
            '--text-1':       '#F8F8F2',
            '--text-2':       '#BFBFBF',
            '--text-3':       '#6272A4',
            '--border':       'rgba(189,147,249,0.22)',
            '--purple':       '#BD93F9',
            '--purple-light': 'rgba(189,147,249,0.14)',
            '--red':          '#FF5555',
            '--green':        '#50FA7B',
            '--radius-card':  '6px',
            '--radius-pill':  '16px',
            '--radius-check': '50%',
            '--radius-btn':   '4px',
            '--logo-filter':  'hue-rotate(240deg) brightness(0.9) saturate(1.2)'
        }
    },

    solarized: {
        label: 'Solarized', emoji: '☀️',
        base: 'light',
        swatchBg: '#FDF6E3', swatchAccent: '#268BD2',
        vars: {
            '--bg':           '#FDF6E3',
            '--card':         '#EEE8D5',
            '--text-1':       '#657B83',
            '--text-2':       '#839496',
            '--text-3':       '#93A1A1',
            '--border':       'rgba(38,139,210,0.22)',
            '--purple':       '#268BD2',
            '--purple-light': 'rgba(38,139,210,0.12)',
            '--red':          '#DC322F',
            '--green':        '#859900',
            '--radius-card':  '4px',
            '--radius-pill':  '10px',
            '--radius-check': '50%',
            '--radius-btn':   '4px',
            '--logo-filter':  'sepia(0.3) hue-rotate(30deg)'
        }
    },

    'deep-ocean': {
        label: 'Deep Ocean', emoji: '🌊',
        base: 'dark',
        swatchBg: '#030C1A', swatchAccent: '#00B4D8',
        vars: {
            '--bg':           '#030C1A',
            '--card':         '#071828',
            '--text-1':       '#CAF0F8',
            '--text-2':       '#90E0EF',
            '--text-3':       '#0096C7',
            '--border':       'rgba(0,180,216,0.22)',
            '--purple':       '#00B4D8',
            '--purple-light': 'rgba(0,180,216,0.12)',
            '--red':          '#FF6B6B',
            '--green':        '#48CAE4',
            '--radius-card':  '10px',
            '--radius-pill':  '24px',
            '--radius-check': '50%',
            '--radius-btn':   '6px',
            '--logo-filter':  'hue-rotate(190deg) saturate(1.5) brightness(0.85)'
        }
    }
};

// Single set tracking ALL inline CSS vars (preset vars + studio overrides combined).
// Cleared atomically on every preset switch so nothing leaks across themes.
const _inlineVars = new Set();

function _setInlineVar(key, val) {
    document.documentElement.style.setProperty(key, val);
    _inlineVars.add(key);
}
function _clearAllInlineVars() {
    _inlineVars.forEach(v => document.documentElement.style.removeProperty(v));
    _inlineVars.clear();
}

function applyPreset(id) {
    const preset = THEME_PRESETS[id] || THEME_PRESETS.default;

    // Wipe every inline override (preset + studio) before applying new set
    _clearAllInlineVars();

    // Apply preset vars
    Object.entries(preset.vars).forEach(([k, v]) => _setInlineVar(k, v));

    // Apply base theme. For 'default' restore the user's own preference.
    if (preset.base === 'dark')        applyTheme('dark');
    else if (preset.base === 'light')  applyTheme('light');
    else /* 'auto' / default */        applyTheme(localStorage.getItem(LS_USER_THEME_KEY) || 'light');

    // Save to settings — also clear any studio customisations on preset switch
    if (typeof settings !== 'undefined') {
        settings.themePreset = id;
        settings.themeCustom = {};
        if (typeof debouncedSave === 'function') debouncedSave();
    }

    document.querySelectorAll('.theme-preset-card').forEach(c => {
        c.classList.toggle('active', c.dataset.preset === id);
    });
    _syncDarkToggle(id);
}

function restoreTheme() {
    const id     = (typeof settings !== 'undefined' && settings.themePreset) || 'default';
    const preset = THEME_PRESETS[id] || THEME_PRESETS.default;

    _clearAllInlineVars();
    Object.entries(preset.vars).forEach(([k, v]) => _setInlineVar(k, v));

    if (preset.base === 'dark')       applyTheme('dark');
    else if (preset.base === 'light') applyTheme('light');
    else                              applyTheme(localStorage.getItem(LS_USER_THEME_KEY) || 'light');

    // Layer saved studio overrides on top
    const custom = (typeof settings !== 'undefined' && settings.themeCustom) || {};
    Object.entries(custom).forEach(([k, v]) => _setInlineVar(k, v));

    _syncDarkToggle(id);
}

function renderThemePresets() {
    const grid = document.getElementById('theme-preset-grid');
    if (!grid) return;
    const current = (typeof settings !== 'undefined' && settings.themePreset) || 'default';
    grid.innerHTML = Object.entries(THEME_PRESETS).map(([id, p]) => `
        <div class="theme-preset-card${id === current ? ' active' : ''}" data-preset="${id}"
             onclick="applyPreset('${id}');syncThemeStudio();" title="${p.emoji} ${p.label}">
            <div class="preset-swatch">
                <div class="preset-swatch-bg" style="background:${p.swatchBg}"></div>
                <div class="preset-swatch-accent" style="background:${p.swatchAccent}"></div>
            </div>
            <span style="font-size:0.62rem;font-weight:600;color:var(--text-2);text-align:center;line-height:1.2">${p.emoji}<br>${p.label}</span>
        </div>`).join('');
}

// ── Theme Studio ──────────────────────────────────────────────────────────────
function syncThemeStudio() {
    const root = getComputedStyle(document.documentElement);
    const get  = v => root.getPropertyValue(v).trim();

    const rSlider = document.getElementById('studio-radius-slider');
    const rVal    = document.getElementById('studio-radius-val');
    if (rSlider) {
        const px = parseInt(get('--radius-card')) || 6;
        rSlider.value = Math.min(px, 24);
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
    if (!color || color === 'transparent') return '#ffffff';
    if (color.startsWith('#') && color.length === 7) return color;
    if (color.startsWith('#') && color.length === 4)
        return '#' + color[1]+color[1]+color[2]+color[2]+color[3]+color[3];
    const m = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (m) return '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
    return '#888888';
}

function adjustGeometry(val) {
    const px   = val + 'px';
    const pill = Math.max(val * 3, 4) + 'px';
    const chk  = val < 4 ? px : '50%';
    _setInlineVar('--radius-card',  px);
    _setInlineVar('--radius-btn',   px);
    _setInlineVar('--radius-pill',  pill);
    _setInlineVar('--radius-check', chk);
    document.getElementById('studio-radius-val').textContent = px;
    _saveStudioVar('--radius-card',  px);
    _saveStudioVar('--radius-btn',   px);
    _saveStudioVar('--radius-pill',  pill);
    _saveStudioVar('--radius-check', chk);
}

function adjustColors() {
    const bg     = document.getElementById('studio-bg-color')?.value;
    const card   = document.getElementById('studio-card-color')?.value;
    const accent = document.getElementById('studio-accent-color')?.value;
    if (bg)     { _setInlineVar('--bg',     bg);     _saveStudioVar('--bg',     bg); }
    if (card)   { _setInlineVar('--card',   card);   _saveStudioVar('--card',   card); }
    if (accent) {
        _setInlineVar('--purple',       accent);
        _setInlineVar('--purple-light', accent + '22');
        _saveStudioVar('--purple',       accent);
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

// ── Dark-mode toggle & active-theme pill ─────────────────────────────────────
function _syncDarkToggle(presetId) {
    const isThemed = presetId && presetId !== 'default';
    const toggle   = document.getElementById('dark-toggle-btn');
    const pill     = document.getElementById('active-theme-btn');
    if (toggle) toggle.style.display = isThemed ? 'none' : '';
    if (pill) {
        pill.style.display = isThemed ? '' : 'none';
        if (isThemed) {
            const preset = THEME_PRESETS[presetId];
            pill.textContent = (preset ? preset.emoji + ' ' + preset.label : presetId) + ' ✕';
        }
    }
}

// ── Base theme (light / dark) ─────────────────────────────────────────────────
function initTheme() {
    const saved = localStorage.getItem(LS_THEME_KEY) || 'light';
    applyTheme(saved);
}
function toggleDarkMode() {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    localStorage.setItem(LS_USER_THEME_KEY, next); // remember user's own choice
    applyTheme(next);
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
