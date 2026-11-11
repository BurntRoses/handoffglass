import { SHAPES, normalizeScene, composeTemplate, flattenScene } from '../src/visual/scene.mjs';
import { MARK_CATEGORIES, MARK_NAMES } from '../src/visual/catalog.mjs';
import { createMarkPicker } from '../src/desktop/mark-picker.mjs';
import { upgradeChoices } from '../src/desktop/choice-controls.mjs';
import { renderOverlay } from '../src/desktop/overlay-renderer.mjs';
const $ = id => document.getElementById(id);
const names = Object.fromEntries(Object.entries(MARK_NAMES).map(([key,names])=>[key,names[0]]));
const descriptions = { spotlight:'背景压暗，目标区域保持清晰。',glow:'只为目标铺一层柔光，保留周围内容。',dot:'固定在目标上的小圆点。',ripple:'涟漪从目标向外展开，圆心保持不动。',double_ring:'先后描绘两条同心轮廓。',strike:'划去需要忽略的内容。',cross:'标出排除项；不代替用户作决定。',check:'勾画只作视觉反馈，结果仍需核实。' };
const order=MARK_CATEGORIES.flatMap(c=>c.shapes);
let shape = 'spotlight', color = '#4e9669', view = 'single', replay = 0, payload,hidden=false;
const NS = 'http://www.w3.org/2000/svg';
createMarkPicker({categories:$('categories'),choices:$('shapes'),shape,onChange:key=>{shape=key;replay++;hidden=false;paint();}});
for(const [key,hex,title] of [['mint','#4e9669','松绿'],['blue','#749fc8','雾蓝'],['yellow','#d6a74f','麦黄'],['rose','#d78591','烟粉'],['violet','#a48bcc','鸢尾'],['white','#dceacb','月白']]){
  const b=document.createElement('button');b.type='button';b.className=`swatch swatch-${key}`;b.setAttribute('aria-label',title);b.setAttribute('aria-pressed',String(hex===color));
  b.addEventListener('click',()=>{color=hex;for(const n of $('swatches').children)n.setAttribute('aria-pressed',String(n===b));replay++;hidden=false;paint();});$('swatches').append(b);
}
const collection=document.createElement('div');collection.className='collection';
for(const [i,key] of order.entries()){
 const tile=document.createElement('div');tile.className='specimen';tile.dataset.shape=key;
 const n=document.createElement('span');n.className='specimen-index';n.textContent=String(i+1).padStart(2,'0');
 const caption=document.createElement('span');caption.className='specimen-name';caption.textContent=names[key];
 const target=document.createElement('div');target.className='specimen-target';target.textContent=key==='highlight'?'A small moment of clarity.':key==='underline'?'Somewhere worth a pause.':'Open project';
 const canvas=document.createElementNS(NS,'svg');canvas.classList.add('specimen-canvas');canvas.setAttribute('aria-hidden','true');
 tile.append(n,target,caption,canvas);collection.append(tile);
}
$('mock').insertBefore(collection,$('canvas'));
function rect(el){const a=el.getBoundingClientRect(),b=$('mock').getBoundingClientRect();return {x:a.left-b.left+a.width/2,y:a.top-b.top+a.height/2,width:a.width,height:a.height};}
function mark(target,key,i=0){return {id:`mark_${i}`, ...rect(target),shape:key,color,effect:$('effect').value,exit:$('exit').value,maskStyle:$('maskStyle').value,durationMs:Number($('duration').value),label:key==='badge'?'2':$('labels').checked&&view!=='collection'?'打开项目':''};}
function paint(){
 $('dismiss').textContent=hidden?'显示标记':'收起标记';$('maskControl').hidden=shape!=='spotlight'&&view!=='collection';
 if(hidden){
  for(const svg of [$('canvas'),...collection.querySelectorAll('svg')])renderOverlay(svg,{annotations:[],motion:$('motion').value,animateExit:true},{width:svg.clientWidth||1,height:svg.clientHeight||1});
  return;
 }
 $('mock').dataset.view=view;
 if(view!=='collection')for(const svg of collection.querySelectorAll('svg'))renderOverlay(svg,{annotations:[]},{width:1,height:1});
 let scene;
 if(view==='collection'){
  scene=normalizeScene({version:1,layers:[{id:'strokes',annotations:[...collection.children].map((tile,i)=>mark(tile.querySelector('.specimen-target'),tile.dataset.shape,i))}]});
  for(const [i,tile] of [...collection.children].entries()){
   const b=tile.getBoundingClientRect(),t=tile.querySelector('.specimen-target').getBoundingClientRect();
   renderOverlay(tile.querySelector('svg'),{sessionId:`tile-${replay}`,visualStyle:$('visualStyle').value,motion:$('motion').value,
    annotations:[{...scene.layers[0].annotations[i],x:t.left-b.left+t.width/2,y:t.top-b.top+t.height/2}]},{width:b.width,height:b.height});
  }
 }else if(view==='sequence'){
  const targets=[$('target-file'),$('target-secondary'),$('target')].map((el,i)=>({...rect(el),label:['先检查项目文件','需要时查看历史版本','然后打开项目'][i]}));
  scene=composeTemplate('sequence',targets);
  for(const layer of scene.layers)for(const a of layer.annotations){a.color=color;a.durationMs=Number($('duration').value);if(!$('labels').checked&&a.shape!=='badge')a.label='';}
 }else{
  const el=['highlight','underline','strike'].includes(shape)?$('target-text'):shape==='bracket'||shape==='box'?$('target-file'):$('target');
  scene=normalizeScene({version:1,layers:[{id:'strokes',annotations:[mark(el,shape)]}]});
 }
 const bounds=$('mock').getBoundingClientRect();
 renderOverlay($('canvas'),{sessionId:`atelier-${replay}`,annotations:view==='collection'?[]:flattenScene(scene),visualStyle:$('visualStyle').value,motion:$('motion').value},{width:bounds.width,height:bounds.height});
 $('durationLabel').textContent=`${$('duration').value} ms`;
 $('caption').textContent=view==='sequence'?'依次描绘三处目标；步骤推进由 Agent 决定。':view==='collection'?'每格独立预览，聚焦蒙版只作用于当前格。':descriptions[shape]||`${names[shape]} · 目标位置保持不动，动画在本地播放。`;
 $('counts').textContent=`${flattenScene(scene).length} MARK${flattenScene(scene).length>1?'S':''} / ${view==='collection'?`${order.length} PREVIEWS`:'SHARED SVG'}`;
 payload={name:'session_start',arguments:{mode:'guide',title:'视觉引导试用',message:'演示坐标；真实任务须重新定位目标',visualStyle:$('visualStyle').value,motion:$('motion').value,scene}};
 $('json').textContent=JSON.stringify(payload,null,2);
}
for(const id of ['visualStyle','effect','motion','labels','exit','maskStyle'])$(id).addEventListener('change',()=>{replay++;hidden=false;paint();});
$('duration').addEventListener('input',()=>{replay++;hidden=false;paint();});
$('views').addEventListener('click',event=>{const b=event.target.closest('button[data-view]');if(!b)return;view=b.dataset.view;for(const n of $('views').children)n.setAttribute('aria-pressed',String(n===b));replay++;hidden=false;paint();});
$('replay').addEventListener('click',()=>{replay++;hidden=false;paint();});
window.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='r'&&!event.metaKey&&!event.ctrlKey&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){replay++;hidden=false;paint();}});
$('dismiss').addEventListener('click',()=>{hidden=!hidden;if(!hidden)replay++;paint();});
$('export').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(JSON.stringify(payload,null,2));$('export').textContent='已复制 MCP 调用 ✓';}catch{$('json').closest('details').open=true;$('export').textContent='请复制下方示例';}});
for(const id of ['target','target-secondary'])$(id).addEventListener('click',()=>{$('feedback').textContent=id==='target'?'项目已打开 ✓ · 点击事件来自原始按钮':'历史版本已展开 ✓';$('feedback').dataset.clicked='true';});
let resize;window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(paint,80);});
upgradeChoices();
paint();
