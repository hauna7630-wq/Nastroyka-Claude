# agent-os — System Design (master)

Производственная платформа мульти-агентной оркестрации (внутренняя, без
коммерциализации). Этот документ — консолидированный дизайн; детальные
deliverables — в `docs/design/01-*.md … 09-*.md`. Везде помечено, что уже
**реализовано** в коде, а что **спроектировано** на будущее.

Прод: `https://agent.work8n.ru` (RU VPS) + US-релей `llm.work8n.ru` для доступа
к Anthropic по подписке Max через Claude Code CLI.

---

## 1. Проблема

Одиночный LLM-чат не решает длинные составные задачи: нет декомпозиции, нет
специализации, нет памяти между сообщениями, нет контроля качества, падения
непрозрачны. Наивная оркестрация «if/else вокруг промптов» рассыпается на:
координации (кто что делает после кого), состоянии (что уже сделано, что
упало), длительных задачах (минуты-часы, рестарты процесса), консистентности
памяти и надёжности инструментов.

agent-os решает это формальной моделью: **Run** (единица работы с конечным
автоматом состояний) + **типизированные агенты** + **оркестратор-планировщик**
+ **персистентный след** (шаги, события, аудит) + **очередь с ретраями и DLQ**.

## 2. Операционные персоны (не клиенты)

| Персона | Работа (JTBD) | Сегодня без системы | Что даёт система |
|---|---|---|---|
| Оператор | ставит задачи, следит за исполнением | чат с LLM, копипаста контекста | вкладки Офис/Задачи: фазы, обсуждение команды, честные ошибки, retry |
| Строитель | определяет агентов и команды | промпты в заметках | Agent Factory + каталог команд с экспертными промптами, версионирование промптов |
| Аналитик | разбирает инциденты и качество | grep по логам | Журнал агента, Debug-режим (промпт/шаги/токены/латентность), аудит-лог |
| Сисадмин | держит платформу живой | ssh + docker logs | CI/CD деплой, E2E-проверки в пайплайне, DLQ c requeue, миграции на старте |
| Agent Runtime (внутренний актор) | исполняет задачи автономно | — | FSM, бюджет итераций, защита от пустого вывода, идемпотентные child-runs |

## 3. Границы инженерного MVP (реализовано)

Включено: runtime агента (tool-use цикл), создание/исполнение задач, память
(short/long-term/episodic + pgvector), событийная шина (Redis pub/sub + SSE),
UI-консоль (живой офис, чат, задачи, журнал), изоляция по Org, слой
инструментов (http_request allowlist, code_exec sandbox, web_search,
read_document). Вне MVP: биллинг, мульти-регион, продвинутые дашборды.

## 4. Архитектура (потоки)

```
UI (SPA, zero-deps) ── HTTP/SSE ──> Control Plane (api/server.ts → controlPlane.ts)
                                        │ createRun / chat / hire / team / dlq
                                        ▼
                               Repository (Prisma/Postgres)  ◄── источник истины
                                        │ enqueue
                                        ▼
                               Queue (BullMQ/Redis, conc=4, lock=10m)
                                        ▼
                               Worker → dispatch → executeRun | executeOrchestration
                                        │ events (Redis pub/sub) → SSE → UI
                                        ▼
                               ModelProvider (Claude CLI / Anthropic API / Offline)
```

Гексагональность: runtime зависит только от портов (`Repository`, `Queue`,
`ModelProvider`, `EventBus`, `MemoryStore`, `Sandbox`, `DocumentParser`,
`SearchProvider`); тесты работают на in-memory адаптерах без инфраструктуры
(100 тестов, 0 внешних сервисов).

## 5. Runtime агента и FSM (реализовано)

Состояния Run: `queued → running → {succeeded|failed|paused|canceled}`;
переходы только через `runStateMachine.transition` (нелегальный переход —
исключение). Воркер владеет терминальным `failed` + DLQ; runtime на ошибке
оставляет `running` и бросает — это даёт ретраи без двойных терминалов.
Бюджет: `maxIterations=5` (HITL `paused` при превышении), `attempts<=3` → DLQ.
Деградация: пустой/«…» финальный текст = `EmptyModelOutputError` → fail, не
пустой success. Шаг 0 хранит превью собранного промпта (Debug).

## 6. Оркестрация (реализовано)

`complexity gate → ModelPlanner(JSON-план) → topo-sort → child runs
(id = parent::subtaskId, идемпотентны) → review-раунд (::review, вердикт) →
один revision-раунд (::rev1) → агрегат {summary, report, contributions,
review}`. Сбой планировщика → fallback на одиночного агента (не падение).
Личный чат (`input.chat`) минует оркестрацию — диалог с персоной.
Граф исполнения — DAG подзадач; события `orchestration.*` дают живую сборку.

