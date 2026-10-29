// Browser integration checks run from the screen lab, against the actual app.
// They change only the local preview, never publish layouts or receive a password.
const $=id=>document.getElementById(id);
export async function runBrowserChecks({presets,resize}){
  const button=$('runChecks');button.disabled=true;
  const frame=$('preview'),d=()=>frame.contentDocument,w=()=>frame.contentWindow;
  const findings=[],failures=[],matrix=[];
  const record=(name,ok,details='')=>{findings.push({name,passed:!!ok,...details?{details}:{}});if(!ok)failures.push(name);};
  const settle=()=>new Promise(resolve=>setTimeout(resolve,45));
  const click=async selector=>{const el=d().querySelector(selector);if(!el)throw Error('Missing control: '+selector);el.click();await settle();};
  const visible=el=>!!el&&!el.closest('[hidden]')&&el.getClientRects().length>0&&w().getComputedStyle(el).visibility!=='hidden';
  const box=()=>d().querySelector('#floorMap').getAttribute('viewBox');
  const tapSpace=async name=>{
    const space=[...d().querySelectorAll('#floorMap [data-space]')].find(el=>el.getAttribute('aria-label')?.startsWith(name+','));
    if(!space)throw Error('Missing room: '+name);
    const r=space.getBoundingClientRect(),svg=d().querySelector('#floorMap');
    for(const type of ['pointerdown','pointerup'])svg.dispatchEvent(new (w().PointerEvent)(type,{pointerId:8,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0,bubbles:true,cancelable:true,pointerType:'touch'}));
    space.dispatchEvent(new (w().MouseEvent)('click',{bubbles:true}));await settle();
  };
  try{
    if(d().querySelector('#guideDialog[open]'))await click('#guideSkip');
    if(d().querySelector('#main.is-fullscreen'))await click('#fullscreen');
    await click('#categoriesHome');
    record('Category-first home has all 18 original groups',d().querySelectorAll('[data-home-category]').length===18);
    record('Public view has no Layout studio button or rendered editor',!d().querySelector('#openStudio')&&!d().querySelector('#studioSidebar button'));
    record('Public import is disabled',d().querySelector('#importFile').disabled);
    await click('[data-home-category="Other"]');
    record('Other retains four original facility groups',d().querySelectorAll('[data-home-subcategory]').length===4);
    await click('[data-home-subcategory="Labs"]');
    record('Facility group opens room choices',d().querySelectorAll('.class-tile').length===6);
    await click('#categoriesHome');await click('[data-home-category="Grade 1"]');
    record('Grade 1 opens seven classes',d().querySelectorAll('.class-tile').length===7);
    await click('.class-tile[data-room="p1-1"]');
    record('Class choice opens map and matching description',d().querySelector('#roomDetails h2')?.textContent==='1A'&&visible(d().querySelector('#floorMap')));
    const original=box();await click('#zoomIn');record('Zoom changes the map viewport',box()!==original);await click('#resetMap');record('Reset centres the selected room',box()===original);
    const svg=d().querySelector('#floorMap'),r=svg.getBoundingClientRect(),cx=r.left+r.width*.35,cy=r.top+r.height*.45;
    const pointer=(type,id,x,y)=>svg.dispatchEvent(new (w().PointerEvent)(type,{pointerId:id,clientX:x,clientY:y,button:0,bubbles:true,cancelable:true,pointerType:'touch'}));
    const before=box();pointer('pointerdown',1,cx-30,cy);pointer('pointerdown',2,cx+30,cy);pointer('pointermove',2,cx+90,cy+20);pointer('pointerup',2,cx+90,cy+20);pointer('pointermove',1,cx-10,cy+20);pointer('pointerup',1,cx-10,cy+20);await settle();
    record('Two-finger zoom and continued one-finger pan work',box()!==before&&Number(box().split(' ')[2])<Number(before.split(' ')[2]));
    record('Gesture does not change the selected room',d().querySelector('#roomDetails h2')?.textContent==='1A');
    await click('#resetMap');record('Reset recovers from a pinch and pan',box()===original);
    await click('#fullscreen');
    record('Fullscreen keeps details in the fullscreen map subtree',!!d().querySelector('#main.is-fullscreen #roomDetails')&&visible(d().querySelector('#roomDetails')));
    await click('#fitMap');await tapSpace('1B');record('Selecting another room in fullscreen updates its description',d().querySelector('#roomDetails h2')?.textContent==='1B');
    await click('#closeDetails');record('Closing fullscreen details keeps the map usable',d().querySelector('#roomDetails').hidden&&visible(d().querySelector('#floorMap')));
    await tapSpace('1A');await click('#fullscreen');record('Exiting fullscreen restores the details beside the map',!!d().querySelector('#workspace > #roomDetails'));
    await click('#categoriesHome');await click('#openGuide');
    record('Guide can be replayed',!!d().querySelector('#guideDialog[open]'));
    await click('#guideNext');await click('#guideNext');await click('#guideNext');record('Guide finishes and is remembered',!d().querySelector('#guideDialog[open]')&&JSON.parse(w().localStorage.getItem('schoolNavigator.v4.guideSeen'))===true);
    await click('#categoriesHome');
    const search=d().querySelector('#search');search.value='Biology';search.dispatchEvent(new (w().Event)('input',{bubbles:true}));await settle();
    record('Home search returns a facility without choosing a category',d().querySelectorAll('.class-tile').length===1&&d().querySelector('.class-tile strong').textContent==='Biology Lab');
    await click('#categoriesHome');
    // Measure home, selected map, and fullscreen fallback at each real iframe size.
    for(const [name,width,height] of presets){
      $('status').textContent='Checking '+name+'…';$('width').value=width;$('height').value=height;resize();await settle();
      await click('#categoriesHome');
      const measure=mode=>{
        const win=w(),doc=d(),stage=doc.querySelector('#mapStage'),details=doc.querySelector('#roomDetails');
        const panels=[...doc.querySelectorAll('.app-header,.category-tile,.class-tile,.map-panel,.details-panel,.mobile-nav,.site-footer,.map-controls')].filter(visible);
        const overflowing=panels.filter(el=>{const r=el.getBoundingClientRect();return r.left<-1||r.right>win.innerWidth+1;}).map(el=>el.id||el.className);
        const sr=stage.getBoundingClientRect(),dr=details.getBoundingClientRect();
        const item={name,viewport:[width,height],mode,pageOverflow:doc.documentElement.scrollWidth>width+1,overflowing,mapHeight:visible(stage)?Math.round(sr.height):null,detailsVisible:mode==='home'?null:visible(details)&&dr.top>=-1&&dr.bottom<=height+1};
        const selected=doc.querySelector('#floorMap .selected');
        if(mode!=='home'&&selected){const ar=selected.getBoundingClientRect();item.selectedVisible=ar.right>sr.left&&ar.left<sr.right&&ar.bottom>sr.top&&ar.top<sr.bottom;}
        item.passed=!item.pageOverflow&&!overflowing.length&&(mode==='home'||(item.mapHeight>=80&&item.detailsVisible&&item.selectedVisible));
        matrix.push(item);if(!item.passed)failures.push(name+' '+mode);$('results').textContent=JSON.stringify({progress:matrix.length,failures,findings,matrix},null,2);
      };
      measure('home');await click('[data-home-category="Grade 1"]');await click('.class-tile[data-room="p1-1"]');measure('selected map');
      await click('#fullscreen');measure('fullscreen');await click('#fullscreen');
    }
    $('width').value=390;$('height').value=844;resize();await settle();await click('#resetMap');
    $('results').textContent=JSON.stringify({summary:`${findings.filter(f=>f.passed).length}/${findings.length} functional checks, ${matrix.filter(m=>m.passed).length}/${matrix.length} viewport states passed`,failures,findings,matrix},null,2);
    $('status').textContent=failures.length?'Some checks need attention.':'All browser checks passed.';
  }catch(error){$('results').textContent=JSON.stringify({error:error.message,failures,findings,matrix},null,2);$('status').textContent='Browser checks stopped.';}
  finally{button.disabled=false;}
}
