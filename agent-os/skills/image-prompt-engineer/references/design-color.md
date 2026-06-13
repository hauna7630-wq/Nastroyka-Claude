# Design Color — Цветовые схемы и палитры для рекламы

> Источник: практический мастер-гайд по цвету для дизайна и AI-генерации (2026). Это про то, как управлять цветом в баннерах, иконках, инфографике и рекламных креативах — с конкретными HEX и промпт-токенами.

---

## Быстрый алгоритм подбора цвета

```
1. Определи нишу → возьми отраслевую палитру (раздел 4)
2. Определи роли: 60% фон, 30% вторичный, 10% акцент (CTA)
3. Выбери гармонию под задачу (раздел 1)
4. Добавь психологический эффект-фразу (раздел 5)
5. Пропиши HEX явно в промпте → цветовая консистентность
```

---

## 1. Цветовые гармонии — схемы для баннеров

### Complementary (дополнительные)
**Суть:** пары напротив на круге — синий/оранжевый, красный/зелёный, жёлтый/фиолетовый.
**Эффект:** максимальный контраст → идеально для CTA-кнопок, бейджей скидок, urgent-сообщений.
**Паттерн:**
- Фон — спокойный, десатурированный (близкий к одному из цветов)
- Акцент — яркий дополнительный **только** на кнопках и важном тексте

### Split-Complementary (раздвоенная дополнительная)
**Суть:** базовый цвет + два соседних к его противоположному (синий + жёлто-оранжевый + красно-оранжевый).
**Эффект:** сохраняет контраст, выглядит мягче — для лендингов, интерфейсов, где важна читаемость.
**Паттерн:**
- Базовый = фон и крупные блоки
- Один тёплый = CTA
- Второй = вторичные акценты (иконки, подсказки)

### Analogous (аналоговые)
**Суть:** соседние цвета — бирюзовый → синий → индиго.
**Эффект:** плавные градиенты, натуральность — лендинги, приложения, дашборды.
**Паттерн:** один контрастный цвет извне ряда ОБЯЗАТЕЛЕН для CTA, иначе всё сольётся.

### Triadic (триада)
**Суть:** три цвета на одинаковом расстоянии по кругу.
**Эффект:** ярко, игриво — entertainment, food, youth-бренды.
**Паттерн:** один = фон, второй = иллюстрации/иконки, третий = только CTA и бейджи.

### Tetradic / Square (четыре цвета)
**Суть:** две пары дополнительных.
**Эффект:** богатая бренд-система — много ролей цветов, но сложно держать в балансе.
**Паттерн:** один главный, один основной акцент (CTA), два — редкие вспомогательные (иконки статусов, графики).

---

## 2. Правило 60-30-10

Универсальный скелет для любого баннера, лендинга, UI-экрана:

| Доля | Роль | Что туда |
|---|---|---|
| **60%** | Доминанта | Фон, крупные блоки (обычно нейтральный) |
| **30%** | Вторичный | Карточки, шапка, подвал, вторичные секции |
| **10%** | Акцент | CTA-кнопки, бейджи, ключевые иконки |

**Цвет CTA:** нет «магического» цвета — побеждает тот, который лучше контрастирует с фоном. Тёплые (красный, оранжевый) работают на срочность; синий/зелёный — на доверие.

**Промпт для задания ролей:**
```
dominant background color #..., secondary surfaces #..., accent color for buttons and highlights #...
```

---

## 3. Quiet Luxury — «дорогой» визуал 2026

Тренд укрепился: глубокие приглушённые нейтралы, тёплые тона, минимум насыщенности.

### Принципы
- Низкая насыщенность, но достаточный контраст по светлоте между слоями
- Тёплые нейтралы вместо чистого белого/чёрного
- «Тональный коридор»: цвета близки по тону, без резких выстрелов
- Один дозированный акцент — золото, глубокий изумруд

