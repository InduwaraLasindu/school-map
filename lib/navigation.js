// Preserve the original category order; new categories remain discoverable.
export const CATEGORY_ORDER=['Lower Nursery','Nursery','Pre-Grade',...Array.from({length:11},(_,i)=>`Grade ${i+1}`),'Forms (Secondary)','Edexcel','Advanced Level','Other'];
export const FACILITY_CATEGORIES=['Administration','Labs','Activities','Services'];
export function categoryGroups(rooms){
  const groups=new Map();
  for(const room of rooms){
    const name=FACILITY_CATEGORIES.includes(room.category)?'Other':room.category;
    if(!groups.has(name))groups.set(name,{name,rooms:[],subcategories:[]});
    const group=groups.get(name);group.rooms.push(room);
    if(name==='Other'&&!group.subcategories.includes(room.category))group.subcategories.push(room.category);
  }
  return [...groups.values()].sort((a,b)=>{
    const ai=CATEGORY_ORDER.indexOf(a.name),bi=CATEGORY_ORDER.indexOf(b.name);
    return (ai<0?100:ai)-(bi<0?100:bi)||a.name.localeCompare(b.name,undefined,{numeric:true});
  }).map(group=>({...group,subcategories:group.subcategories.sort((a,b)=>FACILITY_CATEGORIES.indexOf(a)-FACILITY_CATEGORIES.indexOf(b))}));
}
export function categoryRooms(rooms,category,subcategory=null){
  if(!category)return rooms;
  return rooms.filter(r=>category==='Other'?(subcategory?r.category===subcategory:FACILITY_CATEGORIES.includes(r.category)||r.category==='Other'):r.category===category);
}
