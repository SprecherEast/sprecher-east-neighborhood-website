from ..parts import *
from ..places import *
import math

def casing(x,y,s,rot):
    o=f'stroke="{NAVY}" stroke-width="{3/s:.2f}" stroke-linejoin="round"'
    return (f'<g transform="translate({x},{y}) rotate({rot}) scale({s})">'
      f'<ellipse cx="4" cy="14" rx="46" ry="9" fill="#000" opacity=".28"/>'
      f'<path d="M-40,-11 L26,-11 L34,-7 L34,7 L26,11 L-40,11 Z" fill="url(#brass)" {o}/>'
      f'<rect x="-46" y="-13" width="12" height="26" rx="3" fill="#f2cf72" {o}/>'
      f'<ellipse cx="34" cy="0" rx="4" ry="7" fill="#3a2a14" {o}/>'
      f'<path d="M-30,-6 L22,-6" stroke="#fff6d0" stroke-width="3" opacity=".75" stroke-linecap="round"/></g>')

def glint(x,y,r):
    return f'<path d="M{x},{y-r} L{x+r*.25},{y-r*.25} L{x+r},{y} L{x+r*.25},{y+r*.25} L{x},{y+r} L{x-r*.25},{y+r*.25} L{x-r},{y} L{x-r*.25},{y-r*.25} Z" fill="#fffbe6"/>'

def marker(x,y,n,s=1):
    return (f'<ellipse cx="{x}" cy="{y+2}" rx="{34*s}" ry="8" fill="#000" opacity=".3"/>'
            f'<path d="M{x-32*s},{y} L{x-10*s},{y-92*s} L{x+10*s},{y-92*s} L{x+32*s},{y} Z" fill="{YEL}" stroke="{NAVY}" stroke-width="{SW}" stroke-linejoin="round"/>'
            f'<text x="{x}" y="{y-14*s}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="{40*s}" fill="{NAVY}">{n}</text>')

