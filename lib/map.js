import {bounds,labelPosition,roomAt,pointInPolygon} from './model.js';
import {gestureBox,zoomBox,safeViewBox} from './gestures.js';
const NS='http://www.w3.org/2000/svg';
const svgEl=(tag,attrs={})=>{const node=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));return node;};
const colorClass=room=>!room?'empty':/lab/i.test(room.category)?'lab':/administration/i.test(room.category)?'admin':/services/i.test(room.category)?'service':/activities/i.test(room.category)?'activity':'classroom';
function wrapLabel(text,width,fontSize) {
  const max=Math.max(6,Math.floor(width/(fontSize*.56))), lines=[];
  const words=text.split(/\s+/).flatMap(word=>{
    const letters=Array.from(word),parts=[];
    while(letters.length>max)parts.push(letters.splice(0,max).join(''));
    if(letters.length)parts.push(letters.join(''));
    return parts;
  });
  for(const word of words) {
    if(lines.length && (lines.at(-1)+' '+word).length<=max)lines[lines.length-1]+=' '+word;
    else lines.push(word);
  }
  return lines;
}

export class FloorMap {
  constructor(svg,onSelect,onViewChange=()=>{}) {
    this.svg=svg;this.onSelect=onSelect;this.onViewChange=onViewChange;this.pointers=new Map();this.dragged=false;
    svg.addEventListener('click',e=>{const g=e.target.closest('[data-space]');if(g&&!this.dragged)this.onSelect(g.dataset.space);});
    svg.addEventListener('keydown',e=>{
      const g=e.target.closest('[data-space]');
      if(g && ['Enter',' '].includes(e.key)){e.preventDefault();this.onSelect(g.dataset.space);return;}
      if(this.edit) return;
      if(e.key==='+'||e.key==='='){e.preventDefault();this.zoom(1.4);}
      if(e.key==='-'){e.preventDefault();this.zoom(1/1.4);}
      if(e.key==='Home'){e.preventDefault();this.reset();}
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        e.preventDefault();
        if(g) this.focusNeighbor(g.dataset.space,e.key);
        else {const [x,y,w,h]=this.box;this.setBox([x+(e.key==='ArrowLeft'?-w*.12:e.key==='ArrowRight'?w*.12:0),y+(e.key==='ArrowUp'?-h*.12:e.key==='ArrowDown'?h*.12:0),w,h]);}
      }
    });
    svg.addEventListener('wheel',e=>{if(!e.ctrlKey && !e.metaKey)return;e.preventDefault();this.zoom(e.deltaY>0?.9:1.1,this.toPoint(e.clientX,e.clientY));},{passive:false});
    svg.addEventListener('pointerdown',e=>this.pointerDown(e));
    svg.addEventListener('pointermove',e=>this.pointerMove(e));
    svg.addEventListener('pointerup',e=>this.pointerEnd(e));
    svg.addEventListener('pointercancel',e=>this.pointerEnd(e));
    svg.addEventListener('lostpointercapture',e=>{if(this.pointers.has(e.pointerId))this.pointerEnd(e);});
    svg.addEventListener('dblclick',e=>{if(!this.edit&&!e.target.closest('[data-space]')){e.preventDefault();this.reset();}});
    // iOS must not pass a map pinch to page-level gesture zoom.
    for(const name of ['gesturestart','gesturechange'])svg.addEventListener(name,e=>e.preventDefault(),{passive:false});
  }
  render(layout,floor,{selected=null,edit=false,reference=false,preserve=false,grid=false}={}) {
    const same=this.floor?.id===floor.id;
    this.layout=layout;this.floor=floor;this.edit=edit;this.selected=selected;
    this.svg.replaceChildren();
    this.svg.setAttribute('aria-label',`${floor.name} floor plan. Select a room. Use arrow keys between rooms; plus and minus to zoom; Home to reset the selected room.`);
    this.svg.classList.toggle('editing',edit);
    const defs=svgEl('defs');
    const pattern=svgEl('pattern',{id:'map-dots',width:25,height:25,patternUnits:'userSpaceOnUse'});
    pattern.append(svgEl('circle',{cx:1,cy:1,r:1,class:'grid-dot'}));defs.append(pattern);
    const hatch=svgEl('pattern',{id:'map-hatch',width:14,height:14,patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'});
    hatch.append(svgEl('line',{x1:0,y1:0,x2:0,y2:14,class:'hatch-line'}));defs.append(hatch);this.svg.append(defs);
    if(grid)this.svg.append(svgEl('rect',{x:0,y:0,width:floor.width,height:floor.height,fill:'url(#map-dots)',class:'grid-bg'}));
    if(reference && floor.sourceImage) this.svg.append(svgEl('image',{href:floor.sourceImage,x:0,y:0,width:floor.width,height:floor.height,class:edit?'reference-overlay':'reference-only'}));
    const group=svgEl('g',{class:reference&&!edit?'hidden-vector':'vector-layer'});
    for(const space of floor.spaces) {
      const room=roomAt(layout,space.id), b=bounds(space.points), position=labelPosition(space);
      const g=svgEl('g',{'data-space':space.id,class:`map-space ${colorClass(room)} ${space.kind} ${selected===space.id?'selected':''}`});
      if(edit||room){g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label',room?`${room.name}, ${space.label}`:space.label);g.setAttribute('aria-pressed',String(selected===space.id));}
      const title=svgEl('title');title.textContent=room?`${room.name} · ${room.category} · ${space.label}`:space.label;g.append(title);
      g.append(svgEl('polygon',{points:space.points.map(p=>p.join(',')).join(' '),class:'space-shape',...(space.kind==='void'?{fill:'url(#map-hatch)'}:{})}));
      const label=room?.name??(space.kind==='unassigned'?'Unassigned':space.label);
      let size=Math.min(43,Math.max(18,Math.min(b.width/4,b.height/4)));
      let lines=wrapLabel(label,b.width-24,size);
      for(let i=0;i<12 && lines.length*size*1.2>b.height-25 && size>12;i++) {
        size=Math.max(12,size*.88);lines=wrapLabel(label,b.width-24,size);
      }
      const name=svgEl('text',{x:position[0],y:position[1]-(lines.length-1)*size*.6,'text-anchor':'middle','dominant-baseline':'middle',class:'space-label','font-size':size});
      lines.forEach((line,i)=>{const t=svgEl('tspan',{x:position[0],dy:i?size*1.2:0});t.textContent=line;name.append(t);});g.append(name);
      const subY=position[1]+(lines.length-1)*size*.6+size*.85+12;
      if(room && b.height>125 && b.width>150 && subY<b.y+b.height-18 && pointInPolygon([position[0],subY],space.points)) {
        const sub=svgEl('text',{x:position[0],y:subY,'text-anchor':'middle',class:'space-sub','font-size':Math.max(13,size*.58)});
        sub.textContent=space.label.startsWith('Class Room')?space.label.replace('Class Room','Room'):room.category;g.append(sub);
      }
      if(edit && selected===space.id)space.points.forEach(([cx,cy],i)=>g.append(svgEl('circle',{cx,cy,r:7,'data-vertex':i,class:'vertex-handle'})));
      group.append(g);
    }
    for(const marker of floor.markers){
      const g=svgEl('g',{class:'entrance-marker'});g.append(svgEl('circle',{cx:marker.point[0],cy:marker.point[1],r:8}));
      const t=svgEl('text',{x:marker.point[0]+15,y:marker.point[1]+6,'font-size':22});t.textContent=marker.label;g.append(t);group.append(g);
    }
    this.svg.append(group);
    if(!same||!preserve)this.fit();else this.setBox(this.box);
  }
  fit() {
    if(!this.floor)return;
    const points=this.floor.spaces.flatMap(s=>s.points).concat(this.floor.markers.map(m=>m.point));
    const b=points.length?bounds(points):{x:0,y:0,width:this.floor.width,height:this.floor.height};
    this.fitBox=[Math.max(0,b.x-45),Math.max(0,b.y-50),Math.min(this.floor.width,b.width+90),Math.min(this.floor.height,b.height+100)];
    this.setBox(this.fitBox);
  }
  setBox(box) {
    if(!this.floor)return;
    const safe=safeViewBox(box,this.fitBox);if(!safe)return;
    this.box=safe;
    this.svg.setAttribute('viewBox',this.box.join(' '));this.onViewChange(this.zoomLevel());
  }
  zoomLevel(){return this.fitBox?Math.round(this.fitBox[2]/this.box[2]*100):100;}
  zoom(factor,anchor=null) {
    if(!this.box)return;
    this.setBox(zoomBox(this.box,factor,anchor));
  }
  reset(){if(this.selected)this.focusSpace(this.selected);else this.fit();}
  focusSpace(spaceId) {
    const space=this.floor.spaces.find(s=>s.id===spaceId);if(!space)return;
    const b=bounds(space.points),pad=Math.max(70,Math.max(b.width,b.height)*.35);
    this.setBox([b.x-pad,b.y-pad,Math.max(220,b.width+pad*2),Math.max(220,b.height+pad*2)]);
  }
  toPoint(clientX,clientY) {
    const matrix=this.svg.getScreenCTM();
    if(!matrix)return [0,0];
    const point=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());return [point.x,point.y];
  }
  pointerDown(e) {
    if(e.button!==0||!this.box)return;
    if(this.pointers.size>=2)return;
    if(!this.pointers.size)this.dragged=false;
    this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(this.edit)return; // Studio owns geometry gestures.
    this.startGesture();
    if(this.pointers.size>1){this.dragged=true;for(const id of this.pointers.keys())try{this.svg.setPointerCapture(id);}catch{}}
  }
  startGesture() {
    const ps=[...this.pointers.values()];if(!ps.length)return;
    const x=ps.reduce((a,p)=>a+p.x,0)/ps.length,y=ps.reduce((a,p)=>a+p.y,0)/ps.length;
    const m=this.svg.getScreenCTM();
    this.start={box:[...this.box],x,y,anchor:this.toPoint(x,y),distance:ps.length>1?Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y):0,scale:m?Math.hypot(m.a,m.b):1};
  }
  pointerMove(e) {
    if(!this.pointers.has(e.pointerId))return;
    this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(this.edit||!this.start)return;
    const ps=[...this.pointers.values()],x=ps.reduce((a,p)=>a+p.x,0)/ps.length,y=ps.reduce((a,p)=>a+p.y,0)/ps.length;
    if(Math.hypot(x-this.start.x,y-this.start.y)>4||ps.length>1){
      this.dragged=true;
      for(const id of this.pointers.keys())try{this.svg.setPointerCapture(id);}catch{}
    }
    if(!this.dragged)return;
    e.preventDefault();
    this.setBox(gestureBox(this.start,{x,y,distance:ps.length>1?Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y):0}));
  }
  pointerEnd(e) {
    if(!this.pointers.has(e.pointerId))return;
    this.pointers.delete(e.pointerId);
    if(this.pointers.size&&!this.edit)this.startGesture();else this.start=null;
    // A synthesized click following a gesture must not select a room.
    // Keep suppression until the next pointerdown, which starts a new gesture.
  }
  focusNeighbor(id,key) {
    const current=this.floor.spaces.find(s=>s.id===id);if(!current)return;
    const [x,y]=labelPosition(current),dx=key==='ArrowLeft'?-1:key==='ArrowRight'?1:0,dy=key==='ArrowUp'?-1:key==='ArrowDown'?1:0;
    const candidates=this.floor.spaces.filter(s=>s.id!==id&&(this.edit||roomAt(this.layout,s.id))).map(s=>{
      const [sx,sy]=labelPosition(s),forward=(sx-x)*dx+(sy-y)*dy,lateral=Math.abs((sx-x)*dy-(sy-y)*dx);
      return {s,forward,score:forward+lateral*2};
    }).filter(v=>v.forward>1).sort((a,b)=>a.score-b.score);
    const next=candidates[0]?.s;
    if(next){this.svg.querySelector(`[data-space="${CSS.escape(next.id)}"]`)?.focus();this.focusSpace(next.id);}
  }
}
