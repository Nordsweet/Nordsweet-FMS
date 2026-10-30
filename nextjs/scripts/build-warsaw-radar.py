import json, math, re
from lxml import html

ring=json.load(open('fis-poland-boundary.json',encoding='utf8'))[0]['geojson']['coordinates'][0]
text=open('fis-openair-reference.txt',encoding='utf8',errors='replace').read()
part=text.split('AN FIR WARSZAWA',1)[1].split('\nAC ',1)[0]
north=[]
for line in part.splitlines():
 m=re.match(r'DP (\d+):(\d+):(\d+) N (\d+):(\d+):(\d+) E',line)
 if not m: continue
 a=list(map(int,m.groups())); pt=(a[3]+a[4]/60+a[5]/3600,a[0]+a[1]/60+a[2]/3600)
 if north and pt==north[-1]: break
 north.append(pt)
def dist(a,b):return math.hypot((a[0]-b[0])*.64,a[1]-b[1])
west=min(range(len(ring)),key=lambda i:dist(ring[i],north[-1]))
east=min(range(len(ring)),key=lambda i:dist(ring[i],north[0]))
assert west<east and len(north)>20
land=ring[west:east+1]
def simplify(points,tol=.00025):
 keep={0,len(points)-1}; stack=[(0,len(points)-1)]
 while stack:
  a,b=stack.pop(); x1,y1=points[a];x2,y2=points[b];dx=(x2-x1)*.64;dy=y2-y1;den=dx*dx+dy*dy;best=-1;ix=0
  for i in range(a+1,b):
   x,y=points[i];px=(x-x1)*.64;py=y-y1;t=max(0,min(1,(px*dx+py*dy)/den)) if den else 0;d=(px-t*dx)**2+(py-t*dy)**2
   if d>best:best=d;ix=i
  if best>tol*tol:keep.add(ix);stack.extend([(a,ix),(ix,b)])
 return [points[i] for i in sorted(keep)]
fir=list(north)+simplify(land);print('FIR',len(fir))
def dms(a,b):
 lat=int(a[:2])+int(a[2:4])/60+int(a[4:6])/3600
 lon=int(b[:3])+int(b[3:5])/60+int(b[5:7])/3600
 return [lon,lat]
def along_fir(a,b):
 def project(p):
  best=(float('inf'),0,0,None)
  for i,q in enumerate(fir):
   r=fir[(i+1)%len(fir)];dx=(r[0]-q[0])*.64;dy=r[1]-q[1];den=dx*dx+dy*dy
   t=max(0,min(1,(((p[0]-q[0])*.64)*dx+(p[1]-q[1])*dy)/den)) if den else 0
   s=[q[0]+t*(r[0]-q[0]),q[1]+t*(r[1]-q[1])];d=dist(p,s)
   if d<best[0]:best=(d,i,t,s)
  return best
 da,ia,ta,pa=project(a);db,ib,tb,pb=project(b)
 print('border gap NM',round(da*60,3),round(db*60,3))
 assert da*60<.6 and db*60<.6
 forward=[pa];i=(ia+1)%len(fir)
 if ia!=ib or ta>tb:
  while i!=(ib+1)%len(fir):forward.append(fir[i]);i=(i+1)%len(fir)
 forward.append(pb);back=[pa];i=ia
 if ia!=ib or ta<tb:
  while i!=ib:back.append(fir[i]);i=(i-1)%len(fir)
  back.append(fir[ib+1 if ib+1<len(fir) else 0])
 back.append(pb)
 def length(p):return sum(dist(x,y) for x,y in zip(p,p[1:]))
 return min([forward,back],key=length)
p=html.parse('fis-radar-11-26_2026_10_29.html')
sectors=[]
pat=r'\b(\d{6}N)\s+(\d{7}E)\b'
for tr in p.xpath('//tr'):
 cells=tr.xpath('./td|./th')
 if len(cells)!=5:continue
 s=' '.join(cells[0].text_content().split());m=re.search(r'SECTOR EPWW ([A-Z]+) \(LOW\)',s)
 if not m:continue
 coords=[dms(a,b) for a,b in re.findall(pat,s)]
 marker='then along FIR EPWW boundary to the point:'
 if marker in s:
  before=s.split(marker)[0]; n=len(re.findall(pat,before)); assert n and n<len(coords)
  print(m.group(1),coords[n-1],coords[n],flush=True)
  coords=coords[:n]+along_fir(coords[n-1],coords[n])+coords[n:]
 freq=re.search(r'\b\d{3}\.\d{3}\b',cells[3].text_content()).group()
 sectors.append({'id':m.group(1),'frequencyMhz':freq,'coordinates':[[round(x,5),round(y,5)] for x,y in coords]})
print('sectors',[(s['id'],s['frequencyMhz'],len(s['coordinates'])) for s in sectors])
assert len(sectors)==10
with open('fis-radar-sectors.json','w',encoding='utf8') as f:json.dump(sectors,f,separators=(',',':'))
