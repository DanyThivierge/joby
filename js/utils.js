// utils.js — Shared helpers: HTML escaping, URL linkification, toast notifications, date strings.

function escHtml(t) { const d=document.createElement('div'); d.appendChild(document.createTextNode(t)); return d.innerHTML; }
function escAttr(u) { return u.replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function isOverdue(task) { return task.dueDate && !task.done && task.dueDate < new Date().toISOString().slice(0,10); }
function formatDue(s) { if (!s) return ''; const [y,m,d]=s.split('-'); return d+'/'+m+'/'+y; }
function priorityRank(p) { return p==='high'?0:p==='medium'?1:2; }
function linkify(text) {
    const urlRx = /(https?:\/\/[^\s<>"]+)/g;
    return escHtml(text).replace(urlRx, url => {
        try { new URL(url); } catch { return url; }
        const display = url.length > 60 ? url.slice(0, 57) + '...' : url;
        return '<a href="' + escAttr(url) + '" target="_blank" rel="noopener noreferrer" class="task-link" onclick="event.stopPropagation()">' + display + '</a>';
    });
}

function toast(msg, dur=2300, accent='') {
    const ex=document.querySelector('.toast'); if (ex) ex.remove();
    const el=document.createElement('div'); el.className='toast';
    el.textContent=msg;
    if (accent) el.style.borderLeftColor=accent;
    document.body.appendChild(el); setTimeout(()=>el.remove(), dur);
}

function toastWithAction(msg, actionLabel, actionFn, dur=DELETE_UNDO_MS) {
    const ex=document.querySelector('.toast'); if (ex) ex.remove();
    const el=document.createElement('div'); el.className='toast';
    const span=document.createElement('span'); span.textContent=msg;
    const btn=document.createElement('button'); btn.className='toast-action'; btn.textContent=actionLabel;
    btn.addEventListener('click', () => { el.remove(); actionFn(); });
    el.append(span, btn);
    document.body.appendChild(el); setTimeout(()=>el.remove(), dur);
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayStr() {
    return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}
function yesterdayStr() {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
}
function addDaysToDate(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('en-CA');
}
function freqDays(freq) {
    return freq === 'daily' ? 1 : freq === 'weekly' ? 7 : freq === 'biweekly' ? 14 : freq === 'monthly' ? 30 : freq === 'yearly' ? 365 : 0;
}
function freqLabel(freq) {
    const map = {
        daily: 'recurDaily', weekdays: 'recurWeekdays',
        weekly: 'recurWeekly', biweekly: 'recurBiweekly',
        monthly: 'recurMonthly', yearly: 'recurYearly',
        'weekly-mon': 'recurEveryMon', 'weekly-tue': 'recurEveryTue',
        'weekly-wed': 'recurEveryWed', 'weekly-thu': 'recurEveryThu',
        'weekly-fri': 'recurEveryFri',
    };
    return (freq && map[freq]) ? t(map[freq]) : '';
}

// ── Recurrence next-date helpers ──────────────────────────────────────────────
const _DOW_MAP = { 'weekly-mon': 1, 'weekly-tue': 2, 'weekly-wed': 3, 'weekly-thu': 4, 'weekly-fri': 5 };
function nextRecurDate(freq, fromDateStr) {
    const d = new Date(fromDateStr + 'T00:00:00');
    if (freq === 'daily')    { d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA'); }
    if (freq === 'weekdays') { do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); return d.toLocaleDateString('en-CA'); }
    if (freq === 'weekly')   { d.setDate(d.getDate() + 7);  return d.toLocaleDateString('en-CA'); }
    if (freq === 'biweekly') { d.setDate(d.getDate() + 14); return d.toLocaleDateString('en-CA'); }
    if (freq === 'monthly')  { d.setMonth(d.getMonth() + 1); return d.toLocaleDateString('en-CA'); }
    if (freq === 'yearly')   { d.setFullYear(d.getFullYear() + 1); return d.toLocaleDateString('en-CA'); }
    const target = _DOW_MAP[freq];
    if (target !== undefined) { do { d.setDate(d.getDate() + 1); } while (d.getDay() !== target); return d.toLocaleDateString('en-CA'); }
    const days = freqDays(freq);
    if (days > 0) d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-CA');
}
function prevWorkday(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
    return d.toLocaleDateString('en-CA');
}
function isNextWorkday(aStr, bStr) {
    const a = new Date(aStr + 'T00:00:00');
    do { a.setDate(a.getDate() + 1); } while (a.getDay() === 0 || a.getDay() === 6);
    return a.toLocaleDateString('en-CA') === bStr;
}

// ── i18n ──────────────────────────────────────────────────────────────────────
function t(key) {
    const s = STRINGS[uiLang];
    return (s && s[key] !== undefined) ? s[key] : (STRINGS.en[key] || key);
}
function catLabel(val) {
    const key = 'cat' + val;
    const result = t(key);
    return result === key ? escHtml(val) : result; // escape raw fallback; translated strings already use HTML entities
}
function tFmt(key, ...args) {
    let s = t(key);
    args.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
    return s;
}
function _decodeHtml(str) {
    const d = document.createElement('div');
    d.innerHTML = str;
    return d.textContent;
}
function applyLang(lang) {
    if (lang) uiLang = lang;
    const s = STRINGS[uiLang];
    if (!s) return;
    document.documentElement.lang = uiLang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const val = s[el.dataset.i18n];
        if (val !== undefined) el.innerHTML = val;
    });
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.placeholder = _decodeHtml(s.searchPlaceholder || '');
    const taskInput = document.getElementById('task-input');
    if (taskInput) taskInput.placeholder = _decodeHtml(s.taskPlaceholder || '');
    const notesInput = document.getElementById('task-notes');
    if (notesInput) notesInput.placeholder = _decodeHtml(s.notesPlaceholder || '');
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) langBtn.textContent = uiLang === 'en' ? 'FR' : 'EN';
    try { localStorage.setItem(LANG_LS_KEY, uiLang); } catch {}
    if (typeof populateCategorySelects === 'function') populateCategorySelects();
    if (typeof renderTasks  === 'function') renderTasks();
    if (typeof updateStats  === 'function') updateStats();
    if (typeof renderInbox  === 'function') renderInbox();
}
function toggleLang() {
    applyLang(uiLang === 'en' ? 'fr' : 'en');
}
