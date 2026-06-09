# HANDOFF — состояние проекта для переезда в новый чат

Дата: 2026-06-06 · Ветка: `claude/inspiring-ride-OUkyL` · PR: **#1**
(`https://github.com/hauna7630-wq/Nastroyka-Claude/pull/1`).
Пуш в эту ветку обновляет PR #1 — отдельный PR создавать не нужно.

Вся работа закоммичена и запушена. Рабочее дерево чистое (кроме эфемерных
артефактов в `node_modules/`, `.next/` — они в `.gitignore`).

---

## Что лежит в репозитории

Репозиторий `hauna7630-wq/Nastroyka-Claude` содержит **три независимые вещи**:

1. **`agent-os/`** — мульти-тенант AI-agent runtime (control/execution/billing
   planes). Нишенезависимый. **Фазы F1–F6 готовы и проверены.**
2. **`teamly/`** — аналог teamly.to: корпоративная база знаний + вики + AI-поиск
   + LMS. Свежий full-stack (Next.js + Prisma/Postgres + TipTap + pgvector).
   **Модули T1–T3 готовы и проверены.**
3. Корневые `README.md` + `src/*.js` + `tests/*` — исходная заготовка «сайта
   турбазы» (к agent-os/teamly отношения не имеет; трогать не просили).

> agent-os и teamly — это **разные продукты**. teamly построен «с нуля» (НЕ на
> agent-os), но AI-функции teamly идейно переиспользуют паттерны agent-os
> (память/RAG/очередь). Прямой зависимости между ними нет.

---

## Статус: agent-os (F1–F6 — DONE)

Гексагональная архитектура (ports + adapters), in-memory адаптеры для тестов,
прод-адаптеры (Prisma/BullMQ/Anthropic/Docker) проверены вживую где возможно.

- **F1** ядро: Run state machine, идемпотентный ledger, DLQ.
- **F2** persistence+queue: Prisma/Postgres + BullMQ/Redis — **проверено на живой
  инфре** (`agent-os/tests/integration/persistence.int.test.ts`).
- **F3** sandbox для `code_exec`: `unshare --net` + `prlimit` — **проверено вживую**
  (сеть запрещена, лимиты памяти/времени) + DockerSandbox (compile-only).
- **F4** control plane: API + SSE события + observability + Stripe (идемпотентные
  гранты).
- **F5** память агентов: recall в промпт + episodic write-back (лексический recall;
  векторный — прод-замена за портом).
- **F6** авто-оркестратор: декомпозиция задачи на типизированных агентов, идемпотентно
  при ретраях.

Тесты: `cd agent-os && npm test` (≈37, без инфры). Интеграция:
`DATABASE_URL=... REDIS_URL=... npm run test:integration`; sandbox-тесты:
`SANDBOX_E2E=1 npm run test:integration`.

Также есть **standalone git-bundle** `agent-os` (отдавался пользователю файлом) —
если нужно вынести agent-os в отдельный репозиторий: `git subtree split -P
agent-os -b agent-os-main` → `git bundle`.

## Статус: teamly (T1–T3 — DONE)

- **T1** база знаний + вики: Org→Workspace→Space→дерево Page→PageVersion, RBAC,
  TipTap-редактор с автосейвом + версии, комментарии, FTS-поиск (Postgres tsvector).
- **T2** AI/RAG: pgvector (HNSW cosine), чанкинг+эмбеддинг на сохранении, grounded
  ответы с цитатами, **отказ при низкой релевантности (no hallucination)**, ретрив
  scoped по space (no leaks). Порты Embedder/ChatModel: оффлайн `HashEmbedder` +
  `ExtractiveChatModel` по умолчанию; `OpenAIEmbedder`/`AnthropicChatModel` при ключах.
- **T3** LMS: курсы из базы знаний (`generateCourseFromSpace`), модули/уроки/тесты,
  записи (enrollment), прогресс, авто-завершение курса. Grading + progress — чистые
  функции (юнит-тесты).

Тесты: `cd teamly && npm test` (28, без инфры). Интеграция:
`DATABASE_URL=... npm run test:integration` (12, на живом Postgres+pgvector).
Сборка: `npm run build` (11 роутов).

---

## Как поднять инфраструктуру в НОВОМ (эфемерном) контейнере

Контейнер пересоздаётся — Postgres/Redis/pgvector нужно поднять заново.

