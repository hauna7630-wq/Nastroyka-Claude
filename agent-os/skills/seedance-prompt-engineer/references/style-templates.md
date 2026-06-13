# Style Templates — Готовые шаблоны промптов по стилям

> Скелеты под основные стили. Заполняй квадратные скобки, вливай анти-нейрослоп токены (`expensive-look.md`) и формулы света (`lighting-genre.md`) под задачу.

## Голливуд / Экшен (speed ramp + хаотичная камера)
```
[ACT 1: НАЗВАНИЕ СЦЕНЫ]

LOCATION: [место, условия, атмосфера]

REFERENCE ASSIGNMENT:
- Protagonist (@image1): Strict identity preservation. Exact face and outfit. No morphing.

STYLE: Hollywood Epic Movie. Hyper-chaotic unstabilized handheld motion, constant micro-jitters, abrupt jerks. Photorealistic, 35mm film look, heavy grain, ARRI ALEXA aesthetic, focus breathing, motion blur, halation on highlights, slightly desaturated. No 3D, no cartoon, no VFX.
CRITICAL: The frame must be a perfectly clean flat rectangle with NO dark edges, NO dark corners, NO tunnel effect, NO circular darkening, NO fisheye shadow. Image fills the entire frame edge-to-edge with full brightness to every corner.

STORY: [что происходит]
CHARACTERS: [персонаж, настроение, детали внешности]

Audio: No music. [звуки: удары, шаги, крики, окружение]
Duration: [N]s. Aspect Ratio: 21:9.

[00–Xs] - THE [НАЗВАНИЕ]
Action: [действие]
Emotional Acting: [микромимика]
Camera: [shot], orbital sweep [N] degrees around [объект], then snap [N] degrees to opposite side
Lighting & VFX: [источник света, эффекты]
Physics: [детали — отражения, волосы, ткань, пот]
IMPORTANT: [специфический запрет — например, zero sparks near skin]

[Xs–Ys] - THE [НАЗВАНИЕ]
RAMP TO EXTREME SLOW MOTION.
Action: [действие]
Emotional Acting: [микромимика]
Camera: extreme close-up, [детали]
Physics: [детали физики в слоу-мо]

[Ys–Zs] - THE [НАЗВАНИЕ]
SNAP TO REAL TIME.
Action: [действие]
Camera: aggressive [N]-degree orbital sweep, shaky handheld

Constraints: maintain @Image1's face exactly, clean anatomy, no extra limbs, strong temporal consistency.
```

## Реализм / UGC
```
Total: 8 seconds, 9:16 vertical, 24 fps, 1 continuous shot.
@Image1 as main character identity

Subject: @Image1, [описание — возраст, одежда]
Action: [конкретное действие]
Environment: [локация, время суток, ключевые детали]
Camera: medium tracking shot, eye-level, 35mm lens, subtle handheld feel
Style: grounded cinematic, realistic skin texture, [свет физически], soft film grain
Constraints: maintain @Image1's face and outfit exactly, no morphing, no extra people, no text on screen, zero flicker.
```

## Реклама / продукт
```
Total: 6 seconds, 9:16 vertical, 24 fps, 1 continuous shot.
@Image1 as product reference

Subject: [продукт, конкретно]
Action: [действие с продуктом или камерой]
Environment: [стол/поверхность, фон, свет]
Camera: locked tripod / slow orbit 90°, [angle], [lens], shallow depth of field
Style: premium commercial, [свет физически — softbox / key + rim], neutral premium color grade
Constraints: no texture crawl, controlled specular highlights, no jitter, physically correct reflections.
```

## Аниме
```
Total: 8 seconds, 16:9, 24 fps, 1 continuous shot.
@Image1 as main character design reference

Subject: @Image1, [персонаж]
Action: [действие]
Environment: [локация, время суток]
Camera: [shot size], [movement], eye-level
Style: [тип аниме], [свет], [цветовая палитра], clean line art
Constraints: keep @Image1's face consistent, no deformation, smooth cloth and hair motion.
```

## TikTok / динамика
```
Total: 10 seconds, 9:16 vertical, 24 fps, [N] shots.
@Image1 as main character identity
@Audio1 as music, sync cuts to the beat

[00:00–00:03] [shot 1]
[00:03–00:07] [shot 2]
[00:07–00:10] [shot 3]

Style: high-energy music video aesthetic, [свет], strong contrast, clean silhouettes
Constraints: maintain @Image1 across all shots, cuts timed to @Audio1 beats, no ghosting.
```
