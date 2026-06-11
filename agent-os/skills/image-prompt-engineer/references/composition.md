# Composition — Visual Structure of the Frame

> Основано на Брюс Блок «Визуальное повествование» + Стивен Кац «Кадр за кадром». Это про то, **как устроен кадр** — а не **что в нём изображено**. От композиции зависит, как зритель прочитает эмоцию ещё до того, как поймёт сюжет.

---

## Главный принцип: КОНТРАСТ vs СБЛИЖЕННОСТЬ

> Брюс Блок: **визуальная структура** держится на двух силах — контраст и сближенность (affinity).

- **Контраст** = различие → визуальное напряжение растёт → драма, действие, динамика
- **Сближенность** = сходство → напряжение падает → покой, монотонность, медитация

Это применимо ко **всем 7 компонентам**: пространство, линия, форма, тон, цвет, движение, ритм.

**Алгоритм для промпта:**
1. Какой накал нужен? (драма ↑ / покой ↓)
2. Какой компонент будет работать на этот накал? (тон / цвет / движение / линии)
3. Контраст или сближенность? Какая именно?

| Сцена | Доминирующий принцип |
|---|---|
| Action, погоня, драма | Контраст по тону + движению + линиям |
| Покой, медитация, ностальгия | Сближенность по всем компонентам |
| Триллер, ожидание | Сближенность фона + ОДИН контрастный акцент |
| Реклама с heroshot | Контраст продукта с фоном (тон ИЛИ цвет) |

**Фразы для промпта:**
- `high contrast tonal composition, deep blacks against bright highlights, dramatic`
- `monochromatic muted palette, low contrast, calm atmosphere`
- `single bright element isolated in desaturated environment`

---

## 1. Тон (Tone) — яркостный диапазон

Тон работает **ДО** цвета. Зритель сначала считывает свет/тень, потом цвет.

**3 способа управления тоном:**
1. **Цвет объектов** (костюм, декорация, реквизит) — низкий ключ или высокий ключ
2. **Освещение** (баланс света и тени) — film noir vs high-key
3. **Экспозиция** (камера/оптика)

### Тональные стили
- **High-key (высокий ключ):** всё светлое, мало теней, плоский свет. Используется: реклама, ситкомы, мечты, комедии.
- **Low-key (низкий ключ):** глубокие тени, точечные источники света. Используется: нуар, триллер, драма.
- **Контрастный тональный кадр:** только очень светлое + очень тёмное. Используется: художественные постеры, граффити-эстетика, журнальные обложки.

**Фразы для промпта:**
- `high-key lighting, bright airy tones, minimal shadows`
- `low-key film noir lighting, deep shadows, single key light`
- `chiaroscuro lighting, dramatic light/dark contrast`

### Тональное выявление vs сокрытие
- **Выявление:** объект ярко выделен на тёмном фоне (или наоборот) — лицо читается полностью.
- **Сокрытие:** объект «тонет» в тоне фона — частично скрыт. Создаёт интригу, недосказанность.

**Фразы:**
- `face emerging from deep shadow, only key features lit`
- `silhouetted figure against bright window, no facial detail`

---

## 2. Пространство и глубина

Экран — двухмерный. Задача — создать иллюзию глубины. У Каца это делается через **линейную перспективу**, у Блока — через сочетание глубины/плоскости/ограниченности/размытости.

### Линейная перспектива (Кац)
- **Ортогональная** (без перспективы) — плоский кадр, иконография, плакатность.
- **Одноточечная** — взгляд по коридору, симметричная глубина. Куросава, Кубрик. Сильное чувство неизбежности.
- **Двухточечная** — наиболее реалистично, объёмно.
- **Трёхточечная** — гипер-глубина, чувство колоссальности (небоскрёбы снизу).

**Фразы:**
- `one-point perspective, symmetrical composition, deep corridor, Kubrick style`
- `two-point perspective, natural depth, realistic urban setting`
- `three-point perspective, towering low-angle, monumental scale`

### Слои глубины (передний / средний / задний)
Правило Харта: **в каждом кадре должны быть передний, средний и задний план**. Без переднего плана — кадр плоский. Без заднего — без контекста.

**Фразы:**
- `clear foreground element (leaves / table edge / hand), midground subject, deep background`
- `layered depth — foreground branches in soft focus, sharp subject in midground, blurred mountains beyond`

