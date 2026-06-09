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
  🤖 agent-os
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
    <div id="officeWrap"><canvas id="office" width="760" height="440"></canvas><div class="office-legend" id="olegend"></div>
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
function setReply(aid,idx,text){ if(chatThreads[aid]&&chatThreads[aid][idx]) chatThreads[aid][idx]={role:'them',text:text}; if(chatPending[aid]&&chatPending[aid].idx===idx) delete chatPending[aid]; saveChat(); if(currentAgent&&currentAgent.id===aid) renderChat(); }
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
var SAY_WORK={researcher:['Ищу источники…','Собираю данные…'],analyst:['Анализирую…','Считаю варианты…'],writer:['Пишу черновик…','Редактирую текст…'],coder:['Пишу код…','Гоняю тесты…'],reviewer:['Проверяю…','Ищу баги…'],orchestrator:['Распределяю задачи','Собираю команду'],_def:['Работаю…']};
var SMALLTALK=['Кофе? ☕','Как дела?','Глянь мою задачу','Почти готово','Нужна помощь?','Класс! 👍','Я на созвоне','Передаю дальше','Согласен','Сделаю'];
var officeAgents=[]; var officeState={}; var officePos={}; var officeHome={}; var officeTgt={}; var officeDwell={}; var officeBubble={}; var officeMeetUntil={};
var officeFrame=0; var officeRAF=null; var offW=760, offH=440; var officeSim=null;
function roleColor(t){ return TYPE_COLOR[t]||'#8b949e'; }
function shortName(n){ return n.split(' — ')[0]; }
function roleOf(a){ return a.name.indexOf(' — ')>=0 ? a.name.split(' — ')[1] : a.type; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function drawSprite(ctx,ox,oy,shirt,bob){
  for(var r=0;r<SPR.length;r++){ var row=SPR[r];
    for(var c=0;c<row.length;c++){ var ch=row[c]; var col=null;
      if(ch==='H')col='#3b2a1a'; else if(ch==='S')col='#e8b98c'; else if(ch==='e')col='#10151b'; else if(ch==='C')col=shirt; else if(ch==='P')col='#30363d';
      if(col){ ctx.fillStyle=col; ctx.fillRect(ox+c*PX, oy+Math.round(r*PX+bob), PX, PX); } } }
}
function layoutOffice(){
  var cv=document.getElementById('office'); if(cv){ offW=cv.width; offH=cv.height; }
  var n=officeAgents.length; if(!n) return;
  var ord=officeAgents.slice().sort(function(a,b){ return (b.type==='orchestrator'?1:0)-(a.type==='orchestrator'?1:0); });
  var perRow = n<=4 ? n : Math.ceil(n/2); var rows=Math.ceil(n/perRow); var startY=96; var rowH=(offH-150)/rows;
  for(var i=0;i<ord.length;i++){ var a=ord[i]; var rIdx=Math.floor(i/perRow); var inRow=Math.min(perRow,n-rIdx*perRow); var cIdx=i%perRow;
    var cellW=offW/inRow; var cx=Math.round(cIdx*cellW+cellW/2); var cy=Math.round(startY+rIdx*rowH+rowH/2);
    officeHome[a.name]={x:cx,y:cy};
    if(!officePos[a.name]) officePos[a.name]={x:cx,y:cy};
    officeTgt[a.name]={x:cx,y:cy}; officeDwell[a.name]=120+Math.floor(Math.random()*200); }
}
function setBubble(name,text,frames){ officeBubble[name]={text:text, until:officeFrame+(frames||200)}; }
function pushActivity(text){
  var f=document.getElementById('activityFeed'); if(!f) return;
  var row=document.createElement('div'); row.className='act';
  var t=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  row.innerHTML='<span class="act-t">'+t+'</span> '+text; f.insertBefore(row,f.firstChild);
  while(f.children.length>40) f.removeChild(f.lastChild);
}
function socialPoint(){ var pts=[{x:offW-70,y:offH-70},{x:Math.round(offW/2),y:offH-58},{x:70,y:offH-70}]; return pick(pts); }
function updateOffice(){
  officeAgents.forEach(function(a){ var nm=a.name; var home=officeHome[nm]; if(!home) return; var st=officeState[nm]||'idle';
    var tgt;
    if(st==='working'||st==='done'||st==='failed'){ tgt=home; }
    else if(officeMeetUntil[nm] && officeFrame<officeMeetUntil[nm]){ tgt=officeTgt[nm]; }
    else { officeDwell[nm]=(officeDwell[nm]||0)-1; if(officeDwell[nm]<=0){ tgt = Math.random()<0.45 ? socialPoint() : home; officeTgt[nm]=tgt; officeDwell[nm]=180+Math.floor(Math.random()*260); } tgt=officeTgt[nm]; }
    var p=officePos[nm]; if(!p){ p={x:home.x,y:home.y}; officePos[nm]=p; }
    p.x += (tgt.x-p.x)*0.05; p.y += (tgt.y-p.y)*0.05;
  });
}
function drawStation(ctx,a){
  var nm=a.name; var home=officeHome[nm]; if(!home) return; var p=officePos[nm]||home; var st=officeState[nm]||'idle'; var col=roleColor(a.type);
  var cx=home.x, cy=home.y;
  var atDesk = Math.abs(p.x-cx)<6 && Math.abs(p.y-cy)<6;
  var walking = !atDesk;
  var bob = st==='working' && atDesk ? Math.round(Math.sin((officeFrame+cx)/8)*2) : (walking ? ((Math.floor(officeFrame/6)%2)?1:0) : 0);
  // chair + desk + monitor (fixed at home)
  ctx.fillStyle='#161d24'; ctx.fillRect(cx-13,cy-30,26,8);
  ctx.fillStyle='#5a4126'; ctx.fillRect(cx-36,cy-6,72,16);
  ctx.fillStyle='#6b4f2a'; ctx.fillRect(cx-36,cy-6,72,4);
  ctx.fillStyle='#3f2d1a'; ctx.fillRect(cx-32,cy+10,6,14); ctx.fillRect(cx+26,cy+10,6,14);
  ctx.fillStyle='#202830'; ctx.fillRect(cx-15,cy-24,30,20);
  var screen = (st==='idle'||!atDesk)?'#26313b' : st==='done'?'#2ea043' : st==='failed'?'#f85149' : col;
  if(st==='working' && atDesk){ ctx.globalAlpha=0.55+0.45*(0.5+0.5*Math.sin(officeFrame/6)); }
  ctx.fillStyle=screen; ctx.fillRect(cx-12,cy-21,24,14); ctx.globalAlpha=1;
  ctx.fillStyle='#202830'; ctx.fillRect(cx-3,cy-4,6,3);
  // sprite at its (possibly moving) position
  var sx=Math.round(p.x-12), sy=Math.round(p.y-46);
  drawSprite(ctx, sx, sy, col, bob);
  // speech bubble
  var b=officeBubble[nm];
  if(b && officeFrame<b.until){ ctx.font='10px monospace'; var w=ctx.measureText(b.text).width+12;
    var bx=Math.round(p.x - w/2), by=sy-18;
    ctx.fillStyle='#eef2f6'; ctx.fillRect(bx,by,w,15); ctx.fillStyle='#0d1117'; ctx.textAlign='center'; ctx.fillText(b.text, p.x, by+11);
    ctx.fillStyle='#eef2f6'; ctx.fillRect(Math.round(p.x)-2, by+15, 4, 3); }
  // labels under desk
  ctx.fillStyle='#e6edf3'; ctx.font='11px monospace'; ctx.textAlign='center'; ctx.fillText(shortName(a.name),cx,cy+36);
  ctx.fillStyle='#8b949e'; ctx.font='9px monospace'; ctx.fillText(roleOf(a),cx,cy+46);
}
function drawOffice(){
  var cv=document.getElementById('office'); if(!cv)return; var ctx=cv.getContext('2d'); var W=cv.width,H=cv.height; offW=W; offH=H;
  ctx.fillStyle='#0e1318'; ctx.fillRect(0,0,W,H);
  var tile=24; for(var y=40;y<H;y+=tile){ for(var x=0;x<W;x+=tile){ ctx.fillStyle=(((x/tile)+(y/tile))%2===0)?'#141b22':'#11171d'; ctx.fillRect(x,y,tile,tile); } }
  // rugs
  ctx.fillStyle='#15212c'; ctx.fillRect(Math.round(W/2)-70,H-80,140,46);
  ctx.fillStyle='#1b232c'; ctx.fillRect(0,0,W,40); ctx.fillStyle='#22303b'; ctx.fillRect(0,36,W,4);
  // windows
  ctx.globalAlpha=0.25; ctx.fillStyle='#2f81f7'; ctx.fillRect(44,8,96,24); ctx.fillRect(W-140,8,96,24); ctx.globalAlpha=1;
  // water cooler (right)
  ctx.fillStyle='#274b63'; ctx.fillRect(W-66,H-86,16,26); ctx.fillStyle='#7fd6ff'; ctx.fillRect(W-64,H-84,12,10);
  // plant (left)
  ctx.fillStyle='#1f6f33'; ctx.fillRect(62,H-86,14,14); ctx.fillStyle='#6b4f2a'; ctx.fillRect(65,H-74,8,12);
  // meeting table (center bottom)
  ctx.fillStyle='#3f2d1a'; ctx.fillRect(Math.round(W/2)-34,H-64,68,14);
  ctx.fillStyle='#8b949e'; ctx.font='12px monospace'; ctx.textAlign='left'; ctx.fillText('Офис команды agent-os',12,25);
  var n=officeAgents.length;
  if(!n){ ctx.fillStyle='#8b949e'; ctx.font='12px monospace'; ctx.textAlign='center'; ctx.fillText('Команда не нанята — запустите сид команды',W/2,H/2); return; }
  updateOffice();
  officeAgents.slice().sort(function(a,b){ return (officePos[a.name]?officePos[a.name].y:0)-(officePos[b.name]?officePos[b.name].y:0); }).forEach(function(a){ drawStation(ctx,a); });
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
  var mx=Math.round(offW/2), my=offH-62; var dur=420;
  crew.forEach(function(a,i){ officeTgt[a.name]={x:mx+(i-1)*30, y:my-14}; officeDwell[a.name]=dur; officeMeetUntil[a.name]=officeFrame+dur; });
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
