# Encode a cover as lossy WebP at twice the large catalog card's 340px height, as every GIPF
# project title commits it (the readiness review wants opaque art as lossy WebP).
# usage: python3 -I webp.py <src.jpg> <dest.webp>
import sys
from PIL import Image

src, dest = sys.argv[1], sys.argv[2]
image = Image.open(src).convert('RGB')
height = min(680, image.height)
width = round(image.width * height / image.height)
if (width, height) != image.size:
    image = image.resize((width, height), Image.LANCZOS)
image.save(dest, 'WEBP', quality=85, method=6)
print(f'{src} {Image.open(src).size} -> {dest} {image.size}')
