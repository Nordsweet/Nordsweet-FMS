/* Next.js static export: keep document and hashed runtime chunks in one cache version. */
importScripts('/precache-manifest.js');
const CACHE_NAME='nordsweet-next-'+self.NORDSWEET_PRECACHE.version;
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(self.NORDSWEET_PRECACHE.urls)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('nordsweet-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.hostname==='tile.openstreetmap.org'||url.hostname==='tiles.openfreemap.org'||(url.hostname==='s3.amazonaws.com'&&url.pathname.startsWith('/elevation-tiles-prod/terrarium/'))){
   event.respondWith(caches.open('map-osm-tiles-v1').then(async cache=>{
     // The vector basemap's TileJSON names the current planet build: take it fresh, keep the last for offline.
     if(url.hostname==='tiles.openfreemap.org'&&!url.pathname.endsWith('.pbf')){
       try{const fresh=await fetch(event.request);if(fresh.ok)await cache.put(event.request,fresh.clone());return fresh;}
       catch{return (await cache.match(event.request))||Response.error();}
     }
     const cached=await cache.match(event.request);if(cached)return cached;
     const response=await fetch(event.request);
     if(response.ok){try{await cache.put(event.request,response.clone());const keys=await cache.keys();if(keys.length>600)await cache.delete(keys[0]);}catch{/* A full offline cache must not discard a successful network tile. */}}
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
