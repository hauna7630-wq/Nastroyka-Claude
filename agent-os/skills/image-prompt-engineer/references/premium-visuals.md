# Premium Visuals: composition, lighting, color (2025–2026)

Reference for making AI images look "expensive" — not over-glossed, but intentional. Read when the task is brand campaign, luxury product, premium creative, or any case where "обычно AI-картинка" — not enough.

---

## Композиция

### Правило третей и золотое сечение

Главное правило премиального вида: субъект НЕ в геометрическом центре.

**Промпт-паттерны:**
- `rule of thirds composition, subject placed on right third, looking into negative space on the left`
- `phi grid composition, elegant perfume bottle slightly off-center, visual weight balanced by background elements`
- `breathing room / negative space in front of the subject`

**Используй:**
- `off-center subject`, `placed on left/right third`, `balanced visual weight`
- Свободная сторона по направлению взгляда / движения

**Избегай:**
- Просто `centered composition` — даёт «средний паспорт», скучно
- Все важные объекты в одной центральной линии

### Linии, рамки, глубина

Лидирующие линии (дороги, перила, столешницы, световые полосы) ведут взгляд и делают кадр «дороже».
Естественные рамки (дверные проёмы, арки, окна, размытые передние объекты) добавляют глубины.

**Промпт-паттерны:**
- `subtle leading lines from the floor lights guiding the eye to the model`
- `natural framing with doorway and curtains, soft blurred foreground`
- `foreground elements slightly out of focus` — убирает «плоский AI-рендер»
- `vanishing point behind the hero object`

**Don't:**
- Слишком много пересекающихся линий → визуальный шум
- Все линии строго горизонтальные / вертикальные → статика. Лёгкие диагонали = динамика.

### Симметрия vs асимметрия

- **Симметрия** — luxury, архитектура, fashion-кампейны. Ощущение статуса и иконичности.
  `perfect symmetry, central perspective, high-end architectural shot`
- **Асимметрия с балансом** — lifestyle, UGC, динамика.
  `asymmetrical balanced composition, subject off-center, background elements counterbalancing the frame`

Не ломай симметрию мелочами (случайный объект, текст). Не забывай про баланс — асимметрия ≠ всё в одном углу.

### Негативное пространство

Один из ключевых признаков «дорогой» визуалки. Масс-маркет забивает кадр деталями и текстом. Luxury и современный дизайн оставляют воздух.

- 30–60% кадра — пустые или с мягким градиентом / размытым фоном
- Объект ниже / выше центра — простор для текста, логотипа или просто «тишины»

**Промпт-паттерны:**
- `minimal negative space background, clean gradient, hero product in the lower third`
- `ample negative space for copy, soft blurred environment`
- `plenty of negative space`, `minimalist background`, `room for text at the top`

Под AI-видео и ads сразу думай про safe-zones интерфейсов — оставляй центр и верхнюю треть свободнее.

**Don't:** `highly detailed background everywhere` — несовместимо с премиальностью.

---

## Свет

### Golden hour и blue hour

- **Golden hour** — час после рассвета / перед закатом. Тёплый, мягкий, низкий, длинные тени.
  `shot during golden hour, warm low sunlight, long soft shadows`
- **Blue hour** — после заката до темноты. Холодный, глубокий синий/фиолетовый, мягкий контраст.
  `blue hour cityscape, deep cobalt sky, subtle glowing lights, soft contrast`

Прямо указывай тип + температуру: `warm golden tones` vs `cool blue tones`.
Не смешивай `golden hour` с `harsh midday sun` в одном промпте.

### Soft vs hard light

- **Soft light** — основа премиальной beauty, fashion, luxury product-съёмки.
  `soft diffused light, large window light, gentle shadows, high-end beauty campaign`
  `soft diffused studio lighting, subtle specular highlights`
- **Hard light** — драматичные, кинематографичные кадры.
  `hard directional light from above, strong defined shadows, cinematic look`
  `strong contrasty side light, chiaroscuro, deep shadows`

Не оставляй свет неопределённым (`nice lighting`) — модель заполнит как попало.

### Направление света

| Направление | Эффект | Промпт |
|---|---|---|
| Front | Мало объёма, «инстаграмный» | `front-facing soft light` |
| Side | Объём, фактура, портреты, товары | `soft side light from camera left, subtle shadows on the opposite side` |
| Backlight / rim | Контурный, отделяет от фона, luxury блики | `backlit scene with warm rim light highlighting hair and shoulders, soft fill from the front` |

Всегда указывай источник: `from camera left/right`, `from above`, `from behind`.

Для премиального вида часто добавляй rim / hair light: `subtle rim light separating subject from dark background`.

Не перебарщивай с несколькими rim-светами со всех сторон — получится фейковый 3D.

### Кино-схемы (готовый язык для AI)

