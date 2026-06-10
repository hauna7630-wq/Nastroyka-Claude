// Coordinator UI (PRD M5): a zero-dependency single page served by the control
// plane. Three tabs:
//   • Координатор — submit a task, watch the live agent-assembly graph (SSE).
//   • Команда (Team Builder) — list + create agents (digital employees).
//   • Админ — token burn per agent + DLQ (with requeue).

export const COORDINATOR_HTML = /* html */ `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>agent-os</title>
<style>
  :root { --bg:#0f1419; --card:#1b232c; --fg:#e6edf3; --muted:#8b949e; --accent:#2f81f7;
          --ok:#2ea043; --run:#d29922; --fail:#f85149; --border:#30363d; }
  * { box-sizing:border-box; } body { margin:0; font-family:-apple-system,Segoe UI,Roboto,sans-serif;
       background:var(--bg); color:var(--fg); }
  header { padding:16px 24px; border-bottom:1px solid var(--border); font-weight:700; display:flex; gap:18px; align-items:center; }
  nav { display:flex; gap:6px; margin-left:auto; font-weight:400; }
  nav button { background:transparent; color:var(--muted); border:1px solid transparent; border-radius:8px; padding:6px 14px; cursor:pointer; font:inherit; }
  nav button.active { background:var(--card); color:var(--fg); border-color:var(--border); }
  main { max-width:880px; margin:0 auto; padding:24px; }
  .tab { display:none; } .tab.active { display:block; }
  form { display:flex; gap:8px; margin-bottom:16px; }
  input, textarea, select { background:var(--card); color:var(--fg); border:1px solid var(--border);
             border-radius:8px; padding:9px 12px; font:inherit; }
  textarea { resize:vertical; min-height:52px; }
  button.primary { background:var(--accent); color:#fff; border:0; border-radius:8px; padding:10px 18px; font:inherit; cursor:pointer; }
  button.primary:disabled { opacity:.5; cursor:default; }
  .section-title { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.05em; margin:18px 0 8px; }
  .graph { display:flex; gap:10px; flex-wrap:wrap; }
  .node { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:12px 14px; min-width:170px; }
  .node .role { font-size:12px; color:var(--muted); } .node .name { font-weight:600; margin:2px 0 8px; }
  .badge { display:inline-block; font-size:12px; padding:2px 8px; border-radius:999px; }
  .badge.queued { background:#30363d; color:var(--muted); }
  .badge.running { background:rgba(210,153,34,.18); color:var(--run); }
  .badge.succeeded { background:rgba(46,160,67,.18); color:var(--ok); }
  .badge.failed { background:rgba(248,81,73,.18); color:var(--fail); }
  .arrow { align-self:center; color:var(--muted); }
  .result { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:16px; margin-top:18px; white-space:pre-wrap; }
  .status { color:var(--muted); font-size:13px; margin-top:6px; min-height:18px; }
  table { width:100%; border-collapse:collapse; } th,td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--border); font-size:14px; }
  th { color:var(--muted); font-weight:600; font-size:12px; text-transform:uppercase; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .tag { display:inline-block; background:#30363d; color:var(--muted); border-radius:6px; padding:1px 7px; font-size:12px; margin:0 4px 4px 0; }
  small.muted { color:var(--muted); }
  #officeWrap { margin:10px 0 4px; }
  canvas#office { width:100%; max-width:920px; image-rendering:pixelated; border:1px solid var(--border); border-radius:10px; background:#0b0f14; display:block; }
  .office-legend { display:flex; gap:12px; flex-wrap:wrap; margin-top:6px; }
  .office-legend span { font-size:12px; color:var(--muted); }
  .office-legend i { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:4px; vertical-align:middle; }
  .staff-wrap { display:grid; grid-template-columns:230px 1fr; gap:14px; }
  .staff-list { display:flex; flex-direction:column; gap:6px; max-height:460px; overflow:auto; }
  .staff-item { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:9px 11px; cursor:pointer; }
  .staff-item:hover { border-color:var(--accent); }
  .staff-item.active { border-color:var(--accent); background:#11202f; }
  .staff-item .role { font-size:11px; color:var(--muted); margin-top:2px; }
  .chat { display:flex; flex-direction:column; height:460px; border:1px solid var(--border); border-radius:10px; background:var(--card); }
  .chat-head { padding:11px 13px; border-bottom:1px solid var(--border); font-weight:600; }
  .chat-log { flex:1; overflow:auto; padding:13px; display:flex; flex-direction:column; gap:9px; }
  .msg { max-width:82%; padding:8px 11px; border-radius:10px; white-space:pre-wrap; font-size:14px; line-height:1.4; }
  .msg.me { align-self:flex-end; background:var(--accent); color:#fff; }
  .msg.them { align-self:flex-start; background:#0d1117; border:1px solid var(--border); }
  .msg .who { font-size:11px; color:var(--muted); margin-bottom:3px; }
  .chat-form { display:flex; gap:8px; padding:10px; border-top:1px solid var(--border); }
  .chat-form input { flex:1; }
  .actfeed { max-height:150px; overflow:auto; border:1px solid var(--border); border-radius:8px; background:#0d1117; padding:6px 10px; font-size:13px; }
  .actfeed .act { padding:3px 0; border-bottom:1px solid #161d24; }
  .actfeed .act-t { color:var(--muted); font-size:11px; margin-right:6px; }
</style>
</head>
<body>
<header>
  🤖 agent-os <span style="color:#2ea043;font-size:12px;font-weight:600">v12 · живой</span>
  <nav>
    <button data-tab="coord" class="active">Координатор</button>
    <button data-tab="staff">Сотрудники</button>
    <button data-tab="team">Команда</button>
    <button data-tab="admin">Админ</button>
  </nav>
</header>
<main>
  <!-- Координатор -->
  <section class="tab active" id="tab-coord">
    <form id="f">
      <textarea id="task" placeholder="Поставьте задачу команде агентов, например: Подготовь обзор рынка CRM и рекомендации"></textarea>
      <button id="go" class="primary" type="submit">Запустить</button>
    </form>
    <div class="status" id="cstatus"></div>
    <div id="officeWrap"><canvas id="office" width="900" height="520"></canvas><div class="office-legend" id="olegend"></div>
      <div class="section-title">Лента активности</div><div id="activityFeed" class="actfeed"></div></div>
    <div id="graphWrap" style="display:none"><div class="section-title">Граф сборки</div><div class="graph" id="graph"></div></div>
    <div id="resultWrap" style="display:none"><div class="section-title">Результат</div><div class="result" id="result"></div></div>
  </section>

  <!-- Сотрудники: личный чат с каждым -->
  <section class="tab" id="tab-staff">
    <div class="section-title">Личный чат: выберите сотрудника и поставьте задачу — он ответит</div>
    <div class="staff-wrap">
      <div class="staff-list" id="staffList"></div>
      <div class="chat">
        <div class="chat-head" id="chatHead">Выберите сотрудника слева</div>
        <div class="chat-log" id="chatLog"></div>
        <form class="chat-form" id="chatForm">
          <input id="chatInput" placeholder="Напишите задачу или вопрос…" autocomplete="off" disabled />
          <button class="primary" id="chatSend" type="submit" disabled>Отправить</button>
        </form>
      </div>
    </div>
  </section>

  <!-- Команда -->
  <section class="tab" id="tab-team">
    <div class="section-title">Нанять цифрового сотрудника</div>
    <div class="grid" style="margin-bottom:8px">
      <input id="a_name" placeholder="Имя, напр. Юрист" />
      <select id="a_type">
        <option value="researcher">researcher</option><option value="writer">writer</option>
        <option value="analyst">analyst</option><option value="coder">coder</option>
        <option value="reviewer">reviewer</option><option value="orchestrator">orchestrator</option>
      </select>
    </div>
    <textarea id="a_prompt" placeholder="System prompt / роль и инструкции" style="width:100%;margin-bottom:8px"></textarea>
    <div class="grid">
      <input id="a_tools" placeholder="Разрешённые инструменты через запятую (пусто = все)" />
      <button class="primary" id="a_create">Создать агента</button>
    </div>
    <div class="status" id="tstatus"></div>
    <div class="section-title">Команда</div>
    <div class="graph" id="agents"></div>
  </section>

  <!-- Админ -->
  <section class="tab" id="tab-admin">
    <div class="section-title">Расход токенов по агентам</div>
    <table><thead><tr><th>Агент</th><th>Тип</th><th>Токены</th></tr></thead><tbody id="burn"></tbody></table>
    <div class="section-title" style="margin-top:24px">Очередь мёртвых писем (DLQ)</div>
    <table><thead><tr><th>Run</th><th>Причина</th><th>Попыток</th><th></th></tr></thead><tbody id="dlq"></tbody></table>
  </section>
</main>
<script>
const ORG = 'demo';
const $ = (id) => document.getElementById(id);
const api = (p, opt) => fetch(p, opt).then((r) => r.json());

// --- tabs ---
document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('nav button').forEach((x) => x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
  b.classList.add('active'); $('tab-' + b.dataset.tab).classList.add('active');
  if (b.dataset.tab === 'team') loadAgents();
  if (b.dataset.tab === 'coord') loadOffice();
  if (b.dataset.tab === 'staff') loadStaff();
  if (b.dataset.tab === 'admin') loadAdmin();
}));

// --- Coordinator ---
let es = null;
const LABEL = { queued:'в очереди', running:'работает…', succeeded:'готово', failed:'ошибка' };
function node(sub){ const el=document.createElement('div'); el.className='node'; el.id='n_'+sub.id;
  el.innerHTML='<div class="role">'+sub.agentType+'</div><div class="name">'+(sub.agentName||sub.id)+'</div><span class="badge queued" id="b_'+sub.id+'">в очереди</span>'; return el; }
function setStatus(id,s,name){ const b=$('b_'+id); if(!b)return; b.className='badge '+s; b.textContent=LABEL[s]||s; if(name){const n=$('n_'+id).querySelector('.name'); if(n)n.textContent=name;} }
function render(out){ if(!out)return '(пусто)'; if(typeof out==='string')return out; let s=''; if(out.summary)s+=String(out.summary)+'\\n\\n'; if(out.subtasks)for(const k of Object.keys(out.subtasks))s+='• '+k+': '+String(out.subtasks[k])+'\\n'; return s||JSON.stringify(out,null,2); }
$('f').addEventListener('submit', async (e) => {
  e.preventDefault(); const task=$('task').value.trim(); if(!task)return;
  $('go').disabled=true; $('graph').innerHTML=''; $('graphWrap').style.display='none'; $('resultWrap').style.display='none';
  $('cstatus').textContent='Координатор анализирует задачу…'; if(es)es.close();
  officeResetIdle(); officeSet(null,'orchestrator','running');
  const { runId, error } = await api('/tasks',{method:'POST',body:JSON.stringify({orgId:ORG,task})});
  if(!runId){ $('cstatus').textContent='Ошибка: '+(error||'нет orchestrator-агента — создайте его во вкладке «Команда»'); $('go').disabled=false; return; }
  es = new EventSource('/runs/'+runId+'/events');
  es.addEventListener('orchestration.planned',(ev)=>{ const d=JSON.parse(ev.data).data; $('graphWrap').style.display='block';
    const g=$('graph'); g.innerHTML=''; d.subtasks.forEach((s,i)=>{ if(i>0){const a=document.createElement('div');a.className='arrow';a.textContent='→';g.appendChild(a);} g.appendChild(node(s)); });
    $('cstatus').textContent='Команда собрана: '+d.subtasks.map(s=>s.agentType).join(' → '); });
  es.addEventListener('orchestration.subtask',(ev)=>{ const d=JSON.parse(ev.data).data; setStatus(d.subtaskId,d.status,d.agentName); officeSet(d.agentName,d.agentType,d.status); });
  es.addEventListener('run.succeeded', async (ev)=>{ const e2=JSON.parse(ev.data); if(e2.runId!==runId)return;
    const r=await api('/runs/'+runId); $('resultWrap').style.display='block'; $('result').textContent=render(r.run&&r.run.output);
    $('cstatus').textContent='Готово ✓'; officeSet(null,'orchestrator','succeeded'); $('go').disabled=false; es.close(); });
  ['run.failed','run.needs_human'].forEach((t)=>es.addEventListener(t,(ev)=>{ const e2=JSON.parse(ev.data); if(e2.runId!==runId)return;
    $('cstatus').textContent = t==='run.needs_human'?'Требуется человек (лимит итераций).':'Задача завершилась с ошибкой.'; $('go').disabled=false; es.close(); }));
});

// --- Team Builder ---
async function loadAgents(){
  const agents = await api('/orgs/'+ORG+'/agents');
  const g=$('agents'); g.innerHTML='';
  agents.forEach((a)=>{ const el=document.createElement('div'); el.className='node'; el.style.minWidth='220px';
    const tools=(a.allowedTools&&a.allowedTools.length)?a.allowedTools.map(t=>'<span class="tag">'+t+'</span>').join(''):'<small class="muted">все инструменты</small>';
    el.innerHTML='<div class="role">'+a.type+'</div><div class="name">'+a.name+'</div>'+tools; g.appendChild(el); });
}
$('a_create').addEventListener('click', async ()=>{
  const name=$('a_name').value.trim(); if(!name){ $('tstatus').textContent='Укажите имя'; return; }
  const allowedTools=$('a_tools').value.split(',').map(s=>s.trim()).filter(Boolean);
  const res=await api('/agents',{method:'POST',body:JSON.stringify({orgId:ORG,name,type:$('a_type').value,systemPrompt:$('a_prompt').value,allowedTools})});
  if(res.id){ $('tstatus').textContent='Создан: '+res.name; $('a_name').value=''; $('a_prompt').value=''; $('a_tools').value=''; loadAgents(); }
  else $('tstatus').textContent='Ошибка: '+(res.error||'не удалось создать');
});

// --- Admin ---
async function loadAdmin(){
  const [agents, burn, dlq] = await Promise.all([ api('/orgs/'+ORG+'/agents'), api('/orgs/'+ORG+'/token-burn'), api('/dlq') ]);
  const byId={}; agents.forEach(a=>byId[a.id]=a);
  const tb=$('burn'); tb.innerHTML='';
  Object.keys(burn).forEach((id)=>{ const a=byId[id]||{}; const tr=document.createElement('tr');
    tr.innerHTML='<td>'+(a.name||id)+'</td><td>'+(a.type||'')+'</td><td>'+burn[id]+'</td>'; tb.appendChild(tr); });
  if(!Object.keys(burn).length) tb.innerHTML='<tr><td colspan="3"><small class="muted">пока нет данных — запустите задачу</small></td></tr>';
  const td=$('dlq'); td.innerHTML='';
  dlq.forEach((d)=>{ const tr=document.createElement('tr');
    tr.innerHTML='<td><small class="muted">'+d.runId.slice(0,8)+'…</small></td><td>'+d.failureReason+'</td><td>'+d.attempts+'</td><td><button class="primary" data-run="'+d.runId+'">Requeue</button></td>'; td.appendChild(tr); });
  if(!dlq.length) td.innerHTML='<tr><td colspan="4"><small class="muted">пусто</small></td></tr>';
  td.querySelectorAll('button[data-run]').forEach((b)=>b.addEventListener('click', async ()=>{ await api('/dlq/'+b.dataset.run+'/requeue',{method:'POST'}); loadAdmin(); }));
}

// --- Staff direct chat (polling + localStorage history) -------------------
var staffAgents=[]; var currentAgent=null;
var chatThreads={}; var chatPending={};
try { chatThreads = JSON.parse(localStorage.getItem('agentos_chat')||'{}'); } catch(e){ chatThreads={}; }
try { chatPending = JSON.parse(localStorage.getItem('agentos_chat_pending')||'{}'); } catch(e){ chatPending={}; }
function saveChat(){ try { localStorage.setItem('agentos_chat', JSON.stringify(chatThreads)); localStorage.setItem('agentos_chat_pending', JSON.stringify(chatPending)); } catch(e){} }
function escapeHtml(s){ return String(s).replace(/[&<>]/g,function(c){ return c==='&'?'&amp;':c==='<'?'&lt;':'&gt;'; }); }
function replyText(out){ if(out==null) return '(пустой ответ)'; if(typeof out==='string') return out; if(out.text) return out.text; if(out.summary) return out.summary; return JSON.stringify(out,null,2); }
async function loadStaff(){
  try { staffAgents = await api('/orgs/'+ORG+'/agents'); } catch(e){ staffAgents=[]; }
  var list=$('staffList'); list.innerHTML='';
  if(!staffAgents.length){ list.innerHTML='<small class="muted">Нет сотрудников — запустите сид команды.</small>'; return; }
  staffAgents.forEach(function(a){ var el=document.createElement('div'); el.className='staff-item'+(currentAgent&&currentAgent.id===a.id?' active':''); el.id='st_'+a.id;
    el.innerHTML='<div>'+escapeHtml(shortName(a.name))+'</div><div class="role">'+escapeHtml(roleOf(a))+'</div>';
    el.addEventListener('click', function(){ selectAgent(a.id); }); list.appendChild(el); });
}
function selectAgent(id){
  currentAgent = staffAgents.filter(function(a){ return a.id===id; })[0]; if(!currentAgent) return;
  document.querySelectorAll('.staff-item').forEach(function(x){ x.classList.remove('active'); });
  var c=$('st_'+id); if(c) c.classList.add('active');
  $('chatHead').textContent = shortName(currentAgent.name)+' — '+roleOf(currentAgent);
  $('chatInput').disabled=false; $('chatSend').disabled=false; $('chatInput').focus(); renderChat();
}
function renderChat(){
  if(!currentAgent) return; var log=$('chatLog'); log.innerHTML=''; var th=chatThreads[currentAgent.id]||[];
  th.forEach(function(m){ var el=document.createElement('div'); el.className='msg '+(m.role==='me'?'me':'them');
    el.innerHTML=(m.role==='me'?'':'<div class="who">'+escapeHtml(shortName(currentAgent.name))+'</div>')+escapeHtml(m.text); log.appendChild(el); });
  log.scrollTop=log.scrollHeight;
}
function pushMsg(agentId,role,text){ if(!chatThreads[agentId]) chatThreads[agentId]=[]; chatThreads[agentId].push({role:role,text:text}); saveChat(); if(currentAgent&&currentAgent.id===agentId) renderChat(); }
var chatTyping={};
function setReply(aid,idx,text){
  if(!(chatThreads[aid]&&chatThreads[aid][idx])) return;
  if(chatPending[aid]&&chatPending[aid].idx===idx) delete chatPending[aid];
  var full=String(text); var key=aid+'#'+idx;
  if(chatTyping[key]) clearInterval(chatTyping[key]);
  var shown=0; var step=Math.max(2,Math.ceil(full.length/140));
  chatThreads[aid][idx]={role:'them',text:''};
  if(currentAgent&&currentAgent.id===aid) renderChat();
  chatTyping[key]=setInterval(function(){
    shown=Math.min(full.length, shown+step);
    chatThreads[aid][idx].text=full.slice(0,shown);
    if(currentAgent&&currentAgent.id===aid) renderChat();
    if(shown>=full.length){ clearInterval(chatTyping[key]); delete chatTyping[key]; saveChat(); }
  },18);
}
function pollRun(aid, runId, idx, tries){
  tries = tries||0;
  if(tries > 120){ setReply(aid,idx,'(ответ слишком долго — попробуйте ещё раз)'); return; }
  api('/runs/'+runId).then(function(r){
    var run = r && r.run; var st = run && run.status;
    if(st==='succeeded') setReply(aid,idx, replyText(run.output));
    else if(st==='failed'||st==='canceled') setReply(aid,idx, '(не удалось выполнить задачу)');
    else if(st==='paused') setReply(aid,idx, '(нужно ваше решение — достигнут лимит итераций)');
    else setTimeout(function(){ pollRun(aid,runId,idx,tries+1); }, 2000);
  }).catch(function(){ setTimeout(function(){ pollRun(aid,runId,idx,tries+1); }, 2500); });
}
$('chatForm').addEventListener('submit', async function(e){
  e.preventDefault(); if(!currentAgent) return; var text=$('chatInput').value.trim(); if(!text) return;
  var aid=currentAgent.id;
  pushMsg(aid,'me',text); $('chatInput').value='';
  if(!chatThreads[aid]) chatThreads[aid]=[];
  chatThreads[aid].push({role:'them', text:'…'}); var idx=chatThreads[aid].length-1; saveChat(); renderChat();
  var resp = await api('/runs',{method:'POST',body:JSON.stringify({orgId:ORG,agentId:aid,input:{prompt:text}})});
  if(!resp||!resp.runId){ setReply(aid,idx,'Ошибка: '+((resp&&resp.error)||'не удалось запустить')); return; }
  chatPending[aid]={runId:resp.runId, idx:idx}; saveChat();
  pollRun(aid, resp.runId, idx);
});
// Resume any runs that were still pending when the page was last open.
Object.keys(chatPending).forEach(function(aid){ var p=chatPending[aid]; if(p&&p.runId!=null&&p.idx!=null) pollRun(aid,p.runId,p.idx); });

// --- Living pixel office --------------------------------------------------
var PX=3;
var SPR=["..HHHH..",".HHHHHH.",".HSSSSH.",".SSSSSS.",".SeSSeS.",".SSSSSS.",".CCCCCC.","CCCCCCCC","CCCCCCCC","CC.CC.CC",".PP..PP."];
var TYPE_COLOR={orchestrator:'#d29922',analyst:'#2ea043',researcher:'#2f81f7',writer:'#a371f7',coder:'#f0883e',reviewer:'#db61a2'};
var DEPT={orchestrator:'Управление',analyst:'Аналитика',researcher:'Исследования',writer:'Контент',coder:'Инженерия',reviewer:'QA'};
var SAY_WORK={researcher:['Ищу источники…','Собираю данные…'],analyst:['Анализирую…','Считаю варианты…'],writer:['Пишу черновик…','Редактирую текст…'],coder:['Пишу код…','Гоняю тесты…'],reviewer:['Проверяю…','Ищу баги…'],orchestrator:['Распределяю задачи','Собираю команду'],_def:['Работаю…']};
var SMALLTALK=['Кофе? ☕','Как дела?','Глянь мою задачу','Почти готово','Нужна помощь?','Класс! 👍','Я на созвоне','Передаю дальше','Согласен','Сделаю'];
var officeAgents=[]; var officeState={}; var officePos={}; var officeHome={}; var officeTgt={}; var officeDwell={}; var officeBubble={}; var officeMeetUntil={};
var officeFrame=0; var officeRAF=null; var offW=760, offH=440; var officeSim=null;
function roleColor(t){ return TYPE_COLOR[t]||'#8b949e'; }
function shortName(n){ return n.split(' — ')[0]; }
function roleOf(a){ return a.name.indexOf(' — ')>=0 ? a.name.split(' — ')[1] : a.type; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function hashStr(s){ var h=0; for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; } return h; }
function shade(hex,amt){ var c=String(hex).replace('#',''); if(c.length<6) return hex; var r=parseInt(c.substr(0,2),16),g=parseInt(c.substr(2,2),16),b=parseInt(c.substr(4,2),16); r=Math.max(0,Math.min(255,r+amt)); g=Math.max(0,Math.min(255,g+amt)); b=Math.max(0,Math.min(255,b+amt)); return 'rgb('+r+','+g+','+b+')'; }
function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
var SKINS=['#f1c79f','#e7b588','#d29b67','#b97f4f'];
var HAIRS=['#241a10','#3f2c1a','#5e4127','#7a5a32','#171720','#8a6a3a','#9a9aa2'];
var PANTS=['#33415a','#3a2f2a','#2d3640','#40354a','#2b3b34'];
function lookFor(a){ var h=hashStr(a.name); var shirt=roleColor(a.type); var styles=['short','short','long','bald','short','curly'];
  return { skin:SKINS[h%SKINS.length], hair:HAIRS[(h>>3)%HAIRS.length], hairStyle:styles[(h>>6)%styles.length],
    shirt:shirt, collar:shade(shirt,34), pants:PANTS[(h>>9)%PANTS.length],
    glasses:(a.type==='analyst'||a.type==='reviewer'||((h>>12)%3===0)) }; }
function drawCharacter(ctx,fx,fy,look,bob,step){
  fx=Math.round(fx); fy=Math.round(fy); bob=bob||0; var ty=-bob;
  var ph=step?Math.sin((officeFrame+fx)/3.2):0; var stride=Math.round(ph*3); ty-=step?Math.round(Math.abs(ph)*2):0;
  // shadow
  ctx.save(); ctx.globalAlpha=0.22; ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(fx,fy,13,4,0,0,Math.PI*2); ctx.fill(); ctx.restore();
  // legs + shoes (stride when walking)
  ctx.fillStyle=look.pants; ctx.fillRect(fx-6+stride,fy-12,5,12); ctx.fillRect(fx+1-stride,fy-12,5,12);
  ctx.fillStyle='#15191e'; ctx.fillRect(fx-7+stride,fy-3,6,3); ctx.fillRect(fx+1-stride,fy-3,6,3);
  // torso
  ctx.fillStyle=look.shirt; ctx.fillRect(fx-9,fy-30+ty,18,18);
  ctx.globalAlpha=0.12; ctx.fillStyle='#fff'; ctx.fillRect(fx-9,fy-30+ty,18,4); ctx.fillStyle='#000'; ctx.fillRect(fx+5,fy-30+ty,4,18); ctx.globalAlpha=1;
  ctx.fillStyle=look.collar; ctx.fillRect(fx-3,fy-30+ty,6,4);
  ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(fx-1,fy-26+ty,1,9);
  // arms + hands (swing while walking)
  var sw=Math.round(ph*3); ctx.fillStyle=look.shirt; ctx.fillRect(fx-12,fy-29+ty+sw,4,13); ctx.fillRect(fx+8,fy-29+ty-sw,4,13);
  ctx.fillStyle=look.skin; ctx.fillRect(fx-12,fy-16+ty+sw,4,3); ctx.fillRect(fx+8,fy-16+ty-sw,4,3);
  // neck + head
  ctx.fillStyle=look.skin; ctx.fillRect(fx-3,fy-33+ty,6,4); ctx.fillRect(fx-8,fy-48+ty,16,16);
  ctx.fillRect(fx-9,fy-41+ty,2,4); ctx.fillRect(fx+7,fy-41+ty,2,4); // ears
  // hair
  ctx.fillStyle=look.hair;
  if(look.hairStyle==='bald'){ ctx.fillRect(fx-9,fy-49+ty,18,3); ctx.fillRect(fx-9,fy-46+ty,3,6); ctx.fillRect(fx+6,fy-46+ty,3,6); }
  else { ctx.fillRect(fx-9,fy-50+ty,18,6); ctx.fillRect(fx-9,fy-46+ty,3,9); ctx.fillRect(fx+6,fy-46+ty,3,9);
    if(look.hairStyle==='long'){ ctx.fillRect(fx-10,fy-44+ty,3,13); ctx.fillRect(fx+7,fy-44+ty,3,13); }
    if(look.hairStyle==='curly'){ ctx.fillRect(fx-11,fy-50+ty,4,4); ctx.fillRect(fx+7,fy-50+ty,4,4); ctx.fillRect(fx-3,fy-52+ty,6,3); } }
  // face
  ctx.fillStyle='#3a2a1c'; ctx.fillRect(fx-5,fy-42+ty,3,1); ctx.fillRect(fx+2,fy-42+ty,3,1); // brows
  ctx.fillStyle='#15181c'; ctx.fillRect(fx-5,fy-40+ty,2,3); ctx.fillRect(fx+3,fy-40+ty,2,3); // eyes
  ctx.fillStyle='#9a5f4d'; ctx.fillRect(fx-2,fy-35+ty,4,1); // mouth
  if(look.glasses){ ctx.strokeStyle='#15181c'; ctx.lineWidth=1; ctx.strokeRect(fx-6,fy-41+ty,5,4); ctx.strokeRect(fx+1,fy-41+ty,5,4);
    ctx.beginPath(); ctx.moveTo(fx-1,fy-39+ty); ctx.lineTo(fx+1,fy-39+ty); ctx.stroke(); }
}
// --- isometric projection (2:1) ---
var ISO_TW2=34, ISO_TH2=17, ISO_OX=0, ISO_OY=70, GRIDW=13, GRIDH=8;
var DESK_TILES=[[6,2],[3,1],[9,1],[2,4],[10,3],[11,5],[3,6],[8,6]];
var MEET_TILE=[6,6];
function isoTop(gx,gy){ return { x: ISO_OX+(gx-gy)*ISO_TW2, y: ISO_OY+(gx+gy)*ISO_TH2 }; }
function groundAt(gx,gy){ return { x: ISO_OX+(gx-gy)*ISO_TW2, y: ISO_OY+(gx+gy)*ISO_TH2+ISO_TH2 }; }
function layoutOffice(){
  var cv=document.getElementById('office'); if(cv){ offW=cv.width; offH=cv.height; }
  var n=officeAgents.length; if(!n) return;
  ISO_OX=Math.round(offW/2); ISO_OY=72;
  var ord=officeAgents.slice().sort(function(a,b){ return (b.type==='orchestrator'?1:0)-(a.type==='orchestrator'?1:0); });
  for(var i=0;i<ord.length;i++){ var a=ord[i]; var t=DESK_TILES[i%DESK_TILES.length];
    officeHome[a.name]={gx:t[0],gy:t[1]};
    if(!officePos[a.name]) officePos[a.name]={gx:t[0],gy:t[1]};
    officeTgt[a.name]={gx:t[0],gy:t[1]}; officeDwell[a.name]=120+Math.floor(Math.random()*200); }
}
function setBubble(name,text,frames){ officeBubble[name]={text:text, until:officeFrame+(frames||200)}; }
function pushActivity(text){
  var f=document.getElementById('activityFeed'); if(!f) return;
  var row=document.createElement('div'); row.className='act';
  var t=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  row.innerHTML='<span class="act-t">'+t+'</span> '+text; f.insertBefore(row,f.firstChild);
  while(f.children.length>40) f.removeChild(f.lastChild);
}
function socialTile(){ var pts=[{gx:MEET_TILE[0],gy:MEET_TILE[1]},{gx:11,gy:7},{gx:2,gy:7},{gx:GRIDW-2,gy:1}]; return pick(pts); }
function updateOffice(){
  officeAgents.forEach(function(a){ var nm=a.name; var home=officeHome[nm]; if(!home) return; var st=officeState[nm]||'idle';
    var tgt;
    if(st==='working'||st==='done'||st==='failed'){ tgt=home; }
    else if(officeMeetUntil[nm] && officeFrame<officeMeetUntil[nm]){ tgt=officeTgt[nm]; }
    else { officeDwell[nm]=(officeDwell[nm]||0)-1; if(officeDwell[nm]<=0){ tgt = Math.random()<0.45 ? socialTile() : home; officeTgt[nm]=tgt; officeDwell[nm]=180+Math.floor(Math.random()*260); } tgt=officeTgt[nm]; }
    var p=officePos[nm]; if(!p){ p={gx:home.gx,gy:home.gy}; officePos[nm]=p; }
    p.gx += (tgt.gx-p.gx)*0.06; p.gy += (tgt.gy-p.gy)*0.06;
  });
}
function isoBox(ctx,sx,sy,hw,hh,h,top,left,right){
  var Tx=sx,Ty=sy-h-hh, Rx=sx+hw,Ry=sy-h, Fx=sx,Fy=sy-h+hh, Lx=sx-hw,Ly=sy-h;
  var Fbx=sx,Fby=sy+hh, Rbx=sx+hw,Rby=sy, Lbx=sx-hw,Lby=sy;
  ctx.fillStyle=right; ctx.beginPath(); ctx.moveTo(Fx,Fy); ctx.lineTo(Rx,Ry); ctx.lineTo(Rbx,Rby); ctx.lineTo(Fbx,Fby); ctx.closePath(); ctx.fill();
  ctx.fillStyle=left; ctx.beginPath(); ctx.moveTo(Lx,Ly); ctx.lineTo(Fx,Fy); ctx.lineTo(Fbx,Fby); ctx.lineTo(Lbx,Lby); ctx.closePath(); ctx.fill();
  ctx.fillStyle=top; ctx.beginPath(); ctx.moveTo(Tx,Ty); ctx.lineTo(Rx,Ry); ctx.lineTo(Fx,Fy); ctx.lineTo(Lx,Ly); ctx.closePath(); ctx.fill();
}
function drawCubicle(ctx,gx,gy,color){
  var wallH=26; var T=isoTop(gx,gy);
  var R={x:T.x+ISO_TW2,y:T.y+ISO_TH2}, L={x:T.x-ISO_TW2,y:T.y+ISO_TH2};
  var T2={x:T.x,y:T.y-wallH}, R2={x:R.x,y:R.y-wallH}, L2={x:L.x,y:L.y-wallH};
  // back-right panel (edge T-R)
  ctx.fillStyle='#3a444f'; ctx.beginPath(); ctx.moveTo(T.x,T.y); ctx.lineTo(R.x,R.y); ctx.lineTo(R2.x,R2.y); ctx.lineTo(T2.x,T2.y); ctx.closePath(); ctx.fill();
  // back-left panel (edge T-L)
  ctx.fillStyle='#2f3741'; ctx.beginPath(); ctx.moveTo(T.x,T.y); ctx.lineTo(L.x,L.y); ctx.lineTo(L2.x,L2.y); ctx.lineTo(T2.x,T2.y); ctx.closePath(); ctx.fill();
  // department-coloured top rail
  ctx.strokeStyle=color; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(L2.x,L2.y); ctx.lineTo(T2.x,T2.y); ctx.lineTo(R2.x,R2.y); ctx.stroke();
}
function drawRoleProps(ctx,x,y,type){
  if(type==='analyst'){ ctx.fillStyle='#0e1318'; ctx.fillRect(x+17,y-27,17,15); ctx.fillStyle='#16323f'; ctx.fillRect(x+19,y-25,13,11);
    var bars=[6,10,4,8]; for(var i=0;i<4;i++){ ctx.fillStyle='#2ea043'; ctx.fillRect(x+20+i*3,y-14-bars[i],2,bars[i]); } }
  else if(type==='researcher'){ var bc=['#c0563c','#2f81f7','#d29922']; for(var i=0;i<3;i++){ ctx.fillStyle=bc[i]; ctx.fillRect(x-32,y-7-i*3,13,3); }
    ctx.strokeStyle='#cfd6dc'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(x-35,y-13,3,0,Math.PI*2); ctx.moveTo(x-33,y-11); ctx.lineTo(x-30,y-8); ctx.stroke(); }
  else if(type==='coder'){ ctx.fillStyle='#0e1318'; ctx.fillRect(x+16,y-25,18,16); ctx.fillStyle='#0c241a'; ctx.fillRect(x+18,y-23,14,12);
    ctx.fillStyle='#3fae5a'; for(var i=0;i<4;i++) ctx.fillRect(x+19,y-21+i*2.6,7+(i%2)*4,1); }
  else if(type==='reviewer'){ ctx.fillStyle='#eceff2'; ctx.fillRect(x+17,y-23,12,16); ctx.fillStyle='#9aa4ad'; ctx.fillRect(x+21,y-25,4,2);
    ctx.strokeStyle='#2ea043'; ctx.lineWidth=1.4; for(var i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(x+19,y-18+i*4); ctx.lineTo(x+20.5,y-16.5+i*4); ctx.lineTo(x+23,y-19+i*4); ctx.stroke(); } }
  else if(type==='writer'){ ctx.fillStyle='#eceff2'; ctx.fillRect(x+17,y-23,12,16); ctx.fillStyle='#9aa4ad'; for(var i=0;i<5;i++) ctx.fillRect(x+19,y-20+i*3,8,1);
    ctx.strokeStyle='#d29922'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x+27,y-10); ctx.lineTo(x+31,y-15); ctx.stroke(); }
  else if(type==='orchestrator'){ ctx.fillStyle='#0e1318'; ctx.fillRect(x+16,y-27,21,17); var ns=[[x+20,y-23],[x+31,y-21],[x+25,y-14]];
    ctx.strokeStyle='#8b949e'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(ns[0][0],ns[0][1]); ctx.lineTo(ns[1][0],ns[1][1]); ctx.lineTo(ns[2][0],ns[2][1]); ctx.stroke();
    ctx.fillStyle='#d29922'; ns.forEach(function(n){ ctx.beginPath(); ctx.arc(n[0],n[1],2,0,Math.PI*2); ctx.fill(); }); } }
function drawStation(ctx,a){
  var nm=a.name; var home=officeHome[nm]; if(!home) return; var p=officePos[nm]||home; var st=officeState[nm]||'idle'; var col=roleColor(a.type);
  var dg=groundAt(home.gx,home.gy); var pg=groundAt(p.gx,p.gy);
  var dist=Math.abs(p.gx-home.gx)+Math.abs(p.gy-home.gy); var atDesk=dist<0.3; var walking=!atDesk;
  var step=walking?(Math.floor(officeFrame/7)%2===0):false;
  var bob=(st==='working'&&atDesk)?(Math.sin((officeFrame+dg.x)/9)>0?1:0):0;
  var look=a._look||(a._look=lookFor(a));
  // cubicle partitions (back edges) — department room divider, behind the person
  drawCubicle(ctx, home.gx, home.gy, col);
  // person (feet on iso ground)
  drawCharacter(ctx, pg.x, pg.y, look, bob, step);
  // desk as iso box
  isoBox(ctx, dg.x, dg.y-2, 32, 16, 13, '#7a5a32','#5d4427','#49351f');
  // mug + papers on the desk top
  ctx.fillStyle=col; ctx.fillRect(dg.x-22,dg.y-9,6,7); ctx.fillStyle='#eceff2'; ctx.fillRect(dg.x+13,dg.y-7,10,6);
  // monitor (billboard at the back of the desk)
  var mx=dg.x, my=dg.y-22;
  ctx.fillStyle='#0e1318'; roundRect(ctx,mx-15,my-12,30,20,2); ctx.fill();
  var screen=(!atDesk||st==='idle')?'#2a3742' : st==='done'?'#2ea043' : st==='failed'?'#f85149' : col;
  if(st==='working'&&atDesk){ ctx.globalAlpha=0.62+0.38*(0.5+0.5*Math.sin(officeFrame/6)); }
  ctx.fillStyle=screen; ctx.fillRect(mx-13,my-10,26,15); ctx.globalAlpha=1;
  if(atDesk){ ctx.fillStyle='rgba(255,255,255,.42)'; ctx.fillRect(mx-10,my-7,15,1); ctx.fillRect(mx-10,my-4,11,1); ctx.fillRect(mx-10,my-1,17,1); ctx.fillRect(mx-10,my+2,8,1); }
  ctx.fillStyle='#0e1318'; ctx.fillRect(mx-2,my+8,4,3);
  var dot=st==='working'?'#d29922':st==='done'?'#2ea043':st==='failed'?'#f85149':'#3a4450';
  ctx.fillStyle=dot; ctx.beginPath(); ctx.arc(mx+17,my-10,2.5,0,Math.PI*2); ctx.fill();
  // role-specific desk props (analyst charts, coder 2nd monitor, researcher books, …)
  if(atDesk) drawRoleProps(ctx, dg.x, dg.y, a.type);
  // speech bubble above person
  var b=officeBubble[nm];
  if(b && officeFrame<b.until){ ctx.font='11px system-ui,Segoe UI,sans-serif'; var w=ctx.measureText(b.text).width+14;
    var bx=Math.round(pg.x-w/2), by=Math.round(pg.y-62);
    ctx.fillStyle='#f4f7fa'; roundRect(ctx,bx,by,w,18,5); ctx.fill();
    ctx.fillStyle='#0d1117'; ctx.textAlign='center'; ctx.fillText(b.text,pg.x,by+13);
    ctx.fillStyle='#f4f7fa'; ctx.beginPath(); ctx.moveTo(pg.x-3,by+18); ctx.lineTo(pg.x+4,by+18); ctx.lineTo(pg.x,by+22); ctx.fill(); }
  // name + role under the desk
  ctx.fillStyle='#eef2f6'; ctx.font='bold 11px system-ui,Segoe UI,sans-serif'; ctx.textAlign='center'; ctx.fillText(shortName(a.name),dg.x,dg.y+22);
  ctx.fillStyle='#9aa4ad'; ctx.font='9px system-ui,Segoe UI,sans-serif'; ctx.fillText(roleOf(a),dg.x,dg.y+33);
  // department name plate above the cubicle
  var ct=isoTop(home.gx,home.gy); var dep=DEPT[a.type]||roleOf(a);
  ctx.font='bold 9px system-ui,Segoe UI,sans-serif'; var dw=ctx.measureText(dep).width+10;
  ctx.fillStyle='rgba(13,17,23,.62)'; roundRect(ctx,ct.x-dw/2,ct.y-42,dw,13,3); ctx.fill();
  ctx.fillStyle=col; ctx.textAlign='center'; ctx.fillText(dep,ct.x,ct.y-33);
}
function lerpP(a,b,t){ return {x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t}; }
function drawWall(ctx,A,B,h,base,topc,nwin){
  var A2={x:A.x,y:A.y-h}, B2={x:B.x,y:B.y-h};
  var g=ctx.createLinearGradient(0,Math.min(A2.y,B2.y),0,Math.max(A.y,B.y)); g.addColorStop(0,topc); g.addColorStop(1,base);
  ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.lineTo(B2.x,B2.y); ctx.lineTo(A2.x,A2.y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.10)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(A2.x,A2.y); ctx.lineTo(B2.x,B2.y); ctx.stroke();
  var dir={x:B.x-A.x,y:B.y-A.y};
  for(var k=0;k<nwin;k++){ var t=(k+0.5)/nwin; var c=lerpP(A,B,t); var ww=0.09, up=h*0.78, wh=h*0.5;
    var p0={x:c.x-dir.x*ww, y:c.y-dir.y*ww-up}, p1={x:c.x+dir.x*ww, y:c.y+dir.y*ww-up}, p2={x:p1.x,y:p1.y-wh}, p3={x:p0.x,y:p0.y-wh};
    var sg=ctx.createLinearGradient(0,p3.y,0,p0.y); sg.addColorStop(0,'#7fb6e6'); sg.addColorStop(1,'#d6eaf8');
    ctx.fillStyle=sg; ctx.beginPath(); ctx.moveTo(p0.x,p0.y); ctx.lineTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.lineTo(p3.x,p3.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#0e1620'; ctx.lineWidth=2; ctx.stroke();
    var m0=lerpP(p3,p2,0.5), m1=lerpP(p0,p1,0.5); ctx.beginPath(); ctx.moveTo(m0.x,m0.y); ctx.lineTo(m1.x,m1.y); ctx.stroke();
  }
}
function isoTileDiamond(ctx,gx,gy){ var t=isoTop(gx,gy); ctx.beginPath(); ctx.moveTo(t.x,t.y); ctx.lineTo(t.x+ISO_TW2,t.y+ISO_TH2); ctx.lineTo(t.x,t.y+ISO_TH2*2); ctx.lineTo(t.x-ISO_TW2,t.y+ISO_TH2); ctx.closePath(); }
function isoPlant(ctx,gx,gy){ var g=groundAt(gx,gy); isoBox(ctx,g.x,g.y-2,9,5,9,'#b5643c','#9c4f2e','#86421f');
  ctx.fillStyle='#2f8f4a'; ctx.beginPath(); ctx.arc(g.x,g.y-17,11,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#3fae5a'; ctx.beginPath(); ctx.arc(g.x-5,g.y-21,7,0,Math.PI*2); ctx.arc(g.x+6,g.y-19,6,0,Math.PI*2); ctx.fill(); }
function isoCooler(ctx,gx,gy){ var g=groundAt(gx,gy); isoBox(ctx,g.x,g.y-2,7,4,16,'#e2eaf0','#c4d2dc','#aebecb'); ctx.fillStyle='#bfe3f5'; ctx.fillRect(g.x-6,g.y-31,12,11); ctx.fillStyle='#5fbfe0'; ctx.fillRect(g.x-5,g.y-30,10,8); }
function isoPrinter(ctx,gx,gy){ var g=groundAt(gx,gy); isoBox(ctx,g.x,g.y-2,11,6,11,'#cdd3da','#aab2bb','#9098a1'); ctx.fillStyle='#2a323b'; ctx.fillRect(g.x-7,g.y-15,14,3); ctx.fillStyle='#eef2f5'; ctx.fillRect(g.x-5,g.y-13,10,4); }
function isoCoffee(ctx,gx,gy){ var g=groundAt(gx,gy); isoBox(ctx,g.x,g.y-2,8,5,16,'#2a323b','#1e242b','#171c22'); ctx.fillStyle='#d29922'; ctx.fillRect(g.x-4,g.y-22,8,3); ctx.fillStyle='#7a4a2a'; ctx.fillRect(g.x-3,g.y-12,6,4); }
function drawOffice(){
  var cv=document.getElementById('office'); if(!cv)return; var ctx=cv.getContext('2d'); var W=cv.width,H=cv.height; offW=W; offH=H;
  ctx.fillStyle='#0b0f14'; ctx.fillRect(0,0,W,H);
  ISO_OX=Math.round(W/2); ISO_OY=72;
  var n=officeAgents.length;
  if(!n){ ctx.fillStyle='#cdd6df'; ctx.font='13px system-ui,sans-serif'; ctx.textAlign='center'; ctx.fillText('Команда не нанята — запустите сид команды',W/2,H/2); return; }
  // back walls (two iso parallelograms meeting at the back corner)
  drawWall(ctx, isoTop(0,0), isoTop(GRIDW,0), 78, '#2b3340','#3b4654', 3);   // right-back
  drawWall(ctx, isoTop(0,0), isoTop(0,GRIDH), 78, '#232a35','#323c49', 2);   // left-back
  // floor diamonds (wood checker + soft department tint near desks)
  for(var gy=0; gy<GRIDH; gy++){ for(var gx=0; gx<GRIDW; gx++){
    isoTileDiamond(ctx,gx,gy);
    ctx.fillStyle=(((gx+gy)%2)===0)?'#9a7048':'#8d6440'; ctx.fill();
    ctx.strokeStyle='rgba(45,30,15,.28)'; ctx.lineWidth=1; ctx.stroke();
    var near=null,bd=99; for(var ai=0;ai<officeAgents.length;ai++){ var hm=officeHome[officeAgents[ai].name]; if(!hm)continue; var d=Math.abs(hm.gx-gx)+Math.abs(hm.gy-gy); if(d<bd){bd=d;near=officeAgents[ai];} }
    if(near && bd<=1){ isoTileDiamond(ctx,gx,gy); ctx.globalAlpha=0.16; ctx.fillStyle=roleColor(near.type); ctx.fill(); ctx.globalAlpha=1; }
  } }
  // meeting rug (3x3 tiles around MEET) + iso table
  for(var dy=-1;dy<=1;dy++){ for(var dx=-1;dx<=1;dx++){ var rgx=MEET_TILE[0]+dx, rgy=MEET_TILE[1]+dy; if(rgx<0||rgy<0||rgx>=GRIDW||rgy>=GRIDH)continue;
    isoTileDiamond(ctx,rgx,rgy); ctx.globalAlpha=0.5; ctx.fillStyle='#2f4d80'; ctx.fill(); ctx.globalAlpha=1; } }
  var mg=groundAt(MEET_TILE[0],MEET_TILE[1]); isoBox(ctx,mg.x,mg.y-2,42,21,9,'#7a5a32','#5d4427','#49351f');
  // static decor at back edges (low depth, drawn before people)
  isoPlant(ctx,1,0); isoPlant(ctx,0,1); isoCooler(ctx,2,0); isoPrinter(ctx,0,2); isoCoffee(ctx,3,0);
  // title chip
  ctx.fillStyle='rgba(13,17,23,.55)'; roundRect(ctx,10,8,210,20,5); ctx.fill();
  ctx.fillStyle='#dfe6ee'; ctx.font='bold 12px system-ui,Segoe UI,sans-serif'; ctx.textAlign='left'; ctx.fillText('🏢 Офис команды agent-os',16,22);
  // people + desks, depth-sorted (back to front)
  updateOffice();
  officeAgents.slice().sort(function(a,b){ var pa=officePos[a.name]||officeHome[a.name]||{gx:0,gy:0}, pb=officePos[b.name]||officeHome[b.name]||{gx:0,gy:0}; return (pa.gx+pa.gy)-(pb.gx+pb.gy); }).forEach(function(a){ drawStation(ctx,a); });
  // agent-interaction layer: orchestrator → each working agent (animated link + data packet)
  drawAgentLinks(ctx);
}
function agentGround(a){ var p=officePos[a.name]||officeHome[a.name]; if(!p) return null; var g=groundAt(p.gx,p.gy); return {x:g.x, y:g.y-30}; }
function drawAgentLinks(ctx){
  var orch=null; for(var i=0;i<officeAgents.length;i++){ if(officeAgents[i].type==='orchestrator'){ orch=officeAgents[i]; break; } }
  if(!orch) return; var o=agentGround(orch); if(!o) return;
  for(var j=0;j<officeAgents.length;j++){ var a=officeAgents[j]; if(a===orch) continue;
    var st=officeState[a.name]||'idle'; if(st!=='working'&&st!=='done') continue;
    var t=agentGround(a); if(!t) continue;
    var live=(st==='working'); var lc=live?'#d29922':'#2ea043';
    // dashed animated link, arcing slightly upward at the midpoint
    var mx2=(o.x+t.x)/2, my2=(o.y+t.y)/2-26;
    ctx.save(); ctx.strokeStyle=lc; ctx.globalAlpha=live?0.55:0.3; ctx.lineWidth=1.6;
    ctx.setLineDash([5,6]); ctx.lineDashOffset=-officeFrame*0.6;
    ctx.beginPath(); ctx.moveTo(o.x,o.y); ctx.quadraticCurveTo(mx2,my2,t.x,t.y); ctx.stroke();
    ctx.restore();
    if(live){
      // moving data-packet along the quadratic curve
      var tt=((officeFrame+j*23)%70)/70; var u=1-tt;
      var px=u*u*o.x+2*u*tt*mx2+tt*tt*t.x, py=u*u*o.y+2*u*tt*my2+tt*tt*t.y;
      ctx.save(); ctx.shadowColor=lc; ctx.shadowBlur=8; ctx.fillStyle='#ffd98a';
      ctx.beginPath(); ctx.arc(px,py,3,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
  }
}
function officeLoop(){ officeFrame++; drawOffice(); officeRAF=requestAnimationFrame(officeLoop); }
function matchAgent(name,type){ var i;
  for(i=0;i<officeAgents.length;i++){ if(name && officeAgents[i].name===name) return officeAgents[i]; }
  if(name){ for(i=0;i<officeAgents.length;i++){ if(shortName(officeAgents[i].name)===name) return officeAgents[i]; } }
  if(type){ for(i=0;i<officeAgents.length;i++){ if(officeAgents[i].type===type && officeState[officeAgents[i].name]!=='done') return officeAgents[i]; } }
  return null;
}
function officeSet(name,type,status){
  var a=matchAgent(name,type); if(!a) return;
  var st = status==='running'?'working' : status==='succeeded'?'done' : status==='failed'?'failed' : 'idle';
  officeState[a.name]=st;
  if(st==='working'){ setBubble(a.name, pick(SAY_WORK[a.type]||SAY_WORK._def), 240); pushActivity('<b>'+shortName(a.name)+'</b> ('+roleOf(a)+') взял задачу в работу'); }
  else if(st==='done'){ setBubble(a.name,'Готово ✓',180); pushActivity('<b>'+shortName(a.name)+'</b> завершил подзадачу ✓'); }
  else if(st==='failed'){ setBubble(a.name,'Ошибка!',180); pushActivity('<b>'+shortName(a.name)+'</b> — ошибка в задаче'); }
}
function officeResetIdle(){ officeAgents.forEach(function(a){ officeState[a.name]='idle'; }); pushActivity('— Координатор получил новую задачу —'); }
function startMeeting(){
  var idle=officeAgents.filter(function(a){ return (officeState[a.name]||'idle')==='idle'; });
  if(idle.length<2) return; idle.sort(function(){return Math.random()-0.5;}); var crew=idle.slice(0,Math.min(3,idle.length));
  var dur=420; var slots=[[MEET_TILE[0]-1,MEET_TILE[1]],[MEET_TILE[0]+1,MEET_TILE[1]],[MEET_TILE[0],MEET_TILE[1]+1]];
  crew.forEach(function(a,i){ var s=slots[i%slots.length]; officeTgt[a.name]={gx:s[0],gy:s[1]}; officeDwell[a.name]=dur; officeMeetUntil[a.name]=officeFrame+dur; });
  pushActivity('☕ <b>'+crew.map(function(a){return shortName(a.name);}).join(', ')+'</b> собрались обсудить задачи');
  var ticks=0; var iv=setInterval(function(){ ticks++; crew.forEach(function(a){ setBubble(a.name, pick(SMALLTALK), 90); }); if(ticks>=5){ clearInterval(iv); } }, 1400);
}
function ambient(){
  if(!officeAgents.length) return;
  if(Math.random()<0.25){ startMeeting(); return; }
  var idle=officeAgents.filter(function(a){ return (officeState[a.name]||'idle')==='idle'; });
  if(idle.length){ var a=pick(idle); setBubble(a.name, pick(SMALLTALK), 90); }
}
async function loadOffice(){
  try { officeAgents = await api('/orgs/'+ORG+'/agents'); } catch(e) { officeAgents=[]; }
  if(!officeAgents||!officeAgents.length) officeAgents=[];
  officeAgents.forEach(function(a){ if(!officeState[a.name]) officeState[a.name]='idle'; });
  layoutOffice();
  var leg=document.getElementById('olegend');
  if(leg){ var seen={}, html=''; officeAgents.forEach(function(a){ if(seen[a.type])return; seen[a.type]=1; html+='<span><i style="background:'+roleColor(a.type)+'"></i>'+a.type+'</span>'; }); leg.innerHTML=html; }
  if(!officeRAF) officeLoop();
  if(!officeSim) officeSim=setInterval(ambient, 3200);
}
loadOffice();
</script>
</body>
</html>`;
