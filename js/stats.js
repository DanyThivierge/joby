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
    // Streak milestones are event-driven — always show them when applicable
    if (streak.current > 0 && [3,7,14,30].includes(streak.current)) {
        return '🔥 ' + streak.current + '-day streak — you\'re on fire!';
    }
    if (streak.current >= 2) {
        return '🔥 ' + streak.current + ' days in a row — keep it going!';
    }
    // Build a rotation pool so context messages don't block static ones
    const today = todayStr(), yest = yesterdayStr();
    const pool = [...STATIC_TAGLINES];
    const yestCount = completionLog[yest] || 0;
    if (yestCount >= 5) pool.push('You crushed ' + yestCount + ' tasks yesterday 💪');
    const todayCount = completionLog[today] || 0;
    if (todayCount >= 2) pool.push(todayCount + ' done today already — nice pace! 🎯');
    if (inboxItems.length > 0) pool.push(inboxItems.length + ' idea' + (inboxItems.length > 1 ? 's' : '') + ' waiting in your inbox 💡');
    const line = pool[_taglineStaticIdx % pool.length];
    _taglineStaticIdx = (_taglineStaticIdx + 1) % pool.length;
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
    const WEEKS      = HEATMAP_WEEKS;
    const DAYS       = HEATMAP_DAYS;
    const CELL_PX    = 10;   // cell width/height in px (compact sidebar size)
    const CELL_GAP   = 2;    // gap between cells
    const LABEL_PX   = 18;   // day-label column width

    const today = new Date();
    today.setHours(0,0,0,0);

    // Snap to Monday of current week so today always lands in the correct weekday row
    const todayDow   = (today.getDay() + 6) % 7; // Mon=0 … Sun=6
    const thisMonday = new Date(today);
    thisMonday.setDate(thisMonday.getDate() - todayDow);
    const startDate  = new Date(thisMonday);
    startDate.setDate(startDate.getDate() - (WEEKS - 1) * DAYS);

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

    const locale      = uiLang === 'fr' ? 'fr-CA' : 'en-CA';
    const DAY_LABELS  = Array.from({length: 7}, (_, i) =>
        new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' })
    );
    const monthLabels = weeks.map((week, wi) => {
        const firstDay = week[0];
        if (wi === 0 || firstDay.getMonth() !== weeks[wi-1][0].getMonth()) {
            return firstDay.toLocaleDateString(locale, { month: 'short' });
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

    // Month-label element is now part of the unified grid — hide the legacy element
    const monthEl = document.getElementById('heatmap-month-labels');
    if (monthEl) monthEl.style.display = 'none';

    const gridEl = document.getElementById('heatmap-grid');
    if (!gridEl) return;

    // Single unified grid: month header row + 7 day rows — alignment is structurally guaranteed
    gridEl.style.gridTemplateColumns = LABEL_PX + 'px repeat(' + WEEKS + ', ' + CELL_PX + 'px)';

    let html = '';

    // Row 0: month labels (top-left corner is empty)
    html += '<div></div>';
    for (let w = 0; w < WEEKS; w++) {
        html += '<div class="heatmap-month-cell">' + (monthLabels[w] || '') + '</div>';
    }

    // Rows 1-7: day label + cells
    for (let d = 0; d < DAYS; d++) {
        html += '<div class="heatmap-day-label">' + (d % 2 === 0 ? DAY_LABELS[d] : '') + '</div>';
        for (let w = 0; w < WEEKS; w++) {
            const dateObj  = weeks[w][d];
            const ds       = dateObj.toLocaleDateString('en-CA');
            const cnt      = completionLog[ds] || 0;
            const isFuture = dateObj > today;
            if (isFuture) {
                html += '<div class="heatmap-cell heatmap-cell-future"></div>';
            } else {
                const tip = ds + (cnt ? ' — ' + cnt + ' ' + (cnt > 1 ? t('hmTasksDone') : t('hmTaskDone')) : ' — ' + t('hmNoComp'));
                html += '<div class="heatmap-cell" style="background:' + cellColor(cnt) + ';" title="' + tip + '"></div>';
            }
        }
    }
    gridEl.innerHTML = html;
}

function _computeStatsData() {
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
        if (new Date(ds + 'T00:00:00') >= weekStart) weekCount += cnt;
    });

    const monthPrefix = today.slice(0, 7);
    let monthCount = 0;
    Object.entries(completionLog).forEach(([ds, cnt]) => {
        if (ds.startsWith(monthPrefix)) monthCount += cnt;
    });

    const dowTotals = [0,0,0,0,0,0,0];
    const locale    = uiLang === 'fr' ? 'fr-CA' : 'en-CA';
    const DOW_LONG  = Array.from({length: 7}, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'long' }));
    const DOW_SHORT = Array.from({length: 7}, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' }));
    Object.entries(completionLog).forEach(([ds, cnt]) => {
        dowTotals[(new Date(ds + 'T00:00:00').getDay() + 6) % 7] += cnt;
    });
    const bestDowIdx = dowTotals.indexOf(Math.max(...dowTotals));

    return {
        today, yest,
        allTimeDone, totalTasks, compRate,
        weekCount, monthCount,
        todayCount:     completionLog[today] || 0,
        yesterdayCount: completionLog[yest]  || 0,
        bestDowIdx,
        bestDowCount:   dowTotals[bestDowIdx],
        bestDowLong:    dowTotals[bestDowIdx] > 0 ? DOW_LONG[bestDowIdx]  : null,
        bestDowShort:   dowTotals[bestDowIdx] > 0 ? DOW_SHORT[bestDowIdx] : null,
        dowTotals
    };
}