### Глубина резкости
- **Малая (shallow):** субъект чёткий, фон размыт. Подчёркивает героя, отрезает от среды. Портрет, реклама.
- **Большая (deep focus):** всё в фокусе. Документальное, эпическое, классический Голливуд.

**Фразы:**
- `shallow depth of field, f/1.4, creamy bokeh background`
- `deep focus, everything sharp from foreground to horizon, classical composition`

---

## 3. Открытые vs Закрытые композиции (Кац)

Это про **дистанцию зрителя** от сцены.

### Закрытая композиция
- Все элементы тщательно расставлены, рамка «держит» всё внутри.
- Персонажи целиком в кадре, баланс симметричен или подчинён правилу третей.
- Камера ВНЕ круга действия — зритель наблюдает.
- **Ощущение:** постановочность, художественность, контроль.
- Стиль: классическое кино, реклама премиум, портрет в студии.

**Фразы:**
- `closed composition, subject centered, symmetrical balance, formal framing`
- `wide closed shot, full figure within frame, classical staging`

### Открытая композиция
- Персонажи могут быть обрезаны рамкой, частично скрыты передним планом.
- Камера ВНУТРИ круга действия — зритель участник.
- **Ощущение:** реализм, документальность, незаметная организация.
- Стиль: документальное, репортаж, UGC, авторское кино, современная реклама «как будто настоящее».

**Фразы:**
- `open composition, subject partially cropped by frame edge, candid framing`
- `figure cut at shoulders, foreground objects intruding, documentary feel`
- `off-balance composition, subject not centered, organic asymmetry`

### Когда что выбирать
| Задача | Композиция |
|---|---|
| Реклама премиум / luxury | Закрытая |
| UGC / phone-shot | Открытая |
| Героический портрет | Закрытая |
| Будничная сцена «как из жизни» | Открытая |
| Сюрреализм, метафора | Закрытая |
| Социальная драма, репортаж | Открытая |

---

## 4. Ракурс (камера vs объект)

Ракурс — это **отношение между уровнем камеры и уровнем объекта**. AI считывает буквально: «низкий ракурс» = снизу вверх.