## 7. Событийная модель (реализовано)

Типы: `run.started|succeeded|failed|dead_lettered|needs_human`,
`step.appended`, `orchestration.planned|subtask`. Транспорт: Redis pub/sub
(канал на run + wildcard), наружу — SSE `/runs/:id/events`. Гарантии:
fire-and-forget, поэтому **никакая критичная запись не зависит от событий** —
ответ чата доклеивается lazy-backfill'ом из `Run.output` (Postgres),
идемпотентно по `unique(runId, role)`. Replay = перечитать runs/steps из БД.

## 8. Очередь (реализовано)

BullMQ/Redis. Уроки прода: воркеру — отдельное соединение (блокирующие
команды); `concurrency=4` + `lockDuration=10m` (вызов Claude CLI до 3 мин —
иначе ложный «stalled»); `removeOnComplete/Fail` против мусора между
деплоями. Идемпотентность: `createRun` — upsert по id; бюджет попыток — на
Run, не на job (requeue не сбрасывает счёт). Backpressure: лимит конкуренции +
честный статус «в очереди» в UI.

## 9. Персистентность (реализовано; схема — 04-database.md)

PostgreSQL + pgvector. Org → Agent (+PromptVersion) → Run (self-FK parent) →
Step; AgentMemory (vector 256), ChatMessage (тред org+agent,
unique(runId,role)), DeadLetter, AuditLog. Реляционная модель выбрана из-за
FK-целостности следа исполнения; событийная история живёт в тех же Run/Step
(event sourcing не нужен — след и есть журнал).

## 10. Память (реализовано)

Short-term = контекст диалога (последние ~12 сообщений, бюджет 4000 симв., в
USER-промпт). Long-term/episodic — pgvector (HashEmbedder dim=256, косинус),
recall top-5 в SYSTEM-промпт; episodic-сводка пишется на success. Апгрейд:
смена эмбеддера = миграция размерности колонки (отмечено в схеме).

## 11. Файлы (реализовано)

`RichDocumentParser`: docx (mammoth), pdf (pdf-parse), xlsx (SheetJS,
все листы → CSV), csv/tsv/json/md/txt; лимит 200k символов; **контракт
честности** — нечитаемый файл возвращает конкретный фикс («.doc → пересохраните
как .docx», «скан → нужен OCR», «архив → распакуйте»...). Вход: 📎 в чате →
`POST /documents/extract` (cap 30MB) → текст в промпт. Изображения/аудио/видео —
спроектировано: тот же порт, OCR/ASR-адаптеры.

## 12. Наблюдаемость (реализовано)

Иммутабельный AuditLog; Журнал агента (`/orgs/:o/agents/:a/runs` +
errorHuman); трейс шагов с токенами/латентностью и превью промпта/вывода
(Debug-режим в Админке); расход токенов по агентам; лента активности (Event
Timeline). Спроектировано: OpenTelemetry-трейсы, Prometheus-метрики.

## 13. Безопасность (частично реализовано)

Реализовано: изоляция по Org во всех запросах; allowlist доменов для
http_request; per-agent allowlist инструментов; sandbox для code_exec
(subprocess + rlimits, docker-адаптер есть); PII-маскирование перед LLM;
TLS (Caddy/Let's Encrypt); секреты — GitHub Secrets → env. Спроектировано:
RBAC (Owner/Admin/Member/Viewer), шифрование at rest, бэкапы (pg_dump cron),
rate limiting. Известный долг: ротация засвеченного root-пароля RU-хоста.

## 14. Стек и trade-offs (кратко; полнее в 02-system-design.md)

Node/TS + zero-deps http (меньше поверхностей, чем NestJS; trade-off — ручной
роутинг); Prisma/Postgres (+pgvector — без отдельной vector-DB, пока агентов
единицы); BullMQ/Redis (достаточно для одного хоста; NATS/Kafka — при
горизонтальном росте); SPA в одном template literal (ограничение: без
backticks/${} — проверяется в CI-привычке) — нулевая сборка фронта.

## 15. Риски и failure modes (полнее в 09-risks.md)

LLM-провайдер недоступен/гео-блок → релей + честная ошибка + retry; модель
отвечает не-JSON планом → plan_fallback; долгий вызов → lock 10m + статус
«думает»; рестарт между succeeded и записью ответа → lazy-backfill из БД;
переполнение контекста → бюджеты обрезки; одиночный хост — SPOF → бэкапы +
быстрый redeploy (CI ~6 мин).
