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
    { title: 'Gemba: go see for yourself.', body: 'Going to the actual place where work happens to observe reality instead of relying on secondhand assumptions.' },
    { title: '5 Whys: keep asking until you hit the real cause.', body: 'Asking "why" multiple times in sequence to drill past surface-level symptoms down to the root cause.' },
];

// category drives the pill color (see .lean-tag.* in css/styles.css) — reuses the
// app's existing red/purple/green tokens, same "color carries meaning, no text
// prefix needed" pattern as the Digest reason badges.
//   waste     -> red    (something to watch for / eliminate)
//   principle -> purple (a core Lean concept or practice)
//   flow      -> green  (things moving/visible the way they should)
//   tool      -> blue   (a specific technique, e.g. Gemba, 5 Whys)
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
    // Give the 'tool' category (glossary-only until now — see LEAN_GLOSSARY)
    // actual presence in rotation, not just something you'd only ever see by
    // opening the glossary proactively.
    { text: 'Have you actually looked at where this breaks, or are you working from a secondhand description?', category: 'tool', label: 'Gemba' },
    { text: "If you asked 'why' one more time here, would you learn something new — or is this already the root cause?", category: 'tool', label: '5 Whys' },
    // Round 2 — same reasoning as above (wording variety only, no live-data logic).
    { text: 'How many apps or tabs do you need to open just to gather context for this single ticket?', category: 'waste', label: 'Motion' },
    { text: 'Are we polishing this deliverable past what the requester actually requested?', category: 'waste', label: 'Over-processing' },
    { text: "Did we start this task with incomplete inputs, knowing we'll have to redo parts later?", category: 'waste', label: 'Rework' },
    { text: "Is this ticket sitting in 'In Progress' even though nobody has touched it today?", category: 'waste', label: 'Waiting' },
    { text: 'How many times did this task switch owners before actual work started?', category: 'waste', label: 'Handoffs' },
    { text: 'Are you doing a manual copy-paste task that could easily be automated?', category: 'waste', label: 'Underused Skills' },
    { text: 'Are we building a solution for a scenario that might never actually happen?', category: 'waste', label: 'Overproduction' },
    { text: 'Has this backlog item sat so long that the original context is stale?', category: 'waste', label: 'Inventory' },
    { text: 'Are you context-switching between three tickets right now instead of finishing one?', category: 'waste', label: 'Motion' },
    { text: 'If someone had to pick up this ticket right now, could they proceed without asking you questions?', category: 'principle', label: 'Standardization' },
    { text: 'Are we starting this because a requester needs it now, or to fill an open spot in the sprint?', category: 'principle', label: 'Pull' },
    { text: 'What is one tiny friction point in this step that we could streamline before closing the ticket?', category: 'principle', label: 'Kaizen' },
    { text: 'Are we adding another approval gate, or fixing the error that caused the mistake in the first place?', category: 'principle', label: 'Root Cause' },
    { text: "Is this process designed to make the worker's job easier, or just to log activity?", category: 'principle', label: 'Respect' },
    { text: 'Does everyone on the team follow the same steps for this task, or is everyone using a custom workaround?', category: 'principle', label: 'Standardization' },
    { text: 'Is the blocker on this task visible on the board, or is it buried in a private chat?', category: 'flow', label: 'Visibility' },
    { text: 'Does the owner of the next step know this ticket is ready for them, or are they waiting on a ping?', category: 'flow', label: 'Communication' },
    { text: 'How much time did this ticket spend in active effort versus sitting queued up?', category: 'flow', label: 'Flow' },
    { text: 'Can anyone looking at this board spot the single biggest bottleneck in under 5 seconds?', category: 'flow', label: 'Visual Management' },
    { text: 'Are we pushing more work into the pipeline than the team has capacity to complete?', category: 'flow', label: 'WIP Limit' },
    { text: 'Have you walked through the actual user workflow yourself to spot where the friction lives?', category: 'tool', label: 'Gemba' },
    { text: 'If we fix this bug today, what prevents the exact same class of bug from happening next sprint?', category: 'tool', label: '5 Whys' },
    { text: 'Can we design this form or step so it is virtually impossible to input the wrong data?', category: 'tool', label: 'Poka-Yoke' },
    // Recategorized from the batch as given: this is Visual Management, same as the
    // other three prompts using that label elsewhere in this list — tagging it
    // 'tool' would put the same label in two different pill colors.
    { text: 'What is the single visual indicator on this ticket that shows it needs immediate attention?', category: 'flow', label: 'Visual Management' },
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
    { category: 'waste', label: 'Inventory', def: 'A backlog or queue sitting around long enough to lose context or value.' },
    { category: 'principle', label: 'Standardization', def: 'Writing down the current best-known way of doing something as a baseline to improve from.' },
    { category: 'principle', label: 'Pull', def: "Starting work because there's real demand for it, not just because capacity is free." },
    { category: 'principle', label: 'Root Cause', def: 'Fixing what actually caused a problem, not just the symptom in front of you.' },
    { category: 'principle', label: 'Kaizen', def: 'Small, frequent improvements driven by the people doing the work, not big rare overhauls.' },
    { category: 'principle', label: 'Respect', def: 'Designing work to remove friction for the person doing it, not just to track activity.' },
    { category: 'flow', label: 'Visibility', def: 'Work status is easy to see without having to ask.' },
    { category: 'flow', label: 'Communication', def: 'The people waiting on you can tell where things stand.' },
    { category: 'flow', label: 'Visual Management', def: "Status and progress are visible at a glance, not hidden in someone's head." },
    { category: 'flow', label: 'Flow', def: 'Work moving steadily through the process instead of sitting idle in queues.' },
    { category: 'flow', label: 'WIP Limit', def: 'Capping how much work is in progress at once so things get finished, not just started.' },
    // Tools — specific techniques rather than principles or waste types.
    { category: 'tool', label: 'Gemba', def: 'Observing work where it actually happens rather than making decisions based on assumptions.' },
    { category: 'tool', label: '5 Whys', def: "Asking 'why' sequentially to drill past surface symptoms to the root cause." },
    { category: 'tool', label: 'Poka-Yoke', def: 'Error-proofing: designing a step so the wrong action is difficult or impossible to take by mistake.' },
];

