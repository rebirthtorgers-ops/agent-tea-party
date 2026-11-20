# Generates local character avatars and the app icon with Pillow (no external assets).
from PIL import Image, ImageDraw, ImageFilter
import math, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 4  # supersample

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def gradient(size, top, bottom):
    img = Image.new('RGB', (size, size), top)
    d = ImageDraw.Draw(img)
    for y in range(size):
        d.line([(0, y), (size, y)], fill=lerp(top, bottom, y / size))
    return img

def star(d, cx, cy, r, fill, points=4):
    pts = []
    for i in range(points * 2):
        ang = -math.pi / 2 + i * math.pi / points
        rr = r if i % 2 == 0 else r * 0.28
        pts.append((cx + math.cos(ang) * rr, cy + math.sin(ang) * rr))
    d.polygon(pts, fill=fill)

def avatar(path, palette, accessory='star'):
    size = 512 * S
    bg_top, bg_bottom = palette['bg']
    img = gradient(size, bg_top, bg_bottom)
    d = ImageDraw.Draw(img, 'RGBA')
    # soft glow
    for i in range(5):
        r = int(size * (0.30 + i * 0.04))
        d.ellipse([size/2-r, size*0.42-r, size/2+r, size*0.42+r], fill=(255, 255, 255, 8))
    # sparkles
    for (x, y, r, a) in [(0.16, 0.20, 9, 120), (0.82, 0.28, 6, 90), (0.75, 0.12, 4, 70), (0.22, 0.72, 5, 80), (0.88, 0.63, 7, 100)]:
        star(d, x*size, y*size, r*S, (255, 255, 255, a))
    cx = size * 0.5
    # back hair
    hair_dark, hair_light = palette['hair']
    d.ellipse([cx-0.31*size, 0.16*size, cx+0.31*size, 0.86*size], fill=hair_dark + (255,))
    d.ellipse([cx-0.36*size, 0.42*size, cx-0.12*size, 0.95*size], fill=hair_dark + (255,))
    d.ellipse([cx+0.12*size, 0.42*size, cx+0.36*size, 0.95*size], fill=hair_dark + (255,))
    # neck + shoulders
    d.rounded_rectangle([cx-0.075*size, 0.60*size, cx+0.075*size, 0.75*size], radius=0.04*size, fill=palette['skin_shadow'] + (255,))
    d.ellipse([cx-0.42*size, 0.74*size, cx+0.42*size, 1.12*size], fill=palette['cloth'] + (255,))
    d.polygon([(cx-0.13*size, 0.755*size), (cx, 0.86*size), (cx+0.13*size, 0.755*size)], fill=palette['cloth_dark'] + (255,))
    # face
    face = palette['skin']
    d.ellipse([cx-0.245*size, 0.27*size, cx+0.245*size, 0.66*size], fill=face + (255,))
    # ears
    d.ellipse([cx-0.265*size, 0.43*size, cx-0.225*size, 0.52*size], fill=face + (255,))
    d.ellipse([cx+0.225*size, 0.43*size, cx+0.265*size, 0.52*size], fill=face + (255,))
    # fringe: several soft locks
    d.ellipse([cx-0.28*size, 0.20*size, cx+0.28*size, 0.46*size], fill=hair_dark + (255,))
    d.polygon([(cx-0.27*size, 0.30*size), (cx-0.08*size, 0.29*size), (cx-0.14*size, 0.50*size), (cx-0.25*size, 0.44*size)], fill=hair_dark + (255,))
    d.polygon([(cx-0.10*size, 0.28*size), (cx+0.12*size, 0.28*size), (cx+0.05*size, 0.47*size), (cx-0.06*size, 0.43*size)], fill=hair_dark + (255,))
    d.polygon([(cx+0.10*size, 0.29*size), (cx+0.27*size, 0.30*size), (cx+0.24*size, 0.45*size), (cx+0.14*size, 0.47*size)], fill=hair_dark + (255,))
    # hair shine
    d.arc([cx-0.22*size, 0.22*size, cx+0.22*size, 0.42*size], 200, 340, fill=hair_light + (170,), width=max(2, int(0.012*size)))
    # side locks
    d.polygon([(cx-0.25*size, 0.36*size), (cx-0.20*size, 0.36*size), (cx-0.19*size, 0.62*size), (cx-0.25*size, 0.55*size)], fill=hair_dark + (255,))
    d.polygon([(cx+0.20*size, 0.36*size), (cx+0.25*size, 0.36*size), (cx+0.25*size, 0.55*size), (cx+0.19*size, 0.62*size)], fill=hair_dark + (255,))
    # eyes
    eye_y = 0.465*size
    iris = palette['iris']
    for ex in (cx-0.105*size, cx+0.105*size):
        d.ellipse([ex-0.055*size, eye_y-0.062*size, ex+0.055*size, eye_y+0.062*size], fill=(255,255,255,245))
        d.ellipse([ex-0.041*size, eye_y-0.050*size, ex+0.041*size, eye_y+0.056*size], fill=iris + (255,))
        d.ellipse([ex-0.020*size, eye_y-0.018*size, ex+0.020*size, eye_y+0.030*size], fill=(20, 16, 32, 255))
        d.ellipse([ex-0.034*size, eye_y-0.044*size, ex-0.012*size, eye_y-0.020*size], fill=(255,255,255,235))
        d.ellipse([ex+0.008*size, eye_y+0.020*size, ex+0.020*size, eye_y+0.034*size], fill=(255,255,255,140))
        d.arc([ex-0.058*size, eye_y-0.075*size, ex+0.058*size, eye_y+0.055*size], 185, 355, fill=(38, 28, 48, 230), width=max(2, int(0.010*size)))
    # brows
    d.arc([cx-0.17*size, 0.375*size, cx-0.05*size, 0.425*size], 200, 320, fill=palette['brow'] + (220,), width=max(2, int(0.009*size)))
    d.arc([cx+0.05*size, 0.375*size, cx+0.17*size, 0.425*size], 220, 340, fill=palette['brow'] + (220,), width=max(2, int(0.009*size)))
    # blush
    for bx in (cx-0.175*size, cx+0.175*size):
        d.ellipse([bx-0.045*size, 0.535*size, bx+0.045*size, 0.565*size], fill=palette['blush'] + (90,))
    # nose + mouth
    d.arc([cx-0.012*size, 0.535*size, cx+0.012*size, 0.555*size], 20, 160, fill=(120, 80, 90, 160), width=max(1, int(0.006*size)))
    d.arc([cx-0.035*size, 0.565*size, cx+0.035*size, 0.60*size], 15, 165, fill=(150, 70, 90, 230), width=max(2, int(0.008*size)))
    # accessory
    if accessory == 'star':
        star(d, cx+0.245*size, 0.33*size, 0.055*size, palette['accent'] + (255,), 5)
        d.ellipse([cx+0.235*size, 0.32*size, cx+0.255*size, 0.34*size], fill=(255,255,255,180))
    elif accessory == 'moon':
        d.ellipse([cx+0.19*size, 0.29*size, cx+0.30*size, 0.40*size], fill=palette['accent'] + (240,))
        d.ellipse([cx+0.215*size, 0.285*size, cx+0.315*size, 0.395*size], fill=hair_dark + (255,))
    elif accessory == 'ribbon':
        d.polygon([(cx+0.19*size, 0.31*size), (cx+0.31*size, 0.27*size), (cx+0.30*size, 0.37*size), (cx+0.20*size, 0.36*size)], fill=palette['accent'] + (255,))
        d.polygon([(cx+0.31*size, 0.27*size), (cx+0.38*size, 0.32*size), (cx+0.31*size, 0.36*size)], fill=palette['accent_dark'] + (255,))
        d.ellipse([cx+0.235*size, 0.305*size, cx+0.275*size, 0.345*size], fill=palette['accent_dark'] + (255,))
    elif accessory == 'headphone':
        d.arc([cx-0.29*size, 0.19*size, cx+0.29*size, 0.53*size], 180, 360, fill=palette['accent'] + (255,), width=max(4, int(0.022*size)))
        d.rounded_rectangle([cx-0.315*size, 0.34*size, cx-0.235*size, 0.50*size], radius=0.03*size, fill=palette['accent'] + (255,))
        d.rounded_rectangle([cx+0.235*size, 0.34*size, cx+0.315*size, 0.50*size], radius=0.03*size, fill=palette['accent'] + (255,))
    # vignette / bottom fade
    overlay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for y in range(int(size*0.78), size):
        a = int(70 * (y - size*0.78) / (size*0.22))
        od.line([(0, y), (size, y)], fill=(6, 8, 18, a))
    img = Image.alpha_composite(img.convert('RGBA'), overlay)
    img = img.resize((512, 512), Image.LANCZOS)
    img.save(path, 'PNG')

