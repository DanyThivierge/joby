// theme.js — Dark mode toggle and speech-to-text microphone input.

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
