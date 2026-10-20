import { translations } from './translations.mjs';

const words={
 en:{home:'Home',title:'Install',lead:'Send this to your agent.',codeLabel:'To your agent',useTitle:'Use',example:'Show me how to empty the Trash.',useBody:'During other tasks, your agent can also guide you when a step needs your input.',backHome:'Home',copy:'Copy',copied:'Copied'},
 zh:{home:'首页',title:'安装',lead:'把这句话发给你的 Agent。',codeLabel:'发送给 Agent',useTitle:'使用',example:'教我清空废纸篓。',useBody:'执行其他任务时，需要你亲手操作的地方，Agent 也可以在屏幕上指引你。',backHome:'返回首页',copy:'复制',copied:'已复制'},
 ja:{home:'ホーム',title:'インストール',lead:'エージェントに送ってください。',codeLabel:'エージェントへ',useTitle:'使い方',example:'ゴミ箱を空にする方法を教えて。',useBody:'他の作業中も、人の操作が必要になれば画面上で案内できます。',backHome:'ホームへ',copy:'コピー',copied:'コピー済み'}
};
const cached=(()=>{try{return localStorage.getItem('handoffglass-site-lang');}catch{return null;}})();
const browserLang=navigator.language.startsWith('zh')?'zh':navigator.language.startsWith('ja')?'ja':'en';
let lang=[new URLSearchParams(location.search).get('lang'),cached,browserLang].find(x=>Object.hasOwn(words,x))||'en';
const button=document.getElementById('copyCode');
function paint(){
 const w=words[lang];
 document.documentElement.lang=lang==='zh'?'zh-CN':lang;
 document.title=w.title+' · HandoffGlass';
 for(const [id,value] of Object.entries(w)){
  const el=document.getElementById(id);
  if(el)el.textContent=value;
 }
 document.getElementById('codeContent').textContent=translations[lang]['start.prompt'];
 button.textContent=w.copy;
 document.querySelectorAll('[data-lang]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.lang===lang)));
 try{localStorage.setItem('handoffglass-site-lang',lang);}catch{}
}
for(const control of document.querySelectorAll('[data-lang]'))control.addEventListener('click',()=>{lang=control.dataset.lang;paint();});
button.addEventListener('click',async()=>{
 const text=document.getElementById('codeContent').textContent;
 try{await navigator.clipboard.writeText(text);}
 catch{
  const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();document.execCommand('copy');area.remove();
 }
 button.textContent=words[lang].copied;
 button.addEventListener('blur',()=>{button.textContent=words[lang].copy;},{once:true});
});
paint();
