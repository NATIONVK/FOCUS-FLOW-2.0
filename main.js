import './styles/base.css';
import { all, put, remove, clearAll } from './core/database.js';
import { TimerEngine } from './timer/timer-engine.js';
import { mountBlackHole } from './timer/blackhole.js';
import { haptic, scheduleFinishNotification, cancelFinishNotification, enterFullscreen } from './native/android.js';

const $ = (s, root=document) => root.querySelector(s);
const view = $('#view');
let page = 'home';
let color = localStorage.getItem('ff_color') || 'violet';
let engine;
let cleanupAnimation = null;
let currentMode = 'pomodoro';
let timerSnap = null;
let stopwatchMs = 0;
let focusSubject = localStorage.getItem('ff_subject') || 'General study';
const modes = [
  ['pomodoro','Pomodoro',25*60],['deepFocus','Deep Focus',50*60],
  ['shortBreak','Short Break',5*60],['longBreak','Long Break',15*60],
  ['stopwatch','Stopwatch',0]
];
const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const dateKey = d => new Date(d).toISOString().slice(0,10);
const today = dateKey(Date.now());
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const secondsLabel = s => s>=3600 ? `${(s/3600).toFixed(1)}h` : `${Math.round(s/60)}m`;

function setPage(next) {
  page = next;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $('#page-title').textContent = ({home:'Overview',timer:'Focus timer',tasks:'Tasks',notes:'Notes',analytics:'Analytics',settings:'Settings'})[page];
  render();
}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));
$('#theme-toggle').addEventListener('click',()=>{
  const next=document.documentElement.dataset.theme==='light'?'dark':'light';
  document.documentElement.dataset.theme=next;localStorage.setItem('ff_theme',next);
});
$('#quick-focus').addEventListener('click',()=>setPage('timer'));
const savedTheme=localStorage.getItem('ff_theme')||'dark';
document.documentElement.dataset.theme=savedTheme;
$('#today-label').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}).toUpperCase();

engine = new TimerEngine((snap, sw) => {
  timerSnap=snap;stopwatchMs=sw;
  const number=$('#timer-number');
  if(number) number.textContent=snap.mode==='stopwatch'?fmt(Math.floor(sw/1000)):fmt(snap.remaining);
  const status=$('#timer-status');
  if(status) status.textContent=snap.running?'Stay in the zone. You are doing great.':'Ready when you are';
  const toggle=$('#timer-toggle');
  if(toggle) toggle.textContent=snap.running?'Pause':'Start focus';
  const progress=$('#timer-progress');
  if(progress && snap.mode!=='stopwatch') progress.style.width=`${Math.max(0,Math.min(100,(1-snap.remaining/snap.duration)*100))}%`;
}, async snap => {
  await cancelFinishNotification();
  await haptic();
  await saveSession(snap.duration, focusSubject);
  alert('Focus session completed! Great work.');
  if(page==='home'||page==='analytics') render();
});

async function saveSession(seconds, subject) {
  if(seconds < 60) return;
  await put('sessions',{id:uid(),date:today,startedAt:Date.now()-seconds*1000,duration:seconds,subject,createdAt:Date.now()});
}
async function getData(){return {sessions:await all('sessions'),tasks:await all('tasks'),notes:await all('notes')};}

