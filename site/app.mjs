import {translations} from './translations.mjs';
const params = new URLSearchParams(location.search);
const allowed = new Set(Object.keys(translations));
const cached = (() => { try {return localStorage.getItem('handoffglass-site-lang');} catch {return null;} })();
const browserLang = navigator.language.startsWith('zh') ? 'zh' : navigator.language.startsWith('ja') ? 'ja' : 'en';
let language = [params.get('lang'),cached,browserLang].find(x => allowed.has(x)) || 'en';
let outcome='waiting';
const stage=document.querySelector('.experience-stage');
const buttonComplete=document.getElementById('complete');
const buttonDecline=document.getElementById('decline');
function translate(){
  const t=translations[language];
  document.documentElement.lang= language==='zh'?'zh-CN':language;
  document.title= language==='zh'?'HandoffGlass — 下一步，指给你看。':language==='ja'?'HandoffGlass — 次の一手を、見えるかたちに。':'HandoffGlass — The handoff, made visible.';
  for(const node of document.querySelectorAll('[data-i18n]')) {
    const value=t[node.dataset.i18n];
    if (value !== undefined) node.textContent=value;
  }
  document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang===language)));
  stage.querySelector('.handoff-title').textContent=outcome==='waiting'?t['demo.cardtitle']:t[outcome==='complete'?'demo.completeText':'demo.declineText'];
  stage.querySelector('.progressive-copy span').textContent=outcome==='waiting'?t['demo.cardbody']:t[outcome==='complete'?'demo.completedBody':'demo.declinedBody'];
  try {localStorage.setItem('handoffglass-site-lang',language);} catch {}
}
function setOutcome(next){
  outcome=next;stage.dataset.outcome=next;
  stage.querySelector('.handoff-title').textContent=translations[language][next==='waiting'?'demo.cardtitle':next==='complete'?'demo.completeText':'demo.declineText'];
  stage.querySelector('.progressive-copy span').textContent=translations[language][next==='waiting'?'demo.cardbody':next==='complete'?'demo.completedBody':'demo.declinedBody'];
  stage.querySelector('.progressive-copy span').style.animation='none';
  requestAnimationFrame(()=>{stage.querySelector('.progressive-copy span').style.animation='';});
}
for(const b of document.querySelectorAll('[data-lang]')) b.addEventListener('click',()=>{language=b.dataset.lang;translate();});
for(const b of document.querySelectorAll('[data-scenario]')) b.addEventListener('click',()=>{
  stage.dataset.scene=b.dataset.scenario;
  stage.querySelector('.stage-id').textContent='SCENE '+String([...b.parentElement.children].indexOf(b)+1).padStart(2,'0')+' / 03';
  document.querySelectorAll('[data-scenario]').forEach(x=>{x.classList.toggle('is-active',x===b);x.setAttribute('aria-pressed',String(x===b));});
  setOutcome('waiting');
});
buttonComplete.addEventListener('click',()=>setOutcome('complete'));
buttonDecline.addEventListener('click',()=>setOutcome('decline'));
const copyButton=document.getElementById('copy-command');
copyButton.addEventListener('click',async()=>{
  const command=document.getElementById('install-command').textContent;
  try {await navigator.clipboard.writeText(command);}
  catch { const ta=document.createElement('textarea');ta.value=command;ta.style.position='fixed';ta.style.opacity='0';document.body.append(ta);ta.select();document.execCommand('copy');ta.remove(); }
  const node=copyButton.querySelector('[data-i18n]');node.textContent=translations[language]['start.copied'];
  copyButton.classList.add('is-copied');
  copyButton.addEventListener('blur',()=>{node.textContent=translations[language]['start.copy'];copyButton.classList.remove('is-copied');},{once:true});
});
translate();
