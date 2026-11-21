#!/usr/bin/env python3
"""Capture landing-page screenshots (docs/images/) and catalog cards (docs/images/cards/, 960x600 JPG) from the
hosted example. Serve docs/ first: python3 -m http.server 8823 --bind 127.0.0.1 --directory docs"""
import io
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT, CARDS = ROOT / "docs" / "images", ROOT / "docs" / "images" / "cards"
BASE = "http://127.0.0.1:8823/try/"


def save(png, name, card=None):
    im = Image.open(io.BytesIO(png)).convert("RGB")
    im.save(OUT / f"{name}.jpg", quality=82, optimize=True)
    if card:
        c = im.resize((960, 600), Image.LANCZOS)
        for q in range(80, 30, -5):
            buf = io.BytesIO(); c.save(buf, "JPEG", quality=q, optimize=True)
            if buf.tell() < 100_000:
                break
        (CARDS / f"macro-stress-testing-{card}.jpg").write_bytes(buf.getvalue())


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    pg.add_init_script("localStorage.setItem('mst-theme','light')")
    pg.goto(BASE); pg.wait_for_timeout(1500)
    save(pg.screenshot(), "pulse", 1)
    pg.click('.tab[data-tab="lab"]'); pg.click('#presets [data-fed="0"]'); pg.wait_for_timeout(1200)
    save(pg.screenshot(), "scenario-lab", 2)
    pg.click('.tab[data-tab="pools"]'); pg.wait_for_timeout(500)
    save(pg.screenshot(), "pools", None)
    pg.click('tr[data-pool="Deep-subprime|BNPL"]'); pg.wait_for_timeout(800)
    save(pg.screenshot(), "pool-drawer", 3)
    pg.keyboard.press("Escape"); pg.click('#presets [data-fed="200"]'); pg.wait_for_timeout(900)
    pg.click('.tab[data-tab="notes"]'); pg.click('#history [data-note="1"]'); pg.wait_for_timeout(500)
    pg.evaluate("window.scrollTo(0, 0)")
    save(pg.screenshot(), "stress-note", 4)
    pg.click('.tab[data-tab="ask"]'); pg.click("#suggest button >> nth=4"); pg.wait_for_timeout(13000)
    pg.evaluate("document.querySelector('#chat').scrollIntoView()"); pg.wait_for_timeout(300)
    save(pg.screenshot(), "ask-agent", 5)
    m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    m.add_init_script("localStorage.setItem('mst-theme','light')")
    m.goto(BASE); m.wait_for_timeout(1500)
    Image.open(io.BytesIO(m.screenshot())).convert("RGB").resize((390, 844)).save(OUT / "phone.jpg", quality=82)
    d = b.new_page(viewport={"width": 1440, "height": 900})
    d.add_init_script("localStorage.setItem('mst-theme','dark')")
    d.goto(BASE + "#lab"); d.wait_for_timeout(1500)
    save(d.screenshot(), "dark-lab", None)
    b.close()
print("done")
