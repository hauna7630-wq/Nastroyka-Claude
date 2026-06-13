# ChatGPT Image / gpt-image-2: специфика

Глубокая справка по OpenAI gpt-image-2. Главное в SKILL.md, здесь нюансы.

---

## Архитектура и логика

GPT-image-2 — авторегрессивная модель на той же базе, что GPT-4o. Генерирует изображение токен за токеном, обрабатывая весь контекст разговора.

**Ключевой принцип:** модель понимает намерение, а не ключевые слова. Использует мировые знания (исторические события, культурные референсы — без подсказок).

**Порядок приоритетов при чтении промпта:**
1. Явные инструкции (что нарисовать / сохранить / изменить)
2. Контекст разговора (предыдущие изображения и запросы)
3. Мировые знания
4. Стилистические эвристики (`photorealistic` → активирует фотореализм)

---

## Универсальная структура промпта

OpenAI рекомендует:

```
[СЦЕНА/ФОН] → [ОБЪЕКТ/СУБЪЕКТ] → [ДЕТАЛИ] → [ОГРАНИЧЕНИЯ]
```

Пример:
```
A minimalist white studio background (Scene) →
skincare serum bottle, centered (Subject) →
soft diffuse lighting, subtle contact shadow, crisp label legibility (Details) →
no watermarks, no logos, photorealistic (Constraints)
```

Для сложных задач — короткие блоки с переносами строк, не один длинный абзац.

---

## Текст в кадре — ключевая сила модели

Главный плюс gpt-image-2: точный рендер текста, особенно русского. Но требует правильных инструкций.

### Правила для русского текста

1. **Текст в кавычках** — всегда: `"СКИДКА 50%"`
2. **Указать `verbatim, no extra characters`** — предотвращает галлюцинации букв
3. **Указать язык явно**: `render in Russian Cyrillic script, no Latin substitutions`
4. **Для плотного текста**: `quality: high` обязательно
5. **Сложные слова — по буквам**: `"А-В-Т-О-С-Е-Р-В-И-С"`

### Шаблон для русского баннера

```
Create a [type: advertising banner / poster / billboard] for [brand/product].
Background: [description].

Include ONLY this text (verbatim, in Russian Cyrillic, no Latin substitutions, no extra characters):
Headline: "ЗАГОЛОВОК"
Subline: "Подзаголовок текст"
CTA: "КНОПКА"

Typography: [bold sans-serif / serif], [size hierarchy: headline large, subline medium, CTA button-style].
Text placement: [centered / top-left / bottom-right].
Colors: [background], [text color], high contrast for readability.
No watermarks, no additional text.
Quality: high.
```

### Типичные ошибки с русским текстом

| Проблема | Причина | Фикс |
|---|---|---|
| Кириллица → латиница | Не указан язык | Добавить `Russian Cyrillic only, no Latin substitutions` |
| Модель добавляет лишние слова | Нет `verbatim` | Добавить `verbatim, no extra characters` |
| Буквы смазаны / нечитаемы | Низкое quality | Всегда `quality: high` для текста |
| Сломан сложный текст | Сложное слово | Писать по буквам: `"С-Л-О-Ж-Н-О-Е-С-Л-О-В-О"` |

---

## Фреймворки по типу задачи

### A. Создание с нуля

```
[Medium: photo/illustration/3D] of [Subject + key attributes].
[Scene/environment]. [Lighting: type, direction, quality].
[Lens/framing: close-up, wide, eye-level, 50mm].
[Mood/atmosphere]. [Constraints: no watermark, no text, etc.]
```

### B. Коммерческая реклама

```
Ad concept for [Brand name], targeting [audience].
Brand vibe: [adjectives]. Visual concept: [scene + people + action].
Tagline (exact, verbatim): "[TEXT]"
Typography: bold sans-serif, high contrast, centered, legible.
No extra text, no watermarks, no unrelated logos.
[Aspect ratio], quality: high.
```

### C. Продукт на белом фоне

```
Extract/place the product on a plain white opaque background.
Centered product, crisp silhouette, no halos/fringing.
Preserve product geometry and label legibility exactly.
Add only a subtle realistic contact shadow.
Do not restyle the product.
```

