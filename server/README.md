# server — Backend API (Express, CommonJS)

REST API турбазы: бронирование, домики/номера, заявки, авторизация админки.
Стиль кода — CommonJS (`require`/`module.exports`), как в корневом `src/`.

## Структура
- `src/server.js`     — точка входа, запуск HTTP-сервера
- `src/app.js`        — сборка Express-приложения (middleware, роуты)
- `src/routes/`       — определение маршрутов (URL → controller)
- `src/controllers/`  — обработчики запросов, бизнес-логика входа
- `src/services/`     — доменная логика (бронирование, домики, кэш)
- `src/middleware/`   — auth, обработка ошибок, логирование
- `src/models/`       — модели данных (Booking, Cottage, User)
- `src/config/`       — конфигурация (порт, БД, секреты из .env)
- `src/utils/`        — вспомогательные функции
