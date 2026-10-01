// public/js/logs.js
// ---------------------------------------------------------------------------
// /logs — the server's log, live (routes/logs.js streams it over SSE).
//
//   - filter by lowest level, by source ([scope]) and by text
//   - click a row with extra fields (an error's stack, a payload…) to open it
//   - follows the bottom while you are there; scroll up and it holds still
//   - PAUSE holds new entries back; CLEAR empties the view (the server keeps them)
// ---------------------------------------------------------------------------

const MAX_ENTRIES = 5000;                    // kept in the page, oldest dropped first
const LEVEL_RANK  = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };
const BASE_KEYS   = new Set(['time', 'level', 'scope', 'msg', 'pid', 'hostname']);
const NEAR_BOTTOM_PX = 40;

const $ = id => document.getElementById(id);
const els = {
  list: $('list'), empty: $('empty'), jump: $('jumpBtn'),
  status: $('status'), statusText: $('statusText'),
  countError: $('countError'), countWarn: $('countWarn'),
  levelSeg: $('levelSeg'), scope: $('scopeFilter'), search: $('search'),
  pause: $('pauseBtn'), clear: $('clearBtn'), serverLevel: $('serverLevel'),
};

const state = {
  entries:   [],
  scopes:    new Set(),
  minLevel:  readStored('cmop-logs-level') || 'info',
  scope:     '',
  text:      '',
  paused:    false,
  held:      0,      // entries that arrived while paused
  unseen:    0,      // entries rendered below the viewport while scrolled up
  clearedAt: 0,      // entries up to this time stay hidden after CLEAR
};

