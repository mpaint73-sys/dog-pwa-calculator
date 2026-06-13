"""Generate PWA icons from splash-bullterrier.jpg. Run: python scripts/generate-icons.py"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
src = ROOT / 'splash-bullterrier.jpg'

img = Image.open(src).convert('RGB')
w, h = img.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
img = img.crop((left, top, left + side, top + side))

for size in (192, 512):
    out = ROOT / f'icon-{size}.png'
    img.resize((size, size), Image.LANCZOS).save(out, 'PNG')
    print(f'Created {out}')