/** Follow only the pointer within the current step's grounded target. */
export function createGuidanceFocus({readPointer,now=Date.now,dwellMs=240}={}){
  let key=null,bounds=null,reference=null,enteredAt=null,settled=false;
  return {
    update(session){
      const target=session?.annotations?.find(mark=>mark.shape!=='badge'&&!mark.scrollDirection);
      const enabled=session?.status==='awaiting_user'&&session.phase!=='blocked'&&
        session.desktopConnection!=='reconnecting'&&session.continuous&&!session.demo&&
        target?.width>0&&target?.height>0;
      const nextKey=enabled?`${session.id}:${session.step}:${target.id??target.shape}`:null;
      const moved=enabled&&reference&&Math.hypot(target.x-reference.x,target.y-reference.y)>
        Math.max(24,Math.min(reference.width,reference.height)/2);
      bounds=enabled?{x:target.x,y:target.y,width:target.width,height:target.height}:null;
      if(nextKey!==key||moved){
        enteredAt=null;
        settled=false;
        reference=bounds;
      }
      key=nextKey;
      return enabled;
    },
    sample(){
      if(!bounds||settled)return false;
      const {x,y}=readPointer();
      const t=now();
      if(Math.abs(x-bounds.x)>bounds.width/2||Math.abs(y-bounds.y)>bounds.height/2){
        enteredAt=null;
        return false;
      }
      enteredAt??=t;
      settled=t-enteredAt>=dwellMs;
      return settled;
    },
    get subdued(){return settled;}
  };
}

export function quietAnnotations(annotations){
  return annotations.filter(mark=>mark.shape!=='badge'&&!mark.scrollDirection).map(mark=>({
    ...mark,shape:'bracket',label:'',effect:'still',strokeWidth:1.8,opacity:Math.min(mark.opacity??1,.85)
  }));
}
