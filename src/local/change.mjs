import {redact} from './redact.mjs';
export const CHANGE_KINDS=Object.freeze(['file','config','setting','permission','external']);
export const RISKS=Object.freeze(['low','medium','high','irreversible']);
function summary(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['summary','hash'].includes(k)))throw new TypeError('Only summary and SHA256 are accepted; do not send file contents');
  if(!/^[a-f0-9]{64}$/.test(value.hash||''))throw new TypeError('Expected SHA256 of the source value');
  const safe=redact(value.summary);
  return {summary:safe.text,hash:value.hash,...(safe.redacted?{redacted:true}:{})};
}
export function normalizeChange(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['kind','risk','summary','before','after'].includes(k)))throw new TypeError('Invalid change fields');
  if(!CHANGE_KINDS.includes(value.kind)||!RISKS.includes(value.risk))throw new TypeError('Invalid change kind or risk');
  const safe=redact(value.summary);
  return {kind:value.kind,risk:value.kind==='external'?'irreversible':value.risk,summary:safe.text,
    before:summary(value.before),after:summary(value.after),
    ...(safe.redacted?{redacted:true}:{}),...(value.kind==='external'?{notice:'已不可撤回'}:{})};
}
