import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {normalizeRequest,HandoffManager} from '../src/core.mjs';
import {DEFAULT_PREFERENCES,THEMES,validatePreferences} from '../src/local/preferences.mjs';

const asset=async name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');
test('visual themes are optional, validated and backward-compatible with existing preference files',()=>{
  assert.deepEqual(THEMES,['system','dark','light']);
  assert.equal(DEFAULT_PREFERENCES.theme,'system');
  assert.equal(validatePreferences({visualStyle:'minimal'}).theme,'system');
  for(const theme of THEMES)assert.equal(validatePreferences({theme}).theme,theme);
  assert.throws(()=>validatePreferences({theme:'neon'}),/Invalid theme/);
});
test('handoff sessions retain user theme without weakening explicit completion semantics',()=>{
  const manager=new HandoffManager();
  try{
    const session=manager.show({title:'Check',message:'Read the original app',theme:'light',timeoutSeconds:12});
    assert.equal(session.theme,'light');
    const result=manager.resolve(session.id,'completed').session;
    assert.equal(result.verified,false);
    assert.equal(result.completionSource,'user_report');
    assert.equal(normalizeRequest({title:'Check',message:'Read'}).theme,'system');
    assert.throws(()=>normalizeRequest({title:'Check',message:'Read',theme:'invalid'}));
  }finally{manager.close();}
});
test('onboarding renders only local CSS, SVG, and safe text content',async()=>{
  const html=await asset('src/desktop/setup.html');
  const js=await asset('src/desktop/setup.js');
  const main=await asset('src/desktop/setup.mjs');
  const preload=await asset('src/desktop/setup-preload.cjs');
  assert.match(html,/Content-Security-Policy/);
  assert.match(html,/ui-tokens\.css/);
  assert.match(html,/id="configPreview"/);
  assert.match(html,/id="theme"/);
  assert.match(html,/id="accessibility"/);
  assert.match(html,/id="copy"[^>]*disabled/);
  assert.doesNotMatch(html,/https?:\/\//);
  assert.doesNotMatch(js,/\binnerHTML\s*=|\beval\s*\(/);
  assert.match(js,/textContent=response\?\.ok\?response\.content/);
  assert.match(js,/serial!==previewSerial/);
  assert.match(main,/event\.sender===window\.webContents/);
  assert.match(main,/ELECTRON_RUN_AS_NODE:'1'/);
  assert.match(main,/hg:setup:preview/);
  assert.match(preload,/preview:host=>ipcRenderer\.invoke/);
});
test('decision panel follows the same typographic tokens and supports high contrast and reduced motion',async()=>{
  const html=await asset('src/desktop/panel.html');
  const js=await asset('src/desktop/panel.js');
  const css=await asset('src/desktop/panel.css');
  const tokens=await asset('src/desktop/ui-tokens.css');
  assert.match(html,/ui-tokens\.css/);
  assert.match(js,/dataset\.theme/);
  assert.match(js,/await window\.handoffglass\.decide/);
  assert.match(js,/Only the broker's next state/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/forced-colors:active/);
  assert.match(tokens,/color-scheme: light/);
  assert.match(tokens,/font-synthesis: none/);
});
test('all three README languages use a single scalable vector illustration',async()=>{
  const illustration=await asset('assets/interaction-flow.svg');
  assert.match(illustration,/viewBox="0 0 1440 366"/);
  assert.match(illustration,/<title[^>]/);
  assert.doesNotMatch(illustration,/<script|<image|href="https?:/i);
  for(const locale of ['README.md','README.zh-CN.md','README.ja.md']){
    assert.match(await asset(locale),/assets\/interaction-flow\.svg/);
  }
});
