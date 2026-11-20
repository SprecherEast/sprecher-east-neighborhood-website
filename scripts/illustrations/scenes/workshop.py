from ..parts import *

PANEL=(["Grant idea","workshop"],["Starts at 6 p.m.","Sign up ahead","Share your idea","Feedback from staff"])
O=f'stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"'

def tile(x,y,w,h,bg,shirt,skin,hair):
    """One person in a video-call tile: head and shoulders."""
    cx=x+w/2
    return (f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{bg}" {O}/>'
            f'<path d="M{cx-44},{y+h} Q{cx-44},{y+h-46} {cx},{y+h-46} Q{cx+44},{y+h-46} {cx+44},{y+h} Z" fill="{shirt}" {O}/>'
            f'<circle cx="{cx}" cy="{y+h-70}" r="26" fill="{skin}" {O}/>'
            f'<path d="M{cx-26},{y+h-74} Q{cx-24},{y+h-100} {cx},{y+h-98} Q{cx+24},{y+h-100} {cx+26},{y+h-74} Q{cx+10},{y+h-86} {cx-26},{y+h-74} Z" fill="{hair}" {O}/></g>')

def bulb(x,y,r=54):
    g=''.join(f'<path d="M{x+math.cos(a)*(r+16)},{y+math.sin(a)*(r+16)} L{x+math.cos(a)*(r+44)},{y+math.sin(a)*(r+44)}" stroke="{YEL}" stroke-width="8" stroke-linecap="round"/>'
              for a in (math.radians(d) for d in (-160,-120,-80,-40,0,40)))
    return (g+f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff3b8" {O}/>'
            f'<path d="M{x-14},{y+22} L{x-14},{y-6} Q{x-8},{y-20} {x},{y-6} Q{x+8},{y-20} {x+14},{y-6} L{x+14},{y+22}" fill="none" stroke="{YEL}" stroke-width="6" stroke-linejoin="round"/>'
            f'<rect x="{x-24}" y="{y+r-6}" width="48" height="30" rx="6" fill="#c6cdd9" {O}/>'
            f'<path d="M{x-24},{y+r+8} L{x+24},{y+r+8}" stroke="{NAVY}" stroke-width="3"/>')

def notepad(x,y):
    """A notepad with a sketched plan: a tree and a bench."""
    return (f'<g transform="translate({x},{y}) rotate(-5)"><rect width="190" height="140" rx="6" fill="#fff" {O}/>'
            f'<rect width="190" height="26" rx="6" fill="{RED}" {O}/>'
            f'<circle cx="62" cy="62" r="20" fill="none" stroke="{GREEN}" stroke-width="5"/><path d="M62,82 L62,112" stroke="{NAVY}" stroke-width="5" stroke-linecap="round"/>'
            f'<path d="M104,100 L170,100 M110,100 L110,118 M164,100 L164,118 M108,86 L168,86" stroke="{NAVY}" stroke-width="5" stroke-linecap="round" fill="none"/></g>')

def scene_workshop():
    """A laptop showing a video call full of neighbors, a lit idea above it, a sketch on a notepad."""
    b=f'<rect width="{W}" height="{H}" fill="#e9f0f3"/>'
    b+=f'<rect x="0" y="670" width="{W}" height="{H-670}" fill="#d4b48a" {O}/>'
    b+=bulb(810,262)
    b+=f'<ellipse cx="480" cy="690" rx="360" ry="18" fill="#000" opacity=".16"/>'
    b+=f'<rect x="196" y="290" width="540" height="350" rx="16" fill="#2b3556" {O}/><rect x="216" y="310" width="500" height="310" rx="6" fill="#eef3f7"/>'
    cols=(("#bcd9e8","#4f8fc0","#a8714f","#2a1d17"),("#f6e3b0","#d9532f","#d09a73","#5a3a22"),("#d6e8d1","#2f7a3f","#8d5a3b","#1f1a17"),
          ("#f0d6cf","#f2b632","#b9825c","#3d2a1f"),("#c9d3ea","#6f8fb8","#d09a73","#8a5a2b"),("#e3dcc8","#2b3556","#a8714f","#2a1d17"))
    for i,c in enumerate(cols):
        r,k=divmod(i,3)
        b+=tile(230+k*158,324+r*140,150,130,*c)
    b+=f'<path d="M150,640 L782,640 L752,684 L180,684 Z" fill="#c6cdd9" {O}/><rect x="400" y="640" width="132" height="12" rx="5" fill="#8c96a8" {O}/>'
    b+=notepad(560,740)
    b+=f'<g transform="translate(770,836) rotate(-12)"><rect width="150" height="14" rx="4" fill="{YEL}" {O}/><path d="M150,0 L176,7 L150,14 Z" fill="#f0d6b0" {O}/></g>'
    return b+panel(*PANEL)