| Ракурс | Что значит | Когда использовать |
|---|---|---|
| **На уровне глаз (eye-level)** | Нейтрально, без оценки | Документальное, диалог, реклама-разговор |
| **Верхний (high angle)** | Уязвимость, слабость, наблюдение свыше | Жертва, ребёнок, потерянный персонаж |
| **Нижний (low angle)** | Сила, доминирование, угроза | Герой, антагонист, монумент |
| **Голландский (dutch angle)** | Дезориентация, тревога | Триллер, психоз, нарушенность |
| **Птичий полёт (bird's eye)** | Бог, судьба, отстранение | Эпизод, общий план, метафора |
| **Червь (worm's eye)** | Скрытое наблюдение | Триллер, point-of-view существа |

**Фразы:**
- `low-angle hero shot, subject looming above camera, dominant pose`
- `slight high-angle, looking down at vulnerable figure`
- `dutch angle 15 degrees tilted, unsettling composition`
- `bird's-eye view from directly above, geometric pattern of figures below`

⚠️ **Важно:** AI понимает ракурс лучше всего, когда указано КОНКРЕТНО:
- ❌ `dramatic angle`
- ✅ `low angle from waist level, camera tilted slightly up`

---

## 5. Линия и форма

Линии и формы внутри кадра задают **направление взгляда** и **эмоциональный тон**.

| Тип линии | Эмоция / смысл |
|---|---|
| Горизонтальные | Покой, стабильность, протяжённость |
| Вертикальные | Сила, монументальность, божественность |
| Диагональные | Динамика, движение, напряжение |
| Кривые | Чувственность, плавность, женственность |
| Зигзаги | Хаос, агрессия, конфликт |

**Контраст линий** = напряжение (вертикали против горизонталей в одном кадре). **Сближенность** = спокойствие (все линии одного направления).

**Фразы:**
- `strong diagonal lines leading from lower-left to upper-right, dynamic energy`
- `dominant verticals — pillars, doorframes, standing figures — monumental`
- `flowing curved lines, organic shapes, soft feminine atmosphere`

---

## 6. Ритм

> Блок: ритм = чередование + повторение + темп.

В статичном кадре ритм создаётся повторяющимися элементами (окна, фонари, фигуры в шеренге). Чередование + регулярность = визуальный ритм.

**Фразы:**
- `repeating rhythm of windows along the building, regular pattern`
- `alternating light and shadow stripes across the floor, jail-bar effect`
- `crowd as repeating pattern, anonymous individuals`

---

## 7. Кадрирование (правила и сетки)

### Правило третей
Делим кадр на 9 равных частей. Ключевые элементы — на пересечениях линий. Глаз персонажа — в верхней трети. Горизонт — на верхней или нижней трети, никогда посередине (если только не специально).

**Фразы:**
- `rule of thirds composition, subject on right third, eyes on upper third line`
- `horizon on lower third, dominant sky composition`

### Правило трёх (Харт) — для раскадровки и кадров
В каждом кадре должны быть видны:
1. Главный персонаж/объект
2. Действие (что происходит)
3. Контекст (где происходит)

Если хоть один элемент отсутствует — кадр не работает как самостоятельный.

### Симметрия
- **Идеальная симметрия:** Кубрик, Уэс Андерсон. Создаёт ощущение порядка, контроля, иногда абсурда.
- **Асимметрия:** более живая, естественная.

**Фразы:**
- `perfect symmetrical composition, Wes Anderson style, centered subject`
- `Kubrick one-point perspective, symmetrical, formal`

### Negative space
Пустое пространство вокруг субъекта = эмоция. Много negative space = одиночество, покой, важность субъекта.

**Фразы:**
- `large negative space around small isolated figure, sense of solitude`
- `minimalist composition, generous empty space, single focal point`

---

## 8. Контраст и сближенность по каждому компоненту

> Это базовая матрица Блока. Использовать как чек-лист при написании промпта.

| Компонент | Контраст (↑ напряжение) | Сближенность (↓ напряжение) |
|---|---|---|
| **Пространство** | Глубина + плоскость в одном кадре | Однородная глубина |
| **Линия** | Разнонаправленные | Параллельные |
| **Форма** | Острые vs округлые | Одного семейства |
| **Тон** | Чёрное против белого | Все средне-серые |
| **Цвет** | Дополнительные (red/cyan, blue/orange) | Аналогичные (соседние на круге) |
| **Движение** | Хаотичное, разнонаправленное | Однонаправленное, спокойное |
| **Ритм** | Нерегулярный, рваный | Равномерный |

---

## 9. Универсальные промпт-шаблоны композиции

### Динамичная драма (high contrast everywhere)
```
Strong diagonal composition, low angle, deep shadows against bright highlight,
contrasting warm orange against cool blue, subject off-center on the right third,
fast directional energy from lower-left to upper-right
```

### Спокойный медитативный кадр (affinity)
```
Symmetrical composition with subject centered, soft diffused even lighting,
muted analogous color palette (greys to blues), horizontal lines dominate,
large negative space, subject calm and centered
```

### Премиум-портрет (controlled tension)
```
Closed composition, subject on left third looking right, shallow depth of field,
chiaroscuro lighting from camera left, warm key against cool background,
deep blacks in negative space, single sharp focal point on the eyes
```

### Документальный момент (open composition)
```
Open composition, subject partially cropped by frame, foreground intrusion,
eye-level handheld feel, natural available light, candid framing,
asymmetrical balance, mid-action posture
```

---

## 10. Anti-patterns

| Ошибка | Почему плохо | Что вместо |
|---|---|---|
| Субъект ровно по центру + ничего вокруг | Скучно, статично | Off-center + контекст в third |
| Все линии в кадре параллельны | Без напряжения, плоско | Добавь диагональ или конфликт направлений |
| Полная симметрия без причины | Кадр «мёртвый» | Симметрия только для формальности (Кубрик-стиль) |
| Передний план пустой | Кадр плоский | Введи элемент на foreground |
| `cinematic composition` без деталей | Модель решит за тебя | Укажи: `closed/open`, ракурс, правило третей, глубину |
| Горизонт ровно посередине | Делит кадр пополам, ослабляет оба слоя | Третей: либо верх, либо низ доминирует |
| Лицо в полный фронт + полный анфас | Плоско, как паспорт | 3/4 поворот, head tilt, контрастный свет |

---

## Cross-reference

- Эмоция через цвет → `color-emotion.md`
- Раскадровка и серия кадров → `storyboard-and-shots.md`
- Премиум-композиция (свет + поза) → `premium-visuals.md`
- Конкретика по моделям (что они понимают лучше) → `model-selection.md`
