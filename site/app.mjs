import {translations} from './translations.mjs';
import {readLanguage, bindLanguages, bindCopy, setText} from './shared.mjs';

let language = readLanguage();
let outcome = 'waiting';
let copyFrame;
const stage = document.querySelector('.experience-stage');
const title = stage.querySelector('.handoff-title');
const body = stage.querySelector('.progressive-copy span');
const stageId = stage.querySelector('.stage-id');
const sceneButtons = [...document.querySelectorAll('[data-scenario]')];
const translated = [...document.querySelectorAll('[data-i18n]')].map(node => [node, node.dataset.i18n]);
const pageTitles = {
  en: 'HandoffGlass — Desktop guidance, step by step.',
  zh: 'HandoffGlass — 桌面操作，逐步引导。',
  ja: 'HandoffGlass — 画面操作を、一歩ずつ案内。'
};
const copyButton = document.getElementById('copy-command');
const command = document.getElementById('install-command');
const resetCopy = bindCopy({
  button: copyButton,
  label: copyButton.querySelector('[data-i18n]'),
  text: () => command.textContent,
  words: () => ({copy: translations[language]['start.copy'], copied: translations[language]['start.copied']}),
  copiedClass: 'is-copied'
});

function renderOutcome() {
  const t = translations[language];
  setText(title, t[outcome === 'waiting' ? 'demo.cardtitle' : outcome === 'complete' ? 'demo.completeText' : 'demo.declineText']);
  setText(body, t[outcome === 'waiting' ? 'demo.cardbody' : outcome === 'complete' ? 'demo.completedBody' : 'demo.declinedBody']);
}

function translate() {
  const t = translations[language];
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
  document.title = pageTitles[language];
  // Outcome text is written once, preserving a completed/declined card on locale changes.
  for (const [node, key] of translated) {
    if (node !== title && node !== body && t[key] !== undefined) setText(node, t[key]);
  }
  renderOutcome();
  resetCopy();
}

function setOutcome(next) {
  outcome = next;
  if (stage.dataset.outcome !== next) stage.dataset.outcome = next;
  renderOutcome();
  // Coalesce rapid input without changing the existing CSS reveal or its timing.
  cancelAnimationFrame(copyFrame);
  body.style.animation = 'none';
  copyFrame = requestAnimationFrame(() => { body.style.animation = ''; });
}

for (const [index, button] of sceneButtons.entries()) button.addEventListener('click', () => {
  const scene = button.dataset.scenario;
  if (stage.dataset.scene !== scene) stage.dataset.scene = scene;
  setText(stageId, `SCENE ${String(index + 1).padStart(2, '0')} / 03`);
  for (const control of sceneButtons) {
    const selected = control === button, pressed = String(selected);
    control.classList.toggle('is-active', selected);
    if (control.getAttribute('aria-pressed') !== pressed) control.setAttribute('aria-pressed', pressed);
  }
  setOutcome('waiting');
});
document.getElementById('complete').addEventListener('click', () => setOutcome('complete'));
document.getElementById('decline').addEventListener('click', () => setOutcome('decline'));
bindLanguages(language, next => { language = next; translate(); });
translate();

// Align the concept marks with the actual demo target after layout or translation.
let layoutFrame;
function alignDemoTarget() {
  cancelAnimationFrame(layoutFrame);
  layoutFrame=requestAnimationFrame(()=>{
    const bounds=stage.getBoundingClientRect(),target=stage.querySelector('.mock-target').getBoundingClientRect();
    const x=(target.x-bounds.x)/bounds.width*720,y=(target.y-bounds.y)/bounds.height*500;
    const w=target.width/bounds.width*720,h=target.height/bounds.height*500;
    const cx=x+w/2,cy=y+h/2,rx=w/2+12,ry=h/2+10;
    stage.querySelector('.ink-path').setAttribute('d',`M ${cx-rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx*2} 0 a ${rx} ${ry} 0 1 0 ${-rx*2} 0`);
    const caution=stage.querySelector('.caution-art'),tag=stage.querySelector('.target-tag');
    Object.assign(caution.style,{left:`${x/720*100-1}%`,top:`${y/500*100-1}%`,width:`${w/720*100+2}%`,height:`${h/500*100+2}%`});
    Object.assign(tag.style,{left:`${Math.max(45,cx/720*100-14)}%`,top:`${(y-30)/500*100}%`});
    const mask=stage.querySelector('.guide-mask'),m=mask.getBoundingClientRect();
    const l=target.left-m.left-6,r=target.right-m.left+6,t=target.top-m.top-6,b=target.bottom-m.top+6;
    mask.style.clipPath=`polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,${l}px ${t}px,${r}px ${t}px,${r}px ${b}px,${l}px ${b}px,${l}px ${t}px)`;
  });
}
new ResizeObserver(alignDemoTarget).observe(stage);
new MutationObserver(alignDemoTarget).observe(stage.querySelector('.stage-body'),{subtree:true,childList:true,characterData:true});
document.fonts.ready.then(alignDemoTarget);
