// tamagoshi.js — Joby the octopus, walking across the header + tabs bar

(function () {

// ── Hat Configuration ────────────────────────────────────────────────────────
let currentHat = 'topHat'; // Options: 'bald', 'default', 'topHat', 'cowboy', 'crown', 'beanie'

const HATS = {
  bald:    '             ', // Clear space for a smooth natural look
  default: '  ╭───╮      ', // Rounded cap — sits flush over (◕‿◕)
  topHat:  '  ┌────┐      ', // Flat-top hat
  cowboy:  ' ╭|-|╮     ', // Wide brim extends one col each side of face
  crown:   ' /\\/\\/\\    ', // Crown peaks over face width
  beanie:  '  ╭╳╳╮      ', // Knit beanie flush over face
};

// ── Sprites ───────────────────────────────────────────────────────────────────
// Cleaned strings: Strict monospace columns with zero layout-breaking inline emojis!
const S = {

  // ── Static/State sprites ───────────────────────────────────────────────────
  idle:      ['  (◕‿◕)      ', ' _//|\\\\_     '],
  blink:     ['  (-‿-)      ', ' _//|\\\\_     '],
  eat:       ['  (★ч★)      ', ' _//|\\\\_     '],
  party:     [' ヽ(°▽°)ﾉ     ', '  _//|\\\\_    '],
  party2:    [' ヽ(°▽°)ﾉ     ', '  _///\\\\_    '],
  sleepy:    ['   (-.-) Zzz ', '  _//|\\\\_     '],
  sleepy2:   ['   (-.-) Zz  ', '  _//|\\\\_     '],

  // ── Expressive Extra Frames ────────────────────────────────────────────────
  cuteIdle:  ['  ( ⊙ ‿ ⊙ )  ', ' _//|\\\\_     '],
  cuteBlink: ['  ( 𐩒 ‿ 𐩒 )  ', ' _//|\\\\_     '],
  focused:   ['  ( > ‿ < )  ', ' _//|\\\\_     '], 

  // ── Rounded Hanging Cycle ──────────────────────────────────────────────────
  reach:     ['  _//|||\\\\_  ', '  ( ◕‿◕ )    '], 
  hang:      ['  _|||||||_  ', '  ( ◡‿◡ )    '], 
  hang2:     ['   _||||||_  ', '   ( ◡‿◡ )   '], 

  // ── 4-frame animated sprint ────────────────────────────────────────────────
  sprint_r: [
    ['~~(◕‿◕)      ', '  _///\\\\_    '],
    ['~~(◕‿◕)      ', '   //|/\\_    '],
    ['~~(◕‿◕)      ', '   ////\\\\    '],
    ['~~(◕‿◕)      ', '  _///||_    ']
  ],
  sprint_l: [
    ['  (◕‿◕)~~    ', '  _//\\\\\\_    '],
    ['  (◕‿◕)~~    ', '   _/\\|\\\\    '],
    ['  (◕‿◕)~~    ', '   \\\\\\\\//    '],
    ['  (◕‿◕)~~    ', '   _||\\\\\\_   ']
  ],

  // ── 6-frame walk right ─────────────────────────────────────────────────────
  walk_r: [
    ['  (◕‿◕)      ', ' _/|/|\\_     '],
    ['  (◕‿◕)      ', '  //|/\\_     '],
    ['  (◕‿◕)      ', '  //||\\\\     '], 
    ['  (◕‿◕)      ', ' _/||//\\\\    '],
    ['  (◕‿◕)      ', ' _/|//\\_     '],
    ['  (◕‿◕)      ', ' _//||\\_     '],
  ],

  // ── 6-frame walk left ──────────────────────────────────────────────────────
  walk_l: [
    ['  (◕‿◕)      ', ' _/|\\|\\_     '],
    ['  (◕‿◕)      ', ' _/\\|\\\\      '],
    ['  (◕‿◕)      ', ' ////||      '],
    ['  (◕‿◕)      ', ' /\\//||_     '],
    ['  (◕‿◕)      ', ' _/\\|\\_      '],
    ['  (◕‿◕)      ', ' _/||//_     '],
  ],

  // ── 6-frame worried pace ───────────────────────────────────────────────────
  worried: [
    ['  (>_<)      ', ' _/|/|\\_     '],
    ['  (>_<)      ', '  //|/\\_     '],
    ['  (>_<)      ', '  //||\\\\     '],
    ['  (>_<)      ', ' _/||//\\\\    '],
    ['  (>_<)      ', ' _/|//\\_     '],
    ['  (>_<)      ', ' _//||\\_     '],
  ],

  // ── Rare boredom moves ─────────────────────────────────────────────────────
  workingHard: [
    ['  (◕_◕)      ', ' _/|/|\\_     '],
    ['  (◕_◕)      ', ' _/|\\|\\_     '],
  ],
  breakdance: [
    ['  (◕‿◕)      ', ' _/||\\\\_     '],
    ['◝(◕‿◕)◜      ', '   //|\\\\     '],
    ['   |||||     ', '  ( ◕‿◕ )    '],
    ['◝(◕‿◕ )◜     ', '  ////       '],
  ],
  coffeeBreak: [
    ['  (◕‿◕)      ', ' _//|\\\\_     '],
    ['  (◕ч◕)      ', ' _//|\\\\_     '],
  ],
  peekABoo: [
    ['  (•_•)      ', ' _/||\\\\_     '], 
    ['  _(._.)_    ', '  ///\\\\      '], 
    ['   (°_°)     ', '             '], 
    ['  ٩(⊙▽⊙)۶    ', '  _///\\\\_    '], 
  ],
};

const QUIPS = [
  'You got this! 💪',
  "Let's go! ⚡",
  'One task at a time!',
  '(◕‿◕) blorp',
  'Stay focused!',
  'You can do it!',
  "Tasks won't do themselves!",
];

const RARE_MOVES = ['coffeeBreak', 'breakdance', 'workingHard', 'peekABoo'];

// ── DOM Elements ─────────────────────────────────────────────────────────────
let strip, bodyEl, line0El, line1El, line2El, bubbleEl, treatsEl;

// ── Walk zone ─────────────────────────────────────────────────────────────────
let xOffset = 300, maxX = 300;

// ── Core state ────────────────────────────────────────────────────────────────
let x = 0, dir = 1, frame = 0;
let mood = 'happy';
let excitedFrames = 0, eatingFrames = 0, partyFrames = 0, idleFrames = 0;
let hangPhase = 0, hangFrames = 0;
let treatX = -1;
let lastActivityTime = Date.now();
let bubbleTimer = null;

// ── Boredom & Effect State ────────────────────────────────────────────────────
let hasCelebratedAllClear = false;  
let boredomMove   = null;  
let boredomFrames = 0;     
let boredomWalkFrame = 0;  
let currentActiveEffect = ''; 

// ── rAF timing ────────────────────────────────────────────────────────────────
let lastTs = null, logicAccum = 0, walkFrameAccum = 0;
const LOGIC_MS         = 200;
const WALK_FRAME_MS    = 130;
const WORRIED_FRAME_MS = 70;
const BOREDOM_FRAME_MS = 300;  

let walkFrame     = 0;
let boredomAccum  = 0;
const WALK_FRAMES = 6;

// ── Walk speeds (px / second) ─────────────────────────────────────────────────
const SPD_NORMAL  = 10;
const SPD_WORRIED = 15;
const SPD_SPRINT  = 40;

// ── Task data helpers ─────────────────────────────────────────────────────────
function countOverdue() { return window.tasks ? tasks.filter(t => !t.done && isOverdue(t)).length : 0; }
function countPending() { return window.tasks ? tasks.filter(t => !t.done).length : 0; }
function countDone()    { return window.tasks ? tasks.filter(t => t.done).length : 0; }

// ── Bounds Calculation ────────────────────────────────────────────────────────
function updateBounds() {
  const leftEl  = document.querySelector('.header-left');
  const rightEl = document.querySelector('.header-actions');
  if (leftEl && rightEl) {
    const leftEnd    = leftEl.getBoundingClientRect().right  + 16;
    const rightStart = rightEl.getBoundingClientRect().left  - 16;
    xOffset = leftEnd;
    maxX    = Math.max(40, rightStart - leftEnd - 80);
  }
}

// ── Logic tick (200 ms) ───────────────────────────────────────────────────────
function logicTick() {
  frame++;
  x = Math.max(0, Math.min(x, maxX));

  const overdue  = countOverdue();
  const pending  = countPending();
  const allClear = window.tasks && tasks.length > 0 && pending === 0;
  const idleNow  = Date.now() - lastActivityTime > 3 * 60 * 1000;
  const highStreak = window.streak && window.streak.current >= 3;

  if (pending > 0) hasCelebratedAllClear = false;

  // Mood resolution
  if      (partyFrames   > 0)                      { mood = 'party';   partyFrames--;   }
  else if (excitedFrames > 0)                      { mood = 'excited'; excitedFrames--; }
  else if (eatingFrames  > 0)                      { mood = 'eating';  eatingFrames--;  }
  else if (allClear && !hasCelebratedAllClear)      { mood = 'party';   partyFrames = 35; hasCelebratedAllClear = true; }
  else if (allClear)                               { mood = 'happy';   }   
  else if (overdue > 0)                            { mood = 'worried'; }
  else if (idleNow && pending > 0)                 { mood = 'sleeping'; }
  else if (highStreak)                             { mood = 'focused'; }
  else                                             { mood = 'happy';   }

  if (mood !== 'happy' && mood !== 'focused' && boredomMove) {
    boredomMove = null; boredomFrames = 0; boredomWalkFrame = 0;
  }

  if (boredomMove) {
    boredomFrames--;
    if (boredomFrames <= 0) {
      boredomMove = null; boredomFrames = 0; boredomWalkFrame = 0;
    }
  }

  // Hang phase management
  if (hangPhase > 0) {
    hangFrames--;
    if (hangFrames <= 0) {
      if (hangPhase === 1) { hangPhase = 2; hangFrames = 22; }
      else                 { hangPhase = 0; }
    }
  } else if (
    frame % 90 === 0 && Math.random() < 0.30 &&       
    (mood === 'happy' || mood === 'focused') && treatX < 0 && !boredomMove    
  ) {
    hangPhase = 1; hangFrames = 6;
  }

  // Idle / direction flip
  if (hangPhase === 0 && treatX < 0 && mood !== 'sleeping' && mood !== 'eating') {
    if (frame % 55 === 0 && Math.random() < 0.25) idleFrames = 14;
    if (idleFrames > 0) {
      idleFrames--;
    } else {
      if (frame % 80 === 0 && Math.random() < 0.2) dir *= -1;
    }

    // Rare boredom trigger
    if (
      !boredomMove && hangPhase === 0 && (mood === 'happy' || mood === 'focused') &&
      frame % 75 === 0 && Math.random() < 0.35        
    ) {
      boredomMove      = RARE_MOVES[Math.floor(Math.random() * RARE_MOVES.length)];
      boredomFrames    = 25;  
      boredomWalkFrame = 0;
      boredomAccum     = 0;
    }
  }
}

// ── Hat line (row above the face) ────────────────────────────────────────────
function hatLine() {
  if (hangPhase > 0) return '';                                  
  if (boredomMove === 'breakdance' && boredomWalkFrame % 4 >= 1) return ''; 
  if (boredomMove === 'peekABoo'   && (boredomWalkFrame % 4) === 2) return ''; 
  
  // FIXED: Aligned to sit over face parens at cols 2–7 of '  (◕‿◕)      '
  if (mood === 'party') return frame % 2 === 0 ? '  ^*.*^      ' : '  *^.^*      ';
  if (mood === 'sleeping') return '  ____~      ';
  
  return HATS[currentHat] || HATS.default;
}

// ── Sprite selection ──────────────────────────────────────────────────────────
function sprite() {
  if (hangPhase === 1) return S.reach;
  if (hangPhase === 2) return frame % 4 < 2 ? S.hang : S.hang2;

  if (boredomMove) return S[boredomMove][boredomWalkFrame % S[boredomMove].length];

  switch (mood) {
    case 'eating':   return S.eat;
    case 'party':    return frame % 2 === 0 ? S.party   : S.party2;
    case 'worried':  return S.worried[walkFrame];
    case 'sleeping': return frame % 10 < 5  ? S.sleepy  : S.sleepy2;
    case 'focused':  return S.focused;
    default:
      if (treatX >= 0) return (dir > 0 ? S.sprint_r : S.sprint_l)[walkFrame % S.sprint_r.length];
      if (idleFrames > 0) {
        if (frame % 20 < 4) return S.blink;
        if (frame % 50 > 35) return (frame % 12 === 0 ? S.cuteBlink : S.cuteIdle);
        return S.idle;
      }
      return (dir > 0 ? S.walk_r : S.walk_l)[walkFrame];
  }
}

// ── Render Pipeline ───────────────────────────────────────────────────────────
function formatEyes(textString) {
  if (!textString || typeof textString !== 'string') return ''; 
  let escaped = textString
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/([◕•°⊙𐩒★◡]|&lt;|&gt;)/g, '<span class="joby-eye">$1</span>');
}

function render() {
  if (!bodyEl) return;
  const [s1, s2] = sprite();
  if (line0El) {
    const hat = hatLine();
    line0El.textContent = hat || HATS[currentHat] || HATS.default; // keep text for layout
    line0El.style.visibility = hat ? 'visible' : 'hidden';          // Fix 3: no layout shift
  }
  line1El.innerHTML = formatEyes(s1);           
  line2El.innerHTML = formatEyes(s2);           

  bodyEl.style.left = Math.round(xOffset + x) + 'px';

  // Physical Direction Mirroring Lookups
  if (dir < 0 && hangPhase === 0 && mood !== 'sleeping') {
    bodyEl.style.transform = 'scaleX(-1)';
    if (line0El) line0El.style.transform = 'scaleX(-1)'; // Fix 2: counter-mirror the hat
  } else {
    bodyEl.style.transform = 'scaleX(1)';
    if (line0El) line0El.style.transform = 'scaleX(1)';
  }

  // Color Mapping Assignments
  const cls =
    hangPhase > 0       ? 'joby-hanging'  :
    mood === 'party'    ? 'joby-rainbow'  :
    mood === 'excited'  ? 'joby-excited'  :
    mood === 'eating'   ? 'joby-eating'   :
    mood === 'worried'  ? 'joby-worried'  :
    mood === 'sleeping' ? 'joby-sleeping' :
    mood === 'focused'  ? 'joby-focused'   :
    boredomMove         ? 'joby-boredom'  :
    'joby-happy';
  if (bodyEl.className !== cls) bodyEl.className = cls;

  // Vertical placement tracking logic
  const isPeekHide = boredomMove === 'peekABoo' && (boredomWalkFrame % 4) === 2;
  let targetTop = 4;
  if (hangPhase === 2)      targetTop = 42;
  else if (hangPhase === 1) targetTop = 24;
  else if (isPeekHide)      targetTop = 40;
  
  bodyEl.style.top = targetTop + 'px';

  // Secondary structural kinetics
  let ty = 0;
  if (mood === 'excited' && frame % 2 === 0) ty = -4;
  if (mood === 'worried'  && frame % 2 === 0) ty = 1;
  if (ty !== 0) {
    bodyEl.style.transform += ' translateY(' + ty + 'px)';
  }

  // State-Aware Floating Emoji Engine
  if (treatsEl && treatX < 0) { 
    let targetEffect = '';

    if      (mood === 'eating')  targetEffect = 'eating';
    else if (mood === 'party')   targetEffect = 'party';
    else if (mood === 'worried') targetEffect = 'worried';
    else if (boredomMove === 'coffeeBreak') targetEffect = 'coffee';
    else if (boredomMove === 'workingHard') targetEffect = 'work';
    else if (boredomMove === 'peekABoo' && (boredomWalkFrame % 4) === 3) targetEffect = 'peek';

    if (targetEffect !== currentActiveEffect) {
      currentActiveEffect = targetEffect;
      
      let effectHtml = '';
      if      (targetEffect === 'eating')  effectHtml = `<span class="joby-floating-effect joby-bounce">✨</span>`;
      else if (targetEffect === 'party')   effectHtml = `<span class="joby-floating-effect joby-pop">🎉</span>`;
      else if (targetEffect === 'worried') effectHtml = `<span class="joby-floating-effect joby-sweat">💦</span>`;
      else if (targetEffect === 'coffee')  effectHtml = `<span class="joby-floating-effect joby-steam">☕</span>`;
      else if (targetEffect === 'work')    effectHtml = `<span class="joby-floating-effect joby-pulse">💻</span>`;
      else if (targetEffect === 'peek')    effectHtml = `<span class="joby-floating-effect joby-pop">✨</span>`;

      if (effectHtml) {
        treatsEl.innerHTML = `<div id="joby-effect-wrapper">${effectHtml}</div>`;
      } else {
        if (!document.querySelector('.tama-treat')) treatsEl.innerHTML = '';
      }
    }

    const wrapper = document.getElementById('joby-effect-wrapper');
    if (wrapper) {
      const alignmentX = dir < 0 ? -12 : 72; 
      wrapper.style.position = 'absolute';
      wrapper.style.left = Math.round(xOffset + x + alignmentX) + 'px';
      wrapper.style.top = (targetTop - 12) + 'px';
    }
  } else {
    currentActiveEffect = '';
  }
}

// ── Main rAF loop ─────────────────────────────────────────────────────────────
function rafLoop(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = Math.min(ts - lastTs, 50);
  lastTs = ts;

  updateBounds();

  if (hangPhase === 0 && !boredomMove) {
    if (treatX >= 0) {
      const step = SPD_SPRINT * dt / 1000;
      if (Math.abs(treatX - x) <= step + 1) {
        x = treatX;
        eatTreat();
      } else {
        dir = treatX > x ? 1 : -1;
        x += dir * step;
      }
    } else if (mood !== 'sleeping' && mood !== 'eating' && idleFrames === 0) {
      const spd = mood === 'worried' ? SPD_WORRIED : SPD_NORMAL;
      x += dir * spd * dt / 1000;
      if (x >= maxX) { x = maxX; dir = -1; }
      if (x <= 0)    { x = 0;    dir =  1; }
    }
  }

  const frameDur = mood === 'worried' ? WORRIED_FRAME_MS : WALK_FRAME_MS;
  walkFrameAccum += dt;
  if (walkFrameAccum >= frameDur) {
    walkFrameAccum -= frameDur;
    walkFrame = (walkFrame + 1) % WALK_FRAMES;
  }

  if (boredomMove) {
    boredomAccum += dt;
    if (boredomAccum >= BOREDOM_FRAME_MS) {
      boredomAccum -= BOREDOM_FRAME_MS;
      boredomWalkFrame++;
    }
  }

  logicAccum += dt;
  if (logicAccum >= LOGIC_MS) {
    logicAccum -= LOGIC_MS;
    logicTick();
  }

  render();
  requestAnimationFrame(rafLoop);
}

// ── Treats Mechanics ──────────────────────────────────────────────────────────
function spawnTreat(clientX) {
  const rel = clientX != null ? clientX - xOffset : Math.random() * maxX;
  treatX = Math.max(0, Math.min(maxX, rel));
  if (!treatsEl) return;
  treatsEl.innerHTML = '';
  const span = document.createElement('span');
  span.className  = 'tama-treat';
  span.style.left = (xOffset + treatX) + 'px';
  span.textContent = '★';
  treatsEl.appendChild(span);
}

function eatTreat() {
  treatX = -1;
  if (treatsEl) treatsEl.innerHTML = '';
  eatingFrames  = 12;
  excitedFrames = 8;
}

// ── Speech bubble ─────────────────────────────────────────────────────────────
function showBubble(text, ms) {
  if (!bubbleEl) return;
  clearTimeout(bubbleTimer);
  bubbleEl.textContent = text;
  bubbleEl.classList.add('visible');
  bubbleTimer = setTimeout(() => bubbleEl.classList.remove('visible'), ms || 3000);
}

// Allows your main application interface to change Joby's outfit
window.changeJobyHat = function (hatName) {
  if (HATS[hatName] !== undefined) {
    currentHat = hatName;
  }
};

function maybeSpeak() {
  if (!window.tasks || Math.random() > 0.4) return;
  const overdue = countOverdue();
  const done    = countDone();
  const pending = countPending();
  const s       = window.streak;

  if (overdue > 0)                                      showBubble(overdue + ' overdue... 😬');
  else if (pending === 0 && done > 0)                   showBubble('✅ All done! Amazing!', 4500);
  else if (done > 0 && Math.random() < 0.35)           showBubble(done + ' done so far! 🎉');
  else if (s && s.current >= 2 && Math.random() < 0.3) showBubble('🔥 ' + s.current + ' day streak!');
  else showBubble(QUIPS[Math.floor(Math.random() * QUIPS.length)]);
}

// ── Public API Hooks ──────────────────────────────────────────────────────────
window.tamaTaskDone = function (clientX) {
  lastActivityTime = Date.now();
  boredomMove = null;  
  spawnTreat(clientX);
  excitedFrames = 15;
  showBubble('Yummy! ⭐', 2000);
};

// ── Public API Hooks ──────────────────────────────────────────────────────────
window.tamaAllDone = function () {
  lastActivityTime = Date.now();
  boredomMove = null;
  showBubble('🎉 ALL DONE! Amazing! 🎉', 5000);
  partyFrames = 60;
};

window.applyTamagoshiSetting = function () {
  if (!strip) return;
  const enabled = typeof settings !== 'undefined' && settings.tamagoshiEnabled === true;
  strip.style.display = enabled ? '' : 'none';
  const cb = document.getElementById('s-tamagoshi-enabled');
  if (cb) cb.checked = enabled;
};

window.toggleTamagoshi = function (enabled) {
  if (typeof settings !== 'undefined') settings.tamagoshiEnabled = enabled;
  if (strip) strip.style.display = enabled ? '' : 'none';
  const cb = document.getElementById('s-tamagoshi-enabled');
  if (cb) cb.checked = enabled;
  if (typeof debouncedSave === 'function') debouncedSave();
};

// ── Boot sequence ─────────────────────────────────────────────────────────────
function init() {
  strip    = document.getElementById('tama-strip');
  bodyEl   = document.getElementById('tama-body');
  line0El  = document.getElementById('tama-line0');
  line1El  = document.getElementById('tama-line1'); // FIXED: Mapped securely to line1 element
  line2El  = document.getElementById('tama-line2');
  bubbleEl = document.getElementById('tama-bubble');
  treatsEl = document.getElementById('tama-treats');
  if (!strip) return;

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