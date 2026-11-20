from ..parts import *

PANEL=(["Grant idea","workshop"],["Starts at 6 p.m.","Sign up ahead","Share your idea","Feedback from staff"])
GLOW="#fff3b8"

# Sketch symbols for a neighborhood project idea, drawn as line work: used on the notepad and around the bulb.
def sk_tree(x,y,s=1,w=5):
    return (f'<g transform="translate({x},{y}) scale({s})" fill="none" stroke-linecap="round" stroke-width="{w/s:.2f}">'
            f'<circle cx="0" cy="-34" r="20" stroke="{GREEN}"/><path d="M0,-14 L0,14" stroke="{NAVY}"/></g>')

def sk_bench(x,y,s=1,w=5):
    return (f'<g transform="translate({x},{y}) scale({s})" fill="none" stroke="{NAVY}" stroke-linecap="round" stroke-width="{w/s:.2f}">'
            f'<path d="M-32,-14 L32,-14 M-32,0 L32,0 M-26,0 L-26,16 M26,0 L26,16"/></g>')

def tile(i,x,y,w,h,bg,shirt,skin,hair,style,extra=None):
    """One neighbor in a video-call tile, head and shoulders, smiling; style sets the hair, extra a gesture."""
    cx=x+w/2; cy=y+h-82; r=38
    g=[f'<defs><clipPath id="tile{i}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8"/></clipPath></defs>',
       f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{bg}" {O}/>',f'<g clip-path="url(#tile{i})">']
    if style=="long": g.append(f'<path d="M{cx-44},{cy+44} L{cx-44},{cy-6} Q{cx-44},{cy-48} {cx},{cy-48} Q{cx+44},{cy-48} {cx+44},{cy-6} L{cx+44},{cy+44} Z" fill="{hair}" {O}/>')
    if style=="curly": g.append(f'<circle cx="{cx}" cy="{cy-10}" r="52" fill="{hair}" {O}/>')
    if style=="bun": g.append(f'<circle cx="{cx}" cy="{cy-46}" r="16" fill="{hair}" {O}/>')
    g.append(f'<path d="M{cx-66},{y+h+4} Q{cx-66},{y+h-44} {cx},{y+h-44} Q{cx+66},{y+h-44} {cx+66},{y+h+4} Z" fill="{shirt}" {O}/>')
    g.append(f'<rect x="{cx-10}" y="{cy+28}" width="20" height="18" fill="{skin}" {O}/>')
    g.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{skin}" {O}/>')
    if style in ("short","long","bun","glasses"):
        g.append(f'<path d="M{cx-r},{cy-4} Q{cx-r+2},{cy-r-6} {cx},{cy-r-6} Q{cx+r-2},{cy-r-6} {cx+r},{cy-4} Q{cx+14},{cy-26} {cx-r},{cy-4} Z" fill="{hair}" {O}/>')
    if style=="bald":
        g.append(f'<path d="M{cx-r+4},{cy+6} Q{cx-r+8},{cy+r+8} {cx},{cy+r+8} Q{cx+r-8},{cy+r+8} {cx+r-4},{cy+6} Q{cx},{cy+20} {cx-r+4},{cy+6} Z" fill="{hair}" {O}/>')
    g.append(f'<circle cx="{cx-13}" cy="{cy-2}" r="4.5" fill="{NAVY}"/><circle cx="{cx+13}" cy="{cy-2}" r="4.5" fill="{NAVY}"/>')
    if style=="glasses":
        g.append(f'<g fill="none" stroke="{NAVY}" stroke-width="3"><circle cx="{cx-13}" cy="{cy-2}" r="11"/><circle cx="{cx+13}" cy="{cy-2}" r="11"/><path d="M{cx-2},{cy-3} L{cx+2},{cy-3}"/></g>')
    smile=f'M{cx-13},{cy+13} Q{cx},{cy+25} {cx+13},{cy+13}'
    g.append(f'<path d="{smile}" fill="none" stroke="{NAVY}" stroke-width="3.5" stroke-linecap="round"/>' if style!="bald" else
             f'<path d="M{cx-11},{cy+16} Q{cx},{cy+24} {cx+11},{cy+16}" fill="none" stroke="{NAVY}" stroke-width="3.5" stroke-linecap="round"/>')
    if extra=="wave":
        g.append(f'<path d="M{cx+50},{y+h} L{cx+66},{cy-6}" stroke="{NAVY}" stroke-width="22" stroke-linecap="round"/><path d="M{cx+50},{y+h} L{cx+66},{cy-6}" stroke="{shirt}" stroke-width="16" stroke-linecap="round"/>')
        g.append(f'<circle cx="{cx+68}" cy="{cy-16}" r="12" fill="{skin}" {O}/>')
    if extra=="sketch":
        g.append(f'<g transform="translate({cx+30},{cy+2}) rotate(6)"><rect width="50" height="62" rx="3" fill="#fff" {O}/></g>')
        g.append(sk_tree(cx+56,cy+46,.62,4))
        g.append(f'<circle cx="{cx+34}" cy="{cy+60}" r="9" fill="{skin}" {O}/>')
    g.append('</g>')
    return "".join(g)

def bulb(x,y,r=56):
    """A lit idea bulb with a soft glow and rays."""
    g=(f'<circle cx="{x}" cy="{y}" r="{r+44}" fill="{GLOW}" opacity=".35"/><circle cx="{x}" cy="{y}" r="{r+24}" fill="{GLOW}" opacity=".6"/>')
    g+=''.join(f'<path d="M{x+math.cos(a)*(r+20)},{y+math.sin(a)*(r+20)} L{x+math.cos(a)*(r+46)},{y+math.sin(a)*(r+46)}" stroke="{YEL}" stroke-width="9" stroke-linecap="round"/>'
               for a in (math.radians(d) for d in (-180,-140,-100,-60,-20,20,160)))
    return (g+f'<circle cx="{x}" cy="{y}" r="{r}" fill="{GLOW}" {O}/>'
            f'<path d="M{x-15},{y+24} L{x-15},{y-6} Q{x-8},{y-22} {x},{y-6} Q{x+8},{y-22} {x+15},{y-6} L{x+15},{y+24}" fill="none" stroke="{YEL}" stroke-width="7" stroke-linejoin="round"/>'
            f'<rect x="{x-26}" y="{y+r-6}" width="52" height="32" rx="6" fill="#c6cdd9" {O}/>'
            f'<path d="M{x-26},{y+r+9} L{x+26},{y+r+9}" stroke="{NAVY}" stroke-width="3"/>')

def notepad(x,y):
    """A notepad with the idea sketched as a plan: a path past a tree and a bench."""
    return (f'<g transform="translate({x},{y}) rotate(-5)"><rect width="240" height="150" rx="6" fill="#fff" {O}/>'
            f'<rect width="240" height="28" rx="6" fill="{RED}" {O}/>'
            f'<path d="M18,136 Q70,128 108,100 Q146,72 222,62" fill="none" stroke="{BROWN}" stroke-width="5" stroke-linecap="round" stroke-dasharray="10 9"/></g>'
            +sk_tree(x+56,y+98,1)+sk_bench(x+180,y+118,.85))

def scene_workshop():
    """An online workshop: a laptop with neighbors on a video call, a lit idea above it, the idea sketched on a notepad."""
    b=f'<rect width="{W}" height="{H}" fill="#e9f0f3"/>'
    b+=f'<rect x="0" y="690" width="{W}" height="{H-690}" fill="#d4b48a" {O}/>'
    b+=bulb(470,132)
    b+=sk_tree(318,170,1.25)+sk_bench(624,150,1.1)
    b+=f'<g fill="{YEL}"><circle cx="372" cy="142" r="5"/><circle cx="356" cy="152" r="4"/><circle cx="562" cy="140" r="5"/><circle cx="580" cy="146" r="4"/></g>'
    b+=f'<ellipse cx="460" cy="712" rx="380" ry="18" fill="#000" opacity=".16"/>'
    b+=f'<rect x="120" y="238" width="680" height="420" rx="18" fill="#2b3556" {O}/><rect x="140" y="258" width="640" height="380" rx="6" fill="#eef3f7"/>'
    people=(("#bcd9e8","#4f8fc0",SKIN_LIGHTEST,"#5a3a22","short","wave"),("#f6e3b0",RED,SKIN_LIGHT,"#5a3a22","long",None),("#d6e8d1",GREEN,SKIN_DARKEST,"#1f1a17","curly",None),
            ("#f0d6cf",YEL,SKIN_DARK,"#3d2a1f","bald","sketch"),("#c9d3ea","#6f8fb8",SKIN_LIGHTEST,TAN,"bun",None),("#e3dcc8","#2b3556",SKIN_MID,"#2a1d17","glasses",None))
    for i,p in enumerate(people):
        r,k=divmod(i,3)
        b+=tile(i,148+k*210,266+r*186,204,178,*p)
    b+=f'<path d="M80,658 L840,658 L806,704 L114,704 Z" fill="#c6cdd9" {O}/><rect x="392" y="658" width="136" height="12" rx="5" fill="#8c96a8" {O}/>'
    b+=notepad(596,722)
    b+=f'<g transform="translate(250,846) rotate(-8)"><rect width="190" height="16" rx="4" fill="{YEL}" {O}/><path d="M190,0 L220,8 L190,16 Z" fill="#f0d6b0" {O}/></g>'
    return b+panel(*PANEL)