const LEAN_GLOSSARY_CATEGORY_LABEL = { waste: 'Waste', principle: 'Principle', flow: 'Flow', tool: 'Tools' };

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
    el.innerHTML = '<div class="lean-ci-title">' + escHtml(entry.title) + '</div>'
        + '<div class="lean-ci-body">' + escHtml(entry.body) + '</div>';
}

function renderLeanPrompts() {
    const el = document.getElementById('lean-prompts');
    if (!el) return;
    const n = LEAN_QUICK_PROMPTS.length;
    const shown = [0, 1, 2].map(i => LEAN_QUICK_PROMPTS[(leanPromptStart + i) % n]);
    el.innerHTML = shown.map(p =>
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

// Per-section collapse (chevron on each header) — separate from the whole-panel
// collapse above. The panel has three stacked sections now and runs fairly deep
// vertically; someone who's already memorized Core Principles can shrink just
// that one without losing the rotating content below it.
const LEAN_SUBSECTION_BODY_IDS = { principles: 'lean-core-principles', ci: 'lean-ci-focus', prompts: 'lean-prompts' };

function setLeanSubsectionCollapsed(name, collapsed) {
    const body = document.getElementById(LEAN_SUBSECTION_BODY_IDS[name]);
    const chevron = document.getElementById('lean-chevron-' + name);
    if (!body) return;
    body.style.display = collapsed ? 'none' : '';
    if (chevron) chevron.innerHTML = collapsed ? '&#9654;' : '&#9660;'; // ▶ collapsed, ▼ expanded
    try {
        if (collapsed) localStorage.setItem('joby-lean-sub-' + name, '1');
        else localStorage.removeItem('joby-lean-sub-' + name);
    } catch { /* localStorage unavailable — state just won't persist across reloads */ }
}
function toggleLeanSubsection(name) {
    const body = document.getElementById(LEAN_SUBSECTION_BODY_IDS[name]);
    if (!body) return;
    setLeanSubsectionCollapsed(name, body.style.display !== 'none');
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
    Object.keys(LEAN_SUBSECTION_BODY_IDS).forEach(name => {
        let subCollapsed = false;
        try { subCollapsed = localStorage.getItem('joby-lean-sub-' + name) === '1'; } catch { /* defaults to expanded */ }
        setLeanSubsectionCollapsed(name, subCollapsed);
    });
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
