# Model Guide — Nano Banana & ChatGPT Image

> Технические детали обеих моделей. Основные правила и различия — в SKILL.md §2а. Этот файл для глубоких случаев.

---

## NANO BANANA PRO & 2

### Версии
- **Pro** (Gemini 2.5 Flash Image) — лучший реализм, свет, генерированные персонажи, сложная типографика EN
- **2** — скорость и объём: 20+ вариантов, сториборд, быстрые итерации, дешевле

### Критичные правила
- **Связный текст** — Gemini читает смысл, не ключевые слова. Нарративная проза всегда лучше тегов.
- **Текст в кадре — без кавычек и скобок.** Модель рендерит их буквально как символы.
  - ❌ `text: "ВАШ ЗАГОЛОВОК"` / `add text {ЛЕТНЯЯ РАСПРОДАЖА}`
  - ✅ `bold white sans-serif text ВАШ ЗАГОЛОВОК at top center`
  - Русский текст — отдельной финальной строкой: `add Russian text: ВАШ ТЕКСТ`
- **Никаких отрицаний** — `empty street` вместо `no cars`
- **Никаких противоречий** — один промпт = одна согласованная сцена

### Убийцы реализма (Nano Banana)
`masterpiece`, `ultra detailed`, `cinematic` (без camera spec), `8K resolution`, `hyperrealistic`, `perfect`, `stunning` — уводят в art-стиль или дают plastic overdrive.

### Управление светом
```
single soft softbox from camera left, 3200K warm tungsten
overcast daylight, diffused natural fill, no harsh shadows
golden hour rim light from behind, f/1.4, warm bokeh
```

### Character consistency (генерированные персонажи)
1. Сгенерируй базового персонажа с полным DNA-описанием (Pro)
2. Лучший кадр — reference anchor
3. Для новых сцен: `using the same character from the reference image, keep facial features, hairstyle, outfit identical`
4. До 14 ref-изображений. 6–8 сильных > 14 слабых.
5. При дрейфе — перезагрузи оригинальный anchor, ужесточи формулировку

### Editing (Nano Banana)
```
Make the background more blurred, add sunlight from left, increase contrast slightly.
Do not touch the face or outfit.
```

### Thinking Mode
Для сложных сцен (несколько персонажей, точный текст, сложный свет): `use extended thinking for this generation`

---

## CHATGPT IMAGE (gpt-image-2)

### Ключевые преимущества
- Лучший рендер русского текста из всех моделей
- Лучшее сохранение идентичности при загрузке реального фото
- Сильное редактирование загруженных изображений

### Структура промпта
OpenAI рекомендует блочный формат для сложных задач:
```
[СЦЕНА/ФОН] → [ОБЪЕКТ/СУБЪЕКТ] → [ДЕТАЛИ] → [ОГРАНИЧЕНИЯ]

A minimalist white studio background →
skincare serum bottle, centered →
soft diffuse lighting, subtle contact shadow, crisp label →
no watermarks, no logos, photorealistic
```
Простые задачи — обычная проза работает так же хорошо.

### Текст в кадре — русский баннер
```
Create a [banner / poster] for [бренд/продукт].
Background: [описание].

Include ONLY this text (verbatim, in Russian Cyrillic, no Latin substitutions, no extra characters):
Headline: "ЗАГОЛОВОК"
Subline: "Подзаголовок"
CTA: "КНОПКА"

Typography: bold sans-serif, headline large, subline medium, CTA button-style.
Text placement: [centered / top-left / bottom-right].
Colors: [фон], [цвет текста], high contrast for readability.
No watermarks, no additional text.
Quality: high.
```

| Проблема | Фикс |
|---|---|
| Кириллица → латиница | `Russian Cyrillic only, no Latin substitutions` |
| Лишние слова | `verbatim, no extra characters` |
| Буквы смазаны | `quality: high` всегда с текстом |
| Сложное слово сломано | Писать по буквам: `"А-В-Т-О-С-Е-Р-В-И-С"` |

### Лицо из своего фото → новая сцена
Это главная сила ChatGPT Image. Загружай фото + пиши:
```
Use the uploaded image as base. Match all physical traits: face, skin tone, hair, proportions — 1:1, no changes.
[описание новой сцены]
```
API: добавь `input_fidelity="high"`.

### Character Anchor (серия с одним персонажем)
1. Генерируй сильный reference-кадр
2. На каждый следующий кадр: загружай reference + `keep all character features identical to the reference image`
3. При дрейфе — снова загружай оригинал

### Редактирование загруженного изображения
```
Edit the image: [что изменить].
Do NOT change: [всё что сохранить — лицо, поза, свет, фон, кадрирование].
Match lighting and color temperature to the original.
```

### Деградация сессии
Модель ухудшается через 5–6 генераций в одном чате. Открывай новый чат для новой задачи.

### Слова, которые у ChatGPT Image работают (в отличие от Nano Banana)
`8K ultra-realistic`, `cinematic`, `ultra detailed` — работают нормально. Но физические дескрипторы всё равно точнее.

---

## БЫСТРЫЙ ВЫБОР МОДЕЛИ

| Задача | Модель |
|---|---|
| Лицо из своего фото | **ChatGPT Image** |
| Русский текст в кадре | **ChatGPT Image** |
| Реализм, кожа, свет | **Nano Banana Pro** |
| Много вариантов быстро | **Nano Banana 2** |
| Редактирование фото | **ChatGPT Image** |
| Сториборд серия | **Nano Banana 2** |
| Премиум/luxury с контролем света | **Nano Banana Pro** |
