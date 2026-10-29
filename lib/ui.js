export const $=id=>document.getElementById(id);
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z"/><path d="M9 3v16M15 5v16"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  building:'<path d="M4 21V5l8-3 8 3v16M2 21h20M9 21v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1"/>',
  star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
  fit:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><path d="m8 8-5-5m13 5 5-5M8 16l-5 5m13-5 5 5"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  share:'<path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  edit:'<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14l-1 7 1-1Z"/>',
  layers:'<path d="m12 3 10 6-10 6L2 9l10-6Zm-9 11 9 5 9-5M3 18l9 5 9-5"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  undo:'<path d="m9 4-6 6 6 6M3 10h11a7 7 0 0 1 7 7v3"/>',
  redo:'<path d="m15 4 6 6-6 6m6-6H10a7 7 0 0 0-7 7v3"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>'
};
export const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]??paths.map}</svg>`;
export function fillIcons(root=document) {root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});}
export function readStorage(key,fallback) {try {const value=localStorage.getItem(key);return value===null?fallback:JSON.parse(value);} catch{return fallback;}}
export function writeStorage(key,value) {try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
export function downloadJSON(value,filename='campus.json') {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
// In-page dialogs stay usable on phones, TVs and embedded previews.
function requestDialog(message,value,inputMode){
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='app-dialog editor-dialog';
    const titleId='edit-question-'+Math.random().toString(36).slice(2);dialog.setAttribute('aria-labelledby',titleId);
    dialog.innerHTML=`<form><div class="dialog-heading"><h2 id="${titleId}">${inputMode?'Edit campus':'Confirm change'}</h2></div><p class="dialog-question"></p>${inputMode?'<label class="field"><span>Enter a name</span><input name="answer" required maxlength="120" autocomplete="off"></label>':''}<div class="dialog-buttons"><button type="button" class="button cancel-dialog">Cancel</button><button class="button primary" type="submit">${inputMode?'Save':'Continue'}</button></div></form>`;
    dialog.querySelector('.dialog-question').textContent=message;
    if(inputMode)dialog.querySelector('input').value=value;
    let settled=false;
    const done=result=>{if(settled)return;settled=true;dialog.close();dialog.remove();resolve(result);};
    dialog.querySelector('form').onsubmit=e=>{e.preventDefault();done(inputMode?dialog.querySelector('input').value:true);};
    dialog.querySelector('.cancel-dialog').onclick=()=>done(inputMode?null:false);
    dialog.addEventListener('cancel',e=>{e.preventDefault();done(inputMode?null:false);});
    document.body.append(dialog);dialog.showModal();if(inputMode)dialog.querySelector('input').select();
  });
}
export const askInput=(message,value='')=>requestDialog(message,value,true);
export const askConfirm=message=>requestDialog(message,'',false);
