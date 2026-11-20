
# Generates community AI-girl preset avatars (original chibi interpretations).
from PIL import Image, ImageDraw, ImageFilter
import math, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 4

def lerp(a,b,t): return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))
def rgba(c,a=255): return tuple(c)+(a,)

def gradient(size, top, bottom):
    img=Image.new('RGB',(size,size),top); d=ImageDraw.Draw(img)
    for y in range(size): d.line([(0,y),(size,y)],fill=lerp(top,bottom,y/size))
    return img

def star(d,cx,cy,r,fill,points=4,inner=0.28):
    pts=[]
    for i in range(points*2):
        ang=-math.pi/2+i*math.pi/points
        rr=r if i%2==0 else r*inner
        pts.append((cx+math.cos(ang)*rr, cy+math.sin(ang)*rr))
    d.polygon(pts,fill=fill)

def tri(d,pts,fill): d.polygon(pts,fill=fill)

def draw_ear(d,cx,cy,w,h,hair,inner,kind='cat'):
    if kind in ('cat','fox'):
        hh = h*(1.25 if kind=='fox' else 1.0)
        ww = w*(0.8 if kind=='fox' else 1.0)
        for sign in (-1,1):
            x=cx+sign*0.38*cx
            pts=[(x-ww*0.5,cy+hh*0.45),(x+sign*ww*0.10,cy-hh*0.55),(x+ww*0.5,cy+hh*0.45)]
            d.polygon(pts,fill=rgba(hair))
            inner_pts=[(x-ww*0.25,cy+hh*0.32),(x+sign*ww*0.06,cy-hh*0.30),(x+ww*0.25,cy+hh*0.32)]
            d.polygon(inner_pts,fill=rgba(inner,220))

def draw_horns(d,cx,cy,gold,light):
    s=cx*2
    for sign in (-1,1):
        x=cx+sign*0.16*s
        pts=[(x-sign*0.035*s,cy+0.02*s),(x+sign*0.02*s,cy-0.16*s),(x+sign*0.075*s,cy+0.005*s)]
        d.polygon(pts,fill=rgba(gold))
        d.line(pts+[pts[0]],fill=rgba(light,230),width=max(3,int(0.006*s)))
        d.line([(x+sign*0.02*s,cy-0.13*s),(x+sign*0.04*s,cy-0.02*s)],fill=(255,255,255,120),width=max(2,int(0.004*s)))

def draw_wings(d,cx,cy,base,light):
    s=cx*2
    for sign in (-1,1):
        x=cx+sign*0.27*s
        pts=[(x,cy),(x+sign*0.14*s,cy-0.20*s),(x+sign*0.24*s,cy-0.13*s),(x+sign*0.21*s,cy-0.01*s),(x+sign*0.33*s,cy+0.06*s),(x+sign*0.20*s,cy+0.14*s)]
        d.polygon(pts,fill=rgba(base,235))
        d.line(pts+[pts[0]],fill=rgba(light,190),width=max(3,int(0.005*s)))
        d.line([(x+sign*0.03*s,cy-0.01*s),(x+sign*0.15*s,cy-0.13*s)],fill=rgba(light,160),width=max(2,int(0.004*s)))
        d.line([(x+sign*0.03*s,cy+0.01*s),(x+sign*0.18*s,cy+0.05*s)],fill=rgba(light,140),width=max(2,int(0.004*s)))

def draw_eye(d, ex, ey, sw, sh, iris, lash):
    d.ellipse([ex-sw,ey-sh,ex+sw,ey+sh],fill=(255,255,255,248))
    d.ellipse([ex-sw*0.78,ey-sh*0.86,ex+sw*0.78,ey+sh*0.92],fill=rgba(iris))
    d.ellipse([ex-sw*0.42,ey-sh*0.48,ex+sw*0.42,ey+sh*0.42],fill=(16,14,26,255))
    d.ellipse([ex-sw*0.52,ey-sh*0.66,ex,ey-sh*0.18],fill=rgba(lerp(iris,(255,255,255),0.65),235))
    d.ellipse([ex+sw*0.12,ey+sh*0.22,ex+sw*0.34,ey+sh*0.48],fill=(255,255,255,150))
    d.arc([ex-sw*1.02,ey-sh*1.18,ex+sw*1.02,ey+sh*0.92],188,352,fill=rgba(lash),width=max(2,int(sw*0.26)))
    d.line([(ex-sw*0.95,ey-sh*0.78),(ex-sw*1.22,ey-sh*1.02)],fill=rgba(lash),width=max(2,int(sw*0.16)))

