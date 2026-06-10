# 05 — Event Model Specification

## Типы событий (реализовано)

| Событие | Эмитент | Payload |
|---|---|---|
| run.started | runtime | attempt |
| step.appended | runtime | index, role, toolName?, tokensIn/Out |
| run.succeeded | runtime/orchestrator | tokensIn/Out или subtasks |
| run.failed | worker | reason |
| run.dead_lettered | worker | attempts, reason |
| run.needs_human | runtime | maxIterations |
| orchestration.planned | orchestrator | orchestrated, subtasks[{id, agentType}] |
| orchestration.subtask | orchestrator | subtaskId, agentType, agentName, status |

## Поток
runtime/worker → `EventBus.publish` → Redis pub/sub (канал `agentos:run:<id>`,
wildcard `agentos:run:*`) → подписчики: SSE-эндпоинт (`/runs/:id/events`) → UI
(живой офис, граф сборки). InMemory-шина — для тестов, тот же контракт.

## Гарантии и принцип корректности
Pub/sub — at-most-once, без персиста. Поэтому **корректность не зависит от
доставки событий**: всё, что должно пережить рестарт, читается из Postgres
(Run/Step/ChatMessage/AuditLog). Примеры: ответ чата — lazy-backfill из
`Run.output` (unique(runId, role) снимает гонки); фазы задачи — производная
`deriveTeamPhase(parent, children)` от персистентных runs; «replay» = повторное
чтение БД, отдельный механизм не нужен.

## Упорядочивание
В пределах одного run события публикуются последовательно одним исполнителем;
кросс-run порядок не гарантируется и не требуется (UI группирует по runId).
