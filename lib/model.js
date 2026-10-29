/** Versioned, DOM-free campus model. Physical spaces and room assignments are separate. */
export const SCHEMA_VERSION = 1;
export const MAX_IMPORT_BYTES = 2_000_000;
export const KINDS = ['room', 'unassigned', 'lift', 'void'];
export const clone = value => JSON.parse(JSON.stringify(value));
export const compact = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '');
export const makeId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

export function bounds(points) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return {x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y};
}
export function polygonArea(points) {
  return Math.abs(points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2);
}
export function pointInPolygon([x,y], points) {
  let inside = false;
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const [xi,yi]=points[i], [xj,yj]=points[j];
    if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
function orientation(a,b,c) { return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]); }
function onSegment(a,b,c) { return Math.abs(orientation(a,b,c))<1e-7 && c[0]>=Math.min(a[0],b[0]) && c[0]<=Math.max(a[0],b[0]) && c[1]>=Math.min(a[1],b[1]) && c[1]<=Math.max(a[1],b[1]); }
function intersects(a,b,c,d) {
  const abC=orientation(a,b,c), abD=orientation(a,b,d), cdA=orientation(c,d,a), cdB=orientation(c,d,b);
  return (abC*abD<0 && cdA*cdB<0) || onSegment(a,b,c) || onSegment(a,b,d) || onSegment(c,d,a) || onSegment(c,d,b);
}
export function isSimplePolygon(points) {
  if (new Set(points.map(p=>p.join(','))).size!==points.length) return false;
  for(let i=0;i<points.length;i++) for(let j=i+1;j<points.length;j++) {
    if(j===i+1 || (i===0 && j===points.length-1)) continue;
    if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length])) return false;
  }
  return true;
}
export function labelPosition(space) {
  if (space.labelPoint && pointInPolygon(space.labelPoint,space.points)) return space.labelPoint;
  const b=bounds(space.points), center=[b.x+b.width/2,b.y+b.height/2];
  if(pointInPolygon(center,space.points)) return center;
  // Find an interior label position even for concave shapes.
  for(let y=1;y<10;y++) for(let x=1;x<10;x++) {
    const p=[b.x+b.width*x/10,b.y+b.height*y/10];
    if(pointInPolygon(p,space.points)) return p;
  }
  return space.points[0];
}
export function translatePoints(points, dx, dy, floor) {
  const b=bounds(points);
  dx=Math.max(-b.x,Math.min(dx,floor.width-b.x-b.width));
  dy=Math.max(-b.y,Math.min(dy,floor.height-b.y-b.height));
  return points.map(([x,y])=>[Math.round((x+dx)*10)/10,Math.round((y+dy)*10)/10]);
}
export function transformSpace(space, box, floor) {
  const old=bounds(space.points);
  if (![box.x,box.y,box.width,box.height].every(Number.isFinite) || box.width<5 || box.height<5 || box.x<0 || box.y<0 || box.x+box.width>floor.width || box.y+box.height>floor.height) throw Error('Keep the shape inside the floor canvas, with width and height of at least 5.');
  space.points=space.points.map(([x,y])=>[Math.round((box.x+(x-old.x)*box.width/old.width)*10)/10,Math.round((box.y+(y-old.y)*box.height/old.height)*10)/10]);
  delete space.labelPoint;
}
export function locationOf(layout, roomOrId) {
  const room=typeof roomOrId==='string' ? layout.rooms.find(r=>r.id===roomOrId) : roomOrId;
  if (!room?.spaceId) return {room, floor:null, space:null, building:null};
  const floor=layout.floors.find(f=>f.spaces.some(s=>s.id===room.spaceId));
  const space=floor?.spaces.find(s=>s.id===room.spaceId);
  return {room,floor,space,building:layout.buildings.find(b=>b.id===floor?.buildingId) ?? null};
}
export function roomAt(layout, spaceId) { return layout.rooms.find(r=>r.spaceId===spaceId); }
export function roomsOnFloor(layout, floorId) {
  const ids=new Set(layout.floors.find(f=>f.id===floorId)?.spaces.map(s=>s.id));
  return layout.rooms.filter(r=>ids.has(r.spaceId));
}
export function searchRooms(layout,{query='',building='all',category='all',savedOnly=false,favorites=[]}={}) {
  const tokens=query.toLowerCase().trim().split(/\s+/).map(compact).filter(Boolean);
  return layout.rooms.filter(room=>{
    const {floor,space,building:b}=locationOf(layout,room);
    if(building!=='all' && b?.id!==building) return false;
    if(category!=='all' && room.category!==category) return false;
    if(savedOnly && !favorites.includes(room.id)) return false;
    const hay=compact([room.name,room.category,room.tags,b?.name,floor?.name,space?.label].join(' '));
    return tokens.every(t=>hay.includes(t));
  }).sort((a,b)=>{
    const q=compact(query), an=compact(a.name), bn=compact(b.name);
    const score=n=>q ? (n===q?0:n.startsWith(q)?1:2) : 0;
    return score(an)-score(bn) || a.name.localeCompare(b.name,undefined,{numeric:true});
  });
}
export function assignRoom(layout,roomId,spaceId) {
  const room=layout.rooms.find(r=>r.id===roomId);
  if(!room) throw Error('Room not found.');
  if(spaceId===null) { room.spaceId=null; return null; }
  const target=layout.floors.flatMap(f=>f.spaces).find(s=>s.id===spaceId);
  if(!target || !['room','unassigned'].includes(target.kind)) throw Error('Choose a room space. Lift and unmapped areas cannot hold rooms.');
  if(room.spaceId===spaceId) return null;
  const occupant=roomAt(layout,spaceId);
  if(occupant) occupant.spaceId=room.spaceId;
  room.spaceId=spaceId;
  target.kind='room';
  return occupant?.name ?? null;
}
export function duplicateLayout(campus,name) {
  if(!name.trim()) throw Error('Enter a name for the new school year.');
  const source=campus.layouts.find(l=>l.id===campus.activeLayoutId);
  const copy=clone(source);
  copy.id=makeId('year'); copy.name=name.trim();
  campus.layouts.push(copy); campus.activeLayoutId=copy.id;
  return copy;
}
export function duplicateFloor(layout,floorId,name) {
  const floor=layout.floors.find(f=>f.id===floorId);
  if(!floor) throw Error('Floor not found.');
  const copy=clone(floor);
  copy.id=makeId('floor'); copy.name=name.trim() || `${floor.name} copy`;
  copy.order=Math.max(0,...layout.floors.filter(f=>f.buildingId===floor.buildingId).map(f=>f.order))+1;
  const replacements=new Map(copy.spaces.map(s=>[s.id,makeId('space')]));
  copy.spaces.forEach(s=>{s.id=replacements.get(s.id); if(s.kind==='room') s.kind='unassigned';});
  copy.markers.forEach(m=>{m.id=makeId('marker');});
  // A copied floor has no verified source image and no copied room assignments.
  delete copy.sourceImage;
  layout.floors.push(copy);
  return copy;
}

