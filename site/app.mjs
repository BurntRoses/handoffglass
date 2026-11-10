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
  en: 'HandoffGlass — The handoff, made visible.',
  zh: 'HandoffGlass — 下一步，指给你看。',
  ja: 'HandoffGlass — 次の一手を、見えるかたちに。'
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
