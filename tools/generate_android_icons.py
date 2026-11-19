import os
import fitz
from PIL import Image, ImageDraw

root = r"C:\Users\fredd\.gemini\antigravity\scratch\boda-freddy-priscila-app"
svg_path = os.path.join(root, "icons", "favicon.svg")
res_dir = os.path.join(root, "android", "app", "src", "main", "res")

if not os.path.isdir(res_dir):
    raise SystemExit("android/ res directory not found yet. Run npx cap add android first.")

# Render high-res base icon (1024x1024) from SVG
doc = fitz.open(svg_path)
page = doc[0]
pix = page.get_pixmap(matrix=fitz.Matrix(16, 16), alpha=True)
base_icon = Image.frombytes("RGBA", [pix.width, pix.height], pix.samples)
doc.close()

# Circular version for ic_launcher_round
def make_round(img, size):
    im = img.resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out

# Adaptive foreground (with safe padding so rings never clip)
def make_foreground(img, size):
    bg = Image.new("RGBA", (size, size), (47, 75, 56, 255)) # #2F4B38
    inner = int(size * 0.66)
    im = img.resize((inner, inner), Image.Resampling.LANCZOS)
    off = (size - inner) // 2
    bg.paste(im, (off, off), im)
    return bg

densities = {
    "mipmap-mdpi": (48, 108),
    "mipmap-hdpi": (72, 162),
    "mipmap-xhdpi": (96, 216),
    "mipmap-xxhdpi": (144, 324),
    "mipmap-xxxhdpi": (192, 432),
}

for folder, (ic_sz, fg_sz) in densities.items():
    d = os.path.join(res_dir, folder)
    if not os.path.isdir(d):
        continue
    base_icon.resize((ic_sz, ic_sz), Image.Resampling.LANCZOS).save(os.path.join(d, "ic_launcher.png"))
    make_round(base_icon, ic_sz).save(os.path.join(d, "ic_launcher_round.png"))
    make_foreground(base_icon, fg_sz).save(os.path.join(d, "ic_launcher_foreground.png"))

# Update adaptive icon background color XML if present
bg_xml = os.path.join(res_dir, "values", "ic_launcher_background.xml")
if os.path.isfile(bg_xml):
    with open(bg_xml, "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2F4B38</color>\n</resources>\n')

# Also replace splash images with clean Sage Green + centered emblem
for dirpath, _, filenames in os.walk(res_dir):
    if "splash.png" in filenames:
        sp_path = os.path.join(dirpath, "splash.png")
        with Image.open(sp_path) as old:
            sw, sh = old.size
        canvas = Image.new("RGB", (sw, sh), (47, 75, 56)) # #2F4B38
        logo_sz = int(min(sw, sh) * 0.28)
        logo = base_icon.resize((logo_sz, logo_sz), Image.Resampling.LANCZOS)
        canvas.paste(logo, ((sw - logo_sz) // 2, (sh - logo_sz) // 2), logo)
        canvas.save(sp_path)

print("Android launcher icons and splash screens customized ✔")