function render() {
  if(cleanupAnimation){cleanupAnimation();cleanupAnimation=null;}
  if(page==='home') renderHome();
  else if(page==='timer') renderTimer();
  else if(page==='tasks') renderTasks();
  else if(page==='notes') renderNotes();
  else if(page==='analytics') renderAnalytics();
  else renderSettings();
}
async function renderHome(){
  const d=await getData();const todays=d.sessions.filter(s=>s.date===today);
  const total=todays.reduce((n,s)=>n+s.duration,0);
  const done=d.tasks.filter(t=>t.done).length;
  view.innerHTML=`
    <section class="card hero"><div class="eyebrow">YOUR PERSONAL STUDY SPACE</div><h2>Make today <span>count.</span></h2><p class="muted">Every focused minute takes you closer to your goals. Build consistency, one session at a time.</p><div><button class="primary" id="hero-start">Start focusing ↗</button></div></section>
    <div class="grid grid-3" style="margin-top:18px">
      <div class="card stat"><div><div class="eyebrow">TODAY'S FOCUS</div><strong>${secondsLabel(total)}</strong><small>Time well invested</small></div><span>◷</span></div>
      <div class="card stat"><div><div class="eyebrow">SESSIONS</div><strong>${todays.length}</strong><small>Completed today</small></div><span>✦</span></div>
      <div class="card stat"><div><div class="eyebrow">TASKS DONE</div><strong>${done}/${d.tasks.length}</strong><small>Keep moving forward</small></div><span>✓</span></div>
    </div>
    <div class="grid grid-2" style="margin-top:18px">
      <section class="card"><div class="section-head"><h3>Quick focus</h3><button class="secondary" id="go-timer">Open timer</button></div><p class="muted">Current mode: ${esc(currentMode==='pomodoro'?'Pomodoro':modes.find(m=>m[0]===currentMode)?.[1]||currentMode)}</p><div style="font:600 42px 'Space Grotesk';margin:15px 0">${timerSnap?.mode==='stopwatch'?fmt(Math.floor(stopwatchMs/1000)):fmt(timerSnap?.remaining??1500)}</div><button class="primary" id="quick-start"> ${timerSnap?.running?'Pause':'Start'} </button></section>
      <section class="card"><div class="section-head"><h3>Recent sessions</h3><span class="muted">${todays.length} today</span></div>
      ${todays.length?`<div class="list">${todays.slice(-4).reverse().map(s=>`<div class="list-row"><span>◷</span><div class="grow"><b>${esc(s.subject||'Study')}</b><small>${new Date(s.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div><b>${secondsLabel(s.duration)}</b></div>`).join('')}</div>`:'<div class="empty">Your completed sessions will appear here.</div>'}</section>
    </div>`;
  $('#hero-start').onclick=()=>setPage('timer');$('#go-timer').onclick=()=>setPage('timer');
  $('#quick-start').onclick=()=>{timerSnap?.running?engine.pause():engine.start();haptic();};
}
function renderTimer(){
  view.innerHTML=`
    <div class="grid grid-2">
      <section class="card">
        <div class="eyebrow">CHOOSE YOUR SESSION</div>
        <div class="mode-row">${modes.map(m=>`<button class="chip ${currentMode===m[0]?'active':''}" data-mode="${m[0]}">${m[1]}</button>`).join('')}</div>
        <label class="field-label">Study subject</label><input class="field" id="subject-input" maxlength="50" value="${esc(focusSubject)}" placeholder="e.g. Statistics, Mathematics">
        <label class="field-label">Custom duration (minutes)</label><div style="display:flex;gap:8px"><input class="field" id="custom-minutes" type="number" min="1" max="1440" value="25"><button class="secondary" id="apply-custom">Apply</button></div>
        <div class="eyebrow" style="margin-top:20px">ENERGY COLOUR</div>
        <div class="color-row">${[['violet','#9b8cff'],['green','#42e6a4'],['red','#ff596f'],['gold','#ffc45c'],['blue','#45baff'],['rainbow','linear-gradient(135deg,#ff5c99,#ffd05c,#5ce7ff)']].map(c=>`<button class="chip ${color===c[0]?'active':''}" data-color="${c[0]}"><span class="color-dot" style="display:inline-block;vertical-align:middle;background:${c[1]}"></span> ${c[0]}</button>`).join('')}</div>
        <p class="muted" style="font-size:12px">Timer uses a deadline clock to recover elapsed time after the app is suspended.</p>
      </section>
      <section class="timer-shell" id="timer-shell">
        <canvas id="blackhole"></canvas>
        <div class="timer-content"><div class="eyebrow">FOCUS SESSION</div><div class="timer-number" id="timer-number">25:00</div><div id="timer-status" class="timer-state">Ready when you are</div><div class="progress" style="width:min(260px,70vw);margin:0 auto 20px"><span id="timer-progress" style="width:0%"></span></div>
        <div class="timer-actions"><button class="secondary" id="reset-timer">Reset</button><button class="primary" id="timer-toggle">Start focus</button><button class="secondary" id="fullscreen-btn">⛶</button></div></div>
      </section>
    </div>`;
  const canvas=$('#blackhole');cleanupAnimation=mountBlackHole(canvas,()=>color);
  const snap=engine.snapshot();
  if(snap.mode!==currentMode && !snap.running) {
    const m=modes.find(x=>x[0]===currentMode);
    if(m) engine.setMode(m[0],m[2]||1500);
  }
  $('#subject-input').onchange=e=>{focusSubject=e.target.value.trim()||'General study';localStorage.setItem('ff_subject',focusSubject);};
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{
    const m=modes.find(x=>x[0]===b.dataset.mode);currentMode=m[0];engine.setMode(m[0],m[2]||1500);renderTimer();
  });
  document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{color=b.dataset.color;localStorage.setItem('ff_color',color);renderTimer();});
  $('#apply-custom').onclick=()=>{const mins=Number($('#custom-minutes').value);if(!Number.isFinite(mins)||mins<1||mins>1440)return alert('Enter 1 to 1440 minutes.');currentMode='custom';engine.setMode('custom',Math.round(mins*60));renderTimer();};
  $('#timer-toggle').onclick=async()=>{
    if(engine.snapshot().running){engine.pause();await cancelFinishNotification();}
    else {engine.start();await scheduleFinishNotification(engine.snapshot().remaining);}
    await haptic();
  };
  $('#reset-timer').onclick=async()=>{engine.reset();await cancelFinishNotification();};
  $('#fullscreen-btn').onclick=enterFullscreen;
  const live=engine.snapshot();
  $('#timer-number').textContent=live.mode==='stopwatch'?fmt(Math.floor(engine.getStopwatch()/1000)):fmt(live.remaining);
  $('#timer-status').textContent=live.running?'Stay in the zone. You are doing great.':'Ready when you are';
  $('#timer-toggle').textContent=live.running?'Pause':'Start focus';
  $('#timer-progress').style.width=live.mode==='stopwatch'?'0%':`${Math.max(0,Math.min(100,(1-live.remaining/live.duration)*100))}%`;
}
async function renderTasks(){
  const tasks=await all('tasks');
  view.innerHTML=`<div class="grid grid-2"><section class="card"><h3>Create a task</h3><form id="task-form"><label class="field-label">Task title</label><input class="field" id="task-title" maxlength="120" required placeholder="What do you need to finish?"><label class="field-label">Subject</label><input class="field" id="task-subject" maxlength="50" placeholder="e.g. Statistics"><button class="primary">Add task</button></form></section><section class="card"><div class="section-head"><h3>Your tasks</h3><span class="muted">${tasks.filter(t=>!t.done).length} remaining</span></div>${tasks.length?`<div class="list">${tasks.sort((a,b)=>a.done-b.done).map(t=>`<div class="list-row"><input class="check" type="checkbox" data-check="${t.id}" ${t.done?'checked':''}><div class="grow"><b style="${t.done?'text-decoration:line-through;opacity:.6':''}">${esc(t.title)}</b><small>${esc(t.subject||'General')}</small></div><button class="danger" data-delete="${t.id}">×</button></div>`).join('')}</div>`:'<div class="empty">No tasks yet. Add your first task.</div>'}</section></div>`;
  $('#task-form').onsubmit=async e=>{e.preventDefault();await put('tasks',{id:uid(),title:$('#task-title').value.trim(),subject:$('#task-subject').value.trim(),done:false,createdAt:Date.now()});renderTasks();};
  document.querySelectorAll('[data-check]').forEach(el=>el.onchange=async()=>{const t=tasks.find(x=>x.id===el.dataset.check);t.done=el.checked;await put('tasks',t);renderTasks();});
  document.querySelectorAll('[data-delete]').forEach(el=>el.onclick=async()=>{await remove('tasks',el.dataset.delete);renderTasks();});
}
async function renderNotes(){
  const notes=await all('notes');
  view.innerHTML=`<div class="grid grid-2"><section class="card"><h3>Quick notes</h3><form id="note-form"><label class="field-label">Title</label><input class="field" id="note-title" maxlength="100" required placeholder="Note title"><label class="field-label">Write your note</label><textarea class="field" id="note-body" rows="7" maxlength="10000" placeholder="Ideas, formulas, reminders..."></textarea><button class="primary">Save note</button></form></section><section class="card"><h3 style="margin-bottom:16px">Saved notes</h3>${notes.length?`<div class="list">${notes.sort((a,b)=>b.updatedAt-a.updatedAt).map(n=>`<article class="list-row" style="align-items:flex-start"><div class="grow"><b>${esc(n.title)}</b><small>${new Date(n.updatedAt).toLocaleString()}</small><p class="note">${esc(n.body)}</p></div><button class="danger" data-note-delete="${n.id}">×</button></article>`).join('')}</div>`:'<div class="empty">Your notes are stored on this device.</div>'}</section></div>`;
  $('#note-form').onsubmit=async e=>{e.preventDefault();await put('notes',{id:uid(),title:$('#note-title').value.trim(),body:$('#note-body').value,updatedAt:Date.now()});renderNotes();};
  document.querySelectorAll('[data-note-delete]').forEach(b=>b.onclick=async()=>{await remove('notes',b.dataset.noteDelete);renderNotes();});
}
async function renderAnalytics(){
  const d=await getData();const total=d.sessions.reduce((n,s)=>n+s.duration,0);
  const last7=Array.from({length:7},(_,i)=>{const dt=new Date();dt.setDate(dt.getDate()-6+i);const k=dateKey(dt);return {day:dt.toLocaleDateString(undefined,{weekday:'short'}),sec:d.sessions.filter(s=>s.date===k).reduce((n,s)=>n+s.duration,0)};});
  const max=Math.max(1,...last7.map(x=>x.sec));
  const subjects={};d.sessions.forEach(s=>subjects[s.subject||'General']=(subjects[s.subject||'General']||0)+s.duration);
  view.innerHTML=`<div class="grid grid-3"><div class="card stat"><div><div class="eyebrow">TOTAL FOCUS</div><strong>${secondsLabel(total)}</strong><small>All recorded sessions</small></div></div><div class="card stat"><div><div class="eyebrow">SESSIONS</div><strong>${d.sessions.length}</strong><small>Completed sessions</small></div></div><div class="card stat"><div><div class="eyebrow">SUBJECTS</div><strong>${Object.keys(subjects).length}</strong><small>Subjects studied</small></div></div></div>
  <section class="card" style="margin-top:18px"><div class="section-head"><h3>Last 7 days</h3><span class="muted">Focus time</span></div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:10px;align-items:end;height:190px">${last7.map(x=>`<div style="text-align:center;display:flex;flex-direction:column;justify-content:end;height:100%;gap:8px"><small class="muted">${x.sec?secondsLabel(x.sec):'0m'}</small><div style="height:${Math.max(5,x.sec/max*120)}px;background:linear-gradient(180deg,var(--accent),#4b3b9c);border-radius:8px 8px 3px 3px"></div><small>${x.day}</small></div>`).join('')}</div></section>
  <section class="card" style="margin-top:18px"><div class="section-head"><h3>Subject breakdown</h3><button class="secondary" id="export-csv">Export CSV</button></div>${Object.keys(subjects).length?`<div class="list">${Object.entries(subjects).sort((a,b)=>b[1]-a[1]).map(([name,sec])=>`<div><div class="stat"><b>${esc(name)}</b><b>${secondsLabel(sec)}</b></div><div class="progress"><span style="width:${sec/total*100}%"></span></div></div>`).join('')}</div>`:'<div class="empty">Complete a focus session to see analytics.</div>'}</section>`;
  $('#export-csv').onclick=()=>download('focus-flow-sessions.csv','date,subject,duration_seconds,created_at\\n'+d.sessions.map(s=>[s.date,JSON.stringify(s.subject||''),s.duration,s.createdAt].join(',')).join('\\n'),'text/csv');
}
async function renderSettings(){
  view.innerHTML=`<div class="grid grid-2"><section class="card"><h3>Appearance</h3><div class="setting-row"><div><b>Theme</b><small class="muted" style="display:block">Choose your workspace style</small></div><button class="secondary" id="theme-setting">Switch theme</button></div><div class="setting-row"><div><b>Timer animation</b><small class="muted" style="display:block">Colour effect on the focus screen</small></div><span class="muted">${esc(color)}</span></div></section><section class="card"><h3>Data & privacy</h3><p class="muted">Your sessions, tasks and notes are stored locally in this browser/app using IndexedDB.</p><div class="list"><button class="secondary" id="backup">Download backup (JSON)</button><label class="secondary" style="display:block;text-align:center;padding:12px;border-radius:12px;cursor:pointer">Restore backup<input type="file" id="restore-file" accept="application/json" hidden></label><button class="danger" id="clear-data">Delete all local data</button></div></section></div>
  <section class="card" style="margin-top:18px"><h3>About FOCUS FLOW</h3><p class="muted">Version 2.0 · Developed by NATIONVK · Author: YEASIEN AHMED</p><p class="muted">FIND YOUR OWN PATH</p></section>`;
  $('#theme-setting').onclick=()=>$('#theme-toggle').click();
  $('#backup').onclick=async()=>{const data=await getData();download('focus-flow-backup.json',JSON.stringify({version:1,exportedAt:new Date().toISOString(),...data},null,2),'application/json');};
  $('#restore-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());for(const key of ['sessions','tasks','notes'])if(Array.isArray(data[key]))for(const item of data[key])if(item?.id)await put(key,item);alert('Backup restored.');renderSettings();}catch{alert('Invalid backup file.');}};
  $('#clear-data').onclick=async()=>{if(confirm('Delete all sessions, tasks and notes on this device? This cannot be undone.')){await clearAll();renderSettings();}};
}
function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}

render();
