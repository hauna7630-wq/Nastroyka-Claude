# 02 — System Design Document

Полная схема потоков и компонентов — SYSTEM_DESIGN §4. Здесь — решения и
trade-offs по компонентам.

## API Layer
Zero-deps Node http (`src/api/server.ts`) — тонкий адаптер над
framework-agnostic `ControlPlane` (вся логика + юнит-тесты там).
Trade-off: ручной роутинг (ловушка: маршрут `/orgs/:id/agents` матчится без
проверки длины — новые `:agentId/...`-маршруты регистрируются ВЫШЕ; задокументировано
в коде). Выигрыш: нет зависимостей, мгновенный старт, простая поверхность атак.

## Agent Runtime Engine
`src/agent/runtime.ts` — tool-use цикл: recall памяти → модель → инструменты →
шаги в БД → терминал через FSM. Бюджеты: 5 итераций (HITL), 3 попытки (DLQ).

## Event Bus
Redis pub/sub (`adapters/events.redis.ts`): канал на run + wildcard psubscribe;
наружу SSE. Принцип: события — для живости UI, НЕ для корректности (см. §7
мастера: lazy-backfill).

## Task Scheduler / Queue
BullMQ: conc=4, lock=10m, removeOnComplete/Fail; бюджет попыток на Run.
Альтернативы (NATS JetStream/Kafka) отклонены для одного хоста: лишняя инфра.

## Memory System
pgvector в той же Postgres: один бэкап, одна транзакционная граница.
Qdrant/Weaviate — при >10⁵ векторов или горизонтальном шардинге.

## Tool Execution Layer
Реестр с JSON-схемами (`tools/registry.ts`); security-границы на инструмент:
allowlist доменов (http), subprocess-sandbox c rlimits (code_exec), парсер
файлов с контрактом честности.

## Persistence
Prisma/Postgres — см. 04-database.md.

## Observability Stack
Сейчас: AuditLog + Step-трейс + журналы UI (см. 0-наблюдаемость в мастере).
Далее: OTel SDK в runtime (span на итерацию/инструмент), Prometheus exporter.

## Frontend
SPA в одном template literal, string-concat JS (CSP-дружелюбно, нулевая
сборка). Trade-off: нет JSX/типизации UI; проверка «0 backticks/${}» — часть
ритуала каждого деплоя. Полноэкранный layout, canvas пересоздаётся на resize.
