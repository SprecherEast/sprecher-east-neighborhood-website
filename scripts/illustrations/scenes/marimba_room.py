"""The room and the audience of the marimba scenes: listeners facing the camera, the library shelf
and the music notes on the wall."""
from ..parts import *
from .marimba_parts import NOTE

def upper(dy,skin,shirt,hair,hr=13,long_hair=False,grey=False):
    """Torso, arms resting on the lap, and head of a person facing us, lowered by dy (person() units)."""
    g=f'<g transform="translate(0,{dy})">'
    if long_hair: g+=f'<path d="M{-hr-4},-170 L{-hr-4},-192 Q0,{-190-hr-8} {hr+4},-192 L{hr+4},-170 Z" fill="{hair}" {O}/>'
    g+=person_torso(shirt,O,hem=-100,shade=False)
    for s in (-1,1):
        d=f"M{s*24},-162 L{s*28},-118 L{s*12},-104"
        g+=f'<path d="{d}" fill="none" stroke="{NAVY}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><path d="{d}" fill="none" stroke="{shirt}" stroke-width="10.5" stroke-linecap="round" stroke-linejoin="round"/>'
        g+=f'<circle cx="{s*10}" cy="-103" r="6" fill="{skin}" {O}/>'
    g+=person_head(skin,"#c6cdd9" if grey else hair,hr,O)
    return g+'</g>'

def sitter(x,y,s,skin,shirt,pants,hair,pose="chair",**kw):
    """A listener facing us, on a chair or cross-legged on the floor; (x, y) is where they meet the floor."""
    o=f'stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round"'
    g=f'<g transform="translate({x},{y}) scale({s})"><ellipse cx="0" cy="1" rx="38" ry="6" fill="#000" opacity=".12"/>'
    if pose=="chair":
        g+=f'<rect x="-30" y="-150" width="60" height="70" rx="4" fill="#8c96a8" {o}/>'
        g+=f'<path d="M-30,0 L-28,-56 M30,0 L28,-56" stroke="{NAVY}" stroke-width="6" stroke-linecap="round"/>'
        g+=f'<rect x="-34" y="-62" width="68" height="10" rx="3" fill="#8c96a8" {o}/>'
        for s_ in (-1,1):
            g+=f'<rect x="{-20 if s_<0 else 2}" y="-72" width="18" height="22" rx="5" fill="{pants}" {o}/><rect x="{-19 if s_<0 else 4}" y="-54" width="15" height="50" rx="5" fill="{pants}" {o}/>'
            g+=f'<ellipse cx="{s_*12}" cy="-4" rx="12" ry="5.5" fill="#2b2b36" {o}/>'
        g+=upper(42,skin,shirt,hair,**kw)
    else:
        g+=f'<path d="M-44,-6 Q-44,-26 -14,-24 L0,-16 L14,-24 Q44,-26 44,-6 Q44,4 30,2 L-30,2 Q-44,4 -44,-6 Z" fill="{pants}" {o}/>'
        g+=upper(86,skin,shirt,hair,**kw)
    return g+'</g>'

def shelf(x,y,w,h):
    """One calm, low library shelf: two rows of books in muted tones."""
    cols=("#d9b27c","#c6cdd9","#8c96a8","#e3dcc8",BROWN)
    g=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#b98f62" {O}/>'
    rh=(h-24)/2
    for r in range(2):
        ry=y+8+r*(rh+8)
        g+=f'<rect x="{x+8}" y="{ry}" width="{w-16}" height="{rh}" fill="#8b6a46" {O}/>'
        cx=x+14; i=r*3
        while cx<x+w-40:
            bw=20+(i*5)%10; bh=rh-8-(i*7)%16
            g+=f'<rect x="{cx}" y="{ry+rh-bh}" width="{bw}" height="{bh}" fill="{cols[i%len(cols)]}" {O}/>'
            cx+=bw+3; i+=1
    return g

def note(x,y,s=1,rot=0,beamed=False):
    """A light music note (or two joined by a beam) that stands out on the wall."""
    o=f'stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round"'
    g=f'<g transform="translate({x},{y}) rotate({rot}) scale({s})">'
    if beamed:
        g+=(f'<path d="M12,-4 L12,-70 L66,-80 L66,-14 L58,-14 L58,-66 L20,-59 L20,-4 Z" fill="{NOTE}" {o}/>'
            f'<path d="M12,-70 L66,-80 L66,-66 L12,-56 Z" fill="{NOTE}" {o}/>'
            f'<ellipse cx="46" cy="-10" rx="18" ry="13" fill="{NOTE}" transform="rotate(-20 46 -10)" {o}/>')
    else:
        g+=f'<path d="M12,-4 L12,-66 Q36,-58 40,-34 Q30,-46 20,-46 L20,-4 Z" fill="{NOTE}" {o}/>'
    return g+f'<ellipse cx="0" cy="0" rx="18" ry="13" fill="{NOTE}" transform="rotate(-20)" {o}/></g>'
