# Nano Banana Pro & 2: специфика

Глубокая справка по Nano Banana. Главные правила в SKILL.md, здесь — нюансы и расширенные техники.

---

## Версии и их различия

**Pro (Gemini 3 Pro Image)** — флагман. Максимум качества, скорости 10–20 сек, до 4K, Thinking Mode.

**2 (Gemini 3.1 Flash Image)** — скоростная. 4–6 сек, ~95% качества Pro, Image Search Grounding, больше aspect ratios.

В рамках одного запроса: одна модель. Но рабочий пайплайн часто **2 → Pro**: черновики и вариации в 2, финальный рефайн в Pro.

---

## Критичные правила промптов

### 1. Связный текст, не теги

❌ `beautiful woman, park, 4k, realistic, red hair, professional`
✅ `Young woman ~28 with long chestnut hair stands on a blurred path in a spacious park. Her gaze is calm and thoughtful. Summer greenery softly out of focus behind her.`

Модель — это Gemini, она читает смысл, не ключевые слова.

### 2. Текст в кадре — БЕЗ кавычек и скобок

Модель рендерит кавычки и скобки буквально как символы.

❌ `text: "ВАШ ЗАГОЛОВОК"`
❌ `add text {ЛЕТНЯЯ РАСПРОДАЖА}`
❌ `label: [50% СКИДКА]`

✅ `bold white sans-serif text ВАШ ЗАГОЛОВОК at top center`
✅ `large red text 50% СКИДКА centered on banner`

Для русского текста — отдельная финальная строка:
```
add Russian text: ВАШ ТЕКСТ ЗДЕСЬ
```

### 3. Двухэтапный метод для критичного текста

Логотипы, точные цены, юридические дисклеймеры:
1. Сначала отдельным запросом проверить, что модель пишет нужный текст без искажений
2. Потом генерация изображения с этим текстом

### 4. Никаких отрицаний

❌ `no cars on the street`, `not plastic skin`
✅ `empty street with no traffic`, `natural skin texture, visible pores, candid`

### 5. Никаких контрадикций

❌ `professional but casual, bright but moody`

Если нужны разные настроения — разные кадры. Один промпт = одна согласованная сцена.

---

## Структура промпта

**SUBJECT + ACTION + ENVIRONMENT + COMPOSITION + LIGHTING + STYLE**

Пример минимального production-промпта:

```
Young Slavic woman, ~24 years old, light skin, natural light brown hair pulled back loosely,
no makeup, calm expression. She is sitting relaxed in a modern laser hair removal studio,
eyes closed, slight smile. Aesthetician's hands gently positioned near her arm. White and beige
interior, soft indirect lighting, clean minimal decor.

Medium shot, slightly above eye level, subject centered with rule of thirds offset.
Soft diffused studio lighting, no harsh shadows, warm neutral tones. Natural skin texture,
visible pores, subtle imperfections, no plastic look. Canon EOS R5, 85mm f/1.4, shallow depth
of field, photorealistic, editorial beauty photography quality.

bold white sans-serif text 5 ЗОН за 1490 РУБ at bottom center, large and readable, clean drop shadow

add Russian text: 5 ЗОН за 1490 РУБ
```

---

## Что убивает реализм

Эти слова дают «пластиковый AI-вид»:

- `8K`, `8K ultra HD`, `8K resolution`
- `perfect skin`, `flawless skin`, `smooth skin`
- `airbrushed`, `polished`, `glamour`
- `masterpiece`, `award-winning` (в случае реализма)

**Используй вместо:**
- `photorealistic`, `natural skin texture`
- `visible pores`, `subtle imperfections`
- `candid, unposed, honest`
- `micro skin details, natural subsurface scattering`
- `Canon EOS R5, 85mm f/1.8, shallow depth of field`

---

## Управление светом

Прямо описывай источник, направление и качество света.

**Студия:**
```
Soft three-point studio lighting, key light from camera-left at 45°,
fill light from camera-right at lower intensity, rim light from behind,
subtle separation from background.
```

**Естественный свет:**
```
Soft golden-hour light from large window on the left, warm transitions,
gentle shadows on the right side of the face, no harsh contrast.
```

**Кинематографичный:**
```
Cinematic chiaroscuro lighting, single warm key from upper left,
deep shadows on the opposite side, subtle blue ambient fill, dramatic mood.
```

Кино-схемы как готовый язык:
- **Rembrandt** — треугольник света на теневой стороне, портреты
- **Split** — половина лица в свете, половина в тени, драма
- **Loop** — мягкая тень от носа, базовый портретный свет
- **Butterfly** — свет сверху по центру, beauty / fashion
- **Backlit / rim** — контурный свет, отделяет от фона, premium look

---

## Камера и композиция

| Параметр | Промпт |
|---|---|
| Кадр | `extreme close-up`, `close-up`, `medium shot`, `wide shot`, `establishing shot` |
| Объектив | `24mm wide-angle`, `35mm`, `50mm`, `85mm portrait lens`, `telephoto` |
| Угол | `eye level`, `low angle`, `high angle`, `overhead`, `over-the-shoulder` |
| Глубина резкости | `shallow depth of field, bokeh background, f/1.8` или `deep focus, f/11` |
| Композиция | `rule of thirds, subject on right third`, `centered symmetric`, `phi grid composition` |

