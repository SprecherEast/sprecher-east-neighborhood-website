"""Shared drawing parts for the illustrations: people, trees, cars, backdrop, the text panel.

Colours and sizes come from settings.py. A part that is a real place lives in places.py instead.
"""
import math
from .settings import *

SW=OUTLINE_WIDTH
O=f'stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"'  # the outline every shape shares at full scale

def sc(v):
    """A size in the scene, multiplied by the named scene scale (unchanged at 1)."""
    return v if SCENE_SCALE==1 else v*SCENE_SCALE

def person_torso(shirt,o,hem=-96,shade=True):
    """The shirt of a person facing us, in person() units; hem is where it ends at the waist."""
    g=f'<path d="M-23,-166 Q0,-175 23,-166 L20,{hem} Q0,{hem+6} -20,{hem} Z" fill="{shirt}" {o}/>'
    if shade: g+=f'<path d="M3,-170 Q14,-170 23,-166 L20,{hem} Q10,{hem+3} 3,{hem+3} Z" fill="#000" opacity=".12"/>'
    return g

def person_head(skin,hair,hr,o,hat=None,cap=None):
    """Neck, head and hair (or a hat) of a person facing us, in person() units."""
    g=[]
    g.append(f'<rect x="-6" y="-182" width="12" height="14" fill="{skin}" {o}/>')
    g.append(f'<circle cx="0" cy="-190" r="{hr}" fill="{skin}" {o}/>')
    if hat=="beanie":
        g.append(f'<path d="M{-hr-1},-192 Q0,{-190-hr-12} {hr+1},-192 Z" fill="{cap or RED}" {o}/><rect x="{-hr-2}" y="-196" width="{2*hr+4}" height="7" rx="3" fill="{cap or RED}" {o}/><circle cx="0" cy="{-190-hr-10}" r="4" fill="{cap or RED}" {o}/>')
    elif hat=="police":
        g.append(f'<path d="M{-hr-2},-197 Q0,{-190-hr-14} {hr+2},-197 L{hr+2},-192 L{-hr-2},-192 Z" fill="{NAVY}" {o}/><rect x="{-hr-4}" y="-194" width="{2*hr+14}" height="5" rx="2" fill="#111827" {o}/>')
    else:
        g.append(f'<path d="M{-hr},-191 Q{-hr+1},{-190-hr-3} 0,{-190-hr-3} Q{hr+1},{-190-hr-3} {hr},-191 Q{hr-3},-198 0,-197 Q{-hr+3},-198 {-hr},-191 Z" fill="{hair}" {o}/>')
    return "".join(g)

def person(x,y,s=1,shirt=BLUE,pants=NAVY,skin=SKIN_DARK,hair="#2a1d17",hat=None,arm="down",hr=13,flip=False,cap=None):
    """A standing person at (x, y). arm: "down", "wave", "pad", or "none" when the scene draws the arms itself."""
    s=sc(s)
    sx=-s if flip else s
    o=f'stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round"'
    g=[f'<g transform="translate({x},{y}) scale({sx},{s})">']
    g.append(f'<ellipse cx="0" cy="1" rx="34" ry="6" fill="#000" opacity=".12"/>')
    g.append(f'<rect x="-17" y="-104" width="15" height="98" rx="5" fill="{pants}" {o}/><rect x="2" y="-104" width="15" height="98" rx="5" fill="{pants}" {o}/>')
    g.append(f'<ellipse cx="-11" cy="-4" rx="12" ry="5.5" fill="#2b2b36" {o}/><ellipse cx="11" cy="-4" rx="12" ry="5.5" fill="#2b2b36" {o}/>')
    if arm=="wave":
        g.append(f'<path d="M-24,-160 L-30,-104" stroke="{shirt}" stroke-width="12" stroke-linecap="round"/><circle cx="-30" cy="-98" r="6" fill="{skin}" {o}/>')
    elif arm!="none":
        g.append(f'<rect x="-36" y="-165" width="12" height="68" rx="6" fill="{shirt}" {o}/><circle cx="-30" cy="-95" r="6" fill="{skin}" {o}/>')
    g.append(person_torso(shirt,o))
    if arm=="wave":
        g.append(f'<path d="M24,-160 L44,-206" stroke="{NAVY}" stroke-width="15" stroke-linecap="round"/><path d="M24,-160 L44,-206" stroke="{shirt}" stroke-width="10.5" stroke-linecap="round"/><circle cx="46" cy="-211" r="6.5" fill="{skin}" {o}/>')
    elif arm=="pad":
        g.append(f'<path d="M24,-160 L36,-128 L12,-120" stroke="{NAVY}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M24,-160 L36,-128 L12,-120" stroke="{shirt}" stroke-width="10.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><rect x="2" y="-146" width="20" height="26" rx="2" fill="#f5ede1" {o}/><circle cx="12" cy="-120" r="6" fill="{skin}" {o}/>')
    elif arm!="none":
        g.append(f'<rect x="24" y="-165" width="12" height="68" rx="6" fill="{shirt}" {o}/><circle cx="30" cy="-95" r="6" fill="{skin}" {o}/>')
    g.append(person_head(skin,hair,hr,o,hat,cap))
    g.append('</g>'); return "".join(g)

