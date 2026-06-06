# 🌿 Работа с git и ветками

## Модель ветвления

- `main` — стабильная ветка. Прямые пуши не приветствуются; изменения попадают через Pull Request.
- **Рабочие ветки** создаются от `main` под конкретную задачу.

## Именование веток

```
<тип>/<краткое-описание>
```

Примеры:

```
feat/user-pagination
fix/fetch-timeout-leak
docs/api-reference
```

## Типовой цикл

```bash
# 1. Обновить main
git checkout main
git pull origin main

# 2. Создать рабочую ветку
git checkout -b feat/моя-задача

# 3. Внести изменения, затем зафиксировать
git add .
git commit -m "feat: краткое описание"

# 4. Отправить ветку на сервер
git push -u origin feat/моя-задача

# 5. Открыть Pull Request в main
```

## Сообщения коммитов

Формат [Conventional Commits](https://www.conventionalcommits.org/ru/) — см. [CONTRIBUTING](./CONTRIBUTING.md#сообщения-коммитов).

## Поддержание ветки в актуальном состоянии

Если `main` ушёл вперёд, подтяните изменения в свою ветку:

```bash
git checkout feat/моя-задача
git fetch origin
git rebase origin/main      # или git merge origin/main
```

## Хорошие практики

- Делайте **атомарные** коммиты: один коммит — одно логическое изменение.
- Не коммитьте `node_modules/`, секреты, временные файлы (проверяется `.gitignore`).
- Перед пушем прогоняйте `npm test`.
- Держите PR небольшими — их проще ревьюить.

## Дальше

→ [FAQ](../reference/faq.md)
