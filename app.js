import {clone,validateCampus,parseCampus,locationOf,roomsOnFloor,searchRooms,roomAt,bounds} from './lib/model.js';
import {FloorMap} from './lib/map.js';
import {LayoutStudio} from './lib/studio.js';
import {$,escapeHTML as esc,icon,fillIcons,readStorage,writeStorage,downloadJSON,askConfirm} from './lib/ui.js';

const STORE='schoolNavigator.v3.', DRAFT=STORE+'draft';
const safeArray=v=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string'))]:[];
let favorites=safeArray(readStorage(STORE+'favorites',readStorage('schoolNavigator.v2.favorites',[])));
let recent=safeArray(readStorage(STORE+'recent',readStorage('schoolNavigator.v2.recent',[]))).slice(0,6);
let settings=readStorage(STORE+'settings',{});
if(!settings||typeof settings!=='object'||Array.isArray(settings))settings={};
const state={year:null,floor:null,room:null,query:'',building:'all',category:'all',saved:false,view:'map',studio:false,reference:false};
let campus,published,baseSignature='',draftExists=false,draftConflict=false,studio,toastTimer,installPrompt,waitingWorker;
let undoStack=[],redoStack=[];
const layout=()=>campus.layouts.find(l=>l.id===state.year)??campus.layouts[0];
const floor=()=>layout()?.floors.find(f=>f.id===state.floor)??layout()?.floors[0];
const map=new FloorMap($('floorMap'),spaceId=>{
  if(state.studio){studio.select(spaceId);return;}
  const room=roomAt(layout(),spaceId);
  if(room)setRoom(room.id,{focus:false});
},value=>{$('zoomValue').textContent=value+'%';});