### D. Соцсети

```
[Platform]-ready [format: square/vertical/horizontal] visual.
[Subject]. [Style: candid/editorial/branded].
[Color palette]. [Mood]. Clean composition, no clutter.
[Text in image: "EXACT TEXT" — specify once, placement, font style].
No watermarks.
```

---

## Редактирование загруженных изображений

**Главный принцип:** явно разделяй «что менять» и «что сохранить». Повторяй invariants на каждом шаге.

### Замена фона

```
Replace the background with [new background description].
Keep EVERYTHING else unchanged: subject position, scale, lighting on subject,
shadows, color temperature, framing.
Match the new background lighting to the existing subject lighting.
Do not alter the subject in any way.
```

### Смена одежды (виртуальная примерка)

```
Edit the image to dress the person with [clothing description].
Do NOT change: face, facial features, skin tone, body shape, pose, hairstyle, expression, identity.
Replace ONLY the clothing. Fit garments naturally to existing pose with realistic fabric behavior.
Match lighting, shadows, and color temperature to original photo.
Do not change background, camera angle, framing.
No added accessories, text, logos, watermarks.
```

### Улучшение качества / лица

```
Enhance this photo by improving its overall quality.
Increase sharpness, clarity, and color vibrancy while reducing noise or blur.
Adjust lighting and contrast to make the image more visually appealing.
Keep the subject natural and realistic. Do not over-smooth or over-sharpen.
Preserve all facial features, identity, and composition exactly.
```

### Добавление объекта

```
Add [object description] to [specific location in image].
Match the perspective, scale, and lighting of existing scene.
Integrate naturally — consistent shadows, reflections if applicable.
Do not change anything else in the image.
```

### Удаление объекта

```
Remove [object] from [its location].
Reconstruct the background behind it naturally, matching surrounding textures and lighting.
Do not alter anything else in the image.
```

### Удаление людей

```
Remove all people from this image.
Reconstruct the background naturally where they stood, matching:
- surrounding textures, materials, colors
- lighting and shadows
- architectural/environmental details
Do not alter any other part of the image.
Result should look like an original photo taken without people.
```

Если людей много / фон сложный — итерации: сначала часть, потом уточнить.

### Добавление человека в сцену

```
Generate a highly realistic [scene type] where [person description from reference]
is [action + position in scene].
The image should look like a real photograph, not a cinematic or stylized render.
Match existing scene lighting: [describe light source, direction, color temperature].
Preserve person's exact facial features, identity, skin tone — use input_fidelity: high.
Everything should feel grounded, authentic, and unstyled.
Avoid cinematic color grading, dramatic lighting, or stylized composition.
```

Для API: `input_fidelity="high"` — это напрямую улучшает сохранение лица при масштабных изменениях сцены.

---

## Фотореализм и естественная кожа

Ключевое слово `photorealistic` напрямую активирует фотореалистичный режим.

### Формула для натурального фото

```
Create a photorealistic [candid/portrait/editorial] photograph of [subject].
[Subject details: age, appearance, clothing, action].
Shot on [35mm film / 50mm lens / 85mm portrait lens].
[Framing: medium close-up / full body].
[Lighting: soft coastal daylight / warm overhead / golden hour — natural, not studio].
Shallow depth of field, subtle [film grain / natural bokeh].
Visible skin texture: pores, fine lines, natural imperfections.
Real fabric textures, worn materials, everyday detail.
No glamorization, no heavy retouching, no plastic skin.
The image should feel honest and unposed.
```

### Что убивает реализм

- `8K ultra-HD` → перешарп, гладкая «ИИ-кожа»
- `perfect skin` → пластиковый эффект
- `studio lighting` на уличном фото → неестественно
- Слишком много деталей сцены без anchor-фраз `candid`, `unposed`, `honest`

---

## Консистентность персонажа: Character Anchor метод

Официальный workflow OpenAI.

### Шаг 1 — якорь

```
Create a [children's book / fashion / commercial] character.
[Detailed appearance: clothing, face, proportions, style].
Show character in neutral pose, plain background.
This will be reused as a visual reference for a multi-image campaign.
No text, no watermarks.
```

