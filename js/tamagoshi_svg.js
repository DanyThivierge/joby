// tamagoshi_svg.js — Joby the octopus, SVG edition
// Started as a drop-in replacement for tamagoshi.js (same original API: tamaTaskDone,
// tamaAllDone, toggleTamagoshi, applyTamagoshiSetting, changeJobyHat); since extended
// with tamaBulkDone (bulk-complete reaction) and tamaSetDigestPending (Digest-tab
// awareness) — tamagoshi.js does not have these.

(function () {

const SVG_NS = 'http://www.w3.org/2000/svg';

// ── Hat config ────────────────────────────────────────────────────────────────
const ALL_HATS = ['default', 'topHat', 'cowboy', 'crown', 'beanie', 'detective', 'bald'];
let currentHat     = 'cowboy';
let hatTimer       = 0;       // ms until next hat change
let hatChanging    = false;   // true during the brief bald flash transition

function scheduleNextHat() {
  // First change after 20–40s so you notice it; then every 2–5 min
  hatTimer = hatTimer === 0
    ? 20000 + Math.random() * 20000
    : 120000 + Math.random() * 180000;
}
scheduleNextHat();

// Seasonal hats join the rotation pool for their window — they don't replace it.
// Local time is fine here; this is a whimsy feature, not something that needs to be
// exact at a midnight boundary.
function seasonalHats() {
  const month = new Date().getMonth(); // 0-11
  const extra = [];
  if (month === 11)                 extra.push('santa');  // December
  if (month >= 5 && month <= 7)     extra.push('sunhat');  // June-August
  return extra;
}

function currentHatPool() {
  let pool = ALL_HATS.concat(seasonalHats());
  // A meaningful streak biases toward the crown (reusing the existing hat, not a new
  // one) without removing the rest of the rotation — duplicate entries just raise the
  // odds it comes up.
  if (typeof streak !== 'undefined' && streak && streak.current >= 7) pool = pool.concat(['crown', 'crown']);
  return pool;
}

function pickNewHat() {
  // Always pick a DIFFERENT hat — guaranteed
  const fullPool = currentHatPool();
  const nonBald  = fullPool.filter(h => h !== currentHat && h !== 'bald');
  const pool     = nonBald.length ? nonBald : fullPool.filter(h => h !== currentHat);
  const base     = pool[Math.floor(Math.random() * pool.length)];
  // 10% chance of briefly going bald
  return Math.random() < 0.1 ? 'bald' : base;
}

// ── Colour palettes (skins) per mood ───────────────────────────────────────────
// 'classic' reproduces the original single MOOD_COLOR map exactly, plus a 'pet' hue
// for the petting reaction below. Skins auto-cycle over time (see scheduleNextSkin
// below) — no settings UI for this. window.setJobySkin() can still force one manually.
const PALETTES = {
  classic: { happy: '#F4A7C3', worried: '#DC143C', sleeping: '#D8BFD8', party: '#F4A7C3', excited: '#FFD700', eating: '#FFD700', focused: '#00ffcc', hanging: '#87CEEB', boredom: '#9333ea', pet: '#FF69B4' },
  neon:    { happy: '#00FF66', worried: '#FF0055', sleeping: '#7000FF', party: '#00E5FF', excited: '#FFE600', eating: '#FFE600', focused: '#00FF66', hanging: '#00E5FF', boredom: '#FF00AA', pet: '#FF00AA' },
  matcha:  { happy: '#A8E6CF', worried: '#E84A5F', sleeping: '#DCEDC1', party: '#A8E6CF', excited: '#FFD3B6', eating: '#FFD3B6', focused: '#88D8B0', hanging: '#A8E6CF', boredom: '#A8E6CF', pet: '#FF8B94' },
  pastel:  { happy: '#FFC6D9', worried: '#F5A3A3', sleeping: '#D6CDEA', party: '#FFE3B3', excited: '#FFF3A0', eating: '#FFF3A0', focused: '#B8E3E9', hanging: '#C7E8F3', boredom: '#D8C7EE', pet: '#FFB8D9' },
  sunset:  { happy: '#FF7B54', worried: '#900C3F', sleeping: '#C70039', party: '#FFB26B', excited: '#FFD93D', eating: '#FFD93D', focused: '#FF7B54', hanging: '#FFB26B', boredom: '#6C5CE7', pet: '#FF7B54' },
  boba:      { happy: '#D7A87E', worried: '#A0522D', sleeping: '#E6CCB2', party: '#D7A87E', excited: '#FFB703', eating: '#FFB703', focused: '#B08968', hanging: '#EDE0D4', boredom: '#7F5539', pet: '#FFB4A2' },
  cyberpunk: { happy: '#00F0FF', worried: '#FF0055', sleeping: '#2B0938', party: '#FF007F', excited: '#FFE600', eating: '#FFE600', focused: '#00F0FF', hanging: '#7000FF', boredom: '#FF007F', pet: '#FF007F' },
};

let currentSkin = 'classic';
let skinTimer = 0; // ms until the next auto skin change — see the rAF loop below
function scheduleNextSkin() {
  skinTimer = 180000 + Math.random() * 240000; // 3-7 minutes
}
scheduleNextSkin();
function pickNewSkin() {
  const others = Object.keys(PALETTES).filter(k => k !== currentSkin);
  return others[Math.floor(Math.random() * others.length)];
}
// No settings UI for this — skins cycle on their own over time. setJobySkin() still
// works for manually forcing one (e.g. from the console), it'll just get overridden
// by the next auto-cycle like any other skin would.
window.setJobySkin = function (skinName) {
  if (PALETTES[skinName]) currentSkin = skinName;
};
function getMoodColor(m) {
  const palette = PALETTES[currentSkin] || PALETTES.classic;
  return palette[m] || palette.happy;
}

// ── SVG helpers ───────────────────────────────────────────────────────────────
function el(tag, attrs) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
function path(d, sw = 1.8, extra = {}) {
  return el('path', { d, fill: 'none', stroke: 'currentColor',
    'stroke-width': sw, 'stroke-linecap': 'round',
    'stroke-linejoin': 'round', ...extra });
}
function circle(cx, cy, r, fill = 'currentColor') {
  return el('circle', { cx, cy, r, fill });
}
function group() { return document.createElementNS(SVG_NS, 'g'); }

// ── Joby geometry constants ───────────────────────────────────────────────────
const SCALE = 1.4;  // scale up from raw SVG units → screen px
const CX   = 18;   // local centre-x inside a 36-wide viewbox
const HY   = 8;    // head top-y
const HH   = 14;   // head height
const LY   = HY + HH;      // leg root y  (22)
const LLEN = 11;            // leg length
const HAT  = HY - 8;       // hat anchor y
// Feet (bottom of legs) in local units = LY + LLEN = 33
// Anchor: feet sit ON the green line (header bottom ≈ 53px from top)
const FEET_Y  = LY + LLEN;   // 33 local units
const ANCHOR_Y = 53;          // px from viewport top to the green line

// ── Body (rounded rect head) ──────────────────────────────────────────────────
function drawHead() {
  return path(
    `M ${CX-9},${HY+HH/2} Q ${CX-9},${HY} ${CX},${HY}
     Q ${CX+9},${HY} ${CX+9},${HY+HH/2}
     Q ${CX+9},${HY+HH} ${CX},${HY+HH}
     Q ${CX-9},${HY+HH} ${CX-9},${HY+HH/2} Z`,
    1.8, { fill: 'none' }
  );
}

// ── Eyes ──────────────────────────────────────────────────────────────────────
function drawEyes(state) {
  const g = group();
  const lx = CX - 3.5, rx = CX + 3.5, ey = HY + 7;

  if (state === 'closed') {
    g.appendChild(path(`M ${lx-2},${ey} Q ${lx},${ey+2} ${lx+2},${ey}`, 1.5));
    g.appendChild(path(`M ${rx-2},${ey} Q ${rx},${ey+2} ${rx+2},${ey}`, 1.5));
  } else if (state === 'worried') {
    g.appendChild(path(`M ${lx-2},${ey-1} L ${lx},${ey+1} L ${lx+2},${ey-1}`, 1.5));
    g.appendChild(path(`M ${rx-2},${ey-1} L ${rx},${ey+1} L ${rx+2},${ey-1}`, 1.5));
  } else if (state === 'star') {
    g.appendChild(path(`M ${lx-2},${ey-2} L ${lx+2},${ey+2} M ${lx+2},${ey-2} L ${lx-2},${ey+2}`, 1.4));
    g.appendChild(path(`M ${rx-2},${ey-2} L ${rx+2},${ey+2} M ${rx+2},${ey-2} L ${rx-2},${ey+2}`, 1.4));
  } else if (state === 'focused') {
    // > < eyes
    g.appendChild(path(`M ${lx+2},${ey-1} L ${lx},${ey+1} L ${lx+2},${ey+1}`, 1.4));
    g.appendChild(path(`M ${rx-2},${ey-1} L ${rx},${ey+1} L ${rx-2},${ey+1}`, 1.4));
  } else {
    // Normal: filled + gleam
    g.appendChild(circle(lx, ey, 2.6, '#000'));
    g.appendChild(circle(rx, ey, 2.6, '#000'));
    g.appendChild(circle(lx - 0.8, ey - 0.8, 0.8, '#fff'));
    g.appendChild(circle(rx - 0.8, ey - 0.8, 0.8, '#fff'));
  }
  return g;
}

// ── Mouth ─────────────────────────────────────────────────────────────────────
function drawMouth(state) {
  // The absolute sweet spot right in the middle!
  const my = HY + HH - 3; 
  const MOUTH_COLOR = '#C85A80'; 
  const THICKNESS = 1.1;         

  if (state === 'worried') {
    return path(`M ${CX-3},${my+1} Q ${CX},${my-1} ${CX+3},${my+1}`, THICKNESS, { stroke: MOUTH_COLOR });
  }
  if (state === 'sleeping') {
    return path(`M ${CX-2},${my} L ${CX+2},${my}`, THICKNESS, { stroke: MOUTH_COLOR });
  }
  return path(`M ${CX-3},${my} Q ${CX},${my+2.5} ${CX+3},${my}`, THICKNESS, { stroke: MOUTH_COLOR });
}

// ── Tentacles ─────────────────────────────────────────────────────────────────
// Each leg has its own independent oscillator with randomised-but-stable
// frequency, phase, and amplitude. Speed reactivity elongates legs when sprinting.
// Seeded per-leg so the randomness is deterministic across frames.

// Per-leg oscillator seeds — initialised once, never change
const LEG_SEEDS = (function() {
  // Stable pseudo-random values per leg [0..1] for freq, phase, amp jitter
  const rng = (seed) => { let x = Math.sin(seed) * 43758.5453; return x - Math.floor(x); };
  return [0,1,2,3,4].map(i => ({
    freqJitter:  0.7 + rng(i * 7.3)  * 0.6,   // 0.7 – 1.3× base freq
    phaseOffset: rng(i * 3.1)        * Math.PI * 2, // random start phase
    ampJitter:   0.8 + rng(i * 11.7) * 0.4,   // 0.8 – 1.2× base amplitude
    lenJitter:   0.9 + rng(i * 5.9)  * 0.2,   // 0.9 – 1.1× base leg length
    ctrlBias:    (rng(i * 2.3) - 0.5) * 1.5,  // slight curve bias per leg
  }));
})();

// Current walk speed (px/s) — updated by rafLoop so drawLegs can react
let currentSpeed = 0;

// ── Breath & envelope system ─────────────────────────────────────────────────
// Two-layer system:
//   Layer 1 — fast breath: short sine oscillation (~0.8 Hz), always running
//   Layer 2 — slow envelope: randomly shaped grow/shrink cycles (3-8s each)
//             drives the overall leg length up and down unpredictably
let breathT     = 0;   // fast breath timer
let breathPulse = 0;   // current combined value — read by render() for body lift

// Envelope state — a slow lerp target that changes on a random schedule
let envValue    = 0.0;  // current envelope (0 = normal, 1 = fully extended)
let envTarget   = 0.0;  // where we're heading
let envSpeed    = 0.0;  // lerp speed (units/ms) — randomised per segment
let envTimer    = 0;    // ms until next target change

function newEnvSegment() {
  // Random target: bias toward 0 (normal) but occasionally reach full extension
  envTarget = Math.random() < 0.3 ? 0.1 + Math.random() * 0.9   // big stretch
                                   : Math.random() * 0.35;        // subtle drift
  // Random duration 2s–8s for grow, 1.5s–5s for shrink
  const dur  = envTarget > envValue
             ? 6000 + Math.random() * 10000  // grow: 6–16s
             : 4000 + Math.random() * 6000;  // shrink: 4–10s
  envSpeed   = Math.abs(envTarget - envValue) / dur;
  envTimer   = dur * (0.6 + Math.random() * 0.8); // next change in 60–140% of dur
}

// Kick off the first segment
newEnvSegment();

function drawLegs(walkPhase, mood) {
  const g = group();
  const offsets = [-8, -4, 0, 4, 8];

  // Tiptoe: legs extra long and thin
  const isTiptoe = boredomMove === 'tiptoe';
  // Speed factor: 0 at rest → 1 at normal → 2+ sprinting
  const speedFactor = Math.min(currentSpeed / 10, 2.5);
  // Breath: two-layer system
  // Layer 1 — fast oscillation scaled by envelope so amplitude varies over time
  const breathAmp  = (0.04 + speedFactor * 0.05) * (1 + envValue * 1.5);
  const fastBreath = Math.sin(breathT * Math.PI * 2) * breathAmp;
  // Layer 2 — envelope adds a slow DC offset so legs genuinely grow longer
  breathPulse = fastBreath + envValue * 0.25;  // write to module var
  // Combined: speed stretch + breathing + slow envelope extension
  const speedStretch = 1 + speedFactor * 0.08 + breathPulse;

  offsets.forEach((ox, i) => {
    const lx   = CX + ox;
    const seed = LEG_SEEDS[i];

    if (mood === 'idle' || mood === 'sleeping') {
      // Idle: gentle personalised droop, each leg slightly different
      const splay = ox * 0.4 + seed.ctrlBias;
      const len   = LLEN * seed.lenJitter;
      const cy1   = LY + len * 0.5;
      const bot   = LY + len;
      g.appendChild(path(`M ${lx},${LY} Q ${lx+splay},${cy1} ${lx+splay*0.7},${bot}`, 1.7));

    } else if (mood === 'party') {
      // Party: independent flailing per leg
      const t     = walkPhase * seed.freqJitter + seed.phaseOffset;
      const flail = Math.sin(t) * 5 * seed.ampJitter;
      const len   = LLEN * seed.lenJitter;
      const cy1   = LY + len * 0.4;
      const bot   = LY + len;
      g.appendChild(path(`M ${lx},${LY} Q ${lx+flail},${cy1} ${lx+flail*0.5},${bot}`, 1.7));

    } else if (mood === 'worried') {
      // Worried: rapid independent nervous twitch per leg
      const t      = walkPhase * seed.freqJitter * 2.5 + seed.phaseOffset;
      const jitter = Math.sin(t) * 2.5 * seed.ampJitter;
      const len    = LLEN * seed.lenJitter * 0.85; // scrunch slightly
      const cy1    = LY + len * 0.5;
      const bot    = LY + len;
      g.appendChild(path(`M ${lx},${LY} Q ${lx+jitter},${cy1} ${lx+jitter*0.3},${bot}`, 1.7));

    } else {
      // Walking: each leg runs its own sine oscillator
      // freq, phase, amplitude all slightly randomised → no two legs in sync
      const t        = walkPhase * seed.freqJitter + seed.phaseOffset;
      const side     = ox < 0 ? -1 : ox > 0 ? 1 : 0;
      const curlAmt  = Math.sin(t) * 4 * seed.ampJitter;
      // Speed stretches leg length and increases curl amplitude
      const len      = LLEN * seed.lenJitter * speedStretch * (isTiptoe ? 1.7 : 1.0);
      const bot      = LY + len;
      const cy1      = LY + len * (0.5 + speedFactor * 0.05);
      const cx1      = lx + curlAmt + side * 1.5 + seed.ctrlBias;
      const footSway = curlAmt * 0.4;
      g.appendChild(path(
        `M ${lx},${LY} Q ${cx1},${cy1} ${lx+footSway},${bot}`,
        1.7
      ));
    }
  });

  return g;
}

// ── Arms (for hanging) ────────────────────────────────────────────────────────
function drawArms() {
  const g = group();
  const ay = HY + 5;
  g.appendChild(path(`M ${CX-9},${ay} Q ${CX-14},${ay-6} ${CX-10},${HAT+2}`, 1.6));
  g.appendChild(path(`M ${CX+9},${ay} Q ${CX+14},${ay-6} ${CX+10},${HAT+2}`, 1.6));
  return g;
}

// ── Hats ──────────────────────────────────────────────────────────────────────
function drawHat(name) {
  const g = group();
  // brimY = HY so every hat's base sits exactly on the head top
  const brimY = HY;
  const topY  = HY - 8;  // peak/top of hat crown area

  switch (name) {
    case 'bald': break;

    case 'default': {
      // Rounded cap sitting on head
      g.appendChild(path(
        `M ${CX-8},${brimY} Q ${CX-8},${topY} ${CX},${topY} Q ${CX+8},${topY} ${CX+8},${brimY}`,
        1.6));
      g.appendChild(path(`M ${CX-10},${brimY} L ${CX+10},${brimY}`, 1.6));
      break;
    }
    case 'topHat': {
      const tallTop = topY - 4;
      g.appendChild(path(
        `M ${CX-6},${brimY} L ${CX-6},${tallTop} L ${CX+6},${tallTop} L ${CX+6},${brimY}`,
        1.6));
      g.appendChild(path(`M ${CX-11},${brimY} L ${CX+11},${brimY}`, 1.6));
      break;
    }
    case 'cowboy': {
      // Dome sits on head, wide brim at brimY
      g.appendChild(path(
        `M ${CX-7},${brimY} Q ${CX-7},${topY+2} ${CX},${topY+2} Q ${CX+7},${topY+2} ${CX+7},${brimY}`,
        1.6));
      g.appendChild(path(
        `M ${CX-14},${brimY+1} Q ${CX-9},${brimY-1} ${CX-7},${brimY} L ${CX+7},${brimY} Q ${CX+9},${brimY-1} ${CX+14},${brimY+1}`,
        1.6));
      break;
    }
    case 'crown': {
      // Crown base on head, peaks rise up
      g.appendChild(path(
        `M ${CX-8},${brimY} L ${CX-8},${topY+4} L ${CX-3},${topY} L ${CX},${topY+4} L ${CX+3},${topY} L ${CX+8},${topY+4} L ${CX+8},${brimY} Z`,
        1.6));
      break;
    }
    case 'beanie': {
      // Knit dome, base on head
      g.appendChild(path(
        `M ${CX-8},${brimY} Q ${CX-9},${topY+1} ${CX},${topY} Q ${CX+9},${topY+1} ${CX+8},${brimY}`,
        1.6));
      const pom = el('circle', { cx: CX, cy: topY - 2, r: 2.2,
        fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4 });
      g.appendChild(pom);
      g.appendChild(path(
        `M ${CX-7},${topY+5} Q ${CX},${topY+4} ${CX+7},${topY+5}`,
        1.2));
      break;
    }
    case 'party': {
      g.appendChild(path(
        `M ${CX-8},${brimY} L ${CX},${topY-3} L ${CX+8},${brimY} Z`,
        1.6));
      g.appendChild(circle(CX, topY - 4, 1.5));
      break;
    }
    case 'detective': {
      // Deerstalker cap: rounded dome with a front and back visor flap
      g.appendChild(path(`M ${CX-9},${brimY} Q ${CX},${topY+1} ${CX+9},${brimY}`, 1.6));
      g.appendChild(path(`M ${CX-12},${brimY} Q ${CX-6},${brimY-2} ${CX},${brimY}`, 1.4));
      g.appendChild(path(`M ${CX+12},${brimY} Q ${CX+6},${brimY-2} ${CX},${brimY}`, 1.4));
      g.appendChild(circle(CX, topY + 1, 1.2));
      break;
    }
    case 'santa': {
      // Floppy cone leaning right, pom-pom at the tip, band at the base
      g.appendChild(path(`M ${CX-9},${brimY} L ${CX+9},${brimY}`, 1.6));
      g.appendChild(path(
        `M ${CX-7},${brimY} Q ${CX-5},${topY-1} ${CX+3},${topY-3} Q ${CX+8},${topY-5} ${CX+7},${topY-7}`,
        1.6));
      g.appendChild(circle(CX + 7, topY - 7, 1.8));
      break;
    }
    case 'sunhat': {
      // Wide floppy brim, low round dome — a beach hat, not a peaked one
      g.appendChild(path(
        `M ${CX-6},${brimY} Q ${CX-6},${topY+3} ${CX},${topY+3} Q ${CX+6},${topY+3} ${CX+6},${brimY}`,
        1.6));
      g.appendChild(path(
        `M ${CX-15},${brimY} Q ${CX},${brimY+3} ${CX+15},${brimY}`,
        1.6));
      break;
    }
  }
  return g;
}

// ── Zzz for sleeping ──────────────────────────────────────────────────────────
function drawZzz(frame) {
  const g = group();
  const vis = Math.floor(frame / 8) % 3 + 1;
  ['z','z','Z'].slice(0, vis).forEach((ch, i) => {
    const t = document.createElementNS(SVG_NS, 'text');
    Object.entries({
      x: CX + 13 + i * 4, y: HY + 2 - i * 3,
      'font-size': 4 + i * 1.2, 'font-family': 'Courier New, monospace',
      'font-weight': '700', fill: 'currentColor', opacity: 0.35 + i * 0.2
    }).forEach(([k,v]) => t.setAttribute(k, v));
    t.textContent = ch;
    g.appendChild(t);
  });
  return g;
}

// ── Speed lines (sprint) — trail behind Joby based on walk direction ──────────
function drawSpeedLines(dir) {
  const g = group();
  const trailDir = dir < 0 ? 1 : -1;  // lines trail opposite to movement
  [4, 8, 12].forEach((oy, i) => {
    const x1 = CX + trailDir * 11;
    const x2 = CX + trailDir * (15 + i * 2);
    g.appendChild(path(`M ${x1},${HY+oy} L ${x2},${HY+oy}`, 1));
  });
  return g;
}

// ── Party sparkles ────────────────────────────────────────────────────────────
function drawSparkles(frame) {
  const g = group();
  if (frame % 6 < 3) {
    [[-13,-2],[13,-2],[0,-11]].forEach(([ox,oy]) => {
      g.appendChild(circle(CX+ox, HY+oy, 1.2));
    });
  }
  return g;
}

// Floating hearts overlay while being petted (drawn in the mood color, always via
// the 'pet' palette entry regardless of skin, so it stays legible on every skin)
function drawHearts(frame) {
  const g = group();
  const t = Math.floor(frame / 3);
  [[-10, -8], [10, -10], [0, -16]].forEach(([ox, oy], i) => {
    const phase = (t + i * 2) % 6;
    if (phase >= 4) return; // recycles into the next float-up before fully cycling
    const lift = phase * 1.2;
    const y = HY + oy - lift;
    g.appendChild(path(
      `M ${CX+ox},${y} Q ${CX+ox-2.2},${y-2.5} ${CX+ox-4},${y} Q ${CX+ox-4},${y+2.5} ${CX+ox},${y+5} ` +
      `Q ${CX+ox+4},${y+2.5} ${CX+ox+4},${y} Q ${CX+ox+2.2},${y-2.5} ${CX+ox},${y}`,
      1, { fill: getMoodColor('pet'), stroke: 'none', opacity: String(1 - phase * 0.2) }));
  });
  return g;
}

// ── Special state drawings ───────────────────────────────────────────────────

// Coffee break: tiny mug with rising steam, held at Joby's side
function drawCoffee(subframe) {
  const g = group();
  const mx = CX + 10, my = HY + HH - 2;
  g.appendChild(path(`M ${mx-3},${my} L ${mx+3},${my} L ${mx+2},${my+5} L ${mx-2},${my+5} Z`, 1.2));
  g.appendChild(path(`M ${mx+2},${my+1} Q ${mx+4.5},${my+2.5} ${mx+2},${my+4}`, 1.0));
  const steamY = my - 2 - (subframe % 4);
  g.appendChild(path(`M ${mx-1},${steamY} Q ${mx},${steamY-2} ${mx-1},${steamY-4}`, 0.8, { opacity: 0.6 }));
  g.appendChild(path(`M ${mx+1},${steamY-1} Q ${mx+2},${steamY-3} ${mx+1},${steamY-5}`, 0.8, { opacity: 0.4 }));
  return g;
}

// Reading glasses + an open book held in front. The lenses need an explicit stroke
// (the circle() helper's fill-only signature can't render an outline-only circle).
function drawReadBook(subframe) {
  const g = group();
  const my = HY + HH - 1;
  const lens = cx => el('circle', { cx, cy: HY + 7, r: 3.2, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.0 });
  g.appendChild(lens(CX - 3.5));
  g.appendChild(lens(CX + 3.5));
  g.appendChild(path(`M ${CX-0.3},${HY+7} L ${CX+0.3},${HY+7}`, 1.2));
  g.appendChild(path(
    `M ${CX-8},${my+4} L ${CX},${my+2} L ${CX+8},${my+4} L ${CX+8},${my+9} L ${CX},${my+7} L ${CX-8},${my+9} Z`,
    1.2));
  g.appendChild(path(`M ${CX},${my+2} L ${CX},${my+7}`, 1.0));
  return g;
}

// Juggling: three little stars looping above the head
function drawJuggling(subframe) {
  const t = subframe * 0.4;
  const g = group();
  [0, 2.1, 4.2].forEach(offset => {
    g.appendChild(circle(CX + Math.cos(t + offset) * 10, HY - 6 + Math.sin(t + offset) * 5, 1.6, '#FFD700'));
  });
  return g;
}

// Blows a few soap bubbles that float up and pop, each on its own staggered cycle
function drawBubbleBlowing(subframe) {
  const g = group();
  const t = subframe % 12;
  [{ dx: 4, delay: 0 }, { dx: 7, delay: 4 }, { dx: 3, delay: 8 }].forEach(b => {
    const age = (t - b.delay + 12) % 12;
    if (age > 8) return; // popped — nothing to draw until this bubble's cycle repeats
    g.appendChild(el('circle', {
      cx: CX + b.dx, cy: HY + 3 - age * 1.8, r: 1 + age * 0.15,
      fill: 'none', stroke: 'currentColor', 'stroke-width': 0.7,
      opacity: String(Math.max(0, 1 - age / 8)),
    }));
  });
  return g;
}

// Workout: two mini dumbbells lifted in sync
function drawWorkout(subframe) {
  const g = group();
  const lift = Math.sin(subframe * 0.6) * 4;
  const lx = CX - 12, rx = CX + 12, wy = HY + 6 - lift;
  g.appendChild(path(`M ${lx-2},${wy-3} L ${lx-2},${wy+3} M ${lx+2},${wy-3} L ${lx+2},${wy+3} M ${lx-2},${wy} L ${lx+2},${wy}`, 1.5));
  g.appendChild(path(`M ${rx-2},${wy-3} L ${rx-2},${wy+3} M ${rx+2},${wy-3} L ${rx+2},${wy+3} M ${rx-2},${wy} L ${rx+2},${wy}`, 1.5));
  return g;
}

// Laptop: screen + base, with a floating "</>" every other beat
function drawLaptop(subframe) {
  const g = group();
  const ly = HY + HH - 1;
  g.appendChild(path(`M ${CX-7},${ly+2} L ${CX+7},${ly+2} L ${CX+6},${ly-5} L ${CX-6},${ly-5} Z`, 1.2));
  g.appendChild(path(`M ${CX-9},${ly+5} L ${CX+9},${ly+5} L ${CX+7},${ly+2} L ${CX-7},${ly+2} Z`, 1.2));
  if (subframe % 4 < 2) {
    const t = el('text', { x: CX - 5, y: ly - 7, 'font-size': '3.5', 'font-family': 'monospace', fill: 'currentColor', opacity: '0.8' });
    t.textContent = '</>';
    g.appendChild(t);
  }
  return g;
}

// Sticky note: holds a yellow note, a checkmark appears partway through
function drawStickyNote(subframe) {
  const g = group();
  const ny = HY + 2;
  g.appendChild(path(`M ${CX-13},${ny} L ${CX-5},${ny} L ${CX-5},${ny+9} L ${CX-13},${ny+9} Z`, 1.2, { fill: '#FFF275' }));
  g.appendChild(path(`M ${CX+6},${ny+8} L ${CX+10},${ny+2}`, 1.2));
  if (subframe % 6 >= 2) {
    g.appendChild(path(`M ${CX-11},${ny+5} L ${CX-9},${ny+7} L ${CX-6},${ny+2}`, 1.4, { stroke: '#2B2D42' }));
  }
  return g;
}

// Magnifying glass held up to one eye — a lens overlay, not a resized eye (drawEyes()
// already runs independently in composeFrame; changing its size just for this one
// move isn't worth threading extra state through it)
function drawMagnifyingGlass() {
  const g = group();
  const rx = CX + 3.5, ey = HY + 7;
  g.appendChild(el('circle', { cx: rx, cy: ey, r: 4.5, fill: 'rgba(255,255,255,0.2)', stroke: 'currentColor', 'stroke-width': '1.2' }));
  g.appendChild(path(`M ${rx+3},${ey+3} L ${rx+7},${ey+7}`, 1.5));
  return g;
}

// Plant watering: a potted succulent gets a drink from a mini watering can
function drawPlantWatering(subframe) {
  const g = group();
  const py = LY + 3;
  g.appendChild(path(`M ${CX+7},${py} L ${CX+12},${py} L ${CX+11},${py+5} L ${CX+8},${py+5} Z`, 1.2, { fill: '#C86D51' }));
  g.appendChild(path(`M ${CX+8},${py-2} Q ${CX+9.5},${py-4} ${CX+9.5},${py}`, 1.2, { stroke: '#2A9D8F' }));
  g.appendChild(path(`M ${CX+11},${py-2} Q ${CX+9.5},${py-4} ${CX+9.5},${py}`, 1.2, { stroke: '#2A9D8F' }));
  g.appendChild(path(`M ${CX-11},${py-4} L ${CX-5},${py-2} L ${CX-6},${py+2} L ${CX-11},${py+2} Z`, 1.2));
  g.appendChild(path(`M ${CX-5},${py-2} L ${CX+2},${py-4}`, 1.0));
  if (subframe % 4 < 2) {
    g.appendChild(circle(CX + 4, py - 2, 0.6, '#87CEEB'));
    g.appendChild(circle(CX + 6, py, 0.6, '#87CEEB'));
  }
  return g;
}

// Paper airplane: folds and glides off across the upper body, looping each cycle
function drawPaperAirplane(subframe) {
  const g = group();
  const flight = (subframe % 10) * 2.5;
  const ax = CX - 12 + flight, ay = HY - 2 - Math.sin(subframe * 0.5) * 3;
  g.appendChild(path(`M ${ax},${ay} L ${ax+6},${ay-2} L ${ax+2},${ay+3} Z`, 1.0));
  g.appendChild(path(`M ${ax+2},${ay-0.5} L ${ax+2},${ay+3}`, 0.8));
  return g;
}

// Wave: one tentacle raised high, wiggling
function drawWave(subframe) {
  const g = group();
  // Raise right outer tentacle into a wave arc
  const wag = Math.sin(subframe * 0.4) * 5;
  // Waving arm: curves up from body side
  g.appendChild(path(
    `M ${CX+9},${HY+8} Q ${CX+16},${HY-2+wag} ${CX+13},${HY-8+wag}`,
    2.0));
  // Little motion lines at the tip
  if (subframe % 4 < 2) {
    g.appendChild(path(`M ${CX+15},${HY-9+wag} L ${CX+18},${HY-11+wag}`, 1.0));
    g.appendChild(path(`M ${CX+14},${HY-6+wag} L ${CX+17},${HY-7+wag}`, 1.0));
  }
  return g;
}

// Stretch + yawn: arms up, mouth open wide, eyes squint
function drawStretch(subframe) {
  const g = group();
  const reach = Math.min(subframe * 0.3, 1.0); // 0→1 over time
  // Both arms stretch up
  g.appendChild(path(
    `M ${CX-9},${HY+5} Q ${CX-15},${HY-4-reach*4} ${CX-11},${HY-10-reach*4}`,
    1.8));
  g.appendChild(path(
    `M ${CX+9},${HY+5} Q ${CX+15},${HY-4-reach*4} ${CX+11},${HY-10-reach*4}`,
    1.8));
  return g;
}

// Yawn mouth (open oval) for stretch state
function drawYawnMouth(subframe) {
  const open = Math.min(subframe * 0.15, 1) * 4;
  // Match the sweet spot here too
  const my = HY + HH - 3; 
  const MOUTH_COLOR = '#C85A80'; 

  if (open < 0.5) return path(`M ${CX-3},${my} Q ${CX},${my+2.5} ${CX+3},${my}`, 1.1, { stroke: MOUTH_COLOR });
  return el('ellipse', { cx: CX, cy: my + open*0.3, rx: 2 + open*0.5, ry: open*0.6,
    fill: '#333', stroke: MOUTH_COLOR, 'stroke-width': 1.2 });
}

// Cat nap: body rotated, curled on floor — Joby lies on his side
function drawCatNap(subframe) {
  const g = group();
  // Curled body — ellipse lying flat
  g.appendChild(el('ellipse', {
    cx: CX, cy: LY + 4, rx: 11, ry: 7,
    fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8
  }));
  // Tail curl on the right
  g.appendChild(path(`M ${CX+11},${LY+4} Q ${CX+17},${LY-2} ${CX+14},${LY-7}`, 1.6));
  // Eyes — sleepy closed curves, now on the side
  g.appendChild(path(`M ${CX-4},${LY+1} Q ${CX-2},${LY+3} ${CX},${LY+1}`, 1.4));
  g.appendChild(path(`M ${CX+1},${LY+1} Q ${CX+3},${LY+3} ${CX+5},${LY+1}`, 1.4));
  // Zzz
  const vis = Math.floor(subframe / 6) % 3 + 1;
  ['z','z','Z'].slice(0, vis).forEach((ch, i) => {
    const t = document.createElementNS(SVG_NS, 'text');
    Object.entries({ x: CX+14+i*4, y: LY-8-i*3,
      'font-size': 3.5+i*1.1, 'font-family': 'Courier New, monospace',
      'font-weight': '700', fill: 'currentColor', opacity: 0.35+i*0.2
    }).forEach(([k,v]) => t.setAttribute(k, v));
    t.textContent = ch;
    g.appendChild(t);
  });
  return g;
}

// Headbang: head offset bobs down/up, hat flies
function headbangOffset(subframe) {
  return Math.sin(subframe * 0.8) * 3;
}

// Shrug: two side tentacles raised, eyes half-closed
function drawShrug(subframe) {
  const g = group();
  const hold = Math.sin(subframe * 0.1) * 1; // slight sway
  g.appendChild(path(
    `M ${CX-9},${HY+8} Q ${CX-15},${HY+2+hold} ${CX-12},${HY-2+hold}`,
    1.8));
  g.appendChild(path(
    `M ${CX+9},${HY+8} Q ${CX+15},${HY+2-hold} ${CX+12},${HY-2-hold}`,
    1.8));
  return g;
}

// Sneeze: body jolts, stars burst
function drawSneeze(subframe) {
  const g = group();
  if (subframe % 8 < 4) {
    // Stars burst around head
    [[-12,-4],[12,-4],[0,-12],[-8,-10],[8,-10]].forEach(([ox,oy], i) => {
      if (i % 2 === subframe % 2)
        g.appendChild(circle(CX+ox, HY+oy, 1.0 + i*0.3));
    });
  }
  // Sneeze spray in front
  const spray = subframe % 6;
  if (spray < 3) {
    g.appendChild(path(`M ${CX+8},${HY+HH-1} L ${CX+13},${HY+HH-3}`, 1.0));
    g.appendChild(path(`M ${CX+8},${HY+HH+1} L ${CX+14},${HY+HH+2}`, 1.0));
    g.appendChild(path(`M ${CX+8},${HY+HH-3} L ${CX+12},${HY+HH-6}`, 1.0));
  }
  return g;
}

// Tiptoe: legs super long and thin, body high up — sneaky walk
function tiptoeLegLen() { return 1.6; } // multiplier fed to speedStretch

// Bat sleep: upside-down, below the green line — hangs from feet
function drawBatSleep(subframe) {
  const g = group();
  // 5 tentacles hanging DOWN from the body (body is flipped, so these go toward screen top)
  // Each tentacle gently sways with independent phase
  const offsets = [-8, -4, 0, 4, 8];
  offsets.forEach((ox, i) => {
    const lx   = CX + ox;
    const seed = LEG_SEEDS[i];
    const sway = Math.sin(subframe * 0.06 * seed.freqJitter + seed.phaseOffset) * 2.5;
    const len  = LLEN * seed.lenJitter * 1.1;
    // Hang downward in local space (positive Y = downward in SVG = upward on screen when flipped)
    g.appendChild(path(
      `M ${lx},${LY} Q ${lx + sway},${LY + len*0.5} ${lx + sway*0.5},${LY + len}`,
      1.6));
  });
  // Zzz drift downward in local space (= upward on screen when flipped)
  const vis = Math.floor(subframe / 8) % 3 + 1;
  ['z','z','Z'].slice(0, vis).forEach((ch, i) => {
    const t = document.createElementNS(SVG_NS, 'text');
    Object.entries({ x: CX+12+i*4, y: LY+6+i*4,
      'font-size': 3.5+i*1.1, 'font-family': 'Courier New, monospace',
      'font-weight': '700', fill: 'currentColor', opacity: 0.3+i*0.2
    }).forEach(([k,v]) => t.setAttribute(k, v));
    t.textContent = ch;
    g.appendChild(t);
  });
  return g;
}

// ── Full frame composer ───────────────────────────────────────────────────────
function composeFrame(mood, hat, frame, walkPhase, isSprinting, dir) {
  const g = group();
  const sf = boredomWalkFrame; // subframe shorthand for special states
  g.setAttribute('color', petFrames > 0 ? getMoodColor('pet') : getMoodColor(mood));

  // ── Cat nap: completely custom layout, body on floor ──────────────────────
  if (boredomMove === 'catNap') {
    g.setAttribute('color', getMoodColor('sleeping'));
    g.appendChild(drawCatNap(sf));
    return g;
  }

  // ── Bat sleep: upside-down below the line — handled in render() for Y flip ─
  if (boredomMove === 'batSleep') {
    g.setAttribute('color', getMoodColor('sleeping'));
    g.appendChild(drawHead());
    g.appendChild(drawEyes('closed'));
    g.appendChild(drawMouth('sleeping'));
    g.appendChild(drawBatSleep(sf));
    return g;
  }

  // ── Headbang: head bobs, hat bounces ──────────────────────────────────────
  if (boredomMove === 'headbang') {
    const bob = headbangOffset(sf);
    g.setAttribute('color', '#FF69B4');
    g.appendChild(drawHat(hat));
    // Offset entire body vertically by bob amount via inner group
    const inner = group();
    inner.setAttribute('transform', `translate(0,${bob})`);
    inner.appendChild(drawHead());
    inner.appendChild(drawEyes('open'));
    inner.appendChild(drawMouth('happy'));
    g.appendChild(inner);
    g.appendChild(drawLegs(walkPhase, 'idle'));
    return g;
  }

  // ── Normal eye/mouth resolution ───────────────────────────────────────────
  const eyeState = mood === 'sleeping'           ? 'closed'
                 : mood === 'worried'            ? 'worried'
                 : mood === 'eating'             ? 'star'
                 : mood === 'focused'            ? 'focused'
                 : boredomMove === 'stretch'     ? 'closed'  // squint during yawn
                 : boredomMove === 'sneeze'      ? 'closed'
                 : 'open';

  const walkMood = boredomMove === 'shrug'         ? 'idle'     // legs stop during shrug
                 : boredomMove === 'sneeze'        ? 'idle'     // legs freeze during sneeze
                 : boredomMove === 'wave'          ? 'idle'     // legs stop while waving
                 : boredomMove === 'stretch'       ? 'idle'     // legs still during stretch
                 : boredomMove === 'readBook'      ? 'idle'     // tentacles busy holding the book
                 : boredomMove === 'juggling'      ? 'idle'     // tentacles busy juggling
                 : boredomMove === 'bubbleBlowing' ? 'idle'     // standing still to blow bubbles
                 : boredomMove === 'workout'       ? 'idle'     // tentacles busy with the dumbbells
                 : boredomMove === 'laptop'          ? 'idle'   // typing, not walking
                 : boredomMove === 'stickyNote'      ? 'idle'   // holding the note steady
                 : boredomMove === 'magnifyingGlass' ? 'idle'   // inspecting, not strolling
                 : boredomMove === 'plantWatering'   ? 'idle'   // tentacles busy with the can
                 : boredomMove === 'paperAirplane'   ? 'idle'   // watching it glide
                 : boredomMove === 'spinAround'      ? 'idle'   // the whole body is spinning instead
                 : boredomMove === 'tiptoe'        ? 'walking'
                 : isSprinting               ? 'sprint'
                 : mood === 'worried'         ? 'worried'
                 : mood === 'party'           ? 'party'
                 : (mood === 'sleeping' || mood === 'hanging') ? 'idle'
                 : 'walking';

  // Hat logic — hidden during hanging, falls off during batSleep
  if (mood !== 'hanging') {
    if (boredomMove === 'batSleep') {
      // Hat falls off and sits upright on the green line while Joby hangs upside-down
      // Since the whole group is scaleY=-1, we counter-flip the hat and shift it
      // to sit at ground level (near LY+LLEN in local coords, which maps to the line)
      const looseHat = drawHat(hat);
      // Counter-flip vertically and nudge it to sit below feet (= at line level when flipped)
      looseHat.setAttribute('transform',
        `translate(${Math.sin(boredomWalkFrame * 0.15) * 3}, ${LY + LLEN + 2}) scale(1,-1)`);
      g.appendChild(looseHat);
    } else {
      g.appendChild(drawHat(mood === 'party' ? 'party' : hat));
    }
  }

  g.appendChild(drawHead());
  g.appendChild(drawEyes(eyeState));

  // Mouth — special cases
  if (boredomMove === 'stretch') g.appendChild(drawYawnMouth(sf));
  else g.appendChild(drawMouth(mood === 'sleeping' ? 'sleeping' : mood === 'worried' ? 'worried' : 'happy'));

  g.appendChild(drawLegs(walkPhase, walkMood));

  // ── Overlay special-state decorations ────────────────────────────────────
  if (mood === 'hanging')              g.appendChild(drawArms());
  if (mood === 'sleeping')             g.appendChild(drawZzz(frame));
  if (mood === 'party')                g.appendChild(drawSparkles(frame));
  if (petFrames > 0)                   g.appendChild(drawHearts(frame));
  if (boredomMove === 'wave')          g.appendChild(drawWave(sf));
  if (boredomMove === 'stretch')       g.appendChild(drawStretch(sf));
  if (boredomMove === 'shrug')         g.appendChild(drawShrug(sf));
  if (boredomMove === 'sneeze')        g.appendChild(drawSneeze(sf));
  if (boredomMove === 'coffeeBreak')   g.appendChild(drawCoffee(sf));
  if (boredomMove === 'readBook')      g.appendChild(drawReadBook(sf));
  if (boredomMove === 'juggling')      g.appendChild(drawJuggling(sf));
  if (boredomMove === 'bubbleBlowing') g.appendChild(drawBubbleBlowing(sf));
  if (boredomMove === 'workout')       g.appendChild(drawWorkout(sf));
  if (boredomMove === 'laptop')          g.appendChild(drawLaptop(sf));
  if (boredomMove === 'stickyNote')      g.appendChild(drawStickyNote(sf));
  if (boredomMove === 'magnifyingGlass') g.appendChild(drawMagnifyingGlass(sf));
  if (boredomMove === 'plantWatering')   g.appendChild(drawPlantWatering(sf));
  if (boredomMove === 'paperAirplane')   g.appendChild(drawPaperAirplane(sf));
  if (isSprinting && currentSpeed >= SPD_SPRINT * 0.8) g.appendChild(drawSpeedLines(dir));

  // Spin: 'spinAround' has been in the idle-move pool since the original build with
  // no visual of its own — picking it just meant Joby kept walking normally. Give it
  // one now: rotate the whole composed body around its own center, one full turn
  // every 12 subframes. Also reachable via a deliberate double-click, not just the
  // random idle picker (see render()).
  if (boredomMove === 'spinAround') {
    const angle = (sf % 12) * 30;
    const pivotY = (HY + LY + LLEN) / 2;
    g.setAttribute('transform', `rotate(${angle} ${CX} ${pivotY})`);
  }

  // Hat poof sparkles during the bald flash frame
  if (hatChanging) {
    const poof = group();
    const t = Date.now() % 300 / 300;
    [[-11,-9],[11,-9],[0,-14],[-7,-13],[7,-13]].forEach(([ox,oy], i) => {
      const r = 0.8 + i * 0.3;
      const drift = t * (3 + i);
      poof.appendChild(circle(CX+ox+drift*0.3, HY+oy-drift, r));
    });
    g.appendChild(poof);
  }

  return g;
}

// ── DOM bootstrap ─────────────────────────────────────────────────────────────
let strip, svgEl, bubbleEl, treatsEl;

// ── Walk zone ──────────────────────────────────────────────────────────────────
let xOffset = 300, maxX = 300;

// ── Core state ─────────────────────────────────────────────────────────────────
let x = 0, dir = 1, frame = 0;
let mood = 'happy';
let excitedFrames = 0, eatingFrames = 0, partyFrames = 0, idleFrames = 0;
let hangPhase = 0, hangFrames = 0;
let treatX = -1;
let petFrames = 0; // counts down while showing the click-to-pet reaction
let digestPending = 0; // open Digest item count, reported by digest.js via tamaSetDigestPending
let lastActivityTime = Date.now();
let bubbleTimer = null;
let hasCelebratedAllClear = false;
let boredomMove = null, boredomFrames = 0, boredomWalkFrame = 0;

// ── rAF timing ─────────────────────────────────────────────────────────────────
let lastTs = null, logicAccum = 0, walkFrameAccum = 0, boredomAccum = 0;
const LOGIC_MS      = 200;
const WALK_FRAME_MS = 130;
const WORRIED_MS    = 70;
const BOREDOM_MS    = 300;
let walkFrame = 0;

// ── Speeds px/s ────────────────────────────────────────────────────────────────
const SPD_NORMAL  = 10;
const SPD_WORRIED = 15;
const SPD_SPRINT  = 40;

const RARE_MOVES = [
  'coffeeBreak',   // sips coffee from a tiny steaming mug
  'wave',          // stops and waves a tentacle at you
  'stretch',       // reaches arms up and yawns
  'spinAround',    // does a little 360 spin
  'catNap',        // curls into a ball on the floor like a cat
  'headbang',      // rocks out, head bobs
  'shrug',         // lifts two tentacles in a shrug ¯\_(ツ)_/¯
  'sneeze',        // body jolts, stars pop
  'tiptoe',        // walks on the very tips of tentacles, slow and sneaky
  'readBook',      // puts on tiny reading glasses, holds an open book
  'juggling',      // juggles three little stars overhead
  'bubbleBlowing', // blows soap bubbles that float up and pop
  'workout',       // lifts two mini dumbbells
  'laptop',           // clacks away on a tiny laptop, code bits float up
  'stickyNote',       // holds a sticky note, draws a checkmark on it
  'magnifyingGlass',  // holds a detective lens up to one eye
  'plantWatering',    // waters a tiny potted succulent
  'paperAirplane',    // folds and launches a paper plane that glides off
];

// Same pool, just weighted by local time of day — no new poses, just different odds.
// coffeeBreak reads as a morning thing; stretch reads as a yawn, so weight it later.
function weightedRareMoves() {
  const hour = new Date().getHours();
  let pool = RARE_MOVES;
  if (hour >= 6 && hour < 11)  pool = pool.concat(['coffeeBreak', 'coffeeBreak']);
  if (hour >= 16 && hour < 20) pool = pool.concat(['stretch', 'stretch']);
  return pool;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function countOverdue() { return window.tasks ? tasks.filter(t => !t.done && isOverdue(t)).length : 0; }
function countPending() { return window.tasks ? tasks.filter(t => !t.done).length : 0; }
function countDone()    { return window.tasks ? tasks.filter(t =>  t.done).length : 0; }

function updateBounds() {
  if (svgEl) svgEl.style.top = window.scrollY + 'px';
  const leftEl  = document.querySelector('.header-left');
  const rightEl = document.querySelector('.header-actions');
  if (leftEl && rightEl) {
    xOffset = leftEl.getBoundingClientRect().right + 16;
    maxX    = Math.max(40, rightEl.getBoundingClientRect().left - 16 - xOffset - 80);
  }
}

// ── Logic tick (200 ms) ────────────────────────────────────────────────────────
function logicTick() {
  frame++;
  x = Math.max(0, Math.min(x, maxX));

  const overdue  = countOverdue();
  const pending  = countPending();
  const allClear = window.tasks && tasks.length > 0 && pending === 0;
  const idleNow  = Date.now() - lastActivityTime > 3 * 60 * 1000;
  const highStreak = window.streak && window.streak.current >= 3;

  if (pending > 0) hasCelebratedAllClear = false;

  if      (petFrames     > 0)                 { mood = 'happy';   petFrames--;     }
  else if (partyFrames   > 0)                 { mood = 'party';   partyFrames--;   }
  else if (excitedFrames > 0)                 { mood = 'excited'; excitedFrames--; }
  else if (eatingFrames  > 0)                 { mood = 'eating';  eatingFrames--;  }
  else if (allClear && !hasCelebratedAllClear){ mood = 'party'; partyFrames = 35; hasCelebratedAllClear = true; }
  else if (allClear)                          { mood = 'happy';   }
  else if (overdue > 0)                       { mood = 'worried'; }
  else if (idleNow && pending > 0)            { mood = 'sleeping';}
  else if (highStreak)                        { mood = 'focused'; }
  else                                        { mood = 'happy';   }

  if (mood !== 'happy' && mood !== 'focused' && boredomMove) {
    boredomMove = null; boredomFrames = 0; boredomWalkFrame = 0;
  }
  if (boredomMove && --boredomFrames <= 0) {
    boredomMove = null; boredomFrames = 0; boredomWalkFrame = 0;
  }

  // Hang phase
  if (hangPhase > 0) {
    if (--hangFrames <= 0) {
      hangPhase = hangPhase === 1 ? 2 : 0;
      hangFrames = hangPhase === 2 ? 22 : 0;
    }
  } else if (frame % 90 === 0 && Math.random() < 0.30 &&
             (mood === 'happy' || mood === 'focused') && treatX < 0 && !boredomMove) {
    hangPhase = 1; hangFrames = 6;
  }

  // Idle / boredom
  if (hangPhase === 0 && treatX < 0 && mood !== 'sleeping' && mood !== 'eating') {
    if (frame % 55 === 0 && Math.random() < 0.25) idleFrames = 14;
    if (idleFrames > 0) idleFrames--;
    else if (frame % 80 === 0 && Math.random() < 0.2) dir *= -1;

    if (!boredomMove && (mood === 'happy' || mood === 'focused') &&
        frame % 75 === 0 && Math.random() < 0.35) {
      // Rare special: bat sleep (5% chance), cat nap (8% chance), else normal
      const roll = Math.random();
      if (roll < 0.05) {
        boredomMove   = 'batSleep';
        boredomFrames = 40;  // ~8s at 200ms ticks
      } else if (roll < 0.13) {
        boredomMove   = 'catNap';
        boredomFrames = 50;  // ~10s
      } else {
        const pool = weightedRareMoves();
        boredomMove = pool[Math.floor(Math.random() * pool.length)];
        boredomFrames = 25;
      }
      boredomWalkFrame = 0;
      boredomAccum     = 0;
    }
  }

  // Digest-awareness: a low-frequency nudge, independent of the boredomMove state
  // machine above (a bubble, not a pose — no new animation asset needed). Only when
  // Joby isn't already mid-reaction to something else.
  if (digestPending > 0 && !boredomMove && hangPhase === 0 && treatX < 0 &&
      (mood === 'happy' || mood === 'focused') &&
      frame % 150 === 0 && Math.random() < 0.15) {
    showBubble('🔔 psst, ' + digestPending + ' waiting in your Digest', 3000);
  }
}

// ── Render ─────────────────────────────────────────────────────────────────────
let jobyG = null; // persistent <g> container — only its contents are replaced each frame

function render() {
  if (!svgEl) return;

  // Create the persistent Joby container once
  if (!jobyG) {
    jobyG = document.createElementNS(SVG_NS, 'g');
    jobyG.setAttribute('id', 'joby-g');
    // svgEl itself is pointer-events:none (full-width overlay — header/tab clicks
    // must pass through it everywhere else); Joby opts back in just for himself so
    // clicking him doesn't also require poking a hole in the header's own click targets.
    jobyG.style.pointerEvents = 'auto';
    jobyG.style.cursor = 'pointer';
    jobyG.addEventListener('click', petJoby);
    // A real double-click fires click, click, dblclick in that order (DOM spec), so
    // petJoby() will have already run once or twice by the time this handler does —
    // harmless (a brief pink flash right before the spin), except for petFrames
    // itself, which we clear here so the spin doesn't render pink-tinted the whole way.
    jobyG.addEventListener('dblclick', e => {
      e.stopPropagation();
      petFrames = 0;
      boredomMove = 'spinAround';
      boredomFrames = 20;
      boredomWalkFrame = 0;
      showBubble('Wheeeee! 🌀', 1800);
    });
    svgEl.appendChild(jobyG);
  }

  // Clear only Joby's container, not the whole SVG
  while (jobyG.firstChild) jobyG.removeChild(jobyG.firstChild);

  // Resolve effective mood for display
  const isSprinting = treatX >= 0;
  const displayMood = hangPhase > 0              ? 'hanging'
                    : boredomMove === 'coffeeBreak' ? 'eating'
                    : mood;

  // Compose Joby frame contents into jobyG
  const frame_g = composeFrame(displayMood, currentHat, frame, walkFrame, isSprinting, dir);

  // Position, scale & mirror — feet anchored to green line
  const px  = Math.round(xOffset + x);
  const hangOffset = hangPhase === 2 ? -20 : hangPhase === 1 ? -10 : 0;
  const breathLift = breathPulse * LLEN * SCALE;
  let ty  = ANCHOR_Y - FEET_Y * SCALE + hangOffset - breathLift;
  let scaleX = dir < 0 ? -SCALE : SCALE;
  let scaleY = SCALE;
  const bounce = (mood === 'excited' || mood === 'worried') && frame % 2 === 0 ? 1 : 0;

  // Bat sleep: flip upside-down — feet hooked to green line, head+body hang below
  // With scaleY=-SCALE, screen_y = ty - localY*SCALE
  // We want feet (localY=LY) to sit at ANCHOR_Y:
  //   ANCHOR_Y = ty - LY*SCALE  →  ty = ANCHOR_Y + LY*SCALE
  if (boredomMove === 'batSleep') {
    scaleY = -SCALE;
    ty = ANCHOR_Y + LY * SCALE;
  }

  // Sneeze: body jolts forward and back
  if (boredomMove === 'sneeze') {
    const jolt = boredomWalkFrame % 6 < 3 ? -3 : 0;
    ty += jolt;
  }

  // Cat nap: body curled on the floor — bottom of ellipse touches green line
  // Ellipse centre is at LY+4 in local coords, radius 7 downward → bottom = LY+11
  if (boredomMove === 'catNap') {
    ty = ANCHOR_Y - (LY + 11) * SCALE;
  }

  jobyG.setAttribute('transform',
    `translate(${px},${ty + bounce}) scale(${scaleX},${scaleY}) translate(${-CX},0)`
  );

  // Invisible click target, generously padded well past Joby's actual bounding box
  // (hat to feet is only 0..36 x -6..36 locally). Needed in the first place because
  // his visible shapes are thin strokes with fill:none, which only hit-test on the
  // stroke line itself — but the real reason for the extra padding here is that
  // he's a small, constantly-walking target; a forgiving hit area costs nothing
  // since it's invisible either way. Recreated every frame along with everything
  // else in jobyG; the one-time click listener above is on jobyG itself, so it
  // doesn't need re-attaching to this.
  const hitArea = el('rect', { x: -14, y: -20, width: 64, height: 76, fill: 'transparent' });
  jobyG.appendChild(hitArea);
  jobyG.appendChild(frame_g);
}

// ── rAF loop ───────────────────────────────────────────────────────────────────
function rafLoop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(ts - lastTs, 50);
  lastTs = ts;

  updateBounds();

  if (hangPhase === 0 && !boredomMove) {
    if (treatX >= 0) {
      const step = SPD_SPRINT * dt / 1000;
      if (Math.abs(treatX - x) <= step + 1) { x = treatX; eatTreat(); }
      else { dir = treatX > x ? 1 : -1; x += dir * step; }
      currentSpeed = SPD_SPRINT;
    } else if (mood !== 'sleeping' && mood !== 'eating' && idleFrames === 0) {
      const spd = mood === 'worried' ? SPD_WORRIED : SPD_NORMAL;
      x += dir * spd * dt / 1000;
      if (x >= maxX) { x = maxX; dir = -1; }
      if (x <= 0)    { x = 0;    dir =  1; }
      currentSpeed = spd;
    } else {
      // Smoothly decay speed to zero when stopped
      currentSpeed = Math.max(0, currentSpeed - dt * 0.35);  // fast decay
    }
  } else {
    currentSpeed = Math.max(0, currentSpeed - dt * 0.35);  // fast decay
  }

  const frameDur = mood === 'worried' ? WORRIED_MS : WALK_FRAME_MS;
  walkFrameAccum += dt;
  if (walkFrameAccum >= frameDur) { walkFrameAccum -= frameDur; walkFrame = (walkFrame + 1) % 6; }

  // ── Skin rotation timer ── (independent of the hat timer below, and of any
  // manual setJobySkin() call — it just picks up the cycle again from wherever)
  skinTimer -= dt;
  if (skinTimer <= 0) {
    currentSkin = pickNewSkin();
    scheduleNextSkin();
  }

  // ── Hat rotation timer ──
  hatTimer -= dt;
  if (hatTimer <= 0) {
    if (!hatChanging) {
      hatChanging = true;
      currentHat = 'bald'; // Flash bald first — poof!
      hatTimer = 150;      // Hold bald for 150ms
    } else {
      hatChanging = false;
      currentHat = pickNewHat();
      scheduleNextHat();   // Set normal long timer
    }
  }

  // ── Advance breath layer 1 (fast oscillation) ──
  const breathRate = 0.0003 + (currentSpeed / 10) * 0.0002;  // ~0.3 Hz at rest
  breathT += dt * breathRate;

  // ── Advance breath layer 2 (slow random envelope) ──
  envTimer -= dt;
  if (envTimer <= 0) newEnvSegment();
  // Smooth lerp toward target
  if (Math.abs(envValue - envTarget) > 0.001) {
    const step = envSpeed * dt;
    envValue += envValue < envTarget ? Math.min(step, envTarget - envValue)
                                     : -Math.min(step, envValue - envTarget);
  } else {
    envValue = envTarget;
  }

  if (boredomMove) {
    boredomAccum += dt;
    if (boredomAccum >= BOREDOM_MS) { boredomAccum -= BOREDOM_MS; boredomWalkFrame++; }
  }

  logicAccum += dt;
  if (logicAccum >= LOGIC_MS) { logicAccum -= LOGIC_MS; logicTick(); }

  render();
  requestAnimationFrame(rafLoop);
}

// ── Treats ─────────────────────────────────────────────────────────────────────
function spawnTreat(clientX) {
  const rel = clientX != null ? clientX - xOffset : Math.random() * maxX;
  treatX = Math.max(0, Math.min(maxX, rel));
  if (!treatsEl) return;
  treatsEl.innerHTML = '';
  const span = document.createElement('span');
  span.className = 'tama-treat';
  span.style.left = (xOffset + treatX) + 'px';
  span.textContent = '★';
  treatsEl.appendChild(span);
}
function eatTreat() {
  treatX = -1;
  if (treatsEl) treatsEl.innerHTML = '';
  currentSpeed = 0;  // stop sprint lines immediately
  eatingFrames = 12; excitedFrames = 8;
}

// ── Petting ────────────────────────────────────────────────────────────────────
// Click/tap on Joby himself (wired up in render(), see the jobyG hit-area below) —
// not a fixed pixel radius from his center, so it tracks his hat/legs bounding box
// exactly as he walks around, without needing to hit-test against every rAF frame.
function petJoby() {
  // Long enough to be unmistakable on a small, constantly-moving character — the
  // original 3.6s/2s was easy to miss entirely if you weren't looking at the exact
  // right moment.
  petFrames = 40; // ~8s at 200ms logic ticks
  lastActivityTime = Date.now();
  boredomMove = null; boredomFrames = 0; boredomWalkFrame = 0;
  hangPhase = 0; hangFrames = 0;
  const quips = ['(◕‿◕) ♡', 'Hehe, soft!', 'Blorp! ♡', 'Back to work now!'];
  showBubble(quips[Math.floor(Math.random() * quips.length)], 4000);
}

// ── Speech bubble ──────────────────────────────────────────────────────────────
function showBubble(text, ms) {
  if (!bubbleEl) return;
  clearTimeout(bubbleTimer);
  bubbleEl.textContent = text;
  // Position bubble above Joby
  const bx = Math.round(xOffset + x);
  const by = ANCHOR_Y - FEET_Y * SCALE - 28;
  bubbleEl.style.left = (bx - 50) + 'px';
  bubbleEl.style.top  = Math.max(2, by) + 'px';
  bubbleEl.style.opacity = '1';
  bubbleTimer = setTimeout(() => { if (bubbleEl) bubbleEl.style.opacity = '0'; }, ms || 3000);
}

const QUIPS = [
  'You got this! 💪', "Let's go! ⚡", 'One task at a time!',
  '(◕‿◕) blorp', 'Stay focused!', 'You can do it!', "Tasks won't do themselves!",
];

function maybeSpeak() {
  if (!window.tasks || Math.random() > 0.4) return;
  const overdue = countOverdue(), done = countDone(), pending = countPending();
  const s = window.streak;
  if (overdue > 0)                                      showBubble(overdue + ' overdue... 😬');
  else if (pending === 0 && done > 0)                   showBubble('✅ All done! Amazing!', 4500);
  else if (done > 0 && Math.random() < 0.35)           showBubble(done + ' done so far! 🎉');
  else if (s && s.current >= 2 && Math.random() < 0.3) showBubble('🔥 ' + s.current + ' day streak!');
  else showBubble(QUIPS[Math.floor(Math.random() * QUIPS.length)]);
}

// ── Public API (identical to tamagoshi.js) ─────────────────────────────────────
window.changeJobyHat = function (hatName) {
  const valid = ['bald','default','topHat','cowboy','crown','beanie'];
  if (valid.includes(hatName)) {
    currentHat = hatName;
    scheduleNextHat(); // reset timer so manual change lasts a while
  }
};

window.tamaTaskDone = function (clientX) {
  lastActivityTime = Date.now();
  boredomMove = null;
  spawnTreat(clientX);
  excitedFrames = 15;
  showBubble('Yummy! ⭐', 2000);
};

// Bulk-completing 2+ tasks at once used to give Joby no reaction at all — this sits
// between a single treat (excitedFrames) and the full all-clear party: reuses the
// existing party-mood sparkle rendering, just for a shorter burst.
window.tamaBulkDone = function (count) {
  lastActivityTime = Date.now();
  boredomMove = null;
  partyFrames = 30;
  showBubble('🎉 Nice, ' + count + ' done!', 2500);
};

window.tamaAllDone = function () {
  lastActivityTime = Date.now();
  boredomMove = null;
  if (digestPending === 0) {
    showBubble('🎉🐙 Tasks AND Digest clear! Amazing!', 6000);
    partyFrames = 90;
  } else {
    showBubble('🎉 ALL DONE! Amazing! 🎉', 5000);
    partyFrames = 60;
  }
};

window.tamaSetDigestPending = function (count) {
  digestPending = count || 0;
};

window.applyTamagoshiSetting = function () {
  if (!svgEl) return;
  const enabled = typeof settings !== 'undefined' && settings.tamagoshiEnabled === true;
  svgEl.style.display = enabled ? '' : 'none';
  const cb = document.getElementById('s-tamagoshi-enabled');
  if (cb) cb.checked = enabled;
};

window.toggleTamagoshi = function (enabled) {
  if (typeof settings !== 'undefined') settings.tamagoshiEnabled = enabled;
  if (svgEl) svgEl.style.display = enabled ? '' : 'none';
  const cb = document.getElementById('s-tamagoshi-enabled');
  if (cb) cb.checked = enabled;
  if (typeof debouncedSave === 'function') debouncedSave();
};

// ── Boot ───────────────────────────────────────────────────────────────────────
let _initialized = false;

function init() {
  if (_initialized) return;  // guard: never run twice
  _initialized = true;

  // Hide ASCII strip — SVG owns rendering
  strip = document.getElementById('tama-strip');
  if (strip) strip.style.display = 'none';

  // Reuse existing SVG if somehow already in DOM (e.g. hot reload)
  svgEl = document.getElementById('tama-svg');
  if (!svgEl) {
    svgEl = document.createElementNS(SVG_NS, 'svg');
    svgEl.setAttribute('id', 'tama-svg');
    svgEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:160px;pointer-events:none;overflow:visible;z-index:50;';
    document.body.appendChild(svgEl);
  }

  // Reuse or create bubble
  bubbleEl = document.getElementById('tama-bubble-svg');
  if (!bubbleEl) {
    bubbleEl = document.createElement('div');
    bubbleEl.id = 'tama-bubble-svg';
    bubbleEl.style.cssText = 'position:fixed;background:#fff;border:1px solid #ddd;border-radius:10px;padding:3px 10px;font-size:11px;white-space:nowrap;color:#333;opacity:0;transition:opacity 0.3s ease;pointer-events:none;z-index:60;box-shadow:0 2px 6px rgba(0,0,0,0.12);';
    document.body.appendChild(bubbleEl);
  }

  // Reuse or create treats
  treatsEl = document.getElementById('tama-treats-svg');
  if (!treatsEl) {
    treatsEl = document.createElement('div');
    treatsEl.id = 'tama-treats-svg';
    treatsEl.style.cssText = 'position:fixed;top:18px;left:0;right:0;height:40px;pointer-events:none;z-index:51;';
    document.body.appendChild(treatsEl);
  }

  updateBounds();
  x = Math.floor(maxX / 2);
  lastActivityTime = Date.now();
  window.addEventListener('resize', updateBounds);
  setInterval(maybeSpeak, 9000);
  requestAnimationFrame(rafLoop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 0);
}

})();