function notify(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4000);}
function signature(value){let n=2166136261;for(const c of JSON.stringify(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return (n>>>0).toString(16);}
function showNotice(){
  const notice=$('notice');notice.replaceChildren();notice.hidden=!draftExists;
  if(!draftExists)return;
  notice.classList.toggle('warning',draftConflict);
  const text=document.createElement('span');text.textContent=draftConflict?'The published map changed. Your saved draft is preserved on this device.':'You are viewing a local draft. Export it to publish changes for everyone.';
  const exportButton=document.createElement('button');exportButton.type='button';exportButton.className='button small';exportButton.textContent='Export draft';exportButton.onclick=exportCampus;
  const resetButton=document.createElement('button');resetButton.type='button';resetButton.className='button small';resetButton.textContent='Use published map';resetButton.onclick=resetDraft;
  notice.append(text,exportButton,resetButton);
}
function saveDraft(){
  draftExists=true;
  const ok=writeStorage(DRAFT,{baseSignature,campus});
  $('draftStatus').textContent=ok?'Draft saved on this device':'Export to keep changes';
  if(!ok)notify('Device storage is unavailable or full. Export your layout to keep these changes.');
  showNotice();
}
function commit(change){
  const before=clone(campus),previousYear=state.year;
  try{change(campus,layout());validateCampus(campus);}
  catch(error){campus=before;state.year=previousYear;refresh({preserve:true});notify(error.message);return false;}
  undoStack.push(before);if(undoStack.length>35)undoStack.shift();redoStack=[];
  saveDraft();refresh({preserve:true});return true;
}
function undo(){if(!undoStack.length)return;redoStack.push(clone(campus));campus=undoStack.pop();saveDraft();refresh();notify('Edit undone.');}
function redo(){if(!redoStack.length)return;undoStack.push(clone(campus));campus=redoStack.pop();saveDraft();refresh();notify('Edit restored.');}
function exportCampus(){try{validateCampus(campus);downloadJSON(campus);notify('Exported campus.json. Replace data/campus.json in GitHub to publish.');}catch(error){notify(error.message);}}
async function resetDraft(){
  if(!await askConfirm('Use the published campus map? This removes the saved draft from this device. Export first if you want to keep it.'))return;
  try{localStorage.removeItem(DRAFT);}catch{notify('Could not clear device storage.');return;}
  campus=clone(published);draftExists=false;draftConflict=false;undoStack=[];redoStack=[];
  state.year=campus.activeLayoutId;state.room=null;state.floor=null;state.reference=false;
  showNotice();refresh();notify('Published map restored.');
}
function ensureState(){
  if(!campus.layouts.some(l=>l.id===state.year))state.year=campus.activeLayoutId;
  if(!layout().floors.some(f=>f.id===state.floor))state.floor=layout().floors[0].id;
  if(state.room&&!layout().rooms.some(r=>r.id===state.room))state.room=null;
  if(!layout().buildings.some(b=>b.id===state.building))state.building='all';
  if(state.category!=='all'&&!layout().rooms.some(r=>r.category===state.category))state.category='all';
}
function refresh({preserve=false}={}){
  ensureState();
  const l=layout(),f=floor(),b=l.buildings.find(b=>b.id===f.buildingId);
  document.title=`${state.room?l.rooms.find(r=>r.id===state.room)?.name+' · ':''}Louvre College · Campus Navigator`;
  $('workspace').classList.toggle('studio',state.studio);$('workspace').classList.toggle('has-selection',!!state.room&&!state.studio);
  $('workspace').dataset.view=state.view;
  $('browseSidebar').hidden=state.studio;$('studioSidebar').hidden=!state.studio;$('studioBar').hidden=!state.studio;
  $('openStudio').setAttribute('aria-pressed',String(state.studio));
  $('yearSelect').innerHTML=campus.layouts.map(y=>`<option value="${esc(y.id)}" ${y.id===state.year?'selected':''}>${esc(y.name)}</option>`).join('');
  $('campusStats').textContent=`${l.rooms.length} rooms · ${l.floors.length} floors · ${l.buildings.length} buildings`;
  $('mapBuilding').innerHTML=l.buildings.map(x=>`<option value="${esc(x.id)}" ${x.id===b.id?'selected':''}>${esc(x.name)}</option>`).join('');
  $('mapEyebrow').textContent=state.studio?'DESIGN THE NEXT SCHOOL YEAR':`${l.name} · EXPLORE YOUR CAMPUS`;
  $('floorSubtitle').textContent=`${f.name} · ${roomsOnFloor(l,f.id).length} rooms`;
  $('floorTabs').innerHTML=l.floors.filter(x=>x.buildingId===b.id).sort((a,b)=>a.order-b.order).map(x=>`<button type="button" data-floor="${esc(x.id)}" class="${x.id===f.id?'active':''}" aria-current="${x.id===f.id?'page':'false'}">${esc(x.name)}</button>`).join('');
  $('referenceToggle').disabled=!f.sourceImage;$('referenceToggle').setAttribute('aria-pressed',String(state.reference));
  $('mapCaption').textContent=state.reference?(state.studio?'Original plan behind editable shapes · reference only':'Original source plan · labels may differ from a draft'):(state.studio?'Drag a shape or its corner points · draw to add a space':'Select a room · drag to pan · pinch to zoom');
  $('mapEmpty').hidden=!!f.spaces.length;
  map.render(l,f,{selected:state.studio?studio.selected:locationOf(l,state.room).space?.id,edit:state.studio,reference:state.reference&&!!f.sourceImage,preserve,grid:state.studio&&studio.grid});
  if(state.studio){studio.render();$('roomDetails').hidden=true;}else{renderDirectory();renderDetails();}
  $('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length;
  updateMobile();
}
function renderDirectory(){
  const l=layout(),oldScroll=$('roomList').scrollTop;
  $('allRoomsTab').classList.toggle('active',!state.saved);$('savedRoomsTab').classList.toggle('active',state.saved);
  $('allRoomsTab').setAttribute('aria-pressed',String(!state.saved));$('savedRoomsTab').setAttribute('aria-pressed',String(state.saved));
  $('savedCount').textContent=favorites.filter(id=>l.rooms.some(r=>r.id===id)).length;
  $('buildingFilters').innerHTML=[{id:'all',name:'All buildings'},...l.buildings].map(b=>`<button type="button" data-building="${esc(b.id)}" class="${state.building===b.id?'active':''}" aria-pressed="${state.building===b.id}">${esc(b.name.replace(' Building',''))}</button>`).join('');
  const categories=[...new Set(l.rooms.map(r=>r.category))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  $('categoryFilter').innerHTML='<option value="all">All categories</option>'+categories.map(c=>`<option value="${esc(c)}" ${c===state.category?'selected':''}>${esc(c)}</option>`).join('');
  const rooms=searchRooms(l,{query:state.query,building:state.building,category:state.category,savedOnly:state.saved,favorites});
  const recents=!state.query&&!state.saved&&state.building==='all'&&state.category==='all'?recent.map(id=>l.rooms.find(r=>r.id===id)).filter(Boolean):[];
  const card=room=>{
    const {floor:f,building:b}=locationOf(l,room);
    return `<button type="button" class="room-card ${room.id===state.room?'active':''}" data-room="${esc(room.id)}" aria-label="Open ${esc(room.name)}, ${esc(b?.name??'location not set')}, ${esc(f?.name??'')}" aria-pressed="${room.id===state.room}"><span class="room-icon">${icon(/lab/i.test(room.category)?'layers':/Grade|Form|Nursery|Edexcel/i.test(room.category)?'building':'pin')}</span><span class="room-card-content"><strong>${esc(room.name)}</strong><small>${esc(b?.name.replace(' Building','')??'Unplaced')} · ${esc(f?.name??'Location not set')}</small></span>${favorites.includes(room.id)?'<span class="saved-star" aria-label="Saved">★</span>':'<span class="card-arrow" aria-hidden="true">↗</span>'}</button>`;
  };
  $('resultsTitle').textContent=state.query?'Search results':state.saved?'Saved places':'Campus directory';
  $('resultsCount').textContent=`${rooms.length} ${rooms.length===1?'room':'rooms'}`;
  $('roomList').innerHTML=rooms.length?(recents.length?'<p class="list-section-label">Recently explored</p>'+recents.map(card).join('')+'<p class="list-section-label">All rooms</p>':'')+rooms.map(card).join(''):`<p class="empty-state"><strong>${state.saved?'Your places, a tap away.':'No rooms found.'}</strong>${state.saved?'Open a room and choose Save room to keep it here.':'Try another name or clear the building and category filters.'}</p>`;
  $('roomList').scrollTop=oldScroll;
  $('clearSearch').hidden=!state.query;
}
function renderDetails(){
  const room=layout().rooms.find(r=>r.id===state.room),panel=$('roomDetails');panel.hidden=!room;
  if(!room)return;
  const {floor:f,space,building:b}=locationOf(layout(),room),saved=favorites.includes(room.id);
  const nearby=f?roomsOnFloor(layout(),f.id).filter(r=>r.id!==room.id).map(r=>{
    const sb=bounds(locationOf(layout(),r).space.points),rb=bounds(space.points);
    return {room:r,distance:Math.hypot(sb.x+sb.width/2-rb.x-rb.width/2,sb.y+sb.height/2-rb.y-rb.height/2)};
  }).sort((a,b)=>a.distance-b.distance).slice(0,3):[];
  panel.innerHTML=`<div class="detail-top"><span class="eyebrow">YOUR DESTINATION</span><button id="closeDetails" class="icon-button" type="button" aria-label="Close room details">${icon('close')}</button></div><div class="detail-symbol">${icon('pin')}</div><h2>${esc(room.name)}</h2><span class="category-badge">${esc(room.category)}</span><div class="detail-location"><div>${icon('building')}<span><small>BUILDING</small><strong>${esc(b?.name??'Not assigned')}</strong></span></div><div>${icon('layers')}<span><small>FLOOR</small><strong>${esc(f?.name??'Location not set')}</strong></span></div>${space?`<div>${icon('pin')}<span><small>SPACE</small><strong>${esc(space.label)}</strong></span></div>`:''}</div><div class="detail-actions"><button type="button" id="saveRoom" class="button ${saved?'':'primary'}" aria-pressed="${saved}">${icon('star')}${saved?'Saved room':'Save room'}</button><button type="button" id="shareRoom" class="button">${icon('share')}Share location</button>${space?`<button type="button" id="focusRoom" class="button">${icon('fit')}Focus on map</button>`:''}</div>${nearby.length?`<div class="nearby"><h3>Also on this floor</h3>${nearby.map(({room:r})=>`<button type="button" data-room="${esc(r.id)}">${esc(r.name)}${icon('arrow')}</button>`).join('')}</div>`:''}<p class="fine-print">Room locations follow the selected school-year layout. This is a visual map, without indoor GPS or turn-by-turn directions.</p>`;
  $('closeDetails').onclick=closeDetails;$('saveRoom').onclick=()=>toggleFavorite(room.id);$('shareRoom').onclick=shareRoom;
  if($('focusRoom'))$('focusRoom').onclick=()=>{state.reference=false;refresh({preserve:true});map.focusSpace(space.id);setView('map');};
}
function setFloor(id,{url=true}={}){
  if(!layout().floors.some(f=>f.id===id))return;
  state.floor=id;state.room=null;state.reference=false;
  if(studio)studio.selected=null;
  refresh();if(url)updateURL();
}
function setRoom(id,{focus=true,url=true}={}){
  const room=layout().rooms.find(r=>r.id===id);if(!room){notify('That room is not in this school-year layout.');return;}
  const loc=locationOf(layout(),room);state.room=id;state.reference=false;if(loc.floor)state.floor=loc.floor.id;
  recent=[id,...recent.filter(x=>x!==id)].slice(0,6);writeStorage(STORE+'recent',recent);
  const focusSelection=focus||matchMedia('(max-width: 760px)').matches;
  state.view='map';refresh({preserve:!focusSelection});
  if(focusSelection&&loc.space)map.focusSpace(loc.space.id);
  if(url)updateURL();
}
function closeDetails(){state.room=null;refresh({preserve:true});updateURL();$('floorMap').focus({preventScroll:true});}
function toggleFavorite(id){const saved=favorites.includes(id);favorites=saved?favorites.filter(x=>x!==id):[...favorites,id];writeStorage(STORE+'favorites',favorites);renderDirectory();renderDetails();notify(saved?'Room removed from saved places.':'Room saved on this device.');}
function setView(view){state.view=view;$('workspace').dataset.view=view;updateMobile();}
function updateMobile(){
  $('mobileMap').classList.toggle('active',state.view==='map');$('mobileRooms').classList.toggle('active',state.view==='rooms'&&!state.saved);$('mobileSaved').classList.toggle('active',state.view==='rooms'&&state.saved);
  for(const [id,active]of [['mobileMap',state.view==='map'],['mobileRooms',state.view==='rooms'&&!state.saved],['mobileSaved',state.view==='rooms'&&state.saved]])$(id).setAttribute('aria-current',active?'page':'false');
}
function updateURL(){
  const url=new URL(location.href);url.search='';url.hash='';
  if(state.year!==published.activeLayoutId)url.searchParams.set('year',state.year);
  if(state.room)url.searchParams.set('room',state.room);else if(state.floor)url.searchParams.set('floor',state.floor);
  if(url.href!==location.href)history.pushState(null,'',url);
}
function readURL(){
  const params=new URL(location.href).searchParams,year=params.get('year');
  if(year&&campus.layouts.some(l=>l.id===year))state.year=year;
  else state.year=campus.activeLayoutId;
  ensureState();
  const room=params.get('room'),floorId=params.get('floor');
  if(room&&layout().rooms.some(r=>r.id===room)){setRoom(room,{url:false});return;}
  state.room=null;
  if(floorId&&layout().floors.some(f=>f.id===floorId))state.floor=floorId;
  else state.floor=layout().floors[0].id;
  refresh();if(room)notify('This room link is not available in the selected layout.');
}
async function shareRoom(){
  const room=layout().rooms.find(r=>r.id===state.room);if(!room)return;
  const url=new URL(location.pathname,location.origin);url.searchParams.set('room',room.id);url.searchParams.set('year',state.year);
  const publishedRoom=published.layouts.find(l=>l.id===state.year)?.rooms.some(r=>r.id===room.id);
  if(draftExists||!publishedRoom){
    $('shareExplanation').textContent=publishedRoom?'This link opens the published room. Local draft changes are not included. Export and publish campus.json to share the updated location.':'This room is only in your local draft. Export and publish campus.json before sharing its link.';
    $('shareLink').value=url.href;$('shareDialog').showModal();$('shareLink').select();return;
  }
  try{
    if(navigator.share){await navigator.share({title:`${room.name} · Louvre College`,url:url.href});return;}
    await navigator.clipboard.writeText(url.href);notify('Room link copied.');
  }catch(error){
    if(error.name==='AbortError')return;
    $('shareExplanation').textContent='Share this link to open the same room and school-year layout.';$('shareLink').value=url.href;$('shareDialog').showModal();$('shareLink').select();
  }
}
function setStudio(enabled){
  state.studio=enabled;state.reference=false;state.room=null;
  if(enabled){state.view='map';studio.selected=null;notify('Edits stay on this device. Export campus.json when ready to publish.');}
  refresh();if(!enabled)updateURL();
}
function applySettings(){
  const theme=['light','dark','system'].includes(settings.theme)?settings.theme:'system';
  const scale=['auto','compact','comfortable','tv'].includes(settings.scale)?settings.scale:'auto';
  const effects=['auto','full','reduced'].includes(settings.effects)?settings.effects:'auto';
  const constrained=(navigator.deviceMemory&&navigator.deviceMemory<=4)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4)||navigator.connection?.saveData||matchMedia('(prefers-reduced-transparency: reduce)').matches;
  document.documentElement.dataset.theme=theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;
  document.documentElement.dataset.scale=scale;document.documentElement.dataset.effects=effects==='auto'?(constrained?'reduced':'full'):effects;
  document.querySelector('meta[name=theme-color]').content=document.documentElement.dataset.theme==='dark'?'#0e1a25':'#eaf1f5';
  $('themeSetting').value=theme;$('scaleSetting').value=scale;$('effectsSetting').value=effects;
}
function updateConnection(){$('connectionStatus').classList.toggle('offline',!navigator.onLine);$('connectionStatus').lastElementChild.textContent=navigator.onLine?'Online':'Offline';$('connectionStatus').title=navigator.onLine?'Connected':'Offline · the saved map is available';}

function bindEvents(){
  $('search').addEventListener('input',()=>{state.query=$('search').value;if(state.query)setView('rooms');renderDirectory();});
  $('clearSearch').onclick=()=>{state.query='';$('search').value='';renderDirectory();$('search').focus();};
  $('buildingFilters').onclick=e=>{const b=e.target.closest('[data-building]');if(!b)return;state.building=b.dataset.building;renderDirectory();};
  $('roomList').onclick=e=>{const b=e.target.closest('[data-room]');if(b)setRoom(b.dataset.room);};
  $('roomDetails').addEventListener('click',e=>{const b=e.target.closest('[data-room]');if(b)setRoom(b.dataset.room);});
  $('floorTabs').onclick=e=>{const b=e.target.closest('[data-floor]');if(b)setFloor(b.dataset.floor);};
  $('categoryFilter').onchange=e=>{state.category=e.target.value;renderDirectory();};
  $('yearSelect').onchange=e=>{state.year=e.target.value;state.floor=null;state.room=null;state.reference=false;refresh();updateURL();};
  $('mapBuilding').onchange=e=>{const next=layout().floors.filter(f=>f.buildingId===e.target.value).sort((a,b)=>a.order-b.order)[0];if(next)setFloor(next.id);else notify('Add a floor to this building in Layout studio.');};
  $('allRoomsTab').onclick=()=>{state.saved=false;renderDirectory();updateMobile();};
  $('savedRoomsTab').onclick=()=>{state.saved=true;renderDirectory();updateMobile();};
  $('mobileMap').onclick=()=>{if(state.studio){setView('map');$('main').scrollIntoView({block:'start'});}else setView('map');};
  $('mobileRooms').onclick=()=>{if(state.studio){$('studioSidebar').scrollIntoView({block:'start'});return;}state.saved=false;setView('rooms');renderDirectory();};
  $('mobileSaved').onclick=()=>{if(state.studio)setStudio(false);state.saved=true;setView('rooms');renderDirectory();};
  $('zoomIn').onclick=()=>map.zoom(1.35);$('zoomOut').onclick=()=>map.zoom(1/1.35);$('fitMap').onclick=()=>map.fit();
  $('referenceToggle').onclick=()=>{state.reference=!state.reference;refresh({preserve:true});};
  if(!document.documentElement.requestFullscreen)$('fullscreen').hidden=true;
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('main').requestFullscreen();}catch{notify('Fullscreen is unavailable in this browser.');}};
  $('openStudio').onclick=()=>setStudio(!state.studio);$('exitStudio').onclick=()=>setStudio(false);
  $('exportLayout').onclick=exportCampus;$('undo').onclick=undo;$('redo').onclick=redo;
  $('openSettings').onclick=()=>$('settingsDialog').showModal();$('closeSettings').onclick=()=>$('settingsDialog').close();$('closeShare').onclick=()=>$('shareDialog').close();
  for(const [id,key] of [['themeSetting','theme'],['scaleSetting','scale'],['effectsSetting','effects']])$(id).onchange=e=>{settings[key]=e.target.value;writeStorage(STORE+'settings',settings);applySettings();};
  $('importFile').onchange=async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    try{
      if(file.size>2_000_000)throw Error('Maximum layout file size is 2 MB.');
      const imported=parseCampus(await file.text());
      if(!await askConfirm(`Import ${imported.layouts.length} school-year layout(s)? This replaces your current local draft. Export first to keep a copy.`))return;
      if(commit(()=>{campus=imported;state.year=campus.activeLayoutId;state.floor=null;state.room=null;studio.selected=null;}))notify('Layout imported and validated. Saved as a draft on this device.');
    }catch(error){notify('Import stopped. '+error.message);}
  };
  addEventListener('popstate',()=>{if(campus){if(state.studio)state.studio=false;readURL();}});
  addEventListener('online',updateConnection);addEventListener('offline',updateConnection);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applySettings);
  matchMedia('(prefers-reduced-transparency: reduce)').addEventListener('change',applySettings);
  document.addEventListener('keydown',e=>{
    const editing=/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)||e.target.isContentEditable;
    if(!editing&&((e.key==='/'&&!e.ctrlKey&&!e.metaKey)||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'))){e.preventDefault();$('search').focus();return;}
    if(state.studio&&!editing&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return;}
    if(e.key==='Escape'&&!document.querySelector('dialog[open]')){if(state.studio&&studio.drawing){studio.drawing=false;studio.render();}else if(state.room)closeDetails();else if(state.query){state.query='';$('search').value='';renderDirectory();}return;}
    if(!editing&&document.documentElement.dataset.scale==='tv'&&e.key.startsWith('Arrow')&&!e.target.closest('#floorMap'))spatialFocus(e);
  });
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('installApp').hidden=false;});
  $('installApp').onclick=async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;$('installApp').hidden=true;};
}
function spatialFocus(e){
  const active=document.activeElement,rect=active.getBoundingClientRect(),cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
  const dx=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0,dy=e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0;
  const modal=document.querySelector('dialog[open]'),root=modal??document;
  const next=[...root.querySelectorAll('button:not(:disabled),a[href],input,select,[tabindex="0"]')].filter(el=>el!==active&&el.getClientRects().length&&!el.closest('[hidden]')).map(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2-cx,y=r.y+r.height/2-cy;return {el,forward:x*dx+y*dy,score:Math.hypot(x,y)+Math.abs(x*dy-y*dx)*2};}).filter(v=>v.forward>5).sort((a,b)=>a.score-b.score)[0];
  if(next){e.preventDefault();next.el.focus();}
}
async function registerWorker(){
  if(!('serviceWorker'in navigator))return;
  try{
    const registration=await navigator.serviceWorker.register('./service-worker.js');
    function ready(worker){waitingWorker=worker;$('updateNotice').hidden=false;}
    if(registration.waiting)ready(registration.waiting);
    registration.addEventListener('updatefound',()=>{const installing=registration.installing;installing?.addEventListener('statechange',()=>{if(installing.state==='installed'&&navigator.serviceWorker.controller)ready(installing);});});
    $('applyUpdate').onclick=()=>{if(draftExists)saveDraft();waitingWorker?.postMessage({type:'SKIP_WAITING'});};
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(waitingWorker)location.reload();});
    await registration.update();
  }catch{ /* A school network or private browser may disable offline storage. */ }
}

