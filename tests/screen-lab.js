const $=id=>document.getElementById(id);
const presets=[['Small phone', 320, 568], ['Android 360', 360, 640], ['Android tall', 360, 800], ['iPhone SE', 375, 667], ['iPhone mini', 375, 812], ['iPhone 390', 390, 844], ['iPhone 393', 393, 852], ['iPhone 402', 402, 874], ['Android 412', 412, 915], ['iPhone Plus', 414, 896], ['iPhone Max', 430, 932], ['Large phone', 440, 956], ['Small tablet', 600, 960], ['iPad mini', 744, 1133], ['Tablet 768', 768, 1024], ['iPad Air', 820, 1180], ['iPad Pro', 834, 1194], ['Tablet landscape', 1024, 768], ['Wide tablet', 1180, 820], ['Phone landscape', 844, 390], ['Wide landscape', 932, 430], ['Laptop', 1366, 768], ['TV 1080p', 1920, 1080], ['TV 4K', 3840, 2160], ['Ultrawide', 2560, 1080]];
for(const [name,w,h] of presets){const button=document.createElement('button');button.textContent=name;button.type='button';button.onclick=()=>{$('width').value=w;$('height').value=h;resize();};$('presets').append(button);}
function resize(){
  const width=Number($('width').value),height=Number($('height').value),scale=Math.min(1,(innerWidth-40)/width,Math.max(350,innerHeight-290)/height);
  $('preview').style.width=width+'px';$('preview').style.height=height+'px';$('preview').style.transform=`scale(${scale})`;
  $('holder').style.width=width*scale+'px';$('holder').style.height=height*scale+'px';
  $('status').textContent=`${width} × ${height} CSS pixels · ${Math.round(scale*100)}% preview scale`;
  [...$('presets').children].forEach((button,i)=>button.setAttribute('aria-pressed',String(presets[i][1]===width&&presets[i][2]===height)));
}
function report(){
  const d=$('preview').contentDocument,win=$('preview').contentWindow,map=d.querySelector('#floorMap'),stage=d.querySelector('#mapStage');
  const rect=stage?.getBoundingClientRect(),horizontal=d.documentElement.scrollWidth>win.innerWidth+1;
  const visible=el=>el.getClientRects().length&&win.getComputedStyle(el).visibility!=='hidden';
  const overflows=[...d.querySelectorAll('.app-header,.map-heading,.floor-tabs,.map-footer,.details-panel,.studio-bar')].filter(visible).filter(el=>{const r=el.getBoundingClientRect();return r.left<-1||r.right>win.innerWidth+1;}).map(el=>el.className);
  const value={viewport:[win.innerWidth,win.innerHeight],horizontalPageOverflow:horizontal,overflowingPanels:overflows,mapSize:rect?[Math.round(rect.width),Math.round(rect.height)]:null,roomShapes:map?.querySelectorAll('[data-space]').length,selected:d.querySelector('#roomDetails h2')?.textContent??null};
  $('results').textContent=JSON.stringify(value,null,2);return value;
}
$('sizeForm').onsubmit=e=>{e.preventDefault();resize();};$('report').onclick=report;$('preview').onload=()=>{resize();report();};addEventListener('resize',resize);resize();

import {runBrowserChecks} from './browser-checks.js';
$('runChecks').onclick=()=>runBrowserChecks({presets,resize,report});
