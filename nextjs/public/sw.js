/* Next.js static export: keep document and hashed runtime chunks in one cache version. */
importScripts('/precache-manifest.js');
const CACHE_NAME='nordsweet-next-'+self.NORDSWEET_PRECACHE.version;
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(self.NORDSWEET_PRECACHE.urls)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('nordsweet-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.includes('/companyflights/')||url.pathname.includes('/savedflights/'))return;
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
   return Response.error();
 }));
});
