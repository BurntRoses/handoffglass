/** Small DOM adapter for structural renderer tests. Animation tests run in Electron. */
export class SvgNode {
  constructor(tag) {
    this.tag=tag; this.attrs={}; this.children=[]; this.parentNode=null; this.textContent='';
    const values=new Map();
    this.style={setProperty:(k,v)=>values.set(k,v),getPropertyValue:k=>values.get(k)||''};
  }
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  append(...nodes){for(const n of nodes)this.insertBefore(n,null);}
  insertBefore(n,anchor){n.remove();const i=anchor===null?this.children.length:this.children.indexOf(anchor);if(i<0)throw new Error('Invalid anchor');this.children.splice(i,0,n);n.parentNode=this;}
  remove(){if(this.parentNode){const a=this.parentNode.children;a.splice(a.indexOf(this),1);this.parentNode=null;}}
  replaceChildren(...nodes){for(const n of [...this.children])n.remove();this.append(...nodes);}
  querySelectorAll(selector){return walk(this,n=>n!==this&&(n.attrs.class||'').split(' ').includes(selector.slice(1)));}
}
export const walk=(root,predicate)=>[root,...root.children.flatMap(c=>walk(c,()=>true))].filter(predicate);
export const documentStub={createElementNS:(_ns,tag)=>new SvgNode(tag)};
