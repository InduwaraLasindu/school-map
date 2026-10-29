import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const scope='https://example.test/school-map/';
const source=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
function harness(){
  const listeners={},stores=new Map();let network=async()=>new Response('online'),skip=0,claimed=0;
  const key=request=>new URL(typeof request==='string'?request:request.url,scope).href;
  const caches={
    async open(name){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {
      async addAll(paths){for(const path of paths)store.set(key(path),new Response('shell:'+path));},
      async put(request,response){store.set(key(request),response.clone());},
      async match(request){return store.get(key(request))?.clone();},
      async keys(){return [...store.keys()].map(url=>({url}));},
      async delete(request){return store.delete(key(request));}
    };},
    async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);},
    async match(request){for(const store of stores.values()){const response=store.get(key(request));if(response)return response.clone();}}
  };
  const self={location:{origin:'https://example.test'},registration:{scope},clients:{claim:async()=>{claimed++;}},skipWaiting(){skip++;},addEventListener(type,callback){listeners[type]=callback;}};
  vm.runInNewContext(source,{self,caches,URL,Response,fetch:request=>network(request)});
  async function event(type,extra={}){
    const waits=[];let response;
    listeners[type]({...extra,waitUntil:p=>waits.push(p),respondWith:p=>{response=p;}});
    const result=response?await response:undefined;await Promise.all(waits);return result;
  }
  return {stores,caches,event,setNetwork(fn){network=fn;},get skip(){return skip;},get claimed(){return claimed;},async request(path,{mode='cors',method='GET'}={}){return event('fetch',{request:{url:new URL(path,scope).href,method,mode}});}};
}
test('offline install precaches real files and does not interrupt an existing draft',async()=>{
  const h=harness();await h.event('install');assert.equal(h.skip,0);
  const store=[...h.stores.values()][0];assert.ok(store.size>=12);
  for(const url of store.keys()){const path=new URL(url).pathname.replace('/school-map/','')||'index.html';assert.ok(fs.existsSync(new URL('../'+path,import.meta.url)),path);}
  await h.event('message',{data:{type:'SKIP_WAITING'}});assert.equal(h.skip,1);
});
test('activation clears old school-map caches while leaving other caches alone',async()=>{
  const h=harness();await h.event('install');await h.caches.open('school-navigator-v3');await h.caches.open('other-app');await h.event('activate');
  assert.equal(h.stores.has('school-navigator-v3'),false);assert.equal(h.stores.has('other-app'),true);assert.equal(h.claimed,1);
});
test('campus data revalidates online and falls back to its saved copy offline',async()=>{
  const h=harness();await h.event('install');h.setNetwork(async()=>new Response('{"updated":true}',{headers:{'Content-Type':'application/json'}}));
  assert.equal(await(await h.request('data/campus.json')).text(),'{"updated":true}');
  h.setNetwork(async()=>{throw Error('offline');});assert.equal(await(await h.request('data/campus.json')).text(),'{"updated":true}');
});
test('room deep links still receive the application shell when offline',async()=>{
  const h=harness();await h.event('install');h.setNetwork(async()=>{throw Error('offline');});
  const response=await h.request('?room=m3-7&year=2026-2027',{mode:'navigate'});
  assert.equal(response.status,200);assert.match(await response.text(),/shell/);
});
test('missing JavaScript gets a useful 503 rather than an HTML response offline',async()=>{
  const h=harness();await h.event('install');h.setNetwork(async()=>{throw Error('offline');});
  const response=await h.request('lib/unknown.js');assert.equal(response.status,503);assert.match(await response.text(),/Offline/);
});
test('visited reference images are cached lazily and bounded to 24 entries',async()=>{
  const h=harness();await h.event('install');h.setNetwork(async request=>new Response('image:'+request.url));
  for(let i=0;i<30;i++)assert.equal((await h.request('references/'+i+'.jpg')).status,200);
  const name=[...h.stores.keys()].find(n=>n.endsWith('-images'));assert.equal(h.stores.get(name).size,24);
  h.setNetwork(async()=>{throw Error('offline');});assert.match(await(await h.request('references/29.jpg')).text(),/image:/);
  assert.equal((await h.request('references/0.jpg')).status,503);
});
test('non-GET, other origins, and sibling GitHub Pages projects are untouched',async()=>{
  const h=harness();assert.equal(await h.request('data/campus.json',{method:'POST'}),undefined);
  assert.equal(await h.request('https://other.test/a.js'),undefined);assert.equal(await h.request('/another-project/app.js'),undefined);
  assert.equal(await h.request('tests/screen-lab.html',{mode:'navigate'}),undefined);
});
test('administrator lock revalidates and remains available offline without a password',async()=>{
  const h=harness();await h.event('install');
  const config=fs.readFileSync(new URL('../data/admin-lock.json',import.meta.url),'utf8');
  h.setNetwork(async()=>new Response(config));assert.equal(await(await h.request('data/admin-lock.json')).text(),config);
  h.setNetwork(async()=>{throw Error('offline');});assert.equal(await(await h.request('data/admin-lock.json')).text(),config);
});
test('visitor shell does not preload the administrator editor',async()=>{
  const h=harness();await h.event('install');const store=[...h.stores.values()][0];
  assert.equal([...store.keys()].some(url=>url.endsWith('/lib/studio.js')),false);
  assert.ok([...store.keys()].some(url=>url.endsWith('/lib/admin.js')));
});
