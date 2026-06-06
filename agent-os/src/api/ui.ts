// Coordinator UI (PRD M5): a zero-dependency single page served by the control
// plane. Submits a task, then renders the live "assembly graph" of agents via SSE.

export const COORDINATOR_HTML = /* html */ `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>agent-os — Координатор</title>
<style>
  :root { --bg:#0f1419; --card:#1b232c; --fg:#e6edf3; --muted:#8b949e; --accent:#2f81f7;
          --ok:#2ea043; --run:#d29922; --fail:#f85149; --border:#30363d; }
  * { box-sizing:border-box; } body { margin:0; font-family:-apple-system,Segoe UI,Roboto,sans-serif;
       background:var(--bg); color:var(--fg); }
  header { padding:18px 24px; border-bottom:1px solid var(--border); font-weight:700; }
  main { max-width:860px; margin:0 auto; padding:24px; }
  form { display:flex; gap:8px; margin-bottom:20px; }
  textarea { flex:1; background:var(--card); color:var(--fg); border:1px solid var(--border);
             border-radius:8px; padding:10px 12px; font:inherit; resize:vertical; min-height:52px; }
  button { background:var(--accent); color:#fff; border:0; border-radius:8px; padding:10px 18px;
           font:inherit; cursor:pointer; }
  button:disabled { opacity:.5; cursor:default; }
  .section-title { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.05em; margin:18px 0 8px; }
  .graph { display:flex; gap:10px; flex-wrap:wrap; }
  .node { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:12px 14px; min-width:170px; }
  .node .role { font-size:12px; color:var(--muted); }
  .node .name { font-weight:600; margin:2px 0 8px; }
  .badge { display:inline-block; font-size:12px; padding:2px 8px; border-radius:999px; }
  .badge.queued { background:#30363d; color:var(--muted); }
  .badge.running { background:rgba(210,153,34,.18); color:var(--run); }
  .badge.succeeded { background:rgba(46,160,67,.18); color:var(--ok); }
  .badge.failed { background:rgba(248,81,73,.18); color:var(--fail); }
  .arrow { align-self:center; color:var(--muted); }
  .result { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:16px; margin-top:18px; white-space:pre-wrap; }
  .status { color:var(--muted); font-size:13px; margin-top:6px; min-height:18px; }
</style>
</head>
<body>
<header>🤖 agent-os — Координатор</header>
<main>
  <form id="f">
    <textarea id="task" placeholder="Поставьте задачу команде агентов, например: Подготовь обзор рынка CRM и краткие рекомендации"></textarea>
    <button id="go" type="submit">Запустить</button>
  </form>
  <div class="status" id="status"></div>

  <div id="graphWrap" style="display:none">
    <div class="section-title">Граф сборки (агенты в работе)</div>
    <div class="graph" id="graph"></div>
  </div>

  <div id="resultWrap" style="display:none">
    <div class="section-title">Результат</div>
    <div class="result" id="result"></div>
  </div>
</main>
<script>
const ORG = 'demo';
const $ = (id) => document.getElementById(id);
let es = null;

function node(sub) {
  const el = document.createElement('div');
  el.className = 'node';
  el.id = 'n_' + sub.id;
  el.innerHTML = '<div class="role">' + sub.agentType + '</div>' +
    '<div class="name">' + (sub.agentName || sub.id) + '</div>' +
    '<span class="badge queued" id="b_' + sub.id + '">в очереди</span>';
  return el;
}
const LABEL = { queued:'в очереди', running:'работает…', succeeded:'готово', failed:'ошибка' };
function setStatus(subId, status, name) {
  const b = $('b_' + subId); if (!b) return;
  b.className = 'badge ' + status; b.textContent = LABEL[status] || status;
  if (name) { const n = $('n_' + subId).querySelector('.name'); if (n) n.textContent = name; }
}

$('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const task = $('task').value.trim();
  if (!task) return;
  $('go').disabled = true;
  $('graph').innerHTML = ''; $('graphWrap').style.display = 'none';
  $('resultWrap').style.display = 'none'; $('status').textContent = 'Координатор анализирует задачу…';
  if (es) es.close();

  const res = await fetch('/tasks', { method:'POST', body: JSON.stringify({ orgId: ORG, task }) });
  const { runId, error } = await res.json();
  if (!runId) { $('status').textContent = 'Ошибка: ' + (error || 'не удалось создать задачу'); $('go').disabled = false; return; }

  es = new EventSource('/runs/' + runId + '/events');
  es.addEventListener('orchestration.planned', (ev) => {
    const d = JSON.parse(ev.data).data;
    $('graphWrap').style.display = 'block';
    const g = $('graph'); g.innerHTML = '';
    d.subtasks.forEach((s, i) => {
      if (i > 0) { const a = document.createElement('div'); a.className='arrow'; a.textContent='→'; g.appendChild(a); }
      g.appendChild(node(s));
    });
    $('status').textContent = 'Команда собрана: ' + d.subtasks.map(s => s.agentType).join(' → ');
  });
  es.addEventListener('orchestration.subtask', (ev) => {
    const d = JSON.parse(ev.data).data;
    setStatus(d.subtaskId, d.status, d.agentName);
  });
  es.addEventListener('run.succeeded', async (ev) => {
    const e2 = JSON.parse(ev.data);
    if (e2.runId !== runId) return;
    const r = await fetch('/runs/' + runId).then((r) => r.json());
    const out = r.run && r.run.output;
    $('resultWrap').style.display = 'block';
    $('result').textContent = render(out);
    $('status').textContent = 'Готово ✓';
    $('go').disabled = false; es.close();
  });
  ['run.failed','run.needs_human'].forEach((t) => es.addEventListener(t, (ev) => {
    const e2 = JSON.parse(ev.data);
    if (e2.runId !== runId) return;
    $('status').textContent = t === 'run.needs_human' ? 'Требуется вмешательство человека (лимит итераций).' : 'Задача завершилась с ошибкой.';
    $('go').disabled = false; es.close();
  }));
});

function render(out) {
  if (!out) return '(пусто)';
  if (typeof out === 'string') return out;
  let s = '';
  if (out.summary) s += String(out.summary) + '\\n\\n';
  if (out.subtasks) for (const k of Object.keys(out.subtasks)) s += '• ' + k + ': ' + String(out.subtasks[k]) + '\\n';
  return s || JSON.stringify(out, null, 2);
}
</script>
</body>
</html>`;