def tree(x,y,h=300,c="#6fae6c",d="#4f8e56",trunk="#6b4b3a"):
    h=sc(h)
    r=h*.22
    return (f'<g><ellipse cx="{x}" cy="{y}" rx="{r*1.1}" ry="10" fill="#000" opacity=".1"/>'
    f'<rect x="{x-h*.025}" y="{y-h*.45}" width="{h*.05}" height="{h*.45}" fill="{trunk}" stroke="{NAVY}" stroke-width="{SW}"/>'
    f'<circle cx="{x}" cy="{y-h*.62}" r="{r*1.15}" fill="{d}" stroke="{NAVY}" stroke-width="{SW}"/>'
    f'<circle cx="{x-r*.7}" cy="{y-h*.5}" r="{r*.85}" fill="{c}" stroke="{NAVY}" stroke-width="{SW}"/>'
    f'<circle cx="{x+r*.75}" cy="{y-h*.52}" r="{r*.8}" fill="{c}" stroke="{NAVY}" stroke-width="{SW}"/>'
    f'<circle cx="{x-r*.15}" cy="{y-h*.72}" r="{r*.8}" fill="{c}" stroke="{NAVY}" stroke-width="{SW}"/>'
    f'<circle cx="{x-r*.35}" cy="{y-h*.78}" r="{r*.32}" fill="#fff" opacity=".18"/></g>')

def cloud(x,y,s=1):
    return (f'<g transform="translate({x},{y}) scale({s})" fill="#fff" stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round">'
    '<path d="M-60,20 Q-78,20 -76,2 Q-74,-14 -54,-12 Q-52,-38 -22,-38 Q0,-52 24,-34 Q56,-38 62,-8 Q84,-4 80,14 Q78,22 64,20 Z"/></g>')

def backdrop(sky_top="#f0f6ee", horizon=700, snow=False):
    global HILL1,HILL2,GROUND,GROUND2
    if snow: HILL1,HILL2,GROUND,GROUND2="#e6eef3","#dbe6ee","#f3f7fa","#e1ebf2"
    else: HILL1,HILL2,GROUND,GROUND2="#d6e8d1","#c6ddc0","#cfe3c9","#bcd6b4"
    g=f'<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{sky_top}"/><stop offset="1" stop-color="{MINT}"/></linearGradient>'
    g+=f'<linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{GROUND}"/><stop offset="1" stop-color="{GROUND2}"/></linearGradient>'
    g+=f'<linearGradient id="steel" x1="0" x2="1"><stop offset="0" stop-color="#a7b0bf"/><stop offset=".5" stop-color="#d9dfe8"/><stop offset="1" stop-color="#8c96a8"/></linearGradient>'
    g+=f'<pattern id="tape" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="40" height="40" fill="{YEL}"/><rect width="20" height="40" fill="{NAVY}"/></pattern></defs>'
    g+=f'<rect width="{W}" height="{H}" fill="url(#sky)"/>'
    g+=f'<path d="M0,{horizon-70} Q220,{horizon-130} 470,{horizon-70} T1000,{horizon-80} T1600,{horizon-60} L1600,{H} L0,{H} Z" fill="{HILL1}"/>'
    g+=f'<path d="M0,{horizon-30} Q300,{horizon-80} 640,{horizon-30} T1300,{horizon-40} T1600,{horizon-25} L1600,{H} L0,{H} Z" fill="{HILL2}"/>'
    g+=f'<path d="M0,{horizon} Q400,{horizon-26} 800,{horizon-2} T1600,{horizon-8} L1600,{H} L0,{H} Z" fill="url(#gr)" stroke="{NAVY}" stroke-width="{SW}"/>'
    return g

PANELS=[]  # every panel() call is recorded here, so the build can check the text

