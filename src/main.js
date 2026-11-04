import './styles.css';
import { DB } from './database.js';
import { StudyTimer } from './timer.js';
import { BlackHole } from './blackhole.js';

const $ = (s, root = document) => root.querySelector(s);

const app = $('#app');

if (!app) {
  throw new Error('FOCUS FLOW: #app container not found');
}

let data = DB.load();

let mode = 'focus';
let subject = data.subjects[0];
let visualizer = null;
let focusVisualizer = null;
let wakeLock = null;

const colors = {
  green: '#53e6a0',
  red: '#ff647c',
  gold: '#f4bd55',
  blue: '#5ba8ff',
  purple: '#b28aff'
};

const today = () => new Date().toLocaleDateString('en-CA');

const esc = value =>
  String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

const minsToday = () =>
  data.sessions
    .filter(s => s.date === today())
    .reduce((n, s) => n + Number(s.duration || 0), 0);

function save() {
  try {
    DB.save(data);
  } catch (error) {
    console.error('Database save failed:', error);
    toast('Unable to save data. Check storage permissions.');
  }
}

function toast(message) {
  const el = $('#toast');
  if (!el) return;

  el.textContent = message;
  el.classList.add('show');

  setTimeout(() => el.classList.remove('show'), 2200);
}

function applyTheme() {
  document.body.classList.toggle(
    'light',
    data.settings.theme === 'light'
  );

  const accent = colors[data.settings.accent] || colors.green;

  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-soft', accent + '22');
}

function visualOptions() {
  return {
    enabled:
      data.settings.animationEnabled &&
      data.settings.animationStyle === 'blackhole',

    intensity: data.settings.animationIntensity,
    speed: data.settings.animationSpeed,
    particles: data.settings.particleCount,
    color: colors[data.settings.accent] || colors.green
  };
}

function setupVisualizers() {
  visualizer?.destroy();
  focusVisualizer?.destroy();

  visualizer = null;
  focusVisualizer = null;

  const mini = $('#mini-canvas');
  const full = $('#focus-canvas');

  try {
    if (mini) visualizer = new BlackHole(mini, visualOptions());
    if (full) focusVisualizer = new BlackHole(full, visualOptions());
  } catch (error) {
    console.error('Visualizer initialization failed:', error);
  }
}

