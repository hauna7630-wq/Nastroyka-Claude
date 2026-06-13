# 04 — Database Schema Design

PostgreSQL (+ extension `vector`). Источник: `prisma/schema.prisma`,
миграции — plain SQL в `prisma/migrations/` (5 шт.), применяются на старте
контейнера (`prisma migrate deploy`).

## Модели и ключевые решения

| Модель | Назначение | Ключевые поля / инварианты |
|---|---|---|
| Org | корень изоляции | все строки висят на orgId, FK cascade |
| Agent | цифровой сотрудник | type (enum), allowedTools[], currentVersionId |
| PromptVersion | версионирование промптов | unique(agentId, version); откат = переключение указателя |
| Run | единица работы | status (enum FSM), input/output Json, attempts, parentRunId (self-FK — дерево оркестрации) |
| Step | след исполнения | unique(runId, index) — ретраи апсертят, не дублируют; tokensIn/Out, latencyMs; шаг 0 хранит превью промпта |
| AgentMemory | память | kind (short_term/long_term/episodic), embedding vector(256) + hnsw cosine index |
| ChatMessage | тред диалога | unique(runId, role) — идемпотентный backfill ответа; index (orgId, agentId, createdAt) |
| DeadLetter | надёжность | requeuedAt — мягкая пометка вместо удаления |
| AuditLog | иммутабельный журнал | actor/action/meta Json, index (orgId, createdAt) |

## Почему реляционка, а не event sourcing / документы
След исполнения — это и есть журнал событий (Run+Step+AuditLog), с FK-целостностью
и простыми запросами для UI. Json-колонки (input/output/meta) дают гибкость
документной модели там, где схема переменная. Отдельный event store дал бы
дублирование без новых гарантий на текущем масштабе.

## Эволюция
Смена эмбеддера → миграция размерности `vector(N)` + пересчёт; шардинг по Org —
естественная граница, если перерастём один Postgres.