function renderStatsCards() {
    const el = document.getElementById('stats-cards');
    if (!el) return;
    const d = _computeStatsData();
    el.innerHTML = `
        <div class="stats-card-big">
            <div class="scb-value">🔥 ${streak.current}</div>
            <div class="scb-label">${t('scbCurrStreak')}</div>
            <div class="scb-sub">${tFmt('scbLongest', streak.longest)}</div>
        </div>
        <div class="stats-card-big">
            <div class="scb-value">${d.weekCount}</div>
            <div class="scb-label">${t('scbCompWeek')}</div>
            <div class="scb-sub">${tFmt('ssbTodayYest', d.todayCount, d.yesterdayCount)}</div>
        </div>
        <div class="stats-card-big">
            <div class="scb-value">${d.monthCount}</div>
            <div class="scb-label">${t('scbCompMonth')}</div>
            <div class="scb-sub">${tFmt('ssbAllTime', d.allTimeDone)}</div>
        </div>
        <div class="stats-card-big">
            <div class="scb-value">${d.compRate}%</div>
            <div class="scb-label">${t('ssbCompRate')}</div>
            <div class="scb-sub">${tFmt('scbDoneOf', d.allTimeDone, d.totalTasks)}</div>
        </div>
        ${d.bestDowLong ? `<div class="stats-card-big">
            <div class="scb-value" style="font-size:1.1rem">💪 ${d.bestDowLong}</div>
            <div class="scb-label">${t('scbMostProd')}</div>
            <div class="scb-sub">${tFmt('scbTasksOnDay', d.bestDowCount, d.bestDowLong)}</div>
        </div>` : ''}
    `;
}

function renderSidebarStats() {
    const el = document.getElementById('sidebar-stats-cards');
    if (!el) return;
    const d = _computeStatsData();
    el.innerHTML = `
        <div class="ssc-card">
            <div class="ssc-value">🔥 ${streak.current}</div>
            <div class="ssc-label">${t('ssbDayStreak')}</div>
            <div class="ssc-sub">${tFmt('ssbLongest', streak.longest)}</div>
        </div>
        <div class="ssc-card">
            <div class="ssc-value">${d.weekCount}</div>
            <div class="ssc-label">${t('ssbThisWeek')}</div>
            <div class="ssc-sub">${tFmt('ssbTodayYest', d.todayCount, d.yesterdayCount)}</div>
        </div>
        <div class="ssc-card">
            <div class="ssc-value">${d.monthCount}</div>
            <div class="ssc-label">${t('ssbThisMonth')}</div>
            <div class="ssc-sub">${tFmt('ssbAllTime', d.allTimeDone)}</div>
        </div>
        <div class="ssc-card">
            <div class="ssc-value">${d.compRate}%</div>
            <div class="ssc-label">${t('ssbCompRate')}</div>
        </div>
        ${d.bestDowShort ? `<div class="ssc-card">
            <div class="ssc-value">💪 ${d.bestDowShort}</div>
            <div class="ssc-label">${t('ssbBestDay')}</div>
            <div class="ssc-sub">${tFmt('ssbTasksTotal', d.bestDowCount)}</div>
        </div>` : ''}
    `;
}
