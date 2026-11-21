from ..parts import *

PANEL=(["Winter","parking"],["Nov. 15 to Mar. 15","1 to 7 a.m.","Odd date: odd side","Even date: even side"])

ROAD_W=270; STEP=310; X0=15; TOP=345; BOTTOM=890; LIFT=-55
SNOW="#ffffff"; SNOW_SHADE="#d5e4f0"
MONTH="DEC"          # the month on every calendar page: any winter night shows the rule
PLOW_SCALE=1.15      # the plow truck next to the cars
# snow heaped on the plow blade: x, y, radius
BLADE_SNOW=((-34,-4,16),(-12,-10,20),(14,-8,19),(36,-2,15),(0,-20,14))

def calendar(x,y,n,s=1):
    """A small calendar page for one date."""
    return (f'<g transform="translate({x},{y}) scale({s})"><rect width="150" height="160" rx="10" fill="#fff" {O}/><rect width="150" height="42" rx="10" fill="{RED}" {O}/>'
            f'<text x="75" y="32" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="26" fill="#fff">{MONTH}</text>'
            f'<text x="75" y="136" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="82" fill="{NAVY}">{n}</text></g>')

def car_from_above(x,y,col):
    return (f'<g transform="translate({x},{y})"><rect width="102" height="150" rx="18" fill="{col}" {O}/>'
            f'<rect x="10" y="26" width="82" height="34" rx="6" fill="{GLASS}" {O}/><rect x="10" y="100" width="82" height="26" rx="6" fill="{GLASS}" {O}/></g>')

def snow_bank(xe,y0,y1,r0,r1,inward):
    """A bank of plowed snow along a road edge at x=xe: overlapping white lumps, outlined once around the whole bank.
    inward is +1 when the road lies to the right of the edge, -1 when it lies to the left."""
    lumps=[]; y=y0; i=0
    while y<=y1:
        t=((i*7+3*(i%3))%10)/9                      # a fixed, uneven pattern: same picture every build
        r=r0+(r1-r0)*t
        lumps.append((xe+inward*(r*(.15+.35*((i*5)%4)/3)),y,r)); y+=r*.95; i+=1
    g="".join(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{SNOW}" stroke="{NAVY}" stroke-width="{SW}"/>' for cx,cy,r in lumps)
    g+="".join(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r-SW/2-.5:.1f}" fill="{SNOW}"/>' for cx,cy,r in lumps)
    g+="".join(f'<path d="M{cx-r*.55:.1f},{cy+r*.35:.1f} Q{cx:.1f},{cy+r*.95:.1f} {cx+r*.55:.1f},{cy+r*.35:.1f}" fill="none" stroke="{SNOW_SHADE}" stroke-width="5" stroke-linecap="round"/>' for cx,cy,r in lumps)
    return g

def plow_from_above(cx,cy,up=True):
    """A snowplow truck seen from above, blade at the front. (cx, cy) is the middle of the blade's front edge;
    the truck drives up the page when up, down when not. Snow heaps on the blade."""
    k=1 if up else -1
    g=f'<g transform="translate({cx},{cy}) scale({PLOW_SCALE},{k*PLOW_SCALE})">'
    # wheels, then body, so the wheels tuck under the truck
    for wx in (-45,31):
        for wy in (50,110):
            g+=f'<rect x="{wx}" y="{wy}" width="14" height="30" rx="4" fill="#1a2033" {O}/>'
    g+=f'<rect x="-36" y="34" width="72" height="104" rx="14" fill="{YEL}" {O}/>'
    g+=f'<rect x="-26" y="44" width="52" height="34" rx="7" fill="{GLASS}" {O}/>'
    g+=f'<rect x="-26" y="88" width="52" height="38" rx="5" fill="#e89a1f" {O}/>'
    g+=f'<circle cx="0" cy="120" r="6" fill="{RED}" {O}/>'
    # blade: wider than the truck, angled edge, with arms back to the truck
    g+=f'<path d="M-26,34 L-26,18 M26,34 L26,18" stroke="{NAVY}" stroke-width="7" stroke-linecap="round"/>'
    g+=f'<path d="M-56,26 L-50,0 L50,0 L56,26 Z" fill="#e89a1f" {O}/>'
    g+=f'<path d="M-50,0 L50,0 L52,8 L-52,8 Z" fill="#fff" opacity=".35"/>'
    # snow heaped on the blade
    for sx,sy,r in BLADE_SNOW:
        g+=f'<circle cx="{sx}" cy="{sy}" r="{r}" fill="{SNOW}" stroke="{NAVY}" stroke-width="{SW}"/>'
    for sx,sy,r in BLADE_SNOW:
        g+=f'<circle cx="{sx}" cy="{sy}" r="{r-SW/2-.5:.1f}" fill="{SNOW}"/>'
    return g+'</g>'

def arrow(cx,cy,direction,length=70,col="#fff"):
    """A bold arrow in the lane: direction 'up', 'down' or 'right'."""
    rot={"up":0,"right":90,"down":180}[direction]
    h=length/2
    return (f'<g transform="translate({cx},{cy}) rotate({rot})"><path d="M0,{-h} L22,{-h+30} L8,{-h+30} L8,{h} L-8,{h} L-8,{-h+30} L-22,{-h+30} Z" '
            f'fill="{col}" stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"/></g>')

def scene_parking():
    """Three nights side by side on one street seen from above. Cars take the odd side, then the even side,
    then the odd side again, so the plow always finds one clear lane to push the snow aside."""
    bg=f'<rect width="{W}" height="{H}" fill="#eef3f7"/>'
    b=""
    nights=((15,True),(16,False),(17,True))
    for i,(day,cars_left) in enumerate(nights):
        x=X0+i*STEP
        b+=calendar(x+(ROAD_W-112)/2,200,day,.75)
        b+=f'<rect x="{x}" y="{TOP}" width="{ROAD_W}" height="{BOTTOM-TOP}" fill="#34405f" {O}/>'
        b+=f'<path d="M{x+ROAD_W/2},{TOP} L{x+ROAD_W/2},{BOTTOM}" stroke="{YEL}" stroke-width="4" stroke-dasharray="30 20"/>'
        # banks: a thin one where the cars are, a tall one on the side the plow clears
        left_edge,right_edge=x,x+ROAD_W
        b+=snow_bank(left_edge,TOP+14,BOTTOM-10,10 if cars_left else 15,14 if cars_left else 25,+1)
        b+=snow_bank(right_edge,TOP+14,BOTTOM-10,15 if cars_left else 10,25 if cars_left else 14,-1)
        for k,col in enumerate((BLUE,RED,"#e8b83b")):
            b+=car_from_above(x+(16 if cars_left else 152),TOP+20+k*172,col)
        lane_cx=x+ROAD_W*.75 if cars_left else x+ROAD_W*.25
        if cars_left:   # the plow drives up the clear right lane
            b+=plow_from_above(lane_cx,TOP+225,up=True)+arrow(lane_cx,TOP+480,"up",76)
        else:           # then down the clear left lane
            b+=arrow(lane_cx,TOP+75,"down",76)+plow_from_above(lane_cx,TOP+405,up=False)
    # time passes: an arrow between the calendar pages
    for i in range(2):
        mid=X0+i*STEP+ROAD_W+(STEP-ROAD_W)/2
        b+=f'<g transform="translate({mid},{262}) scale(.5)">{arrow(0,0,"right",64,col=GREEN)}</g>'
    # lifted so the picture sits level with the panel, which is centered on the canvas
    return bg+f'<g transform="translate(0,{LIFT})">{b}</g>'+panel(*PANEL)
