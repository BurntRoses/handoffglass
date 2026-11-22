const params=new URLSearchParams(location.search);
const $=id=>document.getElementById(id);
document.documentElement.dataset.theme=params.get('theme')||'system';
if(params.get('locale')==='en-US'){
  document.documentElement.lang='en-US';
  $('title').textContent='Share a screenshot with the agent?';
  $('detail').textContent='Only this app’s windows on one display will be shared.';
  $('cancel').textContent='Cancel';
  $('share').textContent='Share screenshot';
}
$('target').textContent=params.get('applicationName')||'';
$('cancel').onclick=()=>window.hgScreenshot.decide(false);
$('share').onclick=()=>window.hgScreenshot.decide(true);
document.addEventListener('keydown',event=>{if(event.key==='Escape')window.hgScreenshot.decide(false);});
