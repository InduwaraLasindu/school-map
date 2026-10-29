import test from 'node:test';
import assert from 'node:assert/strict';
import {gestureBox,safeViewBox} from '../lib/gestures.js';
import {FloorMap} from '../lib/map.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≠ ${b}`);
test('off-centre pinch keeps the point under the fingers anchored',()=>{
  const start={box:[100,200,1000,600],x:240,y:160,anchor:[300,350],scale:.5,distance:100};
  const box=gestureBox(start,{x:240,y:160,distance:200});
  near(box[0]+(300-100)/2,300);near(box[1]+(350-200)/2,350);near(box[2],500);near(box[3],300);
});
test('two fingers can pan and zoom in one continuous gesture',()=>{
  const start={box:[0,0,1000,500],x:200,y:100,anchor:[400,200],scale:.5,distance:100};
  const box=gestureBox(start,{x:250,y:130,distance:200});
  near(box[0],150);near(box[1],70);near(box[2],500);
});
test('map panning has no artificial edge restrictions',()=>{
  assert.deepEqual(safeViewBox([-100000,100000,1000,500],[0,0,1000,500]),[-100000,100000,1000,500]);
});
test('zoom has wide numerical bounds and rejects invalid viewports',()=>{
  const fit=[0,0,1000,500];assert.equal(safeViewBox([0,0,1,1],fit)[2],25);assert.equal(safeViewBox([0,0,1e8,1e8],fit)[2],40000);
  assert.equal(safeViewBox([0,0,NaN,100],fit),null);assert.equal(safeViewBox([0,0,0,10],fit),null);
});
function harness(){
  const handlers={},captures=new Set(),svg={addEventListener(type,handler){handlers[type]=handler;},getScreenCTM(){return {a:1,b:0};},setAttribute(){},setPointerCapture(id){captures.add(id);}};
  let selections=0;const map=new FloorMap(svg,()=>selections++);map.floor={width:1000,height:500};map.box=[0,0,1000,500];map.fitBox=[0,0,1000,500];map.toPoint=(x,y)=>[x,y];
  const event=(id,x,y)=>({button:0,pointerId:id,clientX:x,clientY:y,preventDefault(){}});
  return {map,handlers,event,captures,get selections(){return selections;},click(){handlers.click({target:{closest(){return {dataset:{space:'room'}};}}});}};
}
test('a tap selects a room; a drag does not trigger a false room click',()=>{
  const h=harness();h.map.pointerDown(h.event(1,100,100));h.map.pointerEnd(h.event(1,100,100));h.click();assert.equal(h.selections,1);
  h.map.pointerDown(h.event(2,100,100));h.map.pointerMove(h.event(2,200,150));h.map.pointerEnd(h.event(2,200,150));h.click();assert.equal(h.selections,1);assert.ok(h.captures.has(2));
  h.map.pointerDown(h.event(3,100,100));h.map.pointerEnd(h.event(3,100,100));h.click();assert.equal(h.selections,2);
});
test('pinch captures both fingers and continues smoothly after one finger lifts',()=>{
  const h=harness();h.map.pointerDown(h.event(1,100,100));h.map.pointerDown(h.event(2,200,100));
  h.map.pointerMove(h.event(2,300,100));assert.ok(h.captures.has(1)&&h.captures.has(2));assert.equal(h.map.box[2],500);
  h.map.pointerEnd(h.event(2,300,100));const before=[...h.map.box];h.map.pointerMove(h.event(1,130,120));
  assert.equal(h.map.box[2],before[2]);near(h.map.box[0],before[0]-30);h.map.pointerEnd(h.event(1,130,120));h.click();assert.equal(h.selections,0);
});
test('third fingers are ignored and cancelled pointers leave a fresh gesture ready',()=>{
  const h=harness();h.map.pointerDown(h.event(1,100,100));h.map.pointerDown(h.event(2,200,100));h.map.pointerDown(h.event(3,300,100));assert.equal(h.map.pointers.size,2);
  h.handlers.pointercancel(h.event(1,100,100));h.handlers.pointercancel(h.event(2,200,100));assert.equal(h.map.pointers.size,0);assert.equal(h.map.start,null);
  h.map.pointerDown(h.event(4,0,0));h.map.pointerEnd(h.event(4,0,0));h.click();assert.equal(h.selections,1);
});
test('reset returns to the selected room; whole-floor fit remains independent',()=>{
  const h=harness();let target=null;h.map.focusSpace=id=>target=id;h.map.fit=()=>target='floor';h.map.selected='room-7';h.map.reset();assert.equal(target,'room-7');h.map.selected=null;h.map.reset();assert.equal(target,'floor');
});