/** Reject malformed imports before they can replace a working draft. */
export function validateCampus(input) {
  const fail=(where,message)=>{throw Error(`${where}: ${message}`);};
  const obj=(v,w)=>{if(!v || typeof v!=='object' || Array.isArray(v)) fail(w,'expected an object');};
  const str=(v,w,max=120)=>{if(typeof v!=='string' || !v.trim() || v.length>max) fail(w,`use 1–${max} characters`);};
  const id=(v,w)=>{if(typeof v!=='string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(v)) fail(w,'invalid ID');};
  const arr=(v,w,max)=>{if(!Array.isArray(v) || v.length>max) fail(w,`expected a list with at most ${max} items`);};
  const unique=(values,w)=>{if(new Set(values).size!==values.length) fail(w,'duplicate IDs');};
  const finite=(v,w,min,max)=>{if(!Number.isFinite(v)||v<min||v>max)fail(w,`expected a number from ${min} to ${max}`);};
  obj(input,'Campus');
  if(input.schemaVersion!==SCHEMA_VERSION)fail('Schema',`unsupported version; this app reads version ${SCHEMA_VERSION}`);
  arr(input.layouts,'Layouts',30); if(!input.layouts.length)fail('Layouts','add at least one layout');
  unique(input.layouts.map(l=>l?.id),'Layouts');
  id(input.activeLayoutId,'Active layout');
  if(!input.layouts.some(l=>l?.id===input.activeLayoutId))fail('Active layout','does not exist');
  for(const layout of input.layouts) {
    obj(layout,'Layout'); id(layout.id,'Layout ID'); str(layout.name,'Layout name');
    arr(layout.buildings,'Buildings',30); unique(layout.buildings.map(b=>b?.id),'Buildings');
    if(!layout.buildings.length)fail('Buildings','add at least one building');
    layout.buildings.forEach(b=>{obj(b,'Building'); id(b.id,'Building ID'); str(b.name,'Building name');});
    arr(layout.floors,'Floors',150); unique(layout.floors.map(f=>f?.id),'Floors');
    if(!layout.floors.length)fail('Floors','add at least one floor');
    const allSpaces=new Map();
    for(const floor of layout.floors) {
      obj(floor,'Floor'); id(floor.id,'Floor ID'); str(floor.name,'Floor name');
      if(!layout.buildings.some(b=>b.id===floor.buildingId))fail(floor.name,'building does not exist');
      finite(floor.width,'Canvas width',50,10000); finite(floor.height,'Canvas height',50,10000); finite(floor.order,'Floor order',-1000,1000);
      if(floor.sourceImage!==undefined && (typeof floor.sourceImage!=='string' || floor.sourceImage.length>500 || !/^[\w /().'-]+\.(jpg|jpeg|png|webp)$/i.test(floor.sourceImage) || floor.sourceImage.startsWith('/') || floor.sourceImage.split('/').includes('..'))) fail('Reference image','use a relative image path inside this repository');
      arr(floor.spaces,'Spaces',600); arr(floor.markers,'Markers',50); unique(floor.markers.map(m=>m?.id),'Markers');
      for(const space of floor.spaces) {
        obj(space,'Space'); id(space.id,'Space ID'); str(space.label,'Space label');
        if(allSpaces.has(space.id))fail('Spaces',`duplicate ID ${space.id}`);
        if(!KINDS.includes(space.kind))fail(space.label,'invalid space kind');
        arr(space.points,'Polygon vertices',80); if(space.points.length<3)fail(space.label,'a polygon needs at least three vertices');
        for(const p of space.points){if(!Array.isArray(p)||p.length!==2)fail(space.label,'expected x,y coordinates');finite(p[0],'X coordinate',0,floor.width);finite(p[1],'Y coordinate',0,floor.height);}
        if(polygonArea(space.points)<25 || !isSimplePolygon(space.points))fail(space.label,'polygon must have area and must not cross itself');
        if(space.labelPoint!==undefined){if(!Array.isArray(space.labelPoint)||space.labelPoint.length!==2)fail('Label position','expected x,y');finite(space.labelPoint[0],'Label X',0,floor.width);finite(space.labelPoint[1],'Label Y',0,floor.height);}
        allSpaces.set(space.id,space);
      }
      for(const m of floor.markers) {obj(m,'Marker');id(m.id,'Marker ID');str(m.label,'Marker label');if(!Array.isArray(m.point)||m.point.length!==2)fail('Marker','expected x,y');finite(m.point[0],'Marker X',0,floor.width);finite(m.point[1],'Marker Y',0,floor.height);}
    }
    arr(layout.rooms,'Rooms',3000);unique(layout.rooms.map(r=>r?.id),'Rooms');
    const occupied=new Set();
    for(const r of layout.rooms) {
      obj(r,'Room');id(r.id,'Room ID');str(r.name,'Room name');str(r.category,'Category');
      if(r.tags!==undefined && (typeof r.tags!=='string'||r.tags.length>1000))fail(r.name,'tags must be text of at most 1000 characters');
      if(r.spaceId!==null){id(r.spaceId,'Room location');const s=allSpaces.get(r.spaceId);if(!s||!['room','unassigned'].includes(s.kind))fail(r.name,'location is missing or cannot hold a room');if(occupied.has(r.spaceId))fail(r.name,'another room already occupies this space');occupied.add(r.spaceId);}
    }
  }
  return input;
}
export function parseCampus(text) {
  if(new TextEncoder().encode(text).length>MAX_IMPORT_BYTES)throw Error('This layout file is too large. Maximum size: 2 MB.');
  let data;
  try{data=JSON.parse(text);}catch{throw Error('This is not valid JSON. Choose an exported campus.json file.');}
  return validateCampus(data);
}
