// lean-panel.js — Lean Reminders panel on the Digest tab: a pinned core-principles
// glossary plus a rotating pool of Continuous-Improvement entries and Quick
// Prompts. A nudge, not a training module — see
// docs/superpowers/specs/2026-08-24-lean-reminders-panel-design.md.
//
// Content below is a placeholder starter set (general Lean vocabulary), pending
// whatever specific material leadership is actually using — swap it out once
// that comes back, not before.

const LEAN_CORE_PRINCIPLES = [
    { term: 'Value',                          text: "what the customer/requester actually needs, not what's convenient to produce." },
    { term: 'Waste',                          text: "anything that doesn't add value: waiting, extra handoffs, rework, overproduction, unused skills, excess motion, over-processing." },
    { term: 'Flow',                           text: 'work moving steadily through the process instead of sitting in queues.' },
    { term: 'Pull',                           text: "starting work because there's real demand for it, not because capacity happens to be free." },
    { term: 'Continuous Improvement (Kaizen)', text: 'small, frequent improvements driven by the people doing the work, rather than big, rare overhauls.' },
];

const LEAN_CI_FOCUS = [
    { title: 'Kaizen: small and frequent beats big and rare.', body: "Improvement doesn't need a project plan or a quarterly review — a two-line process tweak raised this week counts. The habit of raising small fixes as you spot them is the point, not the size of any one fix." },
    { title: 'Everyone owns improvement, not just leads.', body: "The person doing the work day to day usually spots the friction first. Flagging it — even informally, even if it's not fixed right away — is part of the job, not a step above it." },
    { title: 'A good improvement is small enough to try this week.', body: "If an idea needs a committee to approve it, it's probably not kaizen-sized yet. Look for the smaller version that can just be tried, then build from what's learned." },
    { title: 'Standardize before you improve.', body: 'Write down the current best-known way of doing something before optimizing it further — otherwise "improvements" don\'t stick, because there was never an agreed baseline to improve from.' },
    { title: 'Improvement should be safe to suggest, not just safe to do.', body: "If raising a problem feels like naming someone's mistake, people stop raising problems. The goal is to make noticing waste feel like a normal, low-stakes conversation." },
    { title: 'Plan, do, check, act — then do it again.', body: "Continuous improvement isn't a single fix, it's a loop: try something small, see what actually happened, adjust, and go again. One pass rarely gets it fully right." },
    { title: "Improvement that isn't written down doesn't spread.", body: "A fix that only lives in one person's head helps one person. Sharing it — even briefly, in a comment or a note — is what turns a personal workaround into a team-wide gain." },
    { title: "Ask 'why' more than once.", body: 'The first explanation for a recurring problem is rarely the real one. A couple of follow-up "why"s usually gets closer to the actual root cause than stopping at the first answer.' },
];

const LEAN_QUICK_PROMPTS = [
    { text: 'Does this step add value the requester actually asked for?', tag: 'overproduction' },
    { text: 'Is this ticket waiting on someone, or actually moving?', tag: 'waiting/delay' },
    { text: 'Could this handoff be skipped or combined with the next step?', tag: 'handoffs' },
    { text: "Is this the second (or third) time we're fixing the same thing?", tag: 'rework/defects' },
    { text: 'Would the person closest to this work know the fix faster than the process does?', tag: 'underused skills / Gemba' },
    { text: "Is there a documented 'best way' to do this yet, or is everyone improvising?", tag: 'standardization' },
    { text: 'How many approvals does this actually need before it can move?', tag: 'over-processing' },
    { text: 'Are we building this because someone asked for it, or because it seemed useful?', tag: 'overproduction / pull' },
    { text: 'Could this update be batched with something else instead of a one-off interruption?', tag: 'motion / context-switching' },
    { text: 'If this ticket sat untouched for a week, would anyone notice?', tag: 'flow / visibility' },
    { text: 'Can the person waiting on this see where it stands, or are they guessing?', tag: 'flow / communication' },
    { text: 'Are we fixing the root cause here, or patching the same symptom again?', tag: 'rework / root cause' },
    { text: 'Would explaining this process to someone new take one sentence or ten?', tag: 'standardization' },
    { text: "Is this moving because it's the next most valuable thing, or just the oldest thing in the queue?", tag: 'pull vs. push' },
];

const LEAN_COLLAPSED_LS_KEY = 'joby-lean-collapsed';
const LEAN_HIDDEN_LS_KEY    = 'joby-lean-hidden';
const LEAN_ROTATE_MS        = 18 * 60 * 1000; // within the design doc's 15-20 min range

let leanRotationIndex = 0; // position in the "Next" button's sequential walk
let leanRotateTimer   = null;