def hairpin(d, cx, cy, r, motif, accent, light, dark):
    if motif=='whale':
        d.ellipse([cx-r*0.85,cy-r*0.38,cx+r*0.42,cy+r*0.38],fill=rgba(accent))
        d.polygon([(cx+r*0.30,cy),(cx+r*0.95,cy-r*0.5),(cx+r*0.78,cy),(cx+r*0.95,cy+r*0.5)],fill=rgba(accent))
        d.ellipse([cx-r*0.62,cy-r*0.16,cx-r*0.48,cy-r*0.02],fill=(255,255,255,230))
        for i in range(3):
            d.ellipse([cx-r*0.25+i*r*0.18,cy-r*0.95-r*0.12, cx-r*0.17+i*r*0.18,cy-r*0.83-r*0.12],fill=rgba(light,220))
    elif motif=='blossom':
        for i in range(6):
            a=i*math.pi/3
            px=cx+math.cos(a)*r*0.52; py=cy+math.sin(a)*r*0.52
            d.ellipse([px-r*0.42,py-r*0.42,px+r*0.42,py+r*0.42],fill=rgba(accent))
        d.ellipse([cx-r*0.25,cy-r*0.25,cx+r*0.25,cy+r*0.25],fill=rgba(light))
    elif motif=='starburst':
        for i in range(10):
            a=i*math.pi/5
            ln=r*(0.95 if i%2==0 else 0.55)
            d.line([(cx,cy),(cx+math.cos(a)*ln,cy+math.sin(a)*ln)],fill=rgba(accent),width=max(3,int(r*0.16)))
        d.ellipse([cx-r*0.22,cy-r*0.22,cx+r*0.22,cy+r*0.22],fill=rgba(light))
    elif motif=='fourstar':
        star(d,cx,cy,r*0.95,rgba(accent),4,0.30)
        star(d,cx-r*0.95,cy+r*0.70,r*0.28,rgba(light,220),4,0.32)
        star(d,cx+r*0.85,cy-r*0.85,r*0.22,rgba(light,200),4,0.32)
    elif motif=='moon':
        d.ellipse([cx-r,cx*0+cy-r,cx+r,cy+r],fill=rgba(accent))
        d.ellipse([cx-r*0.55,cy-r*1.02,cx+r*1.35,cy+r*0.92],fill=rgba(dark))
        d.arc([cx-r,cx*0+cy-r,cx+r,cy+r],110,250,fill=rgba(light),width=max(2,int(r*0.16)))
        star(d,cx+r*0.95,cy-r*0.72,r*0.28,rgba(light),4,0.34)
    elif motif=='hex':
        pts=[]
        for i in range(6):
            a=-math.pi/2+i*math.pi/3
            pts.append((cx+math.cos(a)*r,cy+math.sin(a)*r))
        d.polygon(pts,fill=rgba(accent))
        d.line(pts+[pts[0]],fill=rgba(light),width=3)
        d.line([(cx,cy-r*0.45),(cx,cy+r*0.45)],fill=rgba(dark,180),width=4)
    elif motif=='fan':
        d.pieslice([cx-r*1.15,cy-r*1.15,cx+r*1.15,cy+r*1.15],195,345,fill=rgba(accent))
        for i in range(7):
            a=math.radians(198+i*24)
            d.line([(cx-r*0.15,cy+r*0.28),(cx+math.cos(a)*r*1.12,cy-r*0.1+math.sin(a)*r*1.12)],fill=rgba(dark,190),width=max(2,int(r*0.06)))
        d.ellipse([cx-r*0.16,cy+r*0.12,cx+r*0.16,cy+r*0.40],fill=rgba(light))
    elif motif=='bao':
        d.ellipse([cx-r*0.85,cy-r*0.75,cx+r*0.85,cy+r*0.75],fill=(255,248,240,255))
        for i in range(6):
            a=-math.pi/2+i*math.pi/3
            d.line([(cx+math.cos(a)*r*0.12,cy+math.sin(a)*r*0.12),(cx+math.cos(a)*r*0.62,cy+math.sin(a)*r*0.55)],fill=rgba(accent,170),width=3)
        d.ellipse([cx-r*0.14,cy-r*0.55,cx+r*0.06,cy-r*0.35],fill=rgba(light,180))

