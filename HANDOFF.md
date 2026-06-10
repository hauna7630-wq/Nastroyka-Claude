# HANDOFF — Nastroyka-Claude (agent-os + teamly)

Полное актуальное состояние проекта для продолжения работы (в т.ч. «боевым» Claude Code
на US-боксе). Всё важное — в репозитории; рабочая ветка: **`claude/inspiring-ride-OUkyL`**.
Обновлено: 2026-06-09.

---

## 1. Что это

Монорепозиторий, два приложения + деплой на один VPS:

- **`agent-os/`** — персональный мульти-агентный ИИ-оркестратор. Node/TS, гексагональная
  архитектура, BullMQ+Redis (execution plane), Prisma/Postgres+pgvector, песочница
  `code_exec`, событийная шина (Redis pub/sub) + SSE, **веб-UI «Координатор»** (пиксельный
  офис + личный чат с сотрудниками). Биллинга нет (личный инструмент).
- **`teamly/`** — корпоративная база знаний/вики + RAG-поиск + LMS. Next.js (standalone),
  Prisma/Postgres, TipTap, FTS (tsvector) + pgvector. **Не** использует Claude CLI.
- **`deploy/`** — docker-compose + Caddy (авто-TLS) для обоих приложений на одном хосте.

---

## 2. Живая инфраструктура (ВАЖНО)

| Что | Где |
| --- | --- |
| **Прод-сервер (RU)** | `185.28.175.11` (vdska, Ubuntu 24.04), root по паролю. Весь стек: docker compose в `/home/deploy/app`. Деплой-пользователь `deploy`. |
| **US-релей** | `138.124.123.234` (aeza, Ubuntu). Caddy reverse-proxy `https://llm.work8n.ru` → `api.anthropic.com`, доступ **только с `185.28.175.11`**. Нужен, т.к. из РФ Anthropic заблокирован. |
| **Домен** | `work8n.ru` (DNS у Beget). A-записи: `agent`, `teamly` → `185.28.175.11`; `llm` → `138.124.123.234`. |
| **Сайты** | `https://agent.work8n.ru` (agent-os), `https://teamly.work8n.ru` (teamly). TLS — Let's Encrypt через Caddy. |

### LLM (подписка Max, НЕ API-ключ)
Агенты «думают» через **Claude Code CLI** (`claude -p`), авторизация по
**`CLAUDE_CODE_OAUTH_TOKEN`** (подписка Max), сетевой выход — через релей
**`ANTHROPIC_BASE_URL=https://llm.work8n.ru`**. Без токена — офлайн-заглушка
(`OfflineModelProvider`). Веб-поиск работает через встроенный поиск Claude.

### GitHub secrets (Settings → Secrets → Actions)
`SSH_HOST=185.28.175.11`, `SSH_USER=deploy`, `SSH_KEY` (приватный CI-ключ), `GHCR_TOKEN`,
`POSTGRES_PASSWORD`, `AUTH_SECRET`, `TEAMLY_DOMAIN`, `AGENT_DOMAIN`, `ACME_EMAIL`,
`CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_BASE_URL=https://llm.work8n.ru`.
(В планах: `PERPLEXITY_API_KEY`, опц. `HTTPS_PROXY`.)

---

## 3. Как деплоить

**Основной путь — GitHub Actions `deploy.yml`** (`workflow_dispatch` или push в `release`):
собирает образы → пушит в GHCR → SSH на RU-сервер → `compose pull && up -d` →
**авто-сид экспертной команды** → **E2E-тест чата** → лог установленных Skills.

**Запасной путь (если раннеры GitHub в очереди) — локальная сборка на RU-сервере:**
```bash
rm -rf /tmp/aos && git clone --depth 1 -b claude/inspiring-ride-OUkyL \
  https://github.com/hauna7630-wq/nastroyka-claude /tmp/aos && \
docker build -t ghcr.io/hauna7630-wq/agent-os:latest /tmp/aos/agent-os && \
cd /home/deploy/app && docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate agentos
```

**Диагностика без рук на сервере:** `deploy.yml` содержит E2E-тест (создаёт run к Iskara
через `node` внутри контейнера, опрашивает статус, печатает ответ) + список Skills. Читать
через GitHub Actions логи (`get_job_logs` / `gh run view --log`).

