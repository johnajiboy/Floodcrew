import random, math
R=random.Random(7)
out=[]
A=out.append
A('<rect x="0" y="0" width="1000" height="760" fill="#F2EFE9"/>')
# farmland patches
for i in range(60):
    x=R.uniform(0,1000);y=R.uniform(100,760);w=R.uniform(40,110);h=R.uniform(30,80);a=R.uniform(-25,25)
    c=R.choice(['#EEF0D5','#E8EBCB','#F2EFE9','#E5EBC8'])
    A(f'<rect x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{h:.0f}" fill="{c}" stroke="#D9DCBF" stroke-width=".6" transform="rotate({a:.0f} {x:.0f} {y:.0f})"/>')
towns={
 'yarm':[(140,500),(200,470),(265,490),(275,560),(240,610),(170,615),(130,570)],
 'eagle':[(245,395),(320,375),(355,420),(335,480),(270,490),(240,450)],
 'stock':[(290,200),(420,190),(500,215),(470,300),(420,350),(340,370),(300,320),(280,250)],
 'thorn':[(440,300),(520,270),(600,250),(630,320),(600,385),(500,390),(450,350)],
 'mbro':[(600,180),(760,150),(920,140),(920,430),(780,470),(660,440),(630,330),(630,240)],
 'ingle':[(390,420),(470,400),(560,420),(575,500),(520,560),(430,555),(385,500)],
}
for k,p in towns.items():
    pts=' '.join(f'{x},{y}' for x,y in p)
    A(f'<clipPath id="ck{k}"><polygon points="{pts}"/></clipPath>')
    A(f'<polygon points="{pts}" fill="#E1DEDB"/>')
# parks
parks=[[(318,380),(352,372),(362,405),(330,418)],[(700,285),(735,280),(740,312),(705,316)],[(470,455),(505,450),(510,480),(475,486)],[(395,262),(430,255),(440,280),(405,288)],[(800,360),(845,355),(850,395),(805,400)],[(180,520),(205,515),(210,540),(185,545)]]
for p in parks:
    A('<polygon points="'+' '.join(f'{x},{y}' for x,y in p)+'" fill="#C8E6B0" stroke="#B5D69A" stroke-width=".6"/>')
# streets + buildings per town
for k,p in towns.items():
    xs=[a for a,b in p];ys=[b for a,b in p];cx=sum(xs)/len(xs);cy=sum(ys)/len(ys)
    ang=R.uniform(-30,30);sp=13 if k!='mbro' else 15
    seg=[]
    for i in range(-30,31):
        off=i*sp+R.uniform(-3,3)
        seg.append(f'M{cx-300} {cy+off} L{cx+300} {cy+off+R.uniform(-15,15)}')
    for i in range(-30,31):
        off=i*sp*1.6+R.uniform(-5,5)
        seg.append(f'M{cx+off} {cy-300} L{cx+off+R.uniform(-20,20)} {cy+300}')
    # a few curvy cul-de-sacs
    for i in range(14):
        x=R.uniform(min(xs),max(xs));y=R.uniform(min(ys),max(ys));r=R.uniform(8,22)
        seg.append(f'M{x-r:.0f} {y:.0f} Q{x:.0f} {y-r:.0f} {x+r:.0f} {y:.0f}')
    bl=[]
    for i in range(260 if k in('mbro','stock') else 140):
        x=R.uniform(min(xs),max(xs));y=R.uniform(min(ys),max(ys));w=R.uniform(3,7);h=R.uniform(3,6)
        bl.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}"/>')
    A(f'<g clip-path="url(#ck{k})" transform-origin="{cx} {cy}"><g transform="rotate({ang:.0f} {cx:.0f} {cy:.0f})"><path d="{" ".join(seg)}" stroke="#FFFFFF" stroke-width="2.2" fill="none"/></g><g fill="#D2CCC6">{"".join(bl)}</g></g>')
