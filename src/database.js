const KEY = 'focus-flow-v2-data';
const defaults = {
  settings: {
    theme: 'dark', accent: 'green', focusMinutes: 25,
    shortBreakMinutes: 5, longBreakMinutes: 15,
    animationEnabled: true, animationIntensity: 70,
    animationSpeed: 60, particleCount: 70, animationStyle: 'blackhole'
  },
  subjects: ['General Study', 'Statistics', 'Mathematics', 'Python'],
  tasks: [], sessions: [], notes: []
};

function safeMerge(saved) {
  return {
    ...defaults, ...saved,
    settings: { ...defaults.settings, ...(saved?.settings || {}) },
    subjects: Array.isArray(saved?.subjects) && saved.subjects.length ? saved.subjects : defaults.subjects,
    tasks: Array.isArray(saved?.tasks) ? saved.tasks : [],
    sessions: Array.isArray(saved?.sessions) ? saved.sessions : [],
    notes: Array.isArray(saved?.notes) ? saved.notes : []
  };
}

export const DB = {
  load() {
    try { return safeMerge(JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch { return structuredClone(defaults); }
  },
  save(data) { localStorage.setItem(KEY, JSON.stringify(data)); },
  backup(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    download(blob, `focus-flow-backup-${Date.now()}.json`);
  },
  async restore(file) {
    const parsed = JSON.parse(await file.text());
    if (!parsed || !parsed.settings || !Array.isArray(parsed.sessions)) throw new Error('Invalid backup');
    return safeMerge(parsed);
  },
  csv(sessions) {
    const rows = [['Date','Subject','Duration (minutes)','Completed at']];
    sessions.forEach(s => rows.push([s.date,s.subject,s.duration,s.completedAt]));
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
    download(new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8'}), 'focus-flow-sessions.csv');
  }
};
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
