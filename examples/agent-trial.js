const $=id=>document.getElementById(id);
async function action(name,value){try{await window.hgTrial.action(name,value);}catch(error){$('verification').textContent=error.message;}}
for(const b of document.querySelectorAll('[data-preset]'))b.addEventListener('click',()=>action('preset',Number(b.dataset.preset)));
$('replay').addEventListener('click',()=>action('replay'));
$('versions').addEventListener('click',()=>{$('result').textContent='历史版本已展开 · 原始界面的状态变化';});
$('open').addEventListener('click',()=>{
 if(document.body.dataset.opened==='true')return;
 document.body.dataset.opened='true';$('result').textContent='项目已打开 ✓ · 来自原始按钮的点击事件';$('open').textContent='项目已打开 ✓';
 void action('opened');
});
window.addEventListener('hg-trial-reset',()=>{
 delete document.body.dataset.opened;$('open').textContent='打开项目 ';
 const icon=document.createElement('span');icon.textContent='↗';$('open').append(icon);
 $('result').textContent='点击原始按钮后，Agent 会发起交接并核对项目状态。';
});
window.hgTrial.onState(state=>{
 $('connection').textContent=state.connection||'本地 Agent 已连接';
 if(state.preset!==undefined)for(const b of document.querySelectorAll('[data-preset]'))b.setAttribute('aria-pressed',String(Number(b.dataset.preset)===state.preset));
 if(state.message)$('verification').textContent=state.message;
 if(state.phase)$('phase').textContent=state.phase;
});
