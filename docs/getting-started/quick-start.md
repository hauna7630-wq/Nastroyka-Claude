# ⚡ Быстрый старт

Этот гайд проведёт от чистого клона до первого запуска кода за несколько минут. Если ещё не установили зависимости — сначала [Установка](./installation.md).

## 1. Запустите тесты

```bash
npm test
```

Тесты используют [Jest](https://jestjs.io/). Подробнее — в [руководстве по тестированию](../guides/testing.md).

## 2. Используйте модули проекта

Код находится в каталоге `src/`. Модули экспортируются через CommonJS (`require`). Примеры:

### Конфигурация

```js
const { buildConfig } = require('./src/config');

const config = buildConfig({ timeout: 10000 });
console.log(config);
// { timeout: 10000, retries: 3, baseUrl: 'https://api.example.com', pageSize: 20 }
```

### Работа с пользователями (с кэшем)

```js
const { getUser, paginate } = require('./src/api');

(async () => {
  const user = await getUser(42);
  console.log(user); // { id: 42, name: 'User_42', createdAt: <timestamp> }

  const page = paginate([1, 2, 3, 4, 5], 1, 2);
  console.log(page); // [1, 2]
})();
```

### Очередь задач

```js
const { TaskQueue } = require('./src/queue');

(async () => {
  const queue = new TaskQueue();
  queue.add(async () => 1);
  queue.add(async () => 2);
  const results = await queue.run();
  console.log(results); // [1, 2]
})();
```

### Утилиты

```js
const { formatDate, sum, sortByField } = require('./src/utils');

console.log(formatDate(new Date('2026-06-06'))); // '2026-06-06'
console.log(sum(2, 3));                          // 5
console.log(sortByField([{ n: 2 }, { n: 1 }], 'n')); // [{ n: 1 }, { n: 2 }]
```

## 3. Что дальше

- 🔌 Полный список функций — в [справочнике API](../api/README.md).
- 🛠 Как устроена разработка — в [руководстве по разработке](../guides/development.md).
- ⚙️ Настройка параметров — в [конфигурации](./configuration.md).