// ---------------------------------------------------------------------------
// Storage (per-viewer convenience only; the page works without it)
// ---------------------------------------------------------------------------
function readStored(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function store(key, value) {
  try { localStorage.setItem(key, value); } catch (_) { /* private window */ }
}

// ---------------------------------------------------------------------------
// One entry → one row
// ---------------------------------------------------------------------------
function formatTime(ms) {
  const d = new Date(ms);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/** The fields beyond time · level · scope · msg, as readable text, or '' when there are none. */
function formatFields(entry) {
  const parts = [];
  for (const [key, value] of Object.entries(entry)) {
    if (BASE_KEYS.has(key)) continue;
    if (key === 'err' && value && value.stack) {
      parts.push(value.stack);
      const { type, message, stack, ...rest } = value;
      if (Object.keys(rest).length) parts.push(`err: ${JSON.stringify(rest, null, 2)}`);
    } else {
      parts.push(`${key}: ${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`);
    }
  }
  return parts.join('\n');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderRow(entry) {
  const row = el('div', `row lvl-${entry.level}`);
  row.append(
    el('time', null, formatTime(entry.time)),
    el('span', 'lvl', entry.level.toUpperCase()),
    el('span', 'scope', entry.scope || ''),
    el('span', 'msg', entry.msg ?? ''),
  );
  row.lastChild.title = entry.scope || '';
  if (entry._fields) {
    row.classList.add('has-fields');
    row.classList.toggle('open', !!entry._open);
    row.append(el('pre', 'fields', entry._fields));
    row.addEventListener('click', (event) => {
      if (event.target.closest('.fields')) return;   // let text in the details be selected
      entry._open = !entry._open;
      row.classList.toggle('open', entry._open);
    });
  }
  return row;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------
function matches(entry) {
  if (entry.time <= state.clearedAt) return false;
  if ((LEVEL_RANK[entry.level] ?? 0) < LEVEL_RANK[state.minLevel]) return false;
  if (state.scope && entry.scope !== state.scope) return false;
  if (state.text && !entry._haystack.includes(state.text)) return false;
  return true;
}

function prepare(entry) {
  entry._fields   = formatFields(entry);
  entry._haystack = `${entry.scope || ''} ${entry.msg || ''} ${entry._fields}`.toLowerCase();
  return entry;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function isNearBottom() {
  const l = els.list;
  return l.scrollHeight - l.scrollTop - l.clientHeight < NEAR_BOTTOM_PX;
}

function scrollToBottom() {
  els.list.scrollTop = els.list.scrollHeight;
  state.unseen = 0;
  updateJump();
}

function renderAll() {
  const fragment = document.createDocumentFragment();
  for (const entry of state.entries) if (matches(entry)) fragment.append(renderRow(entry));
  els.list.replaceChildren(fragment);
  scrollToBottom();
  updateEmpty();
}

function appendEntry(entry) {
  if (!matches(entry)) return;
  const follow = isNearBottom();
  els.list.append(renderRow(entry));
  if (els.list.childElementCount > MAX_ENTRIES) els.list.firstElementChild.remove();
  if (follow) scrollToBottom();
  else { state.unseen++; updateJump(); }
  updateEmpty();
}

function updateEmpty() {
  const visible = els.list.childElementCount > 0;
  els.empty.hidden = visible;
  if (!visible) {
    els.empty.textContent = state.entries.length
      ? 'No entries match the filters.'
      : 'Waiting for log entries…';
  }
}

function updateJump() {
  els.jump.hidden = state.unseen === 0;
  els.jump.textContent = `↓ ${state.unseen} NEW`;
}

function updateCounts() {
  let errors = 0, warnings = 0;
  for (const e of state.entries) {
    if (e.time <= state.clearedAt) continue;
    if (e.level === 'error' || e.level === 'fatal') errors++;
    else if (e.level === 'warn') warnings++;
  }
  els.countError.textContent = `${errors} ERR`;
  els.countWarn.textContent  = `${warnings} WARN`;
  els.countError.classList.toggle('has', errors > 0);
  els.countWarn.classList.toggle('has', warnings > 0);
}

function addScope(scope) {
  if (!scope || state.scopes.has(scope)) return;
  state.scopes.add(scope);
  const options = [...state.scopes].sort().map(s => new Option(s, s));
  els.scope.replaceChildren(new Option('ALL SOURCES', ''), ...options);
  els.scope.value = state.scope;
}

function updatePauseButton() {
  els.pause.setAttribute('aria-pressed', String(state.paused));
  els.pause.textContent = state.paused
    ? (state.held ? `RESUME (${state.held})` : 'RESUME')
    : 'PAUSE';
}

// ---------------------------------------------------------------------------
// Incoming entries
// ---------------------------------------------------------------------------
function keep(entry) {
  state.entries.push(prepare(entry));
  if (state.entries.length > MAX_ENTRIES) state.entries.shift();
  addScope(entry.scope);
}

function onEntry(entry) {
  keep(entry);
  updateCounts();
  if (state.paused) { state.held++; updatePauseButton(); return; }
  appendEntry(entry);
}

/** A (re)connection sends the server's whole buffer: it replaces what the page holds. */
function onBacklog(entries, serverLevel) {
  state.entries = [];
  entries.forEach(keep);
  state.held = 0;
  showServerLevel(serverLevel);
  updateCounts();
  updatePauseButton();
  renderAll();
}

/** Levels below the server's LOG_LEVEL are never sent, so their button would show nothing. */
function showServerLevel(serverLevel) {
  const floor = LEVEL_RANK[serverLevel] ?? LEVEL_RANK.debug;
  els.levelSeg.querySelectorAll('button').forEach(btn => {
    const below = LEVEL_RANK[btn.dataset.level] < floor;
    btn.disabled = below;
    btn.title = below ? `The server logs from ${serverLevel.toUpperCase()} up: restart it with LOG_LEVEL=${btn.dataset.level}` : '';
  });
  els.serverLevel.textContent = serverLevel ? `server level: ${serverLevel}` : '';
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------
function setStatus(stateName, text) {
  els.status.dataset.state = stateName;
  els.statusText.textContent = text;
}

function connect() {
  const source = new EventSource('/api/logs/stream');
  source.onopen = () => setStatus('live', 'LIVE');
  source.onerror = () => setStatus('reconnecting', 'RECONNECTING');   // EventSource retries by itself
  source.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch (_) { return; }
    if (msg.type === 'backlog') onBacklog(msg.entries || [], msg.level);
    else if (msg.type === 'entry') onEntry(msg.entry);
  };
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
function setMinLevel(level) {
  state.minLevel = level;
  store('cmop-logs-level', level);
  els.levelSeg.querySelectorAll('button').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.level === level));
  });
  renderAll();
}

function bindControls() {
  els.levelSeg.addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (btn && !btn.disabled) setMinLevel(btn.dataset.level);
  });
  els.countError.addEventListener('click', () => setMinLevel('error'));
  els.countWarn.addEventListener('click',  () => setMinLevel('warn'));

  els.scope.addEventListener('change', () => { state.scope = els.scope.value; renderAll(); });

  let searchTimer;
  els.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.text = els.search.value.trim().toLowerCase(); renderAll(); }, 150);
  });

  els.pause.addEventListener('click', () => {
    state.paused = !state.paused;
    if (!state.paused) { state.held = 0; renderAll(); }
    updatePauseButton();
  });

  els.clear.addEventListener('click', () => {
    const last = state.entries[state.entries.length - 1];
    state.clearedAt = last ? last.time : Date.now();
    updateCounts();
    renderAll();
  });

  els.jump.addEventListener('click', scrollToBottom);
  els.list.addEventListener('scroll', () => {
    if (state.unseen && isNearBottom()) { state.unseen = 0; updateJump(); }
  });

  // "/" jumps to the text filter, as in most log viewers.
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== els.search) {
      event.preventDefault();
      els.search.focus();
    }
  });
}

bindControls();
setMinLevel(state.minLevel);
connect();
