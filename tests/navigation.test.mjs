import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CATEGORY_ORDER,FACILITY_CATEGORIES,categoryGroups,categoryRooms} from '../lib/navigation.js';
const layout=JSON.parse(fs.readFileSync(new URL('../data/campus.json',import.meta.url))).layouts[0];
test('home reproduces the original 18 categories in their original order',()=>{
  assert.deepEqual(categoryGroups(layout.rooms).map(g=>g.name),CATEGORY_ORDER);
});
test('the home category grid includes every room exactly once',()=>{
  const grouped=categoryGroups(layout.rooms).flatMap(g=>g.rooms.map(r=>r.id));
  assert.equal(new Set(grouped).size,layout.rooms.length);assert.equal(grouped.length,layout.rooms.length);
});
test('Other keeps the four original facility subcategories',()=>{
  const other=categoryGroups(layout.rooms).find(g=>g.name==='Other');
  assert.deepEqual(other.subcategories,FACILITY_CATEGORIES);assert.equal(other.rooms.length,36);
});
test('category and facility selection only show the requested rooms',()=>{
  assert.equal(categoryRooms(layout.rooms,'Grade 1').length,7);
  const labs=categoryRooms(layout.rooms,'Other','Labs');assert.ok(labs.length);assert.ok(labs.every(r=>r.category==='Labs'));
  assert.equal(categoryRooms(layout.rooms,'Other').length,36);
});
test('new years and new categories need no hard-coded UI edits',()=>{
  const rooms=[{id:'new',category:'Robotics'},{id:'unusual',category:'Other'},{id:'s',category:'Grade 12'}];
  assert.deepEqual(categoryGroups(rooms).map(g=>g.name),['Other','Grade 12','Robotics']);
  assert.equal(categoryRooms(rooms,'Other').length,1);
});