# river Tees and becks
tees="M60 760 C90 700 140 690 150 640 C160 590 120 560 170 530 C215 505 200 470 245 455 C290 440 270 405 310 392 C345 382 335 350 372 342 C410 334 395 300 430 292 C470 284 480 300 505 280 C530 260 560 270 590 250 C620 232 640 215 670 210 C710 204 730 222 760 196 C790 172 820 180 850 150 C880 122 930 118 1000 100"
A(f'<path d="{tees}" fill="none" stroke="#AAD3DF" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>')
for d in ["M0 610 C60 600 100 620 150 640","M300 140 C320 200 300 260 330 300 C345 320 360 330 372 342","M560 470 C600 420 590 360 610 300 C615 280 600 260 590 250","M760 470 C750 400 770 320 760 260 C755 230 760 210 760 196"]:
    A(f'<path d="{d}" fill="none" stroke="#AAD3DF" stroke-width="3" stroke-linecap="round"/>')
# railway
rail="M90 760 C150 650 200 560 250 500 C300 440 360 360 420 305 C470 262 520 262 600 262 C680 262 760 238 920 225 L1000 220"
A(f'<path d="{rail}" fill="none" stroke="#9A9A9A" stroke-width="3"/><path d="{rail}" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="6 6"/>')
# roads: (path, casing, fill, width)
roads=[
 ("M40 600 C120 590 170 575 210 560",'#C99A5B','#FCD6A4',6),
 ("M210 560 C240 520 250 480 280 450 C310 420 330 400 360 360 C380 330 392 290 400 250 L410 140",'#C99A5B','#FCD6A4',6),
 ("M480 320 C540 318 600 322 650 318 C720 312 800 300 920 292",'#C99A5B','#FCD6A4',6),
 ("M560 520 C620 500 660 482 720 468 C800 450 860 445 1000 440",'#C99A5B','#FCD6A4',6),
 ("M400 560 C450 545 500 530 560 520",'#B8B47A','#F7FABF',5),
 ("M330 400 C380 420 420 440 470 455",'#B8B47A','#F7FABF',5),
 ("M650 318 C660 360 690 400 700 470 L700 760",'#B8B47A','#F7FABF',5),
 ("M610 760 C615 650 625 560 615 480 C605 420 590 360 575 300 C560 240 552 190 540 100",'#C2665A','#F9B29C',9),
 ("M0 215 C150 215 300 212 420 210 C520 208 600 198 700 188 C800 178 880 170 1000 160",'#C2665A','#F9B29C',9),
]
for d,c,f,w in roads: A(f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w+2}" stroke-linecap="round"/>')
for d,c,f,w in roads: A(f'<path d="{d}" fill="none" stroke="{f}" stroke-width="{w}" stroke-linecap="round"/>')
# bridges over river where A19, A66 cross: just redraw short segments (already on top)
# road shields
def shield(x,y,t,trunk=True):
    w=8+len(t)*6
    A(f'<g><rect x="{x-w/2}" y="{y-8}" width="{w}" height="15" rx="2" fill="{"#2E7D4F" if trunk else "#fff"}" stroke="{"#fff" if trunk else "#555"}" stroke-width="1"/><text x="{x}" y="{y+3.5}" text-anchor="middle" font-size="10" font-weight="700" fill="{"#FFD54A" if trunk else "#222"}" font-family="Arial,sans-serif">{t}</text></g>')
shield(612,600,'A19');shield(250,212,'A66');shield(860,172,'A66');shield(300,420,'A135',False);shield(860,443,'A174',False);shield(70,596,'A67',False);shield(540,320,'A1032',False)
# labels
for x,y,t,s in [(150,632,'Yarm',15),(330,175,'Stockton-on-Tees',15),(560,402,'Thornaby',13),(810,240,'Middlesbrough',16),(440,575,'Ingleby Barwick',12),(332,370,'Preston Park',9),(718,278,'Albert Park',9)]:
    A(f'<text x="{x}" y="{y}" text-anchor="middle" font-size="{s}" font-weight="600" fill="#4A4A4A" stroke="#F2EFE9" stroke-width="3" paint-order="stroke" font-family="Inter,Arial,sans-serif">{t}</text>')
A('<text x="520" y="250" font-size="11" font-style="italic" fill="#4A7FA0" stroke="#F2EFE9" stroke-width="2.5" paint-order="stroke" font-family="Georgia,serif" transform="rotate(-18 520 250)">River Tees</text>')
open('base.svg','w').write(''.join(out))
print(len(''.join(out)))
