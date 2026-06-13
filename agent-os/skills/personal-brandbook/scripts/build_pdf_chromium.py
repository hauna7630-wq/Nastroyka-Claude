#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Рендер HTML-брендбука в PDF через настоящий Chromium (Playwright).
Движок для «дизайнерского» варианта: градиенты, сложная сетка, тонкая типографика.

КИРИЛЛИЦА: скрипт встраивает кириллические шрифты прямо в HTML через @font-face
с base64. Браузеру не нужно искать шрифт в системе — он всегда внутри документа,
поэтому кириллица отображается корректно на любой машине. По умолчанию встраиваются
шрифты из ../assets/fonts (DejaVu Serif/Sans). Семейства называются 'BB Serif' и
'BB Sans' — используйте их в CSS шаблона.

Установка (один раз):
    pip install playwright pypdf --break-system-packages
    playwright install chromium
    # Если установка обрывается по timeout — см. инструкции в скилле html-to-pdf.

Использование:
    python build_pdf_chromium.py --input brandbook.html --output "Брендбук.pdf"

Если Chromium недоступен — используйте build_pdf_reportlab.py (тоже с кириллицей).
"""

import argparse
import base64
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSET_FONTS = os.path.join(SCRIPT_DIR, "..", "assets", "fonts")
SYS_DEJAVU = "/usr/share/fonts/truetype/dejavu"


def _find(name):
    for d in (ASSET_FONTS, SYS_DEJAVU):
        p = os.path.join(d, name)
        if os.path.isfile(p):
            return p
    return None


def font_face_css():
    """Собирает @font-face с base64 для кириллических шрифтов."""
    faces = [
        ("BB Serif", "DejaVuSerif.ttf", 400),
        ("BB Serif", "DejaVuSerif-Bold.ttf", 700),
        ("BB Sans", "DejaVuSans.ttf", 400),
        ("BB Sans", "DejaVuSans-Bold.ttf", 700),
    ]
    css = []
    for family, fname, weight in faces:
        path = _find(fname)
        if not path:
            continue
        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        css.append(
            f"@font-face{{font-family:'{family}';font-style:normal;"
            f"font-weight:{weight};src:url(data:font/ttf;base64,{b64}) format('truetype');}}"
        )
    if not css:
        sys.exit("Не найдены шрифты с кириллицей в assets/fonts или системе DejaVu.")
    return "<style>" + "".join(css) + "</style>"


def inject_fonts_and_print_css(html):
    """Встраивает шрифты и базовые правила печати в <head> (или в начало)."""
    print_css = """
<style>
@page { size: A4; margin: 0; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; }
.page, section.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
.avoid-break { page-break-inside: avoid; }
</style>
"""
    inject = font_face_css() + print_css
    low = html.lower()
    if "<head>" in low:
        idx = low.index("<head>") + len("<head>")
        return html[:idx] + inject + html[idx:]
    return inject + html


def main():
    ap = argparse.ArgumentParser(description="HTML→PDF через Chromium с встроенной кириллицей.")
    ap.add_argument("--input", required=True, help="Путь к HTML-файлу брендбука")
    ap.add_argument("--output", required=True, help="Путь к итоговому PDF")
    ap.add_argument("--margin", default="0", help="Поля страницы, напр. '0' или '15mm'")
    args = ap.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("Playwright не установлен. Установите: pip install playwright --break-system-packages "
                 "&& playwright install chromium. Либо используйте build_pdf_reportlab.py.")

    with open(args.input, encoding="utf-8") as f:
        html = f.read()
    html = inject_fonts_and_print_css(html)

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page()
        page.set_content(html, wait_until="networkidle")
        page.pdf(
            path=args.output,
            format="A4",
            print_background=True,
            margin={"top": args.margin, "bottom": args.margin,
                    "left": args.margin, "right": args.margin},
            prefer_css_page_size=True,
        )
        browser.close()
    print("PDF готов:", args.output)


if __name__ == "__main__":
    main()
