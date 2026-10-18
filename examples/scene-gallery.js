import { composeTemplate, flattenScene, patchScene } from '../src/visual/scene.mjs';
import { renderOverlay } from '../src/desktop/overlay-renderer.mjs';
const $ = id => document.getElementById(id);
let scene;
function create() {
  const screen = $('mock').getBoundingClientRect(), target = $('target').getBoundingClientRect();
  const center = {x:target.left - screen.left + target.width/2, y:target.top-screen.top+target.height/2,
    width:target.width + 20,height:target.height+20,label:'核对原始界面后再操作'};
  const second = { ...center, x:center.x-160, label:'上一步' };
  scene=composeTemplate($('template').value, $('template').value==='sequence' ? [second,center] : [center]);
  $('opacity').value=100;
  paint();
}
function paint() {
  const area=$('mock').getBoundingClientRect();
  const sceneLayer=scene.layers.find(l=>l.id==='targets');
  $('opacity-value').textContent=`${Math.round(sceneLayer.opacity * 100)}%`;
  $('layers').replaceChildren();
  for (const layer of scene.layers) {
    const label=document.createElement('label'); label.className='layer';
    const check=document.createElement('input');check.type='checkbox';check.checked=layer.visible;
    check.setAttribute('aria-label', `显示图层 ${layer.id}`);
    check.addEventListener('change',()=>{
      scene=patchScene(scene,[{op:'set_layer',layerId:layer.id,visible:check.checked}]);paint();
    });
    const title=document.createElement('span');title.textContent=layer.id;
    const order=document.createElement('span');order.className='order';order.textContent=`Z ${layer.zIndex} · ${layer.annotations.length}`;
    label.append(check,title,order);$('layers').append(label);
  }
  const flattened=flattenScene(scene);
  renderOverlay($('canvas'),{annotations:flattened,visualStyle:$('visualStyle').value,motion:$('motion').value},{width:area.width,height:area.height});
  $('counts').textContent=`${scene.layers.length} layers · ${flattened.length} visible marks`;
  $('json').textContent=JSON.stringify(scene,null,2);
}
$('template').addEventListener('change',create);
$('visualStyle').addEventListener('change',paint);
$('motion').addEventListener('change',paint);
$('opacity').addEventListener('input',event=>{
  scene=patchScene(scene,[{op:'set_layer',layerId:'targets',opacity:Number(event.target.value)/100}]);paint();
});
$('export').addEventListener('click',async()=>{
  try {await navigator.clipboard.writeText(JSON.stringify(scene,null,2));$('export').textContent='已复制 Scene JSON';}
  catch {$('export').textContent='请复制下方 JSON';}
});
window.addEventListener('resize',create);
create();