fillIcons();applySettings();updateConnection();
try{
  const response=await fetch('./data/campus.json',{cache:'no-cache'});if(!response.ok)throw Error(`Campus file returned ${response.status}`);
  published=parseCampus(await response.text());baseSignature=signature(published);campus=clone(published);
  const draft=readStorage(DRAFT,null);
  if(draft?.campus){try{validateCampus(draft.campus);campus=clone(draft.campus);draftExists=true;draftConflict=draft.baseSignature!==baseSignature;}catch{notify('The saved draft is unreadable. The published map has been loaded; the old draft remains in storage.');}}
  state.year=campus.activeLayoutId;
  studio=new LayoutStudio({getCampus:()=>campus,getLayout:layout,getFloor:floor,map,commit,notify,refresh,selectFloor:id=>setFloor(id,{url:false}),selectYear:id=>{state.year=id;state.floor=null;state.room=null;refresh();},getYear:()=>state.year,exportCampus,resetDraft,importCampus:()=>$('importFile').click()});
  bindEvents();readURL();showNotice();
  if(document.readyState==='complete')registerWorker();else addEventListener('load',registerWorker,{once:true});
}catch(error){
  $('roomList').innerHTML='<p class="empty-state"><strong>The campus map could not load.</strong>Check your connection and reload the page.</p>';
  $('campusStats').textContent='Map unavailable';$('notice').hidden=false;$('notice').textContent=error.message;
  const retry=document.createElement('button');retry.type='button';retry.className='button small';retry.textContent='Reload';retry.onclick=()=>location.reload();$('notice').append(retry);
}