```bash
# Postgres (кластер 16 уже установлен в образе)
pg_ctlcluster 16 main start

# pgvector (нужен teamly T2). Если расширение отсутствует:
apt-get install -y postgresql-16-pgvector   # игнорировать предупреждение PHP-PPA

# Роли/БД
su postgres -c "psql -p 5432 -c \"CREATE ROLE teamly LOGIN PASSWORD 'teamly' SUPERUSER;\""
su postgres -c "psql -p 5432 -c 'CREATE DATABASE teamly OWNER teamly;'"
su postgres -c "psql -p 5432 -c \"CREATE ROLE agentos LOGIN PASSWORD 'agentos' SUPERUSER;\""
su postgres -c "psql -p 5432 -c 'CREATE DATABASE agent_os OWNER agentos;'"

# Redis (нужен agent-os F2)
redis-server --port 6379 --daemonize yes

# teamly: применить миграции, сгенерировать клиент, посеять демо
cd teamly
export DATABASE_URL="postgresql://teamly:teamly@localhost:5432/teamly"
npx prisma generate && npx prisma migrate deploy
npm run db:seed       # owner@acme.test / secret123
npm run db:reindex    # построить векторный индекс по сид-страницам (T2)

# agent-os: миграции
cd ../agent-os
export DATABASE_URL="postgresql://agentos:agentos@localhost:5432/agent_os"
npx prisma generate && npx prisma migrate deploy
```

Замечания по окружению:
- `npm` доступен; **Docker registry заблокирован** (образы не тянутся) — поэтому
  agent-os DockerSandbox и teamly через docker-compose локально не запускались;
  использовались нативные Postgres/Redis и `unshare`-sandbox.
- `prisma migrate dev` **интерактивный и падает** в этом окружении — использовать
  `prisma migrate deploy` (миграции уже в репозитории).
- Запуск Next в фоне: следить за занятым портом 3001 (старые `next-server` могли
  висеть → отдавать 404 на новые роуты). Перед smoke убивать процессы и брать
  свободный порт.

---

## Незакрытые хвосты / следующие шаги

- ✅ **teamly T3 runtime-smoke** — закрыто: на чистом порту все 4 LMS-роута отдают
  200 с реальными данными (список курсов, модули/уроки, материал урока, тест с
  гейтингом по записи). Прежний 404 был из-за залипшего сервера на :3001.
- ✅ **Деплой-обвязка** — добавлено: `teamly/Dockerfile` (Next standalone, проверен
  `next build`→`.next/standalone`), `agent-os/Dockerfile` (tsc→dist), и
  `.github/workflows/ci.yml` (unit+integration для обоих, service-контейнеры
  Postgres/pgvector/Redis). **CI не прогонялся на раннере** (здесь нет Actions и
  заблокирован registry), но все команды совпадают с локально проверенными. Образы
  локально не собирались (registry заблокирован).
  Дальше: реальный билд образов в CI/registry, секреты (ANTHROPIC/OPENAI/STRIPE),
  init-контейнер с `prisma migrate deploy`, деплой-таргет (Fly/Railway/K8s).
- **teamly прод-AI**: по умолчанию оффлайн HashEmbedder (лексика). Для настоящей
  семантики — `OPENAI_API_KEY` (или другой эмбеддер) + миграция размерности вектора
  (сейчас `vector(256)`).
- **teamly со-редактирование в реальном времени** (Yjs) — отложено осознанно.
- Возможные дальнейшие модули teamly: умные таблицы, права на уровне страниц,
  AI-генерация самих вопросов теста (через ChatModel-порт).

## Карта ключевых файлов

- agent-os: `src/index.ts` (composition root), `src/ports/*`, `src/adapters/*`,
  `src/agent/runtime.ts`, `src/orchestrator/*`, `docs/SPEC.md`, `docs/ARCHITECTURE.md`.
- teamly: `prisma/schema.prisma`, `src/lib/services/*` (pages, search, rag, indexing,
  courses, enrollment), `src/lib/ai/*` (порты+адаптеры), `src/lib/lms/*` (grade,
  progress), `src/app/**` (Next.js роуты), `README.md`.

## Git / PR

- Все коммиты на `claude/inspiring-ride-OUkyL`, запушены. PR **#1** открыт.
- Последние коммиты: T1, T2, T3 (teamly) поверх F1–F6 (agent-os).
- Для продолжения в новом чате: работать на этой же ветке, пуш обновляет PR #1.
