/** Shared page behavior; no polling, global listeners or work at import time. */
export const LANGUAGES = Object.freeze(['en', 'zh', 'ja']);
const fallbackAreas = new WeakSet();
const storageKey = 'handoffglass-site-lang';

export function resolveLanguage({search = '', saved, browser = 'en'} = {}) {
  const preferred = browser.startsWith('zh') ? 'zh' : browser.startsWith('ja') ? 'ja' : 'en';
  return [new URLSearchParams(search).get('lang'), saved, preferred].find(lang => LANGUAGES.includes(lang));
}

export function readLanguage() {
  let saved;
  try { saved = localStorage.getItem(storageKey); } catch { /* Storage can be disabled. */ }
  return resolveLanguage({search: location.search, saved, browser: navigator.language});
}

export function saveLanguage(language) {
  try { localStorage.setItem(storageKey, language); } catch { /* Keep the page usable without storage. */ }
}

export function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

/** A repeated selection is a no-op, including DOM updates and storage writes. */
export function bindLanguages(language, onChange) {
  const controls = [...document.querySelectorAll('[data-lang]')];
  const sync = () => {
    for (const control of controls) {
      const pressed = String(control.dataset.lang === language);
      if (control.getAttribute('aria-pressed') !== pressed) control.setAttribute('aria-pressed', pressed);
    }
  };
  for (const control of controls) control.addEventListener('click', () => {
    const next = control.dataset.lang;
    if (next === language || !LANGUAGES.includes(next)) return;
    language = next;
    sync();
    saveLanguage(language);
    onChange(language);
  });
  sync();
  saveLanguage(language);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Keep legacy clipboard fallback local, with no leftover node or lost focus.
    const active = document.activeElement;
    const selection = document.getSelection();
    const ranges = selection ? Array.from({length: selection.rangeCount}, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
    const area = document.createElement('textarea');
    area.value = text;
    fallbackAreas.add(area);
    area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(area);
    try {
      area.select();
      if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
    } finally {
      area.remove();
      active?.focus({preventScroll: true});
      if (selection && ranges.length) {
        selection.removeAllRanges();
        for (const range of ranges) selection.addRange(range);
      }
    }
  }
}

/** One blur listener per button; stale async completion never restores an old label. */
export function bindCopy({button, label = button, text, words, copiedClass}) {
  let pending = false, generation = 0;
  const reset = () => {
    generation++;
    setText(label, words().copy);
    if (copiedClass) button.classList.remove(copiedClass);
  };
  button.addEventListener('blur', event => {
    if (!fallbackAreas.has(event.relatedTarget)) reset();
  });
  button.addEventListener('click', async () => {
    if (pending) return;
    pending = true;
    const attempt = ++generation;
    try {
      await copyText(text());
      if (attempt !== generation) return;
      setText(label, words().copied);
      if (copiedClass) button.classList.add(copiedClass);
    } catch {
      // Leave the original copy action available when both clipboard paths fail.
      if (attempt === generation) reset();
    } finally {
      pending = false;
    }
  });
  return reset;
}
