/* Next.js static export: keep document and hashed runtime chunks in one cache version. */
importScripts('/precache-manifest.js');
const CACHE_NAME='nordsweet-next-'+self.NORDSWEET_PRECACHE.version;
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(self.NORDSWEET_PRECACHE.urls)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('nordsweet-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
const MAX_TILES=2000,EVICT_EVERY=200;
let stored=0;const touched=new Map();
async function store(cache,request,response){
  try{
    await cache.put(request,response);
    // keys() lists the whole cache: do it once per batch, not per tile.
    if(++stored%EVICT_EVERY)return;
    const keys=await cache.keys();
    await Promise.all(keys.slice(0,Math.max(0,keys.length-MAX_TILES)).map(key=>cache.delete(key)));
  }catch{/* A full offline cache must not discard a successful network tile. */}
}
// Re-putting a hit moves it to the end of the cache's key order, so the first key is the least recently used; at most once per 10 minutes per tile.
function touch(event,cache){
  const key=event.request.url,now=Date.now();
  if(now-(touched.get(key)||0)<600000)return;
  touched.set(key,now);if(touched.size>5000)touched.clear();
  event.waitUntil(cache.match(event.request).then(hit=>hit&&cache.put(event.request,hit)).catch(()=>{}));
}
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.pathname.startsWith('/tiles/')||url.hostname==='tile.openstreetmap.org'||url.hostname==='tiles.openfreemap.org'||(url.hostname==='s3.amazonaws.com'&&url.pathname.startsWith('/elevation-tiles-prod/terrarium/'))){
   event.respondWith(caches.open('map-osm-tiles-v1').then(async cache=>{
     // The vector basemap's TileJSON names the current planet build: take it fresh, keep the last for offline.
     if(url.hostname==='tiles.openfreemap.org'&&!url.pathname.endsWith('.pbf')){
       try{const fresh=await fetch(event.request);if(fresh.ok)event.waitUntil(cache.put(event.request,fresh.clone()));return fresh;}
       catch{return (await cache.match(event.request))||Response.error();}
     }
     const cached=await cache.match(event.request);
     if(cached){touch(event,cache);return cached;}
     const response=await fetch(event.request);
     // Storing and evicting happen after the tile is on its way: they must never delay it.
     if(response.ok)event.waitUntil(store(cache,event.request,response.clone()));
     return response;
   }));return;
 }
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(url.pathname.startsWith('/_next/static/')){
   event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));return;
 }
 event.respondWith(fetch(event.request).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)));}
   return response;
 }).catch(async()=>{
   const cached=await caches.match(event.request,{ignoreSearch:true});
   if(cached)return cached;
   if(url.pathname==='/')return (await caches.match('/index.html'))||Response.error();
   // Static export routes are cached as `/route.html`.
   return (await caches.match(url.pathname+'.html'))||Response.error();
 }));
});
