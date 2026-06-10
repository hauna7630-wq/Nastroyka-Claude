# 06 — Agent Runtime Specification

## Идентичность и состояние (реализовано)
Агент: id, type, системный промпт (активная PromptVersion), allowedTools,
память (AgentMemory). Состояние исполнения живёт на Run (FSM), а не на агенте —
агент может вести несколько run'ов; UI-статусы офиса (idle/working/done/failed)
— производная от событий run'ов.

## Жизненный цикл Run (FSM, реализовано)
```
queued ──> running ──> succeeded
   │          │──────> failed      (терминал ставит ТОЛЬКО воркер: ретраи/DLQ)
   │          │──────> paused      (HITL: лимит итераций)
   └────────> canceled
```
Переходы — только через `transition()`; нелегальный — исключение. Повторная
доставка терминального run — no-op (идемпотентность доставки).

## Цикл исполнения (executeRun)
1. recall памяти (long_term+episodic, top-5) → в системный промпт;
2. вызов модели (порт ModelProvider; провайдеры: Claude CLI по подписке,
   Anthropic API, Offline-заглушка);
3. tool-calls: проверка allowlist агента → реестр инструментов → шаг в БД;
4. финальный текст: guard от пустого/«…» (fail, не success); запись episodic;
5. шаг 0 несёт превью собранного промпта (Debug-режим).

## Надёжность
Ретраи: бюджет на Run (attempts), исчерпание → `failed` + DeadLetter + события.
Восстановление: `POST /runs/:id/retry` (валидирует failed, сбрасывает бюджет,
тот же runId — ответ чата доклеится к тому же сообщению). Конкурентность:
воркер BullMQ conc=4; долгий LLM-вызов не блокирует очередь и не «stalled»
(lock 10m).

## Диспетчеризация
`dispatchRun`: оркестратор-тип → executeOrchestration; `input.chat===true` —
всегда прямой executeRun (диалог с персоной).
