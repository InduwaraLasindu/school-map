import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {clone,validateCampus,parseCampus,assignRoom,locationOf,roomAt,roomsOnFloor,searchRooms,duplicateLayout,duplicateFloor,bounds,polygonArea,pointInPolygon,isSimplePolygon,labelPosition,translatePoints,transformSpace} from '../lib/model.js';
const published=JSON.parse(fs.readFileSync(new URL('../data/campus.json',import.meta.url)));
const original=JSON.parse(fs.readFileSync(new URL('./fixtures/campus-2026.json',import.meta.url)));
const sources=JSON.parse(fs.readFileSync(new URL('../tools/room-sources.json',import.meta.url)));
const fresh=()=>clone(original);
test('published campus is valid without requiring fixed room names, counts, years or floor layouts',()=>{
  validateCampus(published);
  for(const layout of published.layouts)for(const floor of layout.floors)if(floor.sourceImage)assert.ok(fs.existsSync(new URL('../'+floor.sourceImage,import.meta.url)),floor.sourceImage);
});

test('all 118 original room IDs and names survive on all 11 digitized floors',()=>{
  validateCampus(original);const l=original.layouts[0];
  assert.equal(l.rooms.length,118);assert.equal(l.floors.length,11);
  assert.deepEqual(l.rooms.map(r=>r.id).sort(),sources.map(r=>r.id).sort());
  for(const source of sources){const loc=locationOf(l,source.id);assert.equal(loc.room.name,source.name);assert.equal(loc.floor.id,source.id.split('-')[0]);assert.ok(polygonArea(loc.space.points)>25);}
  assert.equal(l.floors.flatMap(f=>f.spaces).filter(s=>s.kind==='lift').length,6);
});
test('all reference paths exist, including case-sensitive paths on GitHub Pages',()=>{
  for(const f of original.layouts[0].floors)assert.ok(fs.existsSync(new URL('../'+f.sourceImage,import.meta.url)),f.sourceImage);
  for(const r of sources)assert.ok(fs.existsSync(new URL('../'+r.img,import.meta.url)),r.img);
});
test('concave auditorium excludes the recess and Grade 12/13 classrooms',()=>{
  const l=original.layouts[0],s=locationOf(l,'m7-3').space;
  assert.ok(s.points.length>4);assert.ok(pointInPolygon([200,700],s.points));
  assert.equal(pointInPolygon([500,500],s.points),false);
  assert.equal(pointInPolygon([600,800],s.points),false);
  assert.equal(pointInPolygon([440,800],s.points),false);
  assert.ok(pointInPolygon(labelPosition(s),s.points));
});
test('lobby follows the corridor without covering the offices or lift',()=>{
  const s=locationOf(original.layouts[0],'m3-10').space;
  assert.ok(pointInPolygon([360,300],s.points));assert.ok(pointInPolygon([200,820],s.points));
  assert.equal(pointInPolygon([200,300],s.points),false);assert.equal(pointInPolygon([500,650],s.points),false);
});
test('moving a room between floors swaps occupants and updates all derived locations',()=>{
  const d=fresh(),l=d.layouts[0],a=locationOf(l,'p1-1'),b=locationOf(l,'m3-7');
  assert.equal(assignRoom(l,'p1-1',b.space.id),'Biology Lab');
  assert.equal(locationOf(l,'p1-1').floor.id,'m3');assert.equal(locationOf(l,'m3-7').floor.id,'p1');
  assert.equal(roomAt(l,a.space.id).id,'m3-7');assert.equal(roomsOnFloor(l,'m3').filter(r=>r.id==='p1-1').length,1);
  assert.ok(searchRooms(l,{query:'1A Main Level 3'}).some(r=>r.id==='p1-1'));
  assert.ok(!searchRooms(l,{query:'1A',building:'p'}).some(r=>r.id==='p1-1'));validateCampus(d);
});
test('empty spaces and unplaced rooms are supported without losing records',()=>{
  const d=fresh(),l=d.layouts[0],empty=l.floors.find(f=>f.id==='m2').spaces.find(s=>s.kind==='unassigned');
  const count=l.rooms.length;assert.equal(assignRoom(l,'p1-1',empty.id),null);assert.equal(roomAt(l,empty.id).id,'p1-1');
  assignRoom(l,'p1-1',null);assert.equal(locationOf(l,'p1-1').floor,null);assert.equal(l.rooms.length,count);validateCampus(d);
});
test('a lift or void cannot be assigned to a room',()=>{
  const l=fresh().layouts[0];for(const s of l.floors.flatMap(f=>f.spaces).filter(s=>['void','lift'].includes(s.kind)))assert.throws(()=>assignRoom(l,'p1-1',s.id),/cannot hold/);
  assert.throws(()=>assignRoom(l,'missing','space-p1-1'),/not found/);
});
test('school-year duplication preserves stable links and fully isolates later changes',()=>{
  const d=fresh(),before=JSON.stringify(d.layouts[0]),next=duplicateLayout(d,'2027–2028');
  assert.equal(d.activeLayoutId,next.id);assert.notEqual(next.id,d.layouts[0].id);assert.equal(next.rooms[0].id,d.layouts[0].rooms[0].id);
  next.rooms[0].name='New classroom';next.floors[0].spaces[0].points[0][0]+=10;
  assert.equal(JSON.stringify(d.layouts[0]),before);validateCampus(d);
});
test('duplicated floors have independent space IDs and no invented room assignments',()=>{
  const d=fresh(),l=d.layouts[0],before=l.rooms.length,next=duplicateFloor(l,'p1','New wing');
  assert.notEqual(next.id,'p1');assert.equal(next.spaces.length,9);assert.equal(next.sourceImage,undefined);
  assert.ok(next.spaces.every(s=>s.kind==='unassigned'));assert.equal(l.rooms.length,before);
  assert.equal(roomsOnFloor(l,next.id).length,0);validateCampus(d);
});
test('new buildings, wide/short floors, categories and rooms require no renderer changes',()=>{
  const d=fresh(),l=d.layouts[0];l.buildings.push({id:'new-wing',name:'Technology Wing'});
  l.floors.push({id:'wide-floor',buildingId:'new-wing',name:'Mezzanine',order:1,width:2400,height:500,spaces:[{id:'space-new',label:'Studio 01',kind:'room',points:[[50,50],[500,50],[500,400],[50,400]]}],markers:[]});
  l.rooms.push({id:'new-room',name:'Robotics Studio',category:'Innovation',tags:'robots technology',spaceId:'space-new'});
  validateCampus(d);assert.equal(searchRooms(l,{query:'robotics mezzanine technology'}).at(0).id,'new-room');
  assert.equal(searchRooms(l,{category:'Innovation'}).length,1);assert.equal(searchRooms(l,{building:'new-wing'}).length,1);
});
test('search handles aliases, punctuation, token order, numeric rooms and combined filters',()=>{
  const l=original.layouts[0];
  assert.equal(searchRooms(l,{query:'g1a'})[0].id,'p1-1');assert.equal(searchRooms(l,{query:'Form II-A'})[0].id,'m5-5');
  assert.ok(searchRooms(l,{query:'labs main'}).every(r=>locationOf(l,r).building.id==='m'));
  assert.equal(searchRooms(l,{savedOnly:true,favorites:['m3-7','missing'],category:'Labs'}).length,1);
  assert.equal(searchRooms(l,{query:'Biology',building:'p'}).length,0);assert.equal(searchRooms(l,{query:'nonsense'}).length,0);
});
test('moving/resizing polygons stays in bounds and preserves a concave shape',()=>{
  const f=fresh().layouts[0].floors.find(f=>f.id==='m7'),s=f.spaces.find(s=>s.id==='space-m7-3');
  const moved=translatePoints(s.points,-900,-900,f);assert.equal(bounds(moved).x,0);assert.equal(bounds(moved).y,0);
  const n=s.points.length;transformSpace(s,{x:0,y:0,width:500,height:800},f);assert.equal(s.points.length,n);assert.equal(bounds(s.points).width,500);assert.equal(bounds(s.points).height,800);assert.equal(isSimplePolygon(s.points),true);
  assert.throws(()=>transformSpace(s,{x:-1,y:0,width:50,height:50},f),/inside/);
});
test('all generated label positions are inside their corresponding polygons',()=>{
  for(const s of original.layouts[0].floors.flatMap(f=>f.spaces))assert.ok(pointInPolygon(labelPosition(s),s.points),s.id);
});
test('export/import round-trip preserves every value',()=>assert.deepEqual(parseCampus(JSON.stringify(original)),original));
test('Unicode room names remain searchable after an edit',()=>{
  const l=fresh().layouts[0];l.rooms[0].name='පරිගණක කාමරය';
  assert.equal(searchRooms(l,{query:'පරිගණක'})[0].id,'p1-1');
});
const invalid=[
  ['unknown schema',d=>{d.schemaVersion=99;},/unsupported/],
  ['missing active year',d=>{d.activeLayoutId='missing';},/does not exist/],
  ['duplicate room IDs',d=>{d.layouts[0].rooms[1].id=d.layouts[0].rooms[0].id;},/duplicate/],
  ['duplicate spaces',d=>{d.layouts[0].floors[1].spaces[0].id=d.layouts[0].floors[0].spaces[0].id;},/duplicate/],
  ['duplicate occupancy',d=>{d.layouts[0].rooms[1].spaceId=d.layouts[0].rooms[0].spaceId;},/already occupies/],
  ['missing space',d=>{d.layouts[0].rooms[0].spaceId='gone';},/missing/],
  ['missing building',d=>{d.layouts[0].floors[0].buildingId='gone';},/building/],
  ['negative canvas',d=>{d.layouts[0].floors[0].width=-10;},/Canvas/],
  ['non-finite coordinates',d=>{d.layouts[0].floors[0].spaces[0].points[0][0]=NaN;},/coordinate/],
  ['outside canvas',d=>{d.layouts[0].floors[0].spaces[0].points[0][0]=20000;},/coordinate/],
  ['zero area',d=>{d.layouts[0].floors[0].spaces[0].points=[[0,0],[1,1],[2,2]];},/area/],
  ['crossed polygon',d=>{d.layouts[0].floors[0].spaces[0].points=[[0,0],[100,100],[0,100],[100,0]];},/area/],
  ['repeated vertex',d=>{d.layouts[0].floors[0].spaces[0].points=[[0,0],[100,0],[100,100],[0,0],[0,100]];},/cross/],
  ['script image URL',d=>{d.layouts[0].floors[0].sourceImage='javascript:alert(1)';},/Reference/],
  ['remote image URL',d=>{d.layouts[0].floors[0].sourceImage='https://example.com/a.png';},/Reference/],
  ['path traversal',d=>{d.layouts[0].floors[0].sourceImage='../private.png';},/Reference/],
  ['invalid space kind',d=>{d.layouts[0].floors[0].spaces[0].kind='elevator-route';},/kind/],
  ['excessive name',d=>{d.layouts[0].rooms[0].name='a'.repeat(121);},/characters/],
  ['marker outside canvas',d=>{d.layouts[0].floors[0].markers[0].point=[20000,0];},/Marker/],
];
for(const [name,change,pattern]of invalid)test('invalid import rejected: '+name,()=>{const d=fresh();change(d);assert.throws(()=>validateCampus(d),pattern);assert.deepEqual(original.layouts[0].rooms.map(r=>r.name),sources.map(r=>r.name));});
test('invalid JSON and oversized imports have useful errors',()=>{assert.throws(()=>parseCampus('{broken'),/valid JSON/);assert.throws(()=>parseCampus(' '.repeat(2_000_001)),/too large/);});
