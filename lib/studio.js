import {clone,makeId,bounds,roomAt,assignRoom,duplicateLayout,duplicateFloor,transformSpace,translatePoints,locationOf} from './model.js';
import {$,escapeHTML as esc,icon,askInput,askConfirm} from './ui.js';

/** Local editor. Its output is the same campus.json used by the public map. */
export class LayoutStudio {
  constructor(context){
    this.ctx=context;this.selected=null;this.grid=true;this.tool='select';this.drag=null;
    const svg=context.map.svg;
    svg.addEventListener('pointerdown',e=>this.down(e));
    svg.addEventListener('pointermove',e=>this.move(e));
    svg.addEventListener('pointerup',e=>this.up(e));
    svg.addEventListener('pointercancel',()=>this.cancel());
    svg.addEventListener('keydown',e=>{
      if(!context.map.edit||!this.selected||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
      if(e.key==='Delete'){e.preventDefault();this.deleteSpace();}
      if(e.shiftKey&&e.key.startsWith('Arrow')){
        e.preventDefault();const space=this.space();if(!space)return;
        const dx=e.key==='ArrowLeft'?-5:e.key==='ArrowRight'?5:0,dy=e.key==='ArrowUp'?-5:e.key==='ArrowDown'?5:0;
        context.commit(()=>{space.points=translatePoints(space.points,dx,dy,context.getFloor());delete space.labelPoint;});
      }
    });
  }
  get drawing(){return this.tool==='draw';}
  set drawing(v){this.tool=v?'draw':'select';}
  space(){return this.ctx.getFloor().spaces.find(s=>s.id===this.selected);}
  select(id){this.selected=id;this.tool='select';this.ctx.refresh({preserve:true});}
  render(){
    const c=this.ctx,l=c.getLayout(),f=c.getFloor(),space=this.space(),room=space?roomAt(l,space.id):null;
    const container=$('studioSidebar'),open=[...container.querySelectorAll('details[open]')].map(d=>d.id);
    const option=(value,label,selected)=>`<option value="${esc(value)}" ${selected?'selected':''}>${esc(label)}</option>`;
    const field=(label,name,value,type='text',extra='')=>`<label class="field"><span>${label}</span><input name="${name}" value="${esc(value)}" type="${type}" ${extra}></label>`;
    const b=space?bounds(space.points):null;
    container.innerHTML=`
      <span class="eyebrow">YOUR CAMPUS, YOUR WAY</span><h2>Make room for change.</h2><p>Keep the walls. Move the classes. Or draw a completely new floor.</p>
      <div class="studio-year-row"><label class="field"><span>Editing school year</span><select id="studioYear">${c.getCampus().layouts.map(y=>option(y.id,y.name,y.id===c.getYear())).join('')}</select></label><button type="button" id="newYear" class="icon-button" title="Duplicate into a new school year" aria-label="Duplicate into a new school year">${icon('plus')}</button></div>
      <p class="fine-print">${c.getCampus().activeLayoutId===c.getYear()?'Default year for visitors.':'This year is not the default for visitors.'}</p>
      <button id="makeDefault" type="button" class="button small wide" ${c.getCampus().activeLayoutId===c.getYear()?'disabled':''}>Use this year by default</button>
      <button id="renameYear" type="button" class="button small wide">Rename this school year</button>
      <div class="studio-tools"><button type="button" id="selectTool" class="button small" aria-pressed="${this.tool==='select'}">Select / move</button><button type="button" id="drawTool" class="button small" aria-pressed="${this.drawing}">${icon('plus')}Draw space</button><button type="button" id="panTool" class="button small" aria-pressed="${this.tool==='pan'}">Pan</button></div>
      <label class="checkbox-field"><input type="checkbox" id="snapGrid" ${this.grid?'checked':''}>Snap to 5-unit grid</label>
      <p class="studio-help">${this.drawing?'Drag on the map to draw a new rectangular space. Escape cancels drawing.':this.tool==='pan'?'Drag anywhere to move around the plan. Use + / − to zoom.':'Select a shape, then drag it or its corner points. Shift + arrow keys moves it precisely.'}</p>
      <p class="studio-mobile-hint">The map is above these controls. Use the Map and Rooms buttons to jump between them.</p>
      <div class="studio-section-label">ROOM ASSIGNMENTS</div>
      <label class="field"><span>Find a room to edit (including unplaced rooms)</span><select id="editRoom"><option value="">Choose a room…</option>${[...l.rooms].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})).map(r=>option(r.id,r.name+(r.spaceId?'':' · unplaced'),room?.id===r.id)).join('')}</select></label>
      <div id="roomEditor"></div>
      <div class="studio-section-label">SELECTED SPACE</div>
      ${space?`<h2>${esc(room?.name??space.label)}</h2><form id="spaceForm">${field('Physical space label','label',space.label,'text','required maxlength="120"')}<label class="field"><span>Space type</span><select name="kind" ${room?'disabled':''}>${['room','unassigned','lift','void'].map(k=>option(k,{room:'Room',unassigned:'Unassigned room',lift:'Lift element',void:'Unmapped / unavailable'}[k],space.kind===k)).join('')}</select></label><div class="input-grid">${field('X','x',b.x,'number','step="0.1" required')}${field('Y','y',b.y,'number','step="0.1" required')}${field('Width','width',b.width,'number','step="0.1" min="5" required')}${field('Height','height',b.height,'number','step="0.1" min="5" required')}</div><button class="button primary wide" type="submit">Save space</button></form>${!room&&['room','unassigned'].includes(space.kind)?'<button id="newRoom" type="button" class="button wide">Add a room here</button>':''}<details id="polygonDetails"><summary>Edit polygon vertices</summary><p>One x,y pair per line. Points must stay inside the canvas and must not cross.</p><form id="polygonForm"><label class="field"><span>Corner coordinates</span><textarea name="vertices" rows="7" spellcheck="false">${space.points.map(p=>p.join(', ')).join('\n')}</textarea></label><button class="button wide" type="submit">Apply vertices</button></form></details><button id="deleteSpace" type="button" class="button danger wide">Delete this space</button>`:'<p class="inspector-empty">Select a room shape on the map, or draw a space to get started.</p>'}
      <details id="floorDetails"><summary>Floor and building</summary><form id="floorForm">${field('Floor name','name',f.name,'text','required maxlength="120"')}<label class="field"><span>Building</span><select name="buildingId">${l.buildings.map(b=>option(b.id,b.name,b.id===f.buildingId)).join('')}</select></label><div class="input-grid">${field('Floor order','order',f.order,'number','min="-1000" max="1000" required')}${field('Canvas width','width',f.width,'number','min="50" max="10000" required')}${field('Canvas height','height',f.height,'number','min="50" max="10000" required')}</div>${field('Original image path (optional)','sourceImage',f.sourceImage??'','text','maxlength="500"')}<button class="button wide" type="submit">Save floor</button></form><button id="newFloor" type="button" class="button wide">Add an empty floor</button><button id="copyFloor" type="button" class="button wide">Duplicate this floor’s shapes</button><button id="renameBuilding" type="button" class="button wide">Rename this building</button><button id="newBuilding" type="button" class="button wide">Add a building</button><button id="deleteFloor" type="button" class="button danger wide">Delete this floor</button></details>
      <details id="markerDetails"><summary>Entrances and labels</summary><p>These markers are annotations, not verified walking routes.</p><form id="markerForm">${f.markers.map((m,i)=>`<div class="studio-marker-row">${field('Label','markerLabel'+i,m.label,'text','maxlength="120"')}${field('X','markerX'+i,m.point[0],'number','step="0.1"')}${field('Y','markerY'+i,m.point[1],'number','step="0.1"')}</div>`).join('')}<p class="fine-print">Clear a marker’s label to remove it.</p><button class="button wide" type="submit">Save markers</button></form><button id="addMarker" type="button" class="button wide">Add an entrance / label</button></details>
      <details id="publishDetails"><summary>Import, export and publish</summary><p>Drafts are saved on this device. To update the live website:</p><p>1. Export <strong>campus.json</strong>.<br>2. In GitHub, replace <strong>data/campus.json</strong> with that file.<br>3. Commit the change and let GitHub Pages finish.</p><button id="sidebarExport" type="button" class="button wide">${icon('download')}Export campus.json</button><button id="sidebarImport" type="button" class="button wide">${icon('upload')}Import a layout file</button><a class="button wide" href="https://github.com/InduwaraLasindu/school-map/blob/main/data/campus.json" target="_blank" rel="noopener">Open data file on GitHub ${icon('arrow')}</a><p class="fine-print">The website has no public write access to GitHub. Anyone can experiment locally; publishing requires repository access. Keep an exported backup.</p><button id="resetDraft" type="button" class="button danger wide">Reset to published map</button></details>`;
    for(const id of open){const el=$(id);if(el)el.open=true;}
    c.map.svg.classList.toggle('drawing',this.drawing);
    this.bind();
    if(room)this.renderRoomForm(room.id);
  }
  bind(){
    const c=this.ctx,f=c.getFloor(),l=c.getLayout();
    $('studioYear').onchange=e=>{this.selected=null;c.selectYear(e.target.value);};
    $('newYear').onclick=async()=>{const name=await askInput('New school year (the selected layout will be copied):','2027–2028');if(!name?.trim())return;let copy;if(c.commit(campus=>{campus.activeLayoutId=c.getYear();copy=duplicateLayout(campus,name);})){this.selected=null;c.selectYear(copy.id);c.notify('School-year copy created. Existing room IDs and the previous layout are preserved.');}};
    $('makeDefault').onclick=()=>c.commit(campus=>{campus.activeLayoutId=c.getYear();});
    $('renameYear').onclick=async()=>{const name=await askInput('School year name:',l.name);if(name?.trim())c.commit(()=>{l.name=name.trim();});};
    for(const [id,tool]of [['selectTool','select'],['drawTool','draw'],['panTool','pan']])$(id).onclick=()=>{this.tool=tool;this.render();};
    $('snapGrid').onchange=e=>{this.grid=e.target.checked;c.refresh({preserve:true});};
    $('editRoom').onchange=e=>{
      const roomId=e.target.value;if(!roomId){$('roomEditor').replaceChildren();return;}
      const loc=locationOf(l,roomId);
      if(loc.floor){if(loc.floor.id!==f.id)c.selectFloor(loc.floor.id);this.selected=loc.space.id;c.refresh({preserve:true});c.map.focusSpace(loc.space.id);}else this.renderRoomForm(roomId);
    };
    if($('spaceForm'))$('spaceForm').onsubmit=e=>{
      e.preventDefault();const data=new FormData(e.currentTarget),s=this.space();
      c.commit(()=>{transformSpace(s,{x:Number(data.get('x')),y:Number(data.get('y')),width:Number(data.get('width')),height:Number(data.get('height'))},f);s.label=String(data.get('label')).trim();if(data.has('kind'))s.kind=data.get('kind');});
    };
    if($('polygonForm'))$('polygonForm').onsubmit=e=>{e.preventDefault();const text=new FormData(e.currentTarget).get('vertices'),points=String(text).trim().split(/\n+/).map(line=>line.trim().split(/[,\s]+/).map(Number));c.commit(()=>{this.space().points=points;delete this.space().labelPoint;});};
    if($('newRoom'))$('newRoom').onclick=async()=>{const name=await askInput('Room or class name:');if(!name?.trim())return;const space=this.space(),id=makeId('room');c.commit(()=>{l.rooms.push({id,name:name.trim(),category:'Classrooms',tags:'',spaceId:space.id});space.kind='room';});};
    if($('deleteSpace'))$('deleteSpace').onclick=()=>this.deleteSpace();
    $('floorForm').onsubmit=e=>{
      e.preventDefault();const data=new FormData(e.currentTarget),width=Number(data.get('width')),height=Number(data.get('height'));
      c.commit(()=>{
        const sx=width/f.width,sy=height/f.height;
        f.spaces.forEach(s=>{s.points=s.points.map(([x,y])=>[+(x*sx).toFixed(2),+(y*sy).toFixed(2)]);if(s.labelPoint)s.labelPoint=[s.labelPoint[0]*sx,s.labelPoint[1]*sy];});
        f.markers.forEach(m=>{m.point=[m.point[0]*sx,m.point[1]*sy];});
        f.width=width;f.height=height;f.name=String(data.get('name')).trim();f.order=Number(data.get('order'));f.buildingId=data.get('buildingId');
        const source=String(data.get('sourceImage')).trim();if(source)f.sourceImage=source;else delete f.sourceImage;
      });
    };
    $('newFloor').onclick=async()=>{const name=await askInput('Name for the new floor:','New floor');if(!name?.trim())return;const added={id:makeId('floor'),name:name.trim(),buildingId:f.buildingId,order:Math.max(...l.floors.filter(fl=>fl.buildingId===f.buildingId).map(fl=>fl.order))+1,width:1000,height:1000,spaces:[],markers:[]};if(c.commit(()=>l.floors.push(added))){this.selected=null;c.selectFloor(added.id);}};
    $('copyFloor').onclick=async()=>{const name=await askInput('Name for the copied floor:',f.name+' copy');if(!name?.trim())return;let copy;if(c.commit(()=>{copy=duplicateFloor(l,f.id,name);})){this.selected=null;c.selectFloor(copy.id);c.notify('Floor shapes copied. Assign rooms to the new spaces.');}};
    $('renameBuilding').onclick=async()=>{const b=l.buildings.find(b=>b.id===f.buildingId),name=await askInput('Building name:',b.name);if(name?.trim())c.commit(()=>{b.name=name.trim();});};
    $('newBuilding').onclick=async()=>{const name=await askInput('New building name:');if(!name?.trim())return;const building={id:makeId('building'),name:name.trim()},fl={id:makeId('floor'),buildingId:building.id,name:'Level 1',order:1,width:1000,height:1000,spaces:[],markers:[]};if(c.commit(()=>{l.buildings.push(building);l.floors.push(fl);})){this.selected=null;c.selectFloor(fl.id);}};
    $('deleteFloor').onclick=async()=>{
      if(l.floors.length===1){c.notify('Keep at least one floor in a layout.');return;}
      if(!await askConfirm(`Delete ${f.name} and its shapes? Rooms on this floor will become unplaced, so you can assign them elsewhere.`))return;
      if(c.commit(()=>{const ids=new Set(f.spaces.map(s=>s.id));l.rooms.forEach(r=>{if(ids.has(r.spaceId))r.spaceId=null;});l.floors=l.floors.filter(fl=>fl.id!==f.id);if(!l.floors.some(fl=>fl.buildingId===f.buildingId))l.buildings=l.buildings.filter(b=>b.id!==f.buildingId);})){this.selected=null;c.selectFloor(l.floors[0].id);}
    };
    $('markerForm').onsubmit=e=>{e.preventDefault();const data=new FormData(e.currentTarget);c.commit(()=>{f.markers=f.markers.map((m,i)=>({...m,label:String(data.get('markerLabel'+i)).trim(),point:[Number(data.get('markerX'+i)),Number(data.get('markerY'+i))]})).filter(m=>m.label);});};
    $('addMarker').onclick=async()=>{const name=await askInput('Marker label:','Entrance');if(name?.trim())c.commit(()=>f.markers.push({id:makeId('marker'),label:name.trim(),point:[f.width/2,Math.max(10,f.height-30)]}));};
    $('sidebarExport').onclick=c.exportCampus;$('sidebarImport').onclick=c.importCampus;$('resetDraft').onclick=c.resetDraft;
  }
  renderRoomForm(roomId){
    const c=this.ctx,l=c.getLayout(),room=l.rooms.find(r=>r.id===roomId);if(!room)return;
    const targets='<option value="">Location not set</option>'+l.floors.map(f=>`<optgroup label="${esc(l.buildings.find(b=>b.id===f.buildingId).name+' · '+f.name)}">${f.spaces.filter(s=>['room','unassigned'].includes(s.kind)).map(s=>{const occupant=roomAt(l,s.id);return `<option value="${esc(s.id)}" ${room.spaceId===s.id?'selected':''}>${esc(s.label+(occupant?' · '+occupant.name:' · empty'))}</option>`;}).join('')}</optgroup>`).join('');
    $('roomEditor').innerHTML=`<form id="roomForm"><label class="field"><span>Room / class name</span><input name="name" value="${esc(room.name)}" required maxlength="120"></label><label class="field"><span>Category (new categories appear automatically)</span><input name="category" value="${esc(room.category)}" list="categoryOptions" required maxlength="120"></label><datalist id="categoryOptions">${[...new Set(l.rooms.map(r=>r.category))].map(cat=>`<option value="${esc(cat)}"></option>`).join('')}</datalist><label class="field"><span>Search keywords</span><input name="tags" value="${esc(room.tags??'')}" maxlength="1000"></label><label class="field"><span>Move to a space (any floor)</span><select name="spaceId">${targets}</select></label><p class="fine-print">Choosing an occupied space swaps the two rooms. Names, map labels and search update together.</p><button type="submit" class="button primary wide">Save room assignment</button><button type="button" id="removeRoom" class="button danger wide">Delete room record</button></form>`;
    $('roomForm').onsubmit=e=>{
      e.preventDefault();const data=new FormData(e.currentTarget),destination=String(data.get('spaceId'))||null;let swapped;
      const ok=c.commit(()=>{room.name=String(data.get('name')).trim();room.category=String(data.get('category')).trim();room.tags=String(data.get('tags'));swapped=assignRoom(l,roomId,destination);});
      if(ok){const loc=locationOf(c.getLayout(),roomId);if(loc.floor){c.selectFloor(loc.floor.id);this.selected=loc.space.id;c.refresh({preserve:true});c.map.focusSpace(loc.space.id);}else this.renderRoomForm(roomId);c.notify(swapped?`Saved. Swapped locations with ${swapped}.`:'Room assignment saved.');}
    };
    $('removeRoom').onclick=async()=>{if(!await askConfirm(`Delete the room record “${room.name}”? Its physical space stays on the floor plan.`))return;c.commit(()=>{l.rooms=l.rooms.filter(r=>r.id!==roomId);});};
  }
  async deleteSpace(){
    const c=this.ctx,s=this.space();if(!s)return;const room=roomAt(c.getLayout(),s.id);
    if(!await askConfirm(`Delete this space?${room?' '+room.name+' will become unplaced and remain in the room list.':''}`))return;
    if(c.commit(()=>{if(room)room.spaceId=null;c.getFloor().spaces=c.getFloor().spaces.filter(x=>x.id!==s.id);})){this.selected=null;c.refresh({preserve:true});}
  }
  down(e){
    const c=this.ctx;if(!c.map.edit||e.button!==0)return;
    if(c.map.pointers.size>1){this.cancel();return;}
    const point=c.map.toPoint(e.clientX,e.clientY),shape=e.target.closest('[data-space]'),vertex=e.target.closest('[data-vertex]');
    const startBox=[...c.map.box],scale=c.map.svg.getScreenCTM()?.a??1;
    if(this.drawing){
      this.drag={type:'draw',point:[Math.max(0,Math.min(c.getFloor().width,point[0])),Math.max(0,Math.min(c.getFloor().height,point[1]))],client:[e.clientX,e.clientY],pointer:e.pointerId};
    }else if(this.tool==='pan'||!shape){
      this.drag={type:'pan',box:startBox,scale,client:[e.clientX,e.clientY],pointer:e.pointerId};
    }else{
      this.selected=shape.dataset.space;const s=this.space();
      this.drag={type:vertex?'vertex':'move',vertex:vertex?Number(vertex.dataset.vertex):null,points:clone(s.points),labelPoint:s.labelPoint?clone(s.labelPoint):null,point,client:[e.clientX,e.clientY],pointer:e.pointerId,moved:false};
      c.refresh({preserve:true});
    }
    c.map.svg.setPointerCapture(e.pointerId);e.preventDefault();
  }
  move(e){
    const c=this.ctx,d=this.drag;if(!d||!c.map.edit||d.pointer!==e.pointerId)return;
    const point=c.map.toPoint(e.clientX,e.clientY),f=c.getFloor(),snap=n=>Math.round(n/(this.grid?5:1))*(this.grid?5:1);
    d.moved=Math.hypot(e.clientX-d.client[0],e.clientY-d.client[1])>4;
    if(d.type==='pan'){const [x,y,w,h]=d.box;c.map.setBox([x-(e.clientX-d.client[0])/d.scale,y-(e.clientY-d.client[1])/d.scale,w,h]);return;}
    if(d.type==='draw'){
      const x=Math.max(0,Math.min(f.width,snap(point[0]))),y=Math.max(0,Math.min(f.height,snap(point[1])));
      d.end=[x,y];c.map.svg.querySelector('.draw-preview')?.remove();
      const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');rect.setAttribute('class','draw-preview');rect.setAttribute('x',Math.min(d.point[0],x));rect.setAttribute('y',Math.min(d.point[1],y));rect.setAttribute('width',Math.abs(x-d.point[0]));rect.setAttribute('height',Math.abs(y-d.point[1]));c.map.svg.append(rect);return;
    }
    const space=this.space();if(!space)return;
    if(d.type==='move')space.points=translatePoints(d.points,snap(point[0]-d.point[0]),snap(point[1]-d.point[1]),f);
    else{space.points=clone(d.points);space.points[d.vertex]=[Math.max(0,Math.min(f.width,snap(point[0]))),Math.max(0,Math.min(f.height,snap(point[1])))];}
    delete space.labelPoint;
    c.map.render(c.getLayout(),f,{selected:this.selected,edit:true,reference:c.map.svg.querySelector('.reference-overlay')!==null,preserve:true,grid:this.grid});
  }
  up(e){
    const c=this.ctx,d=this.drag;if(!d||d.pointer!==e.pointerId)return;this.drag=null;
    if(d.type==='pan')return;
    if(d.type==='draw'){
      c.map.svg.querySelector('.draw-preview')?.remove();
      if(!d.end||Math.abs(d.end[0]-d.point[0])<10||Math.abs(d.end[1]-d.point[1])<10){c.notify('Drag a larger rectangle to create a space.');return;}
      const x1=Math.min(d.point[0],d.end[0]),y1=Math.min(d.point[1],d.end[1]),x2=Math.max(d.point[0],d.end[0]),y2=Math.max(d.point[1],d.end[1]);
      const s={id:makeId('space'),label:'New space',kind:'unassigned',points:[[x1,y1],[x2,y1],[x2,y2],[x1,y2]]};this.selected=s.id;this.tool='select';
      c.commit(()=>c.getFloor().spaces.push(s));return;
    }
    const space=this.space();if(!space)return;
    const final=clone(space.points);space.points=d.points;if(d.labelPoint)space.labelPoint=d.labelPoint;else delete space.labelPoint;
    if(d.moved)c.commit(()=>{space.points=final;delete space.labelPoint;});else c.refresh({preserve:true});
  }
  cancel(){
    const d=this.drag;
    if(d&&['move','vertex'].includes(d.type)&&this.space()){this.space().points=d.points;if(d.labelPoint)this.space().labelPoint=d.labelPoint;else delete this.space().labelPoint;}
    this.drag=null;this.ctx.map.svg.querySelector('.draw-preview')?.remove();if(this.ctx.map.edit)this.ctx.refresh({preserve:true});
  }
}
