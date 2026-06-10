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
  * { box-sizing:border-box; } html, body { height:100%; }
  body { margin:0; font-family:-apple-system,Segoe UI,Roboto,sans-serif;
       background:var(--bg); color:var(--fg); display:flex; flex-direction:column; overflow:hidden; }
  header { padding:16px 24px; border-bottom:1px solid var(--border); font-weight:700; display:flex; gap:18px; align-items:center; }
  nav { display:flex; gap:6px; margin-left:auto; font-weight:400; }
  nav button { background:transparent; color:var(--muted); border:1px solid transparent; border-radius:8px; padding:6px 14px; cursor:pointer; font:inherit; }
  nav button.active { background:var(--card); color:var(--fg); border-color:var(--border); }
  main { flex:1; width:100%; max-width:1500px; margin:0 auto; padding:18px 22px; overflow:auto; min-height:0; }
  .tab { display:none; } .tab.active { display:flex; flex-direction:column; flex:1; min-height:0; }
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
  canvas#office { image-rendering:pixelated; border:1px solid var(--border); border-radius:10px; background:#0b0f14; display:block; }
  #officeWrap { display:flex; flex-direction:column; flex:1; min-height:0; }
  .office-legend { display:flex; gap:12px; flex-wrap:wrap; margin-top:6px; }
  .office-legend span { font-size:12px; color:var(--muted); }
  .office-legend i { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:4px; vertical-align:middle; }
  .staff-wrap { display:grid; grid-template-columns:250px 1fr; gap:14px; flex:1; min-height:0; }
  .staff-list { display:flex; flex-direction:column; gap:6px; height:100%; overflow:auto; }
  .staff-item { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:9px 11px; cursor:pointer; }
  .staff-item:hover { border-color:var(--accent); }
  .staff-item.active { border-color:var(--accent); background:#11202f; }
  .staff-item .role { font-size:11px; color:var(--muted); margin-top:2px; }
  .chat { display:flex; flex-direction:column; height:100%; min-height:0; border:1px solid var(--border); border-radius:10px; background:var(--card); }
  .chat-head { padding:11px 13px; border-bottom:1px solid var(--border); font-weight:600; }
  .chat-log { flex:1; overflow:auto; padding:13px; display:flex; flex-direction:column; gap:9px; }
  .msg { max-width:82%; padding:8px 11px; border-radius:10px; white-space:pre-wrap; font-size:14px; line-height:1.4; position:relative; }
  .msg.me { align-self:flex-end; background:var(--accent); color:#fff; }
  .msg.them { align-self:flex-start; background:#0d1117; border:1px solid var(--border); }
  .msg .who { font-size:11px; color:var(--muted); margin-bottom:3px; }
  .msg .quote { font-size:11.5px; opacity:.82; border-left:2px solid rgba(255,255,255,.5); padding:1px 0 1px 7px; margin-bottom:5px; white-space:pre-wrap; }
  .msg.them .quote { border-left-color:#4a5560; color:var(--muted); }
  .msg .rbtn { display:none; position:absolute; top:-9px; right:-7px; background:#1b232c; color:var(--muted); border:1px solid var(--border); border-radius:6px; font-size:11px; padding:1px 7px; cursor:pointer; }
  .msg:hover .rbtn { display:block; }
  .msg .rbtn:hover { color:var(--fg); border-color:var(--accent); }
  #chatReply .rchip { display:flex; align-items:center; gap:8px; border-left:3px solid var(--accent); background:#0d1117; border-radius:6px; padding:5px 9px; font-size:12px; color:var(--muted); }
  #chatReply .rchip b { color:var(--fg); font-weight:600; margin-right:4px; }
  #chatReply .rchip a { margin-left:auto; color:var(--muted); text-decoration:none; }
  .chat-form { display:flex; gap:8px; padding:10px; border-top:1px solid var(--border); }
  .chat-form input { flex:1; }
  .phasebar { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
  .phase { font-size:11px; padding:3px 10px; border-radius:999px; background:#30363d; color:var(--muted); letter-spacing:.04em; }
  .phase.on { background:rgba(210,153,34,.2); color:var(--run); }
  .phase.done { background:rgba(46,160,67,.18); color:var(--ok); }
  .phase.fail { background:rgba(248,81,73,.18); color:var(--fail); }
  .dfeed { display:flex; flex-direction:column; gap:8px; max-height:260px; overflow:auto; border:1px solid var(--border); border-radius:10px; background:#0d1117; padding:10px; }
  .dmsg { font-size:13px; line-height:1.45; white-space:pre-wrap; }
  .dmsg .dwho { font-weight:600; margin-right:6px; }
  .dmsg.review { border-left:3px solid #db61a2; padding-left:8px; }
  .dmsg.revision { border-left:3px solid #d29922; padding-left:8px; }
  .actfeed { max-height:150px; overflow:auto; border:1px solid var(--border); border-radius:8px; background:#0d1117; padding:6px 10px; font-size:13px; }
  .actfeed .act { padding:3px 0; border-bottom:1px solid #161d24; }
  .actfeed .act-t { color:var(--muted); font-size:11px; margin-right:6px; }
</style>
</head>
<body>
<header>
  🤖 agent-os <span style="color:#2ea043;font-size:12px;font-weight:600">v19 · журнал агента</span>
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
    <div id="phaseWrap" style="display:none"><div class="section-title">Жизненный цикл задачи</div><div id="phaseBar" class="phasebar"></div></div>
    <div id="discussWrap" style="display:none"><div class="section-title">Обсуждение команды</div><div id="discussFeed" class="dfeed"></div></div>
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
        <div id="chatReply" style="display:none;padding:4px 10px"></div>
        <div id="chatAttach" style="display:none;padding:4px 10px;font-size:12px"></div>
        <form class="chat-form" id="chatForm">
          <input type="file" id="chatFile" style="display:none" />
          <button type="button" id="chatClip" title="Прикрепить файл (txt/md/csv/json/docx/pdf/xlsx)" disabled style="min-width:38px">📎</button>
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
    <div class="section-title">Журнал агента (наблюдаемость + Debug)</div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <select id="j_agent"></select>
      <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:5px;cursor:pointer">
        <input type="checkbox" id="j_debug" /> Debug (промпт, шаги, токены)
      </label>
    </div>
    <div id="journal" class="dfeed" style="max-height:340px"></div>
    <div class="section-title" style="margin-top:24px">Расход токенов по агентам</div>
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
// --- Task lifecycle: phase chips + team discussion (server-derived, survives reload)
var PHASE_SEQ=['new','analyzing','working','reviewing','revising','completed'];
var PHASE_RU={new:'НОВАЯ',analyzing:'АНАЛИЗ',working:'В РАБОТЕ',reviewing:'РЕВЬЮ',revising:'ДОРАБОТКА',completed:'ГОТОВО',failed:'ОШИБКА',needs_human:'НУЖЕН ЧЕЛОВЕК'};
var teamPollTimer=null;
function renderTeam(t){
  $('phaseWrap').style.display='block'; var bar=$('phaseBar'); bar.innerHTML='';
  var cur=t.phase; var failed=(cur==='failed'||cur==='needs_human');
  var idx=PHASE_SEQ.indexOf(failed?'completed':cur); if(idx<0) idx=PHASE_SEQ.length-1;
  PHASE_SEQ.forEach(function(p,i){
    var el=document.createElement('span'); el.className='phase'; el.textContent=PHASE_RU[p];
    if(failed&&i===PHASE_SEQ.length-1){ el.className='phase fail'; el.textContent=PHASE_RU[cur]; }
    else if(i<idx){ el.className='phase done'; }
    else if(i===idx){ el.className='phase '+(cur==='completed'?'done':'on'); }
    bar.appendChild(el);
    if(i<PHASE_SEQ.length-1){ var a=document.createElement('span'); a.textContent='›'; a.style.color='#39424c'; bar.appendChild(a); }
  });
  if(t.discussion&&t.discussion.length){
    $('discussWrap').style.display='block'; var feed=$('discussFeed'); feed.innerHTML='';
    t.discussion.forEach(function(d){
      var el=document.createElement('div'); el.className='dmsg '+d.kind;
      var label=d.kind==='review'?' · ревью':d.kind==='revision'?' · доработка':'';
      el.innerHTML='<span class="dwho" style="color:'+roleColor(d.agentType)+'">'+escapeHtml(shortName(d.author))+label+'</span>'+escapeHtml(d.text.slice(0,600));
      feed.appendChild(el); });
    feed.scrollTop=feed.scrollHeight;
  }
}
function pollTeam(runId){
  if(teamPollTimer) clearTimeout(teamPollTimer);
  api('/runs/'+runId+'/team').then(function(t){
    if(!t||!t.phase) return;
    renderTeam(t);
    var terminal=(t.phase==='completed'||t.phase==='failed'||t.phase==='needs_human');
    if(terminal){
      if($('resultWrap').style.display==='none' && t.run && t.run.output!==undefined){
        $('resultWrap').style.display='block'; $('result').textContent=render(t.run.output); }
      return;
    }
    teamPollTimer=setTimeout(function(){ pollTeam(runId); },3000);
  }).catch(function(){ teamPollTimer=setTimeout(function(){ pollTeam(runId); },4000); });
}
$('f').addEventListener('submit', async (e) => {
  e.preventDefault(); const task=$('task').value.trim(); if(!task)return;
  $('go').disabled=true; $('graph').innerHTML=''; $('graphWrap').style.display='none'; $('resultWrap').style.display='none';
  $('phaseWrap').style.display='none'; $('discussWrap').style.display='none'; $('discussFeed').innerHTML='';
  $('cstatus').textContent='Координатор анализирует задачу…'; if(es)es.close();
  officeResetIdle(); officeSet(null,'orchestrator','running');
  const { runId, error } = await api('/tasks',{method:'POST',body:JSON.stringify({orgId:ORG,task})});
  if(!runId){ $('cstatus').textContent='Ошибка: '+(error||'нет orchestrator-агента — создайте его во вкладке «Команда»'); $('go').disabled=false; return; }
  try { localStorage.setItem('agentos_last_task', runId); } catch(e2){}
  pollTeam(runId);
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

// --- Admin: agent journal + debug mode ---
function fmtRunRow(item, debug){
  var run=item.run; var st=run.status;
  var color = st==='succeeded'?'#2ea043' : st==='failed'?'#f85149' : st==='running'?'#d29922' : '#8b949e';
  var html='<div><span style="color:'+color+';font-weight:600">'+st+'</span> <small class="muted">'+run.id.slice(0,8)+'…</small> ';
  var p=run.input&&run.input.prompt?String(run.input.prompt):JSON.stringify(run.input);
  html+='<span style="font-size:12.5px">'+escapeHtml(String(p).replace(/\\s+/g,' ').slice(0,110))+'</span>';
  if(item.errorHuman) html+='<div style="color:#f85149;font-size:12px;margin-top:2px">'+escapeHtml(item.errorHuman)+'</div>';
  if(debug) html+='<div class="jsteps" data-run="'+run.id+'" style="margin-top:4px;font-size:11.5px;color:var(--muted)">загружаю шаги…</div>';
  html+='</div>';
  return html;
}
async function fillSteps(el){
  var r = await api('/runs/'+el.dataset.run);
  var steps=(r&&r.trace)||[];
  if(!steps.length){ el.textContent='шагов нет'; return; }
  var html='';
  steps.forEach(function(s){
    html+='<div style="border-top:1px dashed #2a323b;padding:3px 0">#'+s.index+' '+s.role+(s.toolName?(' · '+s.toolName):'')
      +(s.latencyMs!=null?(' · '+s.latencyMs+'мс'):'')
      +((s.tokensIn||s.tokensOut)?(' · '+(s.tokensIn||0)+'→'+(s.tokensOut||0)+' ток.'):'');
    if(s.inputPreview) html+='<div style="color:#7d8896;white-space:pre-wrap">PROMPT: '+escapeHtml(String(s.inputPreview).slice(0,400))+'</div>';
    if(s.outputPreview) html+='<div style="color:#9aa4ad;white-space:pre-wrap">OUT: '+escapeHtml(String(s.outputPreview).slice(0,400))+'</div>';
    html+='</div>';
  });
  el.innerHTML=html;
}
async function loadJournal(){
  var aid=$('j_agent').value; if(!aid) return;
  var debug=$('j_debug').checked;
  var jr=$('journal'); jr.innerHTML='<small class="muted">загрузка…</small>';
  var items = await api('/orgs/'+ORG+'/agents/'+aid+'/runs');
  jr.innerHTML='';
  if(!items||!items.length){ jr.innerHTML='<small class="muted">у агента ещё нет задач</small>'; return; }
  items.slice().reverse().forEach(function(item){
    var el=document.createElement('div'); el.className='dmsg'; el.innerHTML=fmtRunRow(item, debug); jr.appendChild(el); });
  if(debug){ var nodes=jr.querySelectorAll('.jsteps'); for(var i=0;i<nodes.length;i++){ await fillSteps(nodes[i]); } }
}
async function loadAdmin(){
  const [agents, burn, dlq] = await Promise.all([ api('/orgs/'+ORG+'/agents'), api('/orgs/'+ORG+'/token-burn'), api('/dlq') ]);
  const byId={}; agents.forEach(a=>byId[a.id]=a);
  // journal agent picker
  const sel=$('j_agent'); const prev=sel.value; sel.innerHTML='';
  agents.forEach((a)=>{ const o=document.createElement('option'); o.value=a.id; o.textContent=a.name; sel.appendChild(o); });
  if(prev) sel.value=prev;
  if(agents.length) loadJournal();
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
$('j_agent').addEventListener('change', loadJournal);
$('j_debug').addEventListener('change', loadJournal);

// --- Staff direct chat (polling + localStorage history) -------------------
var staffAgents=[]; var currentAgent=null;
var chatThreads={}; var chatPending={};
try { chatThreads = JSON.parse(localStorage.getItem('agentos_chat')||'{}'); } catch(e){ chatThreads={}; }
try { chatPending = JSON.parse(localStorage.getItem('agentos_chat_pending')||'{}'); } catch(e){ chatPending={}; }
function saveChat(){ try { localStorage.setItem('agentos_chat', JSON.stringify(chatThreads)); localStorage.setItem('agentos_chat_pending', JSON.stringify(chatPending)); } catch(e){} }
function escapeHtml(s){ return String(s).replace(/[&<>]/g,function(c){ return c==='&'?'&amp;':c==='<'?'&lt;':'&gt;'; }); }
function replyText(out){ if(out==null) return '(пустой ответ)'; if(typeof out==='string') return out; if(out.report) return out.report; if(out.text) return out.text; if(out.summary) return (typeof out.summary==='string'?out.summary:JSON.stringify(out.summary)); return JSON.stringify(out,null,2); }
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
  $('chatInput').disabled=false; $('chatSend').disabled=false; $('chatClip').disabled=false; $('chatInput').focus();
  chatReplyTo=null; renderReplyChip();
  renderChat();
  loadChatHistory(id);
}
// Dialog memory: the server thread is the source of truth (survives reload /
// other devices). localStorage stays only as an offline cache.
function loadChatHistory(aid){
  api('/orgs/'+ORG+'/agents/'+aid+'/chat').then(function(r){
    if(!r || !r.messages) return;
    var th=[];
    r.messages.forEach(function(m){ th.push({ role: m.role==='user'?'me':'them', text:m.text, runId:m.runId }); });
    chatThreads[aid]=th; saveChat();
    if(currentAgent && currentAgent.id===aid) renderChat();
    // Resume any unfinished runs with honest live status.
    (r.pending||[]).forEach(function(p){
      th.push({role:'them', text: p.errorHuman || 'в очереди…', pending:true, runId:p.runId});
      var idx=th.length-1;
      if(p.status==='failed'||p.status==='canceled'){ th[idx].pending=false; th[idx].failedRunId=p.runId; th[idx].text=p.errorHuman||'(не удалось выполнить задачу)'; }
      else { chatPending[aid]={runId:p.runId, idx:idx}; pollRun(aid,p.runId,idx); }
    });
    chatThreads[aid]=th; saveChat();
    if(currentAgent && currentAgent.id===aid) renderChat();
  }).catch(function(){});
}
// Reply-to state: the selected message to quote in the next send.
var chatReplyTo=null; // {role:'user'|'agent', text}
function renderReplyChip(){
  var el=$('chatReply');
  if(!chatReplyTo){ el.style.display='none'; el.innerHTML=''; return; }
  var who = chatReplyTo.role==='agent' ? (currentAgent?shortName(currentAgent.name):'Агент') : 'Вы';
  var snip = chatReplyTo.text.replace(/\\s+/g,' ').slice(0,90);
  el.style.display='block';
  el.innerHTML='<div class="rchip"><b>↪ '+escapeHtml(who)+'</b><span>'+escapeHtml(snip)+'</span><a href="#" id="replyDrop">✕</a></div>';
  var d=document.getElementById('replyDrop');
  if(d) d.addEventListener('click', function(ev){ ev.preventDefault(); chatReplyTo=null; renderReplyChip(); });
}
function setReplyTarget(m){
  if(!m || !m.text || m.pending) return;
  // Strip a quote line if the message itself was a reply.
  var t=m.text;
  if(t.indexOf('↪ ')===0){ var nl=t.indexOf('\n'); if(nl>0) t=t.slice(nl+1); }
  chatReplyTo={ role: m.role==='me'?'user':'agent', text:t };
  renderReplyChip(); $('chatInput').focus();
}
// Split a stored "↪ quote\nbody" display text into its quote + body parts.
function splitQuote(text){
  if(text && text.indexOf('↪ ')===0){ var nl=text.indexOf('\n');
    if(nl>0) return { quote:text.slice(2,nl), body:text.slice(nl+1) }; }
  return { quote:null, body:text };
}
function renderChat(){
  if(!currentAgent) return; var log=$('chatLog'); log.innerHTML=''; var th=chatThreads[currentAgent.id]||[];
  th.forEach(function(m,i){ var el=document.createElement('div'); el.className='msg '+(m.role==='me'?'me':'them');
    var parts=splitQuote(m.text);
    var inner=(m.role==='me'?'':'<div class="who">'+escapeHtml(shortName(currentAgent.name))+'</div>');
    if(parts.quote) inner+='<div class="quote">'+escapeHtml(parts.quote)+'</div>';
    inner+=escapeHtml(parts.body);
    el.innerHTML=inner;
    if(!m.pending){ var rb=document.createElement('button'); rb.className='rbtn'; rb.textContent='↩ ответить';
      rb.addEventListener('click', (function(msg){ return function(){ setReplyTarget(msg); }; })(m)); el.appendChild(rb); }
    if(m.failedRunId){ var b=document.createElement('button'); b.textContent='Повторить'; b.className='primary'; b.style.cssText='margin-top:6px;padding:4px 10px;font-size:12px';
      b.addEventListener('click', (function(aid,idx,rid){ return function(){ retryChat(aid,idx,rid); }; })(currentAgent.id,i,m.failedRunId)); el.appendChild(b); }
    log.appendChild(el); });
  log.scrollTop=log.scrollHeight;
}
function setBubbleText(aid,idx,text){
  if(!(chatThreads[aid]&&chatThreads[aid][idx])) return;
  chatThreads[aid][idx].text=text;
  if(currentAgent&&currentAgent.id===aid) renderChat();
}
function retryChat(aid,idx,runId){
  if(!(chatThreads[aid]&&chatThreads[aid][idx])) return;
  chatThreads[aid][idx]={role:'them', text:'в очереди…', pending:true, runId:runId};
  chatPending[aid]={runId:runId, idx:idx}; saveChat();
  if(currentAgent&&currentAgent.id===aid) renderChat();
  api('/runs/'+runId+'/retry',{method:'POST',body:'{}'}).then(function(){ pollRun(aid,runId,idx); })
    .catch(function(){ setReplyFailed(aid,idx,runId,'Сеть: не удалось повторить'); });
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
// Honest failure: show the real reason + a «Повторить» button (no silent giving up).
function setReplyFailed(aid,idx,runId,reason){
  if(!(chatThreads[aid]&&chatThreads[aid][idx])) return;
  if(chatPending[aid]&&chatPending[aid].idx===idx) delete chatPending[aid];
  chatThreads[aid][idx]={role:'them', text:reason||'(не удалось выполнить задачу)', failedRunId:runId};
  saveChat(); if(currentAgent&&currentAgent.id===aid) renderChat();
}
// pollRun NEVER gives up while a run is non-terminal (runs live server-side);
// the bubble shows a live status; backoff grows but is capped.
function pollRun(aid, runId, idx, tries){
  tries = tries||0;
  api('/runs/'+runId).then(function(r){
    var run = r && r.run; var st = run && run.status;
    if(st==='succeeded'){
      setReply(aid,idx, replyText(run.output));
      // persist the agent reply into the server thread for other devices
      if(currentAgent && currentAgent.id===aid) loadChatHistory(aid);
      return;
    }
    if(st==='failed'||st==='canceled'){ setReplyFailed(aid,idx,runId, (r&&r.errorHuman)||'Не удалось выполнить задачу.'); return; }
    if(st==='paused'){ setBubbleText(aid,idx, (r&&r.errorHuman)||'нужно ваше решение'); }
    else { setBubbleText(aid,idx, tries<2?'в очереди…':('думает…'+(tries>30?' ('+Math.floor(tries*3/60)+' мин)':''))); }
    var delay=Math.min(10000, 2000 + tries*250);
    setTimeout(function(){ pollRun(aid,runId,idx,tries+1); }, delay);
  }).catch(function(){ setTimeout(function(){ pollRun(aid,runId,idx,tries+1); }, Math.min(10000, 2500 + tries*250)); });
}
// --- file attachment (Doc-1): extract text server-side, inline into the prompt
var chatAttachment=null; // {filename, text}
function renderAttach(state, msg){
  var el=$('chatAttach');
  if(!state){ el.style.display='none'; el.innerHTML=''; return; }
  el.style.display='block';
  if(state==='busy'){ el.innerHTML='<span style="color:#8b949e">⏳ '+msg+'</span>'; }
  else if(state==='err'){ el.innerHTML='<span style="color:#f85149">⚠️ '+msg+'</span>'; }
  else { el.innerHTML='<span style="color:#2ea043">📄 '+msg+'</span> <a href="#" id="attachDrop" style="color:#8b949e">✕ убрать</a>';
    var d=document.getElementById('attachDrop'); if(d) d.addEventListener('click',function(ev){ ev.preventDefault(); chatAttachment=null; renderAttach(null); }); }
}
$('chatClip').addEventListener('click', function(){ $('chatFile').click(); });
$('chatFile').addEventListener('change', function(){
  var f=$('chatFile').files && $('chatFile').files[0]; $('chatFile').value=''; if(!f) return;
  if(f.size > 20*1024*1024){ renderAttach('err','Файл больше 20МБ — разбейте его на части и пришлите частями.'); return; }
  renderAttach('busy','Читаю файл '+f.name+'…');
  var rd=new FileReader();
  rd.onerror=function(){ renderAttach('err','Не удалось прочитать файл из браузера.'); };
  rd.onload=function(){
    var b64=String(rd.result).split(',')[1]||'';
    api('/documents/extract',{method:'POST',body:JSON.stringify({mime:f.type,filename:f.name,content:b64,base64:true})})
      .then(function(r){
        if(r && typeof r.text==='string'){ chatAttachment={filename:f.name,text:r.text};
          renderAttach('ok', f.name+' — прочитано, '+r.text.length+' симв. Будет приложен к сообщению.'); }
        else { renderAttach('err',(r&&r.error)||'не удалось прочитать файл'); }
      })
      .catch(function(){ renderAttach('err','Сеть: не удалось отправить файл на разбор.'); });
  };
  rd.readAsDataURL(f);
});
$('chatForm').addEventListener('submit', async function(e){
  e.preventDefault(); if(!currentAgent) return; var text=$('chatInput').value.trim();
  if(!text && !chatAttachment) return;
  if(!text) text='Изучи приложенный файл и дай краткие выводы.';
  var aid=currentAgent.id;
  var shown=text; var attachForServer=null; var replyForServer=null;
  if(chatAttachment){
    attachForServer={ filename:chatAttachment.filename, text:chatAttachment.text };
    shown=text+' 📎 '+chatAttachment.filename;
    chatAttachment=null; renderAttach(null);
  }
  if(chatReplyTo){
    replyForServer={ role:chatReplyTo.role, text:chatReplyTo.text };
    shown='↪ '+chatReplyTo.text.replace(/\\s+/g,' ').slice(0,120)+'\n'+shown;
    chatReplyTo=null; renderReplyChip();
  }
  pushMsg(aid,'me',shown); $('chatInput').value='';
  if(!chatThreads[aid]) chatThreads[aid]=[];
  chatThreads[aid].push({role:'them', text:'в очереди…', pending:true}); var idx=chatThreads[aid].length-1; saveChat(); renderChat();
  // Server-side chat: persists the message + assembles dialog context.
  var body={ text:text };
  if(attachForServer) body.attachment=attachForServer;
  if(replyForServer) body.replyTo=replyForServer;
  var resp = await api('/orgs/'+ORG+'/agents/'+aid+'/chat',{method:'POST',body:JSON.stringify(body)});
  if(!resp||!resp.runId){ setReplyFailed(aid,idx,null,'Ошибка: '+((resp&&resp.error)||'не удалось запустить')); return; }
  chatThreads[aid][idx].runId=resp.runId; chatPending[aid]={runId:resp.runId, idx:idx}; saveChat();
  pollRun(aid, resp.runId, idx);
});

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
var SUITS=['#27364a','#2b2f36','#3a3340','#243b33','#33281f','#1f3540'];
var TYPE_ACC={orchestrator:'case',coder:'laptop',researcher:'mag',analyst:'tablet',writer:'note',reviewer:'check'};
function lookFor(a){ var h=hashStr(a.name); var shirt=roleColor(a.type); var styles=['short','short','long','bald','short','curly'];
  return { skin:SKINS[h%SKINS.length], hair:HAIRS[(h>>3)%HAIRS.length], hairStyle:styles[(h>>6)%styles.length],
    shirt:shirt, suit:SUITS[(h>>15)%SUITS.length], pants:PANTS[(h>>9)%PANTS.length],
    acc:TYPE_ACC[a.type]||null,
    glasses:(a.type==='analyst'||a.type==='reviewer'||((h>>12)%3===0)) }; }
// --- Sprite 2.0: big-head pixel characters from char-grids (own art) -------
// Grid 16w x 23h, cell CH_CELL px => ~54x78px on screen. Palette keys:
// H hair, S skin, e eye, J jacket, j jacket shade, T shirt, t tie, P pants, B shoes.
var CH_CELL=3.4, CH_W=16, CH_H=23;
function headRows(style){
  if(style==='bald') return [
  '................',
  '....SSSSSSSS....',
  '...SSSSSSSSSS...',
  '..HSSSSSSSSSSH..',
  '..HSSSSSSSSSSH..',
  '..SSSSSSSSSSSS..',
  '..SSeSSSSSSeSS..',
  '..SSSSSSSSSSSS..',
  '...SSSSSSSSSS...',
  '....SSSSSSSS....'];
  if(style==='long') return [
  '....HHHHHHHH....',
  '...HHHHHHHHHH...',
  '..HHHHHHHHHHHH..',
  '..HHSSSSSSSSHH..',
  '..HHSSSSSSSSHH..',
  '..HSSSSSSSSSSH..',
  '..HSeSSSSSSeSH..',
  '..HSSSSSSSSSSH..',
  '..HHSSSSSSSSHH..',
  '..HHSSSSSSSSHH..'];
  if(style==='curly') return [
  '...HH.HHHH.HH...',
  '..HHHHHHHHHHHH..',
  '.HHHHHHHHHHHHHH.',
  '..HHSSSSSSSSHH..',
  '..HSSSSSSSSSSH..',
  '..SSSSSSSSSSSS..',
  '..SSeSSSSSSeSS..',
  '..SSSSSSSSSSSS..',
  '...SSSSSSSSSS...',
  '....SSSSSSSS....'];
  return [
  '....HHHHHHHH....',
  '...HHHHHHHHHH...',
  '..HHHHHHHHHHHH..',
  '..HHSSSSSSSSHH..',
  '..HSSSSSSSSSSH..',
  '..SSSSSSSSSSSS..',
  '..SSeSSSSSSeSS..',
  '..SSSSSSSSSSSS..',
  '...SSSSSSSSSS...',
  '....SSSSSSSS....'];
}
function bodyRows(){ return [
  '....JJJJJJJJ....',
  '..JJJJTTTTJJjj..',
  '..JJJTTttTTJjj..',
  '..JJJTTttTTJjj..',
  '..SJJTTttTTJjS..',
  '..SJJJTTTTJJjS..',
  '...JJJJJJJJjj...',
  '....PPPPPPPP....']; }
function legRows(frame){
  if(frame===0) return [
  '...PPP....PPP...',
  '...PPP...PPP....',
  '....PPP..PPP....',
  '..BBBB....BBBB..',
  '................'];
  if(frame===1) return [
  '....PPP..PPP....',
  '....PPP...PPP...',
  '....PPP..PPP....',
  '....BBBB..BBBB..',
  '................'];
  return [
  '....PPP..PPP....',
  '....PPP..PPP....',
  '....PPP..PPP....',
  '...BBBB..BBBB...',
  '................'];
}
var SPR_CACHE={};
function spriteRows(style,frame){ var k=style+'#'+frame; if(!SPR_CACHE[k]) SPR_CACHE[k]=headRows(style).concat(bodyRows(),legRows(frame)); return SPR_CACHE[k]; }
function drawGrid(ctx,x0,y0,rows,pal,cell){
  for(var r=0;r<rows.length;r++){ var row=rows[r];
    for(var c=0;c<row.length;c++){ var col=pal[row.charAt(c)]; if(!col) continue;
      ctx.fillStyle=col; ctx.fillRect(x0+c*cell, y0+r*cell, cell+0.35, cell+0.35); } }
}
function drawAccessory(ctx,fx,fy,acc){
  var hx=fx+CH_W*CH_CELL/2-3, hy=fy-16; // right-hand zone
  if(acc==='case'){ ctx.fillStyle='#6b4327'; ctx.fillRect(hx-2,hy-2,15,12); ctx.fillStyle='#7d5233'; ctx.fillRect(hx-1,hy-1,13,4);
    ctx.strokeStyle='#4d2f1a'; ctx.lineWidth=1.5; ctx.strokeRect(hx-2,hy-2,15,12); ctx.strokeRect(hx+3,hy-5,5,3); }
  else if(acc==='laptop'){ ctx.fillStyle='#aab4bd'; ctx.fillRect(hx-2,hy,14,9); ctx.fillStyle='#2a3743'; ctx.fillRect(hx-1,hy+1,12,7); }
  else if(acc==='mag'){ ctx.strokeStyle='#cfd6dc'; ctx.lineWidth=2.4; ctx.beginPath(); ctx.arc(hx+4,hy+1,5,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx+8,hy+5); ctx.lineTo(hx+12,hy+9); ctx.stroke(); ctx.fillStyle='rgba(160,210,255,.35)'; ctx.beginPath(); ctx.arc(hx+4,hy+1,4,0,Math.PI*2); ctx.fill(); }
  else if(acc==='tablet'){ ctx.fillStyle='#0e1318'; ctx.fillRect(hx-1,hy-2,12,15); ctx.fillStyle='#16323f'; ctx.fillRect(hx,hy-1,10,13);
    ctx.fillStyle='#2ea043'; ctx.fillRect(hx+1,hy+8,2,3); ctx.fillRect(hx+4,hy+5,2,6); ctx.fillRect(hx+7,hy+7,2,4); }
  else if(acc==='note'){ ctx.fillStyle='#eceff2'; ctx.fillRect(hx,hy-1,11,13); ctx.fillStyle='#9aa4ad'; for(var i=0;i<4;i++) ctx.fillRect(hx+2,hy+2+i*3,7,1); }
  else if(acc==='check'){ ctx.fillStyle='#d9dee3'; ctx.fillRect(hx,hy-2,11,14); ctx.fillStyle='#8a949d'; ctx.fillRect(hx+3,hy-4,5,3);
    ctx.strokeStyle='#2ea043'; ctx.lineWidth=1.6; for(var k2=0;k2<3;k2++){ ctx.beginPath(); ctx.moveTo(hx+2,hy+2+k2*4); ctx.lineTo(hx+4,hy+4+k2*4); ctx.lineTo(hx+8,hy+k2*4); ctx.stroke(); } }
}
function drawCharacter(ctx,fx,fy,look,bob,step){
  fx=Math.round(fx); fy=Math.round(fy); bob=bob||0; var ty=-bob;
  var frame=-1;
  if(step){ frame=Math.floor(officeFrame/6)%2; var ph=Math.sin((officeFrame+fx)/3.2); ty-=Math.round(Math.abs(ph)*2); }
  // shadow
  ctx.save(); ctx.globalAlpha=0.22; ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(fx,fy,17,5,0,0,Math.PI*2); ctx.fill(); ctx.restore();
  var rows=spriteRows(look.hairStyle,frame);
  var pal={H:look.hair,S:look.skin,e:'#141a21',J:look.suit,j:shade(look.suit,-28),T:'#eef2f6',t:look.shirt,P:look.pants,B:'#14181d'};
  var x0=fx-CH_W*CH_CELL/2, y0=fy-CH_H*CH_CELL+ty;
  drawGrid(ctx,x0,y0,rows,pal,CH_CELL);
  // glasses overlay (eye row = 6)
  if(look.glasses){ var gy=y0+6*CH_CELL-1, c=CH_CELL;
    ctx.strokeStyle='#10151b'; ctx.lineWidth=1.4;
    ctx.strokeRect(x0+3.4*c,gy,2.6*c,1.9*c); ctx.strokeRect(x0+9.9*c,gy,2.6*c,1.9*c);
    ctx.beginPath(); ctx.moveTo(x0+6*c,gy+0.8*c); ctx.lineTo(x0+9.9*c,gy+0.8*c); ctx.stroke(); }
  // role accessory in the right hand
  if(look.acc) drawAccessory(ctx,fx,fy+ty,look.acc);
}
// --- isometric projection (2:1) ---
var ISO_TW2=42, ISO_TH2=21, ISO_OX=0, ISO_OY=84, GRIDW=13, GRIDH=8;
var DESK_TILES=[[6,2],[3,1],[9,1],[2,4],[10,3],[11,5],[3,6],[8,6]];
var MEET_TILE=[6,6];
function isoTop(gx,gy){ return { x: ISO_OX+(gx-gy)*ISO_TW2, y: ISO_OY+(gx+gy)*ISO_TH2 }; }
function groundAt(gx,gy){ return { x: ISO_OX+(gx-gy)*ISO_TW2, y: ISO_OY+(gx+gy)*ISO_TH2+ISO_TH2 }; }
function layoutOffice(){
  var cv=document.getElementById('office'); if(cv){ offW=cv.width; offH=cv.height; }
  var n=officeAgents.length; if(!n) return;
  ISO_OX=Math.round(offW/2); ISO_OY=84;
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
  isoBox(ctx, dg.x, dg.y-2, 40, 20, 16, '#7a5a32','#5d4427','#49351f');
  // mug + papers on the desk top
  ctx.fillStyle=col; ctx.fillRect(dg.x-22,dg.y-9,6,7); ctx.fillStyle='#eceff2'; ctx.fillRect(dg.x+13,dg.y-7,10,6);
  // monitor (billboard at the back of the desk)
  var mx=dg.x, my=dg.y-28;
  ctx.fillStyle='#0e1318'; roundRect(ctx,mx-18,my-14,36,24,2); ctx.fill();
  var screen=(!atDesk||st==='idle')?'#2a3742' : st==='done'?'#2ea043' : st==='failed'?'#f85149' : col;
  if(st==='working'&&atDesk){ ctx.globalAlpha=0.62+0.38*(0.5+0.5*Math.sin(officeFrame/6)); }
  ctx.fillStyle=screen; ctx.fillRect(mx-16,my-12,32,19); ctx.globalAlpha=1;
  if(atDesk){ ctx.fillStyle='rgba(255,255,255,.42)'; ctx.fillRect(mx-10,my-7,15,1); ctx.fillRect(mx-10,my-4,11,1); ctx.fillRect(mx-10,my-1,17,1); ctx.fillRect(mx-10,my+2,8,1); }
  ctx.fillStyle='#0e1318'; ctx.fillRect(mx-2,my+10,4,4);
  var dot=st==='working'?'#d29922':st==='done'?'#2ea043':st==='failed'?'#f85149':'#3a4450';
  ctx.fillStyle=dot; ctx.beginPath(); ctx.arc(mx+17,my-10,2.5,0,Math.PI*2); ctx.fill();
  // role-specific desk props (analyst charts, coder 2nd monitor, researcher books, …)
  if(atDesk) drawRoleProps(ctx, dg.x, dg.y, a.type);
  // speech bubble above person
  var b=officeBubble[nm];
  if(b && officeFrame<b.until){ ctx.font='12.5px system-ui,Segoe UI,sans-serif'; var w=ctx.measureText(b.text).width+18;
    var bx=Math.round(pg.x-w/2), by=Math.round(pg.y-96);
    ctx.fillStyle='#f7fafc'; roundRect(ctx,bx,by,w,22,8); ctx.fill();
    ctx.fillStyle='#0d1117'; ctx.textAlign='center'; ctx.fillText(b.text,pg.x,by+15);
    ctx.fillStyle='#f7fafc'; ctx.beginPath(); ctx.moveTo(pg.x-4,by+22); ctx.lineTo(pg.x+5,by+22); ctx.lineTo(pg.x,by+27); ctx.fill(); }
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
  ISO_OX=Math.round(W/2); ISO_OY=84;
  var n=officeAgents.length;
  if(!n){ ctx.fillStyle='#cdd6df'; ctx.font='13px system-ui,sans-serif'; ctx.textAlign='center'; ctx.fillText('Команда не нанята — запустите сид команды',W/2,H/2); return; }
  // camera: scene drawn under pan/zoom; HUD (chip/hint) stays fixed
  ctx.save(); ctx.translate(camX,camY); ctx.scale(camZ,camZ);
  // back walls (two iso parallelograms meeting at the back corner)
  drawWall(ctx, isoTop(0,0), isoTop(GRIDW,0), 96, '#2b3340','#3b4654', 3);   // right-back
  drawWall(ctx, isoTop(0,0), isoTop(0,GRIDH), 96, '#232a35','#323c49', 2);   // left-back
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
  var mg=groundAt(MEET_TILE[0],MEET_TILE[1]); isoBox(ctx,mg.x,mg.y-2,50,25,11,'#7a5a32','#5d4427','#49351f');
  // static decor at back edges (low depth, drawn before people)
  isoPlant(ctx,1,0); isoPlant(ctx,0,1); isoCooler(ctx,2,0); isoPrinter(ctx,0,2); isoCoffee(ctx,3,0);
  // people + desks, depth-sorted (back to front)
  updateOffice();
  officeAgents.slice().sort(function(a,b){ var pa=officePos[a.name]||officeHome[a.name]||{gx:0,gy:0}, pb=officePos[b.name]||officeHome[b.name]||{gx:0,gy:0}; return (pa.gx+pa.gy)-(pb.gx+pb.gy); }).forEach(function(a){ drawStation(ctx,a); });
  // agent-interaction layer: orchestrator → each working agent (animated link + data packet)
  drawAgentLinks(ctx);
  ctx.restore();
  // HUD: title chip + camera hint (fixed, unaffected by the camera)
  ctx.fillStyle='rgba(13,17,23,.55)'; roundRect(ctx,10,8,210,20,5); ctx.fill();
  ctx.fillStyle='#dfe6ee'; ctx.font='bold 12px system-ui,Segoe UI,sans-serif'; ctx.textAlign='left'; ctx.fillText('🏢 Офис команды agent-os',16,22);
  ctx.fillStyle='rgba(139,148,158,.85)'; ctx.font='10px system-ui,Segoe UI,sans-serif'; ctx.textAlign='right';
  ctx.fillText(camZ===1&&camX===0&&camY===0 ? 'колесо — зум · мышь — двигать' : 'двойной клик — сброс камеры (' + Math.round(camZ*100) + '%)', W-10, H-8);
  ctx.textAlign='left';
}
function agentGround(a){ var p=officePos[a.name]||officeHome[a.name]; if(!p) return null; var g=groundAt(p.gx,p.gy); return {x:g.x, y:g.y-42}; }
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
// Full-window fit: size the canvas backing store to its container, 1:1 with CSS
// pixels (crisp pixel-art), recomputed on every window resize.
function fitOffice(){
  var cv=document.getElementById('office'); if(!cv) return;
  var host=cv.parentElement; if(!host) return;
  var w=Math.max(640, Math.floor(host.clientWidth));
  var rect=cv.getBoundingClientRect();
  var avail=window.innerHeight - rect.top - 210; // room for legend + activity feed
  var h=Math.max(360, Math.min(avail, Math.round(w/1.7)));
  cv.width=w; cv.height=h; cv.style.width=w+'px'; cv.style.height=h+'px';
  offW=w; offH=h;
}
var fitTimer=null;
function scheduleFit(){ if(fitTimer) return; fitTimer=setTimeout(function(){ fitTimer=null; fitOffice(); }, 120); }
window.addEventListener('resize', scheduleFit);
// --- camera (P1): wheel zoom at cursor, drag pan, double-click reset ---
var camZ=1, camX=0, camY=0, camDrag=null;
(function(){
  var cv=document.getElementById('office'); if(!cv) return;
  function toCanvas(e){ var r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)*(cv.width/r.width), y:(e.clientY-r.top)*(cv.height/r.height)}; }
  cv.addEventListener('wheel', function(e){
    e.preventDefault();
    var p=toCanvas(e);
    var nz=Math.max(0.6, Math.min(2.6, camZ*(e.deltaY<0?1.12:0.89)));
    // keep the world point under the cursor fixed while zooming
    camX = p.x - (p.x - camX) * (nz/camZ);
    camY = p.y - (p.y - camY) * (nz/camZ);
    camZ = nz;
    if(Math.abs(camZ-1)<0.04 && Math.abs(camX)<14 && Math.abs(camY)<14){ camZ=1; camX=0; camY=0; }
  }, {passive:false});
  cv.addEventListener('mousedown', function(e){ var p=toCanvas(e); camDrag={x:p.x-camX, y:p.y-camY}; cv.style.cursor='grabbing'; });
  window.addEventListener('mousemove', function(e){ if(!camDrag) return; var p=toCanvas(e); camX=p.x-camDrag.x; camY=p.y-camDrag.y; });
  window.addEventListener('mouseup', function(){ camDrag=null; cv.style.cursor=''; });
  cv.addEventListener('dblclick', function(e){ e.preventDefault(); camZ=1; camX=0; camY=0; });
})();
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
  fitOffice();
  layoutOffice();
  var leg=document.getElementById('olegend');
  if(leg){ var seen={}, html=''; officeAgents.forEach(function(a){ if(seen[a.type])return; seen[a.type]=1; html+='<span><i style="background:'+roleColor(a.type)+'"></i>'+a.type+'</span>'; }); leg.innerHTML=html; }
  if(!officeRAF) officeLoop();
  if(!officeSim) officeSim=setInterval(ambient, 3200);
}
loadOffice();
// Restore the last team task after a reload: phases, discussion and result come
// back from the server (Postgres) — closing the tab loses nothing.
try { var lastTask=localStorage.getItem('agentos_last_task'); if(lastTask) pollTeam(lastTask); } catch(e){}
</script>
</body>
</html>`;
