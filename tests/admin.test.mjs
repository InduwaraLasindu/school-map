import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createAdminLock,unlockAdmin} from '../lib/admin.js';
const password='Automated-test-only-secret-1234';
const lock=await createAdminLock(password);
test('password storage uses a random salt and authenticated encryption',async()=>{
  const second=await createAdminLock(password);assert.notEqual(lock.salt,second.salt);assert.notEqual(lock.ciphertext,second.ciphertext);assert.ok(lock.iterations>=600000);assert.ok(!JSON.stringify(lock).includes(password));
});
test('correct password unlocks; wrong and empty passwords are rejected',async()=>{
  const session=await unlockAdmin(password,lock);assert.equal(session.unlocked,true);
  await assert.rejects(unlockAdmin('wrong-password',lock),/Incorrect/);await assert.rejects(unlockAdmin('',lock),/Incorrect/);
});
test('tampering with the access lock prevents unlocking',async()=>{
  await assert.rejects(unlockAdmin(password,{...lock,ciphertext:lock.ciphertext.replace(/^./,lock.ciphertext[0]==='A'?'B':'A')}),/Incorrect/);
});
test('draft contents are encrypted and only the matching session can read them',async()=>{
  const session=await unlockAdmin(password,lock),draft={baseSignature:'test',campus:{name:'Private year 2031',rooms:['Secret classroom name']}};
  const first=await session.sealDraft(draft),second=await session.sealDraft(draft);
  assert.notEqual(first.iv,second.iv);assert.notEqual(first.ciphertext,second.ciphertext);assert.ok(!JSON.stringify(first).includes('Private year'));
  assert.deepEqual(await session.openDraft(first),draft);
  const reload=await unlockAdmin(password,lock);assert.deepEqual(await reload.openDraft(first),draft);
});
test('encrypted drafts handle a full school layout without argument-limit failures',async()=>{
  const session=await unlockAdmin(password,lock),campus=JSON.parse(fs.readFileSync(new URL('../data/campus.json',import.meta.url)));
  const sealed=await session.sealDraft({campus});assert.deepEqual(await session.openDraft(sealed),{campus});
});
test('locked sessions cannot read or write drafts',async()=>{
  const session=await unlockAdmin(password,lock),draft=await session.sealDraft({data:1});session.lock();assert.equal(session.unlocked,false);
  await assert.rejects(session.sealDraft({data:2}),/sign-in required/);await assert.rejects(session.openDraft(draft),/sign-in required/);
});
test('password rotation rejects old encrypted drafts without overwriting them',async()=>{
  const original=await unlockAdmin(password,lock),draft=await original.sealDraft({data:1});
  const rotated=await unlockAdmin(password,await createAdminLock(password));await assert.rejects(rotated.openDraft(draft),/different administrator password/);assert.deepEqual(await original.openDraft(draft),{data:1});
});
test('short passwords cannot be configured',async()=>{await assert.rejects(createAdminLock('short'),/16 characters/);});
