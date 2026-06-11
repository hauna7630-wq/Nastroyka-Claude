#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_site.py — универсальный генератор сайта-гардероба для скилла stylist.

Использование:
    python3 build_site.py <wardrobe.json> <папка-сайта>

Читает wardrobe.json и создаёт в папке-сайта до 4 HTML-страниц:
    Profile.html       — стилистический профиль (всегда)
    Lookbook.html      — каталог вещей          (если есть items)
    Looks.html         — готовые образы          (если есть looks)
    Combinations.html  — матрица верх × низ       (если есть combinations)
Страницы объединены единой навигационной шапкой; нав подстраивается
под то, какие страницы реально созданы.

Схема данных — см. wardrobe.example.json рядом с этим скриптом.
"""
import json
import sys
import os
import html
from collections import Counter, OrderedDict

# ---------------------------------------------------------------- helpers ---

def esc(s):
    return html.escape(str(s if s is not None else ""))


# мягкие фоновые тинты для секций-категорий (циклически)
TINTS = ["#F5E9F0", "#E8EEF5", "#EBEFE6", "#EEEAE5", "#E9E5EE",
         "#F5F0E8", "#EEEEEE", "#E6EEF0", "#F0EAEA"]

# дефолтные иконки для частых категорий (необязательно)
CAT_ICONS = {
    "Платья": "👗", "Платье": "👗", "Топы": "👚", "Топ": "👚",
    "Боди": "👙", "Юбки": "🌸", "Юбка": "🌸", "Брюки": "👖",
    "Джинсы": "👖", "Шорты": "🩳", "Верхний слой": "🧥", "Жакеты": "🧥",
    "Пальто": "🧥", "Обувь": "👠", "Сумки": "👜", "Сумка": "👜",
    "Аксессуары": "💎", "Украшения": "💎", "Мечты": "✨",
}

VERDICT_TAG = {"yes": "✅ Беру", "maybe": "⚠️ Подумать / мерить", "no": "❌ Пропустить"}


# -------------------------------------------------------------------- CSS ---

CSS = """
:root {
    --navy: #3B3F5C;
    --lavender: #B5AED0;
    --burnished: #C7A4AB;
    --green: #4CAF50;
    --amber: #FF9800;
    --red: #F44336;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: 'Helvetica Neue', 'Inter', sans-serif;
    background: linear-gradient(180deg, #FAFAF7 0%, #F0EEE9 100%);
    color: var(--navy);
    line-height: 1.55;
}
a { color: inherit; }

/* ===== unified header ===== */
.unified-header {
    background: var(--navy);
    color: white;
    padding: 26px 32px 0;
    text-align: center;
}
.unified-header h1 {
    font-size: 24px; font-weight: 300; letter-spacing: 2.5px; margin: 0 0 6px;
}
.unified-header .subtitle {
    font-size: 11px; font-weight: 300; letter-spacing: 1px;
    opacity: 0.7; margin-bottom: 18px;
}
.unified-nav {
    display: flex; justify-content: center; gap: 4px; flex-wrap: wrap;
    background: rgba(255,255,255,0.04); padding: 8px; border-radius: 100px;
    max-width: 820px; margin: 0 auto -22px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.25);
}
.unified-nav a {
    color: rgba(255,255,255,0.7); text-decoration: none; padding: 10px 18px;
    border-radius: 100px; font-size: 12px; font-weight: 600; letter-spacing: 1px;
    text-transform: uppercase; transition: all 0.15s;
}
.unified-nav a:hover { color: white; background: rgba(255,255,255,0.08); }
.unified-nav a.active { background: white; color: var(--navy); }
.unified-spacer { height: 32px; background: linear-gradient(180deg,#3B3F5C 0%,#FAFAF7 100%); }

.container { max-width: 1400px; margin: 0 auto; padding: 28px 32px 80px; }
.footer { text-align: center; padding: 32px 20px; font-size: 12px; opacity: 0.45; }

/* ===== header stats ===== */
.stats { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.stat-pill {
    background: rgba(255,255,255,0.1); padding: 5px 13px;
    border-radius: 100px; font-size: 12px; letter-spacing: 0.5px;
}

/* ===== groupby bar (lookbook) ===== */
.groupby-bar {
    background: white; padding: 14px 24px; border-bottom: 1px solid #e5e5e5;
    position: sticky; top: 0; z-index: 100;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    display: flex; justify-content: center; align-items: center;
    gap: 10px; flex-wrap: wrap;
}
.groupby-label {
    font-size: 12px; font-weight: 600; letter-spacing: 1px;
    text-transform: uppercase; color: #888;
}
.groupby-btn {
    background: white; color: var(--navy); border: 2px solid #ddd;
    padding: 7px 16px; border-radius: 100px; font-size: 12px; font-weight: 500;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
}
.groupby-btn:hover { border-color: var(--navy); background: #F5F5F0; }
.groupby-btn.active { background: var(--navy); color: white; border-color: var(--navy); }

.legend {
    background: white; border-bottom: 1px solid #e5e5e5; padding: 10px 24px;
    display: flex; justify-content: center; gap: 22px; flex-wrap: wrap; font-size: 11px;
}
.legend-item { display: flex; align-items: center; gap: 6px; }
.legend-square { width: 13px; height: 13px; border-radius: 3px; display: inline-block; }

/* ===== group section ===== */
.group-section { margin-bottom: 36px; background: #FBFAF7; border-radius: 16px; padding: 22px; }
.group-header {
    margin-bottom: 18px; display: flex; align-items: baseline;
    justify-content: space-between; flex-wrap: wrap; gap: 10px;
}
.group-header h2 {
    font-size: 19px; font-weight: 400; letter-spacing: 1px;
    display: flex; align-items: center; gap: 10px;
}
.group-count { font-size: 13px; opacity: 0.5; font-weight: 300; }
.group-color-swatch {
    width: 18px; height: 18px; border-radius: 4px;
    border: 1.5px solid rgba(0,0,0,0.18); display: inline-block;
}
.group-stats { display: flex; gap: 8px; font-size: 11px; font-weight: 500; }
.stat { padding: 3px 8px; border-radius: 100px; }
.stat-yes { background: rgba(76,175,80,0.15); color: #2E7D32; }
.stat-maybe { background: rgba(255,152,0,0.15); color: #E65100; }
.stat-no { background: rgba(244,67,54,0.15); color: #C62828; }

/* ===== cards ===== */
.cards-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px;
}
.card {
    background: white; border-radius: 12px; overflow: hidden; color: var(--navy);
    display: flex; flex-direction: column; position: relative; cursor: pointer;
    user-select: none; box-shadow: 0 2px 10px rgba(0,0,0,0.06);
    transition: transform 0.2s, box-shadow 0.2s;
}
.card.verdict-no { opacity: 0.72; }
.card:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,0.10); }
.verdict-tag {
    color: white; font-size: 10px; font-weight: 600; letter-spacing: 0.8px;
    padding: 6px 0; text-align: center; text-transform: uppercase;
}
.verdict-yes .verdict-tag { background: #4CAF50; }
.verdict-maybe .verdict-tag { background: #FF9800; }
.verdict-no .verdict-tag { background: #F44336; }
.hem-badge {
    position: absolute; top: 38px; right: 8px; background: #FFF8E1;
    color: #5D4037; font-size: 10px; font-weight: 700; padding: 4px 8px;
    border-radius: 4px; z-index: 5; border: 1px solid #FFE082;
}
.card-img {
    width: 100%; aspect-ratio: 3/4; background: #F5F5F0;
    overflow: hidden; position: relative;
}
.card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.card-img.fallback { display: flex; align-items: center; justify-content: center; }
.placeholder {
    text-align: center; padding: 20px; display: flex; flex-direction: column;
    align-items: center; gap: 12px;
}
.ph-brand {
    font-size: 12px; font-weight: 500; letter-spacing: 1.5px;
    color: var(--navy); text-transform: uppercase;
}
.ph-swatch {
    width: 48px; height: 48px; border-radius: 50%;
    border: 2px solid rgba(0,0,0,0.15);
}
.ph-note { font-size: 10px; opacity: 0.5; max-width: 140px; }
.card-num {
    position: absolute; top: 38px; left: 8px; background: rgba(59,63,92,0.85);
    color: white; font-size: 10px; font-weight: 600; padding: 3px 8px;
    border-radius: 4px; z-index: 5;
}
.card-body { padding: 12px 14px 14px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
.card-brand {
    font-size: 10px; font-weight: 500; letter-spacing: 1.5px;
    opacity: 0.6; text-transform: uppercase;
}
.card-name { font-size: 13px; font-weight: 500; flex: 1; }
.card-color { display: flex; align-items: center; gap: 6px; }
.swatch { width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.2); }
.color-name { font-size: 11px; opacity: 0.7; }
.note-quote {
    margin-top: 4px; padding-top: 8px;
    border-top: 1px dashed rgba(59,63,92,0.18);
    font-size: 11px; font-style: italic; color: #555;
}
.buy-btn {
    display: block; margin-top: 10px; padding: 10px 14px; background: var(--navy);
    color: white; text-align: center; text-decoration: none; font-size: 12px;
    font-weight: 600; letter-spacing: 1px; border-radius: 6px; transition: background 0.15s;
}
.buy-btn:hover { background: #2A2D44; }
.verdict-no .buy-btn { background: #888; }

/* ===== looks ===== */
.occasion-section { margin-bottom: 44px; }
.occ-title {
    font-size: 21px; font-weight: 400; letter-spacing: 1px; margin-bottom: 18px;
    padding-bottom: 12px; border-bottom: 2px solid rgba(59,63,92,0.12);
    display: flex; align-items: center; gap: 10px;
}
.occ-count { font-size: 13px; opacity: 0.5; font-weight: 300; }
.looks-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 22px;
}
.look {
    background: white; border-radius: 16px; padding: 20px;
    box-shadow: 0 3px 14px rgba(0,0,0,0.06); display: flex;
    flex-direction: column; gap: 14px; transition: transform 0.15s, box-shadow 0.15s;
}
.look:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.10); }
.look-header { display: flex; align-items: baseline; gap: 10px; }
.look-num {
    background: var(--navy); color: white; font-size: 11px; font-weight: 700;
    padding: 4px 10px; border-radius: 100px;
}
.look h3 { font-size: 18px; font-weight: 500; flex: 1; }
.look-items-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 8px;
}
.look-item {
    position: relative; font-size: 9px; font-weight: 600;
    color: rgba(59,63,92,0.7); text-align: center;
}
.look-item::before {
    content: attr(title); position: absolute; bottom: 100%; left: 50%;
    transform: translateX(-50%); background: rgba(0,0,0,0.85); color: white;
    padding: 6px 10px; border-radius: 6px; font-size: 10px; font-weight: 400;
    white-space: nowrap; opacity: 0; pointer-events: none;
    transition: opacity 0.15s; z-index: 10;
}
.look-item:hover::before { opacity: 1; }
.look-img {
    aspect-ratio: 3/4; background: #F5F5F0; border-radius: 6px;
    overflow: hidden; margin-top: 2px;
}
.look-img img { width: 100%; height: 100%; object-fit: cover; }
.look-img.fallback { display: flex; align-items: center; justify-content: center; }
.ph-text {
    font-size: 9px; font-weight: 600; letter-spacing: 1px; color: var(--navy);
    text-transform: uppercase; text-align: center; padding: 4px;
}
.look-items-list { list-style: none; font-size: 12px; line-height: 1.6; opacity: 0.85; }
.look-items-list li { padding: 2px 0; }
.li-brand { font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; }
.look-why {
    font-size: 12px; line-height: 1.5; padding-top: 12px;
    border-top: 1px dashed rgba(59,63,92,0.15); color: #555; font-style: italic;
}
.look-trick {
    font-size: 11px; font-weight: 600; color: var(--burnished);
    background: rgba(199,164,171,0.13); padding: 6px 10px; border-radius: 6px;
}

/* usage table */
.usage-section {
    background: white; border-radius: 16px; padding: 26px;
    margin-top: 44px; box-shadow: 0 2px 12px rgba(0,0,0,0.05);
}
.usage-section h2 { font-size: 20px; font-weight: 400; letter-spacing: 1px; margin-bottom: 8px; }
.usage-intro { font-size: 13px; opacity: 0.65; margin-bottom: 18px; }
.usage-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.usage-table th, .usage-table td {
    padding: 9px 8px; text-align: left; border-bottom: 1px solid rgba(59,63,92,0.08);
}
.usage-table th {
    font-size: 11px; font-weight: 600; letter-spacing: 1px;
    text-transform: uppercase; opacity: 0.6;
}
.us-img { width: 40px; height: 53px; object-fit: cover; border-radius: 4px; display: block; }
.us-fallback { border: 1px solid rgba(0,0,0,0.1); }
.us-num { font-weight: 700; font-size: 12px; }
.us-color { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.us-sw { width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.2); }
.us-count { font-weight: 700; font-size: 16px; text-align: center; }

/* ===== combinations ===== */
.top-jump {
    background: #F5F5F0; padding: 11px 24px; text-align: center;
    font-size: 11px; border-bottom: 1px solid #e5e5e5;
}
.top-jump a {
    display: inline-block; margin: 4px 5px; padding: 4px 10px; background: white;
    border-radius: 100px; font-size: 11px; text-decoration: none; border: 1px solid #ddd;
}
.top-jump a:hover { background: var(--navy); color: white; }
.top-section {
    background: white; border-radius: 16px; padding: 24px;
    margin-bottom: 28px; box-shadow: 0 3px 14px rgba(0,0,0,0.05);
}
.top-header {
    display: flex; gap: 20px; align-items: center; margin-bottom: 22px;
    padding-bottom: 18px; border-bottom: 2px solid rgba(59,63,92,0.10);
}
.top-img {
    width: 120px; height: 160px; flex-shrink: 0; background: #F5F5F0;
    border-radius: 8px; overflow: hidden;
}
.top-img img, .fallback-box {
    width: 100%; height: 100%; object-fit: cover;
}
.fallback-box {
    display: flex; align-items: center; justify-content: center;
    text-transform: uppercase; letter-spacing: 1px; font-size: 11px;
    font-weight: 600; color: var(--navy);
}
.top-info { flex: 1; }
.top-num {
    background: var(--navy); color: white; font-size: 11px; font-weight: 700;
    padding: 3px 10px; border-radius: 100px; display: inline-block; margin-bottom: 6px;
}
.top-brand {
    font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;
    opacity: 0.6; margin-bottom: 4px;
}
.top-info h2 { font-size: 23px; font-weight: 400; margin-bottom: 8px; }
.top-color { display: flex; align-items: center; gap: 6px; font-size: 13px; margin-bottom: 8px; }
.top-count { font-size: 12px; opacity: 0.6; font-style: italic; }
.swatch-dot {
    width: 14px; height: 14px; border-radius: 50%;
    border: 1px solid rgba(0,0,0,0.2); display: inline-block;
}
.pairs-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;
}
.pair { background: #FAFAF7; border-radius: 12px; padding: 14px;
    display: flex; flex-direction: column; gap: 10px; }
.pair-bot { display: flex; gap: 12px; align-items: center; }
.pair-bot-img {
    width: 60px; height: 80px; background: #F0EEE9; border-radius: 6px;
    overflow: hidden; flex-shrink: 0;
}
.pair-bot-img img, .pair-bot-img .fallback-box { width: 100%; height: 100%; object-fit: cover; }
.pair-bot-meta { flex: 1; font-size: 11px; }
.pair-bot-brand {
    font-size: 9px; font-weight: 600; letter-spacing: 1px;
    text-transform: uppercase; opacity: 0.55;
}
.pair-bot-name { font-size: 11px; font-weight: 500; margin: 2px 0; line-height: 1.3; }
.pair-bot-color { display: flex; align-items: center; gap: 5px; font-size: 10px; opacity: 0.75; }
.pair-mood { padding-top: 10px; border-top: 1px dashed rgba(59,63,92,0.15); }
.mood-name { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
.mood-tip { font-size: 11px; line-height: 1.4; color: #555; font-style: italic; }

/* ===== profile ===== */
.section {
    background: white; border-radius: 16px; padding: 30px;
    margin-bottom: 22px; box-shadow: 0 3px 14px rgba(0,0,0,0.05);
}
.section h2 {
    font-size: 21px; font-weight: 400; letter-spacing: 1px; margin-bottom: 16px;
    padding-bottom: 13px; border-bottom: 2px solid rgba(59,63,92,0.12);
    display: flex; align-items: center; gap: 12px;
}
.section h3 {
    font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;
    margin: 18px 0 9px; color: rgba(59,63,92,0.65);
}
.section p { font-size: 14px; margin-bottom: 11px; }
.section ul { list-style: none; padding: 0; }
.section li { font-size: 14px; padding: 5px 0 5px 22px; position: relative; }
.section li::before { content: "✓"; position: absolute; left: 0; color: #4CAF50; font-weight: bold; }
.section li.no::before { content: "✗"; color: #F44336; }
.section li.star::before { content: "★"; color: var(--burnished); }
.section li.plain::before { content: "•"; color: rgba(59,63,92,0.4); }
.identity { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: 16px; }
.id-card { background: linear-gradient(135deg,#F2EFF7 0%,#EBE8F2 100%); padding: 17px; border-radius: 12px; }
.id-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.55; margin-bottom: 6px; }
.id-value { font-size: 16px; font-weight: 500; line-height: 1.4; }
.measurements { display: grid; grid-template-columns: repeat(auto-fit, minmax(108px,1fr)); gap: 12px; margin-top: 12px; }
.m-cell { background: #F5F5F0; padding: 12px; border-radius: 10px; text-align: center; }
.m-label { font-size: 11px; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px; }
.m-value { font-size: 22px; font-weight: 400; margin-top: 4px; }
.m-unit { font-size: 11px; opacity: 0.4; }
.palette-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px,1fr)); gap: 14px; margin-bottom: 20px; }
.swatch-card { text-align: center; }
.swatch-color {
    width: 100%; aspect-ratio: 1; border-radius: 10px;
    border: 1px solid rgba(0,0,0,0.1); margin-bottom: 8px;
}
.swatch-cname { font-size: 12px; font-weight: 500; }
.swatch-meta { font-size: 10px; opacity: 0.5; font-family: 'Consolas',monospace; margin-top: 3px; line-height: 1.3; }
.columns { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
.col h3 { margin-top: 0; }
.archetype-banner {
    background: linear-gradient(135deg,#B5AED0 0%,#C7A4AB 100%); color: white;
    padding: 24px; border-radius: 14px; text-align: center; margin-bottom: 22px;
}
.archetype-banner .lead {
    font-size: 13px; opacity: 0.9; text-transform: uppercase;
    letter-spacing: 2px; margin-bottom: 8px;
}
.archetype-banner .title { font-size: 22px; font-weight: 300; letter-spacing: 1.5px; }
.quote {
    font-style: italic; padding: 14px 18px; background: rgba(59,63,92,0.04);
    border-left: 3px solid var(--lavender); border-radius: 6px;
    margin: 12px 0; font-size: 13px; line-height: 1.6;
}
.product-block { background: #FAFAF7; padding: 13px 15px; border-radius: 10px; margin-bottom: 10px; font-size: 13px; }

@media (max-width: 760px) {
    .container { padding: 16px 12px 40px; }
    .unified-header h1 { font-size: 17px; letter-spacing: 1.2px; }
    .unified-nav a { padding: 8px 12px; font-size: 10.5px; letter-spacing: 0.5px; }
    .section { padding: 18px; }
    .section h2 { font-size: 18px; }
    .columns { grid-template-columns: 1fr; gap: 20px; }
    .cards-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .looks-grid { grid-template-columns: 1fr; }
    .look-items-grid { grid-template-columns: repeat(4, 1fr); }
    .pairs-grid { grid-template-columns: 1fr; }
    .top-header { flex-direction: column; text-align: center; }
    .group-section { padding: 14px 12px; }
}
"""


# ----------------------------------------------------------- page skeleton --

def page(title, header, body):
    return (
        "<!DOCTYPE html>\n<html lang=\"ru\">\n<head>\n"
        "<meta charset=\"UTF-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n"
        "<title>" + esc(title) + "</title>\n<style>" + CSS + "</style>\n</head>\n<body>\n"
        + header + "\n" + body + "\n</body>\n</html>\n"
    )


def make_header(active, pages, title, subtitle):
    links = ""
    for slug, label, fname in pages:
        cls = ' class="active"' if slug == active else ""
        href = "#" if slug == active else fname
        links += '<a href="' + href + '"' + cls + ">" + esc(label) + "</a>"
    return (
        '<header class="unified-header">\n'
        "  <h1>" + esc(title) + "</h1>\n"
        '  <div class="subtitle">' + esc(subtitle) + "</div>\n"
        '  <nav class="unified-nav">' + links + "</nav>\n"
        "</header>\n"
        '<div class="unified-spacer"></div>'
    )


# ------------------------------------------------------------------ render --

def render_list(values, marker="check"):
    """marker: check | no | plain ; values may be strings or {text, marker}."""
    out = ""
    for v in values:
        if isinstance(v, dict):
            txt = v.get("text", "")
            m = v.get("marker", marker)
        else:
            txt, m = v, marker
        cls = {"check": "", "no": "no", "plain": "plain", "star": "star"}.get(m, "")
        out += '<li class="' + cls + '">' + esc(txt) + "</li>"
    return out


def palette_row(colors):
    cells = ""
    for c in colors:
        hexv = str(c.get("hex", "CCCCCC")).lstrip("#")
        meta = esc(c.get("pantone", "")) + "<br>#" + esc(hexv)
        cells += (
            '<div class="swatch-card">'
            '<div class="swatch-color" style="background:#' + esc(hexv) + '"></div>'
            '<div class="swatch-cname">' + esc(c.get("name", "")) + "</div>"
            '<div class="swatch-meta">' + meta + "</div></div>"
        )
    return cells


# ============================================================ PROFILE PAGE ==

def build_profile(data, pages):
    p = data.get("person", {})
    cfg = data.get("config", {})
    name = p.get("name", "")
    title = cfg.get("siteTitle") or ("ПРОФИЛЬ — " + name.upper() if name else "ПРОФИЛЬ СТИЛЯ")
    subtitle = cfg.get("subtitle") or "Полный стилистический референс"
    header = make_header("profile", pages, title, subtitle)

    sec = []

    # archetype
    if p.get("archetype"):
        sec.append(
            '<div class="archetype-banner"><div class="lead">Архетип</div>'
            '<div class="title">' + esc(p["archetype"]) + "</div></div>"
        )

    # identity
    if p.get("identity"):
        cards = ""
        for it in p["identity"]:
            cards += (
                '<div class="id-card"><div class="id-label">' + esc(it.get("label", "")) +
                '</div><div class="id-value">' + esc(it.get("value", "")) + "</div></div>"
            )
        sec.append('<section class="section"><h2>🎯 Базовая идентичность</h2>'
                   '<div class="identity">' + cards + "</div></section>")

    # measurements
    if p.get("measurements"):
        cells = ""
        for m in p["measurements"]:
            unit = m.get("unit", "")
            unit_html = '<span class="m-unit"> ' + esc(unit) + "</span>" if unit else ""
            cells += ('<div class="m-cell"><div class="m-label">' + esc(m.get("label", "")) +
                      '</div><div class="m-value">' + esc(m.get("value", "")) + unit_html + "</div></div>")
        note = "<p>" + esc(p["measurementsNote"]) + "</p>" if p.get("measurementsNote") else ""
        extra = ""
        if p.get("strengths") or p.get("risks"):
            extra = '<div class="quote">'
            if p.get("strengths"):
                extra += "<strong>Сильные стороны:</strong> " + esc(p["strengths"]) + "<br>"
            if p.get("risks"):
                extra += "<strong>Зоны риска:</strong> " + esc(p["risks"])
            extra += "</div>"
        sec.append('<section class="section"><h2>📏 Параметры</h2>' + note +
                   '<div class="measurements">' + cells + "</div>" + extra + "</section>")

    # palette
    pal = p.get("palette", {})
    if pal:
        blocks = ""
        labels = [("base", "База — 60% гардероба", ""),
                  ("accent", "Акценты — 30% гардероба", ""),
                  ("anchor", "Якоря-тёмные — 10% гардероба", ""),
                  ("no", "Категорически НЕ носить", "color:#C62828;")]
        for key, lab, style in labels:
            if pal.get(key):
                blocks += ('<h3 style="' + style + '">' + esc(lab) + "</h3>"
                           '<div class="palette-grid">' + palette_row(pal[key]) + "</div>")
        sec.append('<section class="section"><h2>🎨 Цветовая палитра</h2>' + blocks + "</section>")

    # silhouettes
    sil = p.get("silhouettes", {})
    if sil:
        body = "<div class=\"columns\">"
        body += ('<div class="col"><h3 style="color:#2E7D32">Работает</h3><ul>' +
                 render_list(sil.get("works", []), "check") + "</ul></div>")
        body += ('<div class="col"><h3 style="color:#C62828">Не работает</h3><ul>' +
                 render_list(sil.get("avoid", []), "no") + "</ul></div></div>")
        if sil.get("note"):
            body += "<p>" + esc(sil["note"]) + "</p>"
        if sil.get("lengths"):
            body += '<div class="quote"><strong>Длины:</strong> ' + esc(sil["lengths"]) + "</div>"
        sec.append('<section class="section"><h2>👗 Фасоны и силуэты</h2>' + body + "</section>")

    # fabrics
    fab = p.get("fabrics", {})
    if fab:
        body = ('<div class="columns"><div class="col"><h3 style="color:#2E7D32">Да</h3><ul>' +
                render_list(fab.get("works", []), "check") + "</ul></div>" +
                '<div class="col"><h3 style="color:#C62828">Нет</h3><ul>' +
                render_list(fab.get("avoid", []), "no") + "</ul></div></div>")
        sec.append('<section class="section"><h2>🌿 Ткани</h2>' + body + "</section>")

    # hair
    hair = p.get("hair", {})
    if hair:
        body = ""
        for key, lab in [("color", "Цвет"), ("cut", "Стрижка"),
                         ("styling", "Укладка"), ("care", "Уход")]:
            if hair.get(key):
                body += "<h3>" + lab + "</h3><ul>" + render_list(hair[key], "plain") + "</ul>"
        sec.append('<section class="section"><h2>✂️ Волосы</h2>' + body + "</section>")

    # makeup
    if p.get("makeup"):
        body = ""
        for blk in p["makeup"]:
            body += "<h3>" + esc(blk.get("title", "")) + "</h3>"
            if blk.get("body"):
                body += '<div class="product-block">' + esc(blk["body"]) + "</div>"
            if blk.get("avoid"):
                body += "<ul>" + render_list(blk["avoid"], "no") + "</ul>"
        sec.append('<section class="section"><h2>💄 Макияж</h2>' + body + "</section>")

    # jewelry
    if p.get("jewelry"):
        sec.append('<section class="section"><h2>💎 Украшения</h2><ul>' +
                   render_list(p["jewelry"], "plain") + "</ul></section>")

    # context
    ctx = p.get("context", {})
    if ctx:
        body = '<div class="columns">'
        if ctx.get("geography"):
            body += ('<div class="col"><h3>География и климат</h3><ul>' +
                     render_list(ctx["geography"], "plain") + "</ul></div>")
        if ctx.get("life"):
            body += ('<div class="col"><h3>Образ жизни</h3><ul>' +
                     render_list(ctx["life"], "plain") + "</ul></div>")
        body += "</div>"
        sec.append('<section class="section"><h2>🌍 Контекст жизни</h2>' + body + "</section>")

    # golden rules
    if p.get("goldenRules"):
        body = ""
        for i, r in enumerate(p["goldenRules"], 1):
            body += ('<div class="quote"><strong>' + str(i) + ". " +
                     esc(r.get("title", "")) + "</strong><br>" + esc(r.get("text", "")) + "</div>")
        sec.append('<section class="section"><h2>⚖️ Золотые правила</h2>' + body + "</section>")

    body = '<main class="container">' + "\n".join(sec) + "</main>"
    return page(title + " — Профиль", header, body)


# =========================================================== LOOKBOOK PAGE ==

def build_lookbook(data, pages):
    cfg = data.get("config", {})
    items = data.get("items", [])
    name = data.get("person", {}).get("name", "")
    title = "ГАРДЕРОБ" + (" — " + name.upper() if name else "")
    subtitle = cfg.get("lookbookSubtitle") or (str(len(items)) + " позиций")
    header = make_header("lookbook", pages, title, subtitle)

    # category order + tints + color labels (derived)
    cat_order, color_order = [], []
    color_swatch = {}
    for it in items:
        c = it.get("category", "—")
        if c not in cat_order:
            cat_order.append(c)
        cf = it.get("colorFamily", "—")
        if cf not in color_order:
            color_order.append(cf)
            color_swatch[cf] = str(it.get("colorHex", "CCCCCC")).lstrip("#")
    cat_tint = {c: TINTS[i % len(TINTS)] for i, c in enumerate(cat_order)}
    cat_icon = {c: CAT_ICONS.get(c, "") for c in cat_order}
    color_labels = {cf: cf for cf in color_order}

    norm = []
    for it in items:
        norm.append({
            "id": it.get("id"),
            "category": it.get("category", "—"),
            "name": it.get("name", ""),
            "brand": it.get("brand", ""),
            "brandGroup": it.get("brandGroup") or it.get("brand", ""),
            "colorName": it.get("colorName", ""),
            "colorFamily": it.get("colorFamily", "—"),
            "colorHex": str(it.get("colorHex", "CCCCCC")).lstrip("#"),
            "url": it.get("url", ""),
            "verdict": it.get("verdict", "maybe"),
            "note": it.get("note", ""),
            "needsHem": bool(it.get("needsHem", False)),
            "img": it.get("img"),
        })

    n_yes = sum(1 for x in norm if x["verdict"] == "yes")
    n_maybe = sum(1 for x in norm if x["verdict"] == "maybe")
    n_no = sum(1 for x in norm if x["verdict"] == "no")
    n_hem = sum(1 for x in norm if x["needsHem"])

    js_cfg = {
        "categoryOrder": cat_order, "categoryTint": cat_tint, "categoryIcon": cat_icon,
        "colorOrder": color_order, "colorLabels": color_labels, "colorSwatch": color_swatch,
    }

    stats = ('<div class="stats">'
             '<span class="stat-pill">✅ ' + str(n_yes) + "</span>"
             '<span class="stat-pill">⚠️ ' + str(n_maybe) + "</span>"
             '<span class="stat-pill">❌ ' + str(n_no) + "</span>"
             '<span class="stat-pill">✂️ ' + str(n_hem) + "</span></div>")

    body = (
        '<div style="text-align:center;background:var(--navy);padding:0 0 18px;">' + stats + "</div>"
        '<div class="groupby-bar"><span class="groupby-label">Группировать по:</span>'
        '<button class="groupby-btn active" data-group="category" onclick="setGrouping(\'category\')">Категориям</button>'
        '<button class="groupby-btn" data-group="brand" onclick="setGrouping(\'brand\')">Магазинам</button>'
        '<button class="groupby-btn" data-group="color" onclick="setGrouping(\'color\')">Цветам</button>'
        '<button class="groupby-btn" data-group="verdict" onclick="setGrouping(\'verdict\')">Беру / Нет</button></div>'
        '<div class="legend">'
        '<div class="legend-item"><span class="legend-square" style="background:#4CAF50"></span> Беру</div>'
        '<div class="legend-item"><span class="legend-square" style="background:#FF9800"></span> Подумать</div>'
        '<div class="legend-item"><span class="legend-square" style="background:#F44336"></span> Пропустить</div>'
        '<div class="legend-item">✂️ Подшить по росту</div></div>'
        '<main class="container" id="root"></main>'
        '<footer class="footer">Клик по карточке или «КУПИТЬ» открывает товар в новой вкладке.</footer>'
        "<script>\nconst ITEMS = " + json.dumps(norm, ensure_ascii=False) +
        ";\nconst CFG = " + json.dumps(js_cfg, ensure_ascii=False) + ";\n</script>\n"
        "<script>" + LOOKBOOK_JS + "</script>"
    )
    return page(title, header, body)


LOOKBOOK_JS = r"""
const VERDICT_ORDER = {yes:0, maybe:1, no:2};
const VERDICT_LABELS = {yes:"✅ Беру", maybe:"⚠️ Подумать / мерить", no:"❌ Пропустить"};

function escapeHtml(s){
    return (s||"").replace(/[&<>"']/g, c => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function renderCard(it){
    const imgBlock = it.img
        ? `<div class="card-img"><img src="${escapeHtml(it.img)}" alt="${escapeHtml(it.name)}" loading="lazy"></div>`
        : `<div class="card-img fallback" style="background-color:#${it.colorHex}33;">
             <div class="placeholder">
               <div class="ph-brand">${escapeHtml(it.brand)}</div>
               <div class="ph-swatch" style="background:#${it.colorHex}"></div>
               <div class="ph-note">фото недоступно — открой ссылку</div>
             </div></div>`;
    const hemBadge = it.needsHem ? '<div class="hem-badge">✂️ ПОДШИТЬ</div>' : '';
    const url = escapeHtml(it.url || '#');
    const note = it.note ? `<div class="note-quote">«${escapeHtml(it.note)}»</div>` : '';
    const buy = it.url
        ? `<a href="${url}" target="_blank" rel="noopener" class="buy-btn" onclick="event.stopPropagation();">КУПИТЬ →</a>`
        : '';
    const onclick = it.url ? `onclick="window.open('${url}','_blank','noopener,noreferrer')"` : '';
    return `<div class="card verdict-${it.verdict}" ${onclick}>
        <div class="verdict-tag">${VERDICT_LABELS[it.verdict]||it.verdict}</div>
        ${hemBadge}${imgBlock}
        <div class="card-body">
            <div class="card-num">#${it.id}</div>
            <div class="card-brand">${escapeHtml(it.brand)}</div>
            <div class="card-name">${escapeHtml(it.name)}</div>
            <div class="card-color">
                <span class="swatch" style="background:#${it.colorHex}"></span>
                <span class="color-name">${escapeHtml(it.colorName)}</span>
            </div>
            ${note}${buy}
        </div></div>`;
}
function groupAndRender(groupBy){
    const groups = {};
    for (const it of ITEMS){
        let key;
        if (groupBy==="category") key = it.category;
        else if (groupBy==="brand") key = it.brandGroup;
        else if (groupBy==="color") key = it.colorFamily;
        else key = it.verdict;
        (groups[key] = groups[key] || []).push(it);
    }
    let keys = Object.keys(groups);
    if (groupBy==="category") keys.sort((a,b)=>CFG.categoryOrder.indexOf(a)-CFG.categoryOrder.indexOf(b));
    else if (groupBy==="color") keys.sort((a,b)=>CFG.colorOrder.indexOf(a)-CFG.colorOrder.indexOf(b));
    else if (groupBy==="verdict") keys.sort((a,b)=>VERDICT_ORDER[a]-VERDICT_ORDER[b]);
    else keys.sort();
    for (const k of keys){
        groups[k].sort((a,b)=>{
            if (VERDICT_ORDER[a.verdict]!==VERDICT_ORDER[b.verdict])
                return VERDICT_ORDER[a.verdict]-VERDICT_ORDER[b.verdict];
            return (a.id||0)-(b.id||0);
        });
    }
    let html = "";
    for (const k of keys){
        const list = groups[k];
        const nY = list.filter(x=>x.verdict==="yes").length;
        const nM = list.filter(x=>x.verdict==="maybe").length;
        const nN = list.filter(x=>x.verdict==="no").length;
        let headerName = k, style = "";
        if (groupBy==="category"){
            headerName = `${CFG.categoryIcon[k]||""} ${k}`;
            style = `style="background:${CFG.categoryTint[k]||'#FBFAF7'}"`;
        } else if (groupBy==="color"){
            headerName = `<span class="group-color-swatch" style="background:#${CFG.colorSwatch[k]||'CCC'}"></span>${CFG.colorLabels[k]||k}`;
        } else if (groupBy==="verdict"){
            headerName = VERDICT_LABELS[k]||k;
        }
        html += `<section class="group-section" ${style}>
            <div class="group-header">
                <h2>${headerName} <span class="group-count">(${list.length})</span></h2>
                <div class="group-stats">
                    ${nY?`<span class="stat stat-yes">✅ ${nY}</span>`:''}
                    ${nM?`<span class="stat stat-maybe">⚠️ ${nM}</span>`:''}
                    ${nN?`<span class="stat stat-no">❌ ${nN}</span>`:''}
                </div>
            </div>
            <div class="cards-grid">${list.map(renderCard).join("")}</div>
        </section>`;
    }
    document.getElementById("root").innerHTML = html;
}
function setGrouping(mode){
    document.querySelectorAll(".groupby-btn").forEach(b=>b.classList.toggle("active", b.dataset.group===mode));
    groupAndRender(mode);
    window.scrollTo({top:0, behavior:"smooth"});
}
groupAndRender("category");
"""


# ============================================================== LOOKS PAGE ==

def build_looks(data, pages):
    cfg = data.get("config", {})
    items = {it.get("id"): it for it in data.get("items", [])}
    looks = data.get("looks", [])
    name = data.get("person", {}).get("name", "")
    title = "ЛУКИ" + (" — " + name.upper() if name else "")

    def img_block(iid):
        it = items.get(iid, {})
        img = it.get("img")
        nm = it.get("name", "Item #" + str(iid))
        brand = it.get("brand", "")
        hexc = str(it.get("colorHex", "CCCCCC")).lstrip("#")
        if img:
            inner = ('<div class="look-img"><img src="' + esc(img) + '" alt="' +
                     esc(nm) + '" loading="lazy"></div>')
        else:
            inner = ('<div class="look-img fallback" style="background:#' + esc(hexc) +
                     '33;"><div class="ph-text">' + esc(brand) + "</div></div>")
        return ('<div class="look-item" title="#' + esc(iid) + " " + esc(brand) + " " +
                esc(nm) + '">#' + esc(iid) + inner + "</div>")

    # group by occasion (preserve first-seen order)
    by_occ = OrderedDict()
    for lk in looks:
        key = (lk.get("icon", ""), lk.get("occasion", "Образы"))
        by_occ.setdefault(key, []).append(lk)

    sections = ""
    for (icon, occ), lst in by_occ.items():
        cards = ""
        for lk in lst:
            grid = "".join(img_block(i) for i in lk.get("items", []))
            li = "".join(
                '<li><span class="li-brand">' + esc(items.get(i, {}).get("brand", "")) +
                "</span> · " + esc(items.get(i, {}).get("name", "")) + "</li>"
                for i in lk.get("items", []))
            trick = ('<div class="look-trick">🌀 ' + esc(lk["trick"]) + "</div>") if lk.get("trick") else ""
            cards += (
                '<article class="look"><div class="look-header"><div class="look-num">#' +
                esc(lk.get("id", "")) + "</div><h3>" + esc(lk.get("name", "")) + "</h3></div>"
                '<div class="look-items-grid">' + grid + "</div>"
                '<ul class="look-items-list">' + li + "</ul>" + trick +
                '<p class="look-why">💡 ' + esc(lk.get("why", "")) + "</p></article>")
        sections += (
            '<section class="occasion-section"><h2 class="occ-title">' + esc(icon) + " " +
            esc(occ) + ' <span class="occ-count">(' + str(len(lst)) + ")</span></h2>"
            '<div class="looks-grid">' + cards + "</div></section>")

    # usage table
    usage = Counter()
    for lk in looks:
        for i in lk.get("items", []):
            usage[i] += 1
    rows = ""
    for iid, cnt in sorted(usage.items(), key=lambda x: -x[1]):
        it = items.get(iid, {})
        img = it.get("img")
        hexc = str(it.get("colorHex", "CCCCCC")).lstrip("#")
        if img:
            img_tag = '<img src="' + esc(img) + '" class="us-img" alt="">'
        else:
            img_tag = '<div class="us-img us-fallback" style="background:#' + esc(hexc) + '33"></div>'
        pri = "🟢 Топ" if cnt >= 3 else ("🟡 Средний" if cnt == 2 else "⚪ Единичный")
        rows += (
            '<tr><td class="us-num">#' + esc(iid) + "</td><td>" + img_tag + "</td>"
            "<td><strong>" + esc(it.get("brand", "")) + "</strong> · " + esc(it.get("name", "")) + "</td>"
            '<td class="us-color"><span class="us-sw" style="background:#' + esc(hexc) + '"></span> ' +
            esc(it.get("colorName", "")) + "</td>"
            '<td class="us-count">' + str(cnt) + '</td><td>' + pri + "</td></tr>")

    usage_section = (
        '<section class="usage-section"><h2>📊 Что чаще всего носится</h2>'
        '<p class="usage-intro">Чем чаще вещь встречается в луках — тем выше приоритет покупки.</p>'
        '<table class="usage-table"><thead><tr><th>#</th><th>Фото</th><th>Бренд / Модель</th>'
        "<th>Цвет</th><th>В луках</th><th>Приоритет</th></tr></thead><tbody>" + rows +
        "</tbody></table></section>") if usage else ""

    subtitle = (str(len(looks)) + " образов из " + str(len(usage)) + " вещей")
    header = make_header("looks", pages, title, subtitle)
    body = '<main class="container">' + sections + usage_section + "</main>"
    return page(title, header, body)


# ======================================================= COMBINATIONS PAGE ==

def build_combinations(data, pages):
    items = {it.get("id"): it for it in data.get("items", [])}
    comb = data.get("combinations", {})
    tops = comb.get("tops", [])
    bottoms = comb.get("bottoms", [])
    matrix = comb.get("matrix", {})
    name = data.get("person", {}).get("name", "")
    title = "СОЧЕТАНИЯ" + (" — " + name.upper() if name else "")

    def img_box(iid):
        it = items.get(iid, {})
        img = it.get("img")
        if img:
            return '<img src="' + esc(img) + '" alt="' + esc(it.get("name", "")) + '" loading="lazy">'
        hexc = str(it.get("colorHex", "CCCCCC")).lstrip("#")
        return ('<div class="fallback-box" style="background:#' + esc(hexc) + '33;">' +
                esc(it.get("brand", "")) + "</div>")

    def dot(iid):
        hexc = str(items.get(iid, {}).get("colorHex", "CCCCCC")).lstrip("#")
        return '<span class="swatch-dot" style="background:#' + esc(hexc) + '"></span>'

    sections = ""
    for tid in tops:
        top = items.get(tid, {})
        pairs = ""
        for bid in bottoms:
            bot = items.get(bid, {})
            cell = matrix.get(str(tid) + "_" + str(bid), {})
            mood = cell.get("mood", "Сочетание")
            tip = cell.get("tip", "")
            pairs += (
                '<div class="pair"><div class="pair-bot">'
                '<div class="pair-bot-img">' + img_box(bid) + "</div>"
                '<div class="pair-bot-meta">'
                '<div class="pair-bot-brand">' + esc(bot.get("brand", "")) + "</div>"
                '<div class="pair-bot-name">#' + esc(bid) + " · " + esc(bot.get("name", "")) + "</div>"
                '<div class="pair-bot-color">' + dot(bid) + " " + esc(bot.get("colorName", "")) + "</div>"
                "</div></div>"
                '<div class="pair-mood"><div class="mood-name">✨ ' + esc(mood) + "</div>"
                '<div class="mood-tip">' + esc(tip) + "</div></div></div>")
        sections += (
            '<section class="top-section" id="top-' + esc(tid) + '">'
            '<div class="top-header"><div class="top-img">' + img_box(tid) + "</div>"
            '<div class="top-info"><div class="top-num">#' + esc(tid) + "</div>"
            '<div class="top-brand">' + esc(top.get("brand", "")) + "</div>"
            "<h2>" + esc(top.get("name", "")) + "</h2>"
            '<div class="top-color">' + dot(tid) + " " + esc(top.get("colorName", "")) + "</div>"
            '<div class="top-count">' + str(len(bottoms)) + ' вариантов низа</div></div></div>'
            '<div class="pairs-grid">' + pairs + "</div></section>")

    jump = "Прыгнуть к верху: " + "".join(
        '<a href="#top-' + esc(t) + '">#' + esc(t) + "</a>" for t in tops)

    subtitle = (str(len(tops)) + " верхов × " + str(len(bottoms)) + " низов = " +
                str(len(tops) * len(bottoms)) + " сочетаний")
    header = make_header("combinations", pages, title, subtitle)
    body = ('<div class="top-jump">' + jump + "</div>"
            '<main class="container">' + sections + "</main>"
            '<footer class="footer">Каждая комбинация — live-styling tip. Чек-лист «что с чем носить».</footer>')
    return page(title, header, body)


# -------------------------------------------------------------- validate ---

REQUIRED_ITEM_FIELDS = ("id", "category", "name", "colorHex", "verdict")
VALID_VERDICTS = ("yes", "maybe", "no")


def validate(data):
    """Проверяет wardrobe.json на типичные ошибки.

    Возвращает (errors, warnings) — два списка строк. Ничего не печатает и
    не падает: вызывающая сторона решает, что делать с результатом.
    """
    errors, warnings = [], []

    if not isinstance(data, dict):
        errors.append("Корень JSON должен быть объектом {...}.")
        return errors, warnings

    if not data.get("person"):
        warnings.append("Нет блока 'person' — страница Профиль будет почти пустой.")

    items = data.get("items", []) or []
    if not isinstance(items, list):
        errors.append("'items' должен быть массивом [...].")
        items = []

    # --- проверка вещей ---
    seen_ids = {}
    item_ids = set()
    for i, it in enumerate(items):
        if not isinstance(it, dict):
            errors.append("items[{}] — не объект.".format(i))
            continue
        iid = it.get("id")
        where = "вещь id={}".format(iid) if iid is not None else "items[{}]".format(i)
        for f in REQUIRED_ITEM_FIELDS:
            if it.get(f) in (None, ""):
                warnings.append("{}: не заполнено поле '{}'.".format(where, f))
        if iid is not None:
            if iid in seen_ids:
                errors.append("Дубликат id={} (встречается несколько раз в items).".format(iid))
            seen_ids[iid] = True
            item_ids.add(iid)
        v = it.get("verdict")
        if v is not None and v not in VALID_VERDICTS:
            warnings.append("{}: вердикт '{}' неизвестен — будет показан как есть. Ожидается yes/maybe/no.".format(where, v))
        img = it.get("img")
        if img and not str(img).lower().endswith(".png"):
            warnings.append("{}: img='{}' — рекомендуется .png (прогони convert_images.py).".format(where, img))

    # --- ссылки из looks ---
    for lk in data.get("looks", []) or []:
        if not isinstance(lk, dict):
            errors.append("Элемент 'looks' — не объект.")
            continue
        for ref in lk.get("items", []) or []:
            if ref not in item_ids:
                errors.append("Лук '{}': ссылается на вещь id={}, которой нет в items.".format(lk.get("name", "?"), ref))

    # --- ссылки из combinations ---
    comb = data.get("combinations", {}) or {}
    for ref in (comb.get("tops", []) or []):
        if ref not in item_ids:
            errors.append("combinations.tops: id={} отсутствует в items.".format(ref))
    for ref in (comb.get("bottoms", []) or []):
        if ref not in item_ids:
            errors.append("combinations.bottoms: id={} отсутствует в items.".format(ref))
    for key in (comb.get("matrix", {}) or {}):
        parts = str(key).split("_")
        if len(parts) != 2:
            warnings.append("combinations.matrix: ключ '{}' не вида '<topId>_<bottomId>'.".format(key))
            continue
        try:
            t, b = int(parts[0]), int(parts[1])
        except ValueError:
            warnings.append("combinations.matrix: ключ '{}' содержит нечисловые id.".format(key))
            continue
        if t not in item_ids:
            warnings.append("combinations.matrix: верх id={} (ключ '{}') нет в items.".format(t, key))
        if b not in item_ids:
            warnings.append("combinations.matrix: низ id={} (ключ '{}') нет в items.".format(b, key))

    return errors, warnings


def print_report(errors, warnings):
    if not errors and not warnings:
        print("✅ Проверка пройдена: ошибок и предупреждений нет.")
        return
    if errors:
        print("❌ Ошибки ({}):".format(len(errors)))
        for e in errors:
            print("   •", e)
    if warnings:
        print("⚠️  Предупреждения ({}):".format(len(warnings)))
        for w in warnings:
            print("   •", w)


# ------------------------------------------------------------------- main ---

USAGE = ("Использование:\n"
         "  python3 build_site.py <wardrobe.json> <папка-сайта>          # собрать сайт\n"
         "  python3 build_site.py <wardrobe.json> <папка-сайта> --check  # только проверить данные")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    check_only = "--check" in sys.argv

    if len(args) < 2:
        print(USAGE)
        sys.exit(1)

    data_path, out_dir = args[0], args[1]
    try:
        with open(data_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print("Файл не найден:", data_path)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print("Ошибка в JSON ({}): {}".format(data_path, e))
        print("Проверь запятые, кавычки и скобки в wardrobe.json.")
        sys.exit(1)

    errors, warnings = validate(data)
    print_report(errors, warnings)

    if check_only:
        sys.exit(1 if errors else 0)

    if errors:
        print("\nСайт НЕ собран: сначала исправь ошибки выше в wardrobe.json.")
        sys.exit(1)

    os.makedirs(out_dir, exist_ok=True)

    has_items = bool(data.get("items"))
    has_looks = bool(data.get("looks"))
    has_comb = bool(data.get("combinations", {}).get("matrix"))

    pages = []
    if has_items:
        pages.append(("lookbook", "👗 Гардероб", "Lookbook.html"))
    if has_looks:
        pages.append(("looks", "✨ Луки", "Looks.html"))
    if has_comb:
        pages.append(("combinations", "🔀 Сочетания", "Combinations.html"))
    pages.append(("profile", "👤 Профиль", "Profile.html"))

    written = []

    def write(fname, content):
        path = os.path.join(out_dir, fname)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(content)
        written.append(fname)

    write("Profile.html", build_profile(data, pages))
    if has_items:
        write("Lookbook.html", build_lookbook(data, pages))
    if has_looks:
        write("Looks.html", build_looks(data, pages))
    if has_comb:
        write("Combinations.html", build_combinations(data, pages))

    print("\nСайт собран в:", out_dir)
    for w in written:
        print("  ✓", w)


if __name__ == "__main__":
    main()
