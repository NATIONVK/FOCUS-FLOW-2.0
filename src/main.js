import './styles.css';
import { DB } from './database.js';
import { StudyTimer } from './timer.js';
import { BlackHole } from './blackhole.js';

const $ = (s, root=document) => root.querySelector(s);
const app = $('#app');
let data = DB.load();
let mode = 'focus', subject = data.subjects[0], visualizer = null, focusVisualizer = null, wakeLock = null;
const modes = { focus: data.settings.focusMinutes, short: data.settings.shortBreakMinutes, long: data.settings.longBreakMinutes };
const colors = { green:'#53e6a0', red:'#ff647c', gold:'#f4bd55', blue:'#5ba8ff', purple:'#b28aff' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => new Date().toLocaleDateString('en-CA');
const minsToday = () => data.sessions.filter(s=>s.date===today()).reduce((n,s)=>n+Number(s.duration),0);
const timer = new StudyTimer(updateTimer, completeSession);

function save(){ DB.save(data); }
function toast(msg){ const el=$('#toast'); if(!el)return; el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200); }
function applyTheme(){ document.body.classList.toggle('light',data.settings.theme==='light'); document.documentElement.style.setProperty('--accent',colors[data.settings.accent]||colors.green); document.documentElement.style.setProperty('--accent-soft',(colors[data.settings.accent]||colors.green)+'22'); }
function render(){
app.innerHTML=`
<div class="app">
<header class="topbar"><div class="brand"><div class="brand-mark">F</div><div><div class="brand-name">FOCUS FLOW</div><div class="brand-sub">STUDY SMARTER · FIND YOUR OWN PATH</div></div></div><div class="top-actions"><button class="icon-btn" data-action="theme" aria-label="Toggle theme">◐</button></div></header>
<div class="layout"><nav class="sidebar">
${[['home','⌂ Dashboard'],['tasks','☑ Tasks'],['history','◷ History'],['settings','⚙ Settings']].map(([id,label])=>`<button class="nav-btn ${id==='home'?'active':''}" data-tab="${id}">${label}</button>`).join('')}
</nav><main class="content">
<section class="page active" id="page-home">
<h1 class="heading">Your Focus Space</h1><p class="subheading">Every focused minute moves you forward.</p>
<div class="stats">
<div class="card"><div class="stat-label">TODAY'S STUDY</div><div class="stat-value" id="today-time">0m</div><div class="stat-note">Focused minutes</div></div>
<div class="card"><div class="stat-label">SESSIONS</div><div class="stat-value" id="today-count">0</div><div class="stat-note">Completed today</div></div>
<div class="card"><div class="stat-label">TASKS DONE</div><div class="stat-value" id="task-count">0</div><div class="stat-note">Keep going</div></div></div>
<div class="panel timer-panel"><div class="timer-head"><span>FOCUS TIMER</span><span id="timer-status">READY</span></div>
<div class="mode-row">${[['focus','Focus'],['short','Short Break'],['long','Long Break']].map(([id,l])=>`<button class="mode-btn ${id===mode?'active':''}" data-mode="${id}">${l}</button>`).join('')}</div>
<div class="visualizer"><canvas id="mini-canvas"></canvas><div class="readout"><div class="time" id="mini-time">25:00</div><div class="timer-label">READY TO FOCUS</div></div></div>
<div class="progress"><span id="mini-progress"></span></div><div class="controls"><button class="btn primary" id="start-focus">Start Focus</button><button class="btn" data-action="reset">Reset</button></div>
<div class="subject-row"><select id="subject-select">${data.subjects.map(s=>`<option ${s===subject?'selected':''}>${esc(s)}</option>`).join('')}</select><button class="btn" data-action="add-subject">+ Subject</button></div>
<p class="hint">Before starting, customize animation intensity, speed, particle count or choose a clean normal timer in Settings.</p></div>
<h2 class="section-title">Recent Sessions</h2><div class="list" id="recent"></div>
</section>
<section class="page" id="page-tasks"><h1 class="heading">Study Tasks</h1><p class="subheading">Plan your next small win.</p><div class="panel"><form class="form-row" id="task-form"><input id="task-input" maxlength="120" placeholder="Add a study task…" required><button class="btn primary">Add</button></form><div class="list" id="tasks"></div></div></section>
<section class="page" id="page-history"><h1 class="heading">Study History</h1><p class="subheading">Your completed focus sessions.</p><div class="panel"><div class="list" id="history"></div><div class="form-row"><button class="btn" data-action="csv">Export CSV</button><button class="btn" data-action="backup">Backup JSON</button></div></div></section>
<section class="page" id="page-settings"><h1 class="heading">Timer & Appearance</h1><p class="subheading">Set up your preferred experience before starting the timer.</p>
<div class="settings-grid">
<div class="setting"><label>Focus duration (minutes)</label><input id="focus-min" type="number" min="1" max="180" value="${data.settings.focusMinutes}"></div>
<div class="setting"><label>Short break (minutes)</label><input id="short-min" type="number" min="1" max="60" value="${data.settings.shortBreakMinutes}"></div>
<div class="setting"><label>Long break (minutes)</label><input id="long-min" type="number" min="1" max="90" value="${data.settings.longBreakMinutes}"></div>
<div class="setting"><label>Timer display</label><select id="visual-style"><option value="blackhole" ${data.settings.animationStyle==='blackhole'?'selected':''}>Animated Black Hole</option><option value="normal" ${data.settings.animationStyle==='normal'?'selected':''}>Normal Timer (no animation)</option></select></div>
<div class="setting"><label>Animation</label><select id="animation-on"><option value="true" ${data.settings.animationEnabled?'selected':''}>Enabled</option><option value="false" ${!data.settings.animationEnabled?'selected':''}>Disabled</option></select></div>
<div class="setting"><label>Animation intensity <span id="intensity-value">${data.settings.animationIntensity}%</span></label><div class="range-line"><input id="intensity" type="range" min="0" max="100" value="${data.settings.animationIntensity}"></div><small>Controls glow, ring brightness and visual strength.</small></div>
<div class="setting"><label>Animation speed <span id="speed-value">${data.settings.animationSpeed}%</span></label><div class="range-line"><input id="speed" type="range" min="0" max="150" value="${data.settings.animationSpeed}"></div><small>Controls how quickly the orbiting particles move.</small></div>
<div class="setting"><label>Particle count <span id="particle-value">${data.settings.particleCount}</span></label><div class="range-line"><input id="particles" type="range" min="10" max="160" value="${data.settings.particleCount}"></div><small>Lower values are smoother on older phones.</small></div>
</div>
<h2 class="section-title">Animation Color</h2><div class="panel"><div class="color-row">${Object.entries(colors).map(([k,v])=>`<button class="color-dot ${data.settings.accent===k?'active':''}" data-color="${k}" style="background:${v}" aria-label="${k}"></button>`).join('')}</div></div>
<div class="form-row"><button class="btn primary" data-action="save-settings">Save timer preferences</button><button class="btn" data-action="theme">Toggle theme</button></div>
<h2 class="section-title">Data</h2><div class="panel"><div class="form-row"><button class="btn" data-action="backup">Download backup</button><label class="btn">Restore backup<input id="restore" type="file" accept="application/json" hidden></label></div><button class="btn danger" data-action="clear">Reset all data</button></div>
</section>
</main></div><footer class="footer">FOCUS FLOW 2.0 · MADE WITH FOCUS · NATIONVK</footer></div>
<div class="focus-overlay" id="focus-overlay"><canvas id="focus-canvas"></canvas><button class="focus-exit" data-action="exit-focus">✕ Exit</button><div class="focus-ui"><div class="timer-label" id="focus-status">DEEP FOCUS</div><div class="time" id="focus-time">25:00</div><div class="focus-subject" id="focus-subject">${esc(subject)}</div><div class="focus-controls"><button class="btn primary" id="focus-toggle">Pause</button><button class="btn" data-action="reset">Reset</button></div><div class="focus-hint" id="focus-hint">Stay present. One task at a time.</div></div></div><div class="toast" id="toast"></div>`;
applyTheme(); setupVisualizers(); updateStats(); updateLists(); updateTimer({formatted:`${String(timer.remaining/60|0).padStart(2,'0')}:${String(timer.remaining%60).padStart(2,'0')}`,progress:0,running:false});
}
function visualOptions(){return {enabled:data.settings.animationEnabled&&data.settings.animationStyle==='blackhole',intensity:data.settings.animationIntensity,speed:data.settings.animationSpeed,particles:data.settings.particleCount,color:colors[data.settings.accent]};}
function setupVisualizers(){
visualizer?.destroy();focusVisualizer?.destroy();
const mini=$('#mini-canvas'),full=$('#focus-canvas');
if(mini)visualizer=new BlackHole(mini,visualOptions());
if(full)focusVisualizer=new BlackHole(full,visualOptions());
}
function updateStats(){
$('#today-time').textContent=`${minsToday()}m`;$('#today-count').textContent=data.sessions.filter(s=>s.date===today()).length;$('#task-count').textContent=data.tasks.filter(t=>t.done).length;
}
function updateLists(){
const recent=$('#recent'),hist=$('#history'),tasks=$('#tasks');
if(recent)recent.innerHTML=data.sessions.slice(0,4).map(s=>`<div class="list-item"><div><b>${esc(s.subject)}</b><small>${esc(s.date)}</small></div><b>${s.duration}m</b></div>`).join('')||'<div class="empty">Your completed sessions will appear here.</div>';
if(hist)hist.innerHTML=data.sessions.slice(0,100).map(s=>`<div class="list-item"><div><b>${esc(s.subject)}</b><small>${esc(s.date)} · ${new Date(s.completedAt).toLocaleTimeString()}</small></div><b>${s.duration}m</b></div>`).join('')||'<div class="empty">No completed sessions yet.</div>';
if(tasks)tasks.innerHTML=data.tasks.map(t=>`<div class="list-item ${t.done?'done':''}"><label class="task-label"><input class="check" type="checkbox" data-check="${t.id}" ${t.done?'checked':''}><span class="task-title">${esc(t.title)}</span></label><button class="btn danger" data-delete="${t.id}">Delete</button></div>`).join('')||'<div class="empty">No tasks yet. Add your first task.</div>';
}
function updateTimer(state){
for(const id of ['mini-time','focus-time']){const el=$(`#${id}`);if(el)el.textContent=state.formatted;}
const p=$('#mini-progress');if(p)p.style.width=`${state.progress*100}%`;
const status=$('#timer-status');if(status)status.textContent=state.running?'RUNNING':'READY';
const start=$('#start-focus');if(start)start.textContent=state.running?'Pause':'Start Focus';
const toggle=$('#focus-toggle');if(toggle)toggle.textContent=state.running?'Pause':'Resume';
const label=$('#focus-status');if(label)label.textContent=state.running?'DEEP FOCUS':'FOCUS PAUSED';
}
function setMode(next){
if(!['focus','short','long'].includes(next))return;
mode=next;const n=mode==='focus'?data.settings.focusMinutes:mode==='short'?data.settings.shortBreakMinutes:data.settings.longBreakMinutes;
timer.setDuration(n*60);
document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
updateTimer({formatted:`${String(n).padStart(2,'0')}:00`,progress:0,running:false});
}
function completeSession(){
if(mode==='focus'){data.sessions.unshift({id:Date.now(),date:today(),subject,duration:data.settings.focusMinutes,completedAt:new Date().toISOString()});save();toast('Focus session completed. Well done!');}
else toast('Break finished. Ready for another session?');
if(navigator.vibrate)navigator.vibrate([150,80,150]);updateStats();updateLists();exitFocus();
}
async function requestWakeLock(){try{if('wakeLock'in navigator)wakeLock=await navigator.wakeLock.request('screen');}catch{}}
async function releaseWakeLock(){try{await wakeLock?.release();}catch{}wakeLock=null;}
async function enterFocus(){
$('#focus-overlay').classList.add('open');$('#focus-subject').textContent=subject;
try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.();}catch{}
await requestWakeLock();
}
async function exitFocus(){
$('#focus-overlay')?.classList.remove('open');await releaseWakeLock();
try{if(document.fullscreenElement)await document.exitFullscreen();}catch{}
}
function saveSettings(){
const read=(id,min,max)=>{const v=Number($(`#${id}`).value);if(!Number.isInteger(v)||v<min||v>max)throw new Error(`Enter a value from ${min} to ${max}`);return v;};
try{
data.settings.focusMinutes=read('focus-min',1,180);
data.settings.shortBreakMinutes=read('short-min',1,60);
data.settings.longBreakMinutes=read('long-min',1,90);
data.settings.animationStyle=$('#visual-style').value;
data.settings.animationEnabled=$('#animation-on').value==='true';
data.settings.animationIntensity=read('intensity',0,100);
data.settings.animationSpeed=read('speed',0,150);
data.settings.particleCount=read('particles',10,160);
save();setupVisualizers();setMode(mode);toast('Preferences saved. Start when ready.');
}catch(e){toast(e.message);}
}
$('#app').addEventListener('click',async e=>{
const b=e.target.closest('button');if(!b)return;
if(b.dataset.tab){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${b.dataset.tab}`));document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));return;}
if(b.dataset.mode){if(timer.running){toast('Pause the timer before changing mode.');return;}setMode(b.dataset.mode);return;}
if(b.dataset.color){data.settings.accent=b.dataset.color;save();applyTheme();setupVisualizers();render();document.querySelector('[data-tab="settings"]')?.click();return;}
if(b.dataset.delete){data.tasks=data.tasks.filter(t=>t.id!==Number(b.dataset.delete));save();updateLists();updateStats();return;}
switch(b.dataset.action){
case'theme':data.settings.theme=data.settings.theme==='dark'?'light':'dark';save();applyTheme();break;
case'reset':timer.reset();break;
case'add-subject':{const name=prompt('Subject name?')?.trim();if(name&&!data.subjects.some(s=>s.toLowerCase()===name.toLowerCase())){data.subjects.push(name);subject=name;save();render();}break;}
case'save-settings':saveSettings();break;
case'backup':DB.backup(data);break;
case'csv':DB.csv(data.sessions);break;
case'clear':if(confirm('Permanently erase all study data?')){localStorage.removeItem('focus-flow-v2-data');data=DB.load();subject=data.subjects[0];timer.reset();render();}break;
case'exit-focus':await exitFocus();break;
}
});
$('#app').addEventListener('change',e=>{
if(e.target.id==='subject-select')subject=e.target.value;
if(e.target.dataset.check){const t=data.tasks.find(x=>x.id===Number(e.target.dataset.check));if(t)t.done=e.target.checked;save();updateLists();updateStats();}
if(e.target.id==='restore'&&e.target.files[0])DB.restore(e.target.files[0]).then(d=>{if(confirm('Replace current data with this backup?')){data=d;subject=data.subjects[0];save();render();}}).catch(()=>toast('Invalid backup file'));
});
$('#app').addEventListener('input',e=>{
const map={intensity:'intensity-value',speed:'speed-value',particles:'particle-value'};
if(map[e.target.id])$(`#${map[e.target.id]}`).textContent=e.target.value+(e.target.id==='particles'?'':'%');
});
$('#app').addEventListener('submit',e=>{
if(e.target.id!=='task-form')return;e.preventDefault();const input=$('#task-input'),title=input.value.trim();if(!title)return;data.tasks.unshift({id:Date.now(),title,done:false});input.value='';save();updateLists();
});
$('#start-focus').addEventListener('click',async()=>{
if(timer.running){timer.pause();return;}
await enterFocus();timer.start();
});
$('#focus-toggle').addEventListener('click',async()=>{
if(timer.running){timer.pause();await releaseWakeLock();}else{await requestWakeLock();timer.start();}
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&timer.running)requestWakeLock();});
window.addEventListener('beforeunload',()=>{timer.destroy();visualizer?.destroy();focusVisualizer?.destroy();});
render();setMode('focus');
