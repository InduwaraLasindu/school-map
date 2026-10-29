import {$,icon,readStorage,writeStorage} from './ui.js';
const SEEN='schoolNavigator.v4.guideSeen';
const steps=[
  {icon:'building',title:'Find your class in two taps.',text:'Choose a category such as Grade 1, then tap your class. Its room lights up on the map, with the building and floor below.',tags:['1 · Choose a category','2 · Choose your class']},
  {icon:'map',title:'Explore with your fingers.',text:'Drag the map to move around. Pinch with two fingers to zoom in or out. Tap Reset to bring your highlighted room back to the centre.',tags:['Drag to move','Pinch to zoom','Reset to return']},
  {icon:'star',title:'Keep your places close.',text:'Save a room for next time or share its link. Fullscreen gives the map more space and keeps room details visible. Reopen this guide with the help button.',tags:['Save favourite rooms','Share a room link','Open fullscreen']}
];
export function setupGuide(){
  const dialog=$('guideDialog');let step=0;
  const render=()=>{
    const s=steps[step];
    $('guideContent').innerHTML=`<div class="guide-illustration">${icon(s.icon)}<span>${step+1}</span></div><p class="eyebrow">QUICK START · ${step+1} OF ${steps.length}</p><h2 id="guideTitle">${s.title}</h2><p class="guide-copy">${s.text}</p><div class="guide-tags">${s.tags.map(t=>`<span>${t}</span>`).join('')}</div><div class="guide-progress" aria-label="Step ${step+1} of ${steps.length}">${steps.map((_,i)=>`<i class="${i===step?'active':''}"></i>`).join('')}</div>`;
    $('guideBack').hidden=step===0;$('guideNext').textContent=step===steps.length-1?'Start exploring':'Next';
  };
  const finish=()=>{writeStorage(SEEN,true);dialog.close();};
  $('guideSkip').onclick=finish;$('guideBack').onclick=()=>{step--;render();};
  $('guideNext').onclick=()=>{if(step===steps.length-1){finish();return;}step++;render();};
  dialog.addEventListener('cancel',()=>writeStorage(SEEN,true));
  return {open(){step=0;render();dialog.showModal();},firstVisit(){if(!readStorage(SEEN,false))this.open();}};
}