### Quiet Luxury палитра 2026
| Роль | HEX | Название |
|---|---|---|
| Основной «чёрный» | #4A4A4A | Charcoal Espresso |
| Тёплый каменный фон | #A8A096 | Warm Stone |
| Кофейно-молочный | #7F6E5B | Mochaccino |
| Мягкий «пыльный» белый | #C7C0B7 | Cloud off-white |

### Нейтральная люкс-палитра (upscale-бренды)
| HEX | Роль |
|---|---|
| #D9D2CC | Светлый тёплый нейтральный фон |
| #F2F1EF | Почти белый для пустот и воздуха |
| #D9B18E | Мягкий «карамельный» акцент |
| #A67564 | Насыщенный тёплый коричневый |
| #723E31 | Глубоко-терракотовый для сильных акцентов |

### Металлики
- Чёрный + золото = престиж, эксклюзив (фэшн, люкс)
- Чёрный + серебро = high-tech, automotive, электроника
- Чёрный + беж = beauty / lifestyle

### Промпт-блоки для «дорогого» визуала
```
// Базовый quiet luxury фон:
muted warm neutrals, soft beige and warm taupe color palette, subtle contrast,
no pure white, no pure black, quiet luxury aesthetic

// Премиальный свет + металлик:
soft editorial lighting, gentle gradients, no harsh highlights,
brushed brass details, subtle warm gold reflections, cinematic soft shadows

// Серебряный high-tech:
deep charcoal background, soft silver reflections, brushed stainless steel,
minimal futuristic lighting, high-end tech product shot

// Монохром + лёгкий акцент:
monochromatic warm neutrals, from soft ivory to deep mocha,
one subtle accent in muted forest green, quiet luxury brand campaign
```

---

## 4. Отраслевые палитры с HEX и промпт-токенами

### 4.1 Automotive / Tech — «sleek, innovative, powerful»

| Роль | HEX | Описание |
|---|---|---|
| Фон / доминанта | #181B21 | Глубокий графитовый, Tesla-стайл |
| Текст / вторичный | #FFFFFF | Чистый белый |
| Металлик silver | #5C5C5C | Серебристо-серый для рамок |
| Акцент 1 power | #E82127 | Фирменный красный (Tesla) |
| Акцент 2 tech | #3457D5 | Электрический синий |

**Промпт-токены:**
```
color palette: #181B21, #FFFFFF, #5C5C5C, #E82127, #3457D5
sleek automotive tech aesthetic, deep graphite background (#181B21),
clean white typography (#FFFFFF), subtle silver metallic lines (#5C5C5C),
power accents in Tesla red (#E82127) and electric blue (#3457D5)
```

```
high-end electric vehicle hero shot, deep graphite background #181B21,
glossy body with subtle silver reflections #5C5C5C,
accent lights in electric blue #3457D5 and power red #E82127,
cinematic studio lighting, ultra clean composition
```

---

### 4.2 Beauty / Wellness / SPA — «calming, organic, clean, premium»

| Роль | HEX | Описание |
|---|---|---|
| Фон светлый | #E1C6B9 | Кремовый тёплый |
| Вторичный фон | #F3AB9A | Мягкий персиково-розовый |
| Текст / тени | #523E34 | Тёмный тёплый коричневый |
| Акцент 1 | #C93761 | Сочный, но не неоновый розовый |
| Акцент 2 | #9D6C53 | «Деревянный» коричневый для деталей |

Альтернатива с холодным акцентом (beauty salon):
- #BC5D42 — тёплый кирпично-розовый
- #DDAC9E — нежный телесный
- #ADD9DA — прохладный голубовато-мятный (свежесть, вода)

**Промпт-токены:**
```
color palette: #E1C6B9, #F3AB9A, #523E34, #C93761, #9D6C53
luxury spa aesthetic, soft cream background (#E1C6B9), gentle peach blocks (#F3AB9A),
deep warm brown typography (#523E34), accents in rich rose #C93761 and wood brown #9D6C53
```

