// Pure gesture maths: keep the map point under the fingers anchored during zoom.
export function gestureBox(start,current){
  const factor=start.distance>0&&current.distance>0?Math.max(.02,Math.min(50,current.distance/start.distance)):1;
  const [x,y,w,h]=start.box,scale=start.scale||1;
  const width=w/factor,height=h/factor;
  return [start.anchor[0]-(start.anchor[0]-x)/factor-(current.x-start.x)/(scale*factor),start.anchor[1]-(start.anchor[1]-y)/factor-(current.y-start.y)/(scale*factor),width,height];
}
export function zoomBox(box,factor,anchor){
  const [x,y,w,h]=box,[ax,ay]=anchor??[x+w/2,y+h/2];
  return [ax-(ax-x)/factor,ay-(ay-y)/factor,w/factor,h/factor];
}
export function safeViewBox(box,fitBox){
  if(!box.every(Number.isFinite)||box[2]<=0||box[3]<=0)return null;
  // Only zoom has a numerical safety limit. Panning is unrestricted.
  const ratio=Math.min(40,Math.max(.025,box[2]/fitBox[2]));
  const factor=ratio*fitBox[2]/box[2];
  return [box[0]+box[2]*(1-factor)/2,box[1]+box[3]*(1-factor)/2,box[2]*factor,box[3]*factor];
}
