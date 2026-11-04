import './styles.css';
import { DB, uid, ICONS, COLORS } from './core/database.js';
import { StudyTimer } from './timer/timer.js';
import { BlackHole } from './animation/blackhole.js';
import { beep, notify, askPermission } from './core/notify.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let data = DB.load();
const ui = { page: 'dashboard', mode: 'focus', subject: '', rep: 'week', q: '', fs: '', fd: '', fm: '', nq: '', pomo: 0, focusId: '' };
let run = null; // active session: { id, subjectId, subjectName, start, planned, type, timer, bh, el }
const ACTIVE = 'focus-flow-active';

/* ---------- helpers ---------- */
const save = () => { if (!DB.save(data)) toast('Storage is full. Export a backup now.'); };
const dk = ts => new Date(ts).toLocaleDateString('en-CA');
const fmt = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}h ${String(m).padStart(2, '0')}m` : m ? `${m}m` : `${s}s`; };
const clock = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: data.settings.hour12 });
const subj = id => data.subjects.find(s => s.id === id);
const sName = s => subj(s.subjectId)?.name || s.subjectName;
const sColor = s => subj(s.subjectId)?.color || '#8d9bb0';
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
const day0 = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const weekStart = () => { const d = new Date(), diff = (d.getDay() - data.settings.weekStart + 7) % 7; return day0(new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff)); };
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
const inR = (from, to = Infinity) => data.sessions.filter(s => s.type === 'focus' && s.start >= from && s.start < to);
const sum = a => a.reduce((t, s) => t + s.duration, 0);
function bySubject(list) {
  const m = new Map();
  list.forEach(s => { const k = s.subjectId || s.subjectName; const e = m.get(k) || { id: k, name: sName(s), color: sColor(s), total: 0, n: 0, last: 0 }; e.total += s.duration; e.n++; e.last = Math.max(e.last, s.start); m.set(k, e); });
  return [...m.values()].sort((a, b) => b.total - a.total);
}
const bars = (vals, labels, color = 'var(--accent)') => {
  const mx = Math.max(...vals, 1);
  return `<div class="bars">${vals.map((v, i) => `<div class="bar-col" title="${esc(labels[i])}: ${fmt(v)}"><i style="height:${Math.max(v ? 4 : 0, v / mx * 100)}%;background:${color}"></i><span>${esc(labels[i])}</span></div>`).join('')}</div>`;
};
const empty = (t) => `<div class="empty">${t}</div>`;
const prog = (done, goal) => { const p = goal ? Math.min(100, done / goal * 100) : 0; return `<div class="progress wide"><span style="width:${p}%"></span></div>`; };

/* ---------- views ---------- */
function dashboard() {
  const st = data.settings, f = inR(0), today = sum(inR(day0())), wk = sum(inR(weekStart())), mo = sum(inR(monthStart()));
  const goal = st.goals.daily * 60, pct = goal ? Math.min(100, Math.round(today / goal * 100)) : 0;
  const subs = bySubject(f), tot = sum(f), recent = [...data.sessions].sort((a, b) => b.start - a.start).slice(0, 6);
  const mins = { focus: st.focusMinutes, short: st.shortBreakMinutes, long: st.longBreakMinutes };
  return `<h2 class="heading">Dashboard</h2><p class="subheading">${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
  <div class="stats">${[['Total', fmt(tot)], ['Today', fmt(today)], ['This week', fmt(wk)], ['This month', fmt(mo)], ['Sessions', f.length], ['Daily goal', pct + '%']].map(([l, v]) => `<div class="card"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`).join('')}</div>
  ${goal ? `<div class="panel goal">${prog(today, goal)}<small>${today >= goal ? 'Daily goal reached' : fmt(goal - today) + ' left of ' + fmt(goal)}</small></div>` : ''}
  <div class="panel timer-panel"><div class="mode-row">${[['focus', 'Focus'], ['short', 'Short break'], ['long', 'Long break']].map(([k, l]) => `<button class="mode-btn ${ui.mode === k ? 'active' : ''}" data-act="mode" data-v="${k}">${l} · ${mins[k]}m</button>`).join('')}</div>
  <div class="subject-row"><select data-f="subject" aria-label="Subject"><option value="">Choose a subject…</option>${data.subjects.map(s => `<option value="${s.id}" ${ui.subject === s.id ? 'selected' : ''}>${s.icon} ${esc(s.name)}</option>`).join('')}</select>
  <button class="btn primary" data-act="start">Start</button></div></div>
  <div class="quick">${[['subjects', 'Add subject'], ['planner', 'Add task'], ['history', 'History'], ['stats', 'Statistics']].map(([p, l]) => `<button class="btn" data-act="nav" data-v="${p}">${l}</button>`).join('')}</div>
  <h3 class="section-title">Subjects</h3>${subs.length ? `<div class="list">${subs.map(s => `<div class="list-item col"><div class="between"><span><i class="dot" style="background:${s.color}"></i>${esc(s.name)}</span><b>${fmt(s.total)}</b></div>${prog(s.total, subs[0].total)}</div>`).join('')}</div>` : empty('Choose a subject and start a session. Your study time will appear here.')}
  <h3 class="section-title">Recent activity</h3>${recent.length ? `<div class="list">${recent.map(sessRow).join('')}</div>` : empty('No sessions yet.')}`;
}
const sessRow = s => `<div class="list-item"><div><i class="dot" style="background:${sColor(s)}"></i>${esc(sName(s))}<small>${new Date(s.start).toLocaleDateString()} · ${clock(s.start)}–${clock(s.end)} · ${s.status}</small></div><b>${fmt(s.duration)}</b></div>`;

function subjectsPage() {
  const all = inR(0), tot = sum(all), t0 = day0(), w0 = weekStart(), m0 = monthStart();
  return `<h2 class="heading">Subjects</h2><p class="subheading">Create the subjects you study. Deleting one keeps its history.</p>
  <div class="panel"><div class="form-row"><input id="sn" placeholder="Subject name" maxlength="40"><input id="sc" type="color" value="${COLORS[data.subjects.length % 8]}" class="colorpick"><select id="si">${ICONS.map(i => `<option>${i}</option>`).join('')}</select><button class="btn primary" data-act="addSubject">Add</button></div></div>
  <div class="list" style="margin-top:12px">${data.subjects.map(s => {
    const own = all.filter(x => x.subjectId === s.id), td = sum(own.filter(x => x.start >= t0));
    return `<div class="list-item col"><div class="between"><span class="big">${s.icon} ${esc(s.name)}</span><span class="row"><input type="color" class="colorpick" value="${s.color}" data-sc="${s.id}"><button class="btn" data-act="renameSubject" data-id="${s.id}">Rename</button><button class="btn danger" data-act="delSubject" data-id="${s.id}">Delete</button></span></div>
    <div class="grid4">${[['Total', fmt(sum(own))], ['Today', fmt(td)], ['Week', fmt(sum(own.filter(x => x.start >= w0)))], ['Month', fmt(sum(own.filter(x => x.start >= m0)))], ['Sessions', own.length], ['Average', own.length ? fmt(sum(own) / own.length) : '–'], ['Last studied', own.length ? new Date(Math.max(...own.map(x => x.start))).toLocaleDateString() : 'Never'], ['Share', tot ? Math.round(sum(own) / tot * 100) + '%' : '0%']].map(([l, v]) => `<div><small>${l}</small><b>${v}</b></div>`).join('')}</div>
    <label class="goal-in">Daily goal (min, 0 = none) <input type="number" min="0" value="${s.goal || 0}" data-sg="${s.id}"></label>${s.goal ? prog(td, s.goal * 60) : ''}</div>`;
  }).join('')}</div>`;
}

function historyPage() {
  const q = ui.q.toLowerCase();
  const list = data.sessions.filter(s => (!ui.fs || s.subjectId === ui.fs) && (!ui.fd || dk(s.start) === ui.fd) && (!q || sName(s).toLowerCase().includes(q) || s.status.includes(q))
    && (!ui.fm || (ui.fm === 'short' ? s.duration < 900 : ui.fm === 'mid' ? s.duration >= 900 && s.duration < 2700 : s.duration >= 2700))).sort((a, b) => b.start - a.start);
  return `<h2 class="heading">History</h2><p class="subheading">${list.length} of ${data.sessions.length} sessions · ${fmt(sum(list))}</p>
  <div class="filters"><input id="q" data-q="q" placeholder="Search" value="${esc(ui.q)}"><select data-f="fs"><option value="">All subjects</option>${data.subjects.map(s => `<option value="${s.id}" ${ui.fs === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select><input type="date" data-f="fd" value="${ui.fd}"><select data-f="fm">${[['', 'Any length'], ['short', 'Under 15 min'], ['mid', '15–45 min'], ['long', 'Over 45 min']].map(([v, l]) => `<option value="${v}" ${ui.fm === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  ${list.length ? `<div class="list">${list.slice(0, 200).map(s => `<div class="list-item">${sessRow(s).replace(/^<div class="list-item">|<\/div>$/g, '')}<span class="row"><button class="btn" data-act="viewSession" data-id="${s.id}">Details</button><button class="btn" data-act="editSession" data-id="${s.id}">Edit</button><button class="btn danger" data-act="delSession" data-id="${s.id}">Delete</button></span></div>`).join('')}</div>` : empty('No sessions match.')}`;
}

function statsPage() {
  const now = new Date(), P = ui.rep;
  const from = P === 'day' ? day0() : P === 'week' ? weekStart() : P === 'month' ? monthStart() : 0, list = inR(from), tot = sum(list), subs = bySubject(list);
  const days = new Set(list.map(s => dk(s.start)));
  const longest = list.length ? Math.max(...list.map(s => s.duration)) : 0;
  const goal = ({ day: data.settings.goals.daily, week: data.settings.goals.weekly, month: data.settings.goals.monthly }[P] || 0) * 60;
  let chart = '', extra = [];
  if (P === 'day') { const h = Array(24).fill(0); list.forEach(s => h[new Date(s.start).getHours()] += s.duration); chart = bars(h, h.map((_, i) => i)); }
  if (P === 'week') {
    const v = [], l = []; for (let i = 0; i < 7; i++) { const a = from + i * 864e5; v.push(sum(inR(a, a + 864e5))); l.push(new Date(a + 36e5).toLocaleDateString([], { weekday: 'short' })); }
    chart = bars(v, l); extra = [['Average per day', fmt(tot / 7)], ['Most studied', subs[0]?.name || '–'], ['Least studied', subs.length > 1 ? subs.at(-1).name : '–']];
  }
  if (P === 'month') {
    const v = [0, 0, 0, 0, 0]; list.forEach(s => v[Math.min(4, Math.floor((new Date(s.start).getDate() - 1) / 7))] += s.duration);
    const dm = {}; list.forEach(s => dm[dk(s.start)] = (dm[dk(s.start)] || 0) + s.duration); const best = Object.entries(dm).sort((a, b) => b[1] - a[1])[0];
    chart = bars(v, ['W1', 'W2', 'W3', 'W4', 'W5']); extra = [['Consistency', Math.round(days.size / now.getDate() * 100) + '% of days'], ['Best day', best ? `${best[0]} · ${fmt(best[1])}` : '–']];
  }
  if (P === 'all') {
    const v = [], l = []; for (let i = 13; i >= 0; i--) { const a = day0() - i * 864e5; v.push(sum(inR(a, a + 864e5))); l.push(new Date(a + 36e5).getDate()); }
    chart = bars(v, l); extra = [['Study days', days.size], ['Longest session', fmt(longest)], ['Most studied', subs[0]?.name || '–']];
  }
  let acc = 0; const donut = subs.length ? `conic-gradient(${subs.map(s => { const a = acc / tot * 360; acc += s.total; return `${s.color} ${a}deg ${acc / tot * 360}deg`; }).join(',')})` : '';
  return `<h2 class="heading">Statistics</h2><div class="mode-row" style="justify-content:flex-start">${[['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly'], ['all', 'All time']].map(([k, l]) => `<button class="mode-btn ${P === k ? 'active' : ''}" data-act="rep" data-v="${k}">${l}</button>`).join('')}</div>
  ${list.length ? `<div class="stats">${[['Study time', fmt(tot)], ['Sessions', list.length], ['Average session', fmt(tot / list.length)], ...(P !== 'all' ? [['Longest', fmt(longest)]] : []), ...(goal && P !== 'all' ? [['Goal', Math.min(100, Math.round(tot / goal * 100)) + '%']] : []), ...extra].map(([l, v]) => `<div class="card"><div class="stat-label">${l}</div><div class="stat-value sm">${esc(v)}</div></div>`).join('')}</div>
  <div class="panel"><div class="stat-label">${P === 'day' ? 'BY HOUR' : P === 'week' ? 'BY DAY' : P === 'month' ? 'BY WEEK' : 'LAST 14 DAYS'}</div>${chart}</div>
  <h3 class="section-title">Subject distribution</h3><div class="panel donut-wrap"><div class="donut" style="background:${donut}"><span>${fmt(tot)}</span></div><div class="legend">${subs.map(s => `<div><i class="dot" style="background:${s.color}"></i>${esc(s.name)} <b>${fmt(s.total)}</b> <small>${Math.round(s.total / tot * 100)}%</small></div>`).join('')}</div></div>` : empty('No study time recorded for this period yet.')}`;
}

function plannerPage() {
  const nq = ui.nq.toLowerCase(), opts = `<option value="">No subject</option>${data.subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}`;
  const tasks = [...data.tasks].sort((a, b) => a.done - b.done || (a.deadline || '9') .localeCompare(b.deadline || '9'));
  const notes = data.notes.filter(n => !nq || n.text.toLowerCase().includes(nq)).sort((a, b) => b.created - a.created);
  return `<h2 class="heading">Planner</h2><p class="subheading">Tasks and notes</p>
  <div class="panel"><div class="form-row wrap"><input id="tt" placeholder="New task" maxlength="120"><select id="ts">${opts}</select><input id="td" type="date"><select id="tp"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select><button class="btn primary" data-act="addTask">Add</button></div></div>
  <div class="list" style="margin-top:12px">${tasks.length ? tasks.map(t => `<div class="list-item ${t.done ? 'done' : ''}"><label class="task-label"><input class="check" type="checkbox" data-tg="${t.id}" ${t.done ? 'checked' : ''}><span><span class="task-title">${esc(t.title)}</span><small>${t.priority}${t.deadline ? ' · due ' + t.deadline : ''}${subj(t.subjectId) ? ' · ' + esc(subj(t.subjectId).name) : ''}</small></span></label><span class="row"><button class="btn" data-act="editTask" data-id="${t.id}">Edit</button><button class="btn danger" data-act="delTask" data-id="${t.id}">Delete</button></span></div>`).join('') : empty('No tasks yet.')}</div>
  <h3 class="section-title">Notes</h3><div class="panel"><div class="form-row wrap"><input id="nt" placeholder="Write a note" maxlength="500"><select id="ns">${opts}</select><button class="btn primary" data-act="addNote">Save</button></div><input id="nq" data-q="nq" placeholder="Search notes" value="${esc(ui.nq)}"></div>
  <div class="list" style="margin-top:12px">${notes.length ? notes.map(n => `<div class="list-item"><div>${esc(n.text)}<small>${new Date(n.created).toLocaleDateString()}${subj(n.subjectId) ? ' · ' + esc(subj(n.subjectId).name) : ''}</small></div><span class="row"><button class="btn" data-act="editNote" data-id="${n.id}">Edit</button><button class="btn danger" data-act="delNote" data-id="${n.id}">Delete</button></span></div>`).join('') : empty('No notes found.')}</div>`;
}

const SET = [
  ['Appearance', [['theme', 'Theme', 'select', [['dark', 'Dark'], ['light', 'Light']]], ['accent', 'Accent colour', 'color'], ['hour12', '12-hour clock', 'check']]],
  ['Timer', [['focusMinutes', 'Focus (min)', 'num', 1, 240], ['shortBreakMinutes', 'Short break (min)', 'num', 1, 60], ['longBreakMinutes', 'Long break (min)', 'num', 1, 120], ['longInterval', 'Long break every N focus sessions', 'num', 2, 12], ['autoBreak', 'Start breaks automatically', 'check'], ['autoNext', 'Start next focus automatically', 'check'], ['sound', 'Completion sound', 'check'], ['notifications', 'Completion notifications', 'check']]],
  ['Animation', [['animationEnabled', 'Animation', 'check'], ['animationStyle', 'Style', 'select', [['blackhole', 'Black hole'], ['galaxy', 'Galaxy'], ['nebula', 'Nebula'], ['orbit', 'Energy orbit'], ['waves', 'Cosmic waves']]], ['colorMode', 'Colours', 'select', [['multi', 'Multicolour'], ['accent', 'Accent only']]], ['animationIntensity', 'Intensity', 'range', 10, 100], ['animationSpeed', 'Speed', 'range', 10, 150], ['particleCount', 'Particles', 'range', 8, 200], ['perfMode', 'Performance mode (fewer effects)', 'check']]],
  ['Goals and study', [['goals.daily', 'Daily goal (min)', 'num', 0, 1440], ['goals.weekly', 'Weekly goal (min)', 'num', 0, 10080], ['goals.monthly', 'Monthly goal (min)', 'num', 0, 44640], ['weekStart', 'Week starts on', 'select', [['1', 'Monday'], ['0', 'Sunday'], ['6', 'Saturday']]]]]
];
const getS = k => k.split('.').reduce((o, p) => o[p], data.settings);
function settingsPage() {
  return `<h2 class="heading">Settings</h2><p class="subheading">Changes save automatically.</p>${SET.map(([t, items]) => `<h3 class="section-title">${t}</h3><div class="settings-grid">${items.map(([k, l, ty, a, b]) => {
    const v = getS(k); let c;
    if (ty === 'select') c = `<select data-s="${k}">${a.map(([x, y]) => `<option value="${x}" ${String(v) === x ? 'selected' : ''}>${y}</option>`).join('')}</select>`;
    else if (ty === 'check') c = `<input class="check" type="checkbox" data-s="${k}" ${v ? 'checked' : ''}>`;
    else if (ty === 'color') c = `<div class="color-row">${COLORS.map(x => `<button class="color-dot ${v === x ? 'active' : ''}" style="background:${x}" data-act="accent" data-v="${x}" aria-label="${x}"></button>`).join('')}</div>`;
    else if (ty === 'range') c = `<div class="range-line"><input type="range" min="${a}" max="${b}" value="${v}" data-s="${k}"><span class="range-value">${v}</span></div>`;
    else c = `<input type="number" min="${a}" max="${b}" value="${v}" data-s="${k}">`;
    return `<div class="setting"><label>${l}</label>${c}</div>`;
  }).join('')}</div>`).join('')}
  <h3 class="section-title">Data</h3><div class="quick"><button class="btn" data-act="backup">Export backup</button><button class="btn" data-act="restore">Restore backup</button><button class="btn" data-act="csv">Export CSV</button><button class="btn danger" data-act="clear">Clear all data</button></div>
  <p class="hint">Notifications depend on Android background rules and may not appear when the app is closed. Sessions are saved either way.</p><input type="file" id="file" accept=".json,application/json" hidden>`;
}
const PAGES = { dashboard, subjects: subjectsPage, history: historyPage, stats: statsPage, planner: plannerPage, settings: settingsPage };
const NAV = [['dashboard', 'Dashboard'], ['subjects', 'Subjects'], ['history', 'History'], ['stats', 'Statistics'], ['planner', 'Planner'], ['settings', 'Settings']];

function applyTheme() {
  const a = data.settings.accent;
  document.body.classList.toggle('light', data.settings.theme === 'light');
  const r = document.documentElement.style; r.setProperty('--accent', a); r.setProperty('--accent-soft', rgba(a, .14));
}
function render() {
  applyTheme();
  if (!$('#shell')) {
    $('#app').innerHTML = `<div class="app" id="shell"><div class="topbar"><div class="brand"><div class="brand-mark">F</div><div><div class="brand-name">FOCUS FLOW</div><div class="brand-sub">STUDY TRACKER</div></div></div></div>
    <div class="layout"><nav class="sidebar" id="nav"></nav><main class="content" id="view"></main></div><div class="footer">FOCUS FLOW · NATIONVK</div></div><div class="toast" id="toast"></div>`;
  }
  $('#nav').innerHTML = NAV.map(([k, l]) => `<button class="nav-btn ${ui.page === k ? 'active' : ''}" data-act="nav" data-v="${k}">${l}</button>`).join('');
  $('#view').innerHTML = PAGES[ui.page]();
  if (ui.focusId) { const el = $('#' + ui.focusId); if (el) { el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); } ui.focusId = ''; }
}
const change = (fn) => { fn(); save(); render(); };

/* ---------- timer sessions ---------- */
const modeSecs = m => 60 * ({ focus: data.settings.focusMinutes, short: data.settings.shortBreakMinutes, long: data.settings.longBreakMinutes }[m] || 25);
const tfmt = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60, p = n => String(n).padStart(2, '0'); return h ? `${p(h)}:${p(m)}:${p(x)}` : `${p(m)}:${p(x)}`; };

function startSession(resume) {
  if (run) return;
  const type = resume?.type || ui.mode, s = resume || { subjectId: ui.subject };
  if (type === 'focus' && !subj(s.subjectId)) return toast('Choose a subject before you start.');
  const planned = modeSecs(type), id = uid();
  const timer = new StudyTimer(v => paint(v), () => complete());
  timer.setDuration(planned);
  run = { id, type, subjectId: type === 'focus' ? s.subjectId : '', subjectName: subj(s.subjectId)?.name || '', start: Date.now(), planned, timer };
  openOverlay(); timer.start();
  if (type === 'focus') localStorage.setItem(ACTIVE, JSON.stringify({ ...run, timer: undefined, endAt: Date.now() + planned * 1000 }));
}
function openOverlay() {
  const st = data.settings, el = document.createElement('div'); el.className = 'fs';
  el.innerHTML = `<canvas></canvas><button class="fs-x" aria-label="Exit">×</button><div class="ring"><svg viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#53e6a0"/><stop offset=".35" stop-color="#4f8cff"/><stop offset=".7" stop-color="#a66bff"/><stop offset="1" stop-color="#ff6bb5"/></linearGradient></defs><circle class="trk" cx="100" cy="100" r="92"/><circle class="arc" cx="100" cy="100" r="92" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg><div class="fs-time"></div></div>`;
  document.body.appendChild(el); document.body.classList.add('noscroll'); run.el = el;
  $('.fs-x', el).onclick = () => requestExit();
  run.bh = new BlackHole($('canvas', el), { enabled: st.animationEnabled, intensity: st.animationIntensity, speed: st.animationSpeed, particles: st.particleCount, style: st.animationStyle, colorMode: st.colorMode, accent: st.accent, perf: st.perfMode });
  history.pushState({ fs: 1 }, ''); document.documentElement.requestFullscreen?.().catch(() => {});
  paint({ remaining: run.timer.remaining, progress: 0 });
}
function paint(v) {
  if (!run?.el) return;
  $('.fs-time', run.el).textContent = tfmt(v.remaining);
  $('.arc', run.el).style.strokeDashoffset = 100 - v.progress * 100;
}
const elapsed = () => run.timer.running ? Math.round(run.planned - Math.max(0, Math.ceil((run.timer.endAt - Date.now()) / 1000))) : run.planned - run.timer.remaining;

function record(status, secs) {
  if (run.type !== 'focus' || secs < 1 || data.sessions.some(s => s.id === run.id)) return;
  data.sessions.push({ id: run.id, subjectId: run.subjectId, subjectName: run.subjectName, start: run.start, end: Date.now(), duration: Math.round(secs), planned: run.planned, type: 'focus', status, created: Date.now() });
  save();
  const g = data.settings.goals.daily * 60, td = sum(inR(day0()));
  if (g && td >= g && td - secs < g) { toast('Daily goal reached 🎉'); if (data.settings.notifications) notify('Daily goal reached', fmt(td) + ' studied today'); }
}
function closeOverlay() {
  if (!run) return;
  run.timer.destroy(); run.bh?.destroy(); run.el?.remove(); document.body.classList.remove('noscroll');
  localStorage.removeItem(ACTIVE); document.fullscreenElement && document.exitFullscreen?.().catch(() => {});
  const cameFromHistory = history.state?.fs; run = null; if (cameFromHistory) { skipPop = true; history.back(); }
  render();
}
let skipPop = false;
function requestExit() {
  if (!run) return;
  run.timer.pause();
  const secs = run.timer.duration - run.timer.remaining;
  if (run.type === 'focus' && secs >= 1) {
    if (!confirm(`Save ${fmt(secs)} of study time and exit?\n\nOK saves the session. Cancel keeps studying.`)) { run.timer.start(); if (!history.state?.fs) history.pushState({ fs: 1 }, ''); return; }
    record('stopped', secs); toast(`Saved ${fmt(secs)}`);
  }
  closeOverlay();
}
function complete() {
  if (!run) return;
  const r = run, st = data.settings;
  beep(st.sound);
  if (r.type === 'focus') {
    record('completed', r.planned); ui.pomo++; if (st.notifications) notify('Focus session complete', fmt(r.planned) + ' recorded');
    ui.mode = ui.pomo % st.longInterval === 0 ? 'long' : 'short';
  } else { ui.mode = 'focus'; if (st.notifications) notify('Break finished', 'Ready for the next session'); }
  const next = { subjectId: ui.subject, type: ui.mode }, auto = r.type === 'focus' ? st.autoBreak : st.autoNext;
  closeOverlay();
  if (auto) setTimeout(() => startSession(next), 300); else toast(r.type === 'focus' ? 'Session saved' : 'Break finished');
}
function recoverInterrupted() { // app killed or crashed mid-session: keep the time that was actually studied
  try {
    const a = JSON.parse(localStorage.getItem(ACTIVE) || 'null'); localStorage.removeItem(ACTIVE);
    if (!a || data.sessions.some(s => s.id === a.id)) return;
    const secs = Math.min(a.planned, (Math.min(Date.now(), a.endAt) - a.start) / 1000);
    if (secs >= 1) { data.sessions.push({ id: a.id, subjectId: a.subjectId, subjectName: a.subjectName, start: a.start, end: Math.min(Date.now(), a.endAt), duration: Math.round(secs), planned: a.planned, type: 'focus', status: 'interrupted', created: Date.now() }); save(); setTimeout(() => toast(`Recovered ${fmt(secs)} from an interrupted session`), 400); }
  } catch { localStorage.removeItem(ACTIVE); }
}

/* ---------- actions ---------- */
const ACT = {
  nav: d => { ui.page = d.v; render(); },
  mode: d => { ui.mode = d.v; render(); },
  rep: d => { ui.rep = d.v; render(); },
  accent: d => change(() => data.settings.accent = d.v),
  start: () => startSession(),
  addSubject: () => { const n = $('#sn').value.trim(); if (!n) return toast('Enter a subject name.'); if (data.subjects.some(s => s.name.toLowerCase() === n.toLowerCase())) return toast('That subject already exists.'); change(() => data.subjects.push({ id: uid(), name: n, color: $('#sc').value, icon: $('#si').value, goal: 0 })); },
  renameSubject: d => { const s = subj(d.id), n = prompt('Subject name', s.name)?.trim(); if (n) change(() => s.name = n); },
  delSubject: d => { const s = subj(d.id); if (data.subjects.length < 2) return toast('Keep at least one subject.'); if (confirm(`Delete "${s.name}"? Its past sessions stay in your history.`)) change(() => { data.sessions.forEach(x => { if (x.subjectId === s.id) x.subjectName = s.name; }); data.subjects = data.subjects.filter(x => x !== s); if (ui.subject === s.id) ui.subject = ''; }); },
  viewSession: d => { const s = data.sessions.find(x => x.id === d.id); alert(`${sName(s)}\n${new Date(s.start).toLocaleString()} → ${clock(s.end)}\nStudied: ${fmt(s.duration)} of ${fmt(s.planned)} planned\nStatus: ${s.status}\nID: ${s.id}`); },
  editSession: d => { const s = data.sessions.find(x => x.id === d.id), m = parseFloat(prompt('Duration in minutes', (s.duration / 60).toFixed(1))); if (m > 0 && m <= 1440) change(() => s.duration = Math.round(m * 60)); },
  delSession: d => { if (confirm('Delete this session? Statistics will update.')) change(() => data.sessions = data.sessions.filter(x => x.id !== d.id)); },
  addTask: () => { const t = $('#tt').value.trim(); if (!t) return toast('Enter a task.'); change(() => data.tasks.push({ id: uid(), title: t, done: false, subjectId: $('#ts').value, deadline: $('#td').value, priority: $('#tp').value })); },
  editTask: d => { const t = data.tasks.find(x => x.id === d.id), n = prompt('Task', t.title)?.trim(); if (n) { const p = prompt('Priority (low, medium, high)', t.priority)?.trim().toLowerCase(); change(() => { t.title = n; if (['low', 'medium', 'high'].includes(p)) t.priority = p; }); } },
  delTask: d => change(() => data.tasks = data.tasks.filter(x => x.id !== d.id)),
  addNote: () => { const t = $('#nt').value.trim(); if (!t) return toast('Write something first.'); change(() => data.notes.push({ id: uid(), text: t, subjectId: $('#ns').value, created: Date.now() })); },
  editNote: d => { const n = data.notes.find(x => x.id === d.id), t = prompt('Note', n.text)?.trim(); if (t) change(() => n.text = t); },
  delNote: d => change(() => data.notes = data.notes.filter(x => x.id !== d.id)),
  backup: () => DB.backup(data),
  csv: () => data.sessions.length ? DB.csv(data.sessions) : toast('No sessions to export yet.'),
  restore: () => $('#file').click(),
  clear: () => { if (confirm('Delete ALL data? Export a backup first. This cannot be undone.') && confirm('Really delete everything?')) { localStorage.removeItem(ACTIVE); localStorage.removeItem("focus-flow-v3"); localStorage.removeItem("focus-flow-v2-data"); data = DB.load(); save(); render(); toast('All data cleared'); } }
};
function setPath(k, v) { const p = k.split('.'), last = p.pop(); p.reduce((o, x) => o[x], data.settings)[last] = v; }
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && ACT[b.dataset.act]) ACT[b.dataset.act](b.dataset); });
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'file') { try { const nd = await DB.restore(t.files[0]); if (confirm(`Replace current data with this backup (${nd.sessions.length} sessions)? Your current data will be overwritten.`)) { data = nd; save(); render(); toast('Backup restored'); } } catch (err) { toast(err.message || 'Could not read backup'); } t.value = ''; }
  else if (t.dataset.s) {
    const v = t.type === 'checkbox' ? t.checked : t.type === 'number' || t.type === 'range' ? Math.max(+t.min, Math.min(+t.max, +t.value || 0)) : t.value;
    setPath(t.dataset.s, t.dataset.s === 'weekStart' ? +v : v); save();
    if (t.dataset.s === 'notifications' && v) askPermission().then(ok => { if (!ok) { data.settings.notifications = false; save(); render(); toast('Notification permission was not granted'); } });
    render();
  }
  else if (t.dataset.sc) change(() => subj(t.dataset.sc).color = t.value);
  else if (t.dataset.sg) change(() => subj(t.dataset.sg).goal = Math.max(0, +t.value || 0));
  else if (t.dataset.tg) change(() => { const x = data.tasks.find(y => y.id === t.dataset.tg); x.done = t.checked; });
  else if (t.dataset.f) { ui[t.dataset.f] = t.value; render(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.q) { ui[t.dataset.q] = t.value; ui.focusId = t.id; render(); }
  else if (t.type === 'range' && t.dataset.s) { setPath(t.dataset.s, +t.value); t.nextElementSibling.textContent = t.value; save(); }
});
addEventListener('popstate', () => { if (skipPop) { skipPop = false; return; } if (run) requestExit(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && run) requestExit(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && run?.timer.running) run.timer.tick(); });
addEventListener('pagehide', () => { if (run?.type === 'focus' && elapsed() >= 1) { /* active-session snapshot in localStorage is recovered on next launch */ } });

recoverInterrupted(); render();
