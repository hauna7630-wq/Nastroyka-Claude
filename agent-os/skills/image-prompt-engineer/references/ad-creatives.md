# Ad Creatives — ТЗ для AI-генерации рекламных баннеров

> Источник: исследование по форматам РСЯ и ТЗ для креативов (2026). Это про то, как правильно поставить задачу AI-генератору (Nano Banana Pro, ChatGPT Image, Midjourney) для рекламных баннеров под Яндекс Директ и соцсети.

---

## Технические требования Яндекс Директ (РСЯ)

| Параметр | Значение |
|---|---|
| Минимальное разрешение | 1080 px по короткой стороне |
| Соотношения сторон | 1:1, 4:3, 3:4, 16:9 |
| Вес файла | до 512 КБ |
| Форматы | JPG, PNG, GIF |
| Текст на баннере | Минимум — система накладывает текст объявления поверх |
| Логотипы | Без брендовых элементов если нет бренд-кита |

**Главное правило:** максимум 2-5 слов на самом изображении. Все детали — в текстовой части ТГО. Текст-на-тексте убивает читаемость.

**В промпте всегда добавляй:** `no text, no logos, no watermarks`

---

## Три типа рекламных креативов

### 1. Продуктовый
Показывает товар или процесс максимально конкретно. Лучший для холодной аудитории — человек сразу понимает что предлагается.

**Ниши:** e-commerce, ремонт, авто, услуги B2C.

**Визуальные паттерны:**
- Крупный план товара на контрастном фоне + понятный оффер
- Мастер в форме (врач, парикмахер, строитель) в процессе работы
- Результат услуги крупно (белые зубы, чистая кухня, ухоженный участок)

### 2. Эмоциональный
Бьёт в состояние — страх, усталость, желание признания, заботу о семье. Важны лица и язык тела. Лучше на тёплой аудитории.

**Ниши:** медицина, красота, обучение, психология.

**Визуальные паттерны:**
- Усталый предприниматель над кипой бумаг → оффер «освободим от рутины»
- Семья после ремонта, улыбаются → «вот каким станет ваш дом»
- Девушка до/после процедуры
- Крупный план лица с нужной эмоцией (облегчение, уверенность, радость)

### 3. Кликбейтный (в рамках правил)
Обещает сильное изменение или «секрет», остаётся честным. Для ретаргетинга и инфопродуктов.

**Ниши:** обучение, сервисы, ретаргетинг.

**Визуальные паттерны:**
- Монитор с графиком роста, рука частично закрывает экран
- Интригующая деталь, скрытая от зрителя
- Контраст «было/стало» в одном кадре

---

## Правило работающего баннера

**Тест на читаемость:** баннер должен читаться с вытянутой руки на смартфоне за 1-2 секунды.

**Тест на понятность:** человек, увидев баннер 2 секунды, должен ответить: что продаётся, кому, какая выгода. Если не может — креатив в корзину.

**Правило одного ядра:** один главный смысл на баннере. Цена, скорость, боль или результат — выбери одно. Всё остальное в текст объявления.

**Что работает стабильно:**
- Крупный план товара на контрастном фоне
- Люди лучше «безликих» предметных кадров — одежда на человеке, мастер в процессе
- Динамика и событие лучше статичной постановки
- Образы «до/после»
- Триггеры: будильник, уведомление от банка, штраф — для эмоциональных ниш

---

## ТЗ по нишам — готовые промпты

### Стоматология — продуктовый

**Задача:** продать имплантацию, показать результат.

```
// Формат 1:1 — уверенная улыбка:
Close-up of a confident smiling woman with perfectly straight white 
teeth in a modern dental clinic interior, soft daylight, 
shallow depth of field, clean background, cinematic, 
high-end commercial photo, no text, no logos

// Формат 16:9 — врач + пациент:
Professional female dentist in white coat gently examining 
a smiling patient in a bright modern clinic, 
warm natural light, soft focus background, reassuring atmosphere, 
commercial photography style, no text, no logos
```

**Эмоция:** уверенность, облегчение. Без крови, без «до» в виде шок-контента.

---

### Психология — эмоциональный

**Задача:** передать безопасность и поддержку.

```
// Уют и защита:
Cozy home office setup with warm lamp light, a journal and 
a cup of tea on the table, soft bokeh background, 
warm amber tones, peaceful and safe atmosphere, 
lifestyle photography, no text, no logos

// Облегчение после сессии:
Young woman sitting by a window with natural light, 
calm and relieved expression, soft morning light, 
warm neutral tones, candid lifestyle photo, 
no text, no logos
```

**Избегать:** клинические интерьеры, грустные/тревожные лица как основной образ (это для проблемы, не для решения).

---

### Благоустройство участка — продуктовый

**Задача:** показать результат «до/после», вызвать желание.

```
// После — красивый участок:
Beautiful modern garden with stone pathway, green lawn, 
decorative plants and soft landscape lighting at golden hour, 
aerial or eye-level view, high-end residential exterior, 
professional landscape photography, no text, no logos

// Процесс — команда за работой:
Professional landscaping crew working on a modern garden,
laying stone pathway, planting trees, clean organized worksite,
natural daylight, reportage documentary style, no text, no logos
```