def icon(path):
    size = 1024
    img = gradient(size, (18, 14, 38), (44, 18, 62)).convert('RGBA')
    d = ImageDraw.Draw(img, 'RGBA')
    for i in range(6):
        r = int(size*(0.32 + i*0.045))
        d.ellipse([size/2-r, size*0.52-r, size/2+r, size*0.52+r], fill=(255, 122, 198, 8))
    # teapot body
    d.ellipse([size*0.27, size*0.42, size*0.74, size*0.78], fill=(245, 238, 255, 255))
    d.ellipse([size*0.34, size*0.46, size*0.67, size*0.62], fill=(255, 255, 255, 255))
    # lid
    d.ellipse([size*0.40, size*0.35, size*0.61, size*0.45], fill=(255, 214, 240, 255))
    d.ellipse([size*0.475, size*0.315, size*0.535, size*0.375], fill=(255, 214, 240, 255))
    # spout
    d.polygon([(size*0.73, size*0.50), (size*0.86, size*0.43), (size*0.85, size*0.49), (size*0.74, size*0.58)], fill=(245, 238, 255, 255))
    # handle
    d.arc([size*0.18, size*0.46, size*0.36, size*0.72], 90, 270, fill=(245, 238, 255, 255), width=int(size*0.045))
    # chat bubble
    d.rounded_rectangle([size*0.36, size*0.53, size*0.65, size*0.68], radius=size*0.05, fill=(255, 122, 198, 255))
    d.polygon([(size*0.44, size*0.67), (size*0.50, size*0.67), (size*0.45, size*0.75)], fill=(255, 122, 198, 255))
    for i, x in enumerate([0.44, 0.50, 0.56]):
        d.ellipse([size*x, size*0.595, size*(x+0.035), size*0.63], fill=(255, 255, 255, 255))
    # steam hearts
    for (x, y, s) in [(0.78, 0.22, 0.035), (0.83, 0.34, 0.024)]:
        d.ellipse([size*(x-s), size*(y-s), size*x, size*y], fill=(140, 220, 255, 220))
        d.ellipse([size*x, size*(y-s), size*(x+s), size*y], fill=(140, 220, 255, 220))
        d.polygon([(size*(x-s), size*y), (size*(x+s), size*y), (size*x, size*(y+s*1.4))], fill=(140, 220, 255, 220))
    img = img.resize((512, 512), Image.LANCZOS)
    img.save(path, 'PNG')
    img.save(path.replace('.png', '.ico'), sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])

