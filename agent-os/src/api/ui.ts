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
</style>
</head>
<body>
<header>
  🤖 agent-os
  <nav>
    <button data-tab="coord" class="active">Координатор</button>
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
    <div id="graphWrap" style="display:none"><div class="section-title">Граф сборки</div><div class="graph" id="graph"></div></div>
    <div id="resultWrap" style="display:none"><div class="section-title">Результат</div><div class="result" id="result"></div></div>
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
  const { runId, error } = await api('/tasks',{method:'POST',body:JSON.stringify({orgId:ORG,task})});
  if(!runId){ $('cstatus').textContent='Ошибка: '+(error||'нет orchestrator-агента — создайте его во вкладке «Команда»'); $('go').disabled=false; return; }
  es = new EventSource('/runs/'+runId+'/events');
  es.addEventListener('orchestration.planned',(ev)=>{ const d=JSON.parse(ev.data).data; $('graphWrap').style.display='block';
    const g=$('graph'); g.innerHTML=''; d.subtasks.forEach((s,i)=>{ if(i>0){const a=document.createElement('div');a.className='arrow';a.textContent='→';g.appendChild(a);} g.appendChild(node(s)); });
    $('cstatus').textContent='Команда собрана: '+d.subtasks.map(s=>s.agentType).join(' → '); });
  es.addEventListener('orchestration.subtask',(ev)=>{ const d=JSON.parse(ev.data).data; setStatus(d.subtaskId,d.status,d.agentName); });
  es.addEventListener('run.succeeded', async (ev)=>{ const e2=JSON.parse(ev.data); if(e2.runId!==runId)return;
    const r=await api('/runs/'+runId); $('resultWrap').style.display='block'; $('result').textContent=render(r.run&&r.run.output);
    $('cstatus').textContent='Готово ✓'; $('go').disabled=false; es.close(); });
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
</script>
</body>
</html>`;