```
minimal beauty product shot, quiet luxury style, monochromatic warm nudes,
soft editorial lighting, marble and wood textures, pastel pink and beige tones,
subtle mint highlight color #ADD9DA
```

---

### 4.3 Real Estate / Luxury Property — «trustworthy, elegant, solid»

| Роль | HEX | Описание |
|---|---|---|
| Фон / доминанта | #243C54 | Глубокий сине-индиго |
| Вторичный | #AFBAC8 | Светлый холодный серо-голубой |
| Акцент premium | #6D5CEC | Холодный Medium Slate Blue |
| Акцент мягкий | #9483DF | Более светлый для лёгких акцентов |
| Тёплый контраст | #5E3735 | Глубокий коричнево-бордовый (дерево, кожа) |

**Промпт-токены:**
```
color palette: #243C54, #AFBAC8, #6D5CEC, #9483DF, #5E3735
luxury real estate branding, deep indigo background (#243C54),
soft cool gray-blue panels (#AFBAC8), premium slate blue accents (#6D5CEC),
subtle purple highlights (#9483DF), warm wood brown details (#5E3735)
```

```
high-end property exterior render, twilight blue hour, deep blue sky matching #243C54,
warm interior lights, subtle gold reflections, calm and trustworthy color grading
```

---

### 4.4 Food / Restaurant — «appetizing, dynamic, fresh»

| Роль | HEX | Описание |
|---|---|---|
| Акцент 1 | #C72C41 | Сочный томатный красный |
| Акцент 2 | #D6A600 | Горчично-жёлтый |
| Свежесть | #A3C703 | «Лист салата» |
| Сыр / тепло | #FFA500 | Ярко-оранжевый |
| Коричневый | #A65E2E | Жареный картофель, булочка |
| Тёмный фон | #3C2433 | Глубокий кофейный для премиум |

**Промпт-токены:**
```
color palette: #C72C41, #D6A600, #A3C703, #FFA500, #A65E2E, #3C2433
appetizing fast food branding, rich ketchup red (#C72C41),
mustard yellow highlights (#D6A600), fresh lettuce green (#A3C703),
cheese orange accents (#FFA500), warm toasted brown (#A65E2E),
deep coffee background (#3C2433)
```

```
top-down burger hero shot, dark moody background #3C2433,
rich food styling with ketchup red and mustard yellow accents,
subtle steam, crisp lettuce green details
```

---

### 4.5 Fintech / Digital Marketing / SaaS — «converting, modern, authoritative»

| Роль | HEX | Описание |
|---|---|---|
| Фон / доминанта | #B4BDC6 | Светлый холодный серо-голубой |
| Вторичный | #657E98 | Средний slate blue-gray |
| Бренд-синий | #048CFC | Яркий, не неоновый голубой |
| Тёмный синий | #05478A | Для шапки/футера |
| Доп. синий | #5694DE | Для графиков и вторичных CTA |
| Тёмный текст | #333333 | Carbon для текста |

**Промпт-токены:**
```
color palette: #B4BDC6, #657E98, #048CFC, #05478A, #5694DE, #333333
modern fintech dashboard UI, light mode, soft cool gray-blue background (#B4BDC6),
card surfaces in slate blue-gray (#657E98), action buttons in bright blue (#048CFC),
top navigation in deep navy (#05478A), charts in soft blue (#5694DE),
high-contrast text in #333333
```

```
isometric fintech app hero illustration, trusted and secure feel,
cool blue palette, high-contrast CTA buttons, clean data visualizations,
no neon colors, no gradients, focus on clarity and trust
```

---

### 4.6 Dental / Medical / Clinic — «clean, professional, trustworthy»

Логика: белый/светло-серый + холодный синий-бирюзовый + зелёный для доверия и чистоты.