function render() {
  app.innerHTML = `
  <div class="app">

    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">F</div>
        <div>
          <div class="brand-name">FOCUS FLOW</div>
          <div class="brand-sub">STUDY SMARTER · FIND YOUR OWN PATH</div>
        </div>
      </div>

      <div class="top-actions">
        <button class="icon-btn" data-action="theme">◐</button>
      </div>
    </header>

    <div class="layout">

      <nav class="sidebar">
        ${[
          ['home', '⌂ Dashboard'],
          ['tasks', '☑ Tasks'],
          ['history', '◷ History'],
          ['settings', '⚙ Settings']
        ].map(([id, label]) => `
          <button class="nav-btn ${id === 'home' ? 'active' : ''}"
            data-tab="${id}">
            ${label}
          </button>
        `).join('')}
      </nav>

      <main class="content">

        <section class="page active" id="page-home">

          <h1 class="heading">Your Focus Space</h1>
          <p class="subheading">
            Every focused minute moves you forward.
          </p>

          <div class="stats">

            <div class="card">
              <div class="stat-label">TODAY'S STUDY</div>
              <div class="stat-value" id="today-time">0m</div>
              <div class="stat-note">Focused minutes</div>
            </div>

            <div class="card">
              <div class="stat-label">SESSIONS</div>
              <div class="stat-value" id="today-count">0</div>
              <div class="stat-note">Completed today</div>
            </div>

            <div class="card">
              <div class="stat-label">TASKS DONE</div>
              <div class="stat-value" id="task-count">0</div>
              <div class="stat-note">Keep going</div>
            </div>

          </div>

          <div class="panel timer-panel">

            <div class="timer-head">
              <span>FOCUS TIMER</span>
              <span id="timer-status">READY</span>
            </div>

            <div class="mode-row">
              ${[
                ['focus', 'Focus'],
                ['short', 'Short Break'],
                ['long', 'Long Break']
              ].map(([id, label]) => `
                <button class="mode-btn ${id === mode ? 'active' : ''}"
                  data-mode="${id}">
                  ${label}
                </button>
              `).join('')}
            </div>

            <div class="visualizer">
              <canvas id="mini-canvas"></canvas>

              <div class="readout">
                <div class="time" id="mini-time">25:00</div>
                <div class="timer-label">READY TO FOCUS</div>
              </div>
            </div>

            <div class="progress">
              <span id="mini-progress"></span>
            </div>

            <div class="controls">
              <button class="btn primary" id="start-focus">
                Start Focus
              </button>

              <button class="btn" data-action="reset">
                Reset
              </button>
            </div>

            <div class="subject-row">
              <select id="subject-select">
                ${data.subjects.map(s => `
                  <option value="${esc(s)}"
                    ${s === subject ? 'selected' : ''}>
                    ${esc(s)}
                  </option>
                `).join('')}
              </select>

              <button class="btn" data-action="add-subject">
                + Subject
              </button>
            </div>

            <p class="hint">
              Customize animation intensity, speed, particle count
              or choose a normal timer in Settings.
            </p>

          </div>

          <h2 class="section-title">Recent Sessions</h2>
          <div class="list" id="recent"></div>

        </section>

        <section class="page" id="page-tasks">

          <h1 class="heading">Study Tasks</h1>
          <p class="subheading">Plan your next small win.</p>

          <div class="panel">
            <form class="form-row" id="task-form">
              <input id="task-input"
                maxlength="120"
                placeholder="Add a study task..."
                required>

              <button class="btn primary">Add</button>
            </form>

            <div class="list" id="tasks"></div>
          </div>

        </section>

        <section class="page" id="page-history">

          <h1 class="heading">Study History</h1>
          <p class="subheading">Your completed focus sessions.</p>

          <div class="panel">
            <div class="list" id="history"></div>

            <div class="form-row">
              <button class="btn" data-action="csv">Export CSV</button>
              <button class="btn" data-action="backup">Backup JSON</button>
            </div>
          </div>

        </section>

        <section class="page" id="page-settings">

          <h1 class="heading">Timer & Appearance</h1>
          <p class="subheading">
            Set up your preferred experience.
          </p>

          <div class="settings-grid">

            <div class="setting">
              <label>Focus duration (minutes)</label>
              <input id="focus-min" type="number" min="1" max="180"
                value="${data.settings.focusMinutes}">
            </div>

            <div class="setting">
              <label>Short break (minutes)</label>
              <input id="short-min" type="number" min="1" max="60"
                value="${data.settings.shortBreakMinutes}">
            </div>

            <div class="setting">
              <label>Long break (minutes)</label>
              <input id="long-min" type="number" min="1" max="90"
                value="${data.settings.longBreakMinutes}">
            </div>

            <div class="setting">
              <label>Timer display</label>
              <select id="visual-style">
                <option value="blackhole"
                  ${data.settings.animationStyle === 'blackhole' ? 'selected' : ''}>
                  Animated Black Hole
                </option>
                <option value="normal"
                  ${data.settings.animationStyle === 'normal' ? 'selected' : ''}>
                  Normal Timer
                </option>
              </select>
            </div>

            <div class="setting">
              <label>Animation</label>
              <select id="animation-on">
                <option value="true"
                  ${data.settings.animationEnabled ? 'selected' : ''}>
                  Enabled
                </option>
                <option value="false"
                  ${!data.settings.animationEnabled ? 'selected' : ''}>
                  Disabled
                </option>
              </select>
            </div>

            <div class="setting">
              <label>
                Animation intensity
                <span id="intensity-value">${data.settings.animationIntensity}%</span>
              </label>
              <div class="range-line">
                <input id="intensity" type="range"
                  min="0" max="100"
                  value="${data.settings.animationIntensity}">
              </div>
              <small>Controls glow and visual strength.</small>
            </div>

            <div class="setting">
              <label>
                Animation speed
                <span id="speed-value">${data.settings.animationSpeed}%</span>
              </label>
              <div class="range-line">
                <input id="speed" type="range"
                  min="0" max="150"
                  value="${data.settings.animationSpeed}">
              </div>
              <small>Controls particle speed.</small>
            </div>

            <div class="setting">
              <label>
                Particle count
                <span id="particle-value">${data.settings.particleCount}</span>
              </label>
              <div class="range-line">
                <input id="particles" type="range"
                  min="10" max="160"
                  value="${data.settings.particleCount}">
              </div>
              <small>Lower values are smoother on older phones.</small>
            </div>

          </div>

          <h2 class="section-title">Animation Color</h2>

          <div class="panel">
            <div class="color-row">
              ${Object.entries(colors).map(([key, value]) => `
                <button class="color-dot
                  ${data.settings.accent === key ? 'active' : ''}"
                  data-color="${key}"
                  style="background:${value}"
                  aria-label="${key}">
                </button>
              `).join('')}
            </div>
          </div>

          <div class="form-row">
            <button class="btn primary" data-action="save-settings">
              Save timer preferences
            </button>
            <button class="btn" data-action="theme">
              Toggle theme
            </button>
          </div>

          <h2 class="section-title">Data</h2>

          <div class="panel">
            <div class="form-row">
              <button class="btn" data-action="backup">
                Download backup
              </button>

              <label class="btn">
                Restore backup
                <input id="restore" type="file"
                  accept="application/json" hidden>
              </label>
            </div>

            <button class="btn danger" data-action="clear">
              Reset all data
            </button>
          </div>

        </section>

      </main>
    </div>

    <footer class="footer">
      FOCUS FLOW 2.0 · MADE WITH FOCUS · NATIONVK
    </footer>

  </div>

  <div class="focus-overlay" id="focus-overlay">
    <canvas id="focus-canvas"></canvas>

    <button class="focus-exit" data-action="exit-focus">
      ✕ Exit
    </button>

    <div class="focus-ui">
      <div class="timer-label" id="focus-status">DEEP FOCUS</div>
      <div class="time" id="focus-time">25:00</div>
      <div class="focus-subject" id="focus-subject">
        ${esc(subject)}
      </div>

      <div class="focus-controls">
        <button class="btn primary" id="focus-toggle">Pause</button>
        <button class="btn" data-action="reset">Reset</button>
      </div>

      <div class="focus-hint" id="focus-hint">
        Stay present. One task at a time.
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>
  `;

  applyTheme();
  setupVisualizers();
  updateStats();
  updateLists();

  updateTimer({
    formatted: '25:00',
    progress: 0,
    running: false
  });
}