---

## Character consistency

### Создание якоря

Прежде всего собери **Character DNA** — описание, которое будешь повторять в каждом промпте серии:

- Лицо: форма, цвет глаз, форма бровей, нос, рот, отметины (шрамы, родинки)
- Волосы: длина, цвет, фактура, причёска
- Тело: рост, телосложение, пропорции
- Одежда: базовый аутфит
- Стиль: визуальный стиль (modern anime, semi-realistic, cinematic)

Генери якорный кадр в Nano Banana Pro. Это инвестиция — он будет использоваться много раз.

### Использование якоря

Загружай якорь как референс. Промпт начинай так:

```
Using the same character from the reference image, keep her facial features,
hairstyle, outfit and proportions identical to the reference.

Now: [новая сцена, поза, окружение].
```

При дрейфе (модель начинает менять лицо) — заново загрузи оригинальный якорь и ужесточи формулировки:

```
Maintain identical facial features. Same eye color, same nose shape, same jawline.
Do not redesign the character. Keep her exact identity from the reference image.
```

### Несколько персонажей

Pro и 2 поддерживают до 5 персонажей и 14 референсов. Лучше:

- 6–8 сильных референсов > 14 средних
- Один персонаж — одна референс-картинка
- Не загружай разные варианты одного персонажа как character refs — модель усреднит лица

---

## Распределение референсов под задачу

| Сценарий | Object refs | Character refs |
|---|---|---|
| E-commerce / продукт (NB2) | 8–10 | 0 |
| Brand character story (Pro) | 2–3 | 4–5 |
| Product + spokesperson (NB2) | 5–6 | 2–3 |
| Game character design (Pro) | 3–4 | 4–5 |

---

## Редактирование вместо регенерации

Если результат на 80% правильный — НЕ регенери. Редактируй.

```
Make the background more blurred, add sunlight from camera left,
increase contrast slightly. Don't touch the face or outfit.
```

```
Remove the person on the right, realistically fill the space with sand
and a sea landscape. Keep the sky, sunset, and everything else unchanged.
```

Преимущества:
- Сохраняется character consistency
- Экономит кредиты
- Быстрее, чем подбирать промпт с нуля

---

## Цена и оптимизация (Pro)

| Разрешение | Цена | Когда |
|---|---|---|
| 1K (1024) | $0.067 | Concept tests, итерации |
| 2K (2048) | $0.134 | Основная работа |
| 4K (4096) | $0.240 | Финал в печать / production |

- Тесты в 1K → финал в 4K
- Edit > regenerate
- Batch: 50% скидка при объёме
- Веди библиотеку рабочих промптов — не изобретай каждый раз

---

## Готовые шаблоны под типовые задачи

### Character sheet для серии

```
Generate a character reference sheet for [имя], a [описание роли].
[Возраст, телосложение, лицо детально, волосы, глаза, отметины].
[Одежда — описать всё: верх, низ, обувь, аксессуары].
Show the character in three views: front, three-quarter, back.
Full-body shots, clean white background, neutral studio lighting.
Style: [modern anime / semi-realistic / cinematic].
Keep facial features, hairstyle, outfit, body proportions very clear and consistent.
This will be used as the main reference for future scenes.
```

### Кадр раскадровки (используя якорь)

```
Using the same character from the reference image, generate a storyboard frame
for vertical video (9:16). [Имя] is [действие] in [окружение].
Keep facial features, hair, outfit identical to reference.
Camera: [план, угол, фокусное]. Environment: [детали]. Lighting: [направление, качество].
Style: [тот же стиль, что в якоре].
```

### Реалистичный постер

```
Create a cinematic poster of [персонаж] in [сцена].
[Лицо детально + одежда]. Keep his/her features recognizable.
Pose: [конкретно]. Camera: [план + объектив + DoF].
Lighting: [направление + температура + настроение].
Style: ultra-realistic cinematic concept art, HDR, sharp details, poster quality.
```

### UI / инфографика с английским текстом

```
Design a clean [тип интерфейса] UI for [контекст].
Main element: [центральный объект].
Text labels inside the image:
bold white sans-serif title text MAIN TITLE at the top
small label SUBTITLE near [позиция]
small labels SECTOR A and SECTOR B near [позиция]
Color palette: [цвета].
Style: sleek futuristic UI, flat with soft glows, high resolution.
All text perfectly spelled, aligned, fully readable.
```

### Реклама с русским текстом

```
[Описание сцены: персонаж, окружение, действие, реализм].
[Камера, свет, стиль].

bold white sans-serif text [ЗАГОЛОВОК] at bottom center, large readable, clean drop shadow

add Russian text: [ЗАГОЛОВОК]
```

Если русский текст критичен — рассмотри ChatGPT Image как альтернативу.
