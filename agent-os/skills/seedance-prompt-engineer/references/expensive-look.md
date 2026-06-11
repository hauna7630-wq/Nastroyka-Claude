# Expensive Look — Анти-нейрослоп словарь

> Полный словарь токенов, которые переключают модель в режим кинофизики вместо «пластиковой» стоковой эстетики. В SKILL.md есть сжатая выжимка — этот файл для случаев, когда нужен максимальный контроль над «дорогим» видом.

Принцип: модели обучались на стоковом видео → дефолт «пластик» (идеальная кожа, ровная резкость, компьютерный свет). Лечение — конкретные токены реального кинопроизводства. **Конкретность > общность. Физика > эстетика. Бренды материалов активируют зашитые паттерны.**

Порядок в промпте важен: начинай с камеры и оптики — это якорные токены.

---

## БЛОК 1: Камеры и оптика

Название модели несёт «воспоминания» о тысячах кинопроизводств — цветопередачу, шум матрицы, динамический диапазон.

- `ARRI Alexa 35, Cooke S4 lens, 24mm focal length` — арт-хаус/студийное кино, тёплая органическая цветопередача
- `RED V-Raptor XL, Sigma Cine Prime, 40mm T1.5` — цифровая резкость высокого класса без пластика
- `Sony Venice 2, Zeiss Supreme Prime, 50mm T1.5` — кожаные тона, богатый теневой детал, рекламное кино
- `anamorphic 2.39:1 aspect ratio, oval bokeh highlights` — сжатые блики, горизонтальная флара
- `vintage glass imperfections, soft vignette roll-off, breathing focus` — «дышащий» фокус старой оптики
- `cinematic lens flare, anamorphic horizontal streaks, blue tinted flare` — Panavision/Hawk V-Lite блик
- `subtle chromatic aberration on edges, slightly soft wide open` — микро-аберрации убивают стерильность

❌ Анти-токены: `cinematic` (одно слово), `4K ultra HD`, `professional camera`, `sharp and clear footage`, `beautiful photography` — все дают стоковый/цифровой look.

---

## БЛОК 2: Киноплёнки

Название плёнки = кластер микроатрибутов: спектральная чувствительность, форма зерна, переход в пересвет.

- `Kodak Vision3 500T 5219, 35mm film grain` — высококонтрастная tungsten, тёплые тени, среднее зерно
- `Fuji Eterna 250D, cool highlights, fine grain structure` — дневная: холодные яркие пятна, плотные зелёные
- `Kodak 2383 film print emulation, D-min warm toe` — финальный кинопечатный процесс, оранжевый D-min
- `organic film grain, non-uniform grain structure, animated grain` — зерно движется покадрово, не статичный оверлей
- `cinematic halation, bloom on bright highlights, red halation fringe` — красный ореол вокруг пересветов
- `gate weave, subtle film weave 1-2px, organic frame instability` — микро-дрожание кадра от механизма

❌ Анти-токены: `film grain effect` (оверлей, не физика), `grainy`, `vintage look`, `retro aesthetic` — дают Instagram-фильтр, не плёнку.

---

## БЛОК 3: Глубина (3 плоскости)

AI по умолчанию рендерит «плоско» — одинаковая резкость везде. Принудительно разграничивай три слоя.

- `shallow depth of field, T1.4 wide open, creamy background separation`
- `foreground bokeh, blurred foliage in foreground frame, out-of-focus element in corners`
- `subject in sharp critical focus, tack-sharp subject plane`
- `volumetric background haze, atmospheric depth`
- `distinct foreground / midground / background planes, three-layer spatial depth`
- `foreground parallax, depth cue layers, natural depth gradient`

❌ Анти-токены: `deep depth of field`, `sharp background`, `everything in focus`, `crisp and detailed background` — всё в фокусе = плоский рендер.

---

## БЛОК 4: Микродетали и текстуры

Самый мощный антидот: требовать sub-pixel физику поверхностей. `visible skin pores` заставляет модель симулировать микрогеометрию → пластик исчезает.

- `visible skin pores, fine skin texture, natural skin imperfections, subtle facial asymmetry`
- `fine fabric weave texture, individual fiber detail, textile micro-detail`
- `tactile surface imperfections, micro scratches on surfaces, weathered material detail`
- `floating dust motes in backlight, dust particles in light beam` — мощнейший маркер реализма
- `subtle condensation on glass surface, water droplets micro-detail`
- `breath vapor in cold air, subtle hair strands catching light, stray hair backlit`
- `subsurface scattering on skin, translucency at ear edges, light through skin`

❌ Анти-токены: `perfect skin`, `flawless`, `smooth texture`, `clean and polished`, `hyper-realistic` (парадоксально даёт CG-look).

---

## БЛОК 5: Цветокоррекция и цветовая наука

Цветовые токены работают на уровне математики цветовых пространств — название LUT активирует тональное отображение тысяч проф-процессов.

- `ARRI Log-C color science, Alexa native color rendition` — S-кривая ARRI с характерным shoulder
- `Kodak 2383 print film LUT, D-min orange toe` — оранжевые тени классической киноплёнки
- `lifted black levels, open shadow detail` — поднятый чёрный = прямой маркер плёнки
- `subtle teal shadows and warm orange midtones, teal-and-orange grade` — Hollywood split-toning
- `moody high-contrast grade, cinematic contrast ratio, shadow fall-off`
- `desaturated highlights, muted color palette, naturalistic color rendition`
- `orange skin tones in tungsten light, blue practical window light` — контраст цветовых температур (Деакинс/Любецки)

❌ Анти-токены: `vibrant colors`, `color enhanced`, `vivid and saturated`, `beautiful colors`, `HDR colors` — гиперсатурация/TV-look.

---

## МАСТЕР-СБОРКА (порядок блоков)

Для максимального анти-нейрослоп эффекта собирай в этом порядке:

```
Shot on ARRI Alexa 35, Cooke S4 32mm lens, T2.0, 2.39:1 anamorphic format,
anamorphic horizontal lens flare, oval bokeh in background highlights,
vintage glass imperfections, subtle chromatic aberration on frame edges.

Kodak Vision3 500T film emulation, organic animated film grain,
cinematic halation on practical lights, Kodak 2383 print LUT,
subtle gate weave, lifted black levels with warm D-min toe.

Shallow depth of field, out-of-focus foreground element in corners,
subject in tack-sharp critical focus, volumetric atmospheric background haze,
three distinct spatial planes with natural depth gradient.

Visible skin pores and natural skin texture, individual hair strands backlit,
floating dust motes in backlit atmosphere, subsurface scattering on skin,
tactile surface imperfections on surrounding materials.

ARRI Log-C color science, teal-and-orange grade, desaturated highlights,
warm amber tungsten practicals, cool blue window light,
moody cinematic contrast ratio with open shadow detail.
```

**Negative prompt (для моделей с поддержкой):**
`plastic look, synthetic, CGI, oversharpened, stock footage, digital noise`

⚠️ Не вали все 5 блоков на каждый промпт — это съест лимит символов. Бери 2-3 блока под задачу: для портрета — камера + микродетали + цвет; для пейзажа — камера + глубина + цвет.