function updateStats() {
  $('#today-time').textContent = `${minsToday()}m`;

  $('#today-count').textContent =
    data.sessions.filter(s => s.date === today()).length;

  $('#task-count').textContent =
    data.tasks.filter(t => t.done).length;
}

function updateLists() {
  const recent = $('#recent');
  const hist = $('#history');
  const tasks = $('#tasks');

  if (recent) {
    recent.innerHTML = data.sessions.slice(0, 4).map(s => `
      <div class="list-item">
        <div>
          <b>${esc(s.subject)}</b>
          <small>${esc(s.date)}</small>
        </div>
        <b>${Number(s.duration) || 0}m</b>
      </div>
    `).join('') ||
      '<div class="empty">Your completed sessions will appear here.</div>';
  }

  if (hist) {
    hist.innerHTML = data.sessions.slice(0, 100).map(s => `
      <div class="list-item">
        <div>
          <b>${esc(s.subject)}</b>
          <small>
            ${esc(s.date)} ·
            ${s.completedAt ? new Date(s.completedAt).toLocaleTimeString() : ''}
          </small>
        </div>
        <b>${Number(s.duration) || 0}m</b>
      </div>
    `).join('') ||
      '<div class="empty">No completed sessions yet.</div>';
  }

  if (tasks) {
    tasks.innerHTML = data.tasks.map(t => `
      <div class="list-item ${t.done ? 'done' : ''}">
        <label class="task-label">
          <input class="check"
            type="checkbox"
            data-check="${Number(t.id)}"
            ${t.done ? 'checked' : ''}>
          <span class="task-title">${esc(t.title)}</span>
        </label>

        <button class="btn danger"
          data-delete="${Number(t.id)}">
          Delete
        </button>
      </div>
    `).join('') ||
      '<div class="empty">No tasks yet. Add your first task.</div>';
  }
}

