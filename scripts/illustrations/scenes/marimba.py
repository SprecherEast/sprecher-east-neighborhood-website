from ..parts import *

PANEL=(["Live marimba"],["Rooms A and B","Monthly series","Older kids to adults","Cost: still checking"])
O=f'stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"'

def book_row(x,y,w,h,seed):
    """One shelf of books: upright spines in the muted palette, one leaning at the end."""
    cols=("#d9532f","#4f8fc0","#f2b632","#2f7a3f","#d9b27c","#8b5e3c","#6f8fb8")
    g="";cx=x+8;i=seed
    while cx<x+w-30:
        bw=16+(i*7)%14; bh=h-12-(i*11)%26
        g+=f'<rect x="{cx}" y="{y+h-bh}" width="{bw}" height="{bh}" fill="{cols[i%len(cols)]}" {O}/>'
        cx+=bw+2; i+=1
    return g

def bookcase(x,y,w,h):
    g=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#b98f62" {O}/>'
    rows=3; rh=(h-16)/rows
    for r in range(rows):
        ry=y+8+r*rh
        g+=f'<rect x="{x+8}" y="{ry}" width="{w-16}" height="{rh}" fill="#8b6a46" {O}/>'
        g+=book_row(x+8,ry,w-16,rh-8,r*5+int(x)%7)
        g+=f'<rect x="{x+8}" y="{ry+rh-8}" width="{w-16}" height="8" fill="#b98f62" {O}/>'
    return g

def note(x,y,s=1,rot=0):
    return (f'<g transform="translate({x},{y}) rotate({rot}) scale({s})"><ellipse cx="0" cy="0" rx="17" ry="12" fill="{NAVY}" transform="rotate(-20)"/>'
            f'<path d="M15,-4 L15,-70 Q38,-60 40,-36" fill="none" stroke="{NAVY}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>')

def mallet(x1,y1,x2,y2):
    return (f'<path d="M{x1},{y1} L{x2},{y2}" stroke="{NAVY}" stroke-width="12" stroke-linecap="round"/>'
            f'<path d="M{x1},{y1} L{x2},{y2}" stroke="#d9b27c" stroke-width="6" stroke-linecap="round"/>'
            f'<circle cx="{x2}" cy="{y2}" r="13" fill="{RED}" {O}/>')

def marimba(x0,top,n=13):
    """Front view: wooden bars of falling length over matching metal resonator tubes, on a frame."""
    bw,gap=38,4
    g=f'<ellipse cx="{x0+n*(bw+gap)/2}" cy="{top+222}" rx="{n*(bw+gap)/2+20}" ry="14" fill="#000" opacity=".16"/>'
    for lx in (x0+14,x0+n*(bw+gap)-30):
        g+=f'<rect x="{lx}" y="{top+30}" width="16" height="190" rx="4" fill="#5a4030" {O}/>'
    for i in range(n):
        x=x0+i*(bw+gap); f=i/(n-1)
        th=170-f*100
        g+=f'<rect x="{x+7}" y="{top+34}" width="{bw-14}" height="{th}" rx="6" fill="#c6cdd9" {O}/>'
        g+=f'<rect x="{x+11}" y="{top+40}" width="5" height="{th-14}" rx="2" fill="#fff" opacity=".55"/>'
    g+=f'<rect x="{x0-6}" y="{top+18}" width="{n*(bw+gap)+8}" height="16" rx="5" fill="#5a4030" {O}/>'
    for i in range(n):
        x=x0+i*(bw+gap); f=i/(n-1)
        bh=74-f*28
        g+=f'<rect x="{x}" y="{top-bh+22}" width="{bw}" height="{bh}" rx="7" fill="url(#wood)" {O}/>'
        g+=f'<rect x="{x+6}" y="{top-bh+30}" width="{bw-12}" height="5" rx="2" fill="#fff" opacity=".28"/>'
    return g

def scene_marimba():
    """Pinney Library: a marimba player in front of the shelves, a few neighbors listening."""
    b=(f'<defs><linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9894f"/><stop offset="1" stop-color="#a95f32"/></linearGradient></defs>'
       f'<rect width="{W}" height="{H}" fill="#efe6d4"/>'
       f'<rect x="0" y="610" width="{W}" height="{H-610}" fill="#d4b48a" {O}/>')
    for k in range(1,8):
        y=610+k*48
        b+=f'<path d="M0,{y} L{W},{y}" stroke="{NAVY}" stroke-width="2" opacity=".18"/>'
    b+=bookcase(262,110,330,470)+bookcase(612,110,318,470)
    for nx,ny,s,r in ((330,440,1,-8),(470,380,.9,10),(700,420,1.05,-6),(820,350,.85,12)):
        b+=note(nx,ny,s,r)
    b+=person(528,764,1.6,shirt="#4f8fc0",pants="#2b3556",skin="#8d5a3b",hair="#1f1a17")
    b+=marimba(236,556)
    b+=mallet(482,610,452,548)+mallet(574,610,606,548)
    b+=person(110,884,.82,shirt=RED,pants="#3d4f7a",skin="#d09a73",hair="#5a3a22")
    b+=person(168,888,.5,shirt=YEL,pants="#2b3556",skin="#d09a73",hr=17,arm="wave")
    b+=person(880,890,.78,shirt=GREEN,pants="#2b3556",skin="#b9825c",flip=True)
    return b+panel(*PANEL)