def icon(path):
    from generate_assets import icon as base_icon
    base_icon(path)

PALETTES = {
 'deepseek': dict(bg=((9,28,62),(5,9,24)), hair=((30,73,145),(120,208,255)), skin=(255,232,221), skin_shadow=(232,193,184),
    iris=(86,210,245), iris2=(86,210,245), cloth=(9,28,52), cloth_dark=(6,16,32), cloth_light=(238,244,250), brow=(36,54,92),
    blush=(255,132,152), accent=(110,222,255), accent_dark=(44,120,180), gold=(180,220,255), style='long', ears='none',
    motif='whale', headband=True, wings=False, horns=False),
 'gpt': dict(bg=((22,24,34),(6,7,12)), hair=((226,232,244),(148,162,190)), skin=(255,234,224), skin_shadow=(234,198,190),
    iris=(122,226,186), iris2=(122,226,186), cloth=(242,236,220), cloth_dark=(24,28,40), cloth_light=(255,255,255), brow=(112,112,132),
    blush=(255,150,170), accent=(16,163,127), accent_dark=(10,110,88), gold=(224,196,138), style='long', ears='dragon',
    motif='blossom', headband=False, wings=True, horns=True),
 'claude': dict(bg=((52,27,20),(14,8,8)), hair=((186,86,52),(240,160,110)), skin=(255,232,218), skin_shadow=(232,192,182),
    iris=(232,164,79), iris2=(232,164,79), cloth=(30,25,22), cloth_dark=(12,10,9), cloth_light=(238,224,202), brow=(112,58,38),
    blush=(255,142,130), accent=(217,119,87), accent_dark=(150,68,48), gold=(242,214,170), style='long', ears='none',
    motif='starburst', headband=False, wings=False, horns=False, book=True),
 'gemini': dict(bg=((28,20,66),(7,6,18)), hair=((96,92,235),(204,132,255)), skin=(255,232,226), skin_shadow=(232,196,194),
    iris=(96,198,255), iris2=(255,96,170), cloth=(34,26,64), cloth_dark=(16,12,34), cloth_light=(232,226,255), brow=(88,70,150),
    blush=(255,142,180), accent=(142,170,255), accent_dark=(96,80,190), gold=(255,214,140), style='long', ears='cat',
    motif='fourstar', headband=False, wings=False, horns=False),
 'kimi': dict(bg=((31,25,48),(8,7,13)), hair=((206,198,228),(126,108,166)), skin=(255,234,226), skin_shadow=(232,198,194),
    iris=(168,146,235), iris2=(168,146,235), cloth=(22,20,28), cloth_dark=(8,8,12), cloth_light=(238,234,246), brow=(94,82,120),
    blush=(250,150,190), accent=(186,168,245), accent_dark=(104,88,160), gold=(236,224,255), style='long', ears='none',
    motif='moon', headband=False, wings=False, horns=False, asym=True),
 'glm': dict(bg=((15,28,32),(5,9,11)), hair=((30,34,46),(92,104,128)), skin=(255,233,222), skin_shadow=(232,198,188),
    iris=(255,205,106), iris2=(255,205,106), cloth=(18,22,28), cloth_dark=(7,9,12), cloth_light=(232,236,238), brow=(52,54,66),
    blush=(240,150,150), accent=(126,226,202), accent_dark=(52,132,120), gold=(238,214,160), style='long', ears='fox',
    motif='hex', headband=True, wings=False, horns=False),
 'qwen': dict(bg=((33,22,58),(9,6,16)), hair=((91,76,180),(190,158,245)), skin=(255,233,222), skin_shadow=(232,196,190),
    iris=(214,176,255), iris2=(214,176,255), cloth=(38,24,62), cloth_dark=(14,9,26), cloth_light=(244,226,200), brow=(84,64,130),
    blush=(255,146,170), accent=(255,209,138), accent_dark=(172,110,66), gold=(255,220,158), style='long', ears='none',
    motif='fan', headband=False, wings=False, horns=False),
 'doubao': dict(bg=((27,29,66),(8,8,18)), hair=((112,124,222),(196,176,255)), skin=(255,234,226), skin_shadow=(232,198,194),
    iris=(118,215,255), iris2=(118,215,255), cloth=(32,38,78), cloth_dark=(12,14,30), cloth_light=(255,244,248), brow=(88,92,150),
    blush=(255,150,180), accent=(255,204,224), accent_dark=(180,120,150), gold=(255,226,160), style='ponytail', ears='none',
    motif='bao', headband=False, wings=False, horns=False),
 'xiaoyu': dict(bg=((24,30,48),(7,9,16)), hair=((44,48,78),(108,120,160)), skin=(255,232,221), skin_shadow=(232,193,184),
    iris=(126,200,255), iris2=(126,200,255), cloth=(38,46,72), cloth_dark=(16,20,34), cloth_light=(232,238,248), brow=(44,50,76),
    blush=(255,138,160), accent=(158,208,255), accent_dark=(74,120,180), gold=(255,221,151), style='long', ears='none',
    motif='fourstar', headband=False, wings=False, horns=False, book=True),
 'yuejian': dict(bg=((20,22,42),(6,7,14)), hair=((48,42,72),(128,112,170)), skin=(255,234,226), skin_shadow=(232,198,194),
    iris=(186,160,255), iris2=(186,160,255), cloth=(30,30,52), cloth_dark=(10,10,20), cloth_light=(238,234,248), brow=(58,50,86),
    blush=(250,150,190), accent=(178,150,255), accent_dark=(94,78,150), gold=(240,230,255), style='long', ears='none',
    motif='moon', headband=False, wings=False, horns=False),
 'lingdang': dict(bg=((44,24,24),(12,7,8)), hair=((132,52,54),(206,104,92)), skin=(255,234,222), skin_shadow=(234,196,188),
    iris=(255,190,110), iris2=(255,190,110), cloth=(60,30,36), cloth_dark=(20,9,12), cloth_light=(255,240,226), brow=(86,34,38),
    blush=(255,144,148), accent=(255,186,104), accent_dark=(170,90,50), gold=(255,222,160), style='ponytail', ears='none',
    motif='starburst', headband=False, wings=False, horns=False),
 'aya': dict(bg=((16,32,36),(5,9,11)), hair=((52,74,80),(120,160,164)), skin=(255,232,220), skin_shadow=(230,194,184),
    iris=(130,235,235), iris2=(130,235,235), cloth=(24,40,44), cloth_dark=(8,14,16), cloth_light=(226,240,238), brow=(34,54,58),
    blush=(240,150,150), accent=(120,230,220), accent_dark=(46,130,126), gold=(240,220,170), style='short', ears='none',
    motif='hex', headband=False, wings=False, horns=False),
}