---

### Салон красоты — продуктовый + эмоциональный

**Задача:** показать результат и атмосферу.

```
// После окрашивания:
Close-up portrait of a woman with perfect balayage highlights,
glossy healthy hair, soft studio lighting, 
beauty editorial style, warm tones, no text, no logos

// Атмосфера салона:
Elegant hair salon interior with a stylish client 
sitting in a chair, hairdresser working, 
soft warm light, premium and relaxed atmosphere, 
lifestyle commercial photography, no text, no logos
```

---

### Аутсорс-бухгалтерия / SaaS — эмоциональный до/после

**Задача:** до = боль, после = решение.

```
// «До» — усталость и хаос:
Tired small business owner sitting at a messy desk 
with receipts, invoices and paperwork, 
late evening light from a window, 
laptop screen with spreadsheets, cozy small apartment office, 
cinematic realistic style, 16:9, no text, no logos

// «После» — порядок и улыбка:
Same person at a clean organized desk, smiling, 
laptop showing upward growth charts, 
bright natural morning light, relaxed confident pose, 
16:9, no text, no logos
```

---

### Онлайн-курс / обучение — кликбейтный

**Задача:** интрига, ощущение «секретных знаний».

```
Modern marketing workspace with laptop showing upward trending 
analytics chart, a hand partially covering the screen, 
shallow depth of field, cinematic lighting, 
clean high-end commercial style, 1:1, no text, no logos
```

---

## Структура промпта для рекламного баннера

```
[Что/кто в кадре, конкретно]
[Окружение/локация]
[Свет и атмосфера]
[Эмоция/настроение]
[Стиль съёмки: commercial / editorial / lifestyle / cinematic]
[Формат: 1:1 / 16:9 / 4:3]
no text, no logos, no watermarks
```

**Пример:**
```
Close-up of confident smiling woman after dental treatment,
bright modern clinic interior background, 
soft natural daylight, shallow depth of field,
emotion: relief and confidence,
high-end commercial photography style,
1:1 aspect ratio,
no text, no logos, no watermarks
```

---

## Что добавлять под нишу

| Ниша | Обязательные элементы промпта | Чего избегать |
|---|---|---|
| **Стоматология** | clean, modern clinic, professional, gentle, natural smile | кровь, шок, страдание, ретро-интерьер |
| **Красота/SPA** | premium, soft editorial, warm tones, healthy glow | дешёвый фон, перенасыщенные цвета |
| **Участок/ландшафт** | lush garden, stone pathway, golden hour, aerial view | грязь, незаконченные работы |
| **Психология** | cozy, safe, warm light, candid, calm | клиника, таблетки, грусть как финальная эмоция |
| **Fintech/SaaS** | clean desk, growth charts, natural light, confident pose | хаос, перегруженный экран |
| **Еда/ресторан** | appetizing, steam, close-up, moody dark background | пластик, дешёвый реквизит |

---

## Карусель в РСЯ — структура слайдов

Карусель из 3-5 слайдов даёт максимум CTR. Первый слайд цепляет боль, дальше аргументация и социальное доказательство.

**Структура для услуг:**
```
Слайд 1: Боль / Ситуация «до» (эмоциональный образ)
Слайд 2: Решение / Процесс (продуктовый образ)
Слайд 3: Результат / «После» (позитивный эмоциональный образ)
Слайд 4: Социальное доказательство (люди, довольные клиенты)
Слайд 5: CTA-образ (простое действие, запись, звонок)
```

Промпты для каждого слайда — отдельные, но в едином стиле/палитре.

---

## Видео 15-30 секунд — что показывать

Видео даёт +20-50% конверсий против статики в ряде кейсов. Лучше всего:
- Процесс: ремонт, лечение, обучение, результат до/после
- 15-30 секунд — оптимальная длина для РСЯ

**ТЗ для Seedance/Kling:**
```
Стиль: commercial, realistic, cinematic quality
Движение: slow dolly in OR slow pan (не хаотичное)
Субъект: чёткий, один главный объект/персонаж
Финал кадра: нужная эмоция или продукт крупно
Без текста на экране, без логотипов
```

---

## Anti-patterns рекламных баннеров

| Ошибка | Почему плохо | Что вместо |
|---|---|---|
| Много текста на картинке | Система накладывает свой текст → каша | Max 2-5 слов или 0 |
| Красивый абстрактный дизайн без оффера | Не понятно что продаётся | Конкретный субъект + понятное состояние |
| «Безликий» предмет без человека | Не вызывает эмоции | Товар/услуга в контексте человека |
| Перегруженный кадр | Глаз не знает куда смотреть | Одно фокусное пятно |
| Нет контраста субъект/фон | Сливается | Контрастный фон или shallow DoF |
| Слишком тёмный баннер | Не читается на мобильном | Светлый фон или яркий акцент |

---

## Cross-reference

- Цветовые палитры по нишам с HEX → `design-color.md`
- Кинематографический цвет и атмосфера → `color-emotion.md`
- Композиция кадра → `composition.md`
- Текстовые объявления Яндекс Директ → скилл `copywriter-pro`, `yandex-direct.md`
