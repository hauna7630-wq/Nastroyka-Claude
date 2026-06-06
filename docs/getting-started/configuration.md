# ⚙️ Конфигурация

Конфигурация проекта собирается через модуль [`src/config.js`](../../src/config.js).

## Значения по умолчанию

```js
const defaults = {
  timeout: 5000,                      // таймаут запроса, мс
  retries: 3,                         // число повторных попыток
  baseUrl: 'https://api.example.com', // базовый адрес API
  pageSize: 20,                       // размер страницы по умолчанию
};
```

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `timeout` | number | `5000` | Таймаут операции в миллисекундах |
| `retries` | number | `3` | Количество повторов при ошибке |
| `baseUrl` | string | `https://api.example.com` | Базовый URL внешнего API |
| `pageSize` | number | `20` | Размер страницы для пагинации |

## Переопределение параметров

Функция `buildConfig(overrides)` объединяет значения по умолчанию с переданными:

```js
const { buildConfig } = require('./src/config');

const config = buildConfig({ timeout: 10000, pageSize: 50 });
// {
//   timeout: 10000,
//   retries: 3,
//   baseUrl: 'https://api.example.com',
//   pageSize: 50,
// }
```

Переданные значения имеют приоритет над значениями по умолчанию. Остальные параметры остаются без изменений.

## Рекомендация: значения из переменных окружения

Чтобы не хранить настройки в коде, считывайте их из `process.env` и передавайте в `buildConfig`:

```js
const { buildConfig } = require('./src/config');

const config = buildConfig({
  timeout: process.env.TIMEOUT ? Number(process.env.TIMEOUT) : undefined,
  baseUrl: process.env.API_BASE_URL,
});
```

> Не коммитьте секреты (токены, пароли) в репозиторий. Храните их в переменных окружения или в `.env`-файле, добавленном в `.gitignore`.

## Дальше

→ [Руководство по разработке](../guides/development.md)
