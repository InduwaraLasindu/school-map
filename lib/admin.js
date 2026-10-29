// GitHub Pages is static: repository permissions authorize public publishing.
// This password gate protects the supplied editor UI and encrypts device drafts.
const encoder=new TextEncoder(),decoder=new TextDecoder();
const CONTEXT='school-navigator-admin-v1',DRAFT_CONTEXT='school-navigator-draft-v1';
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const base64=value=>btoa(String.fromCharCode(...new Uint8Array(value)));
async function derive(password,config){
  if(config.version!==1||config.iterations<600000||config.iterations>2000000)throw Error('Invalid administrator configuration.');
  const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(config.salt),iterations:config.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function decrypt(key,envelope,context){
  return decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv),additionalData:encoder.encode(context)},key,bytes(envelope.ciphertext)));
}
export async function createAdminLock(password){
  if(typeof password!=='string'||password.length<16)throw Error('Use an administrator password of at least 16 characters.');
  const config={version:1,iterations:600000,salt:base64(crypto.getRandomValues(new Uint8Array(16)))};
  const key=await derive(password,config),iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(CONTEXT)},key,encoder.encode(CONTEXT));
  return {...config,iv:base64(iv),ciphertext:base64(ciphertext)};
}
class AdminSession{
  #key;#salt;
  constructor(key,salt){this.#key=key;this.#salt=salt;}
  get unlocked(){return !!this.#key;}
  lock(){this.#key=null;}
  async sealDraft(value){
    const key=this.#key;if(!key)throw Error('Administrator sign-in required.');
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(DRAFT_CONTEXT)},key,encoder.encode(JSON.stringify(value)));
    // Avoid a large spread for floor data; browsers have small argument limits.
    let binary='';for(const byte of new Uint8Array(encrypted))binary+=String.fromCharCode(byte);
    return {version:1,salt:this.#salt,iv:base64(iv),ciphertext:btoa(binary)};
  }
  async openDraft(envelope){
    const key=this.#key;if(!key)throw Error('Administrator sign-in required.');
    if(envelope.version!==1||envelope.salt!==this.#salt)throw Error('This draft belongs to a different administrator password.');
    return JSON.parse(await decrypt(key,envelope,DRAFT_CONTEXT));
  }
}
export async function unlockAdmin(password,config){
  if(!crypto?.subtle)throw Error('Administrator access needs HTTPS and a browser with Web Crypto support.');
  try{
    const key=await derive(password,config);
    if(await decrypt(key,config,CONTEXT)!==CONTEXT)throw Error();
    return new AdminSession(key,config.salt);
  }catch{throw Error('Incorrect administrator password, or the access configuration has changed.');}
}