---

## 4. agent-os — состояние

- **Команда (org `demo`)**: 7 именованных экспертов, авто-сид `prisma/seed.prod.cjs`
  (самообновляемый — создаёт новую PromptVersion при изменении текста): Arkesha (orchestrator),
  Kadrina (HR), Iskara (research), Analita (analytics), Slovena (writer), Kodrin (coder),
  Revisa (QA). Промпты — «эксперт Top-1-5%», 5-слойная модель + дисциплина фактчекинга +
  режим короткого живого чата.
- **Мозг**: `src/index.ts` выбирает провайдер: `CLAUDE_CODE_OAUTH_TOKEN` →
  `ClaudeSubscriptionModelProvider` (CLI, `--max-turns 8`, stdin закрыт) → `ANTHROPIC_API_KEY`
  → `OfflineModelProvider`.
- **Skills**: в образ агентов зашиты `anthropics/skills` (18: docx/pptx/pdf/xlsx/canvas/…)
  + `mukul975/Anthropic-Cybersecurity-Skills` (форензика/IR/малварь-анализ, blue-team) в
  `~/.claude/skills` (см. `agent-os/Dockerfile`).
- **UI** (`src/api/ui.ts`, бейдж `v14 · живой`): вкладки Координатор/Сотрудники/Команда/Админ.
  **v14: камера** — зум колесом (к курсору, 0.6–2.6x), панорама мышью, двойной клик — сброс.
  Изометрический офис (canvas, 2:1): сотрудники ходят, собираются на совещание, реплики-пузыри,
  лента активности. **v12**: рабочие места по роли (`drawRoleProps`) + анимированные линии
  взаимодействия Координатор→агент с «пакетами данных» (`drawAgentLinks`). **Личный чат**
  (Сотрудники): опрос статуса (не SSE), история в localStorage, **эффект печати** (typewriter),
  **v13: 📎 вложения** — файл уходит на `POST /documents/extract`, текст вшивается в промпт;
  нечитаемый файл даёт честное сообщение с конкретным фиксом. HTML отдаётся с `no-store`.
- **Файлы (Doc-1)**: `RichDocumentParser` (`src/adapters/documents.rich.ts`) — docx (mammoth),
  pdf (pdf-parse), xlsx (SheetJS, все листы CSV), csv/tsv/json/md/текст; лимит 200k символов;
  нечитаемое → `UnreadableDocumentError` с фиксом («.doc → пересохраните как .docx», «pptx →
  экспорт в PDF», «архив → распакуйте», «скан → OCR», «не то → конвертируйте/разбейте»).
  Внимание: jest требует `NODE_OPTIONS=--experimental-vm-modules` (динамический импорт pdfjs) —
  уже зашито в `npm test`.
- **Воркер**: BullMQ — у Worker СВОЁ Redis-соединение (критично). Плюс **concurrency=4 +
  lockDuration=10мин + removeOnComplete/Fail** (`queue.bullmq.ts`, env `BULLMQ_CONCURRENCY`/
  `BULLMQ_LOCK_MS`): один медленный/застрявший run больше не блокирует очередь и не убивается
  как «stalled». Это устранило зависания `queued` (E2E: queued→running→succeeded ~4с).
- **Оркестрация (коллективное мышление)**: `executeOrchestration` — полный цикл
  **план → работа → ревью → доработка**: декомпозиция на типизированных агентов;
  **ревью-раунд** Revisa по всей работе команды с вердиктом («Готово к выпуску» /
  «Нужны доработки: …»); при недвусмысленном «Нужны доработки» — **один раунд доработки**
  (`<parent>::rev1`, синтез-агент дорабатывает по критике, итог замещает summary).
  Ответ — **структурированный отчёт команды** (`buildTeamReport`): синтез + вклад каждого
  агента с ролевыми подписями + секция ревью (`output.report`/`contributions`/`review`).

### Проверено рабочим
Подписка Max через релей отвечает (E2E: run queued→running→succeeded ~4с, реальный текст
Claude, напр. «Я Iskara — исследователь-аналитик…»). Сайты под HTTPS. Команда сидится. Skills
устанавливаются (Anthropic + cybersec). Чат печатает.

