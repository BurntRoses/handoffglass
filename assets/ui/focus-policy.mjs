const cssURL = new URL('./focus-policy.css', import.meta.url).href;

/** One policy per document/shadow tree; no attribute observation or per-frame work. */
export function installFocusPolicy(root=document) {
 if(root.querySelector('[data-prescription-focus-policy]'))return ()=>{};
 const doc=root.nodeType===9?root:root.ownerDocument;
 const style=doc.createElement('link');style.rel='stylesheet';style.dataset.prescriptionFocusPolicy='surface';style.href=cssURL;
 (root.nodeType===9?(root).head:root)?.prepend(style);
 const nested=(node)=>{
  if(node.shadowRoot)installFocusPolicy(node.shadowRoot);
  if(node.localName==='iframe'){
   try{const inner=(node).contentDocument;if(inner?.head)installFocusPolicy(inner);}catch{/* External documents keep their own policy. */}
  }
 };
 const scan=(node)=>{
  if(node.nodeType!==1)return;
  nested(node);
  (node).querySelectorAll('*').forEach(nested);
 };
 const onLoad=(event)=>{if((event.target)?.localName==='iframe')nested(event.target);};
 const onFocus=(event)=>{
  for(const node of event.composedPath())if((node).shadowRoot)installFocusPolicy((node).shadowRoot);
 };
 root.querySelectorAll('*').forEach(nested);
 root.addEventListener('load',onLoad,true);root.addEventListener('focusin',onFocus,true);
 const observer=new (doc.defaultView.MutationObserver)(records=>{
  for(const record of records)record.addedNodes.forEach(scan);
 });
 observer.observe(root,{childList:true,subtree:true});
 return ()=>{observer.disconnect();root.removeEventListener('load',onLoad,true);root.removeEventListener('focusin',onFocus,true);style.remove();};
}

if(typeof document!=='undefined'&&document.head)installFocusPolicy();
