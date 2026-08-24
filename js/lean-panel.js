// lean-panel.js — Lean Reminders panel on the Digest tab: a pinned core-principles
// glossary plus a rotating pool of Continuous-Improvement entries and Quick
// Prompts. A nudge, not a training module — see
// docs/superpowers/specs/2026-08-24-lean-reminders-panel-design.md.
//
// Content below is a placeholder starter set (general Lean vocabulary), pending
// whatever specific material leadership is actually using — swap it out once
// that comes back, not before.

const LEAN_CORE_PRINCIPLES = [
    { term: 'Value',                     text: 'What the requester actually needs (not convenience).' },
    { term: 'Waste',                     text: 'Non-value effort: waiting, handoffs, rework.' },
    { term: 'Flow',                      text: 'Work moving steadily, not sitting in queues.' },
    { term: 'Pull',                      text: 'Starting work on real demand, not free capacity.' },
    { term: 'Respect',                   text: 'Removing friction for the people doing the work.' },
    { term: 'Kaizen (Continuous Improvement)', text: 'Small, frequent fixes driven by the team.' },
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

// category drives the pill color (see .lean-tag.* in css/styles.css) — reuses the
// app's existing red/purple/green tokens, same "color carries meaning, no text
// prefix needed" pattern as the Digest reason badges.
//   waste     -> red    (something to watch for / eliminate)
//   principle -> purple (a core Lean concept or practice)
//   flow      -> green  (things moving/visible the way they should)
const LEAN_QUICK_PROMPTS = [
    { text: 'Does this step add value the requester actually asked for?', category: 'waste', label: 'Overproduction' },
    { text: 'Is this ticket waiting on someone, or actually moving?', category: 'waste', label: 'Waiting' },
    { text: 'Could this handoff be skipped or combined with the next step?', category: 'waste', label: 'Handoffs' },
    { text: "Is this the second (or third) time we're fixing the same thing?", category: 'waste', label: 'Rework' },
    { text: 'Would the person closest to this work know the fix faster than the process does?', category: 'waste', label: 'Underused Skills' },
    { text: "Is there a documented 'best way' to do this yet, or is everyone improvising?", category: 'principle', label: 'Standardization' },
    { text: 'How many approvals does this actually need before it can move?', category: 'waste', label: 'Over-processing' },
    { text: 'Are we building this because someone asked for it, or because it seemed useful?', category: 'principle', label: 'Pull' },
    { text: 'Could this update be batched with something else instead of a one-off interruption?', category: 'waste', label: 'Motion' },
    { text: 'If this ticket sat untouched for a week, would anyone notice?', category: 'flow', label: 'Visibility' },
    { text: 'Can the person waiting on this see where it stands, or are they guessing?', category: 'flow', label: 'Communication' },
    { text: 'Are we fixing the root cause here, or patching the same symptom again?', category: 'principle', label: 'Root Cause' },
    { text: 'Would explaining this process to someone new take one sentence or ten?', category: 'principle', label: 'Standardization' },
    { text: "Is this moving because it's the next most valuable thing, or just the oldest thing in the queue?", category: 'principle', label: 'Pull' },
    // Context-aware — reference the actual filters/statuses sitting right next to
    // this panel, without any live logic reading real ticket data (just wording).
    { text: 'Look at your Waiting items — is one stuck on a handoff, or missing clear info?', category: 'waste', label: 'Waiting' },
    { text: 'Are any tickets In Progress just sitting there to keep capacity looking busy?', category: 'principle', label: 'Pull' },
    { text: 'Can the person waiting on your comment see status clearly, or are they guessing?', category: 'flow', label: 'Visual Management' },
    { text: 'Did this ticket require extra approvals that add no quality?', category: 'waste', label: 'Over-processing' },
];

// Every distinct pill label used across LEAN_QUICK_PROMPTS, with a one-line
// definition — the "why is Rework the same red as Underused Skills" question a
// pill alone can't answer. Kept as its own explicit list rather than
// auto-derived from the prompts above, since a definition has to be hand-written
// regardless; deliberately not auto-deduped from that array so a forgotten
// definition fails loudly (missing from the modal) rather than silently.
const LEAN_GLOSSARY = [
    { category: 'waste', label: 'Overproduction', def: 'Building or doing more than what was actually asked for.' },
    { category: 'waste', label: 'Waiting', def: "Work sitting idle because it's stuck on someone or something else." },
    { category: 'waste', label: 'Handoffs', def: 'Extra transfers between people or teams that add delay without adding value.' },
    { category: 'waste', label: 'Rework', def: 'Fixing the same problem more than once instead of solving it right the first time.' },
    { category: 'waste', label: 'Underused Skills', def: 'Not using the person best placed to solve something quickly.' },
    { category: 'waste', label: 'Over-processing', def: "Extra steps, reviews, or approvals that don't add real value." },
    { category: 'waste', label: 'Motion', def: 'Unnecessary switching, searching, or shuffling between tasks.' },
    { category: 'principle', label: 'Standardization', def: 'Writing down the current best-known way of doing something as a baseline to improve from.' },
    { category: 'principle', label: 'Pull', def: "Starting work because there's real demand for it, not just because capacity is free." },
    { category: 'principle', label: 'Root Cause', def: 'Fixing what actually caused a problem, not just the symptom in front of you.' },
    { category: 'flow', label: 'Visibility', def: 'Work status is easy to see without having to ask.' },
    { category: 'flow', label: 'Communication', def: 'The people waiting on you can tell where things stand.' },
    { category: 'flow', label: 'Visual Management', def: "Status and progress are visible at a glance, not hidden in someone's head." },
];

const LEAN_GLOSSARY_CATEGORY_LABEL = { waste: 'Waste', principle: 'Principle', flow: 'Flow' };

const LEAN_COLLAPSED_LS_KEY = 'joby-lean-collapsed';
const LEAN_HIDDEN_LS_KEY    = 'joby-lean-hidden';
const LEAN_ROTATE_MS        = 18 * 60 * 1000; // within the design doc's 15-20 min range

let leanRotateTimer   = null;

// The auto/random pick draws from a pool where Continuous-Improvement entries
// appear ~2x as often as Quick Prompts (duplicate-entries-in-the-pool trick,
// same technique already used for Joby's hat/move rotation odds in
// js/tamagoshi_svg.js) — CI is where leadership's attention currently is.
//
// Two independent rotating sections rather than one shared pool: Continuous
// Improvement entries are 2-4 sentences, so only one is shown at a time; Quick
// Prompts are one-liners, so three fit comfortably together under their own
// heading. leanPanelNext() advances both at once; the auto-timer re-randomizes
// both at once.
let leanCiIndex     = 0;
let leanPromptStart = 0;

function renderLeanCiFocus() {
    const el = document.getElementById('lean-ci-focus');
    if (!el) return;
    const entry = LEAN_CI_FOCUS[leanCiIndex % LEAN_CI_FOCUS.length];
    el.innerHTML = '<div class="lean-section-title">&#128260; Continuous Improvement Focus</div>'
        + '<div class="lean-ci-title">' + escHtml(entry.title) + '</div>'
        + '<div class="lean-ci-body">' + escHtml(entry.body) + '</div>';
}

function renderLeanPrompts() {
    const el = document.getElementById('lean-prompts');
    if (!el) return;
    const n = LEAN_QUICK_PROMPTS.length;
    const shown = [0, 1, 2].map(i => LEAN_QUICK_PROMPTS[(leanPromptStart + i) % n]);
    el.innerHTML = '<div class="lean-section-title">&#128173; Quick question to ask yourself</div>'
        + shown.map(p =>
            '<div class="lean-prompt-row"><span class="lean-prompt-text">' + escHtml(p.text) + '</span>'
            + '<span class="lean-tag ' + p.category + '">' + escHtml(p.label) + '</span></div>'
        ).join('');
}

function leanPanelShowRandom() {
    leanCiIndex     = Math.floor(Math.random() * LEAN_CI_FOCUS.length);
    leanPromptStart = Math.floor(Math.random() * LEAN_QUICK_PROMPTS.length);
    renderLeanCiFocus();
    renderLeanPrompts();
}

function leanPanelNext() {
    leanCiIndex     = (leanCiIndex + 1) % LEAN_CI_FOCUS.length;
    leanPromptStart = (leanPromptStart + 3) % LEAN_QUICK_PROMPTS.length;
    renderLeanCiFocus();
    renderLeanPrompts();
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

// Full-list, on-demand reference for every pill label shown anywhere in the
// panel — grouped by the same category that drives the pill color, so the
// grouping itself doubles as an explanation of why two different labels share
// a color.
function renderLeanGlossary() {
    const el = document.getElementById('lean-glossary-body');
    if (!el) return;
    el.innerHTML = Object.keys(LEAN_GLOSSARY_CATEGORY_LABEL).map(cat => {
        const entries = LEAN_GLOSSARY.filter(g => g.category === cat);
        return '<div class="lean-glossary-group">'
            + '<div class="lean-glossary-group-title">' + LEAN_GLOSSARY_CATEGORY_LABEL[cat] + '</div>'
            + entries.map(g =>
                '<div class="lean-glossary-row">'
                + '<span class="lean-tag ' + g.category + '">' + escHtml(g.label) + '</span>'
                + '<span class="lean-glossary-def">' + escHtml(g.def) + '</span>'
                + '</div>'
            ).join('')
            + '</div>';
    }).join('');
}

function openLeanGlossary() {
    renderLeanGlossary();
    const modal = document.getElementById('lean-glossary-modal');
    if (modal) modal.style.display = 'block';
}
function closeLeanGlossary() {
    const modal = document.getElementById('lean-glossary-modal');
    if (modal) modal.style.display = 'none';
}