- **Rembrandt lighting** — треугольник света на теневой стороне лица. Кинематографичный портрет.
- **Split lighting** — половина лица в свете, половина в тени. Драма.
- **Loop lighting** — мягкая тень от носа. Базовый портрет.
- **Butterfly lighting** — свет сверху по центру. Beauty / fashion.
- **Chiaroscuro** — сильный контраст света и тени. Кино, искусство.

---

## Цвет и грейдинг

### Палитры 2025–2026

- **Cherry red** — насыщенный акцентный цвет, тренд у Gen Z и millennials. Хорошо для CTA, текста, рамок.
- **Dark mode + neon** — тёмные фоны + неоновые акценты. Технологичность, AI/финтех/digital-futurism.
- **Aura effect** — высоконасыщенные градиенты, свечение / ореол вокруг объектов и текста (стиль Spotify Wrapped).
- **Тёмно-синий + неоновый оранжевый** — высокий контраст, футуристично.
- **Натуральный skin-tone** — для UGC / lifestyle / инфлюенсерского контента. Лёгкая цветокоррекция, не «перегрейженный TVC».

### Промпт-паттерны

- `cinematic color grade with teal-orange palette`
- `desaturated cold color grade with warm highlights`
- `aura effect with vibrant gradient halo around the subject`
- `dark mode aesthetic with neon cyan and magenta accents`
- `natural daytime grading, balanced skin tones, no heavy filter`

### Что использовать осторожно

- Тяжёлые киношные LUT-ы — убивают читаемость текста и деталей на маленьком экране (для соцсетей)
- Перегрейженные клипы в духе TVC — снижают вовлечённость в TikTok / Reels
- 3+ конкурирующих доминантных цвета в одном кадре

---

## Текстуры и материалы

Премиальный вид часто делается через тактильные, осознанные текстуры:

- `brushed gold surface, soft reflections, warm highlights`
- `dark marble with subtle veins, low-key dramatic lighting`
- `black velvet background, matte texture, deep shadows`
- `frosted glass surface, soft diffuse reflections`
- `weathered linen fabric, natural folds, soft tonal shifts`
- `polished concrete floor, subtle reflections, neutral grey tones`

---

## Глубина резкости и оптика

| Эффект | Промпт |
|---|---|
| Очень мелкая глубина (boке) | `f/1.4 to f/1.8, extreme bokeh, subject sharp, background fully blurred` |
| Естественный портрет | `f/2.8, shallow depth of field, soft background separation` |
| Lifestyle | `f/4 to f/5.6, natural depth, environment readable` |
| Архитектура / интерьер | `f/8 to f/11, deep focus, sharp throughout` |

Объективы как референс:
- `35mm` — wide, lifestyle, репортаж
- `50mm` — естественная перспектива, документально
- `85mm` — портрет, beauty
- `medium format` — fashion editorial, премиум

---

## Готовые «премиум» blocks для STYLE

**Beauty / fashion editorial:**
```
Editorial beauty photography, medium format camera, 80mm lens, shallow depth of field,
soft natural skin tones with visible micro-texture, magazine-quality composition,
cinematic color grade with subtle warm highlights and cool shadows, premium fashion editorial feel.
```

**Luxury product:**
```
Luxury commercial product photography, low-key dramatic lighting, single source from upper left,
deep shadows, premium material textures visible, cinematic color grading: deep blacks and warm highlights,
ultra-premium aesthetic, no people, no extraneous elements.
```

**Cinematic still:**
```
Cinematic still frame from a [genre] film, anamorphic lens feel, 35mm film aesthetic,
subtle grain, [color grade: teal-orange / desaturated cold / warm golden], shallow depth of field,
deliberate composition, mood-driven lighting.
```

**Modern lifestyle (premium UGC):**
```
Natural lifestyle photography, candid moment, soft afternoon daylight,
35mm lens at f/2.8, balanced color grade with slight warmth, lived-in environment with intentional details,
honest unposed feel, editorial-quality but not glossy.
```

---

## Чек-лист «дорогого» AI-промпта

Перед отправкой пройдись:

- [ ] Субъект не в центре (rule of thirds или phi grid)
- [ ] Указан конкретный источник и направление света
- [ ] Указан тип / качество света (soft / hard, golden / blue hour, kino-схема)
- [ ] Есть глубина: leading lines, foreground bokeh, framing
- [ ] Есть негативное пространство (если уместно)
- [ ] Указана оптика и DoF (объектив + f-stop)
- [ ] Цветовой грейдинг описан конкретно (teal-orange, desaturated, warm)
- [ ] Текстуры материалов прописаны
- [ ] Нет токсичных слов: `8K`, `perfect`, `smooth`, `flawless`, `masterpiece`
- [ ] Один доминирующий стиль — не миксован с другими
