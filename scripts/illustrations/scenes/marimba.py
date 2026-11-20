from ..parts import *

PANEL=(["Live marimba"],["Starts at 11 a.m.","Rooms A and B","Monthly series","Older kids to adults"])
O=f'stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"'
WALL="#6f8fb8"; FLOOR_Y=640
FRAME="#5a4030"; NOTE="#fff3b8"

def limb(points,col,w):
    """A rounded limb or mallet shaft along points, outlined like the people in parts.py."""
    d="M"+" L".join(f"{x},{y}" for x,y in points)
    return (f'<path d="{d}" fill="none" stroke="{NAVY}" stroke-width="{w+SW*2}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')

def shelf(x,y,w,h):
    """One calm, low library shelf: two rows of books in muted tones."""
    cols=("#d9b27c","#c6cdd9","#8c96a8","#e3dcc8","#a8714f")
    g=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#b98f62" {O}/>'
    rh=(h-24)/2
    for r in range(2):
        ry=y+8+r*(rh+8)
        g+=f'<rect x="{x+8}" y="{ry}" width="{w-16}" height="{rh}" fill="#8b6a46" {O}/>'
        cx=x+14; i=r*3
        while cx<x+w-44:
            bw=22+(i*5)%10; bh=rh-10-(i*7)%18
            g+=f'<rect x="{cx}" y="{ry+rh-bh}" width="{bw}" height="{bh}" fill="{cols[i%len(cols)]}" {O}/>'
            cx+=bw+3; i+=1
    return g

def note(x,y,s=1,rot=0):
    """A light eighth note that stands out on the wall."""
    o=f'stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round"'
    return (f'<g transform="translate({x},{y}) rotate({rot}) scale({s})">'
            f'<path d="M12,-4 L12,-66 Q36,-58 40,-34 Q30,-46 20,-46 L20,-4 Z" fill="{NOTE}" {o}/>'
            f'<ellipse cx="0" cy="0" rx="18" ry="13" fill="{NOTE}" transform="rotate(-20)" {o}/></g>')

def beamed(x,y,s=1,rot=0):
    """Two light notes joined by a beam."""
    o=f'stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round"'
    return (f'<g transform="translate({x},{y}) rotate({rot}) scale({s})">'
            f'<path d="M12,-4 L12,-70 L66,-80 L66,-14 L58,-14 L58,-66 L20,-59 L20,-4 Z" fill="{NOTE}" {o}/>'
            f'<path d="M12,-70 L66,-80 L66,-66 L12,-56 Z" fill="{NOTE}" {o}/>'
            f'<ellipse cx="0" cy="0" rx="18" ry="13" fill="{NOTE}" transform="rotate(-20)" {o}/>'
            f'<ellipse cx="46" cy="-10" rx="18" ry="13" fill="{NOTE}" transform="rotate(-20 46 -10)" {o}/></g>')

def marimba(x0,x1,top,floor):
    """Seen from the audience, a little from above: a wooden frame, a back row of sharp-note bars,
    a front row of natural-note bars, a bank of resonator tubes below (long for the low notes), legs."""
    n=14; pitch=(x1-x0)/n; bw=pitch-6
    bed_top,bed_bot=top,top+142
    g=f'<ellipse cx="{(x0+x1)/2}" cy="{floor+4}" rx="{(x1-x0)/2+60}" ry="16" fill="#000" opacity=".18"/>'
    # legs and the low crossbar, behind the tubes
    for lx in (x0-30,x1+8):
        g+=f'<rect x="{lx}" y="{bed_bot-10}" width="22" height="{floor-bed_bot}" rx="4" fill="{FRAME}" {O}/>'
        g+=f'<circle cx="{lx+11}" cy="{floor-4}" r="11" fill="#1a2033" {O}/>'
    g+=f'<rect x="{x0-20}" y="{floor-70}" width="{x1-x0+40}" height="14" rx="4" fill="{FRAME}" {O}/>'
    # resonator tubes, side by side so nothing shows through
    for i in range(n):
        x=x0+i*pitch; f=i/(n-1); L=176-f*104
        g+=f'<path d="M{x+1},{bed_bot} L{x+1},{bed_bot+L-12} Q{x+pitch/2},{bed_bot+L+10} {x+pitch-1},{bed_bot+L-12} L{x+pitch-1},{bed_bot} Z" fill="url(#brass)" {O}/>'
        g+=f'<rect x="{x+7}" y="{bed_bot+6}" width="5" height="{L-26}" rx="2" fill="#fff" opacity=".35"/>'
    # the frame (bed) the bars rest on
    g+=f'<path d="M{x0-26},{bed_top} L{x1+26},{bed_top} L{x1+30},{bed_bot} L{x0-30},{bed_bot} Z" fill="{FRAME}" {O}/>'
    g+=f'<rect x="{x0-30}" y="{bed_bot-14}" width="{x1-x0+60}" height="14" fill="#8b6a46" {O}/>'
    # back row: sharp-note bars, in groups of two and three
    for i in range(n-1):
        if i%7 in (0,1,3,4,5):
            f=i/(n-1); h=52-f*16; cx=x0+(i+1)*pitch
            g+=f'<rect x="{cx-bw*.42}" y="{bed_top+8}" width="{bw*.84}" height="{h}" rx="5" fill="url(#wood)" {O}/>'
    # front row: natural-note bars, longer for the low notes
    for i in range(n):
        f=i/(n-1); h=74-f*24; x=x0+i*pitch+3
        g+=f'<rect x="{x}" y="{bed_top+62}" width="{bw}" height="{h}" rx="6" fill="url(#wood)" {O}/>'
        g+=f'<rect x="{x+6}" y="{bed_top+68}" width="{bw-12}" height="5" rx="2" fill="#fff" opacity=".3"/>'
    return g