function updateTimer(state) {
  ['mini-time', 'focus-time'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.textContent = state.formatted;
  });

  const progress = $('#mini-progress');
  if (progress) progress.style.width = `${state.progress * 100}%`;

  const status = $('#timer-status');
  if (status) status.textContent = state.running ? 'RUNNING' : 'READY';

  const start = $('#start-focus');
  if (start) start.textContent = state.running ? 'Pause' : 'Start Focus';

  const toggle = $('#focus-toggle');
  if (toggle) toggle.textContent = state.running ? 'Pause' : 'Resume';

  const label = $('#focus-status');
  if (label) label.textContent = state.running ? 'DEEP FOCUS' : 'FOCUS PAUSED';
}

function setMode(next) {
  if (!['focus', 'short', 'long'].includes(next)) return;

  mode = next;

  const minutes =
    mode === 'focus'
      ? data.settings.focusMinutes
      : mode === 'short'
        ? data.settings.shortBreakMinutes
        : data.settings.longBreakMinutes;

  timer.setDuration(minutes * 60);

  document.querySelectorAll('[data-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
}

function completeSession() {
  if (mode === 'focus') {
    data.sessions.unshift({
      id: Date.now(),
      date: today(),
      subject,
      duration: data.settings.focusMinutes,
      completedAt: new Date().toISOString()
    });

    save();
    toast('Focus session completed. Well done!');
  } else {
    toast('Break finished. Ready for another session?');
  }

  if (navigator.vibrate) navigator.vibrate([150, 80, 150]);

  updateStats();
  updateLists();
  exitFocus();
}

const timer = new StudyTimer(updateTimer, completeSession);

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (error) {
    console.warn('Wake lock unavailable:', error);
  }
}

async function releaseWakeLock() {
  try {
    await wakeLock?.release();
  } catch (error) {
    console.warn('Wake lock release failed:', error);
  }

  wakeLock = null;
}

async function enterFocus() {
  $('#focus-overlay').classList.add('open');
  $('#focus-subject').textContent = subject;

  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    }
  } catch (error) {
    console.warn('Fullscreen unavailable:', error);
  }

  await requestWakeLock();
}

async function exitFocus() {
  $('#focus-overlay')?.classList.remove('open');

  await releaseWakeLock();

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.warn('Exit fullscreen failed:', error);
  }
}

function saveSettings() {
  const read = (id, min, max) => {
    const element = $(`#${id}`);
    const value = Number(element.value);

    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`Enter a value from ${min} to ${max}`);
    }

    return value;
  };

  try {
    data.settings.focusMinutes = read('focus-min', 1, 180);
    data.settings.shortBreakMinutes = read('short-min', 1, 60);
    data.settings.longBreakMinutes = read('long-min', 1, 90);

    data.settings.animationStyle = $('#visual-style').value;
    data.settings.animationEnabled = $('#animation-on').value === 'true';

    data.settings.animationIntensity = read('intensity', 0, 100);
    data.settings.animationSpeed = read('speed', 0, 150);
    data.settings.particleCount = read('particles', 10, 160);

    save();
    setupVisualizers();
    setMode(mode);

    toast('Preferences saved.');
  } catch (error) {
    toast(error.message);
  }
}