def panel(title_lines, bullets):
    """The text panel on the right. Sizes come from settings.py; wording is never shortened here."""
    px,pw=PANEL_X,PANEL_W
    th=len(title_lines)*TITLE_LINE; bh=len(bullets)*BULLET_LINE
    ph=40+th+30+22+bh+34
    py=(H-ph)/2-10
    PANELS.append({"title":list(title_lines),"bullets":list(bullets),"x":px,"y":py,"w":pw,"h":ph})
    g=[f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" fill="{CREAM}" stroke="{NAVY}" stroke-width="5"/>']
    y=py+40+58
    for t in title_lines:
        g.append(f'<text x="{px+40}" y="{y}" font-family="Poppins" font-weight="700" font-size="{TITLE_SIZE}" fill="{GREEN}">{t}</text>'); y+=TITLE_LINE
    y-=TITLE_LINE; y+=36
    g.append(f'<rect x="{px+40}" y="{y}" width="{pw-80}" height="4" fill="{NAVY}"/>'); y+=22
    for b in bullets:
        g.append(f'<rect x="{px+42}" y="{y+22}" width="26" height="26" fill="{RED}" stroke="{NAVY}" stroke-width="3"/>')
        g.append(f'<text x="{px+88}" y="{y+52}" font-family="Poppins" font-weight="600" font-size="{BULLET_SIZE}" fill="{NAVY}">{b}</text>'); y+=BULLET_LINE
    return "".join(g)

def car(x,y,body=BLUE,w=250,police=False,flip=False,suv=False):
    w=sc(w)
    k=w/250; sx=-k if flip else k
    o=f'stroke="{NAVY}" stroke-width="{SW/k:.2f}" stroke-linejoin="round"'
    top=-92 if suv else -84
    g=[f'<g transform="translate({x},{y}) scale({sx},{k})">']
    g.append('<ellipse cx="125" cy="2" rx="130" ry="9" fill="#000" opacity=".16"/>')
    roof=f'M34,-48 L50,{top+22} Q58,{top} 84,{top} L {170 if suv else 160},{top} Q{190 if suv else 182},{top+2} 200,-48 Z'
    g.append(f'<path d="{roof}" fill="{body}" {o}/>')
    g.append(f'<path d="M58,-52 L66,{top+18} Q70,{top+8} 86,{top+8} L118,{top+8} L118,-52 Z" fill="{GLASS}" {o}/><path d="M126,-52 L126,{top+8} L {164 if suv else 156},{top+8} Q{176 if suv else 170},{top+10} 184,-52 Z" fill="{GLASS}" {o}/>')
    g.append(f'<path d="M6,-14 L6,-40 Q6,-52 20,-52 L232,-52 Q246,-52 246,-38 L246,-14 Q246,-8 238,-8 L14,-8 Q6,-8 6,-14 Z" fill="{body}" {o}/>')
    if police:
        g.append(f'<path d="M6,-14 L6,-30 L246,-30 L246,-14 Q246,-8 238,-8 L14,-8 Q6,-8 6,-14 Z" fill="{NAVY}" opacity=".95"/>')
        g.append(f'<rect x="78" y="{top-12}" width="42" height="12" rx="3" fill="{RED}" {o}/><rect x="120" y="{top-12}" width="42" height="12" rx="3" fill="{BLUE}" {o}/>')
    g.append(f'<rect x="120" y="-50" width="3" height="40" fill="{NAVY}" opacity=".5"/><rect x="104" y="-40" width="12" height="4" rx="2" fill="{NAVY}" opacity=".6"/><rect x="132" y="-40" width="12" height="4" rx="2" fill="{NAVY}" opacity=".6"/>')
    g.append(f'<rect x="236" y="-40" width="10" height="9" rx="3" fill="#ffe89a" {o}/><rect x="6" y="-40" width="8" height="9" rx="3" fill="#e0603f" {o}/>')
    for cx in (58,196):
        g.append(f'<circle cx="{cx}" cy="-16" r="27" fill="#1a2033" {o}/><circle cx="{cx}" cy="-16" r="13" fill="#c9d0dc" {o}/><circle cx="{cx}" cy="-16" r="4" fill="{NAVY}"/>')
    g.append('</g>'); return "".join(g)

def dog(x,y,s=1,flip=False):
    s=sc(s)
    sx=-s if flip else s; o=f'stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round"'
    return (f'<g transform="translate({x},{y}) scale({sx},{s})"><ellipse cx="0" cy="1" rx="46" ry="6" fill="#000" opacity=".12"/>'
    f'<rect x="-30" y="-30" width="9" height="30" rx="4" fill="#b9874f" {o}/><rect x="14" y="-30" width="9" height="30" rx="4" fill="#b9874f" {o}/>'
    f'<ellipse cx="-4" cy="-46" rx="36" ry="19" fill="#d9a769" {o}/><path d="M28,-62 L56,-70 Q68,-68 70,-56 Q68,-46 56,-48 L34,-40 Z" fill="#d9a769" {o}/>'
    f'<path d="M30,-66 L36,-84 L46,-68 Z" fill="#a8763f" {o}/><circle cx="58" cy="-62" r="3" fill="{NAVY}"/><path d="M-38,-52 Q-56,-66 -50,-82" fill="none" stroke="#d9a769" stroke-width="9" stroke-linecap="round"/></g>')


def head(x,y,lit):
    o=f'stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"'
    g=f'<g><rect x="{x-6}" y="{y-34}" width="12" height="34" fill="{NAVY}"/><rect x="{x-52}" y="{y}" width="104" height="204" rx="10" fill="{YEL}" {o}/><rect x="{x-38}" y="{y+10}" width="76" height="184" rx="8" fill="#232c45" {o}/>'
    cols={"r":"#e24a33","y":"#f2b632","g":"#3fae5a"}
    for i,k in enumerate("ryg"):
        on=(k==lit); fill=cols[k] if on else "#3b4466"
        g+=f'<circle cx="{x}" cy="{y+50+i*58}" r="22" fill="{fill}" stroke="#0f1526" stroke-width="2.5"/>'
        if on: g+=f'<circle cx="{x}" cy="{y+50+i*58}" r="32" fill="{fill}" opacity=".22"/>'
    return g+'</g>'

def grass(extra=""):
    return (f'<defs><linearGradient id="lawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7e8d1"/><stop offset="1" stop-color="#c3dbbb"/></linearGradient>'
            f'<linearGradient id="steel" x1="0" x2="1"><stop offset="0" stop-color="#a7b0bf"/><stop offset=".5" stop-color="#d9dfe8"/><stop offset="1" stop-color="#8c96a8"/></linearGradient>'
            f'<pattern id="tape" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="40" height="40" fill="{YEL}"/><rect width="20" height="40" fill="{NAVY}"/></pattern></defs>'
            f'<rect width="{W}" height="{H}" fill="url(#lawn)"/>')

def cart(x,y,color,lid,s=1,recycle=False):
    s=sc(s)
    o=f'stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round"'
    g=f'<g transform="translate({x},{y}) scale({s})"><ellipse cx="0" cy="4" rx="70" ry="9" fill="#000" opacity=".14"/>'
    g+=f'<path d="M-52,-170 L52,-170 L44,-10 L-44,-10 Z" fill="{color}" {o}/><path d="M-52,-170 L-30,-170 L-24,-10 L-44,-10 Z" fill="#fff" opacity=".12"/>'
    g+=f'<rect x="-60" y="-188" width="120" height="22" rx="6" fill="{lid}" {o}/><rect x="-24" y="-204" width="48" height="16" rx="5" fill="{lid}" {o}/>'
    g+=f'<circle cx="-36" cy="-6" r="12" fill="#1a2033" {o}/><circle cx="36" cy="-6" r="12" fill="#1a2033" {o}/>'
    if recycle: g+=f'<path d="M0,-130 L20,-96 L-20,-96 Z" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>'
    return g+'</g>'

def tape(x1,y1,x2,y2,sag=14):
    mx=(x1+x2)/2; my=(y1+y2)/2+sag
    return f'<path d="M{x1},{y1} Q{mx},{my} {x2},{y2} L{x2},{y2+24} Q{mx},{my+24} {x1},{y1+24} Z" fill="url(#tape)" stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"/>'


def bike(x,y,s=1,flip=False,shirt=RED,helmet=YEL,skin=SKIN_DARK):
    s=sc(s)
    """A cyclist seen from the side, standing on the ground at (x, y), facing right unless flipped."""
    o=f'stroke="{NAVY}" stroke-linejoin="round" stroke-linecap="round"'
    sx=-s if flip else s
    g=[f'<g transform="translate({x},{y}) scale({sx},{s})"><ellipse cx="0" cy="2" rx="62" ry="7" fill="#000" opacity=".14"/>']
    for cx in (-42,42):
        g.append(f'<circle cx="{cx}" cy="-30" r="30" fill="none" {o} stroke-width="{5:.2f}"/><circle cx="{cx}" cy="-30" r="3" fill="{NAVY}"/>')
    g.append(f'<path d="M-42,-30 L-8,-30 L8,-72 L-18,-72 Z M-8,-30 L8,-72 M8,-72 L42,-30 M8,-72 L16,-84" fill="none" {o} stroke-width="4.5"/>')
    g.append(f'<path d="M-20,-72 L-30,-72" {o} stroke-width="6"/>')
    g.append(f'<path d="M-14,-76 L2,-120 L16,-88" fill="none" stroke="{shirt}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>')
    g.append(f'<path d="M-14,-76 L0,-48 L-8,-30" fill="none" stroke="#2b3556" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>')
    g.append(f'<path d="M6,-112 L22,-92" stroke="{shirt}" stroke-width="8" stroke-linecap="round"/><circle cx="24" cy="-90" r="5" fill="{skin}"/>')
    g.append(f'<circle cx="8" cy="-134" r="13" fill="{skin}" {o} stroke-width="3"/><path d="M-5,-136 Q8,-156 22,-136 Z" fill="{helmet}" {o} stroke-width="3"/>')
    g.append('</g>')
    return "".join(g)
