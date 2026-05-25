// state.js — Global mutable state shared across all modules: tasks, settings, streaks, inbox.

let tasks             = [];
let settings          = { jiraUrl: JIRA_DEFAULT_URL, jiraJql: '', jiraAssigneeMe: true, jiraUnresolved: true, jiraStatuses: 'In Progress,To Do', jiraStatusNot: false, jiraPriorities: '', jiraUpdatedDays: '', jiraProjects: '' };
let promotedJiraIds   = [];
let saveDebTimer      = null;
let isDirty           = false;
let jiraIssues        = [];
let jiraNextPageToken = null;
let jiraIsLoading     = false;
let activeTab         = 'tasks';
let currentFilter     = 'all';
let editId            = null;
let dragSrcIdx        = null;
let dragTargetIndent  = 0;
let inboxItems        = [];
let completionLog     = {};   // { "YYYY-MM-DD": count }
let streak            = { current: 0, lastDate: '', longest: 0 };
const INDENT_W        = 36;   // px per level — visual margin-left
const DRAG_ZONE_W     = 80;   // px per level — drag detection zone (wider = easier to hit)
let recognition       = null;
let isListening       = false;
let compactView       = false;
const expandedCompactIds = new Set();

window.db = {
    get: k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

// ── Task colors ───────────────────────────────────────────────────────────────
const TASK_COLORS = [
    { key: '',       label: 'No color' },
    { key: 'red',    label: 'Red',    hex: '#ef4444' },
    { key: 'orange', label: 'Orange', hex: '#f97316' },
    { key: 'yellow', label: 'Yellow', hex: '#eab308' },
    { key: 'green',  label: 'Green',  hex: '#22c55e' },
    { key: 'teal',   label: 'Teal',   hex: '#14b8a6' },
    { key: 'blue',   label: 'Blue',   hex: '#3b82f6' },
    { key: 'pink',   label: 'Pink',   hex: '#ec4899' },
];
