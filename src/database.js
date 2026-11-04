const KEY = 'focus-flow-v2-data';

const defaults = {
  settings: {
    theme: 'dark',
    accent: 'green',
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    animationEnabled: true,
    animationIntensity: 70,
    animationSpeed: 60,
    particleCount: 70,
    animationStyle: 'blackhole'
  },

  subjects: [
    'General Study',
    'Statistics',
    'Mathematics',
    'Python'
  ],

  tasks: [],
  sessions: [],
  notes: []
};

function cloneDefaults() {
  return JSON.parse(JSON.stringify(defaults));
}

function safeMerge(saved) {
  return {
    ...defaults,
    ...(saved || {}),

    settings: {
      ...defaults.settings,
      ...(saved?.settings || {})
    },

    subjects:
      Array.isArray(saved?.subjects) && saved.subjects.length
        ? saved.subjects
        : [...defaults.subjects],

    tasks: Array.isArray(saved?.tasks) ? saved.tasks : [],

    sessions: Array.isArray(saved?.sessions)
      ? saved.sessions
      : [],

    notes: Array.isArray(saved?.notes)
      ? saved.notes
      : []
  };
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const DB = {

  load() {
    try {
      const raw = localStorage.getItem(KEY);

      if (!raw) return cloneDefaults();

      const parsed = JSON.parse(raw);

      return safeMerge(parsed);

    } catch (error) {
      console.error('Database loading failed:', error);

      return cloneDefaults();
    }
  },

  save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;

    } catch (error) {
      console.error('Database saving failed:', error);
      throw error;
    }
  },

  backup(data) {
    try {
      const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: 'application/json' }
      );

      download(
        blob,
        `focus-flow-backup-${Date.now()}.json`
      );

    } catch (error) {
      console.error('Backup failed:', error);
      throw error;
    }
  },

  async restore(file) {
    if (!file) {
      throw new Error('No backup file selected');
    }

    const text = await file.text();
    const parsed = JSON.parse(text);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.settings ||
      !Array.isArray(parsed.sessions)
    ) {
      throw new Error('Invalid backup file');
    }

    return safeMerge(parsed);
  },

  csv(sessions) {
    const rows = [
      ['Date', 'Subject', 'Duration (minutes)', 'Completed at']
    ];

    sessions.forEach(session => {
      rows.push([
        session.date,
        session.subject,
        session.duration,
        session.completedAt
      ]);
    });

    const csv = rows
      .map(row =>
        row
          .map(value =>
            `"${String(value ?? '').replace(/"/g, '""')}"`
          )
          .join(',')
      )
      .join('\n');

    const blob = new Blob(
      ['\ufeff' + csv],
      { type: 'text/csv;charset=utf-8' }
    );

    download(blob, 'focus-flow-sessions.csv');
  }
};
