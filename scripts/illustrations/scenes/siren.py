from ..parts import *
from ..places import *

def siren_tall(x,y,s,ph):
    o=f'stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round"'
    g=[f'<g transform="translate({x},{y}) scale({s})"><ellipse cx="0" cy="3" rx="40" ry="8" fill="#000" opacity=".14"/>']
    g.append(f'<rect x="-9" y="{-470-ph}" width="18" height="{470+ph}" fill="url(#steel)" {o}/><rect x="-20" y="-60" width="40" height="60" fill="#a7b0bf" {o}/>')
    g.append(f'<rect x="-22" y="-270" width="44" height="64" rx="4" fill="#8c96a8" {o}/>')
    for yy,sc in ((-430-ph,1),(-350-ph,.86)):
        g.append(f'<g transform="translate(0,{yy}) scale({sc})">')
        g.append(f'<path d="M20,-14 L126,-46 L126,46 L20,14 Z" fill="{RED}" {o}/><path d="M-20,-14 L-126,-46 L-126,46 L-20,14 Z" fill="{RED}" {o}/>')
        g.append(f'<path d="M20,-14 L126,-46 L126,-20 L20,-6 Z" fill="#fff" opacity=".25"/><path d="M-20,-14 L-126,-46 L-126,-20 L-20,-6 Z" fill="#fff" opacity=".25"/>')
        g.append(f'<ellipse cx="126" cy="0" rx="9" ry="46" fill="#a63b1e" {o}/><ellipse cx="-126" cy="0" rx="9" ry="46" fill="#a63b1e" {o}/>')
        g.append(f'<rect x="-22" y="-32" width="44" height="64" rx="8" fill="#f1f3f7" {o}/></g>')
    g.append('</g>'); return "".join(g)

def storm(cx,cy,s):
    # one storm cloud and a bolt centred under it
    cloud=(f'<g transform="translate({cx},{cy}) scale({s})" stroke="{NAVY}" stroke-width="{SW/s:.2f}" stroke-linejoin="round">'
      '<path d="M-92,22 Q-112,22 -108,0 Q-104,-20 -80,-18 Q-76,-48 -40,-48 Q-14,-70 20,-48 Q60,-52 70,-14 Q100,-10 96,12 Q94,24 78,22 Z" fill="#9aa6ba"/>'
      '<path d="M-40,-48 Q-14,-70 20,-48 Q36,-50 48,-42 Q10,-44 -20,-30 Z" fill="#b6c0d0" stroke="none"/>'
      '<path d="M-60,22 L78,22 Q94,24 96,12 Q100,-10 70,-14 Q60,-52 20,-48" fill="none"/></g>')
    # cloud spans -108..100 -> centre x = cx-4*s
    mid=cx-4*s
    bolt=(f'<g transform="translate({mid},{cy+34*s})"><path d="M0,-4 L-26,56 L-4,56 L-22,112 L32,38 L8,38 L26,-4 Z" fill="{YEL}" stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round" transform="translate(-3,0)"/></g>')
    rain="".join(f'<line x1="{mid+dx*s*.9}" y1="{cy+36*s+ (dy)}" x2="{mid+dx*s*.9-10}" y2="{cy+36*s+dy+26}" stroke="#6f86a8" stroke-width="5" stroke-linecap="round"/>' for dx,dy in ((-78,6),(-56,26),(54,6),(76,28),(-30,60),(34,64)))
    return cloud+rain+bolt

def arcs(x,y,side,n=3,step=34):
    out=""
    for r in range(1,n+1):
        out+=f'<path d="M{x+side*r*step},{y-60-r*8} Q{x+side*(r*step+step)},{y} {x+side*r*step},{y+60+r*8}" fill="none" stroke="{YEL}" stroke-width="7" stroke-linecap="round" opacity="{1-r*.2}"/>'
    return out

def flags(xs,y):
    return "".join(f'<rect x="{fx-3}" y="{y}" width="6" height="42" fill="#8b5e3c" stroke="{NAVY}" stroke-width="2.5"/><path d="M{fx+3},{y+3} L{fx+30},{y+13} L{fx+3},{y+23} Z" fill="{RED}" stroke="{NAVY}" stroke-width="2.5"/>' for fx in xs)

def woods_range(x0,x1):
    g='<g stroke="'+NAVY+'" stroke-width="3">'
    for x in range(x0,x1,95):
        g+=f'<circle cx="{x}" cy="{470+((x*13)%40)}" r="{70+((x*7)%30)}" fill="#3f7a4f"/>'
    for x in range(x0+50,x1,110):
        g+=f'<circle cx="{x}" cy="{520+((x*11)%36)}" r="{62+((x*5)%22)}" fill="#4f8a5a"/>'
    return g+'</g>'

def scene_siren():
    b=backdrop()+woods_range(-40,660)
    b+=storm(440,120,1.5)
    b+=real_shelter(0,748,.46)
    b+=siren_tall(772,806,.8,300)
    b+=arcs(772-108,236,-1,2,22)+arcs(772+108,236,1,2,22)
    b+=flags((738,848),774)+park_sign(40,852,.82)
    b+=person(640,834,.78,shirt=RED,pants=NAVY,skin="#8d5a3b",hat="beanie",cap="#2f7a3f",arm="wave")+person(696,836,.44,shirt="#e8b83b",pants="#3d4f7a",skin="#b9825c",hat="beanie",cap=RED,hr=17)
    b+=panel(["New siren,","Door Creek Park"],["Approved in Sept.","Winter or spring","Spot not set yet"])
    return b
