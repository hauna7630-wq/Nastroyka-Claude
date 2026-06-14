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
       background:var(--bg); color:var(--fg); display:flex; overflow:hidden; }
  aside#side { width:240px; min-width:240px; background:#10161d; border-right:1px solid var(--border);
       display:flex; flex-direction:column; padding:14px 12px 10px; gap:4px; overflow:auto; }
  .logo { font-weight:700; font-size:15px; padding:2px 6px 12px; display:flex; gap:8px; align-items:center; }
  .newtask { background:var(--accent); color:#fff; border:0; border-radius:8px; padding:9px 10px; font:inherit;
       cursor:pointer; font-weight:600; font-size:13px; margin-bottom:8px; }
  nav.snav { display:flex; flex-direction:column; gap:2px; }
  nav.snav button { text-align:left; background:transparent; color:var(--muted); border:1px solid transparent;
       border-radius:8px; padding:8px 10px; cursor:pointer; font:inherit; letter-spacing:.02em; white-space:nowrap; overflow:hidden; }
  nav.snav button.active { background:var(--card); color:var(--fg); border-color:var(--border); }
  .sside-title { color:#5b6672; font-size:10.5px; letter-spacing:.09em; margin:14px 6px 4px; }
  .scard { background:var(--card); border:1px solid var(--border); border-radius:9px; padding:8px 10px;
       cursor:pointer; display:flex; gap:8px; align-items:center; margin-bottom:5px; }
  .scard:hover { border-color:var(--accent); }
  .sava { width:26px; height:26px; min-width:26px; border-radius:7px; display:flex; align-items:center;
       justify-content:center; font-weight:700; font-size:13px; color:#fff; }
  .sname { font-size:13px; font-weight:600; } .srole { font-size:10.5px; color:var(--muted); }
  .sactive { margin-left:auto; font-size:9.5px; color:var(--ok); background:rgba(46,160,67,.15); padding:2px 6px; border-radius:999px; }
  .sbottom { margin-top:auto; padding-top:10px; border-top:1px solid #1b232c; color:var(--muted); font-size:12px; padding-left:6px; }
  .content { flex:1; display:flex; flex-direction:column; min-height:0; }
  main { flex:1; width:100%; max-width:1500px; margin:0 auto; padding:18px 22px; overflow:hidden; min-height:0; display:flex; flex-direction:column; }
  @media (max-width: 920px){ aside#side { width:68px; min-width:68px; padding:14px 8px; }
    aside#side .sname, aside#side .srole, aside#side .sactive, aside#side .sside-title,
    aside#side .logo .vbadge, aside#side .logo .ltext, aside#side .sbottom { display:none; }
    aside#side .newtask { font-size:16px; padding:7px 0; } }
  .tab { display:none; } .tab.active { display:flex; flex-direction:column; flex:1; min-height:0; overflow:auto; }
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
  .chat { display:flex; flex-direction:column; height:100%; min-height:0; border:1px solid var(--border); border-radius:10px; background:var(--card); position:relative; }
  .chat.dragover { box-shadow:inset 0 0 0 2px var(--accent); }
  .attchip { display:inline-block; background:#1b232c; border:1px solid var(--border); border-radius:6px; padding:1px 6px; margin:1px 0; font-size:11.5px; }
  .attchip a { color:var(--muted); text-decoration:none; margin-left:3px; }
  .attchip a:hover { color:var(--fail); }
  .chat.dragover::after { content:'Отпустите файл — приложу к сообщению'; position:absolute; inset:6px; display:flex; align-items:center; justify-content:center; border:2px dashed var(--accent); border-radius:8px; background:rgba(47,129,247,.10); color:var(--accent); font-weight:600; font-size:14px; pointer-events:none; z-index:5; }
  .chat-head { padding:11px 13px; border-bottom:1px solid var(--border); font-weight:600; }
  .chat-log { flex:1; overflow:auto; padding:13px; display:flex; flex-direction:column; gap:9px; }
  .msg { max-width:min(82%,680px); padding:8px 11px; border-radius:10px; white-space:pre-wrap; word-break:break-word; font-size:14px; line-height:1.45; position:relative; }
  .msg.me { align-self:flex-end; background:var(--accent); color:#fff; }
  .msg.them { align-self:flex-start; background:#0d1117; border:1px solid var(--border); }
  .msg .who { font-size:11px; color:var(--muted); margin-bottom:3px; }
  .msg .mh { font-weight:700; font-size:14.5px; }
  .msg a { color:#58a6ff; text-decoration:underline; word-break:break-all; }
  .msg.me a { color:#e8f0ff; }
  .msg .quote { font-size:11.5px; opacity:.82; border-left:2px solid rgba(255,255,255,.5); padding:1px 0 1px 7px; margin-bottom:5px; white-space:pre-wrap; }
  .msg.them .quote { border-left-color:#4a5560; color:var(--muted); }
  .msg .rbtn { display:none; position:absolute; top:-9px; background:#1b232c; color:var(--muted); border:1px solid var(--border); border-radius:6px; font-size:11px; padding:1px 7px; cursor:pointer; }
  .msg .rbtn.reply { right:-7px; } .msg .rbtn.react { right:64px; }
  .msg:hover .rbtn { display:block; }
  .msg .rbtn:hover { color:var(--fg); border-color:var(--accent); }
  .reacts { display:flex; gap:4px; flex-wrap:wrap; margin-top:5px; }
  .reacts .rx { background:#0d1117; border:1px solid var(--border); border-radius:999px; font-size:13px; padding:1px 7px; cursor:pointer; line-height:1.5; }
  .msg.me .reacts .rx { background:rgba(0,0,0,.18); border-color:rgba(255,255,255,.25); }
  .reacts .rx:hover { border-color:var(--accent); }
  .emojipop { position:absolute; z-index:30; background:#161d24; border:1px solid var(--border); border-radius:10px; padding:7px; box-shadow:0 8px 24px rgba(0,0,0,.45); width:236px; }
  .emojipop .erow { display:flex; gap:3px; flex-wrap:wrap; }
  .emojipop button { background:transparent; border:0; font-size:19px; cursor:pointer; padding:3px 4px; border-radius:7px; line-height:1; }
  .emojipop button:hover { background:#23303b; }
  #chatReply .rchip { display:flex; align-items:center; gap:8px; border-left:3px solid var(--accent); background:#0d1117; border-radius:6px; padding:5px 9px; font-size:12px; color:var(--muted); }
  #chatReply .rchip b { color:var(--fg); font-weight:600; margin-right:4px; }
  #chatReply .rchip a { margin-left:auto; color:var(--muted); text-decoration:none; }
  .chat-form { display:flex; gap:8px; padding:10px; border-top:1px solid var(--border); align-items:flex-end; }
  .chat-form input { flex:1; }
  .chat-form textarea { flex:1; resize:none; min-height:0; height:40px; max-height:140px; line-height:1.35; overflow-y:auto; }
  #chatMic.rec { background:#f85149; color:#fff; border-color:#f85149; animation:micpulse 1s ease-in-out infinite; }
  @keyframes micpulse { 0%,100%{ box-shadow:0 0 0 0 rgba(248,81,73,.5); } 50%{ box-shadow:0 0 0 5px rgba(248,81,73,0); } }
  .chat-inbox { border-bottom:1px solid var(--border); padding:8px 11px; max-height:30vh; overflow:auto; background:rgba(210,153,34,.06); }
  .chat-inbox .ititle { font-size:11px; font-weight:700; letter-spacing:.04em; color:var(--run); margin-bottom:6px; }
  .chat-inbox .irow { display:flex; align-items:center; gap:8px; padding:6px 0; border-top:1px solid var(--border); }
  .chat-inbox .irow:first-of-type { border-top:0; }
  .chat-inbox .itask { flex:1; font-size:12.5px; }
  .chat-inbox .ifrom { color:var(--muted); font-size:11px; }
  .chat-inbox .ibtn { font:inherit; font-size:11.5px; font-weight:600; border:0; border-radius:7px; padding:4px 10px; cursor:pointer; background:var(--accent); color:#fff; white-space:nowrap; }
  .chat-inbox .ibtn.ghost { background:#1b232c; color:var(--fg); border:1px solid var(--border); }
  .chat-inbox .ibadge { font-size:11px; white-space:nowrap; padding:2px 7px; border-radius:6px; }
  .modebtn { font:inherit; font-size:12px; font-weight:600; border:1px solid var(--border); border-radius:8px; padding:0 12px; cursor:pointer; background:#1b232c; white-space:nowrap; }
  .modebtn.auto { color:var(--run); border-color:rgba(210,153,34,.55); }
  .modebtn.confirm { color:var(--accent); border-color:rgba(47,129,247,.55); }
  form#f .modebtn { padding:10px 12px; }
  .dlbtn { float:right; font:inherit; font-size:11.5px; font-weight:600; border:1px solid var(--border); border-radius:7px; padding:3px 9px; margin:0 0 6px 8px; cursor:pointer; background:#1b232c; color:var(--fg); }
  .dlbtn:hover { border-color:var(--accent); color:var(--accent); }
  .msg.them.pending { opacity:.85; }
  .msg .typing { color:var(--muted); font-style:italic; }
  .msg .typing .tdots { display:inline-block; animation:tdots 1.1s steps(4,end) infinite; overflow:hidden; vertical-align:bottom; }
  @keyframes tdots { 0%{width:0} 100%{width:1.1em} }
  .hire-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:14px; }
  .hcard { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px 15px; display:flex; flex-direction:column; gap:8px; }
  .hcard.rec { border-color:rgba(46,160,67,.6); background:linear-gradient(180deg, rgba(46,160,67,.07), var(--card)); }
  .hcard h4 { margin:0; font-size:15px; }
  .hcard .hdesc { font-size:12.5px; color:var(--muted); line-height:1.4; min-height:34px; }
  .hcard .hava { display:flex; gap:8px; align-items:flex-end; }
  .hcard .hava .hv { display:flex; flex-direction:column; align-items:center; gap:2px; }
  .hcard .hava .hv span { font-size:10px; color:var(--muted); max-width:74px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .hcard canvas { image-rendering:pixelated; }
  .hcard .hbtn { margin-top:auto; }
  .hcard .hired { color:var(--ok); font-size:12px; font-weight:600; }
  .recbadge { font-size:10px; color:var(--ok); background:rgba(46,160,67,.16); border-radius:999px; padding:2px 8px; margin-left:8px; vertical-align:middle; }
  .phasebar { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
  .taskbar { display:flex; gap:7px; flex-wrap:wrap; margin-bottom:10px; }
  .tchip { display:inline-flex; align-items:center; gap:6px; padding:5px 9px; border:1px solid var(--border); border-radius:999px; background:#1b232c; color:var(--muted); font-size:12px; cursor:pointer; }
  .tchip.active { border-color:var(--accent); color:var(--fg); background:#15202c; }
  .tchip.unseen { box-shadow:0 0 0 2px rgba(46,160,67,.55); }
  .tchip .tdot { width:8px; height:8px; border-radius:50%; flex:none; }
  .tchip .tlabel { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:130px; }
  .tchip .tphase { font-size:10px; letter-spacing:.04em; opacity:.75; }
  .tchip .tx { margin-left:2px; opacity:.5; font-size:11px; }
  .tchip .tx:hover { opacity:1; color:var(--fail); }
  /* Office tab: canvas in its own full-height column, text panels in a side column */
  .coord-body { display:flex; gap:14px; flex:1; min-height:0; }
  .office-col { flex:1; min-width:0; display:flex; flex-direction:column; min-height:0; }
  .coord-side { width:360px; min-width:300px; max-width:380px; overflow:auto; display:flex; flex-direction:column; gap:4px; }
  @media (max-width:1000px){ .coord-body { flex-direction:column; } .coord-side { width:auto; max-width:none; min-width:0; max-height:38vh; } }
  .phase { font-size:11px; padding:3px 10px; border-radius:999px; background:#30363d; color:var(--muted); letter-spacing:.04em; }
  .phase.on { background:rgba(210,153,34,.2); color:var(--run); }
  .phase.done { background:rgba(46,160,67,.18); color:var(--ok); }
  .phase.fail { background:rgba(248,81,73,.18); color:var(--fail); }
  .dfeed { display:flex; flex-direction:column; gap:8px; max-height:260px; overflow:auto; border:1px solid var(--border); border-radius:10px; background:#0d1117; padding:10px; }
  .dmsg { font-size:13px; line-height:1.45; white-space:pre-wrap; }
  .dmsg .dwho { font-weight:600; margin-right:6px; }
  .dmsg.review { border-left:3px solid #db61a2; padding-left:8px; }
  .dmsg.revision { border-left:3px solid #d29922; padding-left:8px; }
  .dmsg.live { border-left:3px solid #2ea043; padding-left:8px; opacity:.95; }
  .tcursor { animation:blink 1s steps(1) infinite; color:#2ea043; }
  @keyframes blink { 50% { opacity:0; } }
  .actfeed { max-height:150px; overflow:auto; border:1px solid var(--border); border-radius:8px; background:#0d1117; padding:6px 10px; font-size:13px; }
  .actfeed .act { padding:3px 0; border-bottom:1px solid #161d24; }
  .actfeed .act-t { color:var(--muted); font-size:11px; margin-right:6px; }
</style>
</head>
<body>
<aside id="side">
  <div class="logo">🤖 <span class="ltext">agent-os</span> <span class="vbadge" style="color:#2ea043;font-size:11px;font-weight:600">v63 · надёжный деплой</span></div>
  <button class="newtask" id="sideNew">+ Новая задача</button>
  <nav class="snav">
    <button data-tab="coord" class="active">🏢 Офис</button>
    <button data-tab="tasks">☑️ Задачи</button>
    <button data-tab="activity">📈 Активность</button>
    <button data-tab="staff">💬 Сотрудники</button>
    <button data-tab="hire">🛒 Нанять команду</button>
    <button data-tab="team">👥 Команда</button>
    <button data-tab="admin">⚙️ Админ</button>
  </nav>
  <div class="sside-title">КООРДИНАТОР</div>
  <div id="sideCoord"></div>
  <div class="sside-title">СОТРУДНИКИ <span id="scount"></span></div>
  <div id="sideStaff"></div>
  <div class="sbottom">agent-os · личная команда ИИ</div>
</aside>
<div class="content">
<main>
  <!-- Координатор -->
  <section class="tab active" id="tab-coord">
    <form id="f">
      <textarea id="task" placeholder="Поставьте задачу команде агентов — можно несколько подряд, они пойдут в работу параллельно. Например: Подготовь обзор рынка CRM и рекомендации"></textarea>
      <button id="modeOffice" class="modebtn" type="button" title="Режим работы агентов: Автомат — выполняют сами; Подтверждение — только предлагают">⚡ Автомат</button>
      <button id="go" class="primary" type="submit">Запустить</button>
    </form>
    <div class="coord-body">
      <div class="office-col">
        <div id="officeWrap"><canvas id="office" width="900" height="520"></canvas><div class="office-legend" id="olegend"></div></div>
      </div>
      <div class="coord-side">
        <div id="taskBar" class="taskbar" style="display:none"></div>
        <div class="status" id="cstatus"></div>
        <div id="phaseWrap" style="display:none"><div class="section-title">Жизненный цикл задачи</div><div id="phaseBar" class="phasebar"></div></div>
        <div id="discussWrap" style="display:none"><div class="section-title">Обсуждение команды</div><div id="discussFeed" class="dfeed" style="max-height:42vh"></div></div>
        <div id="graphWrap" style="display:none"><div class="section-title">Граф сборки</div><div class="graph" id="graph"></div></div>
        <div id="resultWrap" style="display:none"><div class="section-title">Результат</div><div class="result" id="result"></div></div>
        <div class="section-title">Лента активности</div><div id="activityFeed" class="actfeed"></div>
      </div>
    </div>
  </section>

  <!-- Сотрудники: личный чат с каждым -->
  <section class="tab" id="tab-staff">
    <div class="section-title">Личный чат: выберите сотрудника и поставьте задачу — он ответит</div>
    <div class="staff-wrap">
      <div class="staff-list" id="staffList"></div>
      <div class="chat">
        <div class="chat-head" id="chatHead">Выберите сотрудника слева</div>
        <div id="chatInbox" class="chat-inbox" style="display:none"></div>
        <div class="chat-log" id="chatLog"></div>
        <div id="chatReply" style="display:none;padding:4px 10px"></div>
        <div id="chatAttach" style="display:none;padding:4px 10px;font-size:12px"></div>
        <form class="chat-form" id="chatForm">
          <input type="file" id="chatFile" multiple style="display:none" />
          <button type="button" id="chatClip" title="Прикрепить файл (txt/md/csv/json/docx/pdf/xlsx)" disabled style="min-width:38px">📎</button>
          <button type="button" id="chatMic" title="Голосовой ввод (надиктовать задачу)" disabled style="min-width:38px">🎤</button>
          <button id="modeChat" class="modebtn" type="button" title="Режим работы: Автомат — агент выполняет сам; Подтверждение — только предлагает">⚡ Автомат</button>
          <textarea id="chatInput" rows="1" placeholder="Напишите задачу или вопрос…  (Enter — отправить, Shift+Enter — новая строка)" autocomplete="off" disabled></textarea>
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

  <!-- Нанять команду: каталог готовых команд -->
  <section class="tab" id="tab-hire">
    <div class="section-title">Готовые команды — наймите всю команду в один клик; Arkesha координирует всех</div>
    <div id="hireStatus" class="status"></div>
    <div id="hireGrid" class="hire-grid"></div>
  </section>

  <!-- Задачи -->
  <section class="tab" id="tab-tasks">
    <div class="section-title">Задачи организации (последние 30)</div>
    <div id="tasksList" class="dfeed" style="max-height:none;flex:1"></div>
  </section>

  <!-- Активность -->
  <section class="tab" id="tab-activity">
    <div class="section-title">Активность офиса</div>
    <div id="activityBig" class="actfeed" style="max-height:none;flex:1"></div>
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
</div>
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
  if (b.dataset.tab === 'tasks') loadTasks();
  if (b.dataset.tab === 'activity') renderActivity('activityBig', 200);
  if (b.dataset.tab === 'hire') loadHire();
}));
function openTab(name){ var btn=document.querySelector('nav.snav button[data-tab="'+name+'"]'); if(btn) btn.click(); }
$('sideNew').addEventListener('click', function(){ openTab('coord'); var t=$('task'); if(t) t.focus(); });

// --- Coordinator (MULTI-TASK) ---
const LABEL = { queued:'в очереди', running:'работает…', succeeded:'готово', failed:'ошибка' };
function node(sub){ const el=document.createElement('div'); el.className='node'; el.id='n_'+sub.id;
  el.innerHTML='<div class="role">'+sub.agentType+'</div><div class="name">'+(sub.agentName||sub.id)+'</div><span class="badge queued" id="b_'+sub.id+'">в очереди</span>'; return el; }
function setStatus(id,s,name){ const b=$('b_'+id); if(!b)return; b.className='badge '+s; b.textContent=LABEL[s]||s; if(name){const n=$('n_'+id).querySelector('.name'); if(n)n.textContent=name;} }
function render(out){ if(!out)return '(пусто)'; if(typeof out==='string')return out; let s=''; if(out.summary)s+=String(out.summary)+'\\n\\n'; if(out.subtasks)for(const k of Object.keys(out.subtasks))s+='• '+k+': '+String(out.subtasks[k])+'\\n'; return s||JSON.stringify(out,null,2); }
// --- Task lifecycle: phase chips + team discussion (server-derived, survives reload)
var PHASE_SEQ=['new','analyzing','working','reviewing','revising','completed'];
var PHASE_RU={new:'НОВАЯ',analyzing:'АНАЛИЗ',working:'В РАБОТЕ',reviewing:'РЕВЬЮ',revising:'ДОРАБОТКА',completed:'ГОТОВО',failed:'ОШИБКА',needs_human:'НУЖЕН ЧЕЛОВЕК'};
// Multi-task store: several tasks run at once. tasks[runId] holds each one's own
// lifecycle/discussion/result + live SSE; the detail panel shows the SELECTED
// task, the rest keep updating their chip in the background.
var tasks={}; var selectedTask=null;
function taskLabel(text){ return String(text||'задача').replace(/\\s+/g,' ').trim().slice(0,42); }
// Office speech bubble fed by an agent's REAL streamed output (throttled) — so the
// office shows actual work, not canned chatter. Resolves the office agent by name.
var _liveBubbleAt={};
function officeSayLive(name,type,text){
  var a=matchAgent(name,type); if(!a||!text) return;
  var now=Date.now(); if(_liveBubbleAt[a.name] && now-_liveBubbleAt[a.name]<700) return; _liveBubbleAt[a.name]=now;
  var s=String(text).replace(/\\s+/g,' ').trim(); if(!s) return;
  setBubble(a.name, s.slice(-46), 110);
}
function renderPhaseBar(t){
  $('phaseWrap').style.display='block'; var bar=$('phaseBar'); bar.innerHTML='';
  var cur=t.phase||'new'; var failed=(cur==='failed'||cur==='needs_human');
  var idx=PHASE_SEQ.indexOf(failed?'completed':cur); if(idx<0) idx=PHASE_SEQ.length-1;
  PHASE_SEQ.forEach(function(p,i){
    var el=document.createElement('span'); el.className='phase'; el.textContent=PHASE_RU[p];
    if(failed&&i===PHASE_SEQ.length-1){ el.className='phase fail'; el.textContent=PHASE_RU[cur]; }
    else if(i<idx){ el.className='phase done'; }
    else if(i===idx){ el.className='phase '+(cur==='completed'?'done':'on'); }
    bar.appendChild(el);
    if(i<PHASE_SEQ.length-1){ var a=document.createElement('span'); a.textContent='›'; a.style.color='#39424c'; bar.appendChild(a); }
  });
}
function renderGraph(t){
  if(!t.planSubtasks||!t.planSubtasks.length){ $('graphWrap').style.display='none'; return; }
  $('graphWrap').style.display='block'; var g=$('graph'); g.innerHTML='';
  t.planSubtasks.forEach(function(s,i){ if(i>0){ var a=document.createElement('div'); a.className='arrow'; a.textContent='→'; g.appendChild(a); } g.appendChild(node(s)); });
  var ss=t.subStatus||{}; Object.keys(ss).forEach(function(sid){ setStatus(sid, ss[sid]); });
}
function renderDiscuss(t){
  var auth=(t&&t.lastTeam&&t.lastTeam.discussion)?t.lastTeam.discussion:[];
  var live=(t&&t.discussLive)?t.discussLive:{};
  var liveIds=Object.keys(live);
  if(!auth.length && !liveIds.length){ $('discussWrap').style.display='none'; return; }
  $('discussWrap').style.display='block'; var feed=$('discussFeed'); feed.innerHTML='';
  auth.forEach(function(d){
    var el=document.createElement('div'); el.className='dmsg '+d.kind;
    var label=d.kind==='review'?' · ревью':d.kind==='revision'?' · доработка':'';
    var ic=d.kind==='review'?'🔍':d.kind==='revision'?'♻️':roleIcon(d.agentType);
    el.innerHTML='<span class="dwho" style="color:'+roleColor(d.agentType)+'">'+ic+' '+escapeHtml(shortName(d.author))+label+'</span><div class="dbody">'+mdLite(d.text.slice(0,2000))+'</div>';
    feed.appendChild(el); });
  liveIds.forEach(function(sid){
    var d=live[sid]; if(!d||!d.text) return;
    var el=document.createElement('div'); el.className='dmsg contribution live';
    el.innerHTML='<span class="dwho" style="color:'+roleColor(d.agentType)+'">'+roleIcon(d.agentType)+' '+escapeHtml(shortName(d.agentName))+' · печатает…</span><div class="dbody">'+mdLite(d.text.slice(-1400))+'<span class="tcursor">▍</span></div>';
    feed.appendChild(el); });
  feed.scrollTop=feed.scrollHeight;
}
function renderResult(t){
  if(t.output!==undefined && t.output!==null){ $('resultWrap').style.display='block';
    var raw=render(t.output);
    $('result').innerHTML='<button class="dlbtn" id="dlResult">⬇ Скачать .md</button>'+mdLite(raw);
    var db=$('dlResult'); if(db) db.onclick=function(){ downloadText(slugFile('результат_'+(t.label||'задача')), raw); };
    if(!t._scrolled){ t._scrolled=true; try{ $('resultWrap').scrollIntoView({behavior:'smooth',block:'nearest'}); }catch(e){} } }
  else { $('resultWrap').style.display='none'; }
}
function statusLine(t){
  if(t.status==='succeeded') return 'Готово ✓';
  if(t.status==='failed') return 'Задача завершилась с ошибкой.';
  if(t.status==='needs_human') return 'Требуется человек (лимит итераций).';
  return t.statusText||'В работе…';
}
function renderTaskDetail(rid){
  var t=tasks[rid]; if(!t) return; var n=Object.keys(tasks).length;
  $('cstatus').textContent=statusLine(t)+(n>1?('   ·   задач в работе: '+n):'');
  renderPhaseBar(t); renderGraph(t); renderDiscuss(t); renderResult(t);
}
function clearTaskDetail(){
  $('cstatus').textContent=''; $('phaseWrap').style.display='none'; $('discussWrap').style.display='none';
  $('graphWrap').style.display='none'; $('resultWrap').style.display='none';
}
function renderTaskBar(){
  var bar=$('taskBar'); if(!bar) return; var ids=Object.keys(tasks);
  if(!ids.length){ bar.style.display='none'; bar.innerHTML=''; return; }
  bar.style.display='flex'; bar.innerHTML='';
  ids.forEach(function(rid){ var t=tasks[rid];
    var chip=document.createElement('button'); chip.type='button';
    chip.className='tchip'+(rid===selectedTask?' active':'')+(t.done&&!t.seen?' unseen':'');
    var dc=t.status==='succeeded'?'#2ea043':(t.status==='failed'||t.status==='needs_human')?'#f85149':'#d29922';
    chip.innerHTML='<span class="tdot" style="background:'+dc+'"></span><span class="tlabel">'+escapeHtml(t.label)+'</span><span class="tphase">'+(PHASE_RU[t.phase]||'')+'</span>';
    chip.addEventListener('click',(function(id){ return function(){ selectTask(id); }; })(rid));
    var x=document.createElement('span'); x.className='tx'; x.textContent='✕'; x.title='Убрать из списка';
    x.addEventListener('click',(function(id){ return function(ev){ ev.stopPropagation(); closeTask(id); }; })(rid));
    chip.appendChild(x); bar.appendChild(chip);
  });
}
function selectTask(rid){ if(!tasks[rid]) return; selectedTask=rid; tasks[rid].seen=true; renderTaskDetail(rid); renderTaskBar(); }
function closeTask(rid){ var t=tasks[rid]; if(!t) return;
  if(t.es){ try{ t.es.close(); }catch(e){} } if(t.pollTimer) clearTimeout(t.pollTimer);
  delete tasks[rid]; saveActiveTasks();
  if(selectedTask===rid){ selectedTask=Object.keys(tasks)[0]||null; if(selectedTask) renderTaskDetail(selectedTask); else clearTaskDetail(); }
  renderTaskBar();
}
function saveActiveTasks(){ try{ var a=Object.keys(tasks).map(function(id){ return {id:id,label:tasks[id].label}; }); localStorage.setItem('agentos_active_tasks', JSON.stringify(a)); }catch(e){} }
function pollTeam(rid){ var t=tasks[rid]; if(!t) return;
  if(t.pollTimer) clearTimeout(t.pollTimer);
  api('/runs/'+rid+'/team').then(function(tm){
    if(!tm||!tm.phase){ t.pollTimer=setTimeout(function(){ pollTeam(rid); },3500); return; }
    t.phase=tm.phase; t.lastTeam=tm;
    var terminal=(tm.phase==='completed'||tm.phase==='failed'||tm.phase==='needs_human');
    if(terminal){ t.done=true; t.status=tm.phase==='completed'?'succeeded':(tm.phase==='failed'?'failed':'needs_human');
      if(tm.run && tm.run.output!==undefined) t.output=tm.run.output; }
    if(rid===selectedTask) renderTaskDetail(rid);
    renderTaskBar();
    if(!terminal) t.pollTimer=setTimeout(function(){ pollTeam(rid); },3000);
  }).catch(function(){ t.pollTimer=setTimeout(function(){ pollTeam(rid); },4000); });
}
function startTaskStream(rid){ var t=tasks[rid]; if(!t || typeof EventSource==='undefined') return;
  var es=new EventSource('/runs/'+rid+'/events'); t.es=es;
  es.addEventListener('orchestration.planned',function(ev){ var d; try{ d=JSON.parse(ev.data).data; }catch(e){ return; }
    t.planSubtasks=d.subtasks||[]; t.statusText='Команда собрана: '+t.planSubtasks.map(function(s){ return s.agentType; }).join(' → ');
    if(rid===selectedTask) renderTaskDetail(rid);
    pushOfficeCard('🧩','План готов',t.planSubtasks.length+' подзадач · '+t.planSubtasks.map(function(s){ return roleIcon(s.agentType); }).join(''),'#d29922'); });
  es.addEventListener('orchestration.subtask',function(ev){ var d; try{ d=JSON.parse(ev.data).data; }catch(e){ return; }
    if(!t.subStatus) t.subStatus={}; t.subStatus[d.subtaskId]=d.status;
    officeSet(d.agentName,d.agentType,d.status);
    if(rid===selectedTask) setStatus(d.subtaskId,d.status,d.agentName);
    if(d.status==='succeeded'||d.status==='failed'){ if(t.discussLive) delete t.discussLive[d.subtaskId]; if(rid===selectedTask) renderDiscuss(t); } });
  es.addEventListener('run.token',function(ev){ var d; try{ d=JSON.parse(ev.data).data; }catch(e){ return; }
    if(!d||!d.subtaskId||typeof d.text!=='string') return;
    if(!t.discussLive) t.discussLive={};
    var cur=t.discussLive[d.subtaskId]||{agentName:d.agentName,agentType:d.agentType,text:''};
    cur.text=(cur.text||'')+d.text; t.discussLive[d.subtaskId]=cur;
    officeSayLive(d.agentName,d.agentType,cur.text);
    if(rid===selectedTask) renderDiscuss(t); });
  es.addEventListener('run.succeeded',function(ev){ var e2; try{ e2=JSON.parse(ev.data); }catch(e){ return; } if(e2.runId!==rid) return;
    t.done=true; t.status='succeeded'; if(rid!==selectedTask) t.seen=false;
    api('/runs/'+rid).then(function(r){ t.output=r.run&&r.run.output; if(rid===selectedTask) renderTaskDetail(rid); renderTaskBar(); });
    officeSet(null,'orchestrator','succeeded'); try{ es.close(); }catch(e){} });
  ['run.failed','run.needs_human'].forEach(function(tp){ es.addEventListener(tp,function(ev){ var e2; try{ e2=JSON.parse(ev.data); }catch(e){ return; } if(e2.runId!==rid) return;
    t.done=true; t.status=(tp==='run.needs_human')?'needs_human':'failed'; if(rid!==selectedTask) t.seen=false;
    if(rid===selectedTask) renderTaskDetail(rid); renderTaskBar(); try{ es.close(); }catch(e){} }); });
}
// Work mode (глобальный, localStorage): Автомат — агенты реально выполняют код/
// инструменты; Подтверждение — только предлагают (исполнение придержано).
function autoMode(){ try{ return localStorage.getItem('agentos_auto')!=='0'; }catch(e){ return true; } }
function renderModeBtns(){ var on=autoMode(); ['modeOffice','modeChat'].forEach(function(id){ var b=$(id); if(!b) return; b.textContent=on?'⚡ Автомат':'🔒 Подтверждение'; b.className='modebtn '+(on?'auto':'confirm'); }); }
function toggleAutoMode(){ try{ localStorage.setItem('agentos_auto', autoMode()?'0':'1'); }catch(e){} renderModeBtns(); }
(function(){ ['modeOffice','modeChat'].forEach(function(id){ var b=document.getElementById(id); if(b) b.addEventListener('click', toggleAutoMode); }); renderModeBtns(); })();
function startTask(rid, label, select){
  tasks[rid]={ runId:rid, label:taskLabel(label), phase:'new', status:'running', statusText:'Координатор анализирует задачу…', planSubtasks:[], subStatus:{}, discussLive:{}, lastTeam:null, output:undefined, es:null, pollTimer:null, done:false, seen:true };
  if(select!==false) selectedTask=rid;
  saveActiveTasks(); renderTaskBar();
  if(rid===selectedTask) renderTaskDetail(rid);
  startTaskStream(rid); pollTeam(rid);
}
$('f').addEventListener('submit', async function(e){
  e.preventDefault(); var task=$('task').value.trim(); if(!task) return;
  $('go').disabled=true; officeSet(null,'orchestrator','running');
  var resp=await api('/tasks',{method:'POST',body:JSON.stringify({orgId:ORG,task:task,autoRun:autoMode()})});
  $('go').disabled=false;
  if(!resp||!resp.runId){ $('cstatus').textContent='Ошибка: '+((resp&&resp.error)||'нет orchestrator-агента — создайте его во вкладке «Команда»'); return; }
  $('task').value=''; $('task').focus();
  startTask(resp.runId, task, true);
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
// Lightweight, XSS-safe markdown for chat bubbles: escape FIRST, then re-introduce
// a small, fixed set of inline HTML. Handles **bold**, #-headers, "- " bullets and
// [label](http…) links (URL allows one nesting level of () so wiki links survive).
// .msg keeps white-space:pre-wrap, so newlines are preserved without <br>.
function mdLite(t){ var s=escapeHtml(String(t==null?'':t));
  s=s.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/(?:[^\\s()]|\\([^\\s()]*\\))*)\\)/g, function(m,lab,url){ return '<a href="'+url+'" target="_blank" rel="noopener noreferrer">'+lab+'</a>'; });
  s=s.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
  s=s.replace(/^#{1,6}\\s+(.+)$/gm, '<span class="mh">$1</span>');
  s=s.replace(/^[-*]\\s+/gm, '• ');
  return s; }
function replyText(out){ if(out==null) return '(пустой ответ)'; if(typeof out==='string') return out; if(out.report) return out.report; if(out.text) return out.text; if(out.summary) return (typeof out.summary==='string'?out.summary:JSON.stringify(out.summary)); return JSON.stringify(out,null,2); }
async function loadStaff(){
  try { staffAgents = await api('/orgs/'+ORG+'/agents'); } catch(e){ staffAgents=[]; }
  var list=$('staffList'); list.innerHTML='';
  if(!staffAgents.length){ list.innerHTML='<small class="muted">Нет сотрудников — запустите сид команды.</small>'; return; }
  staffAgents.forEach(function(a){ var el=document.createElement('div'); el.className='staff-item'+(currentAgent&&currentAgent.id===a.id?' active':''); el.id='st_'+a.id;
    el.innerHTML='<div>'+escapeHtml(shortName(a.name))+'</div><div class="role">'+escapeHtml(roleOf(a))+'</div>';
    el.addEventListener('click', function(){ selectAgent(a.id); }); list.appendChild(el); });
  if(pendingStaffSelect){ var pid=pendingStaffSelect; pendingStaffSelect=null; selectAgent(pid); }
}
// Clear a poisoned thread server-side (the server replays history into the
// prompt, so a client-only clear wouldn't stop the model copying old replies).
function clearChatThread(){
  if(!currentAgent) return; var aid=currentAgent.id;
  if(!window.confirm('Очистить всю историю чата с '+shortName(currentAgent.name)+'? Переписка удалится безвозвратно.')) return;
  api('/orgs/'+ORG+'/agents/'+aid+'/chat',{method:'DELETE'}).then(function(){
    chatThreads[aid]=[]; try{ delete chatPending[aid]; }catch(e){} saveChat();
    if(currentAgent&&currentAgent.id===aid) renderChat();
  }).catch(function(){ window.alert('Не удалось очистить чат — попробуйте ещё раз.'); });
}
function selectAgent(id){
  currentAgent = staffAgents.filter(function(a){ return a.id===id; })[0]; if(!currentAgent) return;
  document.querySelectorAll('.staff-item').forEach(function(x){ x.classList.remove('active'); });
  var c=$('st_'+id); if(c) c.classList.add('active');
  $('chatHead').innerHTML='<span>'+escapeHtml(shortName(currentAgent.name)+' — '+roleOf(currentAgent))+'</span><button id="chatClear" type="button" title="Удалить всю историю переписки с этим сотрудником" style="float:right;font:inherit;font-size:12px;font-weight:600;color:var(--muted);background:#1b232c;border:1px solid var(--border);border-radius:7px;padding:3px 9px;cursor:pointer">🗑 Очистить чат</button>';
  var cb=$('chatClear'); if(cb) cb.addEventListener('click', clearChatThread);
  $('chatInput').disabled=false; $('chatSend').disabled=false; $('chatClip').disabled=false; var mic=$('chatMic'); if(mic) mic.disabled=false; $('chatInput').focus();
  chatReplyTo=null; renderReplyChip();
  renderChat();
  loadChatHistory(id);
  loadAssignments(id);
}
// «Поручения» inbox: tasks delegated to THIS employee (assignment runs). «Приступить»
// enqueues the assignment and streams the result straight into the chat thread.
function loadAssignments(aid){
  api('/orgs/'+ORG+'/agents/'+aid+'/assignments').then(function(items){
    if(currentAgent && currentAgent.id===aid) renderInbox(aid, items||[]);
  }).catch(function(){});
}
function renderInbox(aid, items){
  var box=$('chatInbox'); if(!box) return;
  if(!items || !items.length){ box.style.display='none'; box.innerHTML=''; return; }
  box.style.display='block';
  box.innerHTML='<div class="ititle">📥 Поручения ('+items.length+')</div>';
  items.forEach(function(it){
    var row=document.createElement('div'); row.className='irow';
    var task=document.createElement('div'); task.className='itask';
    task.innerHTML='<div>'+escapeHtml(it.task)+'</div><div class="ifrom">от '+escapeHtml(it.from)+'</div>';
    row.appendChild(task);
    if(it.status==='succeeded'){
      var bdone=document.createElement('span'); bdone.className='ibadge'; bdone.style.color='#2ea043'; bdone.textContent='✓ готово'; row.appendChild(bdone);
      var br=document.createElement('button'); br.className='ibtn ghost'; br.textContent='Результат';
      br.addEventListener('click',(function(id){ return function(){ showAssignmentResult(aid,id); }; })(it.id)); row.appendChild(br);
    } else if(it.status==='failed'){
      var bf=document.createElement('span'); bf.className='ibadge'; bf.style.color='#f85149'; bf.textContent='⚠ ошибка'; row.appendChild(bf);
      var brf=document.createElement('button'); brf.className='ibtn'; brf.textContent='Повторить';
      brf.addEventListener('click',(function(id){ return function(){ startAssignment(aid,id); }; })(it.id)); row.appendChild(brf);
    } else if(it.started || it.status==='running'){
      var ba=document.createElement('span'); ba.className='ibadge'; ba.style.color='#d29922'; ba.textContent='⏳ выполняется'; row.appendChild(ba);
    } else {
      var bs=document.createElement('button'); bs.className='ibtn'; bs.textContent='Приступить';
      bs.addEventListener('click',(function(id,btn){ return function(){ btn.disabled=true; btn.textContent='…'; startAssignment(aid,id); }; })(it.id,bs)); row.appendChild(bs);
    }
    box.appendChild(row);
  });
}
function startAssignment(aid, id){
  api('/orgs/'+ORG+'/assignments/'+id+'/start',{method:'POST',body:'{}'}).then(function(r){
    if(r && r.runId){
      if(!chatThreads[aid]) chatThreads[aid]=[];
      chatThreads[aid].push({role:'them', status:'приступаю', pending:true, runId:r.runId});
      var idx=chatThreads[aid].length-1; saveChat();
      if(currentAgent && currentAgent.id===aid) renderChat();
      streamChatTokens(aid, r.runId, idx); pollRun(aid, r.runId, idx);
    }
    loadAssignments(aid);
  }).catch(function(){ loadAssignments(aid); });
}
function showAssignmentResult(aid, id){
  api('/runs/'+id).then(function(r){
    var out=r && r.run && r.run.output; if(out===undefined||out===null) return;
    if(!chatThreads[aid]) chatThreads[aid]=[];
    chatThreads[aid].push({role:'them', text: replyText(out)}); saveChat();
    if(currentAgent && currentAgent.id===aid) renderChat();
  }).catch(function(){});
}
// Dialog memory: the server thread is the source of truth (survives reload /
// other devices). localStorage stays only as an offline cache.
function loadChatHistory(aid){
  api('/orgs/'+ORG+'/agents/'+aid+'/chat').then(function(r){
    if(!r || !r.messages) return;
    var th=[];
    r.messages.forEach(function(m){ th.push({ role: m.role==='user'?'me':'them', text:m.text, runId:m.runId, id:m.id, reactions:m.reactions||[] }); });
    chatThreads[aid]=th; saveChat();
    if(currentAgent && currentAgent.id===aid) renderChat();
    // Resume any unfinished runs with honest live status.
    (r.pending||[]).forEach(function(p){
      th.push({role:'them', status: p.errorHuman || 'в очереди', pending:true, runId:p.runId});
      var idx=th.length-1;
      if(p.status==='failed'||p.status==='canceled'){ th[idx].pending=false; th[idx].failedRunId=p.runId; th[idx].text=p.errorHuman||'(не удалось выполнить задачу)'; }
      else if(!activeRuns[p.runId]){ chatPending[aid]={runId:p.runId, idx:idx}; streamChatTokens(aid,p.runId,idx); pollRun(aid,p.runId,idx); }
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
  if(t.indexOf('↪ ')===0){ var nl=t.indexOf('\\n'); if(nl>0) t=t.slice(nl+1); }
  chatReplyTo={ role: m.role==='me'?'user':'agent', text:t };
  renderReplyChip(); $('chatInput').focus();
}
// Split a stored quote-prefixed display text into its quote + body parts.
function splitQuote(text){
  if(text && text.indexOf('↪ ')===0){ var nl=text.indexOf('\\n');
    if(nl>0) return { quote:text.slice(2,nl), body:text.slice(nl+1) }; }
  return { quote:null, body:text };
}
// Emoji set for the reaction picker (+ quick row reused as defaults).
var EMOJI_QUICK=['👍','❤️','😂','🔥','🎉','👏','🤔','✅'];
var EMOJI_ALL=['👍','👎','❤️','🔥','🎉','👏','😂','😮','😢','🙏','🤔','💡','✅','❌','⭐','🚀','💪','👀','😎','🤝','💯','⚡','📌','🥳'];
var emojiPop=null;
function closeEmojiPop(){ if(emojiPop){ emojiPop.remove(); emojiPop=null; document.removeEventListener('click', onDocClickPop, true); } }
function onDocClickPop(e){ if(emojiPop && !emojiPop.contains(e.target)) closeEmojiPop(); }
function openEmojiPop(anchor, msg){
  closeEmojiPop();
  emojiPop=document.createElement('div'); emojiPop.className='emojipop';
  var row=document.createElement('div'); row.className='erow';
  EMOJI_ALL.forEach(function(em){ var b=document.createElement('button'); b.textContent=em;
    b.addEventListener('click', function(ev){ ev.stopPropagation(); closeEmojiPop(); toggleReaction(msg, em); }); row.appendChild(b); });
  emojiPop.appendChild(row); document.body.appendChild(emojiPop);
  var r=anchor.getBoundingClientRect();
  var top=r.bottom+4, left=Math.max(8, Math.min(window.innerWidth-244, r.left-100));
  if(top+150>window.innerHeight) top=r.top-152;
  emojiPop.style.top=top+'px'; emojiPop.style.left=left+'px';
  setTimeout(function(){ document.addEventListener('click', onDocClickPop, true); },0);
}
function toggleReaction(msg, emoji){
  if(!msg || !msg.id || !currentAgent) return;
  var aid=currentAgent.id;
  // optimistic
  var set={}; (msg.reactions||[]).forEach(function(e){ set[e]=1; });
  if(set[emoji]) delete set[emoji]; else set[emoji]=1;
  msg.reactions=Object.keys(set); saveChat(); renderChat();
  api('/orgs/'+ORG+'/agents/'+aid+'/messages/'+msg.id+'/react',{method:'POST',body:JSON.stringify({emoji:emoji})})
    .then(function(r){ if(r && r.id){ msg.reactions=r.reactions||[]; saveChat(); if(currentAgent&&currentAgent.id===aid) renderChat(); } })
    .catch(function(){});
}
// Copy a message's body text (без строки-цитаты) в буфер обмена.
function fallbackCopy(t){ try{ var ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }catch(e){} }
function copyMsgText(m, btn){
  var t=(splitQuote(m.text).body)||m.text||'';
  var done=function(){ var o=btn.textContent; btn.textContent='✓ скопировано'; setTimeout(function(){ btn.textContent=o; },1200); };
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(done).catch(function(){ fallbackCopy(t); done(); }); }
  else { fallbackCopy(t); done(); }
}
// Download arbitrary text as a file (deliverable → документ). Client-side Blob,
// no backend needed; works for the team «Результат» and any chat message.
function slugFile(s, ext){ var base=String(s||'document').replace(/\\s+/g,'_').replace(/[\\/:*?"<>|]+/g,'').slice(0,40)||'document'; return base+'.'+(ext||'md'); }
function downloadText(filename, text){
  try{
    var blob=new Blob([String(text==null?'':text)], {type:'text/markdown;charset=utf-8'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 120);
  }catch(e){}
}
function renderChat(){
  if(!currentAgent) return; var log=$('chatLog');
  // Stick-to-bottom: only auto-scroll if the user is already near the bottom, so
  // re-renders during streaming don't yank the view away while reading history.
  var stick=(log.scrollHeight-log.scrollTop-log.clientHeight)<70;
  log.innerHTML=''; var th=chatThreads[currentAgent.id]||[];
  th.forEach(function(m,i){ var el=document.createElement('div'); el.className='msg '+(m.role==='me'?'me':'them');
    var who=(m.role==='me'?'':'<div class="who">'+escapeHtml(shortName(currentAgent.name))+'</div>');
    // A reply that's still queued/thinking and hasn't streamed any real token yet
    // renders a SEPARATE typing indicator from m.status — never as message text, so
    // a status tick ("думает…") can't get glued onto the streamed answer.
    if(m.role==='them' && m.pending && !m.streamed){
      el.className='msg them pending';
      el.innerHTML=who+'<div class="typing">'+escapeHtml(m.status||'думает')+'<span class="tdots">…</span></div>';
      log.appendChild(el); return;
    }
    var parts=splitQuote(m.text);
    var inner=who;
    if(parts.quote) inner+='<div class="quote">'+escapeHtml(parts.quote)+'</div>';
    inner+=mdLite(parts.body);
    el.innerHTML=inner;
    if(!m.pending){ var rb=document.createElement('button'); rb.className='rbtn reply'; rb.textContent='↩ ответить';
      rb.addEventListener('click', (function(msg){ return function(){ setReplyTarget(msg); }; })(m)); el.appendChild(rb);
      var cpb=document.createElement('button'); cpb.className='rbtn copy'; cpb.textContent='⧉ копировать';
      cpb.addEventListener('click', (function(msg,btn){ return function(){ copyMsgText(msg,btn); }; })(m,cpb)); el.appendChild(cpb);
      if(m.role!=='me'){ var dlb=document.createElement('button'); dlb.className='rbtn copy'; dlb.textContent='⬇ скачать';
        dlb.addEventListener('click', (function(msg){ return function(){ downloadText(slugFile(currentAgent?shortName(currentAgent.name):'ответ'), (splitQuote(msg.text).body)||msg.text||''); }; })(m)); el.appendChild(dlb); } }
    // reaction button (only for persisted messages with a server id)
    if(!m.pending && m.id){ var eb=document.createElement('button'); eb.className='rbtn react'; eb.textContent='☺ реакция';
      eb.addEventListener('click', (function(msg,btn){ return function(ev){ ev.stopPropagation(); openEmojiPop(btn,msg); }; })(m,eb)); el.appendChild(eb); }
    // existing reactions
    if(m.reactions && m.reactions.length){ var rr=document.createElement('div'); rr.className='reacts';
      m.reactions.forEach(function(em){ var chip=document.createElement('span'); chip.className='rx'; chip.textContent=em; chip.title='убрать реакцию';
        chip.addEventListener('click', (function(msg,e2){ return function(){ toggleReaction(msg,e2); }; })(m,em)); rr.appendChild(chip); }); el.appendChild(rr); }
    if(m.failedRunId){ var b=document.createElement('button'); b.textContent='Повторить'; b.className='primary'; b.style.cssText='margin-top:6px;padding:4px 10px;font-size:12px';
      b.addEventListener('click', (function(aid,idx,rid){ return function(){ retryChat(aid,idx,rid); }; })(currentAgent.id,i,m.failedRunId)); el.appendChild(b); }
    log.appendChild(el); });
  if(stick) log.scrollTop=log.scrollHeight;
}
// Live status of a pending reply (queued/thinking). Lives in m.status, NOT m.text,
// and never overwrites a bubble that has already started streaming real tokens.
function setBubbleStatus(aid,idx,status){
  var m=chatThreads[aid]&&chatThreads[aid][idx]; if(!m) return;
  if(m.streamed) return; // streaming owns the bubble now — don't clobber the answer
  m.pending=true; m.status=status;
  if(currentAgent&&currentAgent.id===aid) renderChat();
}
function retryChat(aid,idx,runId){
  if(!(chatThreads[aid]&&chatThreads[aid][idx])) return;
  chatThreads[aid][idx]={role:'them', status:'в очереди', pending:true, runId:runId};
  chatPending[aid]={runId:runId, idx:idx}; saveChat();
  if(currentAgent&&currentAgent.id===aid) renderChat();
  delete activeRuns[runId]; // allow a fresh poll for the re-run
  api('/runs/'+runId+'/retry',{method:'POST',body:'{}'}).then(function(){ streamChatTokens(aid,runId,idx); pollRun(aid,runId,idx); })
    .catch(function(){ setReplyFailed(aid,idx,runId,'Сеть: не удалось повторить'); });
}
function pushMsg(agentId,role,text){ if(!chatThreads[agentId]) chatThreads[agentId]=[]; chatThreads[agentId].push({role:role,text:text}); saveChat(); if(currentAgent&&currentAgent.id===agentId) renderChat(); }
var chatTyping={};
function setReply(aid,idx,text){
  if(!(chatThreads[aid]&&chatThreads[aid][idx])) return;
  if(chatPending[aid]&&chatPending[aid].idx===idx) delete chatPending[aid];
  var full=String(text); var key=aid+'#'+idx;
  stopChatStream(aid,idx);
  if(chatTyping[key]) clearInterval(chatTyping[key]);
  // If real tokens already streamed into this bubble, the typewriter would be a
  // jarring restart — just snap to the authoritative final text.
  var wasStreamed = chatThreads[aid][idx] && chatThreads[aid][idx].streamed;
  if(wasStreamed){ chatThreads[aid][idx]={role:'them',text:full}; if(currentAgent&&currentAgent.id===aid) renderChat(); saveChat(); return; }
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
// Live token streaming for a chat reply (best-effort UX). Opens an SSE channel
// for the run and appends run.token deltas into the pending bubble; pollRun
// remains the authoritative source for the final text and for failures, so if
// streaming is unavailable nothing is lost.
var chatStreams={};
function stopChatStream(aid,idx){ var k=aid+'#'+idx; if(chatStreams[k]){ try{chatStreams[k].close();}catch(e){} delete chatStreams[k]; } }
function streamChatTokens(aid,runId,idx){
  if(typeof EventSource==='undefined') return;
  stopChatStream(aid,idx);
  var k=aid+'#'+idx; var src;
  try{ src=new EventSource('/runs/'+runId+'/events'); }catch(e){ return; }
  chatStreams[k]=src;
  src.addEventListener('run.token', function(ev){
    var d; try{ d=JSON.parse(ev.data).data; }catch(e){ return; }
    if(!d||typeof d.text!=='string') return;
    var m=chatThreads[aid]&&chatThreads[aid][idx]; if(!m) return;
    if(!m.streamed){ m.streamed=true; m.text=''; m.pending=false; }
    m.text=(m.text||'')+d.text;
    if(currentAgent&&currentAgent.id===aid) renderChat();
  });
  var done=function(){ stopChatStream(aid,idx); };
  ['run.succeeded','run.failed','run.needs_human','run.dead_lettered'].forEach(function(t){ src.addEventListener(t,done); });
  src.onerror=function(){ /* keep buffered poll as the safety net */ };
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
// One authoritative poll per run. activeRuns dedupes so a second poll (e.g. from
// loadChatHistory resuming the same pending run) can't stack and ping-pong.
var activeRuns={};
function pollRun(aid, runId, idx, tries){
  tries = tries||0;
  if(tries===0){ if(activeRuns[runId]) return; activeRuns[runId]=true; }
  api('/runs/'+runId).then(function(r){
    var run = r && r.run; var st = run && run.status;
    if(st==='succeeded'){ delete activeRuns[runId]; setReply(aid,idx, replyText(run.output)); return; }
    if(st==='failed'||st==='canceled'){ delete activeRuns[runId]; setReplyFailed(aid,idx,runId, (r&&r.errorHuman)||'Не удалось выполнить задачу.'); return; }
    if(st==='paused'){ setBubbleStatus(aid,idx, (r&&r.errorHuman)||'нужно ваше решение'); }
    else { setBubbleStatus(aid,idx, tries<2?'в очереди':('думает'+(tries>30?' ('+Math.floor(tries*3/60)+' мин)':''))); }
    var delay=Math.min(10000, 2000 + tries*250);
    setTimeout(function(){ pollRun(aid,runId,idx,tries+1); }, delay);
  }).catch(function(){ setTimeout(function(){ pollRun(aid,runId,idx,tries+1); }, Math.min(10000, 2500 + tries*250)); });
}
// --- file attachments (Doc-1): extract text server-side, inline into the prompt.
// Supports MANY files and whole FOLDERS (drag-drop traverses directories).
var chatAttachments=[]; // [{filename, text}]
function fmtCount(n){ var t=(n%10===1&&n%100!==11)?'файл':(((n%10>=2&&n%10<=4)&&(n%100<10||n%100>=20))?'файла':'файлов'); return n+' '+t; }
function renderAttach(state, msg){
  var el=$('chatAttach'); var has=chatAttachments.length;
  if(!state && !has){ el.style.display='none'; el.innerHTML=''; return; }
  el.style.display='block'; var html='';
  if(state==='busy'){ html+='<div style="color:#8b949e">⏳ '+escapeHtml(msg||'')+'</div>'; }
  else if(state==='err'){ html+='<div style="color:#f85149">⚠️ '+escapeHtml(msg||'')+'</div>'; }
  else if(state==='ok' && msg){ html+='<div style="color:#2ea043">✓ '+escapeHtml(msg)+'</div>'; }
  if(has){
    var chips=chatAttachments.map(function(a,i){ return '<span class="attchip">📄 '+escapeHtml(a.filename)+' <a href="#" data-ai="'+i+'" title="убрать">✕</a></span>'; }).join(' ');
    html+='<div style="margin-top:3px">📎 <b>'+fmtCount(has)+'</b> приложено: '+chips+' <a href="#" id="attClear" style="color:#8b949e">убрать всё</a></div>';
  }
  el.innerHTML=html;
  var clr=document.getElementById('attClear'); if(clr) clr.addEventListener('click', function(ev){ ev.preventDefault(); chatAttachments=[]; renderAttach(null); });
  var rms=el.querySelectorAll('a[data-ai]'); for(var k=0;k<rms.length;k++){ rms[k].addEventListener('click', (function(node){ return function(ev){ ev.preventDefault(); chatAttachments.splice(parseInt(node.getAttribute('data-ai'),10),1); renderAttach(null); }; })(rms[k])); }
}
$('chatClip').addEventListener('click', function(){ $('chatFile').click(); });
// Extract text from MANY files (sequentially) and add them all as attachments.
function addAttachments(files){
  if(!currentAgent){ renderAttach('err','Сначала выберите сотрудника слева.'); return; }
  var list=Array.prototype.slice.call(files||[]).filter(function(f){ return f && f.size>0 && f.size<=20*1024*1024; });
  if(!list.length){ renderAttach('err','Нет подходящих файлов (пусто или все больше 20МБ).'); return; }
  if(list.length>300) list=list.slice(0,300);
  var i=0, ok=0, fail=0, chars=0;
  function next(){
    if(i>=list.length){ renderAttach(fail?'err':'ok', 'добавлено '+fmtCount(ok)+(fail?(', пропущено '+fail):'')); return; }
    var f=list[i++]; renderAttach('busy','Читаю '+(f.relpath||f.name)+' ('+i+'/'+list.length+')…');
    var rd=new FileReader();
    rd.onerror=function(){ fail++; next(); };
    rd.onload=function(){ var b64=String(rd.result).split(',')[1]||'';
      api('/documents/extract',{method:'POST',body:JSON.stringify({mime:f.type,filename:f.name,content:b64,base64:true})})
        .then(function(r){ if(r&&typeof r.text==='string'&&(chars+r.text.length<=800000)){ chatAttachments.push({filename:(f.relpath||f.name),text:r.text}); chars+=r.text.length; ok++; } else { fail++; } next(); })
        .catch(function(){ fail++; next(); });
    };
    rd.readAsDataURL(f);
  }
  next();
}
// Recursively collect File objects from a dropped FileSystemEntry (folders too).
function entryFiles(entry, path){
  return new Promise(function(resolve){
    if(!entry){ resolve([]); return; }
    if(entry.isFile){ entry.file(function(f){ try{ f.relpath=path+entry.name; }catch(e){} resolve([f]); }, function(){ resolve([]); }); return; }
    if(entry.isDirectory){ var reader=entry.createReader(); var acc=[];
      var read=function(){ reader.readEntries(function(ents){
        if(!ents.length){ Promise.all(acc).then(function(a){ resolve([].concat.apply([],a)); }); return; }
        for(var j=0;j<ents.length;j++) acc.push(entryFiles(ents[j], path+entry.name+'/'));
        read();
      }, function(){ resolve([]); }); };
      read(); return; }
    resolve([]);
  });
}
// Gather all files from a drop (synchronously grabbing entries, then async-reading).
function gatherDropped(dt){
  var its=dt.items;
  if(its && its.length && its[0] && its[0].webkitGetAsEntry){
    var ps=[]; for(var i=0;i<its.length;i++){ var en=its[i].webkitGetAsEntry?its[i].webkitGetAsEntry():null; ps.push(entryFiles(en,'')); }
    return Promise.all(ps).then(function(a){ return [].concat.apply([],a); });
  }
  return Promise.resolve(Array.prototype.slice.call(dt.files||[]));
}
$('chatFile').addEventListener('change', function(){
  var arr=Array.prototype.slice.call($('chatFile').files||[]); $('chatFile').value=''; if(arr.length) addAttachments(arr);
});
// Drag-and-drop: бросьте файлы И ПАПКИ в панель чата — приложу всё содержимое.
(function(){
  var pane=document.querySelector('.chat'); if(!pane) return;
  var depth=0;
  function show(on){ if(on) pane.classList.add('dragover'); else pane.classList.remove('dragover'); }
  function hasFiles(e){ var dt=e.dataTransfer; return dt && dt.types && Array.prototype.indexOf.call(dt.types,'Files')>=0; }
  pane.addEventListener('dragenter', function(e){ if(!currentAgent||!hasFiles(e)) return; e.preventDefault(); depth++; show(true); });
  pane.addEventListener('dragover', function(e){ if(!currentAgent||!hasFiles(e)) return; e.preventDefault(); try{ e.dataTransfer.dropEffect='copy'; }catch(_){} });
  pane.addEventListener('dragleave', function(e){ if(!hasFiles(e)) return; e.preventDefault(); depth=Math.max(0,depth-1); if(depth===0) show(false); });
  pane.addEventListener('drop', function(e){ e.preventDefault(); e.stopPropagation(); depth=0; show(false);
    if(!currentAgent) return; gatherDropped(e.dataTransfer).then(function(files){ if(files&&files.length) addAttachments(files); }); });
})();
// Chat input: Enter sends, Shift+Enter inserts a newline; the textarea auto-grows.
function chatAutoGrow(){ var ta=$('chatInput'); if(!ta) return; ta.style.height='auto'; ta.style.height=Math.min(140, ta.scrollHeight)+'px'; }
$('chatInput').addEventListener('input', chatAutoGrow);
$('chatInput').addEventListener('keydown', function(e){
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault();
    if(typeof $('chatForm').requestSubmit==='function') $('chatForm').requestSubmit();
    else $('chatForm').dispatchEvent(new Event('submit',{cancelable:true})); }
});
// Voice input (Web Speech API): надиктовать задачу в поле. Если браузер не
// поддерживает распознавание — кнопка прячется (грациозная деградация).
var chatRec=null, chatRecOn=false;
(function(){
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  var mic=$('chatMic'); if(!mic) return;
  if(!SR){ mic.style.display='none'; return; }
  mic.addEventListener('click', function(){
    if(chatRecOn){ try{ chatRec.stop(); }catch(e){} return; }
    chatRec=new SR(); chatRec.lang='ru-RU'; chatRec.interimResults=true; chatRec.continuous=false;
    var base=$('chatInput').value;
    chatRec.onstart=function(){ chatRecOn=true; mic.classList.add('rec'); mic.textContent='⏺'; };
    chatRec.onresult=function(e){ var txt=''; for(var i=0;i<e.results.length;i++){ txt+=e.results[i][0].transcript; }
      $('chatInput').value=(base?base.replace(/\\s+$/,'')+' ':'')+txt; chatAutoGrow(); };
    chatRec.onerror=function(){ };
    chatRec.onend=function(){ chatRecOn=false; mic.classList.remove('rec'); mic.textContent='🎤'; $('chatInput').focus(); };
    try{ chatRec.start(); }catch(e){ chatRecOn=false; }
  });
})();
$('chatForm').addEventListener('submit', async function(e){
  e.preventDefault(); if(!currentAgent) return; var text=$('chatInput').value.trim();
  if(!text && !chatAttachments.length) return;
  if(!text) text='Изучи приложенные файлы и дай краткие выводы.';
  var aid=currentAgent.id;
  var shown=text; var attachForServer=null; var replyForServer=null;
  if(chatAttachments.length){
    attachForServer=chatAttachments.slice();
    shown=text+' 📎 '+(attachForServer.length===1?attachForServer[0].filename:fmtCount(attachForServer.length));
    chatAttachments=[]; renderAttach(null);
  }
  if(chatReplyTo){
    replyForServer={ role:chatReplyTo.role, text:chatReplyTo.text };
    shown='↪ '+chatReplyTo.text.replace(/\\s+/g,' ').slice(0,120)+'\\n'+shown;
    chatReplyTo=null; renderReplyChip();
  }
  pushMsg(aid,'me',shown); $('chatInput').value=''; chatAutoGrow();
  if(!chatThreads[aid]) chatThreads[aid]=[];
  chatThreads[aid].push({role:'them', status:'в очереди', pending:true}); var idx=chatThreads[aid].length-1; saveChat(); renderChat();
  // Server-side chat: persists the message + assembles dialog context.
  var body={ text:text, autoRun:autoMode() };
  if(attachForServer) body.attachments=attachForServer;
  if(replyForServer) body.replyTo=replyForServer;
  var resp = await api('/orgs/'+ORG+'/agents/'+aid+'/chat',{method:'POST',body:JSON.stringify(body)});
  if(resp && resp.delegated){
    setReply(aid, idx, resp.reply || ('Поручение передано'+(resp.to?(' '+resp.to):'')));
    if(resp.message && resp.message.id && chatThreads[aid][idx-1]){ chatThreads[aid][idx-1].id=resp.message.id; saveChat(); }
    loadAssignments(aid); return;
  }
  if(!resp||!resp.runId){ setReplyFailed(aid,idx,null,'Ошибка: '+((resp&&resp.error)||'не удалось запустить')); return; }
  // give the just-sent user message its server id so it can be reacted to
  if(resp.message && resp.message.id && chatThreads[aid][idx-1]){ chatThreads[aid][idx-1].id=resp.message.id; saveChat(); }
  chatThreads[aid][idx].runId=resp.runId; chatPending[aid]={runId:resp.runId, idx:idx}; saveChat();
  streamChatTokens(aid, resp.runId, idx);
  pollRun(aid, resp.runId, idx);
});

// --- Living pixel office --------------------------------------------------
var PX=3;
var SPR=["..HHHH..",".HHHHHH.",".HSSSSH.",".SSSSSS.",".SeSSeS.",".SSSSSS.",".CCCCCC.","CCCCCCCC","CCCCCCCC","CC.CC.CC",".PP..PP."];
var TYPE_COLOR={orchestrator:'#d29922',analyst:'#2ea043',researcher:'#2f81f7',writer:'#a371f7',coder:'#f0883e',reviewer:'#db61a2'};
var DEPT={orchestrator:'Управление',analyst:'Аналитика',researcher:'Исследования',writer:'Контент',coder:'Инженерия',reviewer:'QA'};
// Per-role glyphs — used as feed icons and on office event-cards (P2 visual).
var ROLE_ICON={orchestrator:'🧭',analyst:'📊',researcher:'🔎',writer:'✍️',coder:'💻',reviewer:'✅'};
function roleIcon(t){ return ROLE_ICON[t]||'👤'; }
// Status → glyph for the activity timeline / office event-cards.
var STATUS_ICON={queued:'🕓',running:'⚙️',succeeded:'✅',failed:'⚠️',planned:'🧩',review:'🔍',revision:'♻️'};
function statusIcon(s){ return STATUS_ICON[s]||'•'; }
var SAY_WORK={researcher:['Ищу источники…','Собираю данные…'],analyst:['Анализирую…','Считаю варианты…'],writer:['Пишу черновик…','Редактирую текст…'],coder:['Пишу код…','Гоняю тесты…'],reviewer:['Проверяю…','Ищу баги…'],orchestrator:['Распределяю задачи','Собираю команду'],_def:['Работаю…']};
var SMALLTALK=['Кофе? ☕','Как дела?','Глянь мою задачу','Почти готово','Нужна помощь?','Класс! 👍','Я на созвоне','Передаю дальше','Согласен','Сделаю'];
var officeAgents=[]; var officeState={}; var officePos={}; var officeHome={}; var officeTgt={}; var officeDwell={}; var officeBubble={}; var officeMeetUntil={};
var officeFrame=0; var officeRAF=null; var offW=760, offH=440; var officeSim=null;
// Office event-cards (P2 visual): a live stack in the top-right HUD showing the
// last few things that happened — icon + who + what — fading out over time.
var officeCards=[];
var officeVig=null; // cached screen-space vignette gradient (recomputed only on resize)
var officeGrade=null; // cached cinematic grade (depth haze) gradient
var floorTint={}; // cached per-tile department tint (keyed gx*100+gy), built in layoutOffice
function pushOfficeCard(icon,title,sub,color){
  officeCards.push({icon:icon, title:String(title||''), sub:String(sub||''), color:color||'#8b949e', born:officeFrame, until:officeFrame+420});
  if(officeCards.length>4) officeCards.shift();
}
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
    acc:TYPE_ACC[a.type]||null, seed:(h%150),
    phones:(a.type==='coder'),
    glasses:(a.type==='analyst'||a.type==='reviewer'||((h>>12)%3===0)) }; }
// --- Sprite 2.0: big-head pixel characters from char-grids (own art) -------
// Grid 16w x 23h, cell CH_CELL px => ~54x78px on screen. Palette keys:
// H hair, S skin, e eye, J jacket, j jacket shade, T shirt, t tie, P pants, B shoes.
var CH_CELL=3.8, CH_W=16, CH_H=23;
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
  var hx=fx, hy=fy; // anchored directly at the hand position passed in
  if(acc==='case'){ // brown briefcase: body, lighter lid, top handle, two brass clasps
    ctx.fillStyle='#6f4827'; roundRect(ctx,hx-7,hy-1,15,12,1.6); ctx.fill();
    ctx.fillStyle='#835833'; roundRect(ctx,hx-7,hy-1,15,3.6,1.4); ctx.fill();
    ctx.fillStyle='#4d3019'; ctx.fillRect(hx-7,hy+2.4,15,1.2);
    ctx.strokeStyle='#3f2916'; ctx.lineWidth=1.3; ctx.beginPath(); ctx.arc(hx+0.5,hy-2.4,3,Math.PI,0); ctx.stroke();
    ctx.fillStyle='#d9b066'; ctx.fillRect(hx-3.2,hy+1.2,1.8,2.2); ctx.fillRect(hx+1.6,hy+1.2,1.8,2.2); }
  else if(acc==='laptop'){ ctx.fillStyle='#aab4bd'; ctx.fillRect(hx-2,hy,14,9); ctx.fillStyle='#2a3743'; ctx.fillRect(hx-1,hy+1,12,7); }
  else if(acc==='mag'){ ctx.strokeStyle='#cfd6dc'; ctx.lineWidth=2.4; ctx.beginPath(); ctx.arc(hx+4,hy+1,5,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx+8,hy+5); ctx.lineTo(hx+12,hy+9); ctx.stroke(); ctx.fillStyle='rgba(160,210,255,.35)'; ctx.beginPath(); ctx.arc(hx+4,hy+1,4,0,Math.PI*2); ctx.fill(); }
  else if(acc==='tablet'){ ctx.fillStyle='#0e1318'; ctx.fillRect(hx-1,hy-2,12,15); ctx.fillStyle='#16323f'; ctx.fillRect(hx,hy-1,10,13);
    ctx.fillStyle='#2ea043'; ctx.fillRect(hx+1,hy+8,2,3); ctx.fillRect(hx+4,hy+5,2,6); ctx.fillRect(hx+7,hy+7,2,4); }
  else if(acc==='note'){ // clipboard: white sheet, metal clip at top, ruled lines
    ctx.fillStyle='#cdd3da'; roundRect(ctx,hx-1,hy-3,12,15,1.4); ctx.fill();
    ctx.fillStyle='#f3f6f9'; roundRect(ctx,hx,hy-2,10,13,1); ctx.fill();
    ctx.fillStyle='#8a949d'; ctx.fillRect(hx+3,hy-4,4,2.2); // clip
    ctx.fillStyle='#9aa4ad'; for(var i=0;i<4;i++) ctx.fillRect(hx+2,hy+1+i*2.6,6.5,1); }
  else if(acc==='check'){ ctx.fillStyle='#d9dee3'; ctx.fillRect(hx,hy-2,11,14); ctx.fillStyle='#8a949d'; ctx.fillRect(hx+3,hy-4,5,3);
    ctx.strokeStyle='#2ea043'; ctx.lineWidth=1.6; for(var k2=0;k2<3;k2++){ ctx.beginPath(); ctx.moveTo(hx+2,hy+2+k2*4); ctx.lineTo(hx+4,hy+4+k2*4); ctx.lineTo(hx+8,hy+k2*4); ctx.stroke(); } }
}
// dark palette for the silhouette pass (every sprite key → near-black)
var DARK_PAL={H:'#0c0f13',S:'#0c0f13',e:'#0c0f13',J:'#0c0f13',j:'#0c0f13',T:'#0c0f13',t:'#0c0f13',P:'#0c0f13',B:'#0c0f13'};
// warm rim-light palette (every key → warm light) for the directional edge pass
var LIGHT_PAL={H:'#fff1d6',S:'#fff1d6',e:'#fff1d6',J:'#fff1d6',j:'#fff1d6',T:'#fff1d6',t:'#fff1d6',P:'#fff1d6',B:'#fff1d6'};
// --- Flat front-facing character (matches the "Coordinator" reference) -------
// One flat plane for the face (no iso edge → no "triangular" head). Sharp navy
// business suit, peaked lapels, white shirt, RED tie. Role colour survives as a
// breast-pocket square so departments stay readable.
function drawCharacter(ctx,fx,fy,look,walk,working){
  fx=Math.round(fx); fy=Math.round(fy);
  // smooth vertical motion (idle breath / walk bounce / work lean) — no integer hops
  var ty=-(0.5+0.5*Math.sin(officeFrame/30+look.seed*0.7))*0.8, legPhase=0;
  if(walk){ ty-=Math.abs(Math.sin(officeFrame/10+fx*0.12))*1.2; legPhase=Math.sin(officeFrame/8+fx*0.1); }
  else if(working){ ty-=(0.5+0.5*Math.sin(officeFrame/14+look.seed))*0.9; }
  var by=fy+ty;
  var skin=look.skin, suit=look.suit, pants=look.pants, hair=look.hair, role=look.shirt;
  var skinD=shade(skin,-30), suitD=shade(suit,-24), suitL=shade(suit,22), hairD=shade(hair,-26), hairL=shade(hair,32);
  var tieCol='#b22a30', tieD='#7e1d22'; // crisp business red, as on the reference

  // grounding shadow (two ellipses, no shadowBlur)
  ctx.save(); ctx.fillStyle='#000';
  ctx.globalAlpha=0.16; ctx.beginPath(); ctx.ellipse(fx,fy+1,15,5,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=0.30; ctx.beginPath(); ctx.ellipse(fx,fy,9,3,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // ---- legs + shoes (alternate lift while walking) ----
  var llift=walk?Math.max(0,legPhase)*2.2:0, rlift=walk?Math.max(0,-legPhase)*2.2:0;
  function leg(cx,lift){
    ctx.fillStyle=pants; roundRect(ctx, cx-3.3, by-15-lift, 6.6, 13, 1.6); ctx.fill();
    ctx.fillStyle=shade(pants,-16); ctx.fillRect(cx+0.7, by-15-lift, 2.3, 12.5); // inner crease shade
    ctx.fillStyle='#15181d'; roundRect(ctx, cx-4.2, by-3.6-lift, 9, 4.6, 2); ctx.fill(); // shoe
    ctx.fillStyle='#2c323b'; ctx.fillRect(cx-3.8, by-3.4-lift, 7.8, 1.1); // shoe shine
  }
  leg(fx-4.4, llift); leg(fx+4.4, rlift);

  // ---- geometry anchors ----
  var shoulderY=by-39, waistY=by-15, shoulderHW=13.5, waistHW=9.4;
  var headCY=by-52, headRX=10.5, headRY=11.8;
  var armSwing=walk?legPhase*1.3:0;

  // ---- back (left) arm → before torso for depth ----
  function arm(side,swing){
    var ax=fx+side*(shoulderHW-1.8);
    ctx.fillStyle=side<0?suitD:suit; roundRect(ctx, ax-2.7, shoulderY+1, 5.4, 19+swing*side, 2.5); ctx.fill();
    ctx.fillStyle=side<0?shade(suit,-34):suitD; ctx.fillRect(ax-2.7, shoulderY+1, 1.6, 18); // sleeve inner fold
    ctx.fillStyle=skin; ctx.beginPath(); ctx.arc(ax, shoulderY+21.5+swing*side, 2.8, 0, Math.PI*2); ctx.fill(); // hand
    return {x:ax, y:shoulderY+21.5+swing*side};
  }
  var lh=arm(-1, armSwing);

  // ---- torso: suit jacket (tapered, rounded shoulders) ----
  ctx.fillStyle=suit;
  ctx.beginPath();
  ctx.moveTo(fx-shoulderHW, shoulderY+5);
  ctx.quadraticCurveTo(fx-shoulderHW, shoulderY-1.5, fx-shoulderHW+5, shoulderY-2);
  ctx.lineTo(fx+shoulderHW-5, shoulderY-2);
  ctx.quadraticCurveTo(fx+shoulderHW, shoulderY-1.5, fx+shoulderHW, shoulderY+5);
  ctx.lineTo(fx+waistHW, waistY); ctx.lineTo(fx-waistHW, waistY);
  ctx.closePath(); ctx.fill();
  // right-side body shadow + left-shoulder highlight for volume
  ctx.fillStyle=suitD; ctx.beginPath();
  ctx.moveTo(fx+2.5, shoulderY-1.5); ctx.lineTo(fx+shoulderHW, shoulderY+5);
  ctx.lineTo(fx+waistHW, waistY); ctx.lineTo(fx+1.6, waistY); ctx.closePath(); ctx.fill();
  ctx.fillStyle=suitL; roundRect(ctx, fx-shoulderHW+3, shoulderY-2, 6, 2.4, 1.2); ctx.fill();

  // ---- white shirt wedge ----
  ctx.fillStyle='#eef2f6';
  ctx.beginPath(); ctx.moveTo(fx-5.6, shoulderY-1); ctx.lineTo(fx+5.6, shoulderY-1);
  ctx.lineTo(fx, waistY-1); ctx.closePath(); ctx.fill();
  // shirt collar (two small flaps tucked under the chin)
  ctx.fillStyle='#dde3ea';
  ctx.beginPath(); ctx.moveTo(fx-4.2, shoulderY-1.5); ctx.lineTo(fx-0.6, shoulderY-0.5); ctx.lineTo(fx-1.4, shoulderY+2.4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(fx+4.2, shoulderY-1.5); ctx.lineTo(fx+0.6, shoulderY-0.5); ctx.lineTo(fx+1.4, shoulderY+2.4); ctx.closePath(); ctx.fill();
  // ---- red tie (knot + blade + dimple) ----
  ctx.fillStyle=tieCol;
  ctx.beginPath(); ctx.moveTo(fx-2.1, shoulderY+0.6); ctx.lineTo(fx+2.1, shoulderY+0.6);
  ctx.lineTo(fx+1.4, shoulderY+3.4); ctx.lineTo(fx-1.4, shoulderY+3.4); ctx.closePath(); ctx.fill(); // knot
  ctx.beginPath(); ctx.moveTo(fx-1.4, shoulderY+3.6); ctx.lineTo(fx+1.4, shoulderY+3.6);
  ctx.lineTo(fx+3, waistY-1.5); ctx.lineTo(fx, waistY+0.5); ctx.lineTo(fx-3, waistY-1.5); ctx.closePath(); ctx.fill(); // blade
  ctx.fillStyle=tieD; ctx.fillRect(fx+0.3, shoulderY+4, 2.4, waistY-shoulderY-6); // right-half shade
  ctx.fillRect(fx-1.1, shoulderY+1.4, 2.2, 1); // knot dimple shadow

  // ---- peaked lapels (over the shirt edges) ----
  ctx.fillStyle=suitL;
  ctx.beginPath(); ctx.moveTo(fx-shoulderHW+4, shoulderY-2); ctx.lineTo(fx-1.6, shoulderY+0.5);
  ctx.lineTo(fx-3, shoulderY+4.5); ctx.lineTo(fx-7.2, shoulderY+1.5); ctx.lineTo(fx-6.4, shoulderY+10); ctx.lineTo(fx-2, shoulderY+11.5);
  ctx.lineTo(fx-1, shoulderY+4); ctx.closePath(); ctx.fill();
  ctx.fillStyle=shade(suit,10);
  ctx.beginPath(); ctx.moveTo(fx+shoulderHW-4, shoulderY-2); ctx.lineTo(fx+1.6, shoulderY+0.5);
  ctx.lineTo(fx+3, shoulderY+4.5); ctx.lineTo(fx+7.2, shoulderY+1.5); ctx.lineTo(fx+6.4, shoulderY+10); ctx.lineTo(fx+2, shoulderY+11.5);
  ctx.lineTo(fx+1, shoulderY+4); ctx.closePath(); ctx.fill();
  // center placket + two buttons below the tie
  ctx.strokeStyle=suitD; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(fx, waistY-6); ctx.lineTo(fx, waistY); ctx.stroke();
  ctx.fillStyle=shade(suit,-10); ctx.beginPath(); ctx.arc(fx, waistY-4.5, 0.9, 0, Math.PI*2); ctx.arc(fx, waistY-1.5, 0.9, 0, Math.PI*2); ctx.fill();
  // breast-pocket square = role colour (keeps departments readable)
  ctx.fillStyle=role; ctx.beginPath(); ctx.moveTo(fx-9.5, shoulderY+6.5); ctx.lineTo(fx-6, shoulderY+6.5); ctx.lineTo(fx-7.7, shoulderY+9); ctx.closePath(); ctx.fill();

  // ---- front (right) arm → after torso ----
  var rh=arm(1, armSwing);

  // ---- neck ----
  ctx.fillStyle=skin; ctx.fillRect(fx-3, shoulderY-5, 6, 6.5);
  ctx.fillStyle=skinD; ctx.fillRect(fx-3, shoulderY-1.5, 6, 2); // neck shadow under chin

  // ---- head (rounded, flat front face) ----
  ctx.fillStyle=skin;
  roundRect(ctx, fx-headRX, headCY-headRY, headRX*2, headRY*2, 6.5); ctx.fill();
  ctx.beginPath(); ctx.arc(fx-headRX+0.5, headCY+1.5, 2.3, 0, Math.PI*2); ctx.arc(fx+headRX-0.5, headCY+1.5, 2.3, 0, Math.PI*2); ctx.fill(); // ears
  ctx.fillStyle=skinD; ctx.globalAlpha=0.5; // soft right-cheek shadow
  roundRect(ctx, fx+headRX-5, headCY-headRY+3, 5, headRY*2-6, 4); ctx.fill(); ctx.globalAlpha=1;

  // ---- hair ----
  if(look.hairStyle==='bald'){
    ctx.fillStyle=hairD; // thin side fringe only
    roundRect(ctx, fx-headRX-0.5, headCY-2, 2.5, 7, 1); ctx.fill(); roundRect(ctx, fx+headRX-2, headCY-2, 2.5, 7, 1); ctx.fill();
  } else if(look.hairStyle==='long'){
    ctx.fillStyle=hair; ctx.beginPath();
    ctx.moveTo(fx-headRX-1.5, headCY+headRY-1);
    ctx.lineTo(fx-headRX-1.5, headCY-3); ctx.quadraticCurveTo(fx-headRX-1.5, headCY-headRY-3, fx, headCY-headRY-3);
    ctx.quadraticCurveTo(fx+headRX+1.5, headCY-headRY-3, fx+headRX+1.5, headCY-3); ctx.lineTo(fx+headRX+1.5, headCY+headRY-1);
    ctx.lineTo(fx+headRX-2.5, headCY+headRY-1); ctx.lineTo(fx+headRX-2.5, headCY-2);
    ctx.quadraticCurveTo(fx+4, headCY-4.5, fx, headCY-4); ctx.quadraticCurveTo(fx-4, headCY-3.5, fx-headRX+2.5, headCY-2);
    ctx.lineTo(fx-headRX+2.5, headCY+headRY-1); ctx.closePath(); ctx.fill();
    ctx.fillStyle=hairL; ctx.fillRect(fx-5.5, headCY-headRY+0.5, 4.5, 1.6);
  } else {
    // business pompadour / quiff with a side part (default + curly + short)
    ctx.fillStyle=hair; ctx.beginPath();
    ctx.moveTo(fx-headRX-0.5, headCY+2);
    ctx.quadraticCurveTo(fx-headRX-2.5, headCY-headRY-2, fx-headRX+1, headCY-headRY-4.5); // left side rises
    ctx.quadraticCurveTo(fx-2.5, headCY-headRY-8.5, fx+4.5, headCY-headRY-5);             // quiff crest sweeps right
    ctx.quadraticCurveTo(fx+headRX+1, headCY-headRY-1.5, fx+headRX+0.5, headCY+1.5);      // right side down
    ctx.lineTo(fx+headRX-1, headCY-1.5);
    ctx.quadraticCurveTo(fx+6, headCY-5.5, fx+1.5, headCY-4);                              // right forehead sweep
    ctx.quadraticCurveTo(fx-0.5, headCY-6, fx-2.6, headCY-3.4);                            // part dip
    ctx.quadraticCurveTo(fx-6, headCY-1.6, fx-headRX+1, headCY-0.6);                       // left forehead
    ctx.closePath(); ctx.fill();
    if(look.hairStyle==='curly'){ ctx.fillStyle=hair; for(var ci=-1;ci<=2;ci++){ ctx.beginPath(); ctx.arc(fx-5+ci*5, headCY-headRY-3.5, 4, 0, Math.PI*2); ctx.fill(); } }
    // shine streak along the crest
    ctx.fillStyle=hairL; ctx.beginPath();
    ctx.moveTo(fx-4, headCY-headRY-1.5); ctx.quadraticCurveTo(fx-0.5, headCY-headRY-6, fx+4.5, headCY-headRY-4);
    ctx.lineTo(fx+3.5, headCY-headRY-2); ctx.quadraticCurveTo(fx-0.5, headCY-headRY-3.5, fx-3.5, headCY-headRY+0.5);
    ctx.closePath(); ctx.fill();
    // right-side hair shadow
    ctx.fillStyle=hairD; ctx.beginPath();
    ctx.moveTo(fx+headRX+0.5, headCY+1.5); ctx.quadraticCurveTo(fx+headRX+1, headCY-headRY-1.5, fx+4.5, headCY-headRY-2);
    ctx.lineTo(fx+4, headCY-headRY+1); ctx.quadraticCurveTo(fx+headRX-1.5, headCY-1, fx+headRX-1, headCY+1); ctx.closePath(); ctx.fill();
  }

  // ---- face on the flat front plane ----
  var eyeY=headCY+1.5;
  var blink=((officeFrame+look.seed)%180)<6;
  ctx.fillStyle=hairD; // brows
  roundRect(ctx, fx-6.4, eyeY-3.6, 4.2, 1.4, 0.7); ctx.fill();
  roundRect(ctx, fx+2.2, eyeY-3.6, 4.2, 1.4, 0.7); ctx.fill();
  if(blink){ ctx.fillStyle=skinD; ctx.fillRect(fx-6, eyeY+0.4, 4, 1); ctx.fillRect(fx+2, eyeY+0.4, 4, 1); }
  else {
    ctx.fillStyle='#f4f6f8'; // whites
    roundRect(ctx, fx-6.2, eyeY-1.5, 4.3, 3.4, 1.4); ctx.fill();
    roundRect(ctx, fx+1.9, eyeY-1.5, 4.3, 3.4, 1.4); ctx.fill();
    ctx.fillStyle='#26313f'; // pupils (toward centre = looking ahead)
    ctx.fillRect(fx-4.2, eyeY-1.1, 1.9, 2.7); ctx.fillRect(fx+2.3, eyeY-1.1, 1.9, 2.7);
    ctx.fillStyle='rgba(255,255,255,.9)';
    ctx.fillRect(fx-3.9, eyeY-0.8, 0.8, 0.8); ctx.fillRect(fx+2.6, eyeY-0.8, 0.8, 0.8);
  }
  ctx.fillStyle=skinD; ctx.fillRect(fx-0.4, eyeY+1.4, 1.4, 2.2); // nose
  ctx.strokeStyle=shade(skin,-62); ctx.lineWidth=1.2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(fx-2.4, eyeY+5); ctx.quadraticCurveTo(fx, eyeY+6.4, fx+2.4, eyeY+5); ctx.stroke();
  ctx.lineCap='butt';

  // ---- glasses ----
  if(look.glasses){ ctx.strokeStyle='#11151b'; ctx.lineWidth=1.3;
    roundRect(ctx, fx-6.4, eyeY-1.9, 4.7, 4.4, 1.3); ctx.stroke();
    roundRect(ctx, fx+1.7, eyeY-1.9, 4.7, 4.4, 1.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx-1.7, eyeY-0.2); ctx.lineTo(fx+1.7, eyeY-0.2); ctx.stroke(); }
  // ---- headphones (coder) ----
  if(look.phones){
    ctx.strokeStyle='#1b2027'; ctx.lineWidth=2.6; ctx.beginPath(); ctx.arc(fx, headCY-1, headRX+1.5, Math.PI*1.05, Math.PI*1.95); ctx.stroke();
    ctx.fillStyle='#262c34'; roundRect(ctx, fx-headRX-2.5, headCY-1.5, 5, 9, 2); ctx.fill(); roundRect(ctx, fx+headRX-2.5, headCY-1.5, 5, 9, 2); ctx.fill();
    ctx.fillStyle=role; ctx.fillRect(fx-headRX-1, headCY+0.5, 1.8, 5); ctx.fillRect(fx+headRX-0.8, headCY+0.5, 1.8, 5); }

  // ---- props in hands ----
  // Coordinator holds a briefcase AND a clipboard (one per hand), like the
  // reference; every other role holds its single tool in the front hand.
  if(look.acc==='case'){ drawAccessory(ctx, lh.x, lh.y+2, 'case'); drawAccessory(ctx, rh.x+1, rh.y-1, 'note'); }
  else if(look.acc){ drawAccessory(ctx, rh.x, rh.y+2, look.acc); }
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
  ISO_OX=Math.round(offW/2 - (GRIDW-GRIDH)*ISO_TW2/2); ISO_OY=ISO_OY_BASE;
  var ord=officeAgents.slice().sort(function(a,b){ return (b.type==='orchestrator'?1:0)-(a.type==='orchestrator'?1:0); });
  for(var i=0;i<ord.length;i++){ var a=ord[i]; var t=DESK_TILES[i%DESK_TILES.length];
    officeHome[a.name]={gx:t[0],gy:t[1]};
    if(!officePos[a.name]) officePos[a.name]={gx:t[0],gy:t[1]};
    officeTgt[a.name]={gx:t[0],gy:t[1]}; officeDwell[a.name]=120+Math.floor(Math.random()*200); }
  // Precompute the per-tile department tint once (was a 104×7 nearest-agent search
  // EVERY frame). Recomputed only here, when the roster/home layout changes.
  floorTint={};
  for(var fy2=0; fy2<GRIDH; fy2++){ for(var fx2=0; fx2<GRIDW; fx2++){
    var nr=null,bd=99; for(var ai=0;ai<officeAgents.length;ai++){ var hm=officeHome[officeAgents[ai].name]; if(!hm)continue; var d=Math.abs(hm.gx-fx2)+Math.abs(hm.gy-fy2); if(d<bd){bd=d;nr=officeAgents[ai];} }
    if(nr && bd<=1) floorTint[fx2*100+fy2]=roleColor(nr.type);
  } }
}
function setBubble(name,text,frames){ officeBubble[name]={text:text, until:officeFrame+(frames||200)}; }
// Activity log: shared array renders both the office feed and the
// «Активность» tab (Event Timeline — what happened, when, who initiated).
var actLog=[];
function renderActivity(elId,cap){
  var f=document.getElementById(elId); if(!f) return;
  f.innerHTML='';
  var items=actLog.slice(-cap);
  for(var i=items.length-1;i>=0;i--){
    var row=document.createElement('div'); row.className='act';
    row.innerHTML='<span class="act-t">'+items[i].t+'</span> '+items[i].html;
    f.appendChild(row);
  }
}
function pushActivity(text){
  var t=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  actLog.push({t:t, html:text});
  if(actLog.length>250) actLog.shift();
  renderActivity('activityFeed',40);
  var big=document.getElementById('activityBig');
  if(big && big.offsetParent) renderActivity('activityBig',200);
}
// Wander targets are the meeting room + spots next to amenities (coffee/cooler/
// printer) — so idle agents gather at something, not at a bare floor square.
function socialTile(){ var pts=[{gx:6,gy:7},{gx:4,gy:1},{gx:1,gy:1},{gx:1,gy:3}]; return pick(pts); }
function updateOffice(){
  officeAgents.forEach(function(a){ var nm=a.name; var home=officeHome[nm]; if(!home) return; var st=officeState[nm]||'idle';
    var tgt;
    if(st==='working'||st==='done'||st==='failed'){ tgt=home; }
    else if(officeMeetUntil[nm] && officeFrame<officeMeetUntil[nm]){ tgt=officeTgt[nm]; }
    else { officeDwell[nm]=(officeDwell[nm]||0)-1; if(officeDwell[nm]<=0){ tgt = Math.random()<0.28 ? socialTile() : home; officeTgt[nm]=tgt; officeDwell[nm]=300+Math.floor(Math.random()*360); } tgt=officeTgt[nm]; }
    var p=officePos[nm]; if(!p){ p={gx:home.gx,gy:home.gy}; officePos[nm]=p; }
    p._tgt=tgt;
    // steady walking pace toward the target (constant speed, snap when close) —
    // reads as a real walk, not floaty easing that slows to a crawl near the goal.
    var dx=tgt.gx-p.gx, dy=tgt.gy-p.gy, dl=Math.sqrt(dx*dx+dy*dy), spd=0.034;
    if(dl>0.0001){ if(dl<=spd){ p.gx=tgt.gx; p.gy=tgt.gy; } else { p.gx+=dx/dl*spd; p.gy+=dy/dl*spd; } }
  });
  // separation (boids-style): never let two people occupy the same spot — push
  // apart any pair closer than MINSEP, gently and symmetrically. Run twice so a
  // tight cluster settles in one frame.
  var MINSEP=0.95, ag=officeAgents;
  for(var pass=0;pass<2;pass++){ for(var i=0;i<ag.length;i++){ var pi=officePos[ag[i].name]; if(!pi) continue;
    for(var j=i+1;j<ag.length;j++){ var pj=officePos[ag[j].name]; if(!pj) continue;
      var sx=pi.gx-pj.gx, sy=pi.gy-pj.gy, q=sx*sx+sy*sy;
      if(q>1e-7 && q<MINSEP*MINSEP){ var dd=Math.sqrt(q), ph=(MINSEP-dd)*0.25, ux=sx/dd, uy=sy/dd; pi.gx+=ux*ph; pi.gy+=uy*ph; pj.gx-=ux*ph; pj.gy-=uy*ph; }
      else if(q<=1e-7){ pi.gx+=0.07; pj.gx-=0.07; } } } }
}
function isoBox(ctx,sx,sy,hw,hh,h,top,left,right){
  var Tx=sx,Ty=sy-h-hh, Rx=sx+hw,Ry=sy-h, Fx=sx,Fy=sy-h+hh, Lx=sx-hw,Ly=sy-h;
  var Fbx=sx,Fby=sy+hh, Rbx=sx+hw,Rby=sy, Lbx=sx-hw,Lby=sy;
  ctx.fillStyle=right; ctx.beginPath(); ctx.moveTo(Fx,Fy); ctx.lineTo(Rx,Ry); ctx.lineTo(Rbx,Rby); ctx.lineTo(Fbx,Fby); ctx.closePath(); ctx.fill();
  ctx.fillStyle=left; ctx.beginPath(); ctx.moveTo(Lx,Ly); ctx.lineTo(Fx,Fy); ctx.lineTo(Fbx,Fby); ctx.lineTo(Lbx,Lby); ctx.closePath(); ctx.fill();
  ctx.fillStyle=top; ctx.beginPath(); ctx.moveTo(Tx,Ty); ctx.lineTo(Rx,Ry); ctx.lineTo(Fx,Fy); ctx.lineTo(Lx,Ly); ctx.closePath(); ctx.fill();
}
function drawCubicle(ctx,gx,gy,color){
  var wallH=30; var T=isoTop(gx,gy);
  var R={x:T.x+ISO_TW2,y:T.y+ISO_TH2}, L={x:T.x-ISO_TW2,y:T.y+ISO_TH2};
  var T2={x:T.x,y:T.y-wallH}, R2={x:R.x,y:R.y-wallH}, L2={x:L.x,y:L.y-wallH};
  // back-right panel (lit side)
  ctx.fillStyle='#525d6b'; ctx.beginPath(); ctx.moveTo(T.x,T.y); ctx.lineTo(R.x,R.y); ctx.lineTo(R2.x,R2.y); ctx.lineTo(T2.x,T2.y); ctx.closePath(); ctx.fill();
  // back-left panel (shaded side)
  ctx.fillStyle='#3c4651'; ctx.beginPath(); ctx.moveTo(T.x,T.y); ctx.lineTo(L.x,L.y); ctx.lineTo(L2.x,L2.y); ctx.lineTo(T2.x,T2.y); ctx.closePath(); ctx.fill();
  // frosted highlight band just under the top edge
  ctx.strokeStyle='rgba(255,255,255,.10)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(L2.x,L2.y+4); ctx.lineTo(T2.x,T2.y+4); ctx.lineTo(R2.x,R2.y+4); ctx.stroke();
  // department-coloured top rail (rounded)
  ctx.lineCap='round'; ctx.strokeStyle=color; ctx.lineWidth=3.5; ctx.beginPath(); ctx.moveTo(L2.x,L2.y); ctx.lineTo(T2.x,T2.y); ctx.lineTo(R2.x,R2.y); ctx.stroke(); ctx.lineCap='butt';
  // corner post at the back vertex
  ctx.fillStyle=shade(color,-34); ctx.fillRect(T2.x-1.5,T2.y,3,wallH);
}
// Office swivel chair (drawn behind the person at the desk). Stays at the desk
// when the worker walks off → an empty chair, which reads as a real workplace.
function drawChair(ctx,cx,cy){
  cx=Math.round(cx); cy=Math.round(cy);
  // 5-star base with castors
  ctx.strokeStyle='#23282e'; ctx.lineWidth=2.4;
  for(var a=0;a<5;a++){ var ang=a*Math.PI*2/5-Math.PI/2; ctx.beginPath(); ctx.moveTo(cx,cy-2); ctx.lineTo(cx+Math.cos(ang)*11,cy-2+Math.sin(ang)*5.5); ctx.stroke(); }
  ctx.fillStyle='#14181d'; for(var a2=0;a2<5;a2++){ var an=a2*Math.PI*2/5-Math.PI/2; ctx.beginPath(); ctx.arc(cx+Math.cos(an)*11,cy-2+Math.sin(an)*5.5,2,0,Math.PI*2); ctx.fill(); }
  // gas cylinder
  ctx.fillStyle='#2a3038'; ctx.fillRect(cx-2,cy-16,4,14);
  // seat cushion
  ctx.fillStyle='#3b4654'; roundRect(ctx,cx-12,cy-23,24,9,3); ctx.fill();
  ctx.fillStyle='#46525f'; roundRect(ctx,cx-11,cy-23,22,3,2); ctx.fill();
  // backrest (rises behind the person)
  ctx.fillStyle='#333d49'; roundRect(ctx,cx-11,cy-48,22,27,6); ctx.fill();
  ctx.fillStyle='#3e4a57'; roundRect(ctx,cx-9,cy-46,18,12,5); ctx.fill();
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
  var dist=Math.abs(p.gx-home.gx)+Math.abs(p.gy-home.gy); var atDesk=dist<0.3;
  // "walking" = actually moving toward the current target (not merely "away from
  // home") — so an agent idling at a social spot doesn't moonwalk in place.
  var tg=p._tgt||home; var walking=(Math.abs(p.gx-tg.gx)+Math.abs(p.gy-tg.gy))>0.12;
  var working=(st==='working'&&atDesk);
  var look=a._look||(a._look=lookFor(a));
  // cubicle partitions (back edges) — department room divider, behind the person
  drawCubicle(ctx, home.gx, home.gy, col);
  // swivel chair stays at the desk (empty when the worker walks off)
  drawChair(ctx, dg.x, dg.y+3);
  // person (feet on iso ground)
  drawCharacter(ctx, pg.x, pg.y, look, walking, working);
  // desk as iso box (warmer wood) + a thin top-front edge highlight
  isoBox(ctx, dg.x, dg.y-2, 40, 20, 16, '#86643a','#664a2c','#503922');
  ctx.strokeStyle='rgba(255,228,180,.16)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(dg.x-40,dg.y-18); ctx.lineTo(dg.x,dg.y+2); ctx.lineTo(dg.x+40,dg.y-18); ctx.stroke();
  // desktop items: keyboard + mug + papers
  ctx.fillStyle='#222a32'; roundRect(ctx,dg.x-12,dg.y-7,24,7,1.5); ctx.fill();
  ctx.fillStyle='#3c4853'; for(var kr=0;kr<2;kr++){ for(var kc=0;kc<6;kc++){ ctx.fillRect(dg.x-10+kc*3.5,dg.y-6+kr*3,2.4,2); } }
  ctx.fillStyle=col; ctx.fillRect(dg.x-23,dg.y-10,6,8); ctx.fillStyle='rgba(255,255,255,.25)'; ctx.fillRect(dg.x-22,dg.y-9,1.6,6);
  ctx.fillStyle='#eceff2'; ctx.fillRect(dg.x+14,dg.y-8,11,7); ctx.fillStyle='#c2c9d0'; ctx.fillRect(dg.x+15,dg.y-9,11,7);
  // monitor (billboard at the back of the desk)
  var mx=dg.x, my=dg.y-28;
  ctx.fillStyle='#0e1318'; roundRect(ctx,mx-18,my-14,36,24,3); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=1; roundRect(ctx,mx-17.5,my-13.5,35,23,3); ctx.stroke();
  var screen=(!atDesk||st==='idle')?'#2a3742' : st==='done'?'#2ea043' : st==='failed'?'#f85149' : col;
  if(st==='working'&&atDesk){ ctx.globalAlpha=0.62+0.38*(0.5+0.5*Math.sin(officeFrame/6)); }
  ctx.fillStyle=screen; ctx.fillRect(mx-16,my-12,32,19); ctx.globalAlpha=1;
  if(atDesk){ ctx.fillStyle='rgba(255,255,255,.42)'; ctx.fillRect(mx-10,my-7,15,1); ctx.fillRect(mx-10,my-4,11,1); ctx.fillRect(mx-10,my-1,17,1); ctx.fillRect(mx-10,my+2,8,1); }
  ctx.fillStyle='#0e1318'; ctx.fillRect(mx-2,my+10,4,6); roundRect(ctx,mx-7,my+15,14,3,1.5); ctx.fill();
  var dot=st==='working'?'#d29922':st==='done'?'#2ea043':st==='failed'?'#f85149':'#3a4450';
  ctx.fillStyle=dot; ctx.beginPath(); ctx.arc(mx+17,my-10,2.5,0,Math.PI*2); ctx.fill();
  // role-specific desk props (analyst charts, coder 2nd monitor, researcher books, …)
  if(atDesk) drawRoleProps(ctx, dg.x, dg.y, a.type);
  // speech bubble above person
  var b=officeBubble[nm];
  if(b && officeFrame<b.until){ ctx.font='12.5px system-ui,Segoe UI,sans-serif'; var w=ctx.measureText(b.text).width+18;
    var bx=Math.round(pg.x-w/2), by=Math.round(pg.y-96);
    // collision avoidance: raise the bubble until it no longer overlaps one drawn
    // earlier this frame (prevents bubbles stacking when agents cluster).
    for(var bi=0; bi<bubbleRects.length; bi++){ var r=bubbleRects[bi];
      if(bx < r.x+r.w && bx+w > r.x && by < r.y+r.h+4 && by+26 > r.y-4){ by=r.y-30; bi=-1; } }
    bubbleRects.push({x:bx,y:by,w:w,h:26});
    ctx.fillStyle='#f7fafc'; roundRect(ctx,bx,by,w,22,8); ctx.fill();
    ctx.fillStyle='#0d1117'; ctx.textAlign='center'; ctx.fillText(b.text,pg.x,by+15);
    ctx.fillStyle='#f7fafc'; ctx.beginPath(); ctx.moveTo(pg.x-4,by+22); ctx.lineTo(pg.x+5,by+22); ctx.lineTo(pg.x,by+27); ctx.fill(); }
  // name + role under the desk
  ctx.fillStyle='#eef2f6'; ctx.font='bold 11px system-ui,Segoe UI,sans-serif'; ctx.textAlign='center'; ctx.fillText(shortName(a.name),dg.x,dg.y+22);
  ctx.fillStyle='#9aa4ad'; ctx.font='9px system-ui,Segoe UI,sans-serif'; ctx.fillText(roleOf(a),dg.x,dg.y+33);
  // department name plate — hung high above the seated head so it never covers the face
  var dep=DEPT[a.type]||roleOf(a);
  ctx.font='bold 9px system-ui,Segoe UI,sans-serif'; var dw=ctx.measureText(dep).width+10;
  var npY=dg.y-110;
  ctx.fillStyle='rgba(13,17,23,.70)'; roundRect(ctx,dg.x-dw/2,npY,dw,13,3); ctx.fill();
  ctx.fillStyle=col; ctx.textAlign='center'; ctx.fillText(dep,dg.x,npY+9);
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
    var n0=lerpP(p0,p3,0.5), n1=lerpP(p1,p2,0.5); ctx.beginPath(); ctx.moveTo(n0.x,n0.y); ctx.lineTo(n1.x,n1.y); ctx.stroke();
    // window sill ledge
    ctx.fillStyle='#2c3540'; ctx.beginPath(); ctx.moveTo(p0.x-1.5,p0.y+1); ctx.lineTo(p1.x+1.5,p1.y+1); ctx.lineTo(p1.x+1.5,p1.y+4); ctx.lineTo(p0.x-1.5,p0.y+4); ctx.closePath(); ctx.fill();
  }
  // baseboard trim along the floor seam (bottom edge A-B)
  var bh=6;
  ctx.fillStyle='#1a212b'; ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.lineTo(B.x,B.y-bh); ctx.lineTo(A.x,A.y-bh); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(A.x,A.y-bh); ctx.lineTo(B.x,B.y-bh); ctx.stroke();
  // framed wall art between the windows (adds life to the back walls)
  for(var w2=1; w2<nwin; w2++){ var ta=w2/nwin; var ca=lerpP(A,B,ta); var aw=0.05, amid=h*0.46, ah=h*0.26;
    var a0={x:ca.x-dir.x*aw, y:ca.y-dir.y*aw-amid}, a1={x:ca.x+dir.x*aw, y:ca.y+dir.y*aw-amid}, a2={x:a1.x,y:a1.y-ah}, a3={x:a0.x,y:a0.y-ah};
    var pic=['#3f6f5a','#6a4f7a','#7a5a3a','#3a5a7a'][w2%4];
    ctx.fillStyle=pic; ctx.beginPath(); ctx.moveTo(a0.x,a0.y); ctx.lineTo(a1.x,a1.y); ctx.lineTo(a2.x,a2.y); ctx.lineTo(a3.x,a3.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#cdb98c'; ctx.lineWidth=2; ctx.stroke();
  }
}
function isoTileDiamond(ctx,gx,gy){ var t=isoTop(gx,gy); ctx.beginPath(); ctx.moveTo(t.x,t.y); ctx.lineTo(t.x+ISO_TW2,t.y+ISO_TH2); ctx.lineTo(t.x,t.y+ISO_TH2*2); ctx.lineTo(t.x-ISO_TW2,t.y+ISO_TH2); ctx.closePath(); }
function isoPlant(ctx,gx,gy){ var g=groundAt(gx,gy); isoBox(ctx,g.x,g.y-2,9,5,9,'#b5643c','#9c4f2e','#86421f');
  ctx.fillStyle='#2f8f4a'; ctx.beginPath(); ctx.arc(g.x,g.y-17,11,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#3fae5a'; ctx.beginPath(); ctx.arc(g.x-5,g.y-21,7,0,Math.PI*2); ctx.arc(g.x+6,g.y-19,6,0,Math.PI*2); ctx.fill(); }
function isoCooler(ctx,gx,gy){ var g=groundAt(gx,gy); isoBox(ctx,g.x,g.y-2,7,4,16,'#e2eaf0','#c4d2dc','#aebecb'); ctx.fillStyle='#bfe3f5'; ctx.fillRect(g.x-6,g.y-31,12,11); ctx.fillStyle='#5fbfe0'; ctx.fillRect(g.x-5,g.y-30,10,8); }
function isoPrinter(ctx,gx,gy){ var g=groundAt(gx,gy); isoBox(ctx,g.x,g.y-2,11,6,11,'#cdd3da','#aab2bb','#9098a1'); ctx.fillStyle='#2a323b'; ctx.fillRect(g.x-7,g.y-15,14,3); ctx.fillStyle='#eef2f5'; ctx.fillRect(g.x-5,g.y-13,10,4); }
function isoCoffee(ctx,gx,gy){ var g=groundAt(gx,gy); isoBox(ctx,g.x,g.y-2,8,5,16,'#2a323b','#1e242b','#171c22'); ctx.fillStyle='#d29922'; ctx.fillRect(g.x-4,g.y-22,8,3); ctx.fillStyle='#7a4a2a'; ctx.fillRect(g.x-3,g.y-12,6,4); }
// Lounge: a small two-seat sofa + a low coffee table (rest zone).
function isoSofa(ctx,gx,gy){ var g=groundAt(gx,gy);
  isoBox(ctx,g.x,g.y-2,21,10,6,'#414b66','#353d54','#2b3145'); // base block
  ctx.fillStyle='#566089'; roundRect(ctx,g.x-19,g.y-13,38,7,3); ctx.fill();      // seat
  ctx.fillStyle='#4a547a'; ctx.fillRect(g.x-1,g.y-13,2,7);                          // seat seam
  ctx.fillStyle='#3e4763'; roundRect(ctx,g.x-19,g.y-30,38,17,5); ctx.fill();       // backrest
  ctx.fillStyle='#4a547a'; roundRect(ctx,g.x-17,g.y-28,34,7,4); ctx.fill();        // backrest highlight
  ctx.fillStyle='#363e57'; roundRect(ctx,g.x-23,g.y-21,7,15,3); ctx.fill(); roundRect(ctx,g.x+16,g.y-21,7,15,3); ctx.fill(); // armrests
  ctx.fillStyle='#c0563c'; roundRect(ctx,g.x-14,g.y-13,9,7,2); ctx.fill();          // throw cushion
}
function isoLowTable(ctx,gx,gy){ var g=groundAt(gx,gy);
  isoBox(ctx,g.x,g.y-2,12,6,5,'#5a4632','#46361f','#372a18');
  ctx.fillStyle='#6b5640'; ctx.beginPath(); ctx.ellipse(g.x,g.y-7,13,6,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#2f8f4a'; ctx.fillRect(g.x-2,g.y-11,5,4); ctx.fillStyle='#e7ecf1'; ctx.fillRect(g.x+4,g.y-9,5,3); // plant + magazine
}
// Free-standing whiteboard on an easel (beside the meeting room).
function isoWhiteboard(ctx,gx,gy){ var g=groundAt(gx,gy);
  ctx.strokeStyle='#5a4632'; ctx.lineWidth=2.4; ctx.beginPath();
  ctx.moveTo(g.x-12,g.y); ctx.lineTo(g.x-7,g.y-30); ctx.moveTo(g.x+12,g.y); ctx.lineTo(g.x+7,g.y-30); ctx.moveTo(g.x,g.y+2); ctx.lineTo(g.x+3,g.y-26); ctx.stroke();
  ctx.fillStyle='#eef2f5'; roundRect(ctx,g.x-20,g.y-54,40,28,2); ctx.fill();
  ctx.strokeStyle='#9aa4ad'; ctx.lineWidth=1.5; roundRect(ctx,g.x-20,g.y-54,40,28,2); ctx.stroke();
  // scribbles: two flow boxes + arrow, a green curve, an amber underline
  ctx.strokeStyle='#2f81f7'; ctx.lineWidth=1.4; ctx.strokeRect(g.x-15,g.y-50,9,6); ctx.strokeRect(g.x+6,g.y-50,9,6);
  ctx.beginPath(); ctx.moveTo(g.x-6,g.y-47); ctx.lineTo(g.x+6,g.y-47); ctx.stroke();
  ctx.strokeStyle='#2ea043'; ctx.beginPath(); ctx.moveTo(g.x-15,g.y-38); ctx.lineTo(g.x-8,g.y-34); ctx.lineTo(g.x+2,g.y-40); ctx.lineTo(g.x+13,g.y-36); ctx.stroke();
  ctx.strokeStyle='#d29922'; ctx.beginPath(); ctx.moveTo(g.x-15,g.y-31); ctx.lineTo(g.x-2,g.y-31); ctx.stroke();
  ctx.fillStyle='#cfd6dc'; ctx.fillRect(g.x-20,g.y-27,40,2); // marker tray
}
// One pane of a framed glass partition between floor points A and B, height h.
function drawGlassWall(ctx,A,B,h){
  var A2={x:A.x,y:A.y-h}, B2={x:B.x,y:B.y-h};
  ctx.fillStyle='rgba(150,194,224,0.12)'; ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.lineTo(B2.x,B2.y); ctx.lineTo(A2.x,A2.y); ctx.closePath(); ctx.fill();
  // diagonal glass sheen
  ctx.strokeStyle='rgba(255,255,255,.10)'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(lerpP(A,B,0.22).x,lerpP(A,B,0.22).y-3); ctx.lineTo(lerpP(A2,B2,0.42).x,lerpP(A2,B2,0.42).y+3); ctx.stroke();
  // frame: top rail + bottom rail + end posts + middle mullion
  ctx.strokeStyle='#5b6876'; ctx.lineWidth=2.6; ctx.beginPath(); ctx.moveTo(A2.x,A2.y); ctx.lineTo(B2.x,B2.y); ctx.stroke();
  ctx.strokeStyle='#3c4651'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.stroke();
  ctx.strokeStyle='#6c7a88'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(A2.x,A2.y); ctx.moveTo(B.x,B.y); ctx.lineTo(B2.x,B2.y); ctx.stroke();
  var m=lerpP(A,B,0.5), m2=lerpP(A2,B2,0.5); ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(m.x,m.y); ctx.lineTo(m2.x,m2.y); ctx.stroke();
}
// The «Переговорная»: carpet, glass back walls (front open), conference table with
// laptop/cups, stools around it, a wall presentation screen, and a hung nameplate.
function drawMeetingRoom(ctx){
  var N=isoTop(5,5), E=isoTop(8,5), S=isoTop(8,8), W=isoTop(5,8);
  // carpet (3x3) two-tone + border
  for(var dy=-1;dy<=1;dy++){ for(var dx=-1;dx<=1;dx++){ var rgx=6+dx, rgy=6+dy; if(rgx<0||rgy<0||rgx>=GRIDW||rgy>=GRIDH)continue;
    isoTileDiamond(ctx,rgx,rgy); ctx.globalAlpha=0.62; ctx.fillStyle=(((dx+dy)&1)===0)?'#274363':'#22384f'; ctx.fill(); ctx.globalAlpha=1; } }
  ctx.strokeStyle='rgba(120,170,220,.30)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(N.x,N.y); ctx.lineTo(E.x,E.y); ctx.lineTo(S.x,S.y); ctx.lineTo(W.x,W.y); ctx.closePath(); ctx.stroke();
  // conference table
  var mg=groundAt(6,6);
  isoBox(ctx,mg.x,mg.y-2,52,26,9,'#3a3f47','#2c3036','#212429');
  ctx.fillStyle='#474d56'; ctx.beginPath(); ctx.ellipse(mg.x,mg.y-13,46,21,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#525964'; ctx.beginPath(); ctx.ellipse(mg.x,mg.y-14,40,17,0,0,Math.PI*2); ctx.fill();
  // table props: laptop, papers, mug
  ctx.fillStyle='#10151b'; ctx.fillRect(mg.x-20,mg.y-19,12,8); ctx.fillStyle='#2ea043'; ctx.fillRect(mg.x-19,mg.y-18,10,6);
  ctx.fillStyle='#e7ecf1'; ctx.fillRect(mg.x+6,mg.y-16,12,8); ctx.fillStyle='#d29922'; ctx.fillRect(mg.x-2,mg.y-15,4,4);
  // stools around the table
  var seats=[[mg.x-36,mg.y-2],[mg.x+36,mg.y-2],[mg.x-16,mg.y+12],[mg.x+16,mg.y+12],[mg.x-16,mg.y-20],[mg.x+16,mg.y-20]];
  seats.forEach(function(s){ ctx.fillStyle='#333d49'; roundRect(ctx,s[0]-6,s[1]-7,12,8,3); ctx.fill(); ctx.fillStyle='#2a3038'; ctx.fillRect(s[0]-1.5,s[1]+1,3,5); });
  // glass partitions on the two far edges (front stays open so we see in)
  drawGlassWall(ctx,N,W,36); drawGlassWall(ctx,N,E,36);
  // wall presentation screen on the back-right glass
  var sc0=lerpP(N,E,0.42), sc1=lerpP(N,E,0.72), sct=24;
  var q0={x:sc0.x,y:sc0.y-12}, q1={x:sc1.x,y:sc1.y-12};
  ctx.fillStyle='#0e141b'; ctx.beginPath(); ctx.moveTo(q0.x,q0.y); ctx.lineTo(q1.x,q1.y); ctx.lineTo(q1.x,q1.y-sct); ctx.lineTo(q0.x,q0.y-sct); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#2a3744'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle='#2f81f7'; for(var li=0;li<3;li++){ ctx.fillRect(q0.x+5,q0.y-sct+6+li*5,16+li*7,2); }
  // hung nameplate
  ctx.save(); ctx.font='bold 10px system-ui,Segoe UI,sans-serif'; ctx.textAlign='center';
  var rl='ПЕРЕГОВОРНАЯ'; var rw=ctx.measureText(rl).width+16; ctx.fillStyle='rgba(13,17,23,.78)';
  roundRect(ctx,mg.x-rw/2,mg.y-80,rw,16,5); ctx.fill(); ctx.strokeStyle='rgba(120,170,220,.4)'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#cfe0ff'; ctx.fillText(rl,mg.x,mg.y-69); ctx.restore();
}
var bubbleRects=[];
function drawOffice(){
  var cv=document.getElementById('office'); if(!cv)return; var ctx=cv.getContext('2d'); var W=cv.width,H=cv.height; offW=W; offH=H;
  bubbleRects=[]; // per-frame bubble collision tracking (raise overlapping bubbles)
  ctx.fillStyle='#0b0f14'; ctx.fillRect(0,0,W,H);
  ISO_OX=Math.round(W/2 - (GRIDW-GRIDH)*ISO_TW2/2); ISO_OY=ISO_OY_BASE;
  var n=officeAgents.length;
  if(!n){ ctx.fillStyle='#cdd6df'; ctx.font='13px system-ui,sans-serif'; ctx.textAlign='center'; ctx.fillText('Команда не нанята — запустите сид команды',W/2,H/2); return; }
  // camera: scene drawn under pan/zoom; HUD (chip/hint) stays fixed
  ctx.save(); ctx.translate(camX,camY); ctx.scale(camZ,camZ);
  // back walls (two iso parallelograms meeting at the back corner)
  drawWall(ctx, isoTop(0,0), isoTop(GRIDW,0), 96, '#2b3340','#3b4654', 3);   // right-back
  drawWall(ctx, isoTop(0,0), isoTop(0,GRIDH), 96, '#232a35','#323c49', 2);   // left-back
  // floor — warm wood planks with bevelled plank seams + soft department tint near desks
  for(var gy=0; gy<GRIDH; gy++){ for(var gx=0; gx<GRIDW; gx++){
    var tt=isoTop(gx,gy);
    isoTileDiamond(ctx,gx,gy);
    ctx.fillStyle=(((gx+gy)%2)===0)?'#b58a55':'#a87e4b'; ctx.fill();
    // bevel: light on the top-left edge, shadow on the bottom-right edge → plank relief
    ctx.strokeStyle='rgba(255,238,205,.08)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(tt.x-ISO_TW2,tt.y+ISO_TH2); ctx.lineTo(tt.x,tt.y); ctx.lineTo(tt.x+ISO_TW2,tt.y+ISO_TH2); ctx.stroke();
    ctx.strokeStyle='rgba(38,24,10,.32)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(tt.x-ISO_TW2,tt.y+ISO_TH2); ctx.lineTo(tt.x,tt.y+ISO_TH2*2); ctx.lineTo(tt.x+ISO_TW2,tt.y+ISO_TH2); ctx.stroke();
    var ft=floorTint[gx*100+gy]; if(ft){ isoTileDiamond(ctx,gx,gy); ctx.globalAlpha=0.14; ctx.fillStyle=ft; ctx.fill(); ctx.globalAlpha=1; }
  } }
  // glass-walled meeting room (replaces the bare blue square)
  drawMeetingRoom(ctx);
  // static decor at back edges (low depth, drawn before people)
  isoPlant(ctx,1,0); isoPlant(ctx,0,1); isoPlant(ctx,GRIDW-1,0); isoPlant(ctx,GRIDW-1,GRIDH-1); isoCooler(ctx,2,0); isoPrinter(ctx,0,2); isoCoffee(ctx,3,0);
  // lounge / rest zone (front-left): warm rug + two-seat sofa + coffee table
  [[1,6],[1,7],[2,7]].forEach(function(R){ isoTileDiamond(ctx,R[0],R[1]); ctx.globalAlpha=0.45; ctx.fillStyle='#6a4a3a'; ctx.fill(); ctx.globalAlpha=1; });
  isoSofa(ctx,1,7); isoLowTable(ctx,2,7); isoPlant(ctx,1,6);
  isoWhiteboard(ctx,4,5); // board beside the meeting room
  // ceiling pendant lamps — warm pools of light on the floor (atmosphere)
  [[3,1],[7,1],[10,2]].forEach(function(L){ var c=isoTop(L[0],L[1]); var lx=Math.round(c.x), ly=Math.round(c.y-74);
    var gg=ctx.createRadialGradient(lx,ly+4,2,lx,ly+14,38); gg.addColorStop(0,'rgba(255,226,150,.26)'); gg.addColorStop(1,'rgba(255,226,150,0)');
    ctx.fillStyle=gg; ctx.beginPath(); ctx.ellipse(lx,ly+16,34,26,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#262c34'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(lx,ly-34); ctx.lineTo(lx,ly-9); ctx.stroke();
    ctx.fillStyle='#39424d'; ctx.beginPath(); ctx.moveTo(lx-11,ly); ctx.lineTo(lx+11,ly); ctx.lineTo(lx+6,ly-10); ctx.lineTo(lx-6,ly-10); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ffe7a6'; roundRect(ctx,lx-8,ly-2,16,3,1.5); ctx.fill(); });
  // people + desks, depth-sorted (back to front)
  updateOffice();
  officeAgents.slice().sort(function(a,b){ var pa=officePos[a.name]||officeHome[a.name]||{gx:0,gy:0}, pb=officePos[b.name]||officeHome[b.name]||{gx:0,gy:0}; return (pa.gx+pa.gy)-(pb.gx+pb.gy); }).forEach(function(a){ drawStation(ctx,a); });
  // agent-interaction layer: orchestrator → each working agent (animated link + data packet)
  drawAgentLinks(ctx);
  ctx.restore();
  // cinematic grade: warm wash over everything + atmospheric depth haze toward the
  // back (top of screen = far in iso) → foreground reads sharp, background recedes
  // (a cheap depth-of-field feel). Haze gradient cached; warm wash is a flat fill.
  ctx.fillStyle='rgba(255,168,86,0.045)'; ctx.fillRect(0,0,W,H);
  if(!officeGrade||officeGrade.w!==W||officeGrade.h!==H){ var hz=ctx.createLinearGradient(0,0,0,H*0.52);
    hz.addColorStop(0,'rgba(126,146,178,0.16)'); hz.addColorStop(1,'rgba(126,146,178,0)'); officeGrade={w:W,h:H,haze:hz}; }
  ctx.fillStyle=officeGrade.haze; ctx.fillRect(0,0,W,Math.round(H*0.52));
  // ambient vignette — darkens the edges for depth/mood (screen-space, gradient cached)
  if(!officeVig||officeVig.w!==W||officeVig.h!==H){ var vg=ctx.createRadialGradient(W/2,H*0.40,Math.min(W,H)*0.18,W/2,H*0.52,Math.max(W,H)*0.74);
    vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(0.7,'rgba(6,9,14,0.16)'); vg.addColorStop(1,'rgba(4,7,12,0.55)'); officeVig={w:W,h:H,g:vg}; }
  ctx.fillStyle=officeVig.g; ctx.fillRect(0,0,W,H);
  // HUD: title chip + camera hint (fixed, unaffected by the camera)
  ctx.fillStyle='rgba(13,17,23,.55)'; roundRect(ctx,10,8,210,20,5); ctx.fill();
  ctx.fillStyle='#dfe6ee'; ctx.font='bold 12px system-ui,Segoe UI,sans-serif'; ctx.textAlign='left'; ctx.fillText('🏢 Офис команды agent-os',16,22);
  ctx.fillStyle='rgba(139,148,158,.85)'; ctx.font='10px system-ui,Segoe UI,sans-serif'; ctx.textAlign='right';
  ctx.fillText(camZ===1&&camX===0&&camY===0 ? 'колесо — зум · мышь — двигать' : 'двойной клик — сброс камеры (' + Math.round(camZ*100) + '%)', W-10, H-8);
  ctx.textAlign='left';
  drawOfficeCards(ctx,W);
}
// Live event-cards in the top-right HUD (fixed, above the camera transform).
function drawOfficeCards(ctx,W){
  var live=[]; for(var i=0;i<officeCards.length;i++){ if(officeFrame<officeCards[i].until) live.push(officeCards[i]); }
  officeCards=live;
  var cw=196, ch=38, gap=7, x=W-cw-12, y=36;
  for(var j=0;j<live.length;j++){
    var c=live[j]; var age=officeFrame-c.born; var fade=Math.min(1,age/12); var left=c.until-officeFrame;
    var a=fade*(left<40?Math.max(0,left/40):1);
    ctx.save(); ctx.globalAlpha=a;
    ctx.fillStyle='rgba(18,24,31,.94)'; roundRect(ctx,x,y,cw,ch,8); ctx.fill();
    ctx.fillStyle=c.color; roundRect(ctx,x,y,3.5,ch,3); ctx.fill();
    ctx.font='15px system-ui,Segoe UI,sans-serif'; ctx.textAlign='left'; ctx.fillStyle='#fff'; ctx.fillText(c.icon,x+11,y+24);
    ctx.font='bold 11.5px system-ui,Segoe UI,sans-serif'; ctx.fillStyle='#eef2f6'; ctx.fillText(c.title.slice(0,22),x+34,y+15);
    ctx.font='10.5px system-ui,Segoe UI,sans-serif'; ctx.fillStyle='#9aa4ad'; ctx.fillText(c.sub.slice(0,26),x+34,y+29);
    ctx.restore();
    y+=ch+gap;
  }
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
  var host=cv.parentElement; if(!host) return;            // officeWrap (flex:1)
  var w=Math.max(420, Math.floor(host.clientWidth));
  // Fill the office column's height; leave a little for the legend row below.
  var h=Math.floor(host.clientHeight) - 28;
  if(!h || h<300){ var rect=cv.getBoundingClientRect(); h=Math.max(300, window.innerHeight-rect.top-44); }
  h=Math.max(300, h);
  cv.width=w; cv.height=h; cv.style.width=w+'px'; cv.style.height=h+'px';
  offW=w; offH=h;
  fitIso();
}
// Auto-fit the whole isometric grid into the canvas so EVERY agent is visible
// without scrolling — scale tile size to satisfy both width and height, and
// drop the floor far enough below the back walls.
var ISO_OY_BASE=84, ISO_WALL=96;
function fitIso(){
  var span=GRIDW+GRIDH;                       // 21 diamonds across / deep
  var marginX=58, charHead=70, bottomPad=46;
  var twW=(offW - marginX*2)/span;            // width constraint
  // vertical: wall room on top + grid depth + character heads + labels
  var twH=2*(offH - ISO_WALL - charHead - bottomPad)/span;
  var tw=Math.floor(Math.min(twW, twH));
  tw=Math.max(16, Math.min(48, tw));
  ISO_TW2=tw; ISO_TH2=Math.max(8, Math.round(tw/2));
  ISO_OY_BASE=ISO_WALL + 6;                   // push floor below the back walls
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
  if(st==='working'){ setBubble(a.name, pick(SAY_WORK[a.type]||SAY_WORK._def), 240); pushActivity(roleIcon(a.type)+' <b>'+shortName(a.name)+'</b> ('+roleOf(a)+') взял задачу в работу'); pushOfficeCard(roleIcon(a.type),shortName(a.name),'в работе · '+roleOf(a),roleColor(a.type)); }
  else if(st==='done'){ setBubble(a.name,'Готово ✓',180); pushActivity('✅ <b>'+shortName(a.name)+'</b> завершил подзадачу'); pushOfficeCard('✅',shortName(a.name),'готово · '+roleOf(a),'#2ea043'); }
  else if(st==='failed'){ setBubble(a.name,'Ошибка!',180); pushActivity('⚠️ <b>'+shortName(a.name)+'</b> — ошибка в задаче'); pushOfficeCard('⚠️',shortName(a.name),'ошибка · '+roleOf(a),'#f85149'); }
}
function officeResetIdle(){ officeAgents.forEach(function(a){ officeState[a.name]='idle'; }); officeCards=[]; pushActivity('🧭 — Координатор получил новую задачу —'); pushOfficeCard('🧭','Координатор','новая задача принята','#d29922'); }
var lastMeetTs=0;
function startMeeting(){
  var idle=officeAgents.filter(function(a){ return (officeState[a.name]||'idle')==='idle'; });
  if(idle.length<2) return; idle.sort(function(){return Math.random()-0.5;}); var crew=idle.slice(0,Math.min(3,idle.length));
  var dur=420; var slots=[[MEET_TILE[0]-1,MEET_TILE[1]],[MEET_TILE[0]+1,MEET_TILE[1]],[MEET_TILE[0],MEET_TILE[1]+1]];
  crew.forEach(function(a,i){ var s=slots[i%slots.length]; officeTgt[a.name]={gx:s[0],gy:s[1]}; officeDwell[a.name]=dur; officeMeetUntil[a.name]=officeFrame+dur; });
  // The gathering still plays out visually every time, but the feed line is
  // rate-limited so idle ambient meetings don't spam «собрались обсудить задачи».
  if(Date.now()-lastMeetTs>60000){ lastMeetTs=Date.now();
    pushActivity('☕ <b>'+crew.map(function(a){return shortName(a.name);}).join(', ')+'</b> собрались обсудить задачи'); }
  // One speaker at a time (turn-taking) — avoids 3 bubbles stacking over the table.
  var ticks=0; var iv=setInterval(function(){ ticks++; var sp=crew[ticks%crew.length]; if(sp) setBubble(sp.name, pick(SMALLTALK), 80); if(ticks>=6){ clearInterval(iv); } }, 1500);
}
function ambient(){
  if(!officeAgents.length) return;
  if(Math.random()<0.1){ startMeeting(); return; }
  var idle=officeAgents.filter(function(a){ return (officeState[a.name]||'idle')==='idle'; });
  if(idle.length){ var a=pick(idle); setBubble(a.name, pick(SMALLTALK), 90); }
}
// Sidebar: coordinator card + employee list (click = open their personal chat).
var pendingStaffSelect=null;
function loadSidebar(){
  var coordEl=$('sideCoord'), stEl=$('sideStaff'); if(!coordEl||!stEl) return;
  coordEl.innerHTML=''; stEl.innerHTML='';
  var coord=null, staff=[];
  officeAgents.forEach(function(a){ if(a.type==='orchestrator'&&!coord) coord=a; else staff.push(a); });
  function card(a,isCoord){
    var el=document.createElement('div'); el.className='scard';
    el.innerHTML='<span class="sava" style="background:'+roleColor(a.type)+'">'+escapeHtml(shortName(a.name).charAt(0))+'</span>'
      +'<span><div class="sname">'+escapeHtml(shortName(a.name))+'</div><div class="srole">'+escapeHtml(roleOf(a))+'</div></span>'
      +(isCoord?'<span class="sactive">АКТИВЕН</span>':'');
    el.addEventListener('click', function(){ pendingStaffSelect=a.id; openTab('staff'); });
    return el;
  }
  if(coord) coordEl.appendChild(card(coord,true));
  staff.forEach(function(a){ stEl.appendChild(card(a,false)); });
  var sc=$('scount'); if(sc) sc.textContent='('+staff.length+')';
}
// Tasks view: org-level runs with honest statuses; «Открыть» resumes the live
// lifecycle/discussion view for team tasks.
async function loadTasks(){
  var el=$('tasksList'); el.innerHTML='<small class="muted">загрузка…</small>';
  var items = await api('/orgs/'+ORG+'/tasks').catch(function(){ return null; });
  if(!items||!items.length){ el.innerHTML='<small class="muted">задач пока нет — поставьте первую во вкладке «Офис»</small>'; return; }
  el.innerHTML='';
  items.forEach(function(t){
    var color = t.status==='succeeded'?'#2ea043' : t.status==='failed'?'#f85149' : t.status==='running'?'#d29922' : '#8b949e';
    var row=document.createElement('div'); row.className='dmsg';
    var kind = t.chat ? '<span class="tag">чат</span>' : '<span class="tag" style="color:#d29922">команда</span>';
    var html='<span style="color:'+color+';font-weight:600">'+t.status+'</span> '+kind+' <span style="font-size:12.5px">'+escapeHtml(t.prompt||'(без текста)')+'</span>';
    if(t.errorHuman) html+='<div style="color:#f85149;font-size:12px">'+escapeHtml(t.errorHuman)+'</div>';
    row.innerHTML=html;
    if(!t.chat){ var b=document.createElement('button'); b.className='primary'; b.textContent='Открыть';
      b.style.cssText='margin-left:8px;padding:2px 10px;font-size:11.5px';
      b.addEventListener('click', (function(rid,label){ return function(){
        openTab('coord'); if(tasks[rid]){ selectTask(rid); } else { startTask(rid,label,true); }
      }; })(t.runId, t.prompt||'')); row.appendChild(b); }
    el.appendChild(row);
  });
}
// «Нанять команду»: catalog of ready-made teams with mini sprite previews.
function miniAvatar(member){
  var c=document.createElement('canvas'); var cell=2.1;
  c.width=Math.ceil(CH_W*cell); c.height=Math.ceil(CH_H*cell);
  c.style.width=c.width+'px'; c.style.height=c.height+'px';
  var ctx=c.getContext('2d');
  var look=lookFor({name:member.name, type:member.type});
  var rows=spriteRows(look.hairStyle,-1);
  var pal={H:look.hair,S:look.skin,e:'#141a21',J:look.suit,j:shade(look.suit,-28),T:'#eef2f6',t:look.shirt,P:look.pants,B:'#14181d'};
  drawGrid(ctx,0,0,rows,pal,cell);
  return c;
}
async function loadHire(){
  var grid=$('hireGrid'); grid.innerHTML='<small class="muted">загрузка каталога…</small>';
  var tpls = await api('/teams/templates').catch(function(){ return null; });
  if(!tpls||!tpls.length){ grid.innerHTML='<small class="muted">каталог недоступен</small>'; return; }
  var have={}; (staffAgents.length?staffAgents:officeAgents).forEach(function(a){ have[a.name]=1; });
  grid.innerHTML='';
  tpls.forEach(function(t){
    var card=document.createElement('div'); card.className='hcard'+(t.recommended?' rec':'');
    var h=document.createElement('h4'); h.textContent=t.title;
    if(t.recommended){ var rb=document.createElement('span'); rb.className='recbadge'; rb.textContent='РЕКОМЕНДУЕМ'; h.appendChild(rb); }
    card.appendChild(h);
    var d=document.createElement('div'); d.className='hdesc'; d.textContent=t.description; card.appendChild(d);
    var ava=document.createElement('div'); ava.className='hava';
    t.members.forEach(function(m){
      var hv=document.createElement('div'); hv.className='hv';
      hv.appendChild(miniAvatar(m));
      var nm=document.createElement('span'); nm.textContent=shortName(m.name); hv.appendChild(nm);
      ava.appendChild(hv); });
    card.appendChild(ava);
    var allHired = t.members.every(function(m){ return have[m.name]; });
    if(allHired){ var ok=document.createElement('div'); ok.className='hired'; ok.textContent='✓ Команда нанята'; card.appendChild(ok); }
    else {
      var btn=document.createElement('button'); btn.className='primary hbtn'; btn.textContent='Нанять команду';
      btn.addEventListener('click', (function(tid,b){ return function(){
        b.disabled=true; b.textContent='Нанимаю…';
        api('/orgs/'+ORG+'/teams/'+tid+'/hire',{method:'POST',body:'{}'}).then(function(r){
          if(r&&r.hired){ $('hireStatus').textContent='Наняты: '+(r.hired.length?r.hired.map(function(x){return shortName(x.name);}).join(', '):'все уже в команде');
            loadOffice(); loadStaff(); loadHire(); }
          else { $('hireStatus').textContent='Ошибка: '+((r&&r.error)||'не удалось нанять'); b.disabled=false; b.textContent='Нанять команду'; }
        }).catch(function(){ $('hireStatus').textContent='Сеть: не удалось нанять'; b.disabled=false; b.textContent='Нанять команду'; });
      }; })(t.id,btn));
      card.appendChild(btn);
    }
    grid.appendChild(card);
  });
}
async function loadOffice(){
  try { officeAgents = await api('/orgs/'+ORG+'/agents'); } catch(e) { officeAgents=[]; }
  if(!officeAgents||!officeAgents.length) officeAgents=[];
  officeAgents.forEach(function(a){ if(!officeState[a.name]) officeState[a.name]='idle'; });
  loadSidebar();
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
try { var savedTasks=JSON.parse(localStorage.getItem('agentos_active_tasks')||'[]');
  if(savedTasks&&savedTasks.length){ savedTasks.forEach(function(it,i){ if(it&&it.id) startTask(it.id, it.label||'', i===0); }); }
  else { var legacy=localStorage.getItem('agentos_last_task'); if(legacy) startTask(legacy,'',true); }
} catch(e){}
</script>
</body>
</html>`;