def seated(x,y,s,shirt,pants,skin,hair,long_hair=False):
    """A listener seated on a chair, seen from the side, facing right; (x, y) is where the feet meet the floor."""
    o=f'stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round"'
    w=SW/s
    def lb(pts,col,wd):
        d="M"+" L".join(f"{a},{b}" for a,b in pts)
        return (f'<path d="{d}" fill="none" stroke="{NAVY}" stroke-width="{wd+w*2}" stroke-linecap="round" stroke-linejoin="round"/>'
                f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{wd}" stroke-linecap="round" stroke-linejoin="round"/>')
    g=[f'<g transform="translate({x},{y}) scale({s})">',
       '<ellipse cx="0" cy="2" rx="70" ry="8" fill="#000" opacity=".14"/>',
       # chair: back legs, seat, backrest, front leg
       f'<path d="M-56,0 L-50,-96 M30,0 L24,-96" stroke="{NAVY}" stroke-width="8" stroke-linecap="round"/>',
       f'<rect x="-62" y="-106" width="96" height="14" rx="4" fill="#8c96a8" {o}/>',
       f'<rect x="-66" y="-196" width="14" height="96" rx="5" fill="#8c96a8" {o}/>']
    g.append(lb([(-24,-112),(40,-110),(44,-12)],pants,30))
    g.append(f'<ellipse cx="54" cy="-6" rx="20" ry="8" fill="#2b2b36" {o}/>')
    g.append(f'<path d="M-46,-104 L-44,-196 Q-22,-212 2,-196 L6,-104 Z" fill="{shirt}" {o}/>')
    g.append(lb([(-14,-188),(6,-140),(34,-118)],shirt,18))
    g.append(f'<circle cx="38" cy="-116" r="8" fill="{skin}" {o}/>')
    g.append(f'<rect x="-26" y="-214" width="16" height="18" fill="{skin}" {o}/>')
    g.append(f'<circle cx="-16" cy="-236" r="26" fill="{skin}" {o}/>')
    if long_hair:
        g.append(f'<path d="M-44,-236 Q-44,-268 -14,-266 Q12,-266 12,-244 Q-6,-252 -18,-244 L-24,-196 Q-40,-196 -46,-206 Z" fill="{hair}" {o}/>')
    else:
        g.append(f'<path d="M-42,-234 Q-42,-266 -14,-266 Q10,-266 12,-244 Q-8,-254 -22,-246 Q-32,-240 -42,-234 Z" fill="{hair}" {o}/>')
    g.append('</g>'); return "".join(g)

def scene_marimba():
    """Pinney Library: a marimba player behind a large marimba, a parent and child listening."""
    b=(f'<defs><linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9894f"/><stop offset="1" stop-color="#a95f32"/></linearGradient>'
       f'<linearGradient id="brass" x1="0" x2="1"><stop offset="0" stop-color="#a7b0bf"/><stop offset=".45" stop-color="#d9dfe8"/><stop offset="1" stop-color="#8c96a8"/></linearGradient></defs>'
       f'<rect width="{W}" height="{H}" fill="{WALL}"/>'
       f'<rect x="0" y="{FLOOR_Y}" width="{W}" height="{H-FLOOR_Y}" fill="#d4b48a" {O}/>')
    for k in range(1,6):
        y=FLOOR_Y+k*52
        b+=f'<path d="M0,{y} L{W},{y}" stroke="{NAVY}" stroke-width="2" opacity=".16"/>'
    b+=shelf(24,420,250,FLOOR_Y-420)
    for nx,ny,s,r,fn in ((396,350,1.25,-8,note),(706,330,1.3,8,beamed),(840,220,1.15,-6,note)):
        b+=fn(nx,ny,s,r)
    # the player stands behind the instrument; the frame hides everything below the waist
    px,py,ps=604,772,1.9
    b+=person(px,py,ps,shirt=GREEN,pants="#2b3556",skin="#8d5a3b",hair="#1f1a17",arm="none",hr=16)
    b+=marimba(350,872,552,856)
    # arms reach over the bars, one mallet striking a bar, the other lifted for the next note
    sl=(px-24*ps,py-160*ps); sr=(px+24*ps,py-160*ps)
    b+=limb([sl,(px-58,548),(px-74,590)],GREEN,20)
    b+=limb([(px-74,590),(px-150,640)],TAN,8)+f'<circle cx="{px-154}" cy="{643}" r="17" fill="{YEL}" {O}/>'
    b+=f'<g stroke="{NOTE}" stroke-width="6" stroke-linecap="round"><path d="M{px-196},{622} L{px-216},{612}"/><path d="M{px-196},{650} L{px-218},{656}"/><path d="M{px-182},{604} L{px-192},{586}"/></g>'
    b+=f'<circle cx="{px-74}" cy="590" r="12" fill="#8d5a3b" {O}/>'
    b+=limb([sr,(px+74,512),(px+86,546)],GREEN,20)
    b+=limb([(px+86,546),(px+148,486)],TAN,8)+f'<circle cx="{px+152}" cy="482" r="17" fill="{YEL}" {O}/>'
    b+=f'<circle cx="{px+86}" cy="546" r="12" fill="#8d5a3b" {O}/>'
    b+=seated(92,880,1.15,RED,"#3d4f7a","#d09a73","#5a3a22",long_hair=True)
    b+=seated(240,882,.8,YEL,"#2b3556","#d09a73","#5a3a22")
    return b+panel(*PANEL)
