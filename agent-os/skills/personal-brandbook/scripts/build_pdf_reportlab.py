#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сборка персонального брендбука в PDF через reportlab.

ГЛАВНОЕ: корректная кириллица. Скрипт регистрирует TTF-шрифты с кириллическими
глифами (по умолчанию — DejaVu Serif / DejaVu Sans, лежащие рядом в ../assets/fonts).
Без явной регистрации шрифта reportlab берёт встроенные Type-1 шрифты (Helvetica и т.п.),
у которых НЕТ кириллицы, и текст превращается в квадраты. Поэтому регистрация шрифтов
здесь обязательна и происходит до любой отрисовки.

Использование:
    python build_pdf_reportlab.py --spec brand_spec.json --output "Брендбук.pdf"

Опционально можно подменить шрифты (обязательно с кириллицей!):
    --serif /path/Regular.ttf --serif-bold /path/Bold.ttf
    --sans  /path/Regular.ttf --sans-bold  /path/Bold.ttf
"""

import argparse
import json
import os
import sys

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Frame
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSET_FONTS = os.path.join(SCRIPT_DIR, "..", "assets", "fonts")
SYS_DEJAVU = "/usr/share/fonts/truetype/dejavu"

# Логические имена шрифтов, которыми пользуемся ниже.
F_SERIF = "BB-Serif"
F_SERIF_B = "BB-Serif-Bold"
F_SANS = "BB-Sans"
F_SANS_B = "BB-Sans-Bold"


def _first_existing(*paths):
    for p in paths:
        if p and os.path.isfile(p):
            return p
    return None


def register_fonts(args):
    """Регистрирует кириллические TTF. Падает с понятной ошибкой, если не нашёл."""
    serif = _first_existing(
        args.serif,
        os.path.join(ASSET_FONTS, "DejaVuSerif.ttf"),
        os.path.join(SYS_DEJAVU, "DejaVuSerif.ttf"),
    )
    serif_b = _first_existing(
        args.serif_bold,
        os.path.join(ASSET_FONTS, "DejaVuSerif-Bold.ttf"),
        os.path.join(SYS_DEJAVU, "DejaVuSerif-Bold.ttf"),
    )
    sans = _first_existing(
        args.sans,
        os.path.join(ASSET_FONTS, "DejaVuSans.ttf"),
        os.path.join(SYS_DEJAVU, "DejaVuSans.ttf"),
    )
    sans_b = _first_existing(
        args.sans_bold,
        os.path.join(ASSET_FONTS, "DejaVuSans-Bold.ttf"),
        os.path.join(SYS_DEJAVU, "DejaVuSans-Bold.ttf"),
    )

    missing = [n for n, p in [("serif", serif), ("serif-bold", serif_b),
                              ("sans", sans), ("sans-bold", sans_b)] if not p]
    if missing:
        sys.exit(
            "Не найдены шрифты с кириллицей: " + ", ".join(missing) +
            ".\nПоложите DejaVu TTF в assets/fonts/ или передайте пути через --serif/--sans."
        )

    pdfmetrics.registerFont(TTFont(F_SERIF, serif))
    pdfmetrics.registerFont(TTFont(F_SERIF_B, serif_b))
    pdfmetrics.registerFont(TTFont(F_SANS, sans))
    pdfmetrics.registerFont(TTFont(F_SANS_B, sans_b))


class BrandBook:
    def __init__(self, spec):
        self.s = spec
        c = spec.get("colors", {})
        self.c_primary = HexColor(c.get("primary", "#1A1A2E"))
        self.c_accent = HexColor(c.get("accent", "#C9A227"))
        self.c_text = HexColor(c.get("text", "#2B2B2B"))
        self.c_muted = HexColor(c.get("muted", "#6B6B6B"))
        self.c_light = HexColor(c.get("light", "#F5F3EE"))
        self.name = spec.get("name", "Имя Фамилия")
        self.footer_contact = spec.get("footer_contact", "")
        self.canvas = None
        self.page_num = 0

    # ---------- инфраструктура страниц ----------
    def new_page(self, light_bg=True):
        if self.page_num > 0:
            self.canvas.showPage()
        self.page_num += 1
        if light_bg:
            self.canvas.setFillColor(self.c_light)
            self.canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        return PAGE_H - MARGIN  # верхняя граница контента

    def footer(self):
        y = 12 * mm
        self.canvas.setStrokeColor(self.c_accent)
        self.canvas.setLineWidth(0.6)
        self.canvas.line(MARGIN, y + 4 * mm, PAGE_W - MARGIN, y + 4 * mm)
        self.canvas.setFont(F_SANS, 8)
        self.canvas.setFillColor(self.c_muted)
        self.canvas.drawString(MARGIN, y, self.name)
        if self.footer_contact:
            self.canvas.drawCentredString(PAGE_W / 2, y, self.footer_contact)
        self.canvas.drawRightString(PAGE_W - MARGIN, y, str(self.page_num))

    def section_header(self, top, title):
        """Тёмная плашка заголовка раздела, возвращает Y под ней."""
        h = 13 * mm
        self.canvas.setFillColor(self.c_primary)
        self.canvas.rect(MARGIN, top - h, PAGE_W - 2 * MARGIN, h, fill=1, stroke=0)
        self.canvas.setFillColor(self.c_accent)
        self.canvas.rect(MARGIN, top - h, 3 * mm, h, fill=1, stroke=0)
        self.canvas.setFont(F_SERIF_B, 16)
        self.canvas.setFillColor(white)
        self.canvas.drawString(MARGIN + 8 * mm, top - h + 4.3 * mm, title)
        return top - h - 8 * mm

    def para(self, text, x, y, width, font=F_SANS, size=10.5, color=None,
             leading=None, align=TA_LEFT):
        color = color or self.c_text
        leading = leading or size * 1.45
        style = ParagraphStyle(
            "p", fontName=font, fontSize=size, leading=leading,
            textColor=color, alignment=align,
        )
        p = Paragraph(text.replace("\n", "<br/>"), style)
        w, h = p.wrap(width, 1000)
        p.drawOn(self.canvas, x, y - h)
        return y - h

    def label(self, text, x, y, size=9):
        self.canvas.setFont(F_SANS_B, size)
        self.canvas.setFillColor(self.c_accent)
        self.canvas.drawString(x, y, text.upper())
        return y - size * 1.6

    # ---------- разделы ----------
    def cover(self):
        self.new_page(light_bg=False)
        self.canvas.setFillColor(self.c_primary)
        self.canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        # акцентная рамка
        self.canvas.setStrokeColor(self.c_accent)
        self.canvas.setLineWidth(1.2)
        self.canvas.rect(14 * mm, 14 * mm, PAGE_W - 28 * mm, PAGE_H - 28 * mm, fill=0, stroke=1)

        self.canvas.setFont(F_SANS_B, 12)
        self.canvas.setFillColor(self.c_accent)
        self.canvas.drawCentredString(PAGE_W / 2, PAGE_H - 70 * mm, "БРЕНДБУК")

        self.canvas.setFont(F_SERIF_B, 34)
        self.canvas.setFillColor(white)
        self.canvas.drawCentredString(PAGE_W / 2, PAGE_H / 2 + 10 * mm, self.name)

        self.canvas.setStrokeColor(self.c_accent)
        self.canvas.setLineWidth(0.8)
        self.canvas.line(PAGE_W / 2 - 30 * mm, PAGE_H / 2, PAGE_W / 2 + 30 * mm, PAGE_H / 2)

        style = ParagraphStyle("pos", fontName=F_SANS, fontSize=12.5, leading=18,
                               textColor=white, alignment=1)
        p = Paragraph(self.s.get("positioning", ""), style)
        w, h = p.wrap(PAGE_W - 70 * mm, 200)
        p.drawOn(self.canvas, (PAGE_W - (PAGE_W - 70 * mm)) / 2, PAGE_H / 2 - 8 * mm - h)

        self.canvas.setFont(F_SANS, 11)
        self.canvas.setFillColor(self.c_accent)
        self.canvas.drawCentredString(PAGE_W / 2, 30 * mm, str(self.s.get("year", "")))

    def about(self):
        top = self.new_page()
        y = self.section_header(top, "Кто я")
        a = self.s.get("about", {})
        x, w = MARGIN, PAGE_W - 2 * MARGIN
        if a.get("bio"):
            y = self.para(a["bio"], x, y, w, size=11.5, leading=17)
            y -= 6 * mm
        for lbl, key in [("Проекты", "projects"), ("Опыт", "experience"), ("Миссия", "mission")]:
            if a.get(key):
                y = self.label(lbl, x, y)
                y = self.para(a[key], x, y, w)
                y -= 5 * mm
        if a.get("slogan"):
            y -= 3 * mm
            self.canvas.setFillColor(self.c_accent)
            self.canvas.rect(x, y - 14 * mm, w, 14 * mm, fill=1, stroke=0)
            self.canvas.setFont(F_SERIF_B, 15)
            self.canvas.setFillColor(self.c_primary)
            self.canvas.drawCentredString(PAGE_W / 2, y - 9 * mm, "«" + a["slogan"] + "»")
        self.footer()

    def audience(self):
        top = self.new_page()
        y = self.section_header(top, "Целевая аудитория")
        x, w = MARGIN, PAGE_W - 2 * MARGIN
        for i, seg in enumerate(self.s.get("audience", []), 1):
            # карточка сегмента
            self.canvas.setFillColor(white)
            self.canvas.setStrokeColor(self.c_accent)
            card_h = 32 * mm
            self.canvas.roundRect(x, y - card_h, w, card_h, 3 * mm, fill=1, stroke=1)
            self.canvas.setFont(F_SERIF_B, 13)
            self.canvas.setFillColor(self.c_primary)
            self.canvas.drawString(x + 6 * mm, y - 9 * mm, f"{i}. {seg.get('segment','')}")
            iy = y - 15 * mm
            iy = self.para("<b>Боль:</b> " + seg.get("pain", ""), x + 6 * mm, iy,
                           w - 12 * mm, font=F_SANS, size=10)
            self.para("<b>Потребность:</b> " + seg.get("need", ""), x + 6 * mm, iy - 1 * mm,
                      w - 12 * mm, font=F_SANS, size=10)
            y -= card_h + 6 * mm
        if self.s.get("audience_common"):
            y = self.label("Что объединяет", x, y)
            self.para(self.s["audience_common"], x, y, w)
        self.footer()

    def colors(self):
        top = self.new_page()
        y = self.section_header(top, "Фирменные цвета")
        x, w = MARGIN, PAGE_W - 2 * MARGIN
        for col in self.s.get("colors_described", []):
            sw = 22 * mm
            row_h = 22 * mm
            self.canvas.setFillColor(HexColor(col.get("hex", "#000000")))
            # тонкая обводка, чтобы светлые образцы не сливались с фоном страницы
            self.canvas.setStrokeColor(self.c_muted)
            self.canvas.setLineWidth(0.4)
            self.canvas.roundRect(x, y - row_h, sw, row_h, 2 * mm, fill=1, stroke=1)
            tx = x + sw + 6 * mm
            self.canvas.setFont(F_SERIF_B, 13)
            self.canvas.setFillColor(self.c_primary)
            self.canvas.drawString(tx, y - 6 * mm, col.get("name", ""))
            self.canvas.setFont(F_SANS_B, 9.5)
            self.canvas.setFillColor(self.c_accent)
            self.canvas.drawString(tx, y - 11 * mm, col.get("hex", ""))
            self.para(col.get("role", ""), tx, y - 13 * mm, w - sw - 6 * mm,
                      font=F_SANS, size=9.5, color=self.c_muted)
            y -= row_h + 6 * mm
        self.footer()

    def typography(self):
        top = self.new_page()
        y = self.section_header(top, "Типографика")
        t = self.s.get("typography", {})
        x, w = MARGIN, PAGE_W - 2 * MARGIN
        # Заголовочный шрифт
        y = self.label("Шрифт заголовков", x, y)
        self.canvas.setFont(F_SERIF_B, 26)
        self.canvas.setFillColor(self.c_primary)
        self.canvas.drawString(x, y - 9 * mm, "Заголовок Аа Бб Вв")
        y = self.para(t.get("heading_font", "") + " — " + t.get("heading_use", ""),
                      x, y - 14 * mm, w, font=F_SANS, size=10, color=self.c_muted)
        y -= 8 * mm
        # Текстовый шрифт
        y = self.label("Шрифт текста", x, y)
        self.canvas.setFont(F_SANS, 14)
        self.canvas.setFillColor(self.c_text)
        self.canvas.drawString(x, y - 6 * mm, "Текст Аа Бб Вв 0123456789")
        y = self.para(t.get("body_font", "") + " — " + t.get("body_use", ""),
                      x, y - 11 * mm, w, font=F_SANS, size=10, color=self.c_muted)
        if t.get("note"):
            y -= 6 * mm
            self.para(t["note"], x, y, w, font=F_SANS, size=9.5, color=self.c_muted)
        self.footer()

    def voice(self):
        top = self.new_page()
        y = self.section_header(top, "Голос бренда")
        v = self.s.get("voice", {})
        x, w = MARGIN, PAGE_W - 2 * MARGIN
        if v.get("tone"):
            y = self.label("Тональность", x, y)
            y = self.para(v["tone"], x, y, w)
            y -= 6 * mm
        if v.get("examples"):
            y = self.label("Так говорим", x, y)
            for ex in v["examples"]:
                self.canvas.setFillColor(self.c_accent)
                self.canvas.rect(x, y - 7.5 * mm, 1.6 * mm, 7.5 * mm, fill=1, stroke=0)
                y = self.para(ex, x + 5 * mm, y, w - 5 * mm, font=F_SERIF, size=11)
                y -= 3 * mm
            y -= 4 * mm
        if v.get("anti_examples"):
            y = self.label("Так не говорим", x, y)
            for ex in v["anti_examples"]:
                self.canvas.setFillColor(self.c_muted)
                self.canvas.setFont(F_SANS_B, 11)
                self.canvas.drawString(x, y - 3.4 * mm, "×")
                y = self.para(ex, x + 6 * mm, y, w - 6 * mm, font=F_SANS, size=10,
                              color=self.c_muted)
                y -= 2 * mm
        self.footer()

    def values_contacts(self):
        top = self.new_page()
        y = self.section_header(top, "Ценности и контакты")
        x, w = MARGIN, PAGE_W - 2 * MARGIN
        y = self.label("Ценности", x, y)
        for i, val in enumerate(self.s.get("values", []), 1):
            # нумерованный значок
            r = 4 * mm
            cy = y - r
            self.canvas.setFillColor(self.c_primary)
            self.canvas.circle(x + r, cy, r, fill=1, stroke=0)
            self.canvas.setFont(F_SANS_B, 9)
            self.canvas.setFillColor(self.c_accent)
            self.canvas.drawCentredString(x + r, cy - 3, str(i))
            tx = x + 2 * r + 4 * mm
            self.canvas.setFont(F_SERIF_B, 12)
            self.canvas.setFillColor(self.c_primary)
            self.canvas.drawString(tx, y - 3.5 * mm, val.get("title", ""))
            ny = self.para(val.get("why", ""), tx, y - 6 * mm, w - (tx - x),
                           font=F_SANS, size=10, color=self.c_muted)
            y = min(ny, y - 2 * r) - 5 * mm

        y -= 4 * mm
        self.canvas.setStrokeColor(self.c_accent)
        self.canvas.setLineWidth(0.6)
        self.canvas.line(x, y, x + w, y)
        y -= 8 * mm
        y = self.label("Контакты", x, y)
        for ct in self.s.get("contacts", []):
            self.canvas.setFont(F_SANS_B, 10.5)
            self.canvas.setFillColor(self.c_primary)
            self.canvas.drawString(x, y - 4 * mm, ct.get("label", "") + ":")
            self.canvas.setFont(F_SANS, 10.5)
            self.canvas.setFillColor(self.c_text)
            self.canvas.drawString(x + 32 * mm, y - 4 * mm, ct.get("value", ""))
            y -= 7 * mm
        self.footer()

    def build(self, output):
        self.canvas = canvas.Canvas(output, pagesize=A4)
        self.canvas.setTitle("Брендбук — " + self.name)
        self.cover()
        self.about()
        self.audience()
        self.colors()
        self.typography()
        self.voice()
        self.values_contacts()
        self.canvas.showPage()
        self.canvas.save()


def main():
    ap = argparse.ArgumentParser(description="Сборка персонального брендбука в PDF (reportlab, кириллица гарантирована).")
    ap.add_argument("--spec", required=True, help="JSON со структурой брендбука")
    ap.add_argument("--output", required=True, help="Путь к итоговому PDF")
    ap.add_argument("--serif"); ap.add_argument("--serif-bold", dest="serif_bold")
    ap.add_argument("--sans"); ap.add_argument("--sans-bold", dest="sans_bold")
    args = ap.parse_args()

    register_fonts(args)
    with open(args.spec, encoding="utf-8") as f:
        spec = json.load(f)
    BrandBook(spec).build(args.output)
    print("PDF готов:", args.output)


if __name__ == "__main__":
    main()
