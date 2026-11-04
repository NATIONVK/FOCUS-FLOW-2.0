const KEY = 'focus-flow-v3', OLD = 'focus-flow-v2-data', VERSION = 3;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const ICONS = ['📘', '📐', '🧮', '🐍', '📊', '✍️', '🔬', '🌍', '⭐'];
export const COLORS = ['#53e6a0', '#ff647c', '#f5c542', '#4f8cff', '#a66bff', '#22d3ee', '#ff6bb5', '#ff9a3c'];
const SUGGESTED = [['Statistics', 1], ['Mathematics', 1], ['Python Programming', 3], ['English', 5], ['Research', 6]];

export function defaults() {
  return {
    version: VERSION,
    settings: {
      theme: 'dark', accent: '#53e6a0', hour12: false, weekStart: 1,
      focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longInterval: 4,
      autoBreak: true, autoNext: false, sound: true, notifications: false,
      animationEnabled: true, animationIntensity: 70, animationSpeed: 60, particleCount: 70,
      animationStyle: 'blackhole', colorMode: 'multi', perfMode: false,
      goals: { daily: 120, weekly: 600, monthly: 2400 }
    },
    subjects: SUGGESTED.map(([name, i]) => ({ id: uid(), name, color: COLORS[i], icon: ICONS[i], goal: 0 })),
    tasks: [], sessions: [], notes: []
  };
}
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

// Validates and migrates any saved shape (v2 or v3) into the current schema.
export function normalize(raw) {
  const d = defaults(), r = raw && typeof raw === 'object' ? raw : {};
  const s = { ...d.settings, ...(r.settings || {}), goals: { ...d.settings.goals, ...(r.settings?.goals || {}) } };
  if (!/^#[0-9a-f]{6}$/i.test(s.accent)) s.accent = d.settings.accent;
  let subjects = Array.isArray(r.subjects) && r.subjects.length ? r.subjects : d.subjects;
  subjects = subjects.map((x, i) => typeof x === 'string'
    ? { id: uid(), name: x, color: COLORS[i % 8], icon: ICONS[i % 9], goal: 0 }
    : { id: x.id || uid(), name: String(x.name || 'Subject'), color: x.color || COLORS[i % 8], icon: x.icon || '📘', goal: num(x.goal, 0) });
  const byName = Object.fromEntries(subjects.map(x => [x.name, x]));
  const seen = new Set(), sessions = [];
  for (const o of Array.isArray(r.sessions) ? r.sessions : []) {
    let x = o;
    if (o && o.duration != null && o.start == null) { // v2 record: duration in minutes
      const end = Date.parse(o.completedAt) || Date.now(), dur = num(o.duration, 0) * 60;
      x = { id: uid(), subjectId: byName[o.subject]?.id || '', subjectName: o.subject || 'Unknown', start: end - dur * 1000, end, duration: dur, type: 'focus', status: 'completed' };
    }
    if (!x || !(num(x.duration, 0) > 0) || !num(x.start, 0) || seen.has(x.id)) continue;
    x.id ||= uid(); seen.add(x.id);
    sessions.push({ id: x.id, subjectId: x.subjectId || '', subjectName: String(x.subjectName || 'Unknown'), start: +x.start, end: num(x.end, +x.start + x.duration * 1000), duration: +x.duration, planned: num(x.planned, x.duration), type: x.type || 'focus', status: x.status || 'completed', created: num(x.created, +x.start) });
  }
  const list = (a, f) => (Array.isArray(a) ? a.filter(f) : []);
  return {
    version: VERSION, settings: s, subjects, sessions,
    tasks: list(r.tasks, t => t && t.title).map(t => ({ id: t.id || uid(), title: String(t.title), done: !!(t.done || t.completed), subjectId: t.subjectId || '', deadline: t.deadline || '', priority: t.priority || 'medium' })),
    notes: list(r.notes, n => n && (n.text || n.title)).map(n => ({ id: n.id || uid(), text: String(n.text || n.title), subjectId: n.subjectId || '', created: num(n.created, Date.now()) }))
  };
}

export const DB = {
  load() {
    for (const k of [KEY, OLD]) {
      try { const t = localStorage.getItem(k); if (t) return normalize(JSON.parse(t)); } catch (e) { console.warn('Recovering from invalid data', e); }
    }
    return defaults();
  },
  save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
  },
  backup(data) { download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `focus-flow-backup-${Date.now()}.json`); },
  async restore(file) {
    const p = JSON.parse(await file.text());
    if (!p || typeof p !== 'object' || !p.settings || !Array.isArray(p.sessions)) throw new Error('Invalid backup file');
    return normalize(p);
  },
  csv(sessions) {
    const rows = [['ID', 'Date', 'Subject', 'Start', 'End', 'Duration (seconds)', 'Duration (minutes)', 'Type', 'Status']];
    sessions.forEach(s => rows.push([s.id, new Date(s.start).toLocaleDateString('en-CA'), s.subjectName, new Date(s.start).toISOString(), new Date(s.end).toISOString(), s.duration, (s.duration / 60).toFixed(2), s.type, s.status]));
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    download(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), 'focus-flow-sessions.csv');
  }
};
function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
