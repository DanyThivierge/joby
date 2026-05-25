// constants.js — App-wide configuration values and magic strings/numbers.

const APP_VERSION         = '1.7';
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

const PERSONAL_OPFS_FILENAME = 'personal-tasks.json';
const PERSONAL_LS_KEY        = 'personal_tasks';
const ACTIVE_MODE_LS_KEY     = 'joby-active-mode';

const WORK_CATEGORIES = [
    { value: 'Work',    emoji: '💼', label: 'Work'    },
    { value: 'Dev',     emoji: '💻', label: 'Dev'     },
    { value: 'Meeting', emoji: '📅', label: 'Meeting' },
    { value: 'Review',  emoji: '🔍', label: 'Review'  },
    { value: 'Admin',   emoji: '📋', label: 'Admin'   },
    { value: 'Jira',    emoji: '🎯', label: 'Jira'    },
    { value: 'Other',   emoji: '📌', label: 'Other'   },
];

const PERSONAL_CATEGORIES = [
    { value: 'Home',     emoji: '🏠', label: 'Home'     },
    { value: 'Chores',   emoji: '🧹', label: 'Chores'   },
    { value: 'Shopping', emoji: '🛒', label: 'Shopping' },
    { value: 'Health',   emoji: '❤️',  label: 'Health'   },
    { value: 'Finance',  emoji: '💰', label: 'Finance'  },
    { value: 'Family',   emoji: '👨‍👩‍👧', label: 'Family'   },
    { value: 'Car',      emoji: '🚗', label: 'Car'      },
    { value: 'Study',    emoji: '📚', label: 'Study'    },
    { value: 'Garden',   emoji: '🌿', label: 'Garden'   },
    { value: 'Errands',  emoji: '🏃', label: 'Errands'  },
    { value: 'Personal', emoji: '👤', label: 'Personal' },
];