---

## 5. teamly — состояние

Развёрнут, HTTPS, мигрирует на старте. Первый вход — сид `prisma/seed.prod.cjs`
(`owner@acme.test` / `secret123`). Публичной регистрации нет. RAG-функции есть в коде, но не
на Claude CLI.

---

## 6. Очередь задач (что осталось)

1. **Doc-2 глубже**: многораундовые дебаты (сейчас: ревью Revisa + 1 раунд доработки — в коде;
   дальше — несколько итераций, споры/консенсус между агентами).
2. **Doc-3 P1–P3** (см. `agent-os/docs/OFFICE_VISUAL.md`): P0 (v12) + камера (v14) — готово;
   дальше — комнаты (переговорка/серверная/lounge), карточки событий, иконки в ленте,
   панели проекта/агента, follow-agent, LOD.
3. **Perplexity** — подключить поиск (ждём `PERPLEXITY_API_KEY`); вариант — MCP-сервер для
   CLI агентов, через релей.
4. **Настоящий стриминг** ответов (CLI `--output-format stream-json` → SSE → токены в UI).
5. **Активация Skills по специализации** — проверить, что агент реально применяет профильный
   навык (Slovena→.docx и т.п.), прописать навыки в промптах.
6. **«Живая компания» (P1–P5)** — отделы, проекты, оргструктура, авто-найм, авто-команды,
   симуляция (см. `agent-os/docs/LIVING_ORG.md`).
7. **Системные обновления** RU-сервера (`apt upgrade && reboot`, стек поднимется сам).
8. Безопасность: сменить root-пароль RU-сервера (был засвечен в переписке), отключить вход
   по паролю по SSH.

---

## 7. Грабли (узнал на практике)

- **RU egress**: из РФ нет Anthropic/claude.ai → всё через релей `llm.work8n.ru`. Claude Code
  на RU-сервере тоже требует `ANTHROPIC_BASE_URL=https://llm.work8n.ru`.
- **GitHub runners** иногда копят очередь (много push'ей триггерят `ci.yml`) — деплой залипает
  в `queued`; лечится локальной сборкой (§3) или ожиданием/отменой и повторным запуском.
- **Кэш браузера/Browsec**: старый UI «прилипал» из-за прокси Browsec в Windows
  (`ERR_PROXY_CONNECTION_FAILED`). Сервер отдаёт `no-store`; бейдж версии в шапке — индикатор
  свежести. Тест: `/?fresh=N`, выключить Browsec/системный прокси Windows.
- **BullMQ**: Worker и Queue НЕ должны делить Redis-соединение.
- **Claude CLI**: `--max-turns 1` ломал tool-use (`error_max_turns`) → стоит 8. Стрим/ответ
  слишком долгий = много ходов + веб-поиск; для чата промпт просит отвечать коротко.
- `docker compose exec agentos` — образ `node:22-slim`: нет `ps`/`wget`/`curl`/`python3`, но
  `node` есть (используй его для проверок, напр. `node -e "require('http').get(...)"`).
- `curl -H "Host:" https://127.0.0.1` к Caddy даёт пусто (SNI) — используй
  `curl --resolve agent.work8n.ru:443:127.0.0.1`.

---

## 8. Команды-памятка (на RU-сервере, `/home/deploy/app`)

```bash
F=docker-compose.prod.yml
docker compose -f $F ps                                   # статус 5 контейнеров
docker compose -f $F exec -T agentos node prisma/seed.prod.cjs   # пересид команды (идемпотентно)
docker compose -f $F exec -T postgres psql -U app -d agent_os -c 'select status,count(*) from "Run" group by status;'
docker compose -f $F logs --tail=40 agentos               # логи agent-os
docker compose -f $F exec -T teamly node prisma/seed.prod.cjs    # создать вход teamly
```

**Боевой режим:** запусти Claude Code на US-боксе (`138.124.123.234`) под Max, склонируй ветку
`claude/inspiring-ride-OUkyL`, прочитай этот файл — и продолжай отсюда. Для доступа к Anthropic
с US-бокса релей не нужен (он и так видит api.anthropic.com); для команд на RU-сервере — SSH
`root@185.28.175.11`.
