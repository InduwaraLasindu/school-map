import {categoryGroups,categoryRooms} from './navigation.js';
import {locationOf,searchRooms} from './model.js';
import {escapeHTML as esc,icon} from './ui.js';
const categoryIcon=name=>name==='Other'?'layers':/Nursery|Pre-Grade/.test(name)?'sun':/Grade/.test(name)?'building':'list';
const categoryMark=name=>/^Grade \d+$/.test(name)?name.replace('Grade ',''):icon(categoryIcon(name));
export function renderHome(root,campus,layout,state,favorites){
  const groups=categoryGroups(layout.rooms),category=state.browseCategory,sub=state.subcategory;
  const group=groups.find(g=>g.name===category),searching=!!state.query;
  const title=searching?'Search the school':state.saved?'Saved places':sub??category??'Where are you heading?';
  const subtitle=searching?'Choose a result to open its location.':state.saved?'Your classrooms and places, ready for next time.':category?'Choose your class or room to see it on the map.':'Choose a category, then your class. You’re two taps away.';
  const tile=(name,count,attr)=>`<button type="button" class="category-tile" ${attr} aria-label="${esc(name)}, ${count} ${count===1?'room':'rooms'}"><span class="category-mark">${categoryMark(name)}</span><strong>${esc(name)}</strong><small>${count} ${count===1?'room':'rooms'}</small><span class="tile-arrow">${icon('arrow')}</span></button>`;
  let content;
  if(!searching&&!state.saved&&!category){
    content='<div class="category-grid">'+groups.map(g=>tile(g.name,g.rooms.length,`data-home-category="${esc(g.name)}"`)).join('')+'</div>';
  }else if(!searching&&!state.saved&&category==='Other'&&!sub&&group?.subcategories.length){
    content='<div class="category-grid facility-grid">'+group.subcategories.map(name=>tile(name,categoryRooms(layout.rooms,'Other',name).length,`data-home-subcategory="${esc(name)}"`)).join('')+'</div>';
  }else{
    const rooms=searching?searchRooms(layout,{query:state.query}):state.saved?layout.rooms.filter(r=>favorites.includes(r.id)):categoryRooms(layout.rooms,category,sub);
    content=rooms.length?'<div class="class-grid">'+rooms.map(room=>{
      const {building,floor}=locationOf(layout,room);
      return `<button type="button" class="class-tile" data-room="${esc(room.id)}" aria-label="Open ${esc(room.name)}, ${esc(building?.name??'unplaced')}, ${esc(floor?.name??'')}"><span class="class-symbol">${icon('pin')}</span><span><strong>${esc(room.name)}</strong><small>${esc(building?.name??'Unplaced')} · ${esc(floor?.name??'Location not set')}</small></span>${icon(favorites.includes(room.id)?'star':'arrow')}</button>`;
    }).join('')+'</div>':`<div class="home-empty">${icon(state.saved?'star':'search')}<h2>${state.saved?'Save your regular places.':'No rooms found.'}</h2><p>${state.saved?'Open any room and tap Save room.':'Try a class name, grade, lab or facility.'}</p></div>`;
  }
  root.innerHTML=`<div class="home-inner"><div class="home-topline"><span class="eyebrow">LOUVRE COLLEGE · SCHOOL NAVIGATOR</span><label class="home-year"><span class="sr-only">School year on home page</span><select id="homeYear" aria-label="School year on home page">${campus.layouts.map(l=>`<option value="${esc(l.id)}" ${l.id===layout.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label></div><div class="home-heading">${category||state.saved||searching?`<button type="button" class="button small" id="homeBack">${icon('arrow')} ${sub&&!searching?'Other':'All categories'}</button>`:''}<h1 tabindex="-1" id="homeTitle">${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="home-actions"><button type="button" id="exploreMap" class="button">${icon('map')}Explore the map</button><button type="button" id="homeSaved" class="button" aria-pressed="${state.saved}">${icon('star')}Saved <span>${favorites.filter(id=>layout.rooms.some(r=>r.id===id)).length}</span></button><span class="home-stats">${layout.rooms.length} rooms · ${layout.floors.length} floors</span></div>${content}<p class="home-hint">${icon('search')}You can also search for a class, grade or facility above.</p></div>`;
}
