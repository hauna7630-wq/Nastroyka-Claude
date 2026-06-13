# Lighting & Genre — Свет по времени суток, погоде и жанрам

> Готовые физические формулы. Логика: **источник → угол → Kelvin → характер тени → строка для промпта**. AI реагирует на `45° overhead point source at 2800K with hard shadow edges` несравнимо лучше, чем на `dramatic moody light`. Комбинируй блоки: `Evening Golden Hour` + `Heavy Rain` + `Film Noir` = уникальный физически точный стек.

---

## ВРЕМЯ СУТОК

### Dawn / Рассвет
- **Kelvin:** 2000–3200K | **Угол:** солнце −5°…+5°, почти горизонтальный, рассеянный glow, нет жёсткого диска
- **Тени:** очень длинные soft, строго на запад, широкая penumbra, нет hard core
```
pre-dawn exterior, sun at 3° elevation, 2800K warm orange-red atmospheric glow
diffused omnidirectional skylight fill, ultra-long soft-edged shadows pointing west
wide 80% penumbra ratio, no hard solar disk, ground-level light scattering haze, low contrast
```

### Morning Golden Hour
- **Kelvin:** 3200–4500K | **Угол:** солнце 5°–20°, сильный боковой directional + blue skylight fill 12000K сверху
- **Тени:** длинные hard, 3–5× высоты объекта, warm/cool split sun vs sky
```
morning golden hour exterior, sun at 15° elevation, 3500K warm golden key light
strong directional side light, long cast shadows 4x object height pointing west-northwest
moderate penumbra with defined shadow edges, blue skylight fill overhead at 12000K, warm ground bounce fill
```

### High Noon
- **Kelvin:** 5500–6500K | **Угол:** солнце 85°–90° зенит, overhead
- **Тени:** короткие 0.1–0.2× высоты, прямо вниз, hard, near-zero penumbra, чёрные глазницы и под подбородком
```
high noon exterior, sun at 88° elevation directly overhead, 6000K neutral white light
minimal shadow length 0.15x object height, hard shadow edges below objects
deep black under-eye and under-chin shadow pools, near-zero penumbra, high
```

### Overcast / Облачно
- **Kelvin:** 6500–8000K | **Угол:** весь небосвод как softbox 180°, omnidirectional, нет directional key
- **Тени:** почти нет, очень soft, penumbra 90%+, ratio 1:3, мuted saturation
```
overcast exterior, full cloud cover as 180° diffusion dome, 7200K cool grey ambient
omnidirectional illumination, no directional shadows, ultra-wide penumbra diffused shadows only
near-flat 1:3 lighting ratio, no specular highlights, muted saturation
```

### Evening Golden Hour
- **Kelvin:** 2800–4000K (теплее утреннего) | **Угол:** солнце 5°–20° западный горизонт, rim/backlight на объект
- **Тени:** длинные на восток, blue-purple tint от skylight fill в теневых зонах
```
evening golden hour, sun at 10° above western horizon, 3000K deep warm amber backlight
strong rim lighting on subjects facing east, long cast shadows extending eastward at 4x subject height
hard shadow edges with blue-purple shadow fill from overhead sky, warm-cold color split
```

### Blue Hour
- **Kelvin:** 8000–12000K ambient + warm artificial accents 2200–3000K
- **Тени:** очень soft omnidirectional, нет directional cast, dramatic blue/amber contrast zones
```
blue hour exterior, sun at -5° below horizon, 10000K deep blue ambient skylight
omnidirectional soft fill at, no solar shadows, warm 2700K artificial streetlight
and window accents at, strong blue-orange chromatic split, near-shadowless
```

### Outdoor Night
- **Kelvin:** mixed — sodium street 2100K amber, LED street 4500K, sky glow 4000–5000K
- **Тени:** multiple hard под каждым источником, длинные за пределами pools, crushed blacks между
```
outdoor night street, sodium vapor streetlights at 2100K amber overhead at 80° angle ground illumination pools, hard shadows directly below each light
deep shadow zones between pools 2-, multiple competing shadow directions, wet asphalt reflections
```

### Studio Night
- **Kelvin:** 3200K tungsten / 5600K daylight-balanced | **Setup:** key 45°/45° (Rembrandt) или 30°/30°, fill 4:1, rim 135°
- **Тени:** fully controllable, Rembrandt triangle, true black без fill
```
studio portrait, black environment, single 5600K key at 45° horizontal and 40° elevation
large softbox, 4:1 key-to-fill ratio with white reflector fill, rim at 135° at 60% key intensity
black backdrop absorbing all spill, shadow zones to pure black
```

