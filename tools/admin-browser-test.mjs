// Generate an isolated local browser fixture. Nothing under artifacts/ is tracked
// or published. Its non-secret test password never unlocks the real app lock.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createAdminLock} from '../lib/admin.js';
const password='Fixture-only-administrator-12345';
const lock=await createAdminLock(password);
await mkdir('artifacts',{recursive:true});
let html=await readFile('index.html','utf8');
html=html.replace('<head>','<head><base href="../"><script type="module" src="artifacts/admin-fixture-setup.js"></script>');
await writeFile('artifacts/admin-fixture.html',html);
await writeFile('artifacts/admin-fixture-setup.js',`
const nativeFetch=window.fetch.bind(window);
// HTTP previews lack SubtleCrypto. Mock only this isolated fixture's crypto
// boundary; tests/admin.test.mjs exercises real PBKDF2/AES-GCM independently.
if(!window.crypto.subtle){
  const encode=new TextEncoder(),decode=new TextDecoder();
  const keyFor=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
  const fakePassword=${JSON.stringify(password)},fixtureLock=${JSON.stringify(lock)};
  Object.defineProperty(window.crypto,'subtle',{value:{
    async importKey(format,data){return decode.decode(data);},
    async deriveKey(options,material){return {password:material};},
    async encrypt(options,key,data){
      const token=crypto.getRandomValues(new Uint8Array(24));
      parent.fixtureCryptoData.set(keyFor(token),{password:key.password,data:new Uint8Array(data),iv:keyFor(options.iv)});return token.buffer;
    },
    async decrypt(options,key,data){
      if(keyFor(data)===fixtureLock.ciphertext){if(key.password!==fakePassword)throw Error('Invalid fixture key');return encode.encode('school-navigator-admin-v1').buffer;}
      const saved=parent.fixtureCryptoData.get(keyFor(data));if(!saved||saved.password!==key.password||saved.iv!==keyFor(options.iv))throw Error('Invalid fixture draft');return saved.data.buffer;
    }
  }});
}

Object.defineProperty(window,'localStorage',{value:parent.fixtureStorage});
const lock=${JSON.stringify(lock)};
window.fetch=(input,options)=>new URL(typeof input==='string'?input:input.url,document.baseURI).pathname.endsWith('/data/admin-lock.json')?Promise.resolve(new Response(JSON.stringify(lock),{headers:{'Content-Type':'application/json'}})):nativeFetch(input,options);
`);
await writeFile('artifacts/admin-test.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local administrator integration checks</title><style>body{font:15px system-ui;margin:20px;background:#eaf1f5;color:#203740}button{padding:12px;border-radius:8px;background:#126c78;color:white;border:0}iframe{width:100%;height:720px;border:1px solid #9bb1bc;margin:15px 0}pre{white-space:pre-wrap}</style><script type="module" src="admin-test.js"></script></head><body><h1>Local administrator integration checks</h1><p>Isolated test data and a non-secret fixture password. The published map and real administrator password are never used.</p><button id="run">Run admin tests</button><output id="features"></output><pre id="results">Ready.</pre><iframe id="fixture" title="Isolated administrator fixture"></iframe></body></html>`);
await writeFile('artifacts/admin-test.js',`
const values=new Map([['schoolNavigator.v4.guideSeen','true']]);
window.fixtureCryptoData=new Map();
window.fixtureStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
const frame=document.getElementById('fixture'),out=document.getElementById('results'),button=document.getElementById('run');
frame.src='admin-fixture.html';
const password=${JSON.stringify(password)};
const d=()=>frame.contentDocument,w=()=>frame.contentWindow,pause=ms=>new Promise(r=>setTimeout(r,ms));
const findings=[];
const record=(name,passed)=>{findings.push({name,passed:!!passed});out.textContent=JSON.stringify({findings},null,2);if(!passed)throw Error(name);};
async function until(predicate){for(let i=0;i<120;i++){if(predicate())return;await pause(50);}throw Error('Timed out waiting for UI.');}
async function click(s){const el=d().querySelector(s);if(!el)throw Error('Missing '+s);el.click();await pause(50);}
async function change(s,value){const el=d().querySelector(s);el.value=value;el.dispatchEvent(new w().Event('change',{bubbles:true}));await pause(50);}
async function unlock(value=password){await click('#adminAccess');d().querySelector('#adminPassword').value=value;await click('#unlockEditor');}
button.onclick=async()=>{
 button.disabled=true;findings.length=0;
 try{
  await until(()=>d()?.querySelector('[data-home-category]'));
  document.getElementById('features').textContent=' Web Crypto: '+!!w().crypto?.subtle;
  await unlock('wrong-fixture-password');await until(()=>d().querySelector('#adminError').textContent);
  record('Wrong password leaves the editor locked',d().querySelector('#adminError').textContent.includes('Incorrect')&&d().querySelector('#studioSidebar').hidden&&d().querySelector('#importFile').disabled);
  await click('#cancelAdmin');
  await unlock();await until(()=>!d().querySelector('#studioSidebar').hidden);
  record('Correct password opens the administrator editor',!!d().querySelector('#newYear')&&!d().querySelector('#importFile').disabled);
  await change('#editRoom','p1-1');
  const name=d().querySelector('#roomForm [name="name"]');name.value='Administrator fixture room';d().querySelector('#roomForm').requestSubmit();
  await until(()=>values.has('schoolNavigator.v4.encryptedDraft'));
  record('Room rename updates the live vector label',d().querySelector('#floorMap .selected').textContent.includes('Administrator fixture room'));
  record('Saved draft is encrypted',!values.get('schoolNavigator.v4.encryptedDraft').includes('Administrator fixture room')&&JSON.parse(values.get('schoolNavigator.v4.encryptedDraft')).ciphertext);
  await click('#undo');record('Administrator undo works',d().querySelector('#editRoom option[value="p1-1"]').textContent==='1A');
  await click('#redo');record('Administrator redo works',d().querySelector('#editRoom option[value="p1-1"]').textContent==='Administrator fixture room');
  await click('#exitStudio');await until(()=>d().querySelector('#studioSidebar').hidden);
  record('Lock restores the published map and removes editor controls',!d().querySelector('#studioSidebar button')&&!d().querySelector('#floorMap').textContent.includes('Administrator fixture room')&&d().querySelector('#importFile').disabled);
  record('Private encrypted draft survives locking',values.has('schoolNavigator.v4.encryptedDraft'));
  const loaded=new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));frame.src='admin-fixture.html?reload=1';await loaded;await until(()=>d()?.querySelector('[data-home-category]'));
  record('Reload starts in visitor mode without loading private drafts',d().querySelector('#studioSidebar').hidden&&!d().body.textContent.includes('Administrator fixture room'));
  await unlock();await until(()=>!d().querySelector('#studioSidebar').hidden);
  record('Signing back in recovers the private draft',d().querySelector('#editRoom option[value="p1-1"]').textContent==='Administrator fixture room');
  // Invalid JSON import must leave the active draft untouched.
  const file=new w().File(['{broken'], 'invalid.json',{type:'application/json'}),dt=new w().DataTransfer();dt.items.add(file);
  const input=d().querySelector('#importFile');input.files=dt.files;input.dispatchEvent(new w().Event('change',{bubbles:true}));
  await until(()=>d().querySelector('#toast').textContent.startsWith('Import stopped.'));
  record('Invalid import keeps the working draft intact',d().querySelector('#editRoom option[value="p1-1"]').textContent==='Administrator fixture room');
  await click('#newYear');await until(()=>!!d().querySelector('.editor-dialog[open]'));
  d().querySelector('.editor-dialog input').value='2030–2031 fixture';d().querySelector('.editor-dialog form').requestSubmit();
  await until(()=>d().querySelector('#studioYear').selectedOptions[0].textContent==='2030–2031 fixture');
  record('Administrator can copy a school year',d().querySelectorAll('#studioYear option').length===2);
  await click('#exitStudio');await until(()=>d().querySelector('#studioSidebar').hidden);
  values.set('schoolNavigator.v4.encryptedDraft',JSON.stringify({version:1,salt:'tampered',iv:'invalid',ciphertext:'invalid'}));
  await unlock();await until(()=>!d().querySelector('#studioSidebar').hidden);
  record('Unreadable private draft falls back safely to the published map',d().querySelector('#editRoom option[value="p1-1"]').textContent==='1A');
  record('Unreadable private draft is preserved',JSON.parse(values.get('schoolNavigator.v4.encryptedDraft')).salt==='tampered');
  await click('#exitStudio');await until(()=>d().querySelector('#studioSidebar').hidden);
  await click('#adminAccess');d().querySelector('#adminPassword').value=password;d().querySelector('#unlockEditor').click();d().querySelector('#cancelAdmin').click();await pause(600);
  record('Cancelling a pending unlock does not grant editing access',d().querySelector('#studioSidebar').hidden&&d().querySelector('#importFile').disabled);
  out.textContent=JSON.stringify({summary:findings.length+'/'+findings.length+' administrator integration checks passed',findings},null,2);
 }catch(error){out.textContent=JSON.stringify({error:error.message,findings},null,2);}finally{button.disabled=false;}
};
`.replaceAll('new w().Event(','new (w().Event)(').replaceAll('new w().File(','new (w().File)(').replaceAll('new w().DataTransfer(','new (w().DataTransfer)('));
process.stdout.write('Local fixtures prepared under artifacts/admin-test.html (excluded from publication).\n');
