/* Versioned offline shell. Data and navigation revalidate; reference images are lazy. */
const VERSION='school-navigator-3.1.0';
const SHELL=VERSION+'-shell', IMAGES=VERSION+'-images', MAX_IMAGES=24;
const FILES=['./','./index.html','./styles.css?v=3.1.0','./app.js?v=3.1.0','./lib/model.js','./lib/map.js','./lib/ui.js','./lib/navigation.js','./lib/home.js','./lib/guide.js','./lib/fullscreen.js','./lib/gestures.js','./lib/admin.js','./data/admin-lock.json','./data/campus.json','./manifest.webmanifest','./icon.svg','./logo.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(FILES)));
  // Existing tabs offer a Reload update action, so work is never interrupted.
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('school-navigator-')&&key!==SHELL&&key!==IMAGES)await caches.delete(key);
  await self.clients.claim();
})()));
async function remember(cacheName,request,response){
  if(!response.ok||response.type==='opaque')return;
  const cache=await caches.open(cacheName);await cache.put(request,response.clone());
  if(cacheName===IMAGES){const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-MAX_IMAGES)))await cache.delete(key);}
}
async function networkFirst(request,event,isNavigation){
  try{
    const response=await fetch(request);
    if(response.ok)event.waitUntil(remember(SHELL,isNavigation?'./index.html':request,response));
    return response;
  }catch{
    const cache=await caches.open(SHELL);
    return (await cache.match(request))||(isNavigation?await cache.match('./index.html'):null)||new Response('Offline: this file has not been saved yet.',{status:503,headers:{'Content-Type':'text/plain'}});
  }
}
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  const navigation=request.mode==='navigate';
  const root=new URL(self.registration.scope).pathname;
  if(navigation&&url.pathname!==root&&url.pathname!==root+'index.html')return;
  const data=url.pathname.endsWith('/data/campus.json')||url.pathname.endsWith('/data/admin-lock.json');
  const shell=/\.(js|css|webmanifest)$/.test(url.pathname)||url.pathname.endsWith('/index.html');
  if(navigation||data||shell){event.respondWith(networkFirst(request,event,navigation));return;}
  if(/\.(jpe?g|png|webp|svg)$/i.test(url.pathname))event.respondWith((async()=>{
    const cached=await caches.match(request);if(cached)return cached;
    try{const response=await fetch(request);event.waitUntil(remember(IMAGES,request,response));return response;}
    catch{return new Response('Reference image unavailable offline.',{status:503});}
  })());
});