### Шаг 2 — использование якоря

В API:
```python
result = client.images.edit(
    model="gpt-image-2",
    image=[open("character_anchor.png", "rb")],
    prompt="""
    Continue the story with the SAME character.
    Character consistency: same [clothing / face / colors / proportions].
    New scene: [description].
    Do not redesign the character.
    """,
    input_fidelity="high"
)
```

В ChatGPT-интерфейсе — просто загрузить якорь и описать новую сцену с указанием «keep character identical».

---

## ChatGPT vs API vs агрегаторы

| Параметр | ChatGPT (интерфейс) | API (gpt-image-2) | Агрегаторы |
|---|---|---|---|
| Контекст разговора | Полный, multi-turn | Один запрос | Зависит |
| input_fidelity | Нет прямого контроля | low / high | Иногда есть |
| Качество output | Авто | low/medium/high | Зависит |
| Размер | Авто | Любое (до ~2K надёжно) | Ограничено |
| Batch | Неудобно | n=4, batch | Да |
| Цена | Подписка | Токены | Подписка / кредиты |
| Итеративный рефайн | Естественный | Через код | Зависит |

### Лучшие практики

**ChatGPT-интерфейс:**
- Multi-turn: генери → «сделай фон темнее» → «добавь тень»
- Не перегружай первый промпт — итерируй
- Загружай референсы прямо в чат

**API:**
```python
result = client.images.edit(
    model="gpt-image-2",
    image=[open("input.png", "rb")],
    prompt="your detailed prompt",
    size="1024x1536",
    quality="high",  # для текста и портретов
    input_fidelity="high"  # для сохранения идентичности
)
```

- `quality="low"` — быстрые черновики, итерации, большие батчи
- `quality="high"` — текст, портреты, коммерческий финал
- Максимально надёжный размер: до `2560x1440`

---

## Топ-15 правил сильного промптинга

1. Структура: Сцена → Субъект → Детали → Ограничения
2. `photorealistic` — ключевое слово для реалистичного режима
3. Текст только в кавычках + `verbatim` + `no extra characters` + `quality: high`
4. Кириллица: явно `Russian Cyrillic only, no Latin substitutions`
5. Разделяй ЧТО менять и ЧТО сохранять — повторяй invariants на каждой итерации
6. НЕ используй `8K`, `perfect`, `smooth` — пластиковый AI-вид
7. Для портретов: `pores, natural imperfections, candid, unposed, honest`
8. Итерируй, не перегенерируй — базовый промпт → маленькие уточнения
9. `input_fidelity="high"` для редактирования с сохранением идентичности
10. `quality: high` для текста, инфографики, портретов; `quality: low` для черновиков
11. Задавай фрейминг: lens, camera angle, crop — модель не угадывает
12. Для рекламы: пиши как creative brief, не как ТЗ
13. Multi-image: нумеруй инпуты — `Image 1: product, Image 2: style reference`
14. Character anchor: якорь как input на каждой итерации серии
15. Для API: приоритизируй читаемость шаблона над «умным» синтаксисом

---

## Распространённые ошибки и фиксы

| Проблема | Причина | Решение |
|---|---|---|
| Пластиковая кожа | `perfect`, `smooth`, `8K HD` | `pores, natural imperfections, candid, unposed` |
| Зерно / шум | `quality: low` для детализации | `quality: high` для портретов и текста |
| Сломанный текст | Нет `verbatim`, нет `quality: high` | Текст в кавычках + `verbatim, no extra characters` + quality high |
| Кириллица → латиница | Не указан язык | `Russian Cyrillic only, no Latin substitutions` |
| Дрейф персонажа при итерациях | Не переносишь invariants | Повторяй список сохраняемого в каждом промпте |
| Фон меняется при редактировании | Нет явного preserve | `Keep background unchanged. Change ONLY [element]` |
| Артефакты при вставке человека | Нет `input_fidelity: high` | В API: `input_fidelity="high"` |
| Продукт деформируется | Не задано сохранение геометрии | `Preserve product shape, geometry, label legibility exactly` |
| Лишние логотипы / копирайт | Нет ограничений | `no watermarks, no logos, no trademarks, original design only` |
