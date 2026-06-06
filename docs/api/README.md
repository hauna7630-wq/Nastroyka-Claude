# 🔌 Справочник API

Описание публичных функций модулей из каталога `src/`. Все модули используют CommonJS: `const { ... } = require('./src/<модуль>')`.

---

## `src/config.js`

Сборка конфигурации.

### `defaults`
Объект значений по умолчанию: `{ timeout: 5000, retries: 3, baseUrl: 'https://api.example.com', pageSize: 20 }`.

### `buildConfig(overrides = {})`
Возвращает новый объект конфигурации, объединяя `defaults` с `overrides` (приоритет у `overrides`).

```js
buildConfig({ timeout: 10000 });
// { timeout: 10000, retries: 3, baseUrl: '...', pageSize: 20 }
```

Подробнее — в [конфигурации](../getting-started/configuration.md).

---

## `src/api.js`

Работа с пользователями, кэш и пагинация.

### `getUser(id)` → `Promise<User>`
Возвращает пользователя `{ id, name, createdAt }`. Результат кэшируется в `Map`: повторный вызов с тем же `id` не делает «запрос», а отдаёт значение из кэша.

```js
const user = await getUser(42); // { id: 42, name: 'User_42', createdAt: <ts> }
```

### `clearCache()` → `void`
Полностью очищает кэш пользователей. Полезно в тестах (`beforeEach`).

### `paginate(items, page, perPage)` → `Array`
Возвращает срез массива `items` для страницы `page` (нумерация с 1) по `perPage` элементов.

```js
paginate([1, 2, 3, 4, 5], 2, 2); // [3, 4]
```

---

## `src/queue.js`

Очередь задач, счётчики и асинхронные хелперы.

### `class TaskQueue`
| Метод | Описание |
|-------|----------|
| `add(fn)` | Добавляет функцию-задачу (возвращающую промис) в очередь |
| `run()` → `Promise<Array>` | Запускает все задачи параллельно (`Promise.all`), сохраняет и возвращает результаты, очищает очередь |
| `getResults()` → `Array` | Возвращает накопленные результаты всех прогонов |

```js
const q = new TaskQueue();
q.add(async () => 1);
q.add(async () => 2);
await q.run(); // [1, 2]
```

### `incrementCounter()` → `number`
Увеличивает глобальный счётчик на 1 и возвращает новое значение.

### `getCounter()` → `number`
Возвращает текущее значение счётчика.

### `resetCounter()` → `void`
Сбрасывает счётчик в 0. Полезно в тестах.

### `randomDelay(min, max)` → `Promise<void>`
Промис, который разрешается через случайное время между `min` и `max` мс.

### `fetchSequential(ids)` → `Promise<Array<{ id, value }>>`
Последовательно обрабатывает массив `ids`, для каждого возвращает `{ id, value: id * 2 }`.

---

## `src/utils.js`

Утилиты общего назначения.

### `formatDate(date)` → `string`
Форматирует `Date` в строку `YYYY-MM-DD`.

```js
formatDate(new Date('2026-06-06')); // '2026-06-06'
```

### `sum(a, b)` → `number`
Сумма двух чисел.

### `fetchWithTimeout(url, timeout = 3000)` → `Promise<Response>`
Выполняет `fetch(url)` с таймаутом: если ответ не пришёл за `timeout` мс — промис отклоняется с ошибкой `Timeout`.

### `sortByField(arr, field)` → `Array`
Возвращает **новый** отсортированный массив объектов по значению поля `field` (не мутирует исходный).

```js
sortByField([{ n: 2 }, { n: 1 }], 'n'); // [{ n: 1 }, { n: 2 }]
```

### `debounce(fn, delay)` → `Function`
Возвращает «отложенную» версию `fn`: вызов откладывается на `delay` мс и сбрасывается при новых вызовах.