def scene_police():
    b=('<defs>'
       '<linearGradient id="nsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101830"/><stop offset="1" stop-color="#2f3f6a"/></linearGradient>'
       '<linearGradient id="brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7d982"/><stop offset=".55" stop-color="#d9a43b"/><stop offset="1" stop-color="#a87420"/></linearGradient>'
       '<radialGradient id="pool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6c8" stop-opacity=".85"/><stop offset=".6" stop-color="#fff0b0" stop-opacity=".35"/><stop offset="1" stop-color="#fff0b0" stop-opacity="0"/></radialGradient>'
       f'<radialGradient id="redg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="{RED}" stop-opacity=".6"/><stop offset="1" stop-color="{RED}" stop-opacity="0"/></radialGradient>'
       f'<radialGradient id="blueg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#5aa0e0" stop-opacity=".6"/><stop offset="1" stop-color="#5aa0e0" stop-opacity="0"/></radialGradient>'
       '<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff6c8" stop-opacity=".7"/><stop offset="1" stop-color="#fff6c8" stop-opacity=".12"/></linearGradient>'
       f'<clipPath id="scene"><rect x="0" y="0" width="{W}" height="{H}"/></clipPath>'
       f'<pattern id="tape" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="40" height="40" fill="{YEL}"/><rect width="20" height="40" fill="{NAVY}"/></pattern>'
       f'<linearGradient id="steel" x1="0" x2="1"><stop offset="0" stop-color="#7d8aa6"/><stop offset=".5" stop-color="#c4cddd"/><stop offset="1" stop-color="#5c6a88"/></linearGradient>'
       '</defs>')
    b+=f'<rect width="{W}" height="{H}" fill="url(#nsky)"/>'
    for i in range(40):
        x=(i*89)%900+20; y=(i*47)%330+14
        if x<250 and y<180: continue
        b+=f'<circle cx="{x}" cy="{y}" r="{1.4+(i%3)*.8}" fill="#fff" opacity=".75"/>'
    b+=f'<circle cx="740" cy="120" r="50" fill="#f6efd2" stroke="{NAVY}" stroke-width="{SW}"/><circle cx="722" cy="108" r="9" fill="#e6dcb4"/><circle cx="756" cy="136" r="12" fill="#e6dcb4"/>'
    b+='<g clip-path="url(#scene)">'
    # treeline silhouette + far fence
    b+=f'<path d="M0,470 Q60,400 130,450 Q200,380 280,440 Q360,390 450,445 Q540,380 640,440 Q730,395 820,450 Q890,410 960,440 L960,560 L0,560 Z" fill="#17223f" stroke="{NAVY}" stroke-width="{SW}"/>'
    b+=f'<g stroke="#8ea3cf" stroke-width="1.6" opacity=".3">'+"".join(f'<line x1="{x}" y1="470" x2="{x}" y2="580"/>' for x in range(0,940,20))+"".join(f'<line x1="0" y1="{y}" x2="940" y2="{y}"/>' for y in range(470,590,20))+'</g>'
    b+=f'<rect x="0" y="462" width="940" height="7" fill="#8c96a8" stroke="{NAVY}" stroke-width="2.5"/>'
    # police lights washing the fence from off-screen
    b+=f'<ellipse cx="80" cy="540" rx="300" ry="170" fill="url(#redg)"/><ellipse cx="860" cy="520" rx="300" ry="160" fill="url(#blueg)"/>'
    # hoop (lit backboard)
    b+=f'<rect x="805" y="300" width="14" height="300" fill="url(#steel)" stroke="{NAVY}" stroke-width="{SW}"/><rect x="750" y="236" width="124" height="86" fill="#e9eef8" stroke="{NAVY}" stroke-width="{SW}"/><rect x="790" y="268" width="48" height="36" fill="none" stroke="{RED}" stroke-width="4"/><ellipse cx="812" cy="332" rx="32" ry="9" fill="none" stroke="{RED}" stroke-width="6"/><path d="M784,336 L795,386 M840,336 L829,386 M812,340 L812,388" stroke="#fff" stroke-width="3" fill="none"/>'
    # court floor in perspective
    b+=f'<path d="M290,590 L720,590 L1040,900 L-120,900 Z" fill="#3b4871" stroke="{NAVY}" stroke-width="{SW}"/>'
    ln='stroke="#d7e0f4" stroke-width="5" fill="none" opacity=".75" stroke-linejoin="round"'
    b+=f'<path d="M325,606 L685,606 L930,860 L-40,860 Z" {ln}/>'
    b+=f'<path d="M452,606 L558,606 L640,700 L370,700 Z" {ln}/><ellipse cx="505" cy="700" rx="140" ry="22" {ln}/>'
    b+=f'<path d="M345,606 Q505,806 665,606" {ln}/>'
    b+=f'<ellipse cx="520" cy="790" rx="420" ry="105" fill="url(#pool)"/>'
    # flashlight beam from the officer
    b+=f'<path d="M232,646 L252,658 L720,850 L330,880 Z" fill="url(#beam)"/>'
    # tape across the back of the court
    b+=f'<rect x="300" y="566" width="13" height="120" fill="#c8d0e0" stroke="{NAVY}" stroke-width="2.5"/><rect x="700" y="566" width="13" height="120" fill="#c8d0e0" stroke="{NAVY}" stroke-width="2.5"/>'
    b+=tape(306,598,706,598,18)
    # casings: large and bright inside the light pool
    for x,y,s,r,n in ((420,772,.95,-18,1),(560,820,1.1,24,2),(690,762,.85,8,3)):
        b+=casing(x,y,s,r)+glint(x-26*s,y-14*s,12*s)
    for x,y,s,r in ((480,702,.6,-40),(610,716,.62,52),(380,826,.72,12)):
        b+=casing(x,y,s,r)
    # numbered markers standing next to the casings
    b+=marker(374,742,1,.9)+marker(618,800,2,1.1)+marker(742,736,3,.8)
    b+='</g>'
    # officer with flashlight
    b+=person(176,790,1.15,shirt="#5c7bb8",pants="#2b3556",skin="#c58b62",hat="police",arm="pad")
    b+=f'<g transform="translate(206,640) rotate(24)"><rect x="-6" y="-9" width="40" height="18" rx="5" fill="#2b3556" stroke="{NAVY}" stroke-width="3"/><rect x="30" y="-12" width="10" height="24" rx="3" fill="#fff6c8" stroke="{NAVY}" stroke-width="3"/></g>'
    # panel
    b+=panel(["Police report"],["Nov. 8, 12:40 a.m.","Shell casings found","No one hurt","Tips: 608-266-6014"])
    return b