CHARACTERS = [
  ('xiaoyu', dict(bg=((36, 44, 78), (14, 20, 42)), hair=((44, 38, 66), (122, 100, 160)), skin=(255, 225, 214), skin_shadow=(236, 196, 188),
                  iris=(116, 160, 210), cloth=(74, 102, 150), cloth_dark=(52, 74, 116), brow=(70, 55, 80), blush=(255, 130, 150),
                  accent=(255, 214, 120), accent_dark=(220, 170, 70)), 'star'),
  ('yuejian', dict(bg=((16, 20, 40), (8, 10, 24)), hair=((62, 68, 96), (150, 166, 200)), skin=(250, 226, 220), skin_shadow=(228, 198, 194),
                   iris=(170, 150, 230), cloth=(40, 46, 76), cloth_dark=(28, 32, 56), brow=(50, 52, 72), blush=(240, 150, 180),
                   accent=(150, 210, 255), accent_dark=(90, 150, 210)), 'moon'),
  ('lingdang', dict(bg=((58, 26, 52), (20, 12, 36)), hair=((90, 42, 56), (210, 110, 130)), skin=(255, 228, 214), skin_shadow=(238, 198, 186),
                    iris=(255, 170, 90), cloth=(196, 74, 100), cloth_dark=(150, 50, 74), brow=(90, 45, 55), blush=(255, 120, 130),
                    accent=(255, 214, 100), accent_dark=(220, 160, 60)), 'ribbon'),
  ('aya', dict(bg=((10, 34, 42), (8, 14, 26)), hair=((36, 58, 72), (96, 178, 190)), skin=(250, 224, 212), skin_shadow=(226, 194, 186),
                iris=(80, 230, 210), cloth=(28, 78, 92), cloth_dark=(18, 54, 66), brow=(34, 62, 70), blush=(255, 140, 150),
                accent=(90, 240, 220), accent_dark=(40, 160, 150)), 'headphone'),
]

for cid, palette, acc in CHARACTERS:
    folder = os.path.join(ROOT, 'resources', 'characters', cid)
    os.makedirs(folder, exist_ok=True)
    avatar(os.path.join(folder, 'avatar.png'), palette, acc)
    print('avatar', cid)

os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
icon(os.path.join(ROOT, 'build', 'icon.png'))
print('icon done')