**Рекомендуемая схема:**
```
color palette: #FFFFFF, #EEF4F8, #1A6FA4, #2B9E84, #4A4A4A
clean medical aesthetic, pure white and soft light grey background (#EEF4F8),
professional blue accents (#1A6FA4), fresh teal-green highlights (#2B9E84),
dark grey typography (#4A4A4A), clinical clarity
```

---

## 5. Психология цвета — паттерны для промптов

| Задача | Промпт-фраза |
|---|---|
| Срочность / скидка | `warm accent colors for urgency, saturated red or orange only on key CTA buttons` |
| Доверие / надёжность | `cool blue and soft green tones for trust and stability, no aggressive warm accents, clean calm color grading` |
| Эксклюзивность / люкс | `muted warm neutrals, deep charcoal accents, subtle gold highlights, no bright primary colors, quiet luxury` |
| Уют / wellness / расслабление | `soft pastel palette, warm beige and blush tones, low contrast, gentle gradients, spa-like calming` |
| Высокие технологии / AI | `dark mode aesthetic with neon cyan and magenta accents, deep graphite background, digital futurism` |
| Аппетитность / еда | `warm rich food colors, appetizing saturated tones, ketchup red and mustard yellow accents` |

---

## 6. Финальный фреймворк — 5 шагов в промпте

**1. Задать палитру в цифрах:**
```
color palette: #..., #..., #...
```

**2. Распределить роли:**
```
dominant background color #..., secondary surfaces #..., accent color for buttons and highlights #...
```

**3. Психологический эффект:**
```
trustworthy fintech look / appetizing fast food branding / quiet luxury aesthetic / calming wellness vibe
```

**4. Свет и материалы:**
```
soft editorial lighting / volumetric light / brushed metal / marble / warm wood
```

**5. Ограничения (чего не должно быть):**
```
no neon colors, no high saturation, no rainbow palette, no harsh contrast, no pure white background
```

---

## 7. Цветовые тренды 2026

- **Transformative Teal** (WGSN + Coloro Color of the Year) — сложный тёплый бирюзовый. Сочетается с earth naturals (коричневые, бежи) и urgent brights (насыщенный красный, жёлтый).
- **Quiet luxury нейтралы** — warm taupe, creamy ivory, soft mushroom, muted olive.
- **Digital glow / iridium** — Digital Lavender, Glacier Blue, перламутровые тона. Мягкие светящиеся акценты на приглушённых фонах (tech, wellness).
- **Synthetic Naturalism** — землистые зелёные + аккуратные синтетические акценты (eco-бренды, mindful-tech).
- **Дофаминовые акценты** — солнечно-жёлтый, насыщенный бирюзовый, коралловый — точечно на CTA, не заливать половину макета.
- **Soft off-white** вместо чистого белого (#FFFFFF) — снижает усталость глаз, лучше поднимает контраст акцентов.

---

## Anti-patterns

| Ошибка | Почему плохо | Что вместо |
|---|---|---|
| 3+ конкурирующих ярких цвета | Визуальный хаос | Один доминант + один акцент |
| Одинаковые HEX для фона и CTA | Кнопка не читается | Акцент = дополнительный цвет к фону |
| Чистый белый (#FFFFFF) как фон | Устаёт глаз, нет теплоты | Off-white: #F2F1EF, #EEF4F8 |
| Все элементы одной насыщенности | Всё сливается | Градиент насыщенности: фон низкий, акцент высокий |
| «Cinematic color» без HEX | Модель решит сама | Прописывай конкретные коды |
| Тяжёлые кино-LUT для соцсетей | Убивает читаемость текста | Natural grading, balanced tones |

---

## Cross-reference

- Кинематографический цвет (эмоция → цвет для атмосферы) → `color-emotion.md`
- Премиальный свет, текстуры, тренды → `premium-visuals.md`
- Композиция кадра → `composition.md`
- Серия кадров с единой палитрой → `storyboard-and-shots.md`
