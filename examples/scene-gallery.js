import { SHAPES, normalizeScene, composeTemplate, flattenScene } from '../src/visual/scene.mjs';
import { renderOverlay } from '../src/desktop/overlay-renderer.mjs';
const $ = id => document.getElementById(id);
const names = { arrow:'弧线箭头',ring:'精细圈选',box:'柔角描边',spotlight:'柔边聚焦',badge:'步骤角标',underline:'双笔下划线',crosshair:'精确定位',highlight:'荧光笔',bracket:'四角取景',check:'手绘勾画',scribble:'手绘双圈',halo:'呼吸光环',cursor:'引导指针' };
const descriptions = { arrow:'顺着弧线，把目光带到下一步。',ring:'一笔圈住，轻轻强调。',box:'贴合边界，保留界面的呼吸感。',spotlight:'让背景退后，让这一步清晰。',badge:'给步骤一个轻巧的序号。',underline:'像读到一句值得记住的话。',crosshair:'精确地落在目标上。',highlight:'半透明笔触，让文字依然可读。',bracket:'只留四角，让中心保持干净。',check:'一笔勾画；动作结果仍需独立验证。',scribble:'两次落笔，有一点人的温度。',halo:'以轻柔的呼吸，提示注意。',cursor:'把下一步指给你看。' };
const icons = {
  arrow:'M5 7Q20 4 20 22M15 18L20 22L24 17', ring:'M24 13C25 24 3 26 4 14C3 3 25 2 24 13Z',
  box:'M9 5H21Q25 5 25 9V21Q25 25 21 25H9Q5 25 5 21V9Q5 5 9 5Z',
  spotlight:'M8 6H22Q25 6 25 9V21Q25 24 22 24H8Q5 24 5 21V9Q5 6 8 6ZM1 2H29V28H1Z',
  badge:'M21 5A9 9 0 1 1 3 5A9 9 0 1 1 21 5M11 9V19M8 12L11 9',
  underline:'M3 18Q13 15 27 18M6 23Q18 20 25 23', crosshair:'M15 2V8M15 22V28M2 15H8M22 15H28M15 12A3 3 0 1 1 15 18A3 3 0 1 1 15 12',
  highlight:'M5 10L24 7L26 19L7 23Z', bracket:'M4 11V5H11M19 5H26V11M26 19V25H19M11 25H4V19',
  check:'M5 15L12 22L25 7',scribble:'M25 10C18 0 1 5 4 18C6 29 30 25 25 10C22 3 11 1 6 8M26 14C28 25 7 28 4 17',
  halo:'M15 5A10 10 0 1 1 15 25A10 10 0 1 1 15 5M15 12A3 3 0 1 1 15 18A3 3 0 1 1 15 12',
  cursor:'M7 3L9 26L15 19L20 28L25 25L19 17L27 14Z'
};
const order = ['scribble','ring','arrow','spotlight','highlight','underline','bracket','box','check','halo','cursor','badge','crosshair'];
let shape = 'scribble', color = '#4e9669', view = 'single', replay = 0, payload;
const NS = 'http://www.w3.org/2000/svg';
for (const key of order) {
  const button = document.createElement('button'); button.type='button'; button.className='shape-option';
  button.dataset.label=names[key];button.setAttribute('aria-label',names[key]);button.setAttribute('aria-pressed',String(shape===key));
  const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 30 30');svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS(NS,'path');
  for(const [k,v] of Object.entries({d:icons[key],fill:'none',stroke:'currentColor','stroke-width':1.6,'stroke-linecap':'round','stroke-linejoin':'round'}))path.setAttribute(k,v);
  svg.append(path);button.append(svg);$('shapes').append(button);
  button.addEventListener('click',()=>{shape=key;for(const b of $('shapes').children)b.setAttribute('aria-pressed',String(b===button));replay++;paint();});
}
for(const [key,hex,title] of [['mint','#4e9669','松绿'],['blue','#749fc8','雾蓝'],['yellow','#d6a74f','麦黄'],['rose','#d78591','烟粉'],['violet','#a48bcc','鸢尾'],['white','#dceacb','月白']]){
  const b=document.createElement('button');b.type='button';b.className=`swatch swatch-${key}`;b.setAttribute('aria-label',title);b.setAttribute('aria-pressed',String(hex===color));
  b.addEventListener('click',()=>{color=hex;for(const n of $('swatches').children)n.setAttribute('aria-pressed',String(n===b));replay++;paint();});$('swatches').append(b);
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
function mark(target,key,i=0){return {id:`mark_${i}`, ...rect(target),shape:key,color,effect:$('effect').value,durationMs:Number($('duration').value),label:$('labels').checked&&view!=='collection'?'打开项目，继续创作':''};}
function paint(){
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
  const el=['highlight','underline'].includes(shape)?$('target-text'):shape==='bracket'||shape==='box'?$('target-file'):$('target');
  scene=normalizeScene({version:1,layers:[{id:'strokes',annotations:[mark(el,shape)]}]});
 }
 const bounds=$('mock').getBoundingClientRect();
 renderOverlay($('canvas'),{sessionId:`atelier-${replay}`,annotations:view==='collection'?[]:flattenScene(scene),visualStyle:$('visualStyle').value,motion:$('motion').value},{width:bounds.width,height:bounds.height});
 $('durationLabel').textContent=`${$('duration').value} ms`;
 $('caption').textContent=view==='sequence'?'依次描绘三处目标；步骤推进由 Agent 决定。':view==='collection'?'每格独立预览，聚焦蒙版只作用于当前格。':descriptions[shape];
 $('counts').textContent=`${flattenScene(scene).length} MARK${flattenScene(scene).length>1?'S':''} / ${view==='collection'?'13 PREVIEWS':'SHARED SVG'}`;
 payload={name:'session_start',arguments:{mode:'guide',title:'视觉引导试用',message:'演示坐标；真实任务须重新定位目标',visualStyle:$('visualStyle').value,motion:$('motion').value,scene}};
 $('json').textContent=JSON.stringify(payload,null,2);
}
for(const id of ['visualStyle','effect','motion','labels'])$(id).addEventListener('change',()=>{replay++;paint();});
$('duration').addEventListener('input',()=>{replay++;paint();});
$('views').addEventListener('click',event=>{const b=event.target.closest('button[data-view]');if(!b)return;view=b.dataset.view;for(const n of $('views').children)n.setAttribute('aria-pressed',String(n===b));replay++;paint();});
$('replay').addEventListener('click',()=>{replay++;paint();});
window.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='r'&&!event.metaKey&&!event.ctrlKey&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){replay++;paint();}});
$('export').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(JSON.stringify(payload,null,2));$('export').textContent='已复制 MCP 调用 ✓';}catch{$('json').closest('details').open=true;$('export').textContent='请复制下方示例';}});
for(const id of ['target','target-secondary'])$(id).addEventListener('click',()=>{$('feedback').textContent=id==='target'?'项目已打开 ✓ · 点击事件来自原始按钮':'历史版本已展开 ✓';$('feedback').dataset.clicked='true';});
let resize;window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(paint,80);});
paint();
