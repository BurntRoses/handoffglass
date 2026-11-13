/** Small source-preserving JSONC editor for one owned host configuration entry. */
import {isDeepStrictEqual} from 'node:util';
export function parseJsonc(source){
 if(typeof source!=='string')throw TypeError('Configuration must be text');
 let at=source.charCodeAt(0)===0xfeff?1:0;
 const fail=()=>{throw Error('Host configuration is malformed; no files changed');};
 function skip(){for(;;){while(/\s/.test(source[at]??'')&&at<source.length)at++;if(source.slice(at,at+2)==='//'){at=source.indexOf('\n',at);if(at<0)at=source.length;continue;}if(source.slice(at,at+2)==='/*'){const end=source.indexOf('*/',at+2);if(end<0)fail();at=end+2;continue;}break;}}
 function string(){const start=at++;for(;at<source.length;at++){if(source[at]==='\\'){at++;continue;}if(source[at]==='"'){at++;try{return JSON.parse(source.slice(start,at));}catch{fail();}}}fail();}
 function node(){
  skip();const start=at,c=source[at];
  if(c==='{'||c==='['){
   at++;const object=c==='{',value=object?Object.create(null):[],entries=[];skip();
   while(source[at]!== (object?'}':']')){
    if(at>=source.length)fail();skip();const keyStart=at;let key;
    if(object){if(source[at]!=='"')fail();key=string();if(Object.hasOwn(value,key))fail();skip();if(source[at++]!==':')fail();}
    const child=node();if(object)value[key]=child.value;else value.push(child.value);
    skip();const comma=source[at]===','?at++:null;
    entries.push({key,keyStart,node:child,comma});skip();
    if(comma===null&&source[at]!== (object?'}':']'))fail();
   }
   const close=at++;return {start,end:at,close,value,entries,type:object?'object':'array'};
  }
  if(c==='"'){const value=string();return {start,end:at,value,type:'value'};}
  const raw=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(source.slice(at));
  if(!raw)fail();at+=raw[0].length;return {start,end:at,value:JSON.parse(raw[0]),type:'value'};
 }
 const root=node();skip();if(at!==source.length)fail();return root;
}
const replace=(text,start,end,value)=>text.slice(0,start)+value+text.slice(end);
const render=(value,indent)=>JSON.stringify(value,null,2).replaceAll('\n','\n'+indent);
function removeEntry(source,parent,index){
 const entry=parent.entries[index],changes=[[entry.keyStart,entry.node.end,'']];
 if(entry.comma!==null)changes.push([entry.comma,entry.comma+1,'']);
 else if(index&&parent.entries[index-1].comma!==null){const comma=parent.entries[index-1].comma;changes.push([comma,comma+1,'']);}
 return changes.sort((a,b)=>b[0]-a[0]).reduce((text,[a,b,v])=>replace(text,a,b,v),source);
}
function appendEntry(source,parent,text){
 const lineStart=source.lastIndexOf('\n',parent.close-1)+1;
 const base=/^[ \t]*/.exec(source.slice(lineStart,parent.close))[0],indent=base+'  ';
 let next=replace(source,parent.close,parent.close,'\n'+indent+text.replaceAll('\n','\n'+indent)+'\n'+base);
 const last=parent.entries.at(-1);if(last&&last.comma===null)next=replace(next,last.node.end,last.node.end,',');
 return next;
}
export function editJsoncMember(source,path,value,{remove=false}={}){
 if(!path.length||path.some(k=>typeof k!=='string'||!k))throw TypeError('Expected a member path');
 const root=parseJsonc(source);let parent=root;
 for(let i=0;i<path.length-1;i++){
  if(parent.type!=='object')throw Error('Unexpected host configuration shape');
  const entry=parent.entries.find(e=>e.key===path[i]);
  if(!entry){if(remove)return source;let nested=value;for(let p=path.length-1;p>i;p--)nested={[path[p]]:nested};return editJsoncMember(source,path.slice(0,i+1),nested);}
  parent=entry.node;
 }
 if(parent.type!=='object')throw Error('Unexpected host configuration shape');
 const key=path.at(-1),index=parent.entries.findIndex(e=>e.key===key),entry=parent.entries[index];
 if(remove)return entry?removeEntry(source,parent,index):source;
 if(entry){if(isDeepStrictEqual(JSON.parse(JSON.stringify(entry.node.value)),value))return source;return replace(source,entry.node.start,entry.node.end,render(value,''));}
 return appendEntry(source,parent,JSON.stringify(key)+': '+JSON.stringify(value,null,2));
}
export function jsoncValue(source,path){let value=parseJsonc(source).value;for(const key of path){if(!value||typeof value!=='object'||!Object.hasOwn(value,key))return undefined;value=value[key];}return value;}
export function editJsoncArrayReference(source,key,reference,enabled){
 const root=parseJsonc(source);if(root.type!=='object')throw Error('Expected host configuration object');
 const entry=root.entries.find(e=>e.key===key);
 if(!entry)return enabled?editJsoncMember(source,[key],[reference]):source;
 if(entry.node.type!=='array')throw Error('Expected plugin reference array');
 const indices=entry.node.entries.flatMap((e,i)=>e.node.value===reference?[i]:[]);
 if(indices.length>1)throw Error('Duplicate owned plugin references; review host configuration');
 if(enabled)return indices.length?source:appendEntry(source,entry.node,JSON.stringify(reference));
 return indices.length?removeEntry(source,entry.node,indices[0]):source;
}