### Interior Day
- **Kelvin:** mixed — window 6000–7000K soft, interior fixtures 2700–3000K warm
- **Тени:** soft wide penumbra если overcast снаружи; hard shaft с dust motes (Tyndall) если direct sun
```
interior daytime, large north-facing window as primary soft source at 6500K
window 90° camera-left, soft shadow with, warm 2800K ceiling fixtures
at 10% window intensity, mixed color temperature, warm wall bounce fill
```

### Interior Night
- **Kelvin:** 1800–2700K dominant + TV/screen 6500K accent | **Источники:** лампы, свечи 1800K flickering, экраны
- **Тени:** hard multiple от каждого point source, warm lower-half, crushed blacks
```
interior night, single 2700K floor lamp at 0.8m height within 1m
hard shadows radiating from lamp base, deep unlit ceiling
secondary 6500K television screen flickering fill at 30° angle, mixed warm/cool zones, high contrast
```

---

## ПОГОДА (накладывается поверх времени суток)

### Heavy Rain
```
wet asphalt 65% specular reflectivity, all light sources mirrored in ground plane
rain streaks backlit as bright silver diagonal lines, micro-drop splash crowns at ground level
puddle impact rings, rain curtain reducing visibility to 40m
```

### Dense Fog
```
dense fog, visibility reduced to 25m, volumetric atmosphere, all light sources as conical visible beams
6500K grey-white ambient scatter, objects at 20m at 30% opacity, objects at 30m dissolved into white haze
no hard shadows beyond 3m, spherical halo aureoles around streetlights
```

### Snow
```
snow-covered ground, 85% albedo upward fill light, overcast 7500K downward soft key
both sources canceling shadows to near-zero depth, 1:3 contrast ratio
subtle blue shadow fill on vertical surfaces, snowfall particles as white bokeh in midground
```

### Extreme Heat
```
extreme heat, 6000K bleached overhead, tarmac surface generating thermal shimmer layer at 0-40cm height
heat haze distortion of background objects at 3Hz wavering frequency
mirage patches on flat surfaces at grazing angles, blown specular highlights on metal and glass
```

---

## ЖАНРОВЫЕ ФОРМУЛЫ

### Film Noir
```
film noir lighting, single bare tungsten 3000K at 75° camera-right and 50° above eyeline
16:1 key-to-fill ratio no fill, deep black shadow covering 65% of face
venetian blind shadow bars across subject, hard zero-penumbra shadow edges, desaturated warm amber grade
```

### Cyberpunk / Neon
```
cyberpunk night, magenta neon camera-right + cyan neon camera-left,
wet asphalt 70% specular doubling all neon sources in ground reflection
overhead harsh LED streetlight 4500K creating top-down white shadows, deep unlit zones true black
colored shadow penumbra in overlap zones
```

### Horror
```
horror lighting, single flickering fluorescent 3800K with +25 green channel shift creating sickly yellow-green cast
source below eyeline at 30cm floor height creating inverted upward shadows on face
1.5 stops underexposed, deep black zones in all corners, intermittent 1-second flicker dropout
80% of scene in crushed shadow
```

### Romantic
```
romantic lighting, large 3500K softbox key at 30° above and 30° camera-left, 2:1 key-to-fill ratio
strong 2900K backlight at 160° position creating warm hair rim and edge glow
soft shadows with transition, string light practicals at 2200K background bokeh
slight atmospheric haze scatter around highlights
```

### Documentary
```
documentary, natural available light only, mixed color temperature interior:
2800K overhead tungsten practicals and 6000K window light simultaneously, no artificial fill
hand-held camera with natural micro-movement 2° roll variation, slight motion blur on pans
authentic uncontrolled shadow depth
```

### Premium Commercial
```
premium commercial product lighting, 200x150cm octabox key at 5600K CRI97
20° elevation and 30° horizontal offset, 1:1.3 key-to-fill near-shadowless
dual rim lights at 120° and 240° at 60% key intensity, white background blown to RGB 250-250-250
zero shadow contamination, clean thin rim highlight defining product silhouette
```

---

## Cross-reference
- Базовое правило: свет физически, не эмоционально → SKILL.md §5
- Атмосферный цвет (ambient tint, color cast) → `montage-assembly.md`
- Цветовая наука и grade (LUT, Log-C, teal-orange) → `expensive-look.md` Блок 5
