#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
convert_images.py — переформатирование картинок товаров в PNG.

Магазины часто отдают фото в AVIF, WebP или JPG. Для предсказуемого
отображения в сайте-гардеробе всё приводится к PNG.

Использование:
    python3 convert_images.py <папка-или-файл> [--keep]

    <папка>  — конвертирует все .jpg/.jpeg/.avif/.webp внутри неё (рекурсивно)
    <файл>   — конвертирует один файл
    --keep   — оставить исходные файлы (по умолчанию исходник удаляется
               после успешной конвертации, чтобы в images/ остался чистый PNG)

Бэкенды (по очереди, что найдётся): Pillow → ImageMagick → ffmpeg.
Если AVIF не конвертится через Pillow, поставь плагин:
    pip install pillow-avif-plugin --break-system-packages
"""
import os
import sys
import shutil
import subprocess

SRC_EXT = (".jpg", ".jpeg", ".avif", ".webp")


def convert_one(src, dst):
    """Конвертирует один файл src -> dst (PNG). Возвращает True при успехе."""
    # --- бэкенд 1: Pillow ---
    try:
        try:
            import pillow_avif  # noqa: F401  (регистрирует AVIF-плагин, если установлен)
        except ImportError:
            pass
        from PIL import Image
        with Image.open(src) as im:
            if im.mode in ("RGBA", "LA", "P"):
                im = im.convert("RGBA")
            else:
                im = im.convert("RGB")
            im.save(dst, "PNG")
        return True
    except Exception:
        pass

    # --- бэкенд 2: ImageMagick ---
    for tool in ("magick", "convert"):
        if shutil.which(tool):
            try:
                subprocess.run([tool, src, dst], check=True, capture_output=True)
                if os.path.exists(dst):
                    return True
            except Exception:
                pass

    # --- бэкенд 3: ffmpeg ---
    if shutil.which("ffmpeg"):
        try:
            subprocess.run(["ffmpeg", "-y", "-i", src, dst],
                           check=True, capture_output=True)
            if os.path.exists(dst):
                return True
        except Exception:
            pass

    return False


def collect(path):
    """Список файлов-картинок для конвертации."""
    if os.path.isfile(path):
        return [path] if path.lower().endswith(SRC_EXT) else []
    files = []
    for root, _dirs, names in os.walk(path):
        for n in names:
            if n.lower().endswith(SRC_EXT):
                files.append(os.path.join(root, n))
    return files


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    keep = "--keep" in sys.argv

    if not args:
        print("Использование: python3 convert_images.py <папка-или-файл> [--keep]")
        sys.exit(1)

    target = args[0]
    if not os.path.exists(target):
        print("Не найдено:", target)
        sys.exit(1)

    files = collect(target)
    if not files:
        print("Нечего конвертировать (нет .jpg/.jpeg/.avif/.webp).")
        return

    ok, fail = 0, []
    for src in files:
        dst = os.path.splitext(src)[0] + ".png"
        if convert_one(src, dst):
            ok += 1
            print("  ✓", os.path.basename(src), "→", os.path.basename(dst))
            if not keep and os.path.abspath(src) != os.path.abspath(dst):
                try:
                    os.remove(src)
                except OSError:
                    pass
        else:
            fail.append(src)
            print("  ✗ не удалось:", os.path.basename(src))

    print("\nГотово: {}/{} в PNG.".format(ok, len(files)))
    if fail:
        print("Не сконвертировано:", len(fail))
        if any(f.lower().endswith(".avif") for f in fail):
            print("Для AVIF поставь плагин: "
                  "pip install pillow-avif-plugin --break-system-packages")


if __name__ == "__main__":
    main()
