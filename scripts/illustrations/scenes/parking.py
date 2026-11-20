from ..parts import *

PANEL=(["Winter","parking"],["Nov. 15 to Mar. 15","1 to 7 a.m.","Odd date: odd side","Even date: even side"])

def calendar(x,y,n,s=1):
    """A small calendar page for one date."""
    return (f'<g transform="translate({x},{y}) scale({s})"><rect width="150" height="160" rx="10" fill="#fff" {O}/><rect width="150" height="42" rx="10" fill="{RED}" {O}/>'
            f'<text x="75" y="32" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="26" fill="#fff">NOV</text>'
            f'<text x="75" y="136" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="82" fill="{NAVY}">{n}</text></g>')

def car_from_above(x,y,col):
    return (f'<g transform="translate({x},{y})"><rect width="102" height="150" rx="18" fill="{col}" {O}/>'
            f'<rect x="10" y="26" width="82" height="34" rx="6" fill="{GLASS}" {O}/><rect x="10" y="100" width="82" height="26" rx="6" fill="{GLASS}" {O}/></g>')

def scene_parking():
    """Three nights side by side on one street seen from above: cars on the left, the right, then the left."""
    b=f'<rect width="{W}" height="{H}" fill="#eef3f7"/>'
    for i,(day,left) in enumerate(((15,True),(16,False),(17,True))):
        x=20+i*305; top=345
        b+=calendar(x+75,200,day,.8)
        b+=f'<rect x="{x}" y="{top}" width="260" height="545" fill="#34405f" {O}/><path d="M{x+130},{top} L{x+130},890" stroke="{YEL}" stroke-width="4" stroke-dasharray="30 20"/>'
        for k,col in enumerate((BLUE,RED,"#e8b83b")):
            b+=car_from_above(x+(14 if left else 144),top+20+k*172,col)
    return b+panel(*PANEL)