// App click events
app.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button) return;

  if (button.dataset.tab) {
    document.querySelectorAll('.page').forEach(page => {
      page.classList.toggle('active', page.id === `page-${button.dataset.tab}`);
    });

    document.querySelectorAll('[data-tab]').forEach(item => {
      item.classList.toggle('active', item === button);
    });

    return;
  }

  if (button.dataset.mode) {
    if (timer.running) {
      toast('Pause the timer before changing mode.');
      return;
    }

    setMode(button.dataset.mode);
    return;
  }

  if (button.dataset.color) {
    data.settings.accent = button.dataset.color;

    save();
    applyTheme();
    setupVisualizers();

    document.querySelectorAll('[data-color]').forEach(item => {
      item.classList.toggle('active', item === button);
    });

    return;
  }

  if (button.dataset.delete) {
    data.tasks = data.tasks.filter(
      task => task.id !== Number(button.dataset.delete)
    );

    save();
    updateLists();
    updateStats();
    return;
  }

  switch (button.dataset.action) {
    case 'theme':
      data.settings.theme =
        data.settings.theme === 'dark' ? 'light' : 'dark';

      save();
      applyTheme();
      break;

    case 'reset':
      timer.reset();
      break;

    case 'add-subject': {
      const name = prompt('Subject name?')?.trim();

      if (
        name &&
        !data.subjects.some(s => s.toLowerCase() === name.toLowerCase())
      ) {
        data.subjects.push(name);
        subject = name;

        save();
        render();
        setMode(mode);
      }

      break;
    }

    case 'save-settings':
      saveSettings();
      break;

    case 'backup':
      DB.backup(data);
      break;

    case 'csv':
      DB.csv(data.sessions);
      break;

    case 'clear':
      if (confirm('Permanently erase all study data?')) {
        localStorage.removeItem('focus-flow-v2-data');
        data = DB.load();
        subject = data.subjects[0];

        timer.reset();
        render();
        setMode('focus');
      }
      break;

    case 'exit-focus':
      await exitFocus();
      break;
  }
});

// App change events
app.addEventListener('change', event => {
  if (event.target.id === 'subject-select') {
    subject = event.target.value;
    $('#focus-subject').textContent = subject;
  }

  if (event.target.dataset.check) {
    const task = data.tasks.find(
      item => item.id === Number(event.target.dataset.check)
    );

    if (task) task.done = event.target.checked;

    save();
    updateLists();
    updateStats();
  }

  if (event.target.id === 'restore' && event.target.files[0]) {
    DB.restore(event.target.files[0])
      .then(restored => {
        if (confirm('Replace current data with this backup?')) {
          data = restored;
          subject = data.subjects[0];

          save();
          render();
          setMode('focus');
        }
      })
      .catch(error => {
        console.error('Restore failed:', error);
        toast('Invalid backup file');
      });
  }
});

// Range input events
app.addEventListener('input', event => {
  const map = {
    intensity: 'intensity-value',
    speed: 'speed-value',
    particles: 'particle-value'
  };

  const id = event.target.id;

  if (map[id]) {
    const suffix = id === 'particles' ? '' : '%';
    $(`#${map[id]}`).textContent = event.target.value + suffix;
  }
});

// Task form
app.addEventListener('submit', event => {
  if (event.target.id !== 'task-form') return;

  event.preventDefault();

  const input = $('#task-input');
  const title = input.value.trim();

  if (!title) return;

  data.tasks.unshift({
    id: Date.now(),
    title,
    done: false
  });

  input.value = '';

  save();
  updateLists();
  updateStats();
});

// Visibility and cleanup
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && timer.running) {
    requestWakeLock();
  }
});

window.addEventListener('beforeunload', () => {
  timer.destroy();
  visualizer?.destroy();
  focusVisualizer?.destroy();
});

// CRITICAL: Render BEFORE accessing dynamically created buttons
try {
  render();
  setMode('focus');

  $('#start-focus').addEventListener('click', async () => {
    if (timer.running) {
      timer.pause();
      return;
    }

    await enterFocus();
    timer.start();
  });

  $('#focus-toggle').addEventListener('click', async () => {
    if (timer.running) {
      timer.pause();
      await releaseWakeLock();
    } else {
      await requestWakeLock();
      timer.start();
    }
  });

  console.info('FOCUS FLOW initialized successfully.');

} catch (error) {
  console.error('FOCUS FLOW initialization failed:', error);

  app.innerHTML = `
    <div style="padding:30px;color:#ff647c;text-align:center">
      <h2>FOCUS FLOW could not start</h2>
      <p>Please check the app files and reload.</p>
      <small>${esc(error.message)}</small>
    </div>
  `;
                          }
