import {enhanceDetails} from './disclosure.mjs';
const $=id=>document.getElementById(id);
const copy={
 'zh-CN':{title:'改动审查',eyebrow:'HANDOFFGLASS · 只读',copy:'复制脱敏记录',decline:'不继续',reviewed:'已审阅，回到会话',trail:'步骤记录',integrity:'完整性信息',before:'更改前',after:'更改后',ready:'核对摘要后选择是否继续。',high:'请先审阅高风险改动，再决定是否继续。',waiting:'请核对下列改动，再回到会话继续。',refused:'已记录：不继续。',done:'已记录审阅结果。回到原会话核实后继续。',received:'收到改动摘要',accepted:'用户已审阅',rejected:'用户选择不继续',failed:'未能提交，请重试。',stale:'记录未提交，请检查当前状态。',recorded:'已记录。',copied:'已复制脱敏记录。',copyFailed:'未能复制。',redacted:'已脱敏',kinds:{file:'文件',config:'配置',setting:'设置',permission:'权限',external:'外部操作'},risks:{low:'低风险',medium:'需留意',high:'高风险',irreversible:'已不可撤回'}},
 'en-US':{title:'Review changes',eyebrow:'HANDOFFGLASS · READ ONLY',copy:'Copy redacted record',decline:'Do not continue',reviewed:'Reviewed, return to chat',trail:'Step record',integrity:'Integrity details',before:'Before',after:'After',ready:'Check the summaries, then choose whether to continue.',high:'Review the high-risk changes before deciding to continue.',waiting:'Check the changes below, then return to your chat.',refused:'Recorded: do not continue.',done:'Review recorded. Return to your chat to verify and continue.',received:'Change summaries received',accepted:'User reviewed',rejected:'User chose not to continue',failed:'Could not submit. Try again.',stale:'Not submitted. Check the current state.',recorded:'Recorded.',copied:'Redacted record copied.',copyFailed:'Could not copy.',redacted:'Redacted',kinds:{file:'File',config:'Configuration',setting:'Setting',permission:'Permission',external:'External action'},risks:{low:'Low risk',medium:'Needs attention',high:'High risk',irreversible:'Cannot be undone'}}
};
let active=null,busy=false,last='',words=copy['zh-CN'];
function el(tag,text,className){const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;}
function render(review){
 active=review;words=copy[review.locale]??copy['zh-CN'];
 document.documentElement.lang=review.locale??'zh-CN';document.documentElement.dataset.theme=review.theme??'system';document.title=words.title+' · HandoffGlass';
 for(const id of ['copy','decline','reviewed'])$(id).textContent=words[id];
 $('heading').textContent=words.title;$('eyebrow').textContent=words.eyebrow;$('trailLabel').textContent=words.trail;
 const waiting=review.status==='waiting_review';
 $('state').textContent=waiting?['high','irreversible'].includes(review.risk)?words.high:words.waiting:review.status==='declined'?words.refused:words.done;
 $('reviewed').disabled=$('decline').disabled=busy||!waiting;
 const key=review.id+':'+review.revision+':'+review.locale;
 if(last===key)return;last=key;$('feedback').textContent=words.ready;
 $('changes').replaceChildren();
 for(const change of review.changes){
  const card=el('article','','change'),meta=el('div','','meta');
  meta.append(el('span',words.kinds[change.kind]),el('span',words.risks[change.risk],['high','irreversible'].includes(change.risk)?'risk':''));
  if(change.redacted||change.before.redacted||change.after.redacted)meta.append(el('span',words.redacted));
  card.append(meta,el('h2',change.summary));
  const diff=el('div','','diff');
  for(const key of ['before','after']){const section=el('section','');section.append(el('small',words[key]),el('p',change[key].summary));diff.append(section);}
  const integrity=el('details',''),hashes=el('div','','hashes');integrity.append(el('summary',words.integrity));
  for(const key of ['before','after'])hashes.append(el('small',words[key]),el('div','SHA256 '+change[key].hash,'hash'));
  integrity.append(hashes);card.append(diff,integrity);$('changes').append(card);
 }
 $('trail').replaceChildren(el('li',words.received),...(!waiting?[el('li',review.status==='declined'?words.rejected:words.accepted)]:[]));enhanceDetails($('changes'));
}
window.hgReview.onRender(render);
for(const [id,decision]of [['decline','declined'],['reviewed','reviewed']])$(id).addEventListener('click',async()=>{
 if(!active||busy)return;busy=true;render(active);
 try{const r=await window.hgReview.decide({id:active.id,revision:active.revision,decision});if(r.review)render(r.review);$('feedback').textContent=r.error?words.stale:words.recorded;}
 catch{$('feedback').textContent=words.failed;}finally{busy=false;if(active)render(active);}
});
$('copy').addEventListener('click',async()=>{try{const result=await window.hgReview.copy();$('feedback').textContent=result.ok?words.copied:words.copyFailed;}catch{$('feedback').textContent=words.copyFailed;}});