// The auto/random pick draws from a pool where Continuous-Improvement entries
// appear ~2x as often as Quick Prompts (duplicate-entries-in-the-pool trick,
// same technique already used for Joby's hat/move rotation odds in
// js/tamagoshi_svg.js) — CI is where leadership's attention currently is.
function leanWeightedPool() {
    return LEAN_CI_FOCUS.concat(LEAN_CI_FOCUS).map(entry => ({ kind: 'ci', entry }))
        .concat(LEAN_QUICK_PROMPTS.map(entry => ({ kind: 'prompt', entry })));
}

// The combined, unweighted sequence the "Next" button walks through on demand —
// every CI entry, then every Quick Prompt, in a fixed order — for skimming the
// whole set without waiting on the timer.
function leanSequentialPool() {
    return LEAN_CI_FOCUS.map(entry => ({ kind: 'ci', entry }))
        .concat(LEAN_QUICK_PROMPTS.map(entry => ({ kind: 'prompt', entry })));
}

function renderLeanRotatingItem(item) {
    const el = document.getElementById('lean-rotating');
    if (!el || !item) return;
    el.innerHTML = item.kind === 'ci'
        ? '<div class="lean-ci-title">' + escHtml(item.entry.title) + '</div>'
          + '<div class="lean-ci-body">' + escHtml(item.entry.body) + '</div>'
        : '<div class="lean-prompt-text">' + escHtml(item.entry.text) + '</div>'
          + '<div class="lean-prompt-tag">' + escHtml(item.entry.tag) + '</div>';
}

function leanPanelShowRandom() {
    const pool = leanWeightedPool();
    const picked = pool[Math.floor(Math.random() * pool.length)];
    // Keeps "Next" continuing on from wherever the timer/page-load pick landed,
    // rather than jumping to an unrelated spot in the sequence on first click.
    const seqIdx = leanSequentialPool().findIndex(i => i.entry === picked.entry);
    leanRotationIndex = seqIdx >= 0 ? seqIdx : 0;
    renderLeanRotatingItem(picked);
}

function leanPanelNext() {
    const seq = leanSequentialPool();
    leanRotationIndex = (leanRotationIndex + 1) % seq.length;
    renderLeanRotatingItem(seq[leanRotationIndex]);
}

function renderLeanCorePrinciples() {
    const el = document.getElementById('lean-core-principles');
    if (!el) return;
    el.innerHTML = LEAN_CORE_PRINCIPLES.map(p =>
        '<div class="lean-principle-row"><strong>' + escHtml(p.term) + '</strong> — ' + escHtml(p.text) + '</div>'
    ).join('');
}

// Inline expand/collapse toggle on the panel itself — independent of the
// Settings-only hide/show below.
function setLeanPanelCollapsed(collapsed) {
    const panel = document.getElementById('lean-panel');
    if (!panel) return;
    panel.classList.toggle('collapsed', collapsed);
    try {
        if (collapsed) localStorage.setItem(LEAN_COLLAPSED_LS_KEY, '1');
        else localStorage.removeItem(LEAN_COLLAPSED_LS_KEY);
    } catch { /* localStorage unavailable — state just won't persist across reloads */ }
}

// Settings-only hide/show — reachable when the panel isn't wanted at all, not
// just collapsed. Independent of setLeanPanelCollapsed(): un-hiding restores
// whichever of expanded/collapsed was last set.
function toggleLeanPanelVisibility(show) {
    const panel = document.getElementById('lean-panel');
    if (!panel) return;
    panel.style.display = show ? '' : 'none';
    try {
        if (show) localStorage.removeItem(LEAN_HIDDEN_LS_KEY);
        else localStorage.setItem(LEAN_HIDDEN_LS_KEY, '1');
    } catch { /* localStorage unavailable — state just won't persist across reloads */ }
}

function initLeanPanel() {
    const panel = document.getElementById('lean-panel');
    if (!panel) return;
    let hidden = false, collapsed = false;
    try {
        hidden    = localStorage.getItem(LEAN_HIDDEN_LS_KEY) === '1';
        collapsed = localStorage.getItem(LEAN_COLLAPSED_LS_KEY) === '1';
    } catch { /* localStorage unavailable — defaults to shown + expanded */ }
    panel.style.display = hidden ? 'none' : '';
    panel.classList.toggle('collapsed', collapsed);
    const checkbox = document.getElementById('s-lean-panel-enabled');
    if (checkbox) checkbox.checked = !hidden;
    renderLeanCorePrinciples();
    leanPanelShowRandom();
    // Desktop-only feature; the Digest tab itself is already unreachable in the
    // GAS/Home builds, so no extra build-mode guard needed here.
    if (!leanRotateTimer) leanRotateTimer = setInterval(leanPanelShowRandom, LEAN_ROTATE_MS);
}
