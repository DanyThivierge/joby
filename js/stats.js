// stats.js — Motivational taglines, heatmap, and stats cards for the Stats tab.

// ── Motivational / context-aware taglines ─────────────────────────────────────
const STATIC_TAGLINES = [
    'Because you\'ll forget.',
    'Your work, remembered.',
    'So nothing slips.',
    'The nudge you didn\'t know you needed.',
    'Your tasks, sorted.',
    'Work tracked. Day owned.',
    'Stay on it.',
    'All your tasks. One place.',
    'Get it done.',
    'On it.',
    'Keep moving.'
];
let _taglineStaticIdx = Math.floor(Math.random() * STATIC_TAGLINES.length);
function getMotivationalTagline() {
    const today = todayStr();
    const yest  = yesterdayStr();
    if (streak.current > 0 && [3,7,14,30].includes(streak.current)) {
        return '🔥 ' + streak.current + '-day streak — you\'re on fire!';
    }
    if (streak.current >= 2) {
        return '🔥 ' + streak.current + ' days in a row — keep it going!';
    }
    const yestCount = completionLog[yest] || 0;
    if (yestCount >= 5) {
        return 'You crushed ' + yestCount + ' tasks yesterday 💪';
    }
    const todayCount = completionLog[today] || 0;
    if (todayCount >= 2) {
        return todayCount + ' done today already — nice pace! 🎯';
    }
    if (inboxItems.length > 0) {
        return inboxItems.length + ' idea' + (inboxItems.length > 1 ? 's' : '') + ' waiting in your inbox 💡';
    }
    const line = STATIC_TAGLINES[_taglineStaticIdx];
    _taglineStaticIdx = (_taglineStaticIdx + 1) % STATIC_TAGLINES.length;
    return line;
}
(function() {
    function setTagline() {
        const el = document.getElementById('app-tagline');
        if (!el) return;
        el.classList.add('fade');
        setTimeout(() => { el.textContent = getMotivationalTagline(); el.classList.remove('fade'); }, 600);
    }
    setTagline();
    setInterval(setTagline, TAGLINE_INTERVAL_MS);
})();
function flashTagline(msg) {
    const el = document.getElementById('app-tagline');
    if (!el) return;
    el.classList.add('fade');
    setTimeout(() => { el.textContent = msg; el.classList.remove('fade'); }, 600);
}

// ── Stats Tab ─────────────────────────────────────────────────────────────────
function renderHeatmap() {
    const WEEKS = HEATMAP_WEEKS;
    const DAYS  = HEATMAP_DAYS;
    const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    const today = new Date();
    today.setHours(0,0,0,0);
    const endDate = new Date(today);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (WEEKS * DAYS - 1));

    const weeks = [];
    let cursor = new Date(startDate);
    for (let w = 0; w < WEEKS; w++) {
        const week = [];
        for (let d = 0; d < DAYS; d++) {
            week.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(week);
    }

    const monthLabels = weeks.map((week, wi) => {
        const firstDay = week[0];
        if (wi === 0 || firstDay.getMonth() !== weeks[wi-1][0].getMonth()) {
            return firstDay.toLocaleDateString('en-CA', { month: 'short' });
        }
        return '';
    });

    function cellColor(count) {
        if (!count) return 'var(--border)';
        if (count <= 2)  return 'rgba(75,0,130,0.22)';
        if (count <= 5)  return 'rgba(75,0,130,0.50)';
        if (count <= 9)  return 'rgba(75,0,130,0.78)';
        return 'var(--purple)';
    }

    const monthEl = document.getElementById('heatmap-month-labels');
    if (monthEl) monthEl.innerHTML = monthLabels.map(m => '<span>' + m + '</span>').join('');

    const gridEl = document.getElementById('heatmap-grid');
    if (!gridEl) return;

    let html = '';
    for (let d = 0; d < DAYS; d++) {
        html += '<div class="heatmap-day-label">' + (d % 2 === 0 ? DAY_LABELS[d] : '') + '</div>';
        for (let w = 0; w < WEEKS; w++) {
            const dateObj = weeks[w][d];
            const ds   = dateObj.toLocaleDateString('en-CA');
            const cnt  = completionLog[ds] || 0;
            const col  = cellColor(cnt);
            const isFuture = dateObj > today;
            const tip  = isFuture ? '' : ds + (cnt ? ' — ' + cnt + ' task' + (cnt>1?'s':'') + ' done' : ' — no completions');
            html += '<div class="heatmap-cell" style="background:' + (isFuture ? 'transparent' : col) + '; border: 1px solid var(--border);" title="' + tip + '"></div>';
        }
    }
    gridEl.style.gridTemplateColumns = '28px repeat(' + WEEKS + ', 14px)';
    gridEl.innerHTML = html;
}

function renderStatsCards() {
    const el = document.getElementById('stats-cards');
    if (!el) return;

    const today = todayStr();
    const yest  = yesterdayStr();

    const allTimeDone = tasks.filter(t => t.done).length;
    const totalTasks  = tasks.length;
    const compRate    = totalTasks ? Math.round(allTimeDone / totalTasks * 100) : 0;

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    weekStart.setHours(0,0,0,0);
    let weekCount = 0;
    Object.entries(completionLog).forEach(([ds, cnt]) => {
        const d = new Date(ds + 'T00:00:00');
        if (d >= weekStart) weekCount += cnt;
    });

    const monthPrefix = today.slice(0, 7);
    let monthCount = 0;
    Object.entries(completionLog).forEach(([ds, cnt]) => {
        if (ds.startsWith(monthPrefix)) monthCount += cnt;
    });

    const dowTotals = [0,0,0,0,0,0,0];
    const DOW_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    Object.entries(completionLog).forEach(([ds, cnt]) => {
        const d = new Date(ds + 'T00:00:00');
        const idx = (d.getDay() + 6) % 7;
        dowTotals[idx] += cnt;
    });
    const bestDowIdx = dowTotals.indexOf(Math.max(...dowTotals));
    const bestDow    = dowTotals[bestDowIdx] > 0 ? DOW_NAMES[bestDowIdx] : null;

    el.innerHTML = `
        <div class="stats-card-big">
            <div class="scb-value">🔥 ${streak.current}</div>
            <div class="scb-label">Current Streak</div>
            <div class="scb-sub">Longest: ${streak.longest} days</div>
        </div>
        <div class="stats-card-big">
            <div class="scb-value">${weekCount}</div>
            <div class="scb-label">Completed This Week</div>
            <div class="scb-sub">${completionLog[today] || 0} today · ${completionLog[yest] || 0} yesterday</div>
        </div>
        <div class="stats-card-big">
            <div class="scb-value">${monthCount}</div>
            <div class="scb-label">Completed This Month</div>
            <div class="scb-sub">${allTimeDone} all time</div>
        </div>
        <div class="stats-card-big">
            <div class="scb-value">${compRate}%</div>
            <div class="scb-label">Completion Rate</div>
            <div class="scb-sub">${allTimeDone} done of ${totalTasks} created</div>
        </div>
        ${bestDow ? `<div class="stats-card-big">
            <div class="scb-value" style="font-size:1.1rem">💪 ${bestDow}</div>
            <div class="scb-label">Most Productive Day</div>
            <div class="scb-sub">${dowTotals[bestDowIdx]} tasks on ${bestDow}s total</div>
        </div>` : ''}
    `;
}
