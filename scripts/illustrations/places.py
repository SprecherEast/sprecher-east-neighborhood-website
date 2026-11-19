"""Established real places. Each part here was agreed with the owner and is reused exactly: its
outline never changes, whatever the scene.

- `real_shelter`: the Door Creek Park shelter, traced from the owner's photo of the building.
- `park_sign`: the Door Creek Park entrance sign, from the owner's photo of the sign.
- `conifer`, `woods`: generic park trees, not a real place.

A new real place is added here with its source named, never redrawn inside a scene.
"""
import math
from .parts import *


def brick_lines(x,y,w,h,c,step=22,off=44):
    out=[]
    for i,yy in enumerate(range(int(y),int(y+h),step)):
        out.append(f'<line x1="{x}" y1="{yy}" x2="{x+w}" y2="{yy}" stroke="{c}" stroke-width="2"/>')
        for xx in range(int(x)+(i%2)*(off//2),int(x+w),off):
            out.append(f'<line x1="{xx}" y1="{yy}" x2="{xx}" y2="{yy+step}" stroke="{c}" stroke-width="2"/>')
    return "".join(out)

def real_shelter(X,Y,s,snow=False,smoke=False):
    s=sc(s)
    """Door Creek Park shelter, drawn from the owner's photo (photo coordinates, ground y=905)."""
    o=f'stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round"'
    g=[f'<g transform="translate({X},{Y}) scale({s}) translate(-100,-905)">']
    g.append('<ellipse cx="900" cy="905" rx="860" ry="22" fill="#000" opacity=".12"/>')
    # chimney (light limestone) with metal flue
    g.append(f'<rect x="428" y="322" width="18" height="72" fill="#c3cad6" {o}/><rect x="422" y="316" width="30" height="12" fill="#a7b0bf" {o}/>')
    g.append(f'<rect x="380" y="390" width="110" height="190" fill="#d9d6cc" {o}/>'+brick_lines(380,396,110,184,"#a9a69c",26,55))
    g.append(f'<rect x="374" y="384" width="122" height="14" fill="#c9c6bb" {o}/>')
    if smoke:
        g.append(f'<path d="M437,310 q-26,-30 4,-56 q30,-26 -4,-60 q-20,-24 10,-50" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" opacity=".85"/>')
    # porch back wall + glass doors (left)
    g.append(f'<rect x="300" y="560" width="372" height="330" fill="#d9c49c" {o}/>'+brick_lines(300,566,100,320,"#b7a07a")+brick_lines(300,566,100,0,"#b7a07a"))
    g.append(f'<rect x="400" y="700" width="240" height="190" fill="#2c3a4c" {o}/><path d="M420,890 L500,700 L540,700 L460,890 Z" fill="#fff" opacity=".13"/>')
    for xx in (460,520,580): g.append(f'<line x1="{xx}" y1="700" x2="{xx}" y2="890" stroke="{NAVY}" stroke-width="5"/>')
    # trash carts
    g.append(f'<rect x="340" y="826" width="52" height="68" rx="5" fill="#5d3e32" {o}/><rect x="334" y="818" width="64" height="14" rx="4" fill="#472f26" {o}/><rect x="398" y="830" width="50" height="64" rx="5" fill="#5d3e32" {o}/><rect x="392" y="822" width="62" height="14" rx="4" fill="#472f26" {o}/>')
    # central walls
    g.append(f'<rect x="697" y="490" width="650" height="400" fill="#dcc79f" {o}/>'+brick_lines(697,500,650,170,"#b9a27c",26,60))
    g.append(f'<rect x="650" y="678" width="485" height="212" fill="#2a2d33" {o}/>'+brick_lines(650,684,485,200,"#454a55",26,56))
    g.append(f'<rect x="1135" y="650" width="212" height="240" fill="#dcc79f" {o}/>'+brick_lines(1135,656,212,230,"#b9a27c",26,60))
    g.append(f'<rect x="1345" y="668" width="90" height="222" fill="#1d2128" {o}/>')
    # door + service window + tables
    g.append(f'<rect x="700" y="728" width="77" height="152" fill="#3a3f4a" {o}/><rect x="758" y="800" width="10" height="5" fill="#c3cad6"/>')
    g.append(f'<rect x="868" y="727" width="147" height="108" fill="#1d2128" {o}/><rect x="900" y="758" width="75" height="74" fill="#f4f6fa" {o}/><rect x="918" y="770" width="40" height="44" fill="#cfd6e2"/>')
    g.append(f'<rect x="1085" y="768" width="38" height="30" fill="#e9f06a" {o}/>')
    for tx,ty in ((790,848),):
        g.append(f'<rect x="{tx}" y="{ty}" width="390" height="11" fill="#d9a25a" {o}/><rect x="{tx+10}" y="{ty+28}" width="370" height="9" fill="#d9a25a" {o}/>')
        for lx in range(tx+20,tx+390,90): g.append(f'<line x1="{lx}" y1="{ty+11}" x2="{lx-14}" y2="{ty+62}" stroke="#8c96a8" stroke-width="5"/><line x1="{lx}" y1="{ty+11}" x2="{lx+14}" y2="{ty+62}" stroke="#8c96a8" stroke-width="5"/>')
    # right glass + extension
    g.append(f'<rect x="1525" y="700" width="78" height="195" fill="#9bbbc6" {o}/><path d="M1535,895 L1560,700 L1585,700 L1560,895 Z" fill="#fff" opacity=".25"/>')
    g.append(f'<rect x="1432" y="640" width="68" height="250" fill="#23272f" {o}/><rect x="1618" y="655" width="48" height="245" fill="#23272f" {o}/>')
    g.append(f'<path d="M1600,622 L1700,622 L1700,652 L1600,656 Z" fill="#e9edf3" {o}/>')
    # low left roof (white fascia + dark beam)
    g.append(f'<path d="M150,666 L668,566 L668,614 L240,694 Z" fill="#2b3140" {o}/>')
    g.append(f'<path d="M130,622 L668,522 L668,566 L130,666 Z" fill="#e3e8ef" {o}/>')
    g.append(f'<rect x="212" y="640" width="30" height="248" fill="#23272f" {o}/><rect x="204" y="656" width="9" height="232" fill="#f4f6fa" stroke="{NAVY}" stroke-width="2"/>')
    # main roof: dark beam, wood fin, column, white slab
    g.append(f'<path d="M670,432 L1525,664 L1525,726 L670,504 Z" fill="#23272f" {o}/>')
    g.append(f'<path d="M575,366 L672,432 L672,524 L580,540 Z" fill="#b98f5c" {o}/>')
    g.append(f'<rect x="668" y="430" width="32" height="470" fill="#23272f" {o}/><rect x="654" y="882" width="62" height="24" fill="#c3cad6" {o}/>')
    g.append(f'<rect x="1497" y="640" width="32" height="260" fill="#23272f" {o}/>')
    g.append(f'<path d="M575,366 L1606,626 L1606,658 L575,396 Z" fill="#eef1f6" {o}/>')
    # small young tree in front
    g.append(f'<rect x="1226" y="760" width="9" height="180" fill="#6b4b3a"/><circle cx="1232" cy="690" r="30" fill="#7fb877" {o}/><circle cx="1262" cy="720" r="26" fill="#6aa86a" {o}/><circle cx="1204" cy="730" r="24" fill="#7fb877" {o}/><circle cx="1240" cy="740" r="22" fill="#6aa86a"/>')
    if snow:
        g.append('<path d="M575,360 L1606,620 L1606,640 L575,378 Z" fill="#fff"/><path d="M130,616 L668,516 L668,532 L130,632 Z" fill="#fff"/><rect x="374" y="378" width="122" height="10" fill="#fff"/>')
    g.append('</g>'); return "".join(g)

def conifer(x,y,h=300,snow=False):
    w=h*.42; o=f'stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"'
    g=[f'<g><ellipse cx="{x}" cy="{y}" rx="{w*.5}" ry="9" fill="#000" opacity=".1"/><rect x="{x-6}" y="{y-h*.14}" width="12" height="{h*.14}" fill="#6b4b3a" {o}/>']
    for i,(cy,ww) in enumerate(((.12,1.0),(.38,.82),(.62,.62),(.84,.4))):
        top=y-h*(cy+.28); bot=y-h*cy
        g.append(f'<path d="M{x},{top} L{x+w*ww*.5},{bot} L{x-w*ww*.5},{bot} Z" fill="{"#2f6b45" if i%2==0 else "#3a7d50"}" {o}/>')
        if snow: g.append(f'<path d="M{x},{top} L{x+w*ww*.2},{top+(bot-top)*.4} L{x-w*ww*.2},{top+(bot-top)*.4} Z" fill="#fff" opacity=".95"/>')
    g.append('</g>'); return "".join(g)

def woods(snow=False):
    c1,c2=("#4f8a5a","#3f7a4f") if not snow else ("#5f8f6c","#4d7d5c")
    g='<g stroke="'+NAVY+'" stroke-width="3">'
    for x in range(-40,960,95):
        r=70+((x*7)%30)
        g+=f'<circle cx="{x}" cy="{470+((x*13)%40)}" r="{r}" fill="{c2}"/>'
    for x in range(10,960,110):
        g+=f'<circle cx="{x}" cy="{520+((x*11)%36)}" r="{62+((x*5)%22)}" fill="{c1}"/>'
    g+='</g>'
    return g

def park_sign(x,y,s=1):
    o=f'stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round"'
    return (f'<g transform="translate({x},{y}) scale({s})"><rect x="14" y="-36" width="22" height="120" fill="#4a3226" {o}/><rect x="244" y="-36" width="22" height="120" fill="#4a3226" {o}/>'
    f'<path d="M-6,-70 L270,-70 L284,-42 L-16,-42 Z" fill="#4a3226" {o}/><rect x="-6" y="-70" width="288" height="52" fill="#4a3226" {o}/>'
    f'<text x="138" y="-31" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="25" fill="#f2c14a">DOOR CREEK PARK</text></g>')