def avatar(path, p):
    size=512*S; cx=size*0.5
    img=gradient(size,p['bg'][0],p['bg'][1]).convert('RGBA')
    d=ImageDraw.Draw(img,'RGBA')
    # backdrop aura
    for i in range(7):
        r=size*(0.33+i*0.035)
        d.ellipse([cx-r,size*0.44-r,cx+r,size*0.44+r],outline=rgba(p['accent'],8),width=max(2,int(size*0.008)))
    rnd=ImageDraw.Draw(img,'RGBA')
    for x,y,r,a in [(0.12,0.18,7,120),(0.86,0.22,5,100),(0.78,0.10,3,90),(0.20,0.78,4,80),(0.90,0.68,6,90),(0.08,0.55,3,70)]:
        star(rnd,x*size,y*size,r*S,rgba(p['light'] if 'light' in p else p['accent'],a),4,0.30)
    # wings behind
    if p.get('wings'): draw_wings(d,cx,size*0.735,p['cloth_light'],p['accent'])
    # back hair
    hair=p['hair'][0]; hair_hi=p['hair'][1]
    style=p['style']
    if style=='long':
        d.ellipse([cx-0.335*size,0.14*size,cx+0.335*size,0.93*size],fill=rgba(hair))
        d.ellipse([cx-0.38*size,0.45*size,cx-0.13*size,0.97*size],fill=rgba(hair))
        d.ellipse([cx+0.13*size,0.45*size,cx+0.38*size,0.97*size],fill=rgba(hair))
    elif style=='ponytail':
        d.ellipse([cx-0.30*size,0.15*size,cx+0.30*size,0.70*size],fill=rgba(hair))
        d.ellipse([cx+0.18*size,0.34*size,cx+0.47*size,0.92*size],fill=rgba(hair))
        d.ellipse([cx-0.35*size,0.48*size,cx-0.13*size,0.80*size],fill=rgba(hair))
    else:
        d.ellipse([cx-0.33*size,0.15*size,cx+0.33*size,0.78*size],fill=rgba(hair))
    # animal ears behind front hair

    # neck & body
    d.rounded_rectangle([cx-0.075*size,0.60*size,cx+0.075*size,0.76*size],radius=0.035*size,fill=rgba(p['skin_shadow']))
    d.ellipse([cx-0.46*size,0.74*size,cx+0.46*size,1.12*size],fill=rgba(p['cloth']))
    # inner blouse / collar
    d.polygon([(cx-0.15*size,0.745*size),(cx,0.86*size),(cx+0.15*size,0.745*size)],fill=rgba(p['cloth_light']))
    d.polygon([(cx-0.115*size,0.735*size),(cx,0.80*size),(cx+0.115*size,0.735*size)],fill=rgba(p['skin']))
    # lapels
    d.polygon([(cx-0.22*size,0.74*size),(cx-0.075*size,0.90*size),(cx-0.045*size,0.80*size),(cx-0.15*size,0.735*size)],fill=rgba(p['cloth_dark']))
    d.polygon([(cx+0.22*size,0.74*size),(cx+0.075*size,0.90*size),(cx+0.045*size,0.80*size),(cx+0.15*size,0.735*size)],fill=rgba(p['cloth_dark']))
    # neck ribbon
    if p.get('headband'):
        d.rounded_rectangle([cx-0.055*size,0.785*size,cx+0.055*size,0.825*size],radius=0.015*size,fill=rgba(p['accent']))
        d.polygon([(cx-0.055*size,0.805*size),(cx-0.14*size,0.775*size),(cx-0.13*size,0.845*size)],fill=rgba(p['accent']))
        d.polygon([(cx+0.055*size,0.805*size),(cx+0.14*size,0.775*size),(cx+0.13*size,0.845*size)],fill=rgba(p['accent']))
    else:
        d.rounded_rectangle([cx-0.065*size,0.775*size,cx+0.065*size,0.815*size],radius=0.015*size,fill=rgba(p['accent']))
        star(d,cx,0.795*size,0.042*size,rgba(p['gold']),4,0.3)
    # chest emblem
    if p['motif']=='whale':
        d.ellipse([cx-0.055*size,0.905*size,cx+0.012*size,0.945*size],fill=rgba(p['accent']))
        d.polygon([(cx+0.005*size,0.925*size),(cx+0.06*size,0.905*size),(cx+0.05*size,0.925*size),(cx+0.06*size,0.948*size)],fill=rgba(p['accent']))
    elif p['motif']=='fourstar':
        star(d,cx,0.925*size,0.045*size,rgba(p['accent']),4,0.3)
    elif p['motif']=='hex':
        d.regular_polygon((cx,0.925*size,0.04*size),6,fill=rgba(p['accent']),rotation=0)
    # face
    d.ellipse([cx-0.245*size,0.275*size,cx+0.245*size,0.675*size],fill=rgba(p['skin']))
    d.ellipse([cx-0.265*size,0.44*size,cx-0.225*size,0.53*size],fill=rgba(p['skin']))
    d.ellipse([cx+0.225*size,0.44*size,cx+0.265*size,0.53*size],fill=rgba(p['skin']))
    # fringe
    d.ellipse([cx-0.29*size,0.17*size,cx+0.29*size,0.47*size],fill=rgba(hair))
    d.polygon([(cx-0.285*size,0.29*size),(cx-0.09*size,0.28*size),(cx-0.145*size,0.52*size),(cx-0.27*size,0.45*size)],fill=rgba(hair))
    d.polygon([(cx-0.11*size,0.27*size),(cx+0.11*size,0.27*size),(cx+0.045*size,0.48*size),(cx-0.055*size,0.44*size)],fill=rgba(hair))
    d.polygon([(cx+0.09*size,0.28*size),(cx+0.285*size,0.29*size),(cx+0.265*size,0.45*size),(cx+0.14*size,0.48*size)],fill=rgba(hair))
    # soft highlight
    d.arc([cx-0.225*size,0.20*size,cx+0.225*size,0.44*size],200,338,fill=rgba(hair_hi,180),width=max(3,int(0.012*size)))
    d.arc([cx-0.29*size,0.33*size,cx-0.18*size,0.62*size],100,210,fill=rgba(hair_hi,80),width=max(2,int(0.007*size)))
    # side locks
    d.polygon([(cx-0.26*size,0.36*size),(cx-0.205*size,0.36*size),(cx-0.195*size,0.63*size),(cx-0.26*size,0.55*size)],fill=rgba(hair))
    d.polygon([(cx+0.205*size,0.36*size),(cx+0.26*size,0.36*size),(cx+0.26*size,0.55*size),(cx+0.195*size,0.63*size)],fill=rgba(hair))
    # eyes
    ey=0.475*size
    for sign,iris in ((-1,p['iris']),(1,p['iris2'])):
        ex=cx+sign*0.105*size
        draw_eye(d,ex,ey,0.058*size,0.068*size,iris,p['brow'])
    # brows
    d.arc([cx-0.175*size,0.385*size,cx-0.055*size,0.43*size],198,322,fill=rgba(p['brow'],220),width=max(2,int(0.009*size)))
    d.arc([cx+0.055*size,0.385*size,cx+0.175*size,0.43*size],218,342,fill=rgba(p['brow'],220),width=max(2,int(0.009*size)))
    # blush
    for bx in (cx-0.175*size,cx+0.175*size):
        d.ellipse([bx-0.042*size,0.538*size,bx+0.042*size,0.565*size],fill=rgba(p['blush'],90))
    # nose + mouth
    d.arc([cx-0.011*size,0.538*size,cx+0.011*size,0.554*size],20,160,fill=(120,80,90,170),width=max(1,int(0.005*size)))
    d.arc([cx-0.032*size,0.565*size,cx+0.032*size,0.598*size],15,165,fill=(150,70,90,235),width=max(2,int(0.0075*size)))
    # animal ears / horns on top of the fringe so they stay readable
    if p['ears'] in ('cat','fox'):
        draw_ear(d,cx,0.205*size,0.19*size,0.18*size,hair,(255,190,200),p['ears'])
    if p.get('horns'):
        draw_horns(d,cx,0.235*size,p['gold'],p['cloth_light'])
    # maid headband
    if p.get('headband'):
        d.arc([cx-0.285*size,0.17*size,cx+0.285*size,0.46*size],200,340,fill=(255,255,255,235),width=max(4,int(0.018*size)))
        for i in range(9):
            a=math.radians(205+i*17)
            px=cx+math.cos(a)*0.29*size; py=0.315*size+math.sin(a)*0.145*size
            d.ellipse([px-0.012*size,py-0.012*size,px+0.012*size,py+0.012*size],fill=(255,255,255,230))
    # hairpin accessory
    hairpin(d,cx+0.235*size,0.335*size,0.055*size,p['motif'],p['accent'],p['gold'],hair)
    # book prop
    if p.get('book'):
        d.polygon([(cx-0.40*size,0.80*size),(cx-0.16*size,0.76*size),(cx-0.13*size,0.93*size),(cx-0.37*size,0.97*size)],fill=rgba(p['accent_dark']))
        d.polygon([(cx-0.385*size,0.815*size),(cx-0.175*size,0.785*size),(cx-0.155*size,0.90*size),(cx-0.365*size,0.935*size)],fill=(244,230,205,255))
        for i in range(3):
            d.line([(cx-0.35*size, (0.84+i*0.023)*size),(cx-0.21*size,(0.815+i*0.023)*size)],fill=(180,140,110,140),width=2)
    # vignette
    overlay=Image.new('RGBA',(size,size),(0,0,0,0)); od=ImageDraw.Draw(overlay)
    for y in range(int(size*0.80),size):
        a=int(70*(y-size*0.80)/(size*0.20))
        od.line([(0,y),(size,y)],fill=(5,6,14,a))
    img=Image.alpha_composite(img,overlay).resize((512,512),Image.LANCZOS)
    flat=Image.new('RGB', img.size, (10,12,22))
    flat.paste(img, (0,0), img)
    flat.save(path,'PNG')

for cid,p in PALETTES.items():
    folder=os.path.join(ROOT,'resources','characters',cid); os.makedirs(folder,exist_ok=True)
    avatar(os.path.join(folder,'avatar.png'),p); print('avatar',cid)
