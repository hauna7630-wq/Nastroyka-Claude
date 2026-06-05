# CLAUDE.md

> Главная инструкция для Claude по этому репозиторию. Это **самоподдерживаемый**
> документ: я (Claude) обновляю его сам по мере изменений в проекте.
> Правила сопровождения — в разделе [«Как я поддерживаю этот файл»](#как-я-поддерживаю-этот-файл).
>
> Последнее обновление: 2026-06-05 (добавлен каркас server/web/admin)

---

## О проекте

- **Имя:** `nastroyka-claude`
- **Описание:** sait turbazy (сайт турбазы) — на текущем этапе это учебный/
  демонстрационный Node.js-пакет с набором утилит и тестов.
- **Язык/рантайм:** JavaScript (CommonJS, `require`/`module.exports`), Node.js.
- **Тест-раннер:** Jest (v30). CI прогоняет на Node 18.x и 20.x.
- **Удалённый репозиторий:** `hauna7630-wq/Nastroyka-Claude`.

## Структура

Репозиторий — монорепозиторий с тремя приложениями (`server/`, `web/`, `admin/`)
плюс учебные утилиты в корневых `src/`/`tests/`. Подробности — `docs/ARCHITECTURE.md`.

```
server/                — Backend API (Express, CommonJS)
  src/
    server.js, app.js          — точка входа и сборка приложения
    routes/                    — index, bookings, cottages, auth, admin
    controllers/               — bookings/cottages/auth
    services/                  — bookingService, cottageService
    middleware/                — auth, errorHandler
    models/                    — Booking, Cottage, User
    config/, utils/
  tests/

web/                   — Публичный сайт (React/Next.js)
  pages/               — index, about, cottages, prices, booking, gallery, contacts
  components/          — Header, Footer, CottageCard, BookingForm
  styles/              — globals.css, theme.css
  public/              — images/, fonts/
  lib/api.js           — клиент к backend
  tests/

admin/                 — Профессиональная админ-панель (React)
  src/
    pages/             — Dashboard, Bookings, Cottages, Clients, Settings
    components/         — Sidebar, Topbar, DataTable
    layouts/AdminLayout, hooks/useAuth
    api/               — client, auth
    styles/admin.css
  tests/

docs/ARCHITECTURE.md   — схема монорепозитория и связей

src/                   — УЧЕБНЫЕ утилиты (не продакшен-сайт)
  api.js      — getUser (с in-memory кэшем), clearCache, paginate
  config.js   — buildConfig (merge defaults + overrides), defaults
  queue.js    — TaskQueue, глобальный counter, randomDelay, fetchSequential
  utils.js    — formatDate, sum, fetchWithTimeout, sortByField, debounce
tests/
  api.test.js, config.test.js, utils.test.js
  flaky.test.js   — НАМЕРЕННО нестабильные тесты (см. ниже)
.github/workflows/test.yml — CI: матрица Node 18/20, npm ci, jest + jest-junit, артефакты в reports/
```

> Текущий каркас `server/`/`web/`/`admin/` — это **стаб-файлы** (заголовки-комментарии
> о назначении), наполнение кодом и сборка (package.json, бандлер) — следующие шаги.
> Корневой CI пока прогоняет только `tests/` (Jest над `src/`).

## Команды

```bash
npm ci            # установка зависимостей (использовать в CI и для чистой установки)
npm test          # запуск всех тестов (jest)
npm run test:ci   # jest --ci --coverage
npx jest tests/utils.test.js   # запуск одного файла
npx jest -t "buildConfig"      # запуск тестов по имени
```

## Соглашения по коду

- **Модули:** CommonJS (`const x = require(...)`, `module.exports = { ... }`).
  Не смешивать с ESM `import`/`export`.
- **Стиль:** 2 пробела отступ, точки с запятой, одинарные кавычки.
- **Экспорт:** именованный — объект в `module.exports`.
- **Тесты:** `describe`/`test`, рядом с покрываемым модулем по имени файла
  (`src/foo.js` → `tests/foo.test.js`). Для таймеров предпочтительны fake timers
  (`jest.useFakeTimers()`, `jest.advanceTimersByTime`), а не реальный `setTimeout`.
- **Состояние между тестами:** сбрасывать в `beforeEach` (например `clearCache()`).
  Не полагаться на порядок выполнения тестов и общий глобальный стейт.

## Известные особенности / подводные камни

- **`tests/flaky.test.js` нестабилен НАМЕРЕННО** — это демонстрация паттернов
  флаки-тестов (race condition без `await`, общий глобальный counter без сброса,
  тайминги на реальном `setTimeout`, `Math.random()`, зависимость от порядка).
  Если CI «краснеет» из-за этого файла — это ожидаемо, а не регрессия.
  **Не «чинить» эти тесты молча**: сначала уточнить, нужна ли демонстрация флаки
  или их стабилизация. Рядом с каждым флаки-кейсом есть стабильный аналог-образец.
- `src/queue.js` хранит модульный `globalCounter` — глобальное состояние,
  переживающее тесты в рамках одного файла.
- `src/api.js` хранит модульный `cache` (Map) — сбрасывается через `clearCache()`.
- `utils.fetchWithTimeout` использует глобальный `fetch` (Node ≥18).

## CI

- Триггеры: `push` в `main` и `pull_request` в `main`.
- Шаги: checkout → setup-node (cache npm) → `npm ci` →
  `npm test -- --ci --reporters=default --reporters=jest-junit` → upload `reports/`.
- JUnit-отчёты: `reports/junit-<node-version>.xml`.
- При падении CI: сначала отделить намеренный флаки (`flaky.test.js`) от реальных
  регрессий; флаки можно пере-запускать, реальные падения — воспроизводить и чинить
  минимальным фиксом.

## Рабочий процесс (git)

- **Ветка разработки:** `claude/serene-lamport-hogPy` (вести всю работу здесь).
- Коммиты — осмысленные, по сути изменения.
- Пуш: `git push -u origin <branch>`; PR — **только** по явной просьбе пользователя.
- Перед пушем проверять, не было ли чужих коммитов в ветке; при расхождении —
  `rebase`, не `merge`.

---

## Как я поддерживаю этот файл

Этот файл — живой. Я (Claude) обновляю его **сам**, без отдельной просьбы, когда
по ходу работы меняется что-то из перечисленного ниже. Цель — чтобы документ
всегда отражал актуальное состояние репозитория.

**Обновлять при:**
- появлении/удалении/переименовании модулей в `src/` или тестов в `tests/`;
- изменении команд (`scripts` в `package.json`), зависимостей, версии Node;
- изменении CI-воркфлоу (`.github/workflows/`);
- смене соглашений по коду/стилю;
- обнаружении нового подводного камня или известной проблемы;
- смене ветки разработки или процесса git.

**Правила обновления:**
1. Менять только релевантный раздел, не переписывать весь файл без необходимости.
2. Обновлять дату в шапке («Последнее обновление») при каждом изменении.
3. Держать формулировки короткими и фактическими — без воды.
4. Существенные изменения кратко фиксировать в «Журнале изменений» ниже.
5. Если факт устарел — удалять/исправлять его, а не накапливать противоречия.

### Журнал изменений

- **2026-06-05** — создан CLAUDE.md: первичное описание структуры, команд,
  соглашений, CI и пометка про намеренно флаки-тесты в `tests/flaky.test.js`.
- **2026-06-05** — добавлен каркас монорепозитория: `server/` (Express API),
  `web/` (публичный сайт), `admin/` (админ-панель), `docs/ARCHITECTURE.md`.
  Пока стаб-файлы; корневые `src/`/`tests/` не тронуты.
