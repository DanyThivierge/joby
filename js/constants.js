// constants.js — App-wide configuration values and magic strings/numbers.

const APP_VERSION         = '1.6';
const OPFS_FILENAME       = 'work-tasks.json';
const LS_KEY              = 'work_tasks';
const LS_THEME_KEY        = 'wtt-theme';
const LS_USER_THEME_KEY   = 'wtt-user-theme'; // user's own light/dark toggle (separate from preset-forced mode)

const LOGO_LIGHT          = 'th_logo_en.png';
const LOGO_DARK           = 'telus_logo_dark.png';

const PROXY_ORIGIN        = 'http://localhost:3333';
const JIRA_DEFAULT_URL    = 'https://telushealth.atlassian.net';

const SAVE_DEBOUNCE_MS    = 800;
const DELETE_UNDO_MS      = 5000;
const TAGLINE_INTERVAL_MS = 5 * 60 * 1000;

const MAX_INDENT          = 3;
const CONFETTI_COUNT      = 28;
const HEATMAP_WEEKS       = 13;
const HEATMAP_DAYS        = 7;
